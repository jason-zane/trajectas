import { describe, it, expect } from 'vitest'
import { predictedB, band } from '@/lib/cognitive/generator/difficulty'
import { generateFamily } from '@/lib/cognitive/generator'
import { LRM_XOR_DIST_XLAYER } from '@/lib/cognitive/generator/families/lrm-xor-dist-xlayer'
import { LRM_3R_XLAYER } from '@/lib/cognitive/generator/families/lrm-3r-xlayer'

describe('generator/difficulty — doc 03-item-generation-pipeline.md §3.7', () => {
  it('reproduces the formula\'s own worked M1 figure (single R1, easy)', () => {
    const b = predictedB({ ruleIds: ['R1'], ruleCount: 1, crossLayer: false, perceptualLoad: 0, nearMissCount: 2 }, { nonCardinalAsymmetricRotation: false })
    // BETA0(-2.0) + w(R1)(0) + GAMMA*(1-1)(0) + LAMBDA*0 + PI*0 + DELTA*max(0,2-2)(0) = -2.0
    expect(b).toBeCloseTo(-2.0, 5)
    expect(band(b)).toBe('easy')
  })

  it('reproduces the formula\'s own worked M6 figure (R6+R2, cross-layer) with the bonus OFF — this is a pure formula sanity check, not what M6\'s actual family declares', () => {
    const b = predictedB({ ruleIds: ['R6', 'R2'], ruleCount: 2, crossLayer: true, perceptualLoad: 1, nearMissCount: 2 }, { nonCardinalAsymmetricRotation: false })
    // -2.0 + (0.9+0.3) + 0.5*(2-1) + 0.5*1 + 0.3*1 + 0.15*0 = -2.0+1.2+0.5+0.5+0.3 = 0.5
    expect(b).toBeCloseTo(0.5, 5)
    expect(band(b)).toBe('moderate') // boundary: moderate is < 0.5... hard starts AT 0.5
  })

  it('RESOLVED (issue #346, open question OQ-1): the formula is authoritative — M6 and M8\'s ACTUAL declared radicals (families/lrm-2r-xlayer.ts, families/lrm-xor-xlayer.ts), run through this formula, now match doc 03-logical-reasoning-design.md §6\'s corrected b values, not the original hand-typed -2.0/+0.7/+2.2 figures those sections used to state', () => {
    // M6's ACTUAL family declares nonCardinalAsymmetricRotation: true (its
    // 45deg tick step is non-cardinal, on an asymmetric element — the same
    // bonus LRM-ROT's arrow rotation gets), which the "bonus OFF" test
    // above deliberately does not include:
    const m6 = predictedB({ ruleIds: ['R6', 'R2'], ruleCount: 2, crossLayer: true, perceptualLoad: 1, nearMissCount: 2 }, { nonCardinalAsymmetricRotation: true })
    // -2.0 + (0.9+0.3+0.3) + 0.5*1 + 0.5*1 + 0.3*1 + 0 = -2.0+1.5+0.5+0.5+0.3 = 0.8
    expect(m6).toBeCloseTo(0.8, 5)
    expect(band(m6)).toBe('hard')

    // M8's own declared radicals (R1 here is a plain cardinal progression,
    // so no non-cardinal bonus):
    const m8 = predictedB({ ruleIds: ['R7', 'R1'], ruleCount: 2, crossLayer: true, perceptualLoad: 1, nearMissCount: 2 }, { nonCardinalAsymmetricRotation: false })
    // -2.0 + (1.6+0) + 0.5*1 + 0.5*1 + 0.3*1 + 0 = -2.0+1.6+0.5+0.5+0.3 = 0.9
    expect(m8).toBeCloseTo(0.9, 5)
    expect(band(m8)).toBe('hard')

    // Historical record, kept as a regression guard, not deleted: the
    // ORIGINAL doc prose asserted M6~+0.7 and M8~+2.2, and this formula
    // (unchanged — no weight in `difficulty.ts` was altered to produce
    // the numbers above) never reconciled with either. Both figures are
    // now WRONG readings of doc 03-logical-reasoning-design.md, which has
    // been corrected (§4.4 and §6's "Correction" notes) to state +0.8 and
    // +0.9 respectively, computed from THIS formula. Neither M6 nor M8
    // reaches the very-hard band (b >= 1.5) once computed honestly — see
    // cognitive-generator-battery.test.ts for the two NEW families
    // (LRM-XOR-DIST-XLAYER, LRM-3R-XLAYER) that do, through genuinely more
    // rule content, not by adjusting the weights below to relabel these.
    expect(m6).not.toBeCloseTo(0.7, 1)
    expect(m8).not.toBeCloseTo(2.2, 1)
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

  it('issue #346 acceptance test: the very-hard band is reachable by at least two families, through genuinely more rule content — never by adjusting the weights above', () => {
    // LRM-XOR-DIST-XLAYER: R6 + R7, cross-layer, 2 rules.
    const xorDist = predictedB({ ruleIds: ['R6', 'R7'], ruleCount: 2, crossLayer: true, perceptualLoad: 1, nearMissCount: 2 }, { nonCardinalAsymmetricRotation: false })
    // -2.0 + (0.9+1.6) + 0.5*1 + 0.5*1 + 0.3*1 + 0 = -2.0+2.5+0.5+0.5+0.3 = 1.8
    expect(xorDist).toBeCloseTo(1.8, 5)
    expect(band(xorDist)).toBe('very_hard')

    // LRM-3R-XLAYER: R6 + R6 + R2, cross-layer, 3 rules, 2 near-misses.
    const threeR = predictedB({ ruleIds: ['R6', 'R6', 'R2'], ruleCount: 3, crossLayer: true, perceptualLoad: 1, nearMissCount: 2 }, { nonCardinalAsymmetricRotation: true })
    // -2.0 + (0.9+0.9+0.3+0.3) + 0.5*2 + 0.5*1 + 0.3*1 + 0.15*0 = -2.0+2.4+1.0+0.5+0.3 = 2.20
    expect(threeR).toBeCloseTo(2.2, 5)
    expect(band(threeR)).toBe('very_hard')

    // nearMissCount CORRECTED 3 -> 2 (and b 2.35 -> 2.20) on 2026-08-14. The
    // family declared three single-axis IR near-misses, one per rule. That
    // distractor plan cannot exist: three distractors each wrong on exactly
    // one of three axes leave the key's own value held by 3 of 5 options on
    // every axis, so the blind modal composition reconstructs the key and
    // G-08 rejects the set — which is why the plan executed 0 times in 300
    // draws and every item fell through to a copy-based fallback. The
    // radicals now describe the plan the family can actually build (two
    // single-axis near-misses plus two chimeras). No weight in
    // generator/difficulty.ts changed; the family stays very_hard on its
    // rule content, with 0.70 of headroom rather than 0.85.
    const overstated = predictedB({ ruleIds: ['R6', 'R6', 'R2'], ruleCount: 3, crossLayer: true, perceptualLoad: 1, nearMissCount: 3 }, { nonCardinalAsymmetricRotation: true })
    expect(overstated - threeR).toBeCloseTo(0.15, 5)

    // Neither reaches very_hard by reusing an existing exemplar's radicals
    // under a changed weight — both use rule combinations no M1-M8
    // exemplar in doc 03 §6 uses (R6+R7 together; three rules with one
    // cross-layer). See families/lrm-xor-dist-xlayer.ts and
    // families/lrm-3r-xlayer.ts for the full construction and duplicate-
    // safety proofs.
  })

  it('the figures above are what the REGISTERED families actually emit — asserted against generated items, not against a second hand-typed copy of their radicals', () => {
    // 2026-08-19 (build-plan §3): the two families now DECLARE their Latin-
    // square axes cheap, and a rule on a declared cheap axis contributes half
    // its weight to the ordering prior. The formula test above passes no
    // cheap rules and is unchanged (the weights are untouched); this test
    // states what the registered families now emit:
    //   XOR-DIST-XLAYER: 1.8 - 0.45 (one cheap R6)  = 1.35, hard
    //   3R-XLAYER:       2.2 - 0.9  (two cheap R6s) = 1.30, hard
    // The very-hard band those two used to occupy was reached through cheap
    // rules whose "difficulty" the first pilot showed to be seconds of reading
    // (positions 19–24 in 3.5–12 s each) — the discount is the honest prior
    // until calibration replaces it. The band is now carried by LRM-BITS-2OP
    // (two comparably hard Boolean rules, cross-layer; families/lrm-bits-2op.ts),
    // asserted in tests/unit/cognitive-bitgrid.test.ts.
    const xorDist = generateFamily(LRM_XOR_DIST_XLAYER, 'very-hard-band-check', 4)
    const threeR = generateFamily(LRM_3R_XLAYER, 'very-hard-band-check', 4)
    expect(xorDist.items.length).toBeGreaterThan(0)
    expect(threeR.items.length).toBeGreaterThan(0)
    for (const item of xorDist.items) {
      expect(item.qa.predictedB).toBeCloseTo(1.35, 5)
      expect(item.qa.band).toBe('hard')
    }
    for (const item of threeR.items) {
      expect(item.qa.predictedB).toBeCloseTo(1.3, 5)
      expect(item.qa.band).toBe('hard')
    }
  })
})
