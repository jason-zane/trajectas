import { describe, expect, it, vi } from 'vitest'
import {
  processSnapshotsBounded,
  sweepReportGeneration,
  shouldDeferInlineProcessing,
  REPORT_PROCESS_CONCURRENCY,
  SWEEP_BATCH,
  STUCK_GENERATING_THRESHOLD_MS,
  MAX_GLOBAL_GENERATING,
} from '@/lib/reports/generation-sweep'

// -----------------------------------------------------------------------------
// Chainable mock for the queries made against report_snapshots: the
// stuck-generating reset (update...lt...select), the pending pick-up
// (select...order...limit, one batch consumed per round), and the generating
// head-count (select with { count, head }).
// -----------------------------------------------------------------------------

function makeSweepDb(opts: {
  stuckRows?: Array<{ id: string }>
  stuckPdfRows?: Array<{ id: string }>
  // One entry per sweep round; the last entry repeats once exhausted.
  pendingBatches?: Array<Array<{ id: string }>>
  generatingCount?: number
  countError?: unknown
}) {
  const calls: {
    resetCutoff?: string
    pendingLimit?: number
    pendingOrder?: [string, unknown]
    pendingQueries: number
    updateQueries: number
  } = { pendingQueries: 0, updateQueries: 0 }

  const batches = [...(opts.pendingBatches ?? [[]])]

  const buildChain = (mode: { kind: 'update' | 'select' | 'count' | null }) => {
    const chain: Record<string, unknown> = {}
    const record = (m: string, args: unknown[]) => {
      if (m === 'update') mode.kind = 'update'
      if (m === 'select' && mode.kind === null) {
        const options = args[1] as { count?: string; head?: boolean } | undefined
        mode.kind = options?.count ? 'count' : 'select'
      }
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
    chain.then = (
      resolve: (v: { data: unknown; error: unknown; count?: number | null }) => unknown,
    ) => {
      if (mode.kind === 'count') {
        resolve({
          data: null,
          count: opts.countError ? null : (opts.generatingCount ?? 0),
          error: opts.countError ?? null,
        })
        return
      }
      if (mode.kind === 'update') {
        // First update chain per sweep = status reset, second = pdf reset.
        calls.updateQueries += 1
        resolve({
          data:
            calls.updateQueries === 1
              ? (opts.stuckRows ?? [])
              : (opts.stuckPdfRows ?? []),
          error: null,
        })
        return
      }
      calls.pendingQueries += 1
      const batch = batches.length > 1 ? batches.shift()! : batches[0]
      resolve({ data: batch, error: null })
    }
    return chain
  }

  const db = {
    from: () => buildChain({ kind: null }),
    rpc: vi.fn(async () => ({ data: opts.stuckPdfRows?.length ?? 0, error: null })),
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

  it('leaves the next chunk queued when the cumulative pickup deadline expires', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
    try {
      const processFn = vi.fn(async () => { clock.mockReturnValue(2000) })
      const result = await processSnapshotsBounded(['a', 'b', 'c', 'd'], processFn as never, 1500)
      expect(result).toEqual({ processed: REPORT_PROCESS_CONCURRENCY, failed: 0 })
      expect(processFn).toHaveBeenCalledTimes(REPORT_PROCESS_CONCURRENCY)
      expect(processFn).not.toHaveBeenCalledWith('c')
    } finally {
      clock.mockRestore()
    }
  })
})

