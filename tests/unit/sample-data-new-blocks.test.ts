import { describe, it, expect } from 'vitest'
import { generateSampleData, type PreviewEntity } from '@/lib/reports/sample-data'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'

const ENTITIES: PreviewEntity[] = [
  { id: 'dim-1', name: 'Thinking', type: 'dimension', pompScore: 60, description: 'Evidence-led thinking.' },
  { id: 'f-1', name: 'Analytical reasoning', type: 'factor', parentId: 'dim-1', pompScore: 78, definition: 'Breaks problems apart.', developmentSuggestion: 'Practise X.', indicatorsHigh: 'Shows strong analysis.' },
  { id: 'f-2', name: 'Judgement', type: 'factor', parentId: 'dim-1', pompScore: 38 },
  { id: 'dim-2', name: 'Leading', type: 'dimension', pompScore: 70 },
  { id: 'f-3', name: 'Strategic vision', type: 'factor', parentId: 'dim-2', pompScore: 82 },
]

function generate(blocks: Record<string, unknown>[]) {
  return generateSampleData(blocks, DEFAULT_REPORT_THEME, ENTITIES, 'Test Report')
}

describe('dimension_chapter sample data', () => {
  it('builds one chapter per dimension with its factors', () => {
    const [resolved] = generate([
      { id: 'b1', type: 'dimension_chapter', order: 0, config: { depth: 'standard' } },
    ])
    const data = resolved.data as { chapters: Array<{ dimensionName: string; factors: unknown[] }> }
    expect(data.chapters.map((c) => c.dimensionName)).toEqual(['Leading', 'Thinking'])
    expect(data.chapters[1].factors).toHaveLength(2)
  })

  it('omits descriptions at glance depth and includes indicators/development at full depth', () => {
    const [glance] = generate([
      { id: 'b1', type: 'dimension_chapter', order: 0, config: { depth: 'glance' } },
    ])
    const glanceData = glance.data as { chapters: Array<{ factors: Array<{ description: string | null; indicators: string | null }> }> }
    expect(glanceData.chapters[0].factors[0].description).toBeNull()
    expect(glanceData.chapters[0].factors[0].indicators).toBeNull()

    const [full] = generate([
      { id: 'b1', type: 'dimension_chapter', order: 0, config: { depth: 'full' } },
    ])
    const fullData = full.data as { chapters: Array<{ factors: Array<{ indicators: string | null; development: string | null }> }> }
    const analytical = fullData.chapters
      .flatMap((c) => c.factors as Array<{ entityName?: string; indicators: string | null; development: string | null }>)
      .find((f) => f.entityName === 'Analytical reasoning')
    expect(analytical?.indicators).toBe('Shows strong analysis.')
    expect(analytical?.development).toBe('Practise X.')
  })

  it('filters chapters by dimensionIds', () => {
    const [resolved] = generate([
      { id: 'b1', type: 'dimension_chapter', order: 0, config: { dimensionIds: ['dim-2'] } },
    ])
    const data = resolved.data as { chapters: Array<{ dimensionName: string }> }
    expect(data.chapters.map((c) => c.dimensionName)).toEqual(['Leading'])
  })
})

describe('contents sample data', () => {
  it('derives sections from sibling blocks with dimension scores', () => {
    const [contents] = generate([
      { id: 'b0', type: 'contents', order: 0, config: {} },
      { id: 'b1', type: 'score_overview', order: 1, config: {} },
      { id: 'b2', type: 'dimension_chapter', order: 2, config: {} },
    ])
    const data = contents.data as { sections: Array<{ label: string; kind: string; pompScore?: number }> }
    expect(data.sections.map((s) => s.label)).toEqual([
      'Your profile at a glance',
      'Leading',
      'Thinking',
    ])
    expect(data.sections[1].kind).toBe('dimension')
    expect(data.sections[1].pompScore).toBe(70)
  })
})

describe('score_overview sample data', () => {
  it('includes dimension parents and band definitions for group headers and ticks', () => {
    const [resolved] = generate([
      { id: 'b1', type: 'score_overview', order: 0, config: { displayLevel: 'factor', groupByDimension: true } },
    ])
    const data = resolved.data as { parents: Array<{ name: string; pompScore: number }>; bands: unknown[] }
    expect(data.parents.map((p) => p.name).sort()).toEqual(['Leading', 'Thinking'])
    expect(data.bands.length).toBeGreaterThanOrEqual(3)
  })

  it('carries descriptions only beyond glance depth', () => {
    const [glance] = generate([
      { id: 'b1', type: 'score_overview', order: 0, config: { displayLevel: 'factor', depth: 'glance' } },
    ])
    const glanceScores = (glance.data as { scores: Array<{ description: string | null }> }).scores
    expect(glanceScores.every((s) => s.description === null)).toBe(true)

    const [standard] = generate([
      { id: 'b1', type: 'score_overview', order: 0, config: { displayLevel: 'factor', depth: 'standard' } },
    ])
    const standardScores = (standard.data as { scores: Array<{ description: string | null }> }).scores
    expect(standardScores.some((s) => s.description)).toBe(true)
  })
})
