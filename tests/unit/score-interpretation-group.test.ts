import { describe, it, expect } from 'vitest'
import { generateSampleData } from '@/lib/reports/sample-data'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'

describe('generateSampleData — score_interpretation emits groupEntity', () => {
  it('attaches a groupEntity to each grouped cluster', () => {
    const dimensionId = 'd1'
    const blocks = [{
      id: 'b1',
      type: 'score_interpretation',
      order: 0,
      config: { displayLevel: 'factor', groupByDimension: true },
    }]
    const entities = [
      { id: dimensionId, name: 'Emotional Intelligence', type: 'dimension' as const, pompScore: 72, anchorLow: 'Low', anchorHigh: 'High' },
      { id: 'f1', name: 'Self-Awareness', type: 'factor' as const, parentId: dimensionId, pompScore: 68 },
      { id: 'f2', name: 'Self-Regulation', type: 'factor' as const, parentId: dimensionId, pompScore: 76 },
    ]
    const [result] = generateSampleData(
      blocks as never,
      DEFAULT_REPORT_THEME,
      entities,
      'Test',
    )
    const { groups } = result.data as {
      groups: Array<{
        groupName: string | null
        groupEntity: { entityId: string; entityName: string; pompScore: number; bandResult: unknown; anchorLow: string | null; anchorHigh: string | null } | null
        entities: unknown[]
      }>
    }
    expect(groups).toHaveLength(1)
    expect(groups[0].groupName).toBe('Emotional Intelligence')
    expect(groups[0].groupEntity).toBeDefined()
    expect(groups[0].groupEntity).not.toBeNull()
    expect(groups[0].groupEntity!.entityId).toBe(dimensionId)
    expect(groups[0].groupEntity!.entityName).toBe('Emotional Intelligence')
    expect(groups[0].groupEntity!.pompScore).toBe(72)
    expect(groups[0].groupEntity!.anchorLow).toBe('Low')
    expect(groups[0].groupEntity!.anchorHigh).toBe('High')
  })

  it('ungrouped cluster has null groupEntity', () => {
    const blocks = [{
      id: 'b1',
      type: 'score_interpretation',
      order: 0,
      config: { displayLevel: 'factor', groupByDimension: false },
    }]
    const entities = [
      { id: 'f1', name: 'Self-Awareness', type: 'factor' as const, pompScore: 68 },
    ]
    const [result] = generateSampleData(
      blocks as never,
      DEFAULT_REPORT_THEME,
      entities,
      'Test',
    )
    const { groups } = result.data as { groups: Array<{ groupEntity: unknown }> }
    expect(groups[0].groupEntity).toBeNull()
  })
})
