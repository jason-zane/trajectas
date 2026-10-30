import { describe, expect, it } from 'vitest'
import { EMPTY_REFERENCE_FILTERS, groupNormReferences, matchesReferenceFilters, referenceFilterOptions, referenceMatchesView } from '@/lib/norms/catalog'
import { referenceOption } from '../fixtures/norm-reference-options'

describe('norm group catalog', () => {
  it('groups preparation drafts with their active version without changing either record', () => {
    const active = referenceOption()
    const draft = referenceOption({ id: 'australia-draft', version: 'draft-v1', status: 'draft' })
    const before = JSON.stringify([draft, active])
    const groups = groupNormReferences([draft, active])
    expect(groups).toHaveLength(1)
    expect(groups[0].versions).toEqual([active, draft])
    expect(JSON.stringify([draft, active])).toBe(before)
    expect(groups[0].versions.filter(r => referenceMatchesView(r, 'available'))).toEqual([active])
    expect(groups[0].versions.filter(r => referenceMatchesView(r, 'review'))).toEqual([draft])
  })

  it.each(['scopeClientId', 'instrumentId', 'formVersion', 'scoringVersion', 'methodVersion', 'groupKey'] as const)('keeps distinct %s contracts separate despite matching names and distributions', field => {
    expect(groupNormReferences([referenceOption(), referenceOption({ id: 'different-contract', [field]: 'other' })])).toHaveLength(2)
  })

  it('keeps all active and historical versions and puts the assessment default first', () => {
    const references = [referenceOption(), referenceOption({ id: 'older', status: 'superseded', version: 'v1' }),
      referenceOption({ id: 'newer', version: 'v10' }), referenceOption({ id: 'default', groupKey: 'all-countries', name: 'Z default', isDefault: true })]
    const groups = groupNormReferences(references)
    expect(groups[0].versions[0].id).toBe('default')
    expect(new Set(groups.flatMap(g => g.versions.map(r => r.id)))).toEqual(new Set(references.map(r => r.id)))
    expect(referenceMatchesView(references[1], 'history')).toBe(true)
    expect(referenceMatchesView(referenceOption({ status: 'withdrawn' }), 'history')).toBe(true)
  })

  it.each(['Australia 18-64', 'aus 18–64', 'AU equally 18', 'personality Australia'])('searches readable metadata across fields: %s', search => {
    expect(matchesReferenceFilters(referenceOption(), { ...EMPTY_REFERENCE_FILTERS, search })).toBe(true)
  })

  it('normalises country names/aliases and avoids incidental substring matches', () => {
    const us = referenceOption({ name: 'US cohort', countryLabels: ['USA'] })
    expect(matchesReferenceFilters(us, { ...EMPTY_REFERENCE_FILTERS, search: 'United States 18–64' })).toBe(true)
    expect(matchesReferenceFilters(us, { ...EMPTY_REFERENCE_FILTERS, search: 'USA' })).toBe(true)
    expect(matchesReferenceFilters(referenceOption(), { ...EMPTY_REFERENCE_FILTERS, search: 'US' })).toBe(false)
    const nz = referenceOption({ name: 'NZ cohort', countryLabels: ['New Zeala'] })
    expect(matchesReferenceFilters(nz, { ...EMPTY_REFERENCE_FILTERS, search: 'New Zealand' })).toBe(true)
    const korea = referenceOption({ name: 'Korean cohort', countryLabels: ['South Kor'] })
    expect(referenceFilterOptions([korea]).geography).toEqual([{ value: 'South Korea', label: 'South Korea' }])
    expect(matchesReferenceFilters(korea, { ...EMPTY_REFERENCE_FILTERS, search: 'South Korea' })).toBe(true)
  })

  it('combines exact geography, age and weighting filters without treating age-weighted groups as country samples', () => {
    const filters = { ...EMPTY_REFERENCE_FILTERS, geography: 'Australia', age: '18–64', weighting: 'pooled' }
    expect(matchesReferenceFilters(referenceOption(), filters)).toBe(true)
    expect(matchesReferenceFilters(referenceOption({ ageBoundsInclusive: [25, 64] }), filters)).toBe(false)
    expect(matchesReferenceFilters(referenceOption({ countryLabels: ['Australia', 'USA'] }), filters)).toBe(false)
    expect(matchesReferenceFilters(referenceOption({ countryLabels: null }), filters)).toBe(false)
    expect(matchesReferenceFilters(referenceOption({ weighting: 'equal-country' }), filters)).toBe(false)
    expect(referenceFilterOptions([referenceOption(), referenceOption({ countryLabels: ['USA'], weighting: 'equal-country' })]).geography).toEqual([{ value: 'Australia', label: 'Australia' }, { value: 'United States', label: 'United States' }])
  })

  it('filters by actual assessment assignments even when two assessments use the same instrument', () => {
    const first = referenceOption({ assessments: [{ id: 'first', title: 'Personality for development', isDefault: false }] })
    const second = referenceOption({ assessments: [{ id: 'second', title: 'Personality for recruitment', isDefault: false }] })
    const filters = { ...EMPTY_REFERENCE_FILTERS, assessment: 'first' }
    expect(matchesReferenceFilters(first, filters)).toBe(true)
    expect(matchesReferenceFilters(second, filters)).toBe(false)
    expect(matchesReferenceFilters(first, { ...filters, search: 'development' })).toBe(true)
    expect(referenceFilterOptions([first, second]).assessment).toEqual([{ value: 'first', label: 'Personality for development' }, { value: 'second', label: 'Personality for recruitment' }])
    expect(matchesReferenceFilters(referenceOption({ assessments: [] }), { ...EMPTY_REFERENCE_FILTERS, assessment: 'unassigned' })).toBe(true)
  })
})
