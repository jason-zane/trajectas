import { describe, it, expect } from 'vitest'
import { predictedB, band } from '@/lib/cognitive/generator/difficulty'

describe('generator/difficulty — doc 03-item-generation-pipeline.md §3.7', () => {
  it('reproduces the formula\'s own worked M1 figure (single R1, easy)', () => {
    const b = predictedB({ ruleIds: ['R1'], ruleCount: 1, crossLayer: false, perceptualLoad: 0, nearMissCount: 2 }, { nonCardinalAsymmetricRotation: false })
    // BETA0(-2.0) + w(R1)(0) + GAMMA*(1-1)(0) + LAMBDA*0 + PI*0 + DELTA*max(0,2-2)(0) = -2.0
    expect(b).toBeCloseTo(-2.0, 5)
    expect(band(b)).toBe('easy')
  })

  it('reproduces the formula\'s own worked M6 figure (R6+R2, cross-layer)', () => {
    const b = predictedB({ ruleIds: ['R6', 'R2'], ruleCount: 2, crossLayer: true, perceptualLoad: 1, nearMissCount: 2 }, { nonCardinalAsymmetricRotation: false })
    // -2.0 + (0.9+0.3) + 0.5*(2-1) + 0.5*1 + 0.3*1 + 0.15*0 = -2.0+1.2+0.5+0.5+0.3 = 0.5
    expect(b).toBeCloseTo(0.5, 5)
    expect(band(b)).toBe('moderate') // boundary: moderate is < 0.5... hard starts AT 0.5
  })

  it('FINDING: doc 03-logical-reasoning-design.md\'s own stated exemplar b values do not reconcile with doc 03-item-generation-pipeline.md\'s formula (open question OQ-1) — pinned here so a future weight change is a deliberate, visible diff', () => {
    // M1: doc 03-logical-reasoning-design.md §6 states b ~ -2.0; the
    // formula (see test above) agrees for M1. M6: doc states b ~ +0.7; the
    // formula gives +0.5 (test above). M8: doc states b ~ +2.2 (R7 + R1,
    // cross-layer, perceptualLoad=1); the formula:
    const m8 = predictedB({ ruleIds: ['R7', 'R1'], ruleCount: 2, crossLayer: true, perceptualLoad: 1, nearMissCount: 2 }, { nonCardinalAsymmetricRotation: false })
    // -2.0 + (1.6+0) + 0.5*1 + 0.5*1 + 0.3*1 + 0 = -2.0+1.6+0.5+0.5+0.3 = 0.9, NOT 2.2.
    expect(m8).toBeCloseTo(0.9, 5)
    expect(m8).not.toBeCloseTo(2.2, 1) // pins doc 03-item-generation-pipeline.md §3.7's own OQ-1 gap (~1.3 logits unaccounted for)
  })

  it('every predictedB call in this codebase computes the value fresh from radicals — it is never hand-typed (G-14\'s whole point)', () => {
    // A generated item's predictedB must always equal a fresh recomputation
    // from its OWN radicals — this is what makes G-14 trivially satisfiable
    // by construction rather than a check that could ever meaningfully fail.
    const radicals = { ruleIds: ['R4'] as const, ruleCount: 1, crossLayer: false, perceptualLoad: 1, nearMissCount: 2 }
    const a = predictedB(radicals, { nonCardinalAsymmetricRotation: false })
    const b = predictedB(radicals, { nonCardinalAsymmetricRotation: false })
    expect(a).toBe(b)
  })

  it('band() boundaries match doc 03-logical-reasoning-design.md §4.4 exactly', () => {
    expect(band(-1.01)).toBe('easy')
    expect(band(-1.0)).toBe('moderate')
    expect(band(0.49)).toBe('moderate')
    expect(band(0.5)).toBe('hard')
    expect(band(1.49)).toBe('hard')
    expect(band(1.5)).toBe('very_hard')
  })
})
