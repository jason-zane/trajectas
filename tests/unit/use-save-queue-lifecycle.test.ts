// @vitest-environment jsdom
import { StrictMode, createElement, type ReactNode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaveQueue } from '@/components/assess/use-save-queue'
import type { ResponseRecord } from '@/lib/assess/response-store'

// Deterministic lifecycle tests; the existing suite separately exercises the real Dexie store.
const store = vi.hoisted(() => ({ rows: new Map<string, ResponseRecord>(), serial: 0, writeGate: undefined as Promise<void> | undefined }))
const rowKey = (sessionId: string, itemId: string) => `${sessionId}:${itemId}`
vi.mock('@/lib/assess/response-store', () => ({
  countPending: async (sessionId: string) => [...store.rows.values()].filter(row => row.sessionId === sessionId && !row.synced).length,
  getPendingResponses: async (sessionId: string, limit: number) => [...store.rows.values()]
    .filter(row => row.sessionId === sessionId && !row.synced).slice(0, limit),
  getResponsesForSession: async (sessionId: string) => new Map([...store.rows.values()]
    .filter(row => row.sessionId === sessionId && !row.synced).map(row => [row.itemId, { value: row.value, data: row.data }])),
  putResponse: async (input: Omit<ResponseRecord, 'idempotencyKey' | 'synced' | 'updatedAt'>) => {
    await store.writeGate
    const key = `${input.sessionId}:${input.itemId}`, previous = store.rows.get(key)
    const row = { ...input, data: input.data ?? {}, idempotencyKey: `write-${++store.serial}`,
      revision: (previous?.revision ?? 0) + 1, synced: 0 as const, updatedAt: Date.now() }
    store.rows.set(key, row)
    return row
  },
  markSynced: async (sessionId: string, acks: { itemId: string; idempotencyKey: string }[]) => {
    for (const ack of acks) {
      const row = store.rows.get(`${sessionId}:${ack.itemId}`)
      if (row?.idempotencyKey === ack.idempotencyKey) row.synced = 1
    }
  },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const response = (status = 200, itemIds = ['item-1']) => new Response(JSON.stringify({ success: status === 200, savedItemIds: status === 200 ? itemIds : [] }), { status })
const config = { token: 'participant-token', sessionId: 'session-1', sessionProof: 'issued.proof' }
const entry = { itemId: 'item-1', sectionId: 'section-1', value: 2 }
const fetchMock = vi.fn()
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

describe('useSaveQueue lifetime ownership', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    store.rows.clear(); store.serial = 0; store.writeGate = undefined
    fetchMock.mockReset().mockImplementation(async (_input: unknown, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { saves: { itemId: string }[] }
      return response(200, body.saves.map(row => row.itemId))
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('BroadcastChannel', undefined)
  })
  afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

  it('cancels an unmounted debounce, retains the pending answer, and resumes it on a fresh mount', async () => {
    const first = renderHook(() => useSaveQueue(config))
    await act(async () => { first.result.current.enqueueSave(entry) })
    const original = { ...store.rows.get(rowKey(config.sessionId, entry.itemId))! }
    first.unmount()
    await advance(60_000)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(store.rows.get(rowKey(config.sessionId, entry.itemId))).toEqual(original)
    const resumed = renderHook(() => useSaveQueue(config))
    await advance(1600)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.saves[0]).toMatchObject({ responseValue: 2, idempotencyKey: original.idempotencyKey })
    expect(store.rows.get(rowKey(config.sessionId, entry.itemId))?.synced).toBe(1)
    resumed.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears a scheduled failure retry on unmount without discarding its durable row', async () => {
    fetchMock.mockImplementation(async () => response(500))
    const mounted = renderHook(() => useSaveQueue(config))
    await act(async () => { mounted.result.current.enqueueSave(entry) })
    await advance(1600)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    mounted.unmount()
    await advance(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.rows.get(rowKey(config.sessionId, entry.itemId))?.synced).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not create another retry when an already in-flight request fails after unmount', async () => {
    const held = deferred<Response>()
    fetchMock.mockImplementationOnce(() => held.promise)
    const first = renderHook(() => useSaveQueue(config))
    await act(async () => { first.result.current.enqueueSave(entry) })
    await advance(1600)
    first.unmount()
    await act(async () => { held.resolve(response(500)) })
    await advance(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    renderHook(() => useSaveQueue(config))
    await advance(1600)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.rows.get(rowKey(config.sessionId, entry.itemId))?.synced).toBe(1)
  })

  it('an old mount ACK cannot acknowledge a newer edit or start competing flushes after remount', async () => {
    const oldRequest = deferred<Response>(), newRequest = deferred<Response>()
    fetchMock.mockImplementationOnce(() => oldRequest.promise).mockImplementationOnce(() => newRequest.promise)
    const old = renderHook(() => useSaveQueue(config))
    await act(async () => { old.result.current.enqueueSave(entry) })
    await advance(1600); old.unmount()
    const fresh = renderHook(() => useSaveQueue(config))
    await act(async () => { fresh.result.current.enqueueSave({ ...entry, value: 5 }) })
    await advance(1600)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await act(async () => { oldRequest.resolve(response()) })
    await advance(5000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.rows.get(rowKey(config.sessionId, entry.itemId))).toMatchObject({ value: 5, synced: 0 })
    await act(async () => { newRequest.resolve(response()) })
    expect(store.rows.get(rowKey(config.sessionId, entry.itemId))).toMatchObject({ value: 5, synced: 1 })
  })

  it('lets an accepted IDB write finish after unmount but does not start a flusher from its late continuation', async () => {
    const write = deferred<void>(); store.writeGate = write.promise
    const mounted = renderHook(() => useSaveQueue(config))
    await act(async () => { mounted.result.current.enqueueSave(entry) })
    mounted.unmount()
    await act(async () => { write.resolve() })
    await advance(60_000)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(store.rows.get(rowKey(config.sessionId, entry.itemId))).toMatchObject({ value: 2, synced: 0 })
    renderHook(() => useSaveQueue(config)); await advance(1600)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('settles a boundary waiter false on unmount, then preserves a late queued write for resume', async () => {
    const write = deferred<void>(); store.writeGate = write.promise
    const mounted = renderHook(() => useSaveQueue(config))
    let drain!: Promise<boolean>, settled: boolean | undefined
    await act(async () => {
      mounted.result.current.enqueueSave(entry)
      drain = mounted.result.current.flushSaves()
      void drain.then(value => { settled = value })
    })
    expect(settled).toBeUndefined()
    mounted.unmount()
    await expect(drain).resolves.toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => { write.resolve() })
    expect(store.rows.get(rowKey(config.sessionId, entry.itemId))?.synced).toBe(0)
  })

  it('does not release a boundary when an earlier batch drains before a newly accepted IDB write lands', async () => {
    const earlier = deferred<Response>()
    fetchMock.mockImplementationOnce(() => earlier.promise)
    const mounted = renderHook(() => useSaveQueue(config))
    await act(async () => { mounted.result.current.enqueueSave(entry) })
    await advance(1600)
    const write = deferred<void>(); store.writeGate = write.promise
    let drain!: Promise<boolean>, settled: boolean | undefined
    await act(async () => {
      mounted.result.current.enqueueSave({ ...entry, itemId: 'item-2', value: 4 })
      drain = mounted.result.current.flushSaves()
      void drain.then(value => { settled = value })
      earlier.resolve(response())
    })
    expect(settled).toBeUndefined()
    expect(store.rows.has(rowKey(config.sessionId, 'item-2'))).toBe(false)
    await act(async () => { write.resolve() })
    await advance(1600)
    await expect(drain).resolves.toBe(true)
    expect(store.rows.get(rowKey(config.sessionId, 'item-2'))).toMatchObject({ value: 4, synced: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps pagehide beacon behavior while mounted and removes it after unmount', async () => {
    const beacon = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { sendBeacon: beacon })
    const mounted = renderHook(() => useSaveQueue(config))
    await act(async () => { mounted.result.current.enqueueSave(entry) })
    await act(async () => { window.dispatchEvent(new Event('pagehide')) })
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(beacon.mock.calls[0][0]).toBe('/api/assess/save-batch?sessionProof=issued.proof')
    expect(store.rows.get(rowKey(config.sessionId, entry.itemId))?.synced).toBe(0)
    mounted.unmount()
    await act(async () => { window.dispatchEvent(new Event('pagehide')) })
    expect(beacon).toHaveBeenCalledTimes(1)
  })

  it('survives StrictMode cleanup/setup and saves the current mount once', async () => {
    const mounted = renderHook(() => useSaveQueue(config), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children),
    })
    await act(async () => { mounted.result.current.enqueueSave(entry) })
    await advance(1600)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.rows.get(rowKey(config.sessionId, entry.itemId))?.synced).toBe(1)
  })
})
