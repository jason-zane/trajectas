import presentation from './presentation.json'
import fixture from './preview-fixture.json'
import { DEFAULT_PERSONALITY_HEADLINE, parsePersonalityPresentation, personalityPresentation } from './presentation-config'

export const PERSONALITY_REPORT_SLUG = 'trajectas-personality-standard-v1'
export const PERSONALITY_INSTRUMENT_ID = 'ipip-neo-120-johnson-2014'

export type TraitPresentation = (typeof presentation)[number]['facets'][number]
export type PersonalityTrait = TraitPresentation & { percentile: number }
export type PersonalityDimension = Omit<(typeof presentation)[number], 'facets'> & {
  percentile: number
  facets: PersonalityTrait[]
}
export interface PersonalityReportData {
  version: 1
  participantName: string
  assessedAt: string
  reference: { id: string; version: string; method: string; label: string; ageBoundsInclusive?: [number, number]; weighting?: string; population?: string; artifactSha256?: string; rawN?: number; effectiveN?: number; attribution?: string; sourceUrl?: string; intendedUse?: string }
  editionNumber?: number
  coverHeadline?: string
  dimensions: PersonalityDimension[]
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Normed personality results are required for this report.')
  }
  return value as Record<string, unknown>
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing personality norm provenance.')
  return value
}

/** Consumes explicit display-oriented percentiles. Never derives them from POMP,
 * averages facet ranks, or reverses an already oriented percentile a second time.
 * The frozen-reference adapter supplies this separate presentation contract.
 */
export function buildPersonalityReportData(
  input: unknown,
  participantName: string,
  assessedAt: string,
  presentationConfig?: unknown,
): PersonalityReportData {
  const result = record(input)
  if (result.instrumentId !== PERSONALITY_INSTRUMENT_ID || result.primaryMetric !== 'percentile') {
    throw new Error('This template requires normed IPIP-NEO-120 percentiles. Scale scores cannot be substituted.')
  }
  const norm = record(result.normReference)
  const reference = {
    id: requiredString(norm.id), version: requiredString(norm.version),
    method: requiredString(norm.method), label: typeof norm.label === 'string' && norm.label.trim() ? norm.label : 'Peers',
  }
  const dimensions = record(result.dimensions), facets = record(result.facets)
  if (Object.keys(dimensions).length !== 5 || Object.keys(facets).length !== 30) {
    throw new Error('The complete five-dimension, 30-trait personality profile is required.')
  }
  function percentile(code: string, name: string, reversed: boolean, source: Record<string, unknown>) {
    const scale = record(source[code])
    if (scale.displayName !== name || scale.direction !== (reversed ? 'reversed' : 'original')) {
      throw new Error(`Personality display direction or name does not match: ${code}`)
    }
    const value = record(scale.display).percentile
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`Missing or invalid normed percentile: ${code}`)
    }
    return Math.round(value)
  }
  if (!participantName.trim() || !Number.isFinite(Date.parse(assessedAt))) {
    throw new Error('Participant identity and assessment date are required.')
  }
  return {
    version: 1, participantName, assessedAt, reference,
    coverHeadline: parsePersonalityPresentation(presentationConfig).coverHeadline ?? DEFAULT_PERSONALITY_HEADLINE,
    dimensions: personalityPresentation(presentationConfig).map(d => ({
      ...d, percentile: percentile(d.code, presentation.find(p => p.code === d.code)!.name, false, dimensions),
      facets: d.facets.map(f => ({ ...f, percentile: percentile(f.code, presentation.find(p => p.code === d.code)!.facets.find(p => p.code === f.code)!.name, f.reversed, facets) })),
    })),
  }
}

/** Authoring preview only. This is never called by live report generation. */
export function buildPersonalityPreviewData(presentationConfig?: unknown): PersonalityReportData {
  const percentiles: Readonly<Record<string, number>> = fixture.percentiles
  return {
    version: 1, participantName: fixture.participantName, assessedAt: fixture.assessedAt,
    reference: { id: 'design-preview', version: 'preview-v1', method: 'synthetic-design-fixture', label: 'SYNTHETIC design reference — preview only' },
    editionNumber: 1, coverHeadline: parsePersonalityPresentation(presentationConfig).coverHeadline ?? DEFAULT_PERSONALITY_HEADLINE,
    dimensions: personalityPresentation(presentationConfig).map(d => ({ ...d, percentile: percentiles[d.code],
      facets: d.facets.map(f => ({ ...f, percentile: percentiles[f.code] })),
    })),
  }
}
