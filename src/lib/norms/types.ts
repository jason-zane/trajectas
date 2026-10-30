export type ReferenceStatus = 'draft' | 'review' | 'active' | 'superseded' | 'withdrawn'
export type ReferenceOption = {
  id: string; name: string; version: string; groupKey: string; instrumentId: string
  formVersion: string; scoringVersion: string; family: string; status: ReferenceStatus
  rawN: number; effectiveN: number; ageBoundsInclusive: [number, number]
  countryLabels: string[] | null; weighting: string; isDefault: boolean
  methodVersion?: string; provenance?: { collectionPeriod?: string; population?: string; sourceUrl?: string; attribution?: string; previousVersionId?: string; intendedUse?: string }
  scopeClientId: string | null; reviewEvidence: Record<string, string>
}
export type ReferenceInterpretation = {
  schemaVersion: 'reference-interpretation-v1'
  reference: {
    id: string; name: string; version: string; groupKey: string; methodVersion: string
    artifactSha256: string; rawN: number; effectiveN: number
    ageBoundsInclusive: [number, number]; countryLabels: string[] | null; weighting: string
    provenance: { collectionPeriod?: string; population?: string; [key: string]: unknown }
  }
  scores: Record<string, {
    nativeRawSum: number; displayPomp: number; displayName: string; scientificName: string
    direction: 'original' | 'reversed'; nativePercentile: number; displayPercentile: number; tiedPercent: number
  }>
}
export const REFERENCE_FAMILIES: Record<string, string> = {
  'general-adult': 'General adult', 'western-adult': 'Western adult', 'country-adult': 'Country',
  'management-age': 'Management age profile', 'experienced-adult': 'Experienced adult', 'full-source': 'Full source',
}
export function referenceWeightingLabel(weighting: string): string {
  return ({ pooled: 'Each response equally', 'equal-country': 'Equal country shares', 'us-management-age': 'US management age profile', 'equal-country-and-us-management-age': 'Equal countries and US management age profile' } as Record<string, string>)[weighting] ?? weighting
}
