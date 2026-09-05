import { describe, expect, it, vi } from 'vitest'
import { drainReportPdfJobs } from '@/lib/reports/pdf-jobs'

function fixture(batches: Array<Array<{ id: string }>>) {
  const from = vi.fn(() => {
    const chain: Record<string, unknown> = {}
    for (const name of ['select', 'eq', 'is', 'in', 'or', 'order']) chain[name] = vi.fn(() => chain)
    chain.limit = vi.fn(async () => ({ data: batches.shift() ?? [], error: null }))
    return chain
  })
  return { from }
}

describe('durable PDF worker', () => {
  it('drains orphaned queued jobs without a fresh client trigger', async () => {
    const db = fixture([[{ id: 'orphaned-queue-job' }], [{ id: 'next' }], []])
    const generate = vi.fn(async () => null)
    expect(await drainReportPdfJobs({ client: db as never, generate })).toEqual({ processed: 2, failed: 0 })
    expect(generate).toHaveBeenNthCalledWith(1, 'orphaned-queue-job')
    expect(generate).toHaveBeenNthCalledWith(2, 'next')
  })
  it('stops immediately when another worker owns capacity', async () => {
    const db = fixture([[{ id: 'busy' }], [{ id: 'busy' }]])
    const generate = vi.fn(async () => ({ queued: true as const }))
    expect(await drainReportPdfJobs({ client: db as never, generate })).toEqual({ processed: 0, failed: 0 })
    expect(generate).toHaveBeenCalledTimes(1)
    expect(db.from).toHaveBeenCalledTimes(1)
  })
  it('does not start another browser after its pickup budget expires', async () => {
    const db = fixture([[{ id: 'late' }]])
    const generate = vi.fn(async () => null)
    expect(await drainReportPdfJobs({ client: db as never, generate, timeBudgetMs: 0 })).toEqual({ processed: 0, failed: 0 })
    expect(generate).not.toHaveBeenCalled()
  })
})
