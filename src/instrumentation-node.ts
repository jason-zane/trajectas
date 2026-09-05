import type { Instrumentation } from 'next'
import { reportError } from '@/lib/observability/report-error'
import { redactDiagnosticText } from '@/lib/observability/redact'

/**
 * Route unhandled server errors (render-time and action errors) to the
 * error_events table via reportError so they persist in the database
 * rather than vanishing into logs.
 */
export const reportRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  const error = err as Error & { digest?: string }

  try {
    await reportError(error, {
      source: 'onRequestError',
      context: {
        digest: error.digest ?? null,
        path: request.path,
        method: request.method,
        routePath: context.routePath,
        routeType: context.routeType,
        renderSource: context.renderSource ?? null,
        routerKind: context.routerKind ?? null,
      },
      severity: 'error',
    })
  } catch {
    // reportError swallows its own failures, but if something catastrophic
    // happens, log as last resort. Never rethrow — instrumentation hooks
    // must not break the path they instrument.
    console.error('[onRequestError] failed to report error', redactDiagnosticText(error.message))
  }
}
