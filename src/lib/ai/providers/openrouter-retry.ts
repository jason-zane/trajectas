const DEFAULT_MAX_ATTEMPTS = 4
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 10000

type RetryableError = {
  status?: number
  headers?: Headers
  response?: {
    headers?: Headers
  }
  error?: {
    message?: string
    metadata?: {
      raw?: string
    }
  }
  message?: string
}

function getRetryAfterMs(error: RetryableError): number | null {
  const retryAfter =
    error.headers?.get('retry-after') ??
    error.response?.headers?.get?.('retry-after') ??
    null

  if (!retryAfter) return null

  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000
  }

  const dateMs = Date.parse(retryAfter)
  if (Number.isNaN(dateMs)) return null

  return Math.max(0, dateMs - Date.now())
}

export function isRetryableOpenRouterError(error: unknown): error is RetryableError {
  const status = (error as RetryableError | undefined)?.status
  return status === 429 || (typeof status === 'number' && status >= 500)
}

export function getOpenRouterErrorMessage(error: unknown): string {
  const candidate = error as RetryableError | undefined
  return (
    candidate?.error?.metadata?.raw ??
    candidate?.error?.message ??
    candidate?.message ??
    'Provider returned error'
  )
}

export async function withOpenRouterRetry<T>(
  operation: () => Promise<T>,
  options?: {
    maxAttempts?: number
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isRetryableOpenRouterError(error) || attempt === maxAttempts) {
        throw error
      }

      const retryAfterMs = getRetryAfterMs(error)
      const exponentialDelayMs = Math.min(
        BASE_DELAY_MS * 2 ** (attempt - 1),
        MAX_DELAY_MS,
      )
      const jitterMs = Math.floor(Math.random() * 250)
      const delayMs = Math.max(retryAfterMs ?? 0, exponentialDelayMs + jitterMs)

      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}
