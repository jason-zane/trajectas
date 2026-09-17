import { describe, expect, it, beforeEach } from 'vitest'

const ORIGINAL_SECRET = process.env.TRAJECTAS_CONTEXT_SECRET

describe('public-builds codes', () => {
  beforeEach(() => {
    process.env.TRAJECTAS_CONTEXT_SECRET = 'test-pepper-secret'
  })

  it('generates a six-digit zero-padded code', async () => {
    const { generatePublicBuildCode } = await import('@/lib/public-builds/codes')
    for (let i = 0; i < 25; i++) {
      const code = generatePublicBuildCode()
      expect(code).toMatch(/^\d{6}$/)
    }
  })

  it('hashes deterministically and verifies a matching code', async () => {
    const { hashPublicBuildCode, verifyPublicBuildCode } = await import('@/lib/public-builds/codes')
    const hash1 = hashPublicBuildCode('038291')
    const hash2 = hashPublicBuildCode('038291')
    expect(hash1).toBe(hash2)
    expect(verifyPublicBuildCode('038291', hash1)).toBe(true)
    expect(verifyPublicBuildCode('038292', hash1)).toBe(false)
  })

  it('produces different hashes for different codes', async () => {
    const { hashPublicBuildCode } = await import('@/lib/public-builds/codes')
    expect(hashPublicBuildCode('000000')).not.toBe(hashPublicBuildCode('111111'))
  })

  it('throws when the pepper is not configured', async () => {
    delete process.env.TRAJECTAS_CONTEXT_SECRET
    const { hashPublicBuildCode } = await import('@/lib/public-builds/codes')
    expect(() => hashPublicBuildCode('038291')).toThrow(/TRAJECTAS_CONTEXT_SECRET/)
    process.env.TRAJECTAS_CONTEXT_SECRET = ORIGINAL_SECRET
  })

  it('normalises whitespace and case before hashing PD text', async () => {
    const { hashPdText } = await import('@/lib/public-builds/codes')
    const a = hashPdText('Senior  Engineer\n\nBuilds things.')
    const b = hashPdText('senior engineer builds things.')
    expect(a).toBe(b)
  })

  it('hashes different PD text differently', async () => {
    const { hashPdText } = await import('@/lib/public-builds/codes')
    expect(hashPdText('Role A description')).not.toBe(hashPdText('Role B description'))
  })

  it('hashes IPs deterministically with the pepper', async () => {
    const { hashIp } = await import('@/lib/public-builds/codes')
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'))
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('1.2.3.5'))
  })
})
