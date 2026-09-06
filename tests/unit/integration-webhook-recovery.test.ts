/* eslint-disable @typescript-eslint/no-explicit-any -- stateful fluent database fixture */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, any>
type Query = { table: string; operation: string; values: Row; filters: any[][]; single: boolean; limit?: number }
const mocks = vi.hoisted(() => ({ execute: vi.fn(), decrypt: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => {
  const query: Query = { table, operation: 'select', values: {}, filters: [], single: false }
  const chain: any = {}
  chain.select = () => chain
  chain.order = () => chain
  chain.limit = (limit: number) => { query.limit = limit; return chain }
  for (const name of ['eq', 'is', 'lte', 'lt', 'gte']) chain[name] = (...args: any[]) => {
    query.filters.push([name, ...args]); return chain
  }
  for (const name of ['update', 'insert']) chain[name] = (values: Row) => {
    query.operation = name; query.values = values; return chain
  }
  const finish = async () => mocks.execute(query)
  chain.maybeSingle = () => { query.single = true; return finish() }
  chain.then = (resolve: any, reject: any) => finish().then(resolve, reject)
  return chain
} }) }))
vi.mock('@/lib/integrations/crypto', () => ({ decryptIntegrationSecret: (...args: unknown[]) => mocks.decrypt(...args) }))

import { dispatchPendingIntegrationEvents } from '@/lib/integrations/webhooks'

const NOW = new Date('2026-09-06T00:00:00.000Z')
const iso = (offsetMs = 0) => new Date(NOW.getTime() + offsetMs).toISOString()
const matches = (row: Row, query: Query) => query.filters.every(([op, key, value]) => {
  if (op === 'eq' || op === 'is') return row[key] === value
  if (op === 'lte') return row[key] <= value
  if (op === 'lt') return row[key] < value
  if (op === 'gte') return row[key] >= value
  throw new Error(`Unsupported fixture filter ${op}`)
})
const event = (id: string, fields: Row = {}): Row => ({ id, client_id: 'client', attempts: 0,
  event_type: 'integration.launch.created', aggregate_type: 'launch', aggregate_id: id,
  status: 'pending', available_at: iso(), dispatched_at: null, updated_at: iso(), created_at: iso(),
  payload: { campaignId: id }, ...fields })

let rows: Record<string, Row[]>
let queries: Query[]
let intercept: (query: Query) => { data: unknown; error: unknown } | undefined
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  queries = []
  rows = {
    integration_events_outbox: [event('first'), event('second')],
    campaigns: ['first', 'second'].map(id => ({ id, client_id: 'client', deleted_at: null, confidentiality_mode: 'standard' })),
    integration_webhook_endpoints: [{ id: 'endpoint', client_id: 'client', status: 'active',
      url: 'https://webhook.example.invalid', signing_secret_ciphertext: 'fixture', subscribed_events: [] }],
    integration_webhook_deliveries: [],
  }
  intercept = () => undefined
  mocks.decrypt.mockReturnValue('unit-test-key')
  mocks.execute.mockImplementation((query: Query) => {
    queries.push(query)
    const override = intercept(query)
    if (override) return override
    let selected = rows[query.table].filter(row => matches(row, query))
    if (query.limit !== undefined) selected = selected.slice(0, query.limit)
    if (query.operation === 'update') selected.forEach(row => Object.assign(row, query.values, { updated_at: new Date().toISOString() }))
    if (query.operation === 'insert') rows[query.table].push({ ...query.values })
    // PostgREST returns snapshots, not references to mutable database records.
    return { data: structuredClone(query.single ? selected[0] ?? null : selected), error: null }
  })
  fetchMock = vi.fn(async () => new Response('ok'))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.useRealTimers())

