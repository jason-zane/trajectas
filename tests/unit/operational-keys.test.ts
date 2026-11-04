import { afterEach, describe, expect, it, vi } from 'vitest'
import { operationalIdentity, operationalNamespace } from '@/lib/security/operational-keys'

describe('operational key privacy and isolation', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('separates production, preview branches, development and projects', () => {
    vi.stubEnv('VERCEL_PROJECT_ID', 'project-one')
    vi.stubEnv('VERCEL_ENV', 'production')
    const production = operationalNamespace()
    vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'branch-one')
    const branchOne = operationalNamespace()
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'branch-two')
    const branchTwo = operationalNamespace()
    vi.stubEnv('VERCEL_ENV', 'development')
    const development = operationalNamespace()
    vi.stubEnv('VERCEL_PROJECT_ID', 'project-two')
    expect(new Set([production, branchOne, branchTwo, development, operationalNamespace()]).size).toBe(5)
  })
  it('never retains raw keyed identities and uses a keyed digest when configured', () => {
    vi.stubEnv('TRAJECTAS_CONTEXT_SECRET', 'synthetic-test-only-key-one')
    const first = operationalIdentity('otp-email:person@example.test')
    expect(first).toMatch(/^[a-f0-9]{64}$/)
    vi.stubEnv('TRAJECTAS_CONTEXT_SECRET', 'synthetic-test-only-key-two')
    expect(operationalIdentity('otp-email:person@example.test')).not.toBe(first)
  })
})
