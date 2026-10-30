/** Explicit runtime allowlist mirrored by the reviewed database guard. */
export const PERSONALITY_REFERENCE_REPORT_SLUGS = ['ipip-reference-comparison', 'trajectas-personality-standard-v1'] as const
export function isPersonalityReferenceReport(slug: string | null | undefined): boolean {
  return Boolean(slug && (PERSONALITY_REFERENCE_REPORT_SLUGS as readonly string[]).includes(slug))
}
export function requiresPersonalityReference(slug: string | null | undefined): boolean {
  return slug === 'trajectas-personality-standard-v1'
}
