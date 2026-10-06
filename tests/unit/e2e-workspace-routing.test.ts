import { afterEach, describe, expect, it, vi } from 'vitest'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { inferSurfaceFromRequest } from '@/lib/hosts'

const { testSurfaceEnv } = await import(pathToFileURL(resolve('scripts/testing/surface-env.mjs')).href)
afterEach(() => vi.unstubAllEnvs())

describe('single-host synthetic workspace routing', () => {
  it('leaves absent mappings empty so existing local pathname inference selects each portal', () => {
    const environment = testSurfaceEnv({}, {}) as Record<string, string>
    for (const [key, value] of Object.entries(environment)) {
      expect(value).toBe('')
      vi.stubEnv(key, value)
    }
    for (const [pathname, surface] of [['/campaigns', 'admin'], ['/partner/clients', 'partner'], ['/client/reports', 'client'], ['/assess/seed-token', 'assess']]) {
      expect(inferSurfaceFromRequest({ host: '127.0.0.1:3101', pathname })).toBe(surface)
    }
  })
  it('retains explicit environment mappings ahead of file mappings', () => {
    const environment = testSurfaceEnv({ PUBLIC_APP_URL: 'https://public.synthetic.test' }, { PUBLIC_APP_URL: 'https://ignored.synthetic.test', PARTNER_APP_URL: 'https://partner.synthetic.test' }) as Record<string, string>
    expect(environment.PUBLIC_APP_URL).toBe('https://public.synthetic.test')
    expect(environment.PARTNER_APP_URL).toBe('https://partner.synthetic.test')
    for (const [key, value] of Object.entries(environment)) vi.stubEnv(key, value)
    expect(inferSurfaceFromRequest({ host: 'public.synthetic.test', pathname: '/partner/clients' })).toBe('public')
    expect(inferSurfaceFromRequest({ host: 'partner.synthetic.test', pathname: '/dashboard' })).toBe('partner')
  })
})
