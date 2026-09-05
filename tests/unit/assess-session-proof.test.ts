import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createAssessSessionProof, verifyAssessSessionProof } from '@/lib/assess/session-proof'
import { checkRequestRateLimit } from '@/lib/security/rate-limit'

describe('authorized participant rate-limit credentials', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_API_KEY', 'test-only-proof-signing-key')
    ;(globalThis as typeof globalThis & { __trajectasRateLimitStore?: Map<string, number[]> })
      .__trajectasRateLimitStore?.clear()
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

  const session = '550e8400-e29b-41d4-a716-446655440000'
  const token = 'a'.repeat(64)
  function request(proof: string) {
    return new NextRequest('http://127.0.0.1/api/assess/save-batch', {
      method: 'POST', headers: { 'x-forwarded-for': '203.0.113.20', 'x-assess-session-proof': proof },
    })
  }

  it('binds the proof to both participant token and session and rejects tampering', () => {
    const proof = createAssessSessionProof(token, session)!
    expect(verifyAssessSessionProof(proof, { token, sessionId: session })).not.toBeNull()
    expect(verifyAssessSessionProof(proof, { token: 'b'.repeat(64), sessionId: session })).toBeNull()
    expect(verifyAssessSessionProof(proof, { token, sessionId: '550e8400-e29b-41d4-a716-446655440001' })).toBeNull()
    expect(verifyAssessSessionProof(`x${proof}`)).toBeNull()
    expect(verifyAssessSessionProof('x'.repeat(2000))).toBeNull()
  })

  it('expires and cannot be minted when no server secret exists', () => {
    const proof = createAssessSessionProof(token, session)!
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + 4 * 60 * 60 * 1000)
    expect(verifyAssessSessionProof(proof)).toBeNull()
    vi.stubEnv('INTERNAL_API_KEY', '')
    expect(createAssessSessionProof(token, session)).toBeUndefined()
  })

  it('admits 100 validated sessions on one IP at a five-second answer cadence', async () => {
    const start = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(start)
    const requests = Array.from({ length: 100 }, (_, index) => request(createAssessSessionProof(
      `${index}`.padStart(64, 'a'), `550e8400-e29b-41d4-a716-${index.toString().padStart(12, '0')}`,
    )!))
    let admitted = 0
    for (let tick = 0; tick < 12; tick++) {
      clock.mockReturnValue(start + tick * 5000)
      admitted += (await Promise.all(requests.map(r => checkRequestRateLimit(r)))).filter(r => r?.allowed).length
    }
    expect(admitted).toBe(1200)
  })

  it('keeps forged/unverified traffic under the unchanged 600/IP/minute budget', async () => {
    const results = await Promise.all(Array.from({ length: 601 }, (_, i) => checkRequestRateLimit(request(`forged-${i}`))))
    expect(results.filter(r => r?.allowed)).toHaveLength(600)
    expect(results[600]).toMatchObject({ allowed: false, limit: 600 })
  })

  it('does not let a valid proof become an unlimited abuse bypass', async () => {
    const r = request(createAssessSessionProof(token, session)!)
    const results = await Promise.all(Array.from({ length: 121 }, () => checkRequestRateLimit(r)))
    expect(results.filter(r => r?.allowed)).toHaveLength(120)
    expect(results[120]).toMatchObject({ allowed: false, limit: 120 })
  })
})
