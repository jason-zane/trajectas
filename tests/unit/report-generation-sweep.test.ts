import { describe, expect, it, vi } from 'vitest'
import {
  processSnapshotsBounded,
  sweepReportGeneration,
  REPORT_PROCESS_CONCURRENCY,
  SWEEP_BATCH,
  STUCK_GENERATING_THRESHOLD_MS,
} from '@/lib/reports/generation-sweep'

// -----------------------------------------------------------------------------
// Chainable mock focused on the two queries the sweep makes against
// report_snapshots: the stuck-generating reset (update...lt...select) and the
// pending pick-up (select...eq('status','pending')...limit). Distinguished by
// whether the chain started with update() or select().
// -----------------------------------------------------------------------------

function makeSweepDb(opts: {
  stuckRows?: Array<{ id: string }>
  pendingRows?: Array<{ id: string }>
}) {
  const calls: {
    resetCutoff?: string
    pendingLimit?: number
    pendingOrder?: [string, unknown]
  } = {}

  const buildChain = (mode: { kind: 'update' | 'select' | null }) => {
    const chain: Record<string, unknown> = {}
    const record = (m: string, args: unknown[]) => {
      if (m === 'update') mode.kind = 'update'
      if (m === 'select' && mode.kind === null) mode.kind = 'select'
      if (m === 'lt' && mode.kind === 'update') calls.resetCutoff = args[1] as string
      if (m === 'limit' && mode.kind === 'select') calls.pendingLimit = args[0] as number
      if (m === 'order' && mode.kind === 'select') {
        calls.pendingOrder = [args[0] as string, args[1]]
      }
      return chain
    }
    for (const m of ['select', 'update', 'eq', 'lt', 'order', 'limit']) {
      chain[m] = (...args: unknown[]) => record(m, args)
    }
    chain.then = (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
      resolve({
        data: mode.kind === 'update' ? (opts.stuckRows ?? []) : (opts.pendingRows ?? []),
        error: null,
      })
    }
    return chain
  }

  const db = {
    from: () => buildChain({ kind: null }),
  }

  return { db, calls }
}

describe('processSnapshotsBounded', () => {
  it('never exceeds the concurrency cap', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const processFn = vi.fn(async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
    })

    const ids = Array.from({ length: 7 }, (_, i) => `snap-${i}`)
    const result = await processSnapshotsBounded(ids, processFn as never)

    expect(result).toEqual({ processed: 7, failed: 0 })
    expect(processFn).toHaveBeenCalledTimes(7)
    expect(maxInFlight).toBeLessThanOrEqual(REPORT_PROCESS_CONCURRENCY)
    expect(maxInFlight).toBeGreaterThan(0)
  })

  it('counts per-id failures without aborting the batch', async () => {
    const processFn = vi.fn(async (id: string) => {
      if (id === 'snap-1' || id === 'snap-3') throw new Error('boom')
    })

    const result = await processSnapshotsBounded(
      ['snap-0', 'snap-1', 'snap-2', 'snap-3'],
      processFn as never,
    )

    expect(result).toEqual({ processed: 2, failed: 2 })
    expect(processFn).toHaveBeenCalledTimes(4)
  })

  it('handles an empty id list', async () => {
    const processFn = vi.fn()
    const result = await processSnapshotsBounded([], processFn as never)
    expect(result).toEqual({ processed: 0, failed: 0 })
    expect(processFn).not.toHaveBeenCalled()
  })
})

describe('sweepReportGeneration', () => {
  it('resets stuck generating snapshots using the threshold cutoff', async () => {
    const now = new Date('2026-07-01T12:00:00.000Z')
    const { db, calls } = makeSweepDb({
      stuckRows: [{ id: 'stuck-1' }, { id: 'stuck-2' }],
      pendingRows: [{ id: 'stuck-1' }, { id: 'stuck-2' }],
    })
    const processFn = vi.fn(async () => {})

    const result = await sweepReportGeneration({
      now,
      client: db as never,
      processFn: processFn as never,
    })

    expect(result).toEqual({ resetStuck: 2, picked: 2, processed: 2, failed: 0 })
    expect(calls.resetCutoff).toBe(
      new Date(now.getTime() - STUCK_GENERATING_THRESHOLD_MS).toISOString(),
    )
  })

  it('picks up pending snapshots oldest-first, capped at SWEEP_BATCH', async () => {
    const { db, calls } = makeSweepDb({
      pendingRows: [{ id: 'a' }, { id: 'b' }],
    })
    const processFn = vi.fn(async () => {})

    const result = await sweepReportGeneration({
      client: db as never,
      processFn: processFn as never,
    })

    expect(result).toEqual({ resetStuck: 0, picked: 2, processed: 2, failed: 0 })
    expect(processFn).toHaveBeenCalledWith('a')
    expect(processFn).toHaveBeenCalledWith('b')
    expect(calls.pendingLimit).toBe(SWEEP_BATCH)
    expect(calls.pendingOrder).toEqual(['created_at', { ascending: true }])
  })

  it('keeps sweeping when individual snapshots fail', async () => {
    const { db } = makeSweepDb({
      pendingRows: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    })
    const processFn = vi.fn(async (id: string) => {
      if (id === 'b') throw new Error('boom')
    })

    const result = await sweepReportGeneration({
      client: db as never,
      processFn: processFn as never,
    })

    expect(result).toEqual({ resetStuck: 0, picked: 3, processed: 2, failed: 1 })
  })
})