describe('webhook outbox recovery', () => {
  it.each(['missing campaign', 'transient database error'])('retries %s for the first event and still dispatches the second', async (failure) => {
    intercept = query => {
      if (query.table !== 'campaigns' || !query.filters.some(([, key, value]) => key === 'id' && value === 'first')) return undefined
      expect(rows.integration_events_outbox[1]).toMatchObject({ status: 'pending', attempts: 0 })
      return { data: null, error: failure === 'missing campaign' ? null : { message: 'transient failure' } }
    }
    expect(await dispatchPendingIntegrationEvents(2)).toEqual({ processed: 2, delivered: 1 })
    expect(rows.integration_events_outbox[0]).toMatchObject({ status: 'pending', attempts: 1,
      dispatched_at: null, available_at: iso(5 * 60_000) })
    expect(rows.integration_events_outbox[1]).toMatchObject({ status: 'dispatched', attempts: 1, dispatched_at: iso() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).id).toBe('second')
    expect(rows.integration_webhook_deliveries.map(row => row.integration_event_outbox_id)).toEqual(['second'])
  })

  it.each(['returned error', 'rejected request'])('continues after a retry-state write fails (%s), then recovers only that expired claim', async (failure) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    intercept = query => {
      const failedRetryWrite = query.table === 'integration_events_outbox' && query.values.status === 'pending'
        && query.filters.some(([, key, value]) => key === 'id' && value === 'first')
      if (failedRetryWrite && failure === 'rejected request') throw new Error('database unavailable')
      return failedRetryWrite || query.table === 'campaigns' && matches(rows.campaigns[0], query)
        ? { data: null, error: { message: 'database unavailable' } } : undefined
    }
    expect(await dispatchPendingIntegrationEvents(2)).toEqual({ processed: 2, delivered: 1 })
    expect(rows.integration_events_outbox[0]).toMatchObject({ status: 'dispatched', dispatched_at: null,
      attempts: 1, available_at: iso(15 * 60_000) })
    expect(log).toHaveBeenCalledOnce()
    intercept = () => undefined
    vi.setSystemTime(new Date(NOW.getTime() + 16 * 60_000))
    expect(await dispatchPendingIntegrationEvents(2)).toEqual({ processed: 1, delivered: 1 })
    expect(rows.integration_events_outbox[0]).toMatchObject({ status: 'dispatched', attempts: 2, dispatched_at: iso(16 * 60_000) })
    expect(rows.integration_events_outbox[1].attempts).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('recovers a legacy crashed claim, preserves active/completed claims and terminates exhausted claims', async () => {
    rows.integration_events_outbox = [
      event('first', { status: 'dispatched', attempts: 1, available_at: iso(-60_000), updated_at: iso(-16 * 60_000) }),
      event('active', { status: 'dispatched', attempts: 1, available_at: iso(10 * 60_000), updated_at: iso(-5 * 60_000) }),
      event('legacy-active', { status: 'dispatched', attempts: 1, available_at: iso(-60_000), updated_at: iso(-5 * 60_000) }),
      event('completed', { status: 'dispatched', dispatched_at: iso(-20 * 60_000), updated_at: iso(-20 * 60_000) }),
      event('exhausted', { status: 'dispatched', attempts: 5, available_at: iso(-60_000), updated_at: iso(-16 * 60_000) }),
    ]
    const before = structuredClone(rows.integration_events_outbox.slice(1, 4))
    expect(await dispatchPendingIntegrationEvents(10)).toEqual({ processed: 1, delivered: 1 })
    expect(rows.integration_events_outbox.slice(1, 4)).toEqual(before)
    expect(rows.integration_events_outbox[4]).toMatchObject({ status: 'failed', attempts: 5 })
  })

  it('makes a fifth policy failure terminal without sending the protected event', async () => {
    rows.integration_events_outbox[0].attempts = 4
    rows.campaigns = rows.campaigns.filter(row => row.id !== 'first')
    await dispatchPendingIntegrationEvents(2)
    expect(rows.integration_events_outbox[0]).toMatchObject({ status: 'failed', attempts: 5, dispatched_at: null })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not overwrite a replaced claim when its old worker finishes', async () => {
    rows.integration_events_outbox = [event('first')]
    const replacement = iso(30 * 60_000)
    fetchMock.mockImplementation(async () => {
      rows.integration_events_outbox[0].available_at = replacement
      rows.integration_events_outbox[0].attempts = 2
      return new Response('ok')
    })
    await dispatchPendingIntegrationEvents(1)
    expect(rows.integration_events_outbox[0]).toMatchObject({ status: 'dispatched', attempts: 2,
      available_at: replacement, dispatched_at: null })
    const completion = queries.find(query => query.table === 'integration_events_outbox' && query.values.dispatched_at)
    expect(completion?.filters).toContainEqual(['eq', 'available_at', iso(15 * 60_000)])
  })

  it('leaves unstarted candidates pending when the work budget expires', async () => {
    fetchMock.mockImplementation(async () => {
      vi.setSystemTime(new Date(NOW.getTime() + 240_000))
      return new Response('ok')
    })
    expect(await dispatchPendingIntegrationEvents(2)).toEqual({ processed: 1, delivered: 1 })
    expect(rows.integration_events_outbox[1]).toMatchObject({ status: 'pending', attempts: 0 })
  })

  it('does not redeliver a recorded success after completion-state persistence failed', async () => {
    rows.integration_events_outbox = [event('first')]
    intercept = query => query.table === 'integration_events_outbox' && query.values.dispatched_at
      ? { data: null, error: { message: 'write failed' } } : undefined
    await dispatchPendingIntegrationEvents(1)
    expect(rows.integration_events_outbox[0].status).toBe('pending')
    intercept = () => undefined
    vi.setSystemTime(new Date(NOW.getTime() + 6 * 60_000))
    await dispatchPendingIntegrationEvents(1)
    expect(rows.integration_events_outbox[0].status).toBe('dispatched')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('allows only one of two concurrent pollers to claim each pending event', async () => {
    const results = await Promise.all([dispatchPendingIntegrationEvents(2), dispatchPendingIntegrationEvents(2)])
    expect(results.reduce((total, result) => total + result.delivered, 0)).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(rows.integration_events_outbox.every(row => row.status === 'dispatched' && row.attempts === 1)).toBe(true)
  })
})
