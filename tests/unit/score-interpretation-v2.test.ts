import { describe, it, expect } from 'vitest'
import { generateSampleData } from '@/lib/reports/sample-data'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'

describe('generateSampleData — score_interpretation_v2', () => {
  const blocks = [{
    id: 'b1',
    type: 'score_interpretation_v2',
    order: 0,
    config: {
      displayLevel: 'factor',
      groupByDimension: true,
      showScore: true,
      showBandLabel: true,
      showAnchors: true,
    },
  }]
  const entities = [
    { id: 'd1', name: 'Cognitive Agility', type: 'dimension' as const, pompScore: 72, anchorLow: 'Low dim', anchorHigh: 'High dim' },
    { id: 'f1', name: 'Abstract Reasoning', type: 'factor' as const, parentId: 'd1', pompScore: 68 },
    { id: 'f2', name: 'Pattern Recognition', type: 'factor' as const, parentId: 'd1', pompScore: 84 },
  ]

  it('resolves groups with v2 config shape (split anchor toggles)', () => {
    const [result] = generateSampleData(blocks as never, DEFAULT_REPORT_THEME, entities, 'Test')
    const data = result.data as {
      groups: Array<{ groupName: string | null; groupEntity: unknown; entities: unknown[] }>
      config: Record<string, unknown>
      bands: unknown[]
    }
    expect(data.groups).toHaveLength(1)
    expect(data.groups[0].groupName).toBe('Cognitive Agility')
    expect(data.groups[0].entities).toHaveLength(2)
    // v2 config has unified anchor toggle
    expect(data.config.showAnchors).toBe(true)
    // v2 includes bands array for tick rendering
    expect(data.bands).toBeDefined()
    expect(Array.isArray(data.bands)).toBe(true)
    expect(data.bands.length).toBeGreaterThan(0)
  })

  it('resolves ungrouped when groupByDimension is false', () => {
    const ungroupedBlocks = [{
      ...blocks[0],
      config: { ...blocks[0].config, groupByDimension: false },
    }]
    const [result] = generateSampleData(ungroupedBlocks as never, DEFAULT_REPORT_THEME, entities, 'Test')
    const data = result.data as { groups: Array<{ groupName: string | null }> }
    expect(data.groups.some((g) => g.groupName === null)).toBe(true)
  })
})
