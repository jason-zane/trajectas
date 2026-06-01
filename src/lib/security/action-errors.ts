import { reportError } from "@/lib/observability/report-error";

/**
 * Log a handled server-side error.
 *
 * Delegates to reportError(), which structured-logs to the console AND
 * best-effort persists to error_events so failures survive Vercel's log window.
 * Persistence is fire-and-forget here (this helper is synchronous and called
 * widely); critical async paths should `await reportError(...)` directly for a
 * guaranteed write.
 */
export function logActionError(context: string, error: unknown) {
  try {
    void reportError(error, {
      source: context,
      severity: "error",
      alert: false,
    }).catch(() => {});
  } catch {
    // reportError should never throw synchronously, but logging must never
    // break the caller — fall back to a plain console log.
    console.error(`[${context}]`, error);
  }
}

export function throwActionError(
  context: string,
  publicMessage: string,
  error: unknown
): never {
  logActionError(context, error);
  throw new Error(publicMessage);
}
