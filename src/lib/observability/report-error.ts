import 'server-only'

import { isProxy } from 'node:util/types'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendOpsAlert } from './ops-alert'
import { diagnosticContextProjection } from './redact'

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

/** Plain SDK errors are data, not arbitrary objects to serialize or coerce. */
function normalizeReportedError(error: unknown): {
  message: string
  stack: string | null
  errorDetails?: Record<string, string>
} {
  // Even property descriptors on a Proxy can execute caller-controlled traps.
  if (isProxy(error)) return { message: 'Operation failed', stack: null }
  if (error !== null && typeof error === 'object') {
    const ownString = (key: string): string | undefined => {
      const descriptor = Object.getOwnPropertyDescriptor(error, key)
      return descriptor && 'value' in descriptor && typeof descriptor.value === 'string'
        ? descriptor.value
        : undefined
    }
    // Database details/hints can include complete rows or credential values.
    // Retain only recognisable SQLSTATE and PostgREST codes, never those fields.
    const code = ownString('code')
    const errorDetails = code && /^(?:[A-Z0-9]{5}|PGRST[0-9]{3})$/.test(code) ? { code } : undefined
    return {
      // SQL/SDK messages and Error stacks can contain names, answers and full
      // rows. Keep a fixed classification and code rather than regex guesses.
      message: code==='57014' ? 'Database statement timed out or was cancelled' : errorDetails ? 'Database operation failed' : 'Operation failed',
      stack: null,
      ...(errorDetails ? { errorDetails } : {}),
    }
  }
  return { message: 'Operation failed', stack: null }
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
  const { message, stack, errorDetails } = normalizeReportedError(error)
  const source = /^[a-zA-Z][a-zA-Z0-9_.-]{0,119}$/.test(opts.source) ? opts.source : 'unclassified'
  const fingerprint = makeFingerprint(source, message) + (errorDetails?.code ? ':'+errorDetails.code : '')
  const context = {
    ...(isProxy(opts.context) ? {} : diagnosticContextProjection(opts.context)),
    ...(errorDetails ? { errorDetails } : {}),
  }

  // 1. Structured log — always, first, so it survives a DB/email outage.
  //    Bearer links must never enter logs, persisted events, or alert emails.
  console.error(`[${source}]`, { message, stack }, context)

  // 2. Ops alert (best-effort, throttled inside sendOpsAlert). `alerted`
  //    reflects whether an alert was ACTUALLY dispatched (not just requested) —
  //    sendOpsAlert no-ops without config and when throttled.
  const shouldAlert = opts.alert ?? severity === 'fatal'
  const alerted = shouldAlert
    ? await sendOpsAlert({
        subject: `${severity}: ${source}`,
        body: [
          message,
          stack ?? '',
          Object.keys(context).length ? JSON.stringify(context, null, 2) : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        fingerprint,
      })
    : false

  // 3. Persist (best-effort; never throw). The Supabase client returns the
  //    error rather than throwing, so check it explicitly.
  try {
    const db = createAdminClient()
    const { error: insertError } = await db.from('error_events').insert({
      severity,
      source,
      message,
      stack,
      fingerprint,
      context,
      actor_profile_id: opts.actorProfileId ?? null,
      request_id: opts.requestId ?? null,
      alerted,
    })
    if (insertError) {
      console.error('[report-error] failed to persist error_event', normalizeReportedError(insertError))
    }
  } catch (dbErr) {
    console.error('[report-error] failed to persist error_event', normalizeReportedError(dbErr))
  }

  // TODO(sentry): when SENTRY_DSN is set, also forward here:
  //   Sentry.captureException(error, { level: severity, tags: { source: opts.source } })
}
