/**
 * `fetchWithTimeout` — for interactive and medium-length client fetches that
 * MUST resolve or fail within a known time budget. Do NOT use this for long-
 * running endpoints (chat streaming, generation kickoff, readiness polling);
 * use `cancellableFetch` from this directory instead.
 *
 * The helper feature-detects `AbortSignal.timeout()` and `AbortSignal.any()`
 * — both are Baseline 2024 features, and Next.js 16's documented browser
 * floor (Safari 16.4+) is below that baseline. When the modern APIs are not
 * available, it falls back to a manual `AbortController` + `setTimeout`
 * implementation and an event-listener combiner.
 *
 * On timeout, the underlying fetch rejects with a `DOMException` whose
 * `name === 'TimeoutError'`. Callers should distinguish this from
 * user-initiated aborts (also `AbortError`, but emitted by a different
 * controller).
 */

function createTimeoutSignal(timeoutMs: number): {
  signal: AbortSignal
  cleanup: () => void
} {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(timeoutMs), cleanup: () => {} }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"))
  }, timeoutMs)

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeout),
  }
}

function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1) return signals[0]

  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals)
  }

  const controller = new AbortController()
  const propagate = (signal: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason)
  }

  for (const signal of signals) {
    if (signal.aborted) {
      propagate(signal)
      break
    }
    signal.addEventListener("abort", () => propagate(signal), { once: true })
  }

  return controller.signal
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs: number }
): Promise<Response> {
  const { timeoutMs, signal, ...rest } = init
  const timeout = createTimeoutSignal(timeoutMs)
  const signals = signal ? [signal, timeout.signal] : [timeout.signal]

  try {
    return await fetch(input, { ...rest, signal: combineSignals(signals) })
  } finally {
    timeout.cleanup()
  }
}

/**
 * Type guard for distinguishing fetch timeouts from other AbortError causes.
 */
export function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.message.toLowerCase().includes("timeout"))
  )
}
