import { createHmac, timingSafeEqual } from 'node:crypto'

interface PreviewPdfTokenPayload {
  purpose: 'preview_pdf'
  templateId: string
  assessmentId: string
  exp: number
}

function getSigningSecret() {
  const secret =
    process.env.REPORT_PDF_TOKEN_SECRET ??
    process.env.TRAJECTAS_CONTEXT_SECRET ??
    process.env.INTERNAL_API_KEY
  if (!secret) {
    throw new Error(
      'REPORT_PDF_TOKEN_SECRET (or TRAJECTAS_CONTEXT_SECRET / INTERNAL_API_KEY) must be set for PDF token signing.',
    )
  }
  return secret
}

function signPayload(payload: string) {
  return createHmac('sha256', getSigningSecret()).update(payload).digest('base64url')
}

export function createPreviewPdfToken(
  templateId: string,
  assessmentId: string,
  ttlSeconds = 300,
) {
  const payload = Buffer.from(
    JSON.stringify({
      purpose: 'preview_pdf',
      templateId,
      assessmentId,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    } satisfies PreviewPdfTokenPayload),
  ).toString('base64url')
  return `${payload}.${signPayload(payload)}`
}

export function verifyPreviewPdfToken(
  token: string | null | undefined,
  templateId: string,
  assessmentId: string,
) {
  if (!token) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false

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
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as PreviewPdfTokenPayload
    return (
      decoded.purpose === 'preview_pdf' &&
      decoded.templateId === templateId &&
      decoded.assessmentId === assessmentId &&
      decoded.exp > Math.floor(Date.now() / 1000)
    )
  } catch {
    return false
  }
}
