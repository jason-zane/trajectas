import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createReportAccessToken } from '@/lib/reports/report-access-token'
import {
  createParticipantPdfRateLimitProof,
  getVerifiedPdfRateLimitIdentity,
  PDF_RATE_LIMIT_PROOF_TTL_SECONDS,
  verifyParticipantPdfRateLimitProof,
} from '@/lib/reports/pdf-rate-limit-proof'
import { checkRequestRateLimit } from '@/lib/security/rate-limit'

const snapshot = '11111111-1111-4111-8111-111111111111'
const otherSnapshot = '22222222-2222-4222-8222-222222222222'
const participant = '33333333-3333-4333-8333-333333333333'
const token = 'a'.repeat(64)
const otherToken = 'b'.repeat(64)
const now = new Date('2026-09-06T01:00:00Z').getTime()

function request(query: Record<string, string>, snapshotId = snapshot, ip = '203.0.113.40', method = 'GET') {
  return new NextRequest(`https://admin.trajectas.test/api/reports/${snapshotId}/pdf?${new URLSearchParams(query)}`, {
    method, headers: { 'x-forwarded-for': ip },
  })
}

beforeEach(() => {
  vi.stubEnv('REPORT_ACCESS_TOKEN_SECRET', 'synthetic-signing-key-'.repeat(3))
  vi.spyOn(Date, 'now').mockReturnValue(now)
  ;(globalThis as typeof globalThis & { __trajectasRateLimitStore?: Map<string, number[]> })
    .__trajectasRateLimitStore?.clear()
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('participant PDF allowance proofs', () => {
  it('contains only a token hash and binds the exact report and participant token', () => {
    const proof = createParticipantPdfRateLimitProof(token, snapshot)
    const decoded = Buffer.from(proof.split('.')[0], 'base64url').toString()
    expect(decoded).not.toContain(token)
    expect(verifyParticipantPdfRateLimitProof(proof, { token, snapshotId: snapshot })).toMatchObject({ snapshotId: snapshot })
    expect(verifyParticipantPdfRateLimitProof(proof, { token: otherToken, snapshotId: snapshot })).toBeNull()
    expect(verifyParticipantPdfRateLimitProof(proof, { token, snapshotId: otherSnapshot })).toBeNull()
  })

  it('rejects modified, oversized, truncated, or extra-segment credentials', () => {
    const proof = createParticipantPdfRateLimitProof(token, snapshot)
    for (const invalid of [`x${proof}`, `${proof}.extra`, proof.split('.')[0], 'x'.repeat(1025), '.']) {
      expect(verifyParticipantPdfRateLimitProof(invalid, { token, snapshotId: snapshot })).toBeNull()
    }
  })

  it('expires and fails closed if the signing secret changes or is unavailable', () => {
    const proof = createParticipantPdfRateLimitProof(token, snapshot)
    vi.spyOn(Date, 'now').mockReturnValue(now + PDF_RATE_LIMIT_PROOF_TTL_SECONDS * 1000)
    expect(verifyParticipantPdfRateLimitProof(proof, { token, snapshotId: snapshot })).toBeNull()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    vi.stubEnv('REPORT_ACCESS_TOKEN_SECRET', 'different-synthetic-key-'.repeat(3))
    expect(verifyParticipantPdfRateLimitProof(proof, { token, snapshotId: snapshot })).toBeNull()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('REPORT_ACCESS_TOKEN_SECRET', '')
    expect(verifyParticipantPdfRateLimitProof(proof, { token, snapshotId: snapshot })).toBeNull()
  })

  it('does not accept an existing report access grant as a raw-token allowance proof', () => {
    const reportToken = createReportAccessToken(snapshot, participant)
    expect(verifyParticipantPdfRateLimitProof(reportToken, { token, snapshotId: snapshot })).toBeNull()
  })

  it('requires an exact PDF route and follows raw-token authorization precedence', () => {
    const reportToken = createReportAccessToken(snapshot, participant)
    const valid = request({ reportToken })
    expect(getVerifiedPdfRateLimitIdentity(valid.nextUrl)).not.toBeNull()
    expect(getVerifiedPdfRateLimitIdentity(request({ token: otherToken, reportToken }).nextUrl)).toBeNull()
    expect(getVerifiedPdfRateLimitIdentity(request({ reportToken }, otherSnapshot).nextUrl)).toBeNull()
    const wrongPath = new URL(valid.url)
    wrongPath.pathname += '/extra'
    expect(getVerifiedPdfRateLimitIdentity(wrongPath)).toBeNull()
    expect(getVerifiedPdfRateLimitIdentity(new URL('https://admin.trajectas.test/api/reports/not-a-uuid/pdf'))).toBeNull()
  })
})

describe('PDF limiter scopes through the actual request limiter', () => {
  it.each(['participant', 'signed'] as const)('admits 100 valid %s links from the same IP concurrently', async kind => {
    const results = await Promise.all(Array.from({ length: 100 }, (_, i) => {
      const id = `11111111-1111-4111-8111-${i.toString().padStart(12, '0')}`
      const ownToken = i.toString(16).padStart(64, 'a')
      const query: Record<string, string> = kind === 'participant'
        ? { token: ownToken, pdfRateLimitProof: createParticipantPdfRateLimitProof(ownToken, id) }
        : { reportToken: createReportAccessToken(id, participant) }
      return checkRequestRateLimit(request(query, id))
    }))
    expect(results).toHaveLength(100)
    expect(results.every(result => result?.allowed && result.limit === 20)).toBe(true)
  })

  it.each(['participant', 'signed'] as const)('still caps one valid %s link at20/min across IPs and methods', async kind => {
    const query: Record<string, string> = kind === 'participant'
      ? { token, pdfRateLimitProof: createParticipantPdfRateLimitProof(token, snapshot) }
      : { reportToken: createReportAccessToken(snapshot, participant) }
    const results = await Promise.all(Array.from({ length: 21 }, (_, i) => checkRequestRateLimit(
      request(query, snapshot, `203.0.113.${i + 1}`, i % 2 ? 'POST' : 'GET'),
    )))
    expect(results.filter(result => result?.allowed)).toHaveLength(20)
    expect(results[20]).toMatchObject({ allowed: false, limit: 20 })
  })

  it('does not reset an exhausted bucket when the same participant refreshes a proof', async () => {
    const firstProof = createParticipantPdfRateLimitProof(token, snapshot)
    for (let i = 0; i < 20; i++) await checkRequestRateLimit(request({ token, pdfRateLimitProof: firstProof }))
    vi.spyOn(Date, 'now').mockReturnValue(now + 1_000)
    const renewedProof = createParticipantPdfRateLimitProof(token, snapshot)
    expect(renewedProof).not.toBe(firstProof)
    expect(await checkRequestRateLimit(request({ token, pdfRateLimitProof: renewedProof }))).toMatchObject({ allowed: false, limit: 20 })
  })

  it.each(['unproven', 'forged', 'mismatched', 'expired', 'signed-forged'])('keeps %s requests on the unchanged20/IP budget', async kind => {
    const valid = createParticipantPdfRateLimitProof(token, snapshot)
    if (kind === 'expired') vi.spyOn(Date, 'now').mockReturnValue(now + PDF_RATE_LIMIT_PROOF_TTL_SECONDS * 1000)
    const results = await Promise.all(Array.from({ length: 21 }, (_, i) => {
      const query: Record<string, string> = { token: i.toString(16).padStart(64, 'f') }
      if (kind === 'forged') query.pdfRateLimitProof = `invented-${i}`
      if (kind === 'mismatched' || kind === 'expired') query.pdfRateLimitProof = valid
      if (kind === 'expired') query.token = token
      if (kind === 'signed-forged') { delete query.token; query.reportToken = `invented-${i}` }
      return checkRequestRateLimit(request(query))
    }))
    expect(results.filter(result => result?.allowed)).toHaveLength(20)
    expect(results[20]).toMatchObject({ allowed: false, limit: 20 })
  })

  it('keeps unsigned staff/download requests on their previous IP bucket', async () => {
    const results = await Promise.all(Array.from({ length: 21 }, () => checkRequestRateLimit(request({}))))
    expect(results.filter(result => result?.allowed)).toHaveLength(20)
  })
})
