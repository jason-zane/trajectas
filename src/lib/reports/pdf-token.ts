import { createHmac, timingSafeEqual } from 'node:crypto'

interface ReportPdfTokenPayload {
  purpose: 'report_pdf'
  snapshotId: string
  exp: number
}

function getSigningSecret() {
  const secret = process.env.TRAJECTAS_CONTEXT_SECRET ?? process.env.INTERNAL_API_KEY

  if (!secret) {
    throw new Error(
      'TRAJECTAS_CONTEXT_SECRET or INTERNAL_API_KEY must be set for PDF token signing.'
    )
  }

  return secret
}

function signPayload(payload: string) {
  return createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('base64url')
}

export function createReportPdfToken(snapshotId: string, ttlSeconds = 300) {
  const payload = Buffer.from(
    JSON.stringify({
      purpose: 'report_pdf',
      snapshotId,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    } satisfies ReportPdfTokenPayload)
  ).toString('base64url')

  return `${payload}.${signPayload(payload)}`
}

export function verifyReportPdfToken(
  token: string | null | undefined,
  snapshotId: string
) {
  if (!token) {
    return false
  }

  const [payload, signature] = token.split('.')
  if (!payload || !signature) {
    return false
  }

  const expectedSignature = signPayload(payload)
  const expectedBuffer = Buffer.from(expectedSignature)
  const actualBuffer = Buffer.from(signature)

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return false
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as ReportPdfTokenPayload

    return (
      decoded.purpose === 'report_pdf' &&
      decoded.snapshotId === snapshotId &&
      decoded.exp > Math.floor(Date.now() / 1000)
    )
  } catch {
    return false
  }
}
