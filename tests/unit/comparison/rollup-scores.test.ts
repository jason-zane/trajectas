import { describe, it, expect } from 'vitest'
import { rollupChildren } from '@/lib/comparison/rollup-scores'

describe('rollupChildren', () => {
  it('returns the weighted average rounded to integer', () => {
    expect(
      rollupChildren([
        { childId: 'a', score: 70, weight: 1 },
        { childId: 'b', score: 80, weight: 1 },
        { childId: 'c', score: 90, weight: 2 },
      ]),
    ).toBe(83)
  })

  it('returns null if any child score is null', () => {
    expect(
      rollupChildren([
        { childId: 'a', score: 70, weight: 1 },
        { childId: 'b', score: null, weight: 1 },
      ]),
    ).toBeNull()
  })

  it('returns null for an empty input', () => {
    expect(rollupChildren([])).toBeNull()
  })

  it('treats zero weight as a contributing child with weight 0 (skipped)', () => {
    expect(
      rollupChildren([
        { childId: 'a', score: 70, weight: 1 },
        { childId: 'b', score: 80, weight: 0 },
      ]),
    ).toBe(70)
  })

  it('returns null if the total weight is zero', () => {
    expect(rollupChildren([{ childId: 'a', score: 70, weight: 0 }])).toBeNull()
  })
})
