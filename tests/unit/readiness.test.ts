import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { ping, probe, chain } = vi.hoisted(() => {
  const probe = vi.fn()
  const chain: Record<string, unknown> = {}
  for (const method of ['from', 'select', 'eq', 'lt', 'limit']) chain[method] = vi.fn(() => chain)
  chain.abortSignal = probe
  return { ping: vi.fn(), probe, chain }
})
vi.mock('@upstash/redis', () => ({ Redis: class { ping = ping } }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => chain }))

import { GET } from '@/app/api/health/route'

beforeEach(() => {
  probe.mockReset().mockResolvedValue({ data: [], error: null })
  ping.mockReset().mockResolvedValue('PONG')
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'private-token')
  vi.stubEnv('KV_REST_API_URL', '')
  vi.stubEnv('KV_REST_API_TOKEN', '')
  vi.stubEnv('RESEND_API_KEY', 'private-email-key')
  vi.stubEnv('CRON_SECRET', 'private-cron-key')
})
afterEach(() => vi.unstubAllEnvs())

describe('operational readiness', () => {
  it('returns ready only when dependencies and queues are healthy, without disclosing credentials', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = await response.text()
    expect(body).not.toContain('private-')
    expect(body).not.toContain('redis.example')
  })

  it('detects a Redis outage even while the database is healthy', async () => {
    ping.mockRejectedValue(new Error('network failure with private-token'))
    const response = await GET()
    expect(response.status).toBe(503)
    expect((await response.json()).checks.rateLimit).toBe('error')
  })

  it('detects missing distributed limiting and cron configuration', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.stubEnv('CRON_SECRET', '')
    const response = await GET()
    expect(response.status).toBe(503)
    expect((await response.json()).checks).toMatchObject({ rateLimit: 'error', cron: 'error' })
  })

  it('detects stranded queued reports without exposing snapshot identifiers', async () => {
    probe.mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'confidential-snapshot-id' }], error: null })
    const response = await GET()
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.checks.reports).toBe('error')
    expect(JSON.stringify(body)).not.toContain('confidential-snapshot-id')
  })

  it('does not report empty successful queues when a queue query failed', async () => {
    probe.mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'query failed' } })
    expect((await GET()).status).toBe(503)
  })
})
