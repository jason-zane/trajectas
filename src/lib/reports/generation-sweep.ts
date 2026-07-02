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
 * involve LLM narrative calls and defers a headless-Chromium PDF render
 * (~500MB–1GB) on the same instance.
 */
export const REPORT_PROCESS_CONCURRENCY = 2

/** Max pending snapshots picked up per sweep run; backlog drains over runs. */
export const SWEEP_BATCH = 10

/**
 * A snapshot 'generating' for longer than this is presumed orphaned (the
 * instance died mid-job) and is reset to pending. Must exceed the longest
 * function maxDuration (300s) so a live job is never reset under itself.
 */
export const STUCK_GENERATING_THRESHOLD_MS = 15 * 60 * 1000

export interface GenerationSweepResult {
  resetStuck: number
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
): Promise<{ processed: number; failed: number }> {
  let processed = 0
  let failed = 0

  for (let i = 0; i < ids.length; i += REPORT_PROCESS_CONCURRENCY) {
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

  // 2. Pick up the oldest pending snapshots (uses report_snapshots_pending_idx).
  const { data: pendingRows, error: pendingError } = await db
    .from('report_snapshots')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(SWEEP_BATCH)

  if (pendingError) {
    console.error('[reports] Sweep failed to list pending snapshots:', pendingError)
    return { resetStuck, picked: 0, processed: 0, failed: 0 }
  }

  const ids = (pendingRows ?? []).map((row: { id: string }) => row.id)

  // 3. Process with bounded concurrency; the claim guard in processSnapshot
  // makes races with the trigger path harmless.
  const { processed, failed } = await processSnapshotsBounded(ids, processFn)

  return { resetStuck, picked: ids.length, processed, failed }
}
