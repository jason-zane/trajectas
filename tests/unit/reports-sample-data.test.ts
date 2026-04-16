import { describe, it, expect } from 'vitest'
import { generateSampleData } from '@/lib/reports/sample-data'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'

describe('generateSampleData — honours PreviewEntity.pompScore', () => {
  it('uses entity.pompScore when present', () => {
    const blocks = [{ id: 'b1', type: 'score_overview', order: 0, config: {} }]
    const entities = [
      { id: 'e1', name: 'Foo', type: 'factor' as const, pompScore: 42 },
      { id: 'e2', name: 'Bar', type: 'factor' as const, pompScore: 78 },
    ]
    const [result] = generateSampleData(
      blocks as never,
      DEFAULT_REPORT_THEME,
      entities,
      'Test',
    )
    const scores = (result.data as { scores: Array<{ pompScore: number }> }).scores
    expect(scores[0].pompScore).toBe(42)
    expect(scores[1].pompScore).toBe(78)
  })

  it('falls back to default distribution when pompScore is absent', () => {
    const blocks = [{ id: 'b1', type: 'score_overview', order: 0, config: {} }]
    const entities = [
      { id: 'e1', name: 'Foo', type: 'factor' as const },
    ]
    const [result] = generateSampleData(
      blocks as never,
      DEFAULT_REPORT_THEME,
      entities,
      'Test',
    )
    const scores = (result.data as { scores: Array<{ pompScore: number }> }).scores
    // Default distribution starts at 82 for index 0
    expect(scores[0].pompScore).toBe(82)
  })
})
