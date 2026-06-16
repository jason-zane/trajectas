import { describe, it, expect } from 'vitest'
import { comparisonRequestSchema } from '@/lib/validations/comparison'

describe('comparisonRequestSchema — visibleLevels', () => {
  it('accepts dimension and factor', () => {
    const parsed = comparisonRequestSchema.safeParse({
      entries: [],
      assessmentIds: [],
      visibleLevels: ['dimension', 'factor'],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects construct — ColumnLevel is dimension | factor only', () => {
    const parsed = comparisonRequestSchema.safeParse({
      entries: [],
      assessmentIds: [],
      visibleLevels: ['dimension', 'construct'],
    })
    expect(parsed.success).toBe(false)
  })
})
