import 'server-only'

const LEGACY_FALLBACK_SECRET_NAMES = [
  'TRAJECTAS_CONTEXT_SECRET',
  'INTERNAL_API_KEY',
] as const

function readSecret(name: string) {
  const value = process.env[name]?.trim()
  return value ? value : null
}

function getDedicatedSecret(name: string, purpose: string) {
  const dedicated = readSecret(name)
  if (dedicated) return dedicated

  if (process.env.NODE_ENV !== 'production') {
    for (const fallbackName of LEGACY_FALLBACK_SECRET_NAMES) {
      const fallback = readSecret(fallbackName)
      if (fallback) return fallback
    }
  }

  throw new Error(
    `${name} must be set for ${purpose}. Dedicated signing secrets are required in production; do not reuse TRAJECTAS_CONTEXT_SECRET or INTERNAL_API_KEY.`
  )
}

export function getReportAccessTokenSecret() {
  return getDedicatedSecret('REPORT_ACCESS_TOKEN_SECRET', 'report access token signing')
}

export function getReportPdfTokenSecret() {
  return getDedicatedSecret('REPORT_PDF_TOKEN_SECRET', 'report PDF token signing')
}
