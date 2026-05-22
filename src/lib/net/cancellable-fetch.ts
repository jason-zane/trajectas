/**
 * `cancellableFetch` — for long-running and streaming client fetches where
 * the operation can legitimately take minutes (chat streaming, generation
 * kickoff, readiness polling). Do NOT use this for interactive calls; use
 * `fetchWithTimeout` for those.
 *
 * The caller owns the `AbortController` (typically stored in a `useRef`)
 * and is responsible for:
 *
 * - Surfacing a user-visible Cancel button that invokes `controller.abort()`
 * - Optionally implementing a per-chunk read timeout for streams that should
 *   not stall mid-stream
 * - Detecting user-initiated aborts and rendering a "Cancelled" state
 *
 * There is intentionally no timeout argument — the platform's `maxDuration`
 * (Vercel default 300s) is the implicit ceiling. Adding a blanket timeout
 * would kill legitimate long operations, which was the regression that PR 2
 * exists to prevent.
 */
export function cancellableFetch(
  input: RequestInfo | URL,
  init: RequestInit & { controller: AbortController },
): Promise<Response> {
  const { controller, ...rest } = init
  return fetch(input, { ...rest, signal: controller.signal })
}

/**
 * Returns true if the given error is a user-initiated AbortError (as opposed
 * to a TimeoutError or network failure).
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}
