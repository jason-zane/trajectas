import 'server-only'

const TRANSIENT_SOCKET_CODES = new Set(['UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'])

function isTransientSocketFailure(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const value = error as { name?: string; message?: string; code?: string; cause?: { code?: string } }
  if (value.name === 'AbortError' || value.name === 'TimeoutError') return false
  if (value.cause?.code) return TRANSIENT_SOCKET_CODES.has(value.cause.code)
  if (value.code) return TRANSIENT_SOCKET_CODES.has(value.code)
  return value.name === 'TypeError' && /^(fetch failed|Failed to fetch)$/i.test(value.message ?? '')
}

function pause(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    const aborted = () => { clearTimeout(timer); reject(signal?.reason ?? new Error('Request aborted')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', aborted); resolve() }, ms)
    signal?.addEventListener('abort', aborted, { once: true })
    if (signal?.aborted) aborted()
  })
}

/** Retry only GET/HEAD socket failures. HTTP errors and all writes/RPC POSTs
 * retain their original result; callers own any explicitly idempotent write retry. */
export async function fetchSupabaseWithReadRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : undefined
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
  const signal = init?.signal ?? request?.signal
  const canRetry = method === 'GET' || method === 'HEAD'
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted()
    try {
      return await fetch(input, init)
    } catch (error) {
      if (!canRetry || signal?.aborted || !isTransientSocketFailure(error)) throw error
      if (attempt >= 2) {
        // PostgREST preserves error.name/message, not custom error codes.
        // Distinguish exhausted read retries so the form's idempotent-write
        // recovery does not multiply this read retry budget.
        const exhausted = new Error('Supabase read failed after bounded transport retries', { cause: error })
        exhausted.name = 'SupabaseReadRetriesExhaustedError'
        throw exhausted
      }
      await pause(100 * (attempt + 1) + Math.random() * 100, signal)
    }
  }
}
