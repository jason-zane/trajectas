import { describe, it, expect } from 'vitest'
import { synthScore } from '@/lib/sample-data/score-synth'

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
