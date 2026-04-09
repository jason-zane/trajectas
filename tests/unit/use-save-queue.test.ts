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

  it('retries failed saves up to 3 times then moves to failed list', async () => {
    mockSaveResponseLite.mockResolvedValue({ error: 'network error' })

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 3 })
    })

    // Advance through retry backoff delays (500ms, 1000ms)
    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    await act(async () => { await vi.advanceTimersByTimeAsync(1100) })

    // 1 initial attempt + 2 retries = 3 total calls
    expect(mockSaveResponseLite).toHaveBeenCalledTimes(3)
    expect(result.current.saveError).toBe(true)
  })

  it('retryFailedSaves re-enqueues failed entries', async () => {
    // First call fails 3 times, then succeeds on retry
    let callCount = 0
    mockSaveResponseLite.mockImplementation(async () => {
      callCount++
      if (callCount <= 3) return { error: 'fail' }
      return { success: true }
    })

    const { result } = renderHook(() =>
      useSaveQueue({ token: 'tok', sessionId: 'sess' })
    )

    // Enqueue and let it fail 3 times
    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 3 })
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    await act(async () => { await vi.advanceTimersByTimeAsync(1100) })

    expect(result.current.saveError).toBe(true)

    // Now retry — should succeed (callCount is now > 3)
    await act(async () => {
      result.current.retryFailedSaves()
    })

    expect(result.current.saveError).toBe(false)
    expect(result.current.saveStatus).toBe('saved')
  })
})
