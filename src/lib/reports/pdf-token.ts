import { createHmac, timingSafeEqual } from 'node:crypto'
import { getReportPdfTokenSecret } from '@/lib/reports/token-secrets'

interface ReportPdfTokenPayload {
  purpose: 'report_pdf'
  snapshotId: string
  exp: number
}

interface InstrumentReportPdfTokenPayload {
  purpose: 'instrument_report_pdf'
  buildId: string
  exp: number
}

function signPayload(payload: string) {
  return createHmac('sha256', getReportPdfTokenSecret())
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

export function createInstrumentReportPdfToken(buildId: string, ttlSeconds = 300) {
  const payload = Buffer.from(
    JSON.stringify({
      purpose: 'instrument_report_pdf',
      buildId,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    } satisfies InstrumentReportPdfTokenPayload)
  ).toString('base64url')

  return `${payload}.${signPayload(payload)}`
}

export function verifyInstrumentReportPdfToken(
  token: string | null | undefined,
  buildId: string
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
    ) as InstrumentReportPdfTokenPayload

    return (
      decoded.purpose === 'instrument_report_pdf' &&
      decoded.buildId === buildId &&
      decoded.exp > Math.floor(Date.now() / 1000)
    )
  } catch {
    return false
  }
}
