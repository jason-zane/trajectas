import { describe, it, expect } from 'vitest'
import { synthScore, weightedMean } from '@/lib/sample-data/score-synth'

describe('synthScore', () => {
  it('is deterministic — same entity id + salt produces the same score', () => {
    const a = synthScore('11111111-1111-1111-1111-111111111111')
    const b = synthScore('11111111-1111-1111-1111-111111111111')
    expect(a).toBe(b)
  })

  it('produces different scores for different entity ids', () => {
    const a = synthScore('11111111-1111-1111-1111-111111111111')
    const b = synthScore('22222222-2222-2222-2222-222222222222')
    expect(a).not.toBe(b)
  })

  it('always returns a value in the 20..90 range (inclusive)', () => {
    for (let i = 0; i < 100; i++) {
      const id = `${i}-aaaa-bbbb-cccc-dddddddddddd`
      const score = synthScore(id)
      expect(score).toBeGreaterThanOrEqual(20)
      expect(score).toBeLessThanOrEqual(90)
    }
  })

  it('returns different output when salt changes', () => {
    const a = synthScore('11111111-1111-1111-1111-111111111111', 'sample')
    const b = synthScore('11111111-1111-1111-1111-111111111111', 'other')
    expect(a).not.toBe(b)
  })
})

describe('weightedMean', () => {
  it('returns the weighted mean, rounded to the nearest integer', () => {
    expect(weightedMean([{ value: 60, weight: 1 }, { value: 80, weight: 3 }])).toBe(75)
  })

  it('returns 0 for an empty input', () => {
    expect(weightedMean([])).toBe(0)
  })

  it('falls back to unweighted mean when total weight is 0', () => {
    expect(weightedMean([{ value: 40, weight: 0 }, { value: 60, weight: 0 }])).toBe(50)
  })
})
