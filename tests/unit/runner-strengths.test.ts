import { describe, it, expect } from 'vitest'
import { resolveStrengthsHighlights } from '@/lib/reports/runner'

function makeEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'ent-1',
    name: overrides.name ?? 'Entity 1',
    slug: overrides.slug ?? 'entity-1',
    definition: overrides.definition ?? 'A definition.',
    strength_commentary: overrides.strength_commentary ?? null,
    development_suggestion: overrides.development_suggestion ?? null,
    band_label_low: overrides.band_label_low ?? 'Developing',
    band_label_mid: overrides.band_label_mid ?? 'Effective',
    band_label_high: overrides.band_label_high ?? 'Highly Effective',
    pomp_threshold_low: overrides.pomp_threshold_low ?? 40,
    pomp_threshold_high: overrides.pomp_threshold_high ?? 70,
    taxonomy_level: overrides.taxonomy_level ?? 'factor',
  }
}

describe('resolveStrengthsHighlights', () => {
  it('returns top N entities ranked by POMP score descending with strengthCommentary', () => {
    const scoreMap: Record<string, number> = {
      'ent-1': 90,
      'ent-2': 75,
      'ent-3': 60,
      'ent-4': 50,
    }
    const taxonomyMap = new Map<string, Record<string, unknown>>([
      ['ent-1', makeEntity({ id: 'ent-1', name: 'Alpha', strength_commentary: 'Alpha is strong' })],
      ['ent-2', makeEntity({ id: 'ent-2', name: 'Beta', strength_commentary: 'Beta is solid' })],
      ['ent-3', makeEntity({ id: 'ent-3', name: 'Gamma', strength_commentary: 'Gamma is okay' })],
      ['ent-4', makeEntity({ id: 'ent-4', name: 'Delta', strength_commentary: 'Delta is developing' })],
    ])

    const result = resolveStrengthsHighlights(scoreMap, taxonomyMap, { topN: 3, displayLevel: 'factor' })

    expect(result.highlights).toHaveLength(3)
    expect(result.highlights[0].entityName).toBe('Alpha')
    expect(result.highlights[0].pompScore).toBe(90)
    expect(result.highlights[0].strengthCommentary).toBe('Alpha is strong')
    expect(result.highlights[1].entityName).toBe('Beta')
    expect(result.highlights[1].strengthCommentary).toBe('Beta is solid')
    expect(result.highlights[2].entityName).toBe('Gamma')
  })

  it('returns empty string for commentary when entity has no strengthCommentary', () => {
    const scoreMap: Record<string, number> = {
      'ent-1': 80,
    }
    const taxonomyMap = new Map<string, Record<string, unknown>>([
      ['ent-1', makeEntity({ id: 'ent-1', name: 'NoCommentary', strength_commentary: null })],
    ])

    const result = resolveStrengthsHighlights(scoreMap, taxonomyMap, { topN: 3, displayLevel: 'factor' })

    expect(result.highlights).toHaveLength(1)
    expect(result.highlights[0].strengthCommentary).toBe('')
  })

  it('respects displayLevel filter', () => {
    const scoreMap: Record<string, number> = {
      'ent-1': 90,
      'ent-2': 80,
    }
    const taxonomyMap = new Map<string, Record<string, unknown>>([
      ['ent-1', makeEntity({ id: 'ent-1', name: 'Factor', taxonomy_level: 'factor' })],
      ['ent-2', makeEntity({ id: 'ent-2', name: 'Dimension', taxonomy_level: 'dimension' })],
    ])

    const result = resolveStrengthsHighlights(scoreMap, taxonomyMap, { topN: 5, displayLevel: 'factor' })

    expect(result.highlights).toHaveLength(1)
    expect(result.highlights[0].entityName).toBe('Factor')
  })

  it('includes bandResult on each highlight', () => {
    const scoreMap: Record<string, number> = { 'ent-1': 85 }
    const taxonomyMap = new Map<string, Record<string, unknown>>([
      ['ent-1', makeEntity({ id: 'ent-1', name: 'High', strength_commentary: 'Strong' })],
    ])

    const result = resolveStrengthsHighlights(scoreMap, taxonomyMap, { topN: 3, displayLevel: 'factor' })

    expect(result.highlights[0].bandResult).toBeDefined()
    expect(result.highlights[0].bandResult.band).toBe('high')
    expect(result.highlights[0].bandResult.bandLabel).toBe('Highly Effective')
  })
})
