import { describe, it, expect } from 'vitest'
import { BLOCK_REGISTRY, BLOCK_CATEGORIES } from '@/lib/reports/registry'

describe('BLOCK_REGISTRY', () => {
  it('has all expected block types', () => {
    const types = Object.keys(BLOCK_REGISTRY)
    expect(types).toContain('cover_page')
    expect(types).toContain('custom_text')
    expect(types).toContain('section_divider')
    expect(types).toContain('score_overview')
    expect(types).toContain('score_detail')
    expect(types).toContain('strengths_highlights')
    expect(types).toContain('development_plan')
    expect(types).toContain('ai_text')
  })

  it('strengths_highlights has no supportedCharts', () => {
    expect(BLOCK_REGISTRY.strengths_highlights.supportedCharts).toBeUndefined()
  })

  it('development_plan has no supportedCharts', () => {
    expect(BLOCK_REGISTRY.development_plan.supportedCharts).toBeUndefined()
  })

  it('ai_text has no supportedCharts', () => {
    expect(BLOCK_REGISTRY.ai_text.supportedCharts).toBeUndefined()
  })

  it('score_overview has exactly 4 chart types', () => {
    expect(BLOCK_REGISTRY.score_overview.supportedCharts).toEqual(['bar', 'radar', 'gauges', 'scorecard'])
  })

  it('cover_page has fixed featured mode', () => {
    expect(BLOCK_REGISTRY.cover_page.supportedModes).toEqual(['featured'])
  })

  it('section_divider has no modes', () => {
    expect(BLOCK_REGISTRY.section_divider.supportedModes).toEqual([])
  })
})

describe('BLOCK_CATEGORIES', () => {
  it('includes ai category', () => {
    expect(BLOCK_CATEGORIES).toHaveProperty('ai')
    expect(BLOCK_CATEGORIES.ai.label).toBe('AI Content')
    expect(BLOCK_CATEGORIES.ai.order).toBe(3.5)
  })
})
