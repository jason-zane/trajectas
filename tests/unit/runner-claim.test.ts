import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeMockDb } from './helpers/supabase-mock'

// -----------------------------------------------------------------------------
// processSnapshot claim guard. The pending→generating update must atomically
// claim the snapshot; if another caller already claimed it (zero rows updated),
// processSnapshot skips without touching anything else — this is what makes
// concurrent triggers (submit path, admin retry, cron sweep) safe.
// -----------------------------------------------------------------------------

// Hand-rolled chainable mock so individual terminators can be spied per test.
type ChainResult = { data: unknown; error: unknown }

function makeChain(overrides: {
  result?: ChainResult
  single?: (...args: unknown[]) => Promise<ChainResult>
  maybeSingle?: (...args: unknown[]) => Promise<ChainResult>
  update?: (...args: unknown[]) => void
}) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'upsert', 'eq', 'in', 'order', 'limit', 'not', 'is', 'lt']) {
    chain[m] = (...args: unknown[]) => {
      if (m === 'update' && overrides.update) overrides.update(...args)
      return chain
    }
  }
  chain.single =
    overrides.single ?? vi.fn(async () => ({ data: null, error: null }))
  chain.maybeSingle =
    overrides.maybeSingle ?? vi.fn(async () => ({ data: null, error: null }))
  chain.then = (resolve: (v: ChainResult) => unknown) => {
    resolve(overrides.result ?? { data: null, error: null })
  }
  return chain
}

const fromSpy = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: fromSpy }),
}))

describe('claimSnapshotForGeneration', () => {
  it('returns true when the pending→generating update claims a row', async () => {
    const { claimSnapshotForGeneration } = await import('@/lib/reports/runner')
    const { db } = makeMockDb({
      report_snapshots: { data: [{ id: 'snap-1' }] },
    })

    await expect(
      claimSnapshotForGeneration(db as never, 'snap-1'),
    ).resolves.toBe(true)
  })

  it('returns false when no row was pending (already claimed)', async () => {
    const { claimSnapshotForGeneration } = await import('@/lib/reports/runner')
    const { db } = makeMockDb({
      report_snapshots: { data: [] },
    })

    await expect(
      claimSnapshotForGeneration(db as never, 'snap-1'),
    ).resolves.toBe(false)
  })

  it('returns false when the claim update errors', async () => {
    const { claimSnapshotForGeneration } = await import('@/lib/reports/runner')
    const { db } = makeMockDb({
      report_snapshots: { data: null, error: { message: 'boom' } },
    })

    await expect(
      claimSnapshotForGeneration(db as never, 'snap-1'),
    ).resolves.toBe(false)
  })
})

describe('processSnapshot claim guard', () => {
  beforeEach(() => {
    fromSpy.mockReset()
  })

  it('skips the pipeline entirely when the snapshot is not claimable', async () => {
    const { processSnapshot } = await import('@/lib/reports/runner')

    const singleSpy = vi.fn(async () => ({ data: null, error: null }))
    // Claim resolves with zero rows → not claimable.
    fromSpy.mockImplementation(() =>
      makeChain({ result: { data: [], error: null }, single: singleSpy }),
    )

    await expect(processSnapshot('snap-1')).resolves.toBeUndefined()

    // Only the claim touched the db — the snapshot fetch (.single) never ran
    // and no failed-status write happened.
    expect(singleSpy).not.toHaveBeenCalled()
    expect(fromSpy).toHaveBeenCalledTimes(1)
    expect(fromSpy).toHaveBeenCalledWith('report_snapshots')
  })

  it('proceeds into the pipeline when the claim succeeds', async () => {
    const { processSnapshot } = await import('@/lib/reports/runner')

    const updateSpy = vi.fn()
    // Claim succeeds; the subsequent snapshot fetch fails, which proves we
    // passed the guard and lets the catch path mark the snapshot failed.
    const singleSpy = vi.fn(async () => ({
      data: null,
      error: { message: 'not found' },
    }))
    fromSpy.mockImplementation(() =>
      makeChain({
        result: { data: [{ id: 'snap-1' }], error: null },
        single: singleSpy,
        update: updateSpy,
      }),
    )

    await expect(processSnapshot('snap-1')).resolves.toBeUndefined()

    expect(singleSpy).toHaveBeenCalled()
    // The catch path recorded the failure.
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    )
  })
})
