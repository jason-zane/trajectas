import { describe, it, expect } from 'vitest'
import { generateSampleData } from '@/lib/reports/sample-data'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'
import type { BlockConfig } from '@/lib/reports/types'

function makeBlock(overrides: Partial<BlockConfig> & { type: BlockConfig['type'] }): BlockConfig {
  return {
    id: 'test-1',
    order: 0,
    config: {},
    ...overrides,
  } as BlockConfig
}

describe('generateSampleData', () => {
  it('respects topN on strengths block', () => {
    const blocks = [makeBlock({ type: 'strengths_highlights', config: { topN: 5, displayLevel: 'factor' } })]
    const result = generateSampleData(blocks, DEFAULT_REPORT_THEME)
    const strengthsData = result.find(b => b.type === 'strengths_highlights')
    expect(strengthsData).toBeDefined()
    const highlights = (strengthsData!.data as any).highlights
    expect(highlights).toHaveLength(5)
  })

  it('respects maxItems on development block', () => {
    const blocks = [makeBlock({ type: 'development_plan', config: { maxItems: 4, prioritiseByScore: true } })]
    const result = generateSampleData(blocks, DEFAULT_REPORT_THEME)
    const devData = result.find(b => b.type === 'development_plan')
    expect(devData).toBeDefined()
    const items = (devData!.data as any).items
    expect(items).toHaveLength(4)
  })

  it('generates placeholder for AI Text block', () => {
    const blocks = [makeBlock({ type: 'ai_text', config: { promptId: 'test-prompt' } })]
    const result = generateSampleData(blocks, DEFAULT_REPORT_THEME)
    const aiData = result.find(b => b.type === 'ai_text')
    expect(aiData).toBeDefined()
    expect((aiData!.data as any).isPreview).toBe(true)
    expect((aiData!.data as any).generatedText).toContain('AI-generated')
  })

  it('includes strengthCommentary in sample highlights', () => {
    const blocks = [makeBlock({ type: 'strengths_highlights', config: { topN: 3, displayLevel: 'factor' } })]
    const result = generateSampleData(blocks, DEFAULT_REPORT_THEME)
    const highlights = (result.find(b => b.type === 'strengths_highlights')!.data as any).highlights
    expect(highlights[0].strengthCommentary).toBeDefined()
    expect(highlights[0].strengthCommentary.length).toBeGreaterThan(0)
  })

  it('includes developmentSuggestion in sample items', () => {
    const blocks = [makeBlock({ type: 'development_plan', config: { maxItems: 2, prioritiseByScore: true } })]
    const result = generateSampleData(blocks, DEFAULT_REPORT_THEME)
    const items = (result.find(b => b.type === 'development_plan')!.data as any).items
    expect(items[0].developmentSuggestion).toBeDefined()
    expect(items[0].developmentSuggestion.length).toBeGreaterThan(0)
  })
})
