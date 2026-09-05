/**
 * Report-generation sweep.
 *
 * Durable safety net for report snapshot processing. The primary path is the
 * submit flow triggering /api/reports/generate, but that trigger can fail
 * (rate limit, transient network) — this sweep guarantees pending snapshots
 * are eventually processed, and recovers snapshots stuck in 'generating'
 * after an instance died mid-job.
 *
 * Driven by the /api/cron/report-generation-sweep cron (every 5 minutes).
 * Safe to run concurrently with the trigger path: processSnapshot atomically
 * claims pending→generating, so duplicate pickups are no-ops.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { processSnapshot } from '@/lib/reports/runner'

type AdminClient = ReturnType<typeof createAdminClient>
type ProcessFn = typeof processSnapshot

/**
 * How many snapshots are generated at once. Kept low because each job can
 * involve LLM narrative calls. Chromium runs separately in the PDF worker.
 */
export const REPORT_PROCESS_CONCURRENCY = 2

/** Max pending snapshots picked up per sweep round. */
export const SWEEP_BATCH = 10

/**
 * Wall-clock budget for one sweep run. The cron route's maxDuration is 300s;
 * stop picking new batches with headroom so in-flight jobs can finish.
 */
export const SWEEP_TIME_BUDGET_MS = 150 * 1000

/** Safety valve on sweep rounds in case pending rows never drain. */
const MAX_SWEEP_ROUNDS = 20

/**
 * Cheap backpressure hint before pickup. The atomic database claim also
 * enforces this bound, including single-snapshot/manual requests.
 */
export const MAX_GLOBAL_GENERATING = 6

/**
 * A snapshot 'generating' for longer than this is presumed orphaned (the
 * instance died mid-job) and is reset to pending. Must exceed the longest
 * function maxDuration (300s) so a live job is never reset under itself.
 */
export const STUCK_GENERATING_THRESHOLD_MS = 15 * 60 * 1000

export interface GenerationSweepResult {
  resetStuck: number
  resetStuckPdf: number
  picked: number
  processed: number
  failed: number
}

export interface GenerationSweepOptions {
  /** Override "now" — used by tests. */
  now?: Date
  /** Inject a Supabase admin client — used by tests. */
  client?: AdminClient
  /** Inject the snapshot processor — used by tests to avoid the real pipeline. */
  processFn?: ProcessFn
}

/**
 * Process snapshots with bounded concurrency (chunked, like the campaign
 * invite email sender). Per-id failures are logged and counted, never abort
 * the batch.
 */
export async function processSnapshotsBounded(
  ids: string[],
  processFn: ProcessFn = processSnapshot,
  deadline = Date.now() + SWEEP_TIME_BUDGET_MS,
): Promise<{ processed: number; failed: number }> {
  let processed = 0
  let failed = 0

  for (let i = 0; i < ids.length; i += REPORT_PROCESS_CONCURRENCY) {
    if (Date.now() >= deadline) break
    const chunk = ids.slice(i, i + REPORT_PROCESS_CONCURRENCY)
    await Promise.all(
      chunk.map(async (id) => {
        try {
          await processFn(id)
          processed += 1
        } catch (error) {
          failed += 1
          console.error(`[reports] Failed to process snapshot ${id}:`, error)
        }
      }),
    )
  }

  return { processed, failed }
}

/**
 * Whether the trigger path should skip inline processing and leave snapshots
 * pending for the sweep. True when the platform-wide count of 'generating'
 * snapshots is at or above MAX_GLOBAL_GENERATING — the per-request concurrency
 * cap doesn't bound concurrent *requests*, so this is the global brake during
 * completion bursts. Fails open (returns false) on a count error: processing
 * inline is the pre-existing behaviour and the claim guard keeps it safe.
 */
export async function shouldDeferInlineProcessing(
  client?: AdminClient,
): Promise<boolean> {
  const db = client ?? createAdminClient()
  const { count, error } = await db
    .from('report_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'generating')

  if (error) {
    console.error('[reports] Failed to count generating snapshots:', error)
    return false
  }

  return (count ?? 0) >= MAX_GLOBAL_GENERATING
}

export async function sweepReportGeneration(
  opts: GenerationSweepOptions = {},
): Promise<GenerationSweepResult> {
  const db = opts.client ?? createAdminClient()
  const processFn = opts.processFn ?? processSnapshot
  const now = opts.now ?? new Date()

  // 1. Reset orphaned 'generating' rows first so they're eligible this run.
  const stuckCutoff = new Date(
    now.getTime() - STUCK_GENERATING_THRESHOLD_MS,
  ).toISOString()
  const { data: resetRows, error: resetError } = await db
    .from('report_snapshots')
    .update({ status: 'pending' })
    .eq('status', 'generating')
    .lt('updated_at', stuckCutoff)
    .select('id')

  if (resetError) {
    console.error('[reports] Sweep failed to reset stuck snapshots:', resetError)
  }
  const resetStuck = (resetRows ?? []).length

  // Recovery shares the PDF claimant's lock and uses its dedicated lease
  // timestamp. Failed attempts retain a bounded, durable retry budget.
  const { data: resetPdfCount, error: resetPdfError } = await db.rpc('recover_report_pdf_jobs')

  if (resetPdfError) {
    console.error('[reports] Sweep failed to reset stuck PDF generations:', resetPdfError)
  }
  const resetStuckPdf = Number(resetPdfCount ?? 0)

  // 2. Drain pending snapshots in batches until the queue is empty or the
  // time budget runs out. Processing flips rows out of 'pending', so each
  // round's oldest-first query naturally advances (report_snapshots_pending_idx).
  let picked = 0
  let processed = 0
  let failed = 0
  const startedAt = Date.now()

  for (let round = 0; round < MAX_SWEEP_ROUNDS; round += 1) {
    if (round > 0 && Date.now() - startedAt >= SWEEP_TIME_BUDGET_MS) break
    if (await shouldDeferInlineProcessing(db)) break

    const { data: pendingRows, error: pendingError } = await db
      .from('report_snapshots')
      .select('id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(SWEEP_BATCH)

    if (pendingError) {
      console.error('[reports] Sweep failed to list pending snapshots:', pendingError)
      break
    }

    const ids = (pendingRows ?? []).map((row: { id: string }) => row.id)
    if (ids.length === 0) break

    // 3. Process with bounded concurrency; the claim guard in processSnapshot
    // makes races with the trigger path harmless.
    const result = await processSnapshotsBounded(ids, processFn, startedAt + SWEEP_TIME_BUDGET_MS)
    picked += ids.length
    processed += result.processed
    failed += result.failed

    // A short batch means the queue is drained.
    if (ids.length < SWEEP_BATCH) break
  }

  return { resetStuck, resetStuckPdf, picked, processed, failed }
}
