import { afterEach, describe, expect, it, vi } from 'vitest'
import { previewDeploymentHeaders } from '@/lib/security/preview-deployment-access'
import { configureReportPagePreviewAccess } from '@/lib/reports/pdf-browser'

const admin = 'https://synthetic-admin.vercel.app'
const env = { VERCEL_ENV: 'preview', ADMIN_APP_URL: admin, VERCEL_AUTOMATION_BYPASS_SECRET: 'synthetic-automation-only' }
afterEach(() => vi.unstubAllEnvs())

describe('Preview deployment access', () => {
  it('authenticates only the configured Preview admin origin', () => {
    expect(previewDeploymentHeaders(`${admin}/api/reports/generate`, env)).toEqual({ 'x-vercel-protection-bypass': 'synthetic-automation-only' })
  })

  it.each([
    'https://fonts.example.test/font.woff2', 'https://other.vercel.app/print',
    'https://synthetic-admin.vercel.app.attacker.test/', 'http://synthetic-admin.vercel.app/',
    'https://user:password@synthetic-admin.vercel.app/', 'not a URL',
  ])('does not send credentials to %s', target => {
    expect(previewDeploymentHeaders(target, env)).toEqual({})
  })

  it.each(['production', 'development', undefined])('does not change %s traffic', VERCEL_ENV => {
    expect(previewDeploymentHeaders(admin, { ...env, VERCEL_ENV })).toEqual({})
  })

  it('requires both a configured credential and an isolated Vercel admin host', () => {
    expect(previewDeploymentHeaders(admin, { ...env, VERCEL_AUTOMATION_BYPASS_SECRET: '' })).toEqual({})
    expect(previewDeploymentHeaders(admin, { ...env, ADMIN_APP_URL: '' })).toEqual({})
    expect(previewDeploymentHeaders('https://admin.example.test', { ...env, ADMIN_APP_URL: 'https://admin.example.test' })).toEqual({})
  })

  it('filters browser requests individually, including redirects and external assets', async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
    let handler!: (request: { url(): string; headers(): Record<string, string>; continue(options: unknown): Promise<void> }) => void
    const page = { setRequestInterception: vi.fn(async () => {}), on: vi.fn((event, callback) => { handler = callback }) }
    await configureReportPagePreviewAccess(page as never)
    expect(page.setRequestInterception).toHaveBeenCalledWith(true)
    for (const target of [`${admin}/print/reports/synthetic`, 'https://fonts.example.test/font.woff2', 'https://other.vercel.app/redirect']) {
      const proceed = vi.fn(async () => {})
      handler({ url: () => target, headers: () => ({ accept: '*/*', 'x-vercel-protection-bypass': 'inherited-from-previous-origin' }), continue: proceed })
      expect(proceed).toHaveBeenCalledWith({ headers: { accept: '*/*', ...previewDeploymentHeaders(target, env) } })
    }
  })

  it('does not intercept ordinary local browser traffic', async () => {
    vi.stubEnv('VERCEL_ENV', 'development')
    const page = { setRequestInterception: vi.fn(), on: vi.fn() }
    await configureReportPagePreviewAccess(page as never)
    expect(page.setRequestInterception).not.toHaveBeenCalled()
    expect(page.on).not.toHaveBeenCalled()
  })
})
