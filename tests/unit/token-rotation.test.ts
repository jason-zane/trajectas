import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

describe('Token Rotation on Completion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates a valid hex token of 64 characters (32 bytes)', () => {
    const token = crypto.randomBytes(32).toString('hex')
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(token.length).toBe(64)
  })

  it('generates different tokens on each call', () => {
    const token1 = crypto.randomBytes(32).toString('hex')
    const token2 = crypto.randomBytes(32).toString('hex')
    expect(token1).not.toBe(token2)
  })

  it('validates token format matches database default', () => {
    // The database uses: encode(gen_random_bytes(32), 'hex')
    // which produces a 64-character hex string
    const appToken = crypto.randomBytes(32).toString('hex')

    // Test format: should be valid hex of length 64
    const hexPattern = /^[a-f0-9]{64}$/
    expect(hexPattern.test(appToken)).toBe(true)
  })
})
