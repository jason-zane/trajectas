import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: [] as { client_id: string; month: string; completed_count: number }[],
  returnedRows: 0,
  bounds: [] as [string, string, string][],
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let rows = table === 'client_usage_monthly' ? state.rows : []
      const query = {
        select: () => query,
        in: () => query,
        gte: (field: string, value: string) => {
          state.bounds.push(['gte', field, value])
          rows = rows.filter(r => r.month >= value)
          return query
        },
        lt: (field: string, value: string) => {
          state.bounds.push(['lt', field, value])
          rows = rows.filter(r => r.month < value)
          return query
        },
        then: (resolve: (value: unknown) => unknown) => {
          if (table === 'client_usage_monthly') state.returnedRows += rows.length
          return Promise.resolve({ data: rows, error: null }).then(resolve)
        },
      }
      return query
    },
  }),
}))
vi.mock('@/lib/dal/usage-billing', () => ({ listClientUsagePricing: async () => [] }))
vi.mock('@/lib/dal/usage', () => ({
  getClientUsageSummary: async () => ['growing', 'dormant', 'old-only'].map(clientId => ({
    clientId, assessmentsCompleted: 1,
  })),
}))
vi.mock('@/lib/dal/billing', () => ({ getBillingAccountByClientId: vi.fn() }))

import { getClientCommercialSummaries } from '@/lib/dal/business-centre'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-15T00:00:00Z'))
  state.rows = []
  state.bounds = []
  state.returnedRows = 0
})
afterEach(() => vi.useRealTimers())

describe('commercial health reads only the six completed UTC months', () => {
  it('preserves classifications across a year boundary and excludes current/future/old history', async () => {
    for (const client_id of ['growing', 'dormant', 'old-only']) {
      for (let month = 0; month < 36; month++) {
        const date = new Date(Date.UTC(2024, month, 1))
        const key = date.toISOString().slice(0, 10)
        const inWindow = key >= '2025-07-01' && key < '2026-01-01'
        state.rows.push({ client_id, month: key, completed_count: inWindow
          ? client_id === 'growing' ? (key < '2025-10-01' ? 2 : 7)
            : client_id === 'dormant' ? (key < '2025-10-01' ? 2 : 0) : 0
          : 1000 })
      }
    }
    state.rows.push({ client_id: 'growing', month: '2026-01-01', completed_count: 9999 })
    const result = await getClientCommercialSummaries()
    expect([...result.values()].map(row => [row.clientId, row.health])).toEqual([
      ['growing', 'growing'], ['dormant', 'dormant'], ['old-only', 'none'],
    ])
    expect(state.bounds).toEqual([['gte', 'month', '2025-07-01'], ['lt', 'month', '2026-01-01']])
    expect(state.returnedRows).toBe(18)
    expect(state.rows).toHaveLength(109)
  })

  it('keeps a client with history only outside the window classified as no usage', async () => {
    state.rows = [{ client_id: 'old-only', month: '2024-01-01', completed_count: 999 }]
    const result = await getClientCommercialSummaries()
    expect(result.get('old-only')?.health).toBe('none')
    expect(state.returnedRows).toBe(0)
  })
})
