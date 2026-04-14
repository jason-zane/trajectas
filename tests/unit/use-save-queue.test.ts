// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the server action
const mockSaveResponseLite = vi.fn()
vi.mock('@/app/actions/assess', () => ({
  saveResponseLite: (...args: unknown[]) => mockSaveResponseLite(...args),
}))

const { useSaveQueue } = await import('@/components/assess/use-save-queue')

describe('useSaveQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockSaveResponseLite.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

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
      // Let the queue drain
      await vi.waitFor(() => {
        expect(mockSaveResponseLite).toHaveBeenCalledTimes(1)
      })
    })

    expect(result.current.saveStatus).toBe('saved')
    expect(result.current.saveError).toBe(false)
  })

  it('processes multiple saves in order', async () => {
    const callOrder: string[] = []
    mockSaveResponseLite.mockImplementation(async (input: { itemId: string }) => {
      callOrder.push(input.itemId)
      return { success: true }
    })

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 1 })
      result.current.enqueueSave({ itemId: 'item-2', sectionId: 'sec-1', value: 2 })
      result.current.enqueueSave({ itemId: 'item-3', sectionId: 'sec-1', value: 3 })

      await vi.waitFor(() => {
        expect(mockSaveResponseLite).toHaveBeenCalledTimes(3)
      })
    })

    expect(callOrder).toEqual(['item-1', 'item-2', 'item-3'])
  })

  it('retries failed saves up to MAX_RETRIES then moves to failed list', async () => {
    mockSaveResponseLite.mockResolvedValue({ error: 'network error' })

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 3 })
    })

    // Advance through retry backoff delays (exponential: ~1s, ~2s, ~4s, ~8s)
    for (let i = 0; i < 4; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    }

    // 1 initial attempt + 4 retries = 5 total calls (MAX_RETRIES = 5)
    expect(mockSaveResponseLite).toHaveBeenCalledTimes(5)
    expect(result.current.saveError).toBe(true)
  })

  it('retryFailedSaves re-enqueues failed entries', async () => {
    // First calls fail, then succeed on retry
    let callCount = 0
    mockSaveResponseLite.mockImplementation(async () => {
      callCount++
      if (callCount <= 5) return { error: 'fail' }
      return { success: true }
    })

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    // Enqueue and let it fail MAX_RETRIES times
    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 3 })
    })
    // Advance enough time for all retries to complete
    for (let i = 0; i < 5; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    }

    expect(result.current.saveError).toBe(true)

    // Now retry — should succeed (callCount is now > 5)
    await act(async () => {
      result.current.retryFailedSaves()
    })

    expect(result.current.saveError).toBe(false)
    expect(result.current.saveStatus).toBe('saved')
  })

  it('deduplicates pending saves for the same itemId', async () => {
    const savedValues: number[] = []
    mockSaveResponseLite.mockImplementation(async (input: { responseValue: number }) => {
      savedValues.push(input.responseValue)
      return { success: true }
    })

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    await act(async () => {
      // Enqueue three saves for the same item — only the last value should be sent
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 1 })
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 2 })
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 3 })

      await vi.waitFor(() => {
        expect(mockSaveResponseLite).toHaveBeenCalled()
      })
    })

    // First call may have already started processing (value 1), but 2 and 3
    // should be deduplicated — only the latest (3) should be sent after the first.
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
        expect(mockSaveResponseLite).toHaveBeenCalledTimes(1)
      })
    })

    expect(resolved).toBe(true)
    expect(result.current.saveStatus).toBe('saved')
  })
})
