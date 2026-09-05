/**
 * Report-generation sweep cron.
 *
 * Runs every few minutes as the durable safety net for report snapshot
 * processing: picks up pending snapshots whose submit-time trigger failed
 * (rate limit, transient network) and resets snapshots orphaned in
 * 'generating' by a dead instance. All selection + processing logic lives in
 * src/lib/reports/generation-sweep.ts; this route is just the secured
 * Vercel-cron entry point.
 *
 * Secured by the standard Vercel cron pattern: an Authorization: Bearer
 * ${CRON_SECRET} header, which Vercel injects automatically for scheduled
 * invocations. Scheduling is defined in vercel.json (`crons` array).
 *
 * maxDuration is 300 (matching /api/reports/generate) — a batch of 10
 * snapshots at concurrency 2 with AI narratives + deferred PDF renders does
 * not reliably fit in 60s. A timeout mid-batch is safe: claimed snapshots are
 * reset by the next run's stuck-generating recovery.
 */

import { NextResponse } from 'next/server'
import { recoverInterruptedSessionProcessing } from '@/lib/dal/session-processing-recovery'
import { sweepReportGeneration } from '@/lib/reports/generation-sweep'
import { reportError } from '@/lib/observability/report-error'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron:report-generation-sweep] CRON_SECRET not configured')
    return new Response('CRON_SECRET not configured', { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const sessionRecovery = await recoverInterruptedSessionProcessing()
    const result = await sweepReportGeneration()
    return NextResponse.json({ ok: true, sessionRecovery, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron:report-generation-sweep] sweep failed:', message)
    await reportError(err, {
      source: 'cron.report-generation-sweep',
      severity: 'error',
      alert: true,
      context: { phase: 'sweep' },
    })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
