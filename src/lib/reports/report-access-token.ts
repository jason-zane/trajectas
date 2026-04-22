import { createHmac, timingSafeEqual } from 'node:crypto'

interface ReportAccessTokenPayload {
  purpose: 'report_access'
  snapshotId: string
  participantId: string
  exp: number
}

function getSigningSecret() {
  const secret =
    process.env.REPORT_ACCESS_TOKEN_SECRET ??
    process.env.REPORT_PDF_TOKEN_SECRET ??
    process.env.TRAJECTAS_CONTEXT_SECRET ??
    process.env.INTERNAL_API_KEY

  if (!secret) {
    throw new Error(
      'REPORT_ACCESS_TOKEN_SECRET (or REPORT_PDF_TOKEN_SECRET / TRAJECTAS_CONTEXT_SECRET / INTERNAL_API_KEY) must be set for report access token signing.'
    )
  }

  return secret
}

function signPayload(payload: string) {
  return createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('base64url')
}

// 48 hours. Short window keeps a leaked URL (forwarded email, browser
// history, referrer) from granting indefinite access. Participants who hit
// an expired link can self-serve a fresh one via /assess/report-expired.
export const REPORT_ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 48

export function createReportAccessToken(
  snapshotId: string,
  participantId: string,
  ttlSeconds: number = REPORT_ACCESS_TOKEN_TTL_SECONDS,
) {
  const payload = Buffer.from(
    JSON.stringify({
      purpose: 'report_access',
      snapshotId,
      participantId,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    } satisfies ReportAccessTokenPayload)
  ).toString('base64url')

  return `${payload}.${signPayload(payload)}`
}

export function verifyReportAccessToken(
  token: string | null | undefined,
  snapshotId: string
): { participantId: string } | null {
  if (!token) {
    return null
  }

  const [payload, signature] = token.split('.')
  if (!payload || !signature) {
    return null
  }

  const expectedSignature = signPayload(payload)
  const expectedBuffer = Buffer.from(expectedSignature)
  const actualBuffer = Buffer.from(signature)

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as ReportAccessTokenPayload

    if (
      decoded.purpose !== 'report_access' ||
      decoded.snapshotId !== snapshotId ||
      decoded.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null
    }

    return { participantId: decoded.participantId }
  } catch {
    return null
  }
}
