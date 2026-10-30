import { REFERENCE_FAMILIES, referenceWeightingLabel, type ReferenceOption } from './types'

export type ReferenceView = 'available' | 'review' | 'history'
export type ReferenceFilters = { search: string; geography: string; age: string; weighting: string; assessment: string }
export const EMPTY_REFERENCE_FILTERS: ReferenceFilters = { search: '', geography: '', age: '', weighting: '', assessment: '' }
export const REFERENCE_STATUS_LABELS = { draft: 'Draft', review: 'In review', active: 'Active', superseded: 'Superseded', withdrawn: 'Withdrawn' }

const countryNames: Record<string, string> = {
  USA: 'United States', UK: 'United Kingdom', Afghanist: 'Afghanistan',
  'New Zeala': 'New Zealand', 'South Afr': 'South Africa', 'South Kor': 'South Korea', Netherlan: 'Netherlands', Philippin: 'Philippines',
}
const countryAliases: Record<string, string> = {
  'United States': 'US USA America', 'United Kingdom': 'UK Britain',
  Australia: 'AU AUS', 'New Zealand': 'NZ',
}
export function referenceCountryName(country: string) { return countryNames[country] ?? country }
export function referenceAssessmentLabel(r: ReferenceOption) {
  return r.instrumentId === 'ipip-neo-120-johnson-2014' ? 'Trajectas Personality Profile' : r.instrumentId
}
export function referenceGeography(r: ReferenceOption) {
  if (!r.countryLabels?.length) return 'All countries'
  return r.countryLabels.length === 1 ? referenceCountryName(r.countryLabels[0]) : 'Multiple countries'
}
export function referenceAgeLabel(r: ReferenceOption) { return r.ageBoundsInclusive.join('–') }

/** Versions are grouped only within the same tenant and administration/scoring contract. */
export function referenceGroupIdentity(r: ReferenceOption) {
  return JSON.stringify([r.scopeClientId, r.instrumentId, r.formVersion, r.scoringVersion, r.methodVersion ?? '', r.groupKey])
}
export type ReferenceGroup = { key: string; versions: ReferenceOption[] }
export function sortReferenceVersions(versions: ReferenceOption[]) {
  const rank = { active: 0, review: 1, draft: 2, superseded: 3, withdrawn: 4 }
  return [...versions].sort((a, b) => rank[a.status] - rank[b.status] || Number(b.isDefault) - Number(a.isDefault)
    || b.version.localeCompare(a.version, 'en-AU', { numeric: true }) || a.id.localeCompare(b.id))
}
export function groupNormReferences(references: ReferenceOption[]): ReferenceGroup[] {
  const groups = new Map<string, ReferenceOption[]>()
  for (const reference of references) {
    const key = referenceGroupIdentity(reference)
    const versions = groups.get(key) ?? []
    versions.push(reference)
    groups.set(key, versions)
  }
  return Array.from(groups, ([key, versions]) => ({ key, versions: sortReferenceVersions(versions) }))
    .sort((a, b) => Number(b.versions.some(r => r.isDefault)) - Number(a.versions.some(r => r.isDefault))
      || a.versions[0].name.localeCompare(b.versions[0].name, 'en-AU') || a.key.localeCompare(b.key))
}
export function referenceMatchesView(r: ReferenceOption, view: ReferenceView) {
  return view === 'available' ? r.status === 'active' : view === 'review' ? r.status === 'draft' || r.status === 'review' : r.status === 'superseded' || r.status === 'withdrawn'
}

function searchWords(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean)
}
export function matchesReferenceFilters(r: ReferenceOption, filters: ReferenceFilters) {
  if (filters.geography && referenceGeography(r) !== filters.geography) return false
  if (filters.age && referenceAgeLabel(r) !== filters.age) return false
  if (filters.weighting && r.weighting !== filters.weighting) return false
  if (filters.assessment === 'unassigned' && r.assessments?.length) return false
  if (filters.assessment && filters.assessment !== 'unassigned' && !r.assessments?.some(a => a.id === filters.assessment)) return false
  const terms = searchWords(filters.search)
  if (!terms.length) return true
  const countries = (r.countryLabels ?? []).map(referenceCountryName)
  const words = searchWords([
    r.name, referenceAssessmentLabel(r), ...(r.assessments ?? []).map(a => a.title), REFERENCE_FAMILIES[r.family] ?? r.family,
    referenceGeography(r), ...countries, ...countries.map(c => countryAliases[c] ?? ''),
    referenceAgeLabel(r), referenceWeightingLabel(r.weighting), r.version, REFERENCE_STATUS_LABELS[r.status],
  ].join(' '))
  return terms.every(term => words.some(word => word.startsWith(term)))
}
export function referenceFilterOptions(references: ReferenceOption[]) {
  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'en-AU', { numeric: true }))
  const assessments = new Map(references.flatMap(r => (r.assessments ?? []).map(a => [a.id, a.title] as const)))
  return {
    geography: unique(references.map(referenceGeography)).map(value => ({ value, label: value })),
    age: unique(references.map(referenceAgeLabel)).map(value => ({ value, label: `Ages ${value}` })),
    weighting: unique(references.map(r => r.weighting)).map(value => ({ value, label: referenceWeightingLabel(value) })),
    assessment: [...assessments].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'en-AU'))
      .concat(references.some(r => r.assessments && !r.assessments.length) ? [{ value: 'unassigned', label: 'Not assigned to an assessment' }] : []),
  }
}
