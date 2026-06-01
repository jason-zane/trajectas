import { after } from "next/server";

import { reportError } from "@/lib/observability/report-error";

/**
 * Log a handled server-side error.
 *
 * Delegates to reportError(), which structured-logs to the console AND persists
 * to error_events so failures survive Vercel's log window. The persistence is
 * scheduled via `after()` so it completes after the response flushes rather
 * than being cut short by the serverless function returning. Outside a request
 * scope (scripts/build) it falls back to a best-effort fire-and-forget.
 */
export function logActionError(context: string, error: unknown) {
  const persist = () =>
    reportError(error, { source: context, severity: "error", alert: false });
  try {
    after(persist);
  } catch {
    void persist().catch(() => {});
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