describe('sweepReportGeneration', () => {
  it('resets stuck generating snapshots using the threshold cutoff', async () => {
    const now = new Date('2026-07-01T12:00:00.000Z')
    const { db, calls } = makeSweepDb({
      stuckRows: [{ id: 'stuck-1' }, { id: 'stuck-2' }],
      pendingBatches: [[{ id: 'stuck-1' }, { id: 'stuck-2' }], []],
    })
    const processFn = vi.fn(async () => {})

    const result = await sweepReportGeneration({
      now,
      client: db as never,
      processFn: processFn as never,
    })

    expect(result).toEqual({
      resetStuck: 2,
      resetStuckPdf: 0,
      picked: 2,
      processed: 2,
      failed: 0,
    })
    expect(calls.resetCutoff).toBe(
      new Date(now.getTime() - STUCK_GENERATING_THRESHOLD_MS).toISOString(),
    )
  })

  it('resets stuck pdf generations alongside stuck snapshots', async () => {
    const { db, calls } = makeSweepDb({
      stuckPdfRows: [{ id: 'pdf-stuck-1' }],
      pendingBatches: [[]],
    })
    const processFn = vi.fn(async () => {})

    const result = await sweepReportGeneration({
      client: db as never,
      processFn: processFn as never,
    })

    expect(result).toEqual({
      resetStuck: 0,
      resetStuckPdf: 1,
      picked: 0,
      processed: 0,
      failed: 0,
    })
    // Report reset uses a query; PDF recovery owns its lease lock in the RPC.
    expect(calls.updateQueries).toBe(1)
    expect(db.rpc).toHaveBeenCalledWith('recover_report_pdf_jobs')
  })

  it('picks up pending snapshots oldest-first, capped at SWEEP_BATCH per round', async () => {
    const { db, calls } = makeSweepDb({
      pendingBatches: [[{ id: 'a' }, { id: 'b' }]],
    })
    const processFn = vi.fn(async () => {})

    const result = await sweepReportGeneration({
      client: db as never,
      processFn: processFn as never,
    })

    expect(result).toEqual({
      resetStuck: 0,
      resetStuckPdf: 0,
      picked: 2,
      processed: 2,
      failed: 0,
    })
    expect(processFn).toHaveBeenCalledWith('a')
    expect(processFn).toHaveBeenCalledWith('b')
    expect(calls.pendingLimit).toBe(SWEEP_BATCH)
    expect(calls.pendingOrder).toEqual(['created_at', { ascending: true }])
  })

  it('keeps sweeping when individual snapshots fail', async () => {
    const { db } = makeSweepDb({
      pendingBatches: [[{ id: 'a' }, { id: 'b' }, { id: 'c' }]],
    })
    const processFn = vi.fn(async (id: string) => {
      if (id === 'b') throw new Error('boom')
    })

    const result = await sweepReportGeneration({
      client: db as never,
      processFn: processFn as never,
    })

    expect(result).toEqual({
      resetStuck: 0,
      resetStuckPdf: 0,
      picked: 3,
      processed: 2,
      failed: 1,
    })
  })

  it('drains multiple full batches until the queue is empty', async () => {
    const fullBatch = Array.from({ length: SWEEP_BATCH }, (_, i) => ({
      id: `full-${i}`,
    }))
    const { db, calls } = makeSweepDb({
      pendingBatches: [fullBatch, fullBatch, [{ id: 'tail' }]],
    })
    const processFn = vi.fn(async () => {})

    const result = await sweepReportGeneration({
      client: db as never,
      processFn: processFn as never,
    })

    expect(result).toEqual({
      resetStuck: 0,
      resetStuckPdf: 0,
      picked: SWEEP_BATCH * 2 + 1,
      processed: SWEEP_BATCH * 2 + 1,
      failed: 0,
    })
    // Full batch → keep going; short batch → stop without another query.
    expect(calls.pendingQueries).toBe(3)
  })

  it('stops after a short batch instead of re-querying forever', async () => {
    const { db, calls } = makeSweepDb({
      pendingBatches: [[{ id: 'only' }]],
    })
    const processFn = vi.fn(async () => {})

    await sweepReportGeneration({
      client: db as never,
      processFn: processFn as never,
    })

    expect(calls.pendingQueries).toBe(1)
    expect(processFn).toHaveBeenCalledTimes(1)
  })
})

describe('shouldDeferInlineProcessing', () => {
  it('defers when the global generating count reaches the cap', async () => {
    const { db } = makeSweepDb({ generatingCount: MAX_GLOBAL_GENERATING })
    await expect(shouldDeferInlineProcessing(db as never)).resolves.toBe(true)
  })

  it('processes inline while below the cap', async () => {
    const { db } = makeSweepDb({ generatingCount: MAX_GLOBAL_GENERATING - 1 })
    await expect(shouldDeferInlineProcessing(db as never)).resolves.toBe(false)
  })

  it('fails open when the count query errors', async () => {
    const { db } = makeSweepDb({ countError: { message: 'boom' } })
    await expect(shouldDeferInlineProcessing(db as never)).resolves.toBe(false)
  })
})
