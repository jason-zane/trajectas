import { beforeEach, describe, expect, it, vi } from 'vitest'

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
const rpcSpy = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: fromSpy, rpc: rpcSpy }),
}))

describe('claimSnapshotForGeneration', () => {
  it('returns true when the pending→generating update claims a row', async () => {
    const { claimSnapshotForGeneration } = await import('@/lib/reports/runner')
    const db = { rpc: vi.fn(async () => ({ data: true, error: null })) }

    await expect(
      claimSnapshotForGeneration(db as never, 'snap-1'),
    ).resolves.toBe(true)
  })

  it('returns false when no row was pending (already claimed)', async () => {
    const { claimSnapshotForGeneration } = await import('@/lib/reports/runner')
    const db = { rpc: vi.fn(async () => ({ data: false, error: null })) }

    await expect(
      claimSnapshotForGeneration(db as never, 'snap-1'),
    ).resolves.toBe(false)
  })

  it('returns false when the claim update errors', async () => {
    const { claimSnapshotForGeneration } = await import('@/lib/reports/runner')
    const db = { rpc: vi.fn(async () => ({ data: null, error: { message: 'boom' } })) }

    await expect(
      claimSnapshotForGeneration(db as never, 'snap-1'),
    ).resolves.toBe(false)
  })
})

describe('processSnapshot claim guard', () => {
  beforeEach(() => {
    fromSpy.mockReset()
    rpcSpy.mockReset()
  })

  it('skips the pipeline entirely when the snapshot is not claimable', async () => {
    const { processSnapshot } = await import('@/lib/reports/runner')

    const singleSpy = vi.fn(async () => ({ data: null, error: null }))
    rpcSpy.mockResolvedValue({ data: false, error: null })
    // Claim resolves with zero rows → not claimable.
    fromSpy.mockImplementation(() =>
      makeChain({ result: { data: [], error: null }, single: singleSpy }),
    )

    await expect(processSnapshot('snap-1')).resolves.toBeUndefined()

    // Only the claim touched the db — the snapshot fetch (.single) never ran
    // and no failed-status write happened.
    expect(singleSpy).not.toHaveBeenCalled()
    expect(fromSpy).not.toHaveBeenCalled()
    expect(rpcSpy).toHaveBeenCalledWith('claim_report_snapshot_for_generation', { p_snapshot_id: 'snap-1' })
  })

  it('proceeds into the pipeline when the claim succeeds', async () => {
    const { processSnapshot } = await import('@/lib/reports/runner')

    const updateSpy = vi.fn()
    rpcSpy.mockResolvedValue({ data: true, error: null })
    // Claim succeeds; the subsequent snapshot fetch fails, which proves we
    // passed the guard. The catch path marks the snapshot failed and then
    // RETHROWS so callers (sweep, generate route) record a failure instead
    // of counting the run as processed.
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

    await expect(processSnapshot('snap-1')).rejects.toThrow(/not found/i)

    expect(singleSpy).toHaveBeenCalled()
    // The catch path recorded the failure before rethrowing.
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    )
  })
})
