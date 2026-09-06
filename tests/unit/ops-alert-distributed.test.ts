import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { sendHtmlEmail, set, config } = vi.hoisted(() => ({ sendHtmlEmail: vi.fn(), set: vi.fn(), config: vi.fn() }))
vi.mock('@/lib/email/provider', () => ({ sendHtmlEmail }))
vi.mock('@upstash/redis', () => ({ Redis: class { constructor(options: unknown) { config(options) } set = set } }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('OPS_ALERT_EMAIL', 'ops@example.test')
  vi.stubEnv('RESEND_API_KEY', 'test')
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.test')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test')
  sendHtmlEmail.mockResolvedValue({ id: 'accepted' })
  set.mockResolvedValue('OK')
})
afterEach(() => vi.unstubAllEnvs())
const input = { subject: 'error: cron.report-generation-sweep', body: 'database timed out', fingerprint: 'cron.report-generation-sweep:timeout' }

describe('distributed operational alert throttle', () => {
  it('sends only one email across simultaneous fresh server instances', async () => {
    const claims = new Set<string>()
    set.mockImplementation(async (key: string) => { if (claims.has(key)) return null; claims.add(key); return 'OK' })
    const first = (await import('@/lib/observability/ops-alert')).sendOpsAlert
    vi.resetModules()
    const second = (await import('@/lib/observability/ops-alert')).sendOpsAlert
    expect(await Promise.all([first(input), second(input)])).toEqual([true, false])
    expect(sendHtmlEmail).toHaveBeenCalledTimes(1)
    expect(set.mock.calls[0]).toEqual([expect.stringMatching(/^trajectas:ops-alert:[a-f0-9]{64}$/), '1', { nx: true, px: 900000 }])
    expect(JSON.stringify(set.mock.calls)).not.toContain('ops@example.test')
    expect(JSON.stringify(set.mock.calls)).not.toContain(input.fingerprint)
  })
  it('suppresses email if the distributed claim fails, without throwing', async () => {
    set.mockRejectedValue(new Error('Redis unavailable'))
    const { sendOpsAlert } = await import('@/lib/observability/ops-alert')
    await expect(sendOpsAlert(input)).resolves.toBe(false)
    expect(sendHtmlEmail).not.toHaveBeenCalled()
    expect(config.mock.calls[0][0].retry).toBe(false)
    expect(config.mock.calls[0][0].signal()).toBeInstanceOf(AbortSignal)
  })
  it('does not suppress a different incident', async () => {
    const { sendOpsAlert } = await import('@/lib/observability/ops-alert')
    expect(await sendOpsAlert(input)).toBe(true)
    expect(await sendOpsAlert({ ...input, fingerprint: 'reports.render:invalid-template' })).toBe(true)
    expect(sendHtmlEmail).toHaveBeenCalledTimes(2)
    expect(set.mock.calls[0][0]).not.toBe(set.mock.calls[1][0])
  })
  it('uses the same claim across deployments and allows a later incident after expiry', async () => {
    const { sendOpsAlert } = await import('@/lib/observability/ops-alert')
    await sendOpsAlert(input)
    vi.resetModules()
    const restarted = (await import('@/lib/observability/ops-alert')).sendOpsAlert
    set.mockResolvedValueOnce(null)
    expect(await restarted(input)).toBe(false)
    vi.resetModules()
    const afterExpiry = (await import('@/lib/observability/ops-alert')).sendOpsAlert
    set.mockResolvedValueOnce('OK')
    expect(await afterExpiry(input)).toBe(true)
    expect(new Set(set.mock.calls.map(call => call[0])).size).toBe(1)
  })
  it('does not fall back to sending when Redis configuration is incomplete', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    const { sendOpsAlert } = await import('@/lib/observability/ops-alert')
    expect(await sendOpsAlert(input)).toBe(false)
    expect(sendHtmlEmail).not.toHaveBeenCalled()
  })
})
