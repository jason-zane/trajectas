import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendOpsAlert } from './ops-alert'

export type ErrorSeverity = 'warning' | 'error' | 'fatal'

export interface ReportErrorOptions {
  /** Logical origin, e.g. 'reports.runner' or 'cron.account-deletion'. */
  source: string
  severity?: ErrorSeverity
  /** Structured, non-sensitive context (ids, counts) to aid debugging. */
  context?: Record<string, unknown>
  /**
   * Whether to also email an ops alert. Defaults to true for 'fatal', false
   * otherwise — so routine handled errors are recorded but only genuine
   * incidents page someone.
   */
  alert?: boolean
  actorProfileId?: string | null
  requestId?: string | null
}

/**
 * Build a stable grouping key from the source + a normalised message
 * (ids/numbers collapsed) so the same failure aggregates to one fingerprint.
 */
export function makeFingerprint(source: string, message: string): string {
  const normalised = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\d+/g, '<n>')
    .trim()
    .slice(0, 200)
  return `${source}:${normalised}`
}

/**
 * Central server-side error sink. Always logs (so the signal survives even if
 * the DB write fails), persists to error_events for retention/aggregation, and
 * optionally emails an ops alert. Never throws — instrumentation must not break
 * the path it instruments.
 *
 * This is the single seam for a future Sentry integration: when SENTRY_DSN is
 * configured, add `Sentry.captureException(error, { tags: { source } })` here.
 */
export async function reportError(
  error: unknown,
  opts: ReportErrorOptions,
): Promise<void> {
  const severity = opts.severity ?? 'error'
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? (error.stack ?? null) : null
  const fingerprint = makeFingerprint(opts.source, message)
  const context = opts.context ?? {}

  // 1. Structured log — always, first, so it survives a DB/email outage.
  //    Log the original error (preserving the stack in the console) + context.
  console.error(`[${opts.source}]`, error, context)

  // 2. Ops alert (best-effort, throttled inside sendOpsAlert).
  const shouldAlert = opts.alert ?? severity === 'fatal'
  if (shouldAlert) {
    await sendOpsAlert({
      subject: `${severity}: ${opts.source}`,
      body: [
        message,
        stack ?? '',
        Object.keys(context).length ? JSON.stringify(context, null, 2) : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
      fingerprint,
    })
  }

  // 3. Persist (best-effort; swallow any failure).
  try {
    const db = createAdminClient()
    await db.from('error_events').insert({
      severity,
      source: opts.source,
      message,
      stack,
      fingerprint,
      context,
      actor_profile_id: opts.actorProfileId ?? null,
      request_id: opts.requestId ?? null,
      alerted: shouldAlert,
    })
  } catch (dbErr) {
    console.error('[report-error] failed to persist error_event', dbErr)
  }

  // TODO(sentry): when SENTRY_DSN is set, also forward here:
  //   Sentry.captureException(error, { level: severity, tags: { source: opts.source } })
}
