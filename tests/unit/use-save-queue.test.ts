// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockFetch = vi.fn()

function jsonResponse(status = 200, body: Record<string, unknown> = { success: true }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const { useSaveQueue } = await import('@/components/assess/use-save-queue')

describe('useSaveQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Fake only the timer APIs — leaving queueMicrotask alone so awaited
    // promise continuations (e.g. the post-fetch retry-scheduling chain) run
    // normally between timer advances.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    })
    mockFetch.mockResolvedValue(jsonResponse())
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function bodyOf(call: unknown): Record<string, unknown> {
    const [, init] = call as [string, RequestInit]
    return JSON.parse(init.body as string)
  }

  it('processes a single save successfully', async () => {
    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    await act(async () => {
      result.current.enqueueSave({
        itemId: 'item-1',
        sectionId: 'sec-1',
        value: 3,
      })
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })
    })

    expect(mockFetch.mock.calls[0][0]).toBe('/api/assess/save')
    expect(bodyOf(mockFetch.mock.calls[0])).toMatchObject({
      token: 'tok',
      sessionId: 'sess',
      itemId: 'item-1',
      sectionId: 'sec-1',
      responseValue: 3,
    })
    expect(result.current.saveStatus).toBe('saved')
    expect(result.current.saveError).toBe(false)
  })

  it('fires multiple distinct-itemId saves concurrently up to CONCURRENCY', async () => {
    // Hold every fetch open until we release it, so we can observe true
    // concurrency rather than serial completion order.
    const resolvers: Array<() => void> = []
    mockFetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(() => resolve(jsonResponse()))
        }),
    )

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    await act(async () => {
      for (let i = 1; i <= 5; i++) {
        result.current.enqueueSave({
          itemId: `item-${i}`,
          sectionId: 'sec-1',
          value: i,
        })
      }
      await vi.waitFor(() => {
        // CONCURRENCY = 4 → first four fire immediately, fifth waits.
        expect(mockFetch).toHaveBeenCalledTimes(4)
      })
    })

    // Release the first four; the fifth should then fire.
    await act(async () => {
      for (const r of resolvers.splice(0, 4)) r()
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(5)
      })
      // Release the fifth too so the queue drains and the test exits cleanly.
      for (const r of resolvers.splice(0)) r()
    })
  })

  it('serialises saves for the same itemId across concurrent fires', async () => {
    const resolvers: Array<() => void> = []
    const fireOrder: number[] = []
    mockFetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve) => {
          const body = JSON.parse(init.body as string)
          fireOrder.push(body.responseValue)
          resolvers.push(() => resolve(jsonResponse()))
        }),
    )

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    await act(async () => {
      // Three saves for SAME itemId — should fire one at a time, last value wins.
      result.current.enqueueSave({ itemId: 'item-X', sectionId: 'sec', value: 1 })
      result.current.enqueueSave({ itemId: 'item-X', sectionId: 'sec', value: 2 })
      result.current.enqueueSave({ itemId: 'item-X', sectionId: 'sec', value: 3 })

      await vi.waitFor(() => {
        // Only the first should be in flight; values 2 and 3 dedup into one queued entry.
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })
    })

    expect(fireOrder).toEqual([1])

    // Release the in-flight save; the deduped follow-up (value=3, not 2) should fire next.
    await act(async () => {
      resolvers.shift()!()
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
      resolvers.shift()!()
    })

    expect(fireOrder).toEqual([1, 3])
  })

  it('retries failed saves up to MAX_RETRIES then moves to failed list', async () => {
    mockFetch.mockResolvedValue(jsonResponse(500, { error: 'boom' }))

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 3 })
      // Drain the full retry chain. runAllTimersAsync chases setTimeout
      // callbacks (and microtasks scheduled inside them) until the queue
      // settles or the max-retries threshold is hit.
      await vi.runAllTimersAsync()
    })

    // 1 initial attempt + 4 retries = 5 total calls (MAX_RETRIES = 5).
    expect(mockFetch).toHaveBeenCalledTimes(5)
    expect(result.current.saveError).toBe(true)
  })

  it('retryFailedSaves re-enqueues failed entries', async () => {
    let callCount = 0
    mockFetch.mockImplementation(async () => {
      callCount++
      if (callCount <= 5) return jsonResponse(500, { error: 'boom' })
      return jsonResponse()
    })

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 3 })
      await vi.runAllTimersAsync()
    })

    expect(result.current.saveError).toBe(true)

    await act(async () => {
      result.current.retryFailedSaves()
      await vi.runAllTimersAsync()
    })

    expect(result.current.saveError).toBe(false)
    // runAllTimersAsync drains every timer including the 2s saved→idle
    // transition, so saveStatus may have settled to either 'saved' or 'idle'
    // by this point. Both indicate the queue drained successfully.
    expect(['saved', 'idle']).toContain(result.current.saveStatus)
  })

  it('deduplicates pending saves for the same itemId (last-write-wins)', async () => {
    const savedValues: number[] = []
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      savedValues.push(body.responseValue)
      return jsonResponse()
    })

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 1 })
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 2 })
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 3 })

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    // The first save (value 1) starts immediately, then 2 and 3 dedup to a single
    // queued entry with value=3. So we expect at most two fetches and the last is 3.
    expect(savedValues.length).toBeLessThanOrEqual(2)
    expect(savedValues[savedValues.length - 1]).toBe(3)
  })

  it('enqueueSaveAndWait resolves when save completes', async () => {
    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    let resolved = false
    await act(async () => {
      const promise = result.current.enqueueSaveAndWait({
        itemId: 'item-1',
        sectionId: 'sec-1',
        value: 5,
      })
      promise.then((ok) => { resolved = ok })

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })
    })

    expect(resolved).toBe(true)
    expect(result.current.saveStatus).toBe('saved')
  })
})
