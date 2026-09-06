import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { verifyReportAccessToken } from '@/lib/reports/report-access-token'
import { getReportAccessTokenSecret } from '@/lib/reports/token-secrets'

export const PDF_RATE_LIMIT_PROOF_TTL_SECONDS = 60 * 60
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
type PdfRateLimitProof = { snapshotId: string; tokenHash: string; expiresAt: number }

function signature(payload: string) {
  return createHmac('sha256', getReportAccessTokenSecret())
    .update(`report-pdf-rate-limit-v1:${payload}`).digest()
}

/** Mint only after the participant has been authorised to view this released
 * snapshot. This proof grants a rate-limit bucket, never report access. */
export function createParticipantPdfRateLimitProof(token: string, snapshotId: string): string {
  const payload = Buffer.from(JSON.stringify({
    snapshotId, tokenHash: hashToken(token),
    expiresAt: Math.floor(Date.now() / 1000) + PDF_RATE_LIMIT_PROOF_TTL_SECONDS,
  } satisfies PdfRateLimitProof)).toString('base64url')
  return `${payload}.${signature(payload).toString('base64url')}`
}

export function verifyParticipantPdfRateLimitProof(
  proof: string | null,
  binding: { token: string; snapshotId: string },
): PdfRateLimitProof | null {
  if (!proof || proof.length > 1024 || !binding.token || binding.token.length > 256) return null
  const [payload, encodedSignature, extra] = proof.split('.')
  if (!payload || !encodedSignature || extra !== undefined) return null
  try {
    const actual = Buffer.from(encodedSignature, 'base64url')
    const expected = signature(payload)
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PdfRateLimitProof
    const now = Math.floor(Date.now() / 1000)
    if (!UUID.test(value.snapshotId) || !/^[0-9a-f]{64}$/.test(value.tokenHash)
      || !Number.isInteger(value.expiresAt) || value.expiresAt <= now
      || value.expiresAt > now + PDF_RATE_LIMIT_PROOF_TTL_SECONDS
      || value.snapshotId !== binding.snapshotId || value.tokenHash !== hashToken(binding.token)) return null
    return value
  } catch { return null }
}

/** Cheap local verification in the Node proxy. The PDF route still performs
 * its database ownership/release/revocation checks for every download. */
export function getVerifiedPdfRateLimitIdentity(url: URL): string | null {
  const match = /^\/api\/reports\/([^/]+)\/pdf$/.exec(url.pathname)
  const snapshotId = match?.[1]
  if (!snapshotId || !UUID.test(snapshotId)) return null

  // Match GET's precedence: a raw participant token must carry its own bound
  // proof. An unrelated signed reportToken must not lend it another bucket.
  const token = url.searchParams.get('token')
  if (token) {
    const proof = verifyParticipantPdfRateLimitProof(url.searchParams.get('pdfRateLimitProof'), { token, snapshotId })
    return proof ? `participant:${proof.tokenHash}:${snapshotId}` : null
  }

  const reportToken = url.searchParams.get('reportToken')
  if (!reportToken || reportToken.length > 2048) return null
  try {
    const grant = verifyReportAccessToken(reportToken, snapshotId)
    return grant && UUID.test(grant.participantId) ? `report:${grant.participantId}:${snapshotId}` : null
  } catch { return null }
}
