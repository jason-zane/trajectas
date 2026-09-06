import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const MAX_AGE_SECONDS = 4 * 60 * 60
type SessionProof = { sessionId: string; tokenHash: string; expiresAt: number }
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** Mint ONLY after checking participant token → session ownership. This is a
 * narrow rate-limit credential, never a replacement for API authorization. */
export function createAssessSessionProof(token: string, sessionId: string): string | undefined {
  const secret = process.env.INTERNAL_API_KEY
  if (!secret) return undefined
  const payload = Buffer.from(JSON.stringify({ sessionId, tokenHash: hashToken(token),
    expiresAt: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS })).toString('base64url')
  const signature = createHmac('sha256', secret).update(`assess-session-v1:${payload}`).digest('base64url')
  return `${payload}.${signature}`
}

export function getAssessSessionProof(request: Request): string | null {
  return request.headers.get('x-assess-session-proof') ?? new URL(request.url).searchParams.get('sessionProof')
}

export function verifyAssessSessionProof(
  proof: string | null,
  binding?: { token: string; sessionId: string },
): SessionProof | null {
  const secret = process.env.INTERNAL_API_KEY
  if (!secret || !proof || proof.length > 1024) return null
  const [payload, signature, extra] = proof.split('.')
  if (!payload || !signature || extra !== undefined) return null
  try {
    const actual = Buffer.from(signature, 'base64url')
    const expected = createHmac('sha256', secret).update(`assess-session-v1:${payload}`).digest()
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionProof
    const now = Math.floor(Date.now() / 1000)
    if (!/^[0-9a-f-]{36}$/i.test(value.sessionId) || !/^[0-9a-f]{64}$/.test(value.tokenHash)
      || !Number.isInteger(value.expiresAt) || value.expiresAt <= now
      || value.expiresAt > now + MAX_AGE_SECONDS) return null
    if (binding && (value.sessionId !== binding.sessionId || value.tokenHash !== hashToken(binding.token))) return null
    return value
  } catch { return null }
}
