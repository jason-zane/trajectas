import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSupabaseWithReadRetry } from '@/lib/supabase/read-fetch'

const url = 'http://127.0.0.1:54321/rest/v1/test'
const socketError = () => new TypeError('fetch failed', { cause: { code: 'UND_ERR_SOCKET' } })
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Supabase read-only transport recovery', () => {
  it.each(['GET', 'HEAD'])('recovers a closed socket for %s with at most two retries', async method => {
    const expected = new Response(null, { status: 200 })
    const fetch = vi.fn().mockRejectedValueOnce(socketError()).mockRejectedValueOnce(socketError()).mockResolvedValue(expected)
    vi.stubGlobal('fetch', fetch)
    const result = fetchSupabaseWithReadRetry(url, { method })
    await vi.runAllTimersAsync()
    expect(await result).toBe(expected)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it.each(['POST', 'PATCH', 'DELETE', 'PUT'])('never repeats an uncertain %s mutation', async method => {
    const fetch = vi.fn().mockRejectedValue(socketError())
    vi.stubGlobal('fetch', fetch)
    await expect(fetchSupabaseWithReadRetry(url, { method })).rejects.toThrow('fetch failed')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([401, 403, 404, 429, 500, 503])('returns HTTP%s unchanged without retry', async status => {
    const response = new Response(null, { status })
    const fetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetch)
    expect(await fetchSupabaseWithReadRetry(url)).toBe(response)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry an abort or a signal cancelled during backoff', async () => {
    const controller = new AbortController()
    const fetch = vi.fn().mockRejectedValue(socketError())
    vi.stubGlobal('fetch', fetch)
    const outcome = fetchSupabaseWithReadRetry(url, { signal: controller.signal }).catch(error => error)
    await vi.advanceTimersByTimeAsync(0)
    controller.abort()
    await vi.runAllTimersAsync()
    expect(await outcome).toMatchObject({ name: 'AbortError' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('marks exhausted reads distinctly from retriable form writes', async () => {
    const fetch = vi.fn().mockRejectedValue(socketError())
    vi.stubGlobal('fetch', fetch)
    const outcome = fetchSupabaseWithReadRetry(url).catch(error => error)
    await vi.runAllTimersAsync()
    expect(await outcome).toMatchObject({ name: 'SupabaseReadRetriesExhaustedError' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
