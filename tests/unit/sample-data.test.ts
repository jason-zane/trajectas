import { describe, it, expect } from 'vitest'
import { generateSampleData } from '@/lib/reports/sample-data'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'
import type { BlockConfig, ResolvedBlockData } from '@/lib/reports/types'

function makeBlock(overrides: Partial<BlockConfig> & { type: BlockConfig['type'] }): BlockConfig {
  return {
    id: 'test-1',
    order: 0,
    config: {},
    ...overrides,
  } as BlockConfig
}

type StrengthsHighlightsSample = {
  highlights: Array<{ strengthCommentary: string }>
}

type DevelopmentPlanSample = {
  items: Array<{ developmentSuggestion: string }>
}

type AiTextSample = {
  isPreview: boolean
  generatedText: string
}

function getBlockData<T>(
  blocks: ResolvedBlockData[],
  type: BlockConfig['type']
): T {
  const block = blocks.find((entry) => entry.type === type)
  expect(block).toBeDefined()
  return block!.data as T
}

describe('generateSampleData', () => {
  it('respects topN on strengths block', () => {
    const blocks = [makeBlock({ type: 'strengths_highlights', config: { topN: 5, displayLevel: 'factor' } })]
    const result = generateSampleData(blocks, DEFAULT_REPORT_THEME)
    const highlights = getBlockData<StrengthsHighlightsSample>(
      result,
      'strengths_highlights'
    ).highlights
    expect(highlights).toHaveLength(5)
  })

  it('respects maxItems on development block', () => {
    const blocks = [makeBlock({ type: 'development_plan', config: { maxItems: 4, prioritiseByScore: true } })]
    const result = generateSampleData(blocks, DEFAULT_REPORT_THEME)
    const items = getBlockData<DevelopmentPlanSample>(
      result,
      'development_plan'
    ).items
    expect(items).toHaveLength(4)
  })

  it('generates placeholder for AI Text block', () => {
    const blocks = [makeBlock({ type: 'ai_text', config: { promptId: 'test-prompt' } })]
    const result = generateSampleData(blocks, DEFAULT_REPORT_THEME)
    const aiData = getBlockData<AiTextSample>(result, 'ai_text')
    expect(aiData.isPreview).toBe(true)
    expect(aiData.generatedText).toContain('AI-generated')
  })

  it('includes strengthCommentary in sample highlights', () => {
    const blocks = [makeBlock({ type: 'strengths_highlights', config: { topN: 3, displayLevel: 'factor' } })]
    const result = generateSampleData(blocks, DEFAULT_REPORT_THEME)
    const highlights = getBlockData<StrengthsHighlightsSample>(
      result,
      'strengths_highlights'
    ).highlights
    expect(highlights[0].strengthCommentary).toBeDefined()
    expect(highlights[0].strengthCommentary.length).toBeGreaterThan(0)
  })

  it('includes developmentSuggestion in sample items', () => {
    const blocks = [makeBlock({ type: 'development_plan', config: { maxItems: 2, prioritiseByScore: true } })]
    const result = generateSampleData(blocks, DEFAULT_REPORT_THEME)
    const items = getBlockData<DevelopmentPlanSample>(
      result,
      'development_plan'
    ).items
    expect(items[0].developmentSuggestion).toBeDefined()
    expect(items[0].developmentSuggestion.length).toBeGreaterThan(0)
  })
})
