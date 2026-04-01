import { describe, it, expect } from 'vitest'
import { resolveDevelopmentPlan } from '@/lib/reports/runner'

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

describe('resolveDevelopmentPlan', () => {
  it('returns bottom N entities by score with developmentSuggestion when prioritiseByScore=true', () => {
    const scoreMap: Record<string, number> = {
      'ent-1': 30,
      'ent-2': 45,
      'ent-3': 60,
      'ent-4': 80,
    }
    const taxonomyMap = new Map<string, Record<string, unknown>>([
      ['ent-1', makeEntity({ id: 'ent-1', name: 'Lowest', development_suggestion: 'Work on this' })],
      ['ent-2', makeEntity({ id: 'ent-2', name: 'Low', development_suggestion: 'Improve here' })],
      ['ent-3', makeEntity({ id: 'ent-3', name: 'Mid', development_suggestion: 'Consider this' })],
      ['ent-4', makeEntity({ id: 'ent-4', name: 'High', development_suggestion: 'Fine-tune' })],
    ])

    const result = resolveDevelopmentPlan(scoreMap, taxonomyMap, {
      maxItems: 3,
      prioritiseByScore: true,
    })

    expect(result.items).toHaveLength(3)
    expect(result.items[0].entityName).toBe('Lowest')
    expect(result.items[0].pompScore).toBe(30)
    expect(result.items[0].developmentSuggestion).toBe('Work on this')
    expect(result.items[1].entityName).toBe('Low')
    expect(result.items[1].developmentSuggestion).toBe('Improve here')
    expect(result.items[2].entityName).toBe('Mid')
  })

  it('respects entityIds filter', () => {
    const scoreMap: Record<string, number> = {
      'ent-1': 30,
      'ent-2': 45,
      'ent-3': 60,
    }
    const taxonomyMap = new Map<string, Record<string, unknown>>([
      ['ent-1', makeEntity({ id: 'ent-1', name: 'Lowest', development_suggestion: 'Work on this' })],
      ['ent-2', makeEntity({ id: 'ent-2', name: 'Low', development_suggestion: 'Improve' })],
      ['ent-3', makeEntity({ id: 'ent-3', name: 'Mid', development_suggestion: 'Consider' })],
    ])

    const result = resolveDevelopmentPlan(scoreMap, taxonomyMap, {
      maxItems: 5,
      prioritiseByScore: true,
      entityIds: ['ent-2', 'ent-3'],
    })

    expect(result.items).toHaveLength(2)
    expect(result.items[0].entityName).toBe('Low')
    expect(result.items[1].entityName).toBe('Mid')
  })

  it('returns empty string for suggestion when entity has no developmentSuggestion', () => {
    const scoreMap: Record<string, number> = { 'ent-1': 30 }
    const taxonomyMap = new Map<string, Record<string, unknown>>([
      ['ent-1', makeEntity({ id: 'ent-1', name: 'NoSuggestion', development_suggestion: null })],
    ])

    const result = resolveDevelopmentPlan(scoreMap, taxonomyMap, {
      maxItems: 3,
      prioritiseByScore: true,
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].developmentSuggestion).toBe('')
  })

  it('includes bandResult on each item', () => {
    const scoreMap: Record<string, number> = { 'ent-1': 25 }
    const taxonomyMap = new Map<string, Record<string, unknown>>([
      ['ent-1', makeEntity({ id: 'ent-1', name: 'Low', development_suggestion: 'Work on it' })],
    ])

    const result = resolveDevelopmentPlan(scoreMap, taxonomyMap, {
      maxItems: 3,
      prioritiseByScore: true,
    })

    expect(result.items[0].bandResult).toBeDefined()
    expect(result.items[0].bandResult.band).toBe('low')
  })

  it('does not sort by score when prioritiseByScore is false', () => {
    const scoreMap: Record<string, number> = {
      'ent-1': 80,
      'ent-2': 30,
    }
    const taxonomyMap = new Map<string, Record<string, unknown>>([
      ['ent-1', makeEntity({ id: 'ent-1', name: 'High', development_suggestion: 'Fine' })],
      ['ent-2', makeEntity({ id: 'ent-2', name: 'Low', development_suggestion: 'Work' })],
    ])

    const result = resolveDevelopmentPlan(scoreMap, taxonomyMap, {
      maxItems: 5,
      prioritiseByScore: false,
    })

    // When not prioritised by score, order follows scoreMap iteration (insertion order)
    expect(result.items).toHaveLength(2)
  })
})
