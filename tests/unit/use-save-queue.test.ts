// @vitest-environment jsdom
import 'fake-indexeddb/auto'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useSaveQueue } from '@/components/assess/use-save-queue'
import {
  countPending,
  getResponsesForSession,
  getResponseDb,
} from '@/lib/assess/response-store'

const mockFetch = vi.fn()

function jsonResponse(status = 200, body: Record<string, unknown> = { success: true }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Success response confirming the given item ids as saved — the shape
 *  /api/assess/save-batch actually returns. */
function savedResponse(itemIds: string[]) {
  return jsonResponse(200, { success: true, savedItemIds: itemIds })
}

/** Default happy-path server: confirms every item id in the posted batch. */
function echoAllSaved(_input: unknown, init?: RequestInit) {
  const body = JSON.parse(init?.body as string) as { saves: { itemId: string }[] }
  return Promise.resolve(savedResponse(body.saves.map((s) => s.itemId)))
}

/** Vitest's jsdom environment lacks BroadcastChannel — stub it. */
class FakeBroadcastChannel {
  name: string
  onmessage: ((event: MessageEvent) => void) | null = null
  constructor(name: string) {
    this.name = name
  }
  postMessage() {
    /* no-op */
  }
  close() {
    /* no-op */
  }
}

describe('useSaveQueue (IndexedDB-backed)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockFetch.mockImplementation(echoAllSaved)
    vi.stubGlobal('fetch', mockFetch)
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
    // Wipe IDB between tests so each one starts clean.
    await getResponseDb().responses.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const cfg = { token: 'tok', sessionId: '00000000-0000-0000-0000-000000000001' }

  async function settle(ms = 2000) {
    // Real timers — let the IDB writes and debounced flush happen on their
    // own schedule. The debounce is 1500ms; 2000ms covers it comfortably.
    // Note: Converting to fake timers would require mocking IDB itself, as
    // IDB doesn't rely on setTimeout and doesn't resolve with vi.useFakeTimers().
    await new Promise((r) => setTimeout(r, ms))
  }

  it('persists each enqueueSave to IndexedDB before any network call', async () => {
    // Hold the fetch open so we can observe IDB state before the POST resolves.
    let release: (() => void) | null = null
    mockFetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(savedResponse(['item-1']))
        }),
    )

    const { result } = renderHook(() => useSaveQueue(cfg))

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec-1', value: 3 })
      // Give the put/countPending microtasks a chance to settle.
      await new Promise((r) => setTimeout(r, 50))
    })

    // IDB has the row already, well before the debounced POST fires.
    const stored = await getResponsesForSession(cfg.sessionId)
    expect(stored.get('item-1')).toEqual({ value: 3, data: {} })
    expect(mockFetch).not.toHaveBeenCalled()

    // Release the fetch and let the flush complete.
    await act(async () => {
      await settle()
      release?.()
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(await countPending(cfg.sessionId)).toBe(0)
  })

  it('batches multiple enqueues into a single POST', async () => {
    const { result } = renderHook(() => useSaveQueue(cfg))

    await act(async () => {
      for (let i = 1; i <= 5; i++) {
        result.current.enqueueSave({
          itemId: `item-${i}`,
          sectionId: 'sec-1',
          value: i,
        })
      }
      await settle()
    })

    // Five rapid clicks should produce ONE POST containing all five rows
    // (below the FLUSH_PENDING_THRESHOLD=8 fast-flush trigger).
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const call = mockFetch.mock.calls[0]
    const body = JSON.parse((call[1] as RequestInit).body as string)
    expect(body.saves).toHaveLength(5)
    expect(body.saves.map((s: { itemId: string }) => s.itemId)).toEqual([
      'item-1', 'item-2', 'item-3', 'item-4', 'item-5',
    ])
    expect(await countPending(cfg.sessionId)).toBe(0)
  })

  it('fast-flushes immediately when pending count crosses the threshold', async () => {
    const { result } = renderHook(() => useSaveQueue(cfg))

    await act(async () => {
      // 8 enqueues triggers immediate flush per FLUSH_PENDING_THRESHOLD.
      for (let i = 1; i <= 8; i++) {
        result.current.enqueueSave({
          itemId: `item-${i}`,
          sectionId: 'sec-1',
          value: i,
        })
      }
      // No need to wait for the debounce — the threshold should have fired.
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('keeps rows pending in IDB on POST failure', async () => {
    mockFetch.mockResolvedValue(jsonResponse(500, { error: 'boom' }))

    const { result } = renderHook(() => useSaveQueue(cfg))

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-x', sectionId: 'sec', value: 1 })
      await settle()
    })

    expect(mockFetch).toHaveBeenCalled()
    // Row stayed pending — the user's response is not lost.
    expect(await countPending(cfg.sessionId)).toBe(1)
  })

  it('marks only server-confirmed ids synced — unconfirmed rows stay pending', async () => {
    // Server saves item-1 but skips item-2 (e.g. the item does not belong to
    // the session's assessment). item-2 must stay pending in IDB, not be
    // marked synced and silently lost.
    mockFetch.mockResolvedValue(savedResponse(['item-1']))

    const { result } = renderHook(() => useSaveQueue(cfg))

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec', value: 3 })
      result.current.enqueueSave({ itemId: 'item-2', sectionId: 'sec', value: 4 })
      await settle()
    })

    expect(mockFetch).toHaveBeenCalled()
    const db = getResponseDb()
    const row1 = await db.responses.get([cfg.sessionId, 'item-1'])
    const row2 = await db.responses.get([cfg.sessionId, 'item-2'])
    expect(row1?.synced).toBe(1)
    expect(row2?.synced).toBe(0)
    expect(await countPending(cfg.sessionId)).toBe(1)
  })

  it('treats a 2xx response without savedItemIds as unconfirmed', async () => {
    // Regression guard: HTTP success alone must never mark rows synced —
    // that was the original data-loss bug.
    mockFetch.mockResolvedValue(jsonResponse(200, { success: true }))

    const { result } = renderHook(() => useSaveQueue(cfg))

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-u', sectionId: 'sec', value: 2 })
      await settle()
    })

    expect(mockFetch).toHaveBeenCalled()
    expect(await countPending(cfg.sessionId)).toBe(1)
  })

  it('flushSaves drains pending and returns true on success', async () => {
    const { result } = renderHook(() => useSaveQueue(cfg))

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec', value: 1 })
      result.current.enqueueSave({ itemId: 'item-2', sectionId: 'sec', value: 2 })
      // Don't wait for the debounce — flushSaves should drain immediately.
    })

    let ok: boolean | null = null
    await act(async () => {
      ok = await result.current.flushSaves()
    })

    expect(ok).toBe(true)
    expect(await countPending(cfg.sessionId)).toBe(0)
  })

  it('hydrates localResponses from IDB on mount', async () => {
    // Pre-seed IDB with a synced row from a "previous session".
    await getResponseDb().responses.put({
      sessionId: cfg.sessionId,
      itemId: 'pre-existing',
      sectionId: 'sec',
      value: 4,
      data: {},
      idempotencyKey: 'prior',
      synced: 1,
      updatedAt: Date.now(),
    })

    const { result } = renderHook(() => useSaveQueue(cfg))

    await act(async () => {
      // Give the hydration effect a tick.
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(result.current.localResponses).toEqual({
      'pre-existing': { value: 4, data: {} },
    })
  })

  it('does not mark an answer changed mid-flight as synced (ack/edit race)', async () => {
    // Repro of the silent data-loss race: answer 2 → POST starts → user
    // changes to 5 while the POST is in flight → ACK for the value-2 write
    // arrives. The value-5 row must stay pending (its idempotencyKey differs
    // from the acknowledged write) and must reach the server on the next
    // flush pass — never be marked synced by the stale ACK.
    //
    // Own sessionId: earlier failure-path tests leave backoff flush timers
    // running past unmount; with the shared sessionId those zombie flushers
    // would steal this test's held mock call.
    const raceCfg = { token: 'tok', sessionId: '00000000-0000-0000-0000-0000000000a2' }
    let release: (() => void) | null = null
    mockFetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(savedResponse(['item-1']))
        }),
    )

    const { result } = renderHook(() => useSaveQueue(raceCfg))

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec', value: 2 })
      // Let the debounce fire — the first POST is now in flight, unresolved.
      await settle()
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Change the same answer while the ACK for value=2 is still in flight.
    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-1', sectionId: 'sec', value: 5 })
      await new Promise((r) => setTimeout(r, 50))
    })

    // The stale ACK arrives; the flush loop continues and drains the newer
    // write with its follow-up POST (echoAllSaved handles it).
    await act(async () => {
      release?.()
      await new Promise((r) => setTimeout(r, 100))
    })

    await vi.waitFor(
      async () => {
        expect(await countPending(raceCfg.sessionId)).toBe(0)
      },
      { timeout: 10_000, interval: 100 },
    )

    // The value that survived end-to-end is 5, confirmed by a second POST.
    const row = await getResponseDb().responses.get([raceCfg.sessionId, 'item-1'])
    expect(row?.value).toBe(5)
    expect(row?.synced).toBe(1)
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2)
    const lastBody = JSON.parse(
      (mockFetch.mock.calls.at(-1)![1] as RequestInit).body as string,
    ) as { saves: { itemId: string; responseValue: number }[] }
    expect(lastBody.saves).toEqual([
      expect.objectContaining({ itemId: 'item-1', responseValue: 5 }),
    ])
  })

  it('retryFailedSaves clears the error flag and re-flushes', async () => {
    mockFetch.mockResolvedValue(jsonResponse(500, { error: 'boom' }))

    const { result } = renderHook(() => useSaveQueue(cfg))

    await act(async () => {
      result.current.enqueueSave({ itemId: 'item-r', sectionId: 'sec', value: 9 })
    })

    // 5 consecutive flush failures surface the error banner. The flusher
    // uses exponential backoff (1s, 2s, 4s, 8s) between attempts, so we
    // poll for ~20s before giving up — well under the 30s test timeout.
    await vi.waitFor(
      () => {
        expect(result.current.saveError).toBe(true)
      },
      { timeout: 25_000, interval: 500 },
    )

    mockFetch.mockImplementation(echoAllSaved)

    await act(async () => {
      result.current.retryFailedSaves()
    })

    await vi.waitFor(
      async () => {
        expect(result.current.saveError).toBe(false)
        expect(await countPending(cfg.sessionId)).toBe(0)
      },
      { timeout: 5_000, interval: 100 },
    )
  }, 30_000)
})
