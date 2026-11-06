import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ open: vi.fn() }))
vi.mock('@upstash/redis', () => ({ Redis: class { constructor(options: unknown) { state.open(options) } } }))
import { createPrivacyLedger } from '@/lib/privacy/ledger'

const names = ['PRIVACY_LEDGER_ENCRYPTION_KEY', 'PRIVACY_LEDGER_REDIS_REST_URL', 'PRIVACY_LEDGER_REDIS_REST_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']
beforeEach(() => {
  for (const name of names) vi.stubEnv(name, undefined)
  vi.stubEnv('PRIVACY_LEDGER_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
  vi.stubEnv('KV_REST_API_URL', 'https://legacy.example.invalid')
  vi.stubEnv('KV_REST_API_TOKEN', 'synthetic-legacy-token')
})
afterEach(() => vi.unstubAllEnvs())

describe('privacy ledger connection isolation', () => {
  it('preserves an existing legacy KV configuration when dedicated settings are absent', () => {
    createPrivacyLedger()
    expect(state.open).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://legacy.example.invalid', token: 'synthetic-legacy-token', retry: false }))
  })
  it('preserves existing Upstash precedence for legacy deployments', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://shared.example.invalid')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'synthetic-shared-token')
    createPrivacyLedger()
    expect(state.open).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://shared.example.invalid', token: 'synthetic-shared-token' }))
  })
  it('uses the dedicated pair without moving rate-limit or alert configuration', () => {
    vi.stubEnv('PRIVACY_LEDGER_REDIS_REST_URL', 'https://ledger.example.invalid')
    vi.stubEnv('PRIVACY_LEDGER_REDIS_REST_TOKEN', 'synthetic-ledger-token')
    createPrivacyLedger()
    expect(state.open).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://ledger.example.invalid', token: 'synthetic-ledger-token' }))
    expect(process.env.KV_REST_API_TOKEN).toBe('synthetic-legacy-token')
  })
  it.each([
    ['https://ledger.example.invalid', undefined],
    [undefined, 'synthetic-ledger-token'],
    ['', 'synthetic-ledger-token'],
    ['https://ledger.example.invalid', ''],
  ])('fails closed for an incomplete dedicated pair (%s)', (url, token) => {
    vi.stubEnv('PRIVACY_LEDGER_REDIS_REST_URL', url)
    vi.stubEnv('PRIVACY_LEDGER_REDIS_REST_TOKEN', token)
    expect(() => createPrivacyLedger()).toThrow('privacy_ledger_not_configured')
    expect(state.open).not.toHaveBeenCalled()
  })
  it.each([undefined, '', 'not-a-32-byte-key'])('requires a dedicated encryption key (%s)', key => {
    vi.stubEnv('PRIVACY_LEDGER_ENCRYPTION_KEY', key)
    expect(() => createPrivacyLedger()).toThrow('privacy_ledger_not_configured')
    expect(state.open).not.toHaveBeenCalled()
  })
})
