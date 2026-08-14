import { describe, it, expect } from 'vitest'
import { contextBlindGate, batchBlindHitRate } from '@/lib/cognitive/generator/qa/contextblind'
import type { CellLike } from '@/lib/cognitive/generator/axes'

const repeatCircle = (count: number): CellLike => ({ elements: [{ type: 'repeat', layer: 'outer', shape: 'circle', fill: 'solid', size: 'S', count, rotation: 0 }] })

describe('qa/contextblind — context-blind gate', () => {
  it('REJECTS an option set solvable from the options alone: doc 03-logical-reasoning-design.md M1 as literally written', () => {
    // doc's own M1 options (§6): A=4, B=5(key), C=3, D=6(schema-invalid,
    // substituted with 5-hatched here per the LR-4 fixture's own
    // deviation note — see tests/fixtures/cognitive/m1.ts), E=5 squares.
    // Appendix A's own audit table marks this exact option set as FAILING
    // G-08 ("count 5 (x2), shape circle (x4) -> 5 circles" recovers the
    // key from the options alone, with no need to look at the grid).
    const options: CellLike[] = [
      repeatCircle(4), // A
      repeatCircle(5), // B (key)
      repeatCircle(3), // C
      { elements: [{ type: 'repeat', layer: 'outer', shape: 'circle', fill: 'hatched', size: 'S', count: 5, rotation: 0 }] }, // D
      { elements: [{ type: 'repeat', layer: 'outer', shape: 'square', fill: 'solid', size: 'S', count: 5, rotation: 0 }] }, // E
    ]
    const result = contextBlindGate(options, 1, ['outer.count'])
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('MODAL_RECOVERS_KEY')
  })

  it('REJECTS doc 03-logical-reasoning-design.md M6 as literally written (Appendix A\'s own finding, reproduced independently)', () => {
    const shapeTickOption = (shape: 'circle' | 'diamond' | 'square', tick: number): CellLike => ({
      elements: [
        { type: 'shape', layer: 'outer', shape, fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 },
        { type: 'tick', layer: 'inner', length: 30, rotation: tick },
      ],
    })
    const options: CellLike[] = [
      shapeTickOption('circle', 270), // A
      shapeTickOption('circle', 0), // B (key)
      shapeTickOption('diamond', 0), // C
      shapeTickOption('circle', 180), // D
      shapeTickOption('square', 0), // E
    ]
    const result = contextBlindGate(options, 1, ['outer.shape', 'inner.rotation'])
    expect(result.ok).toBe(false)
    // Modal outer.shape = circle (3/5), modal inner.rotation = 0deg (3/5) -> composes to the key.
    expect(result.reason).toBe('MODAL_RECOVERS_KEY')
  })

  it('FINDING: doc 03-item-generation-pipeline.md §4.5\'s own repaired M6 option set does NOT actually clear G-08 under doc\'s own specified algorithm, contradicting its prose', () => {
    // Doc's §4.5 prose says of its repair: "No modal composition equals the
    // key; the key's value is in the minority on 2 of 2 axes" and "Passes
    // G-08". But doc's OWN §4.4 pseudocode for modalComposition is an
    // explicit cartesian product over EVERY axis's tied-for-top values
    // (`modal[axis] = vals.filter(v => counts.get(axisKey(v)) === top);
    // return cartesianCells(modal, axes)`), not a single arbitrarily-broken
    // tie. Run that algorithm (this repo's `contextBlindGate`, built
    // directly from that pseudocode) on doc's own repaired table:
    //   shape:    circle x2 (A,key), diamond x1 (C), square x2 (D,E) -> tied top {circle, square}
    //   rotation: 270 x2 (A,E), 0 x2 (key,C), 180 x1 (D)              -> tied top {270, 0}
    // The cartesian product of the tied sets is {circle,square} x
    // {270,0} = 4 compositions, and (circle, 0deg) — the key — is
    // one of them. So doc's own repaired M6 is STILL context-blind
    // solvable under doc's own algorithm; the prose walkthrough undercounts
    // by treating each axis's tie as already resolved in the key's favour
    // without checking the OTHER tied branch. Reported as a finding, not
    // "fixed" here — this test pins the discrepancy.
    const shapeTickOption = (shape: 'circle' | 'diamond' | 'square', tick: number): CellLike => ({
      elements: [
        { type: 'shape', layer: 'outer', shape, fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 },
        { type: 'tick', layer: 'inner', length: 30, rotation: tick },
      ],
    })
    const options: CellLike[] = [
      shapeTickOption('circle', 270), // A
      shapeTickOption('circle', 0), // B (key)
      shapeTickOption('diamond', 0), // C
      shapeTickOption('square', 180), // D (repaired: was circle/180)
      shapeTickOption('square', 270), // E
    ]
    const result = contextBlindGate(options, 1, ['outer.shape', 'inner.rotation'])
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('MODAL_RECOVERS_KEY')
  })

  it('a context-blind-solvable option set is rejected regardless of which axis carries the leak (single numeric axis)', () => {
    // Four options agree with the key's value; only one differs — an
    // extreme, obvious version of the leak.
    const options: CellLike[] = [repeatCircle(5), repeatCircle(5), repeatCircle(5), repeatCircle(5), repeatCircle(2)]
    const result = contextBlindGate(options, 0, ['outer.count'])
    expect(result.ok).toBe(false)
  })

  describe('batchBlindHitRate', () => {
    it('computes an acceptance interval close to doc 03-item-generation-pipeline.md §4.4\'s stated 20-39 (of 144) figure', () => {
      // We don't have 144 real items handy here; construct a synthetic
      // batch where blind scoring hits exactly at the doc's boundary rates
      // to sanity-check the interval math itself.
      const items = Array.from({ length: 144 }, () => ({
        options: [repeatCircle(1), repeatCircle(2), repeatCircle(3), repeatCircle(4), repeatCircle(5)],
        keyIndex: 0,
        axes: ['outer.count'],
      }))
      const result = batchBlindHitRate(items)
      expect(result.n).toBe(144)
      // Documented deviation: this is a normal-approximation interval, not
      // doc's exact binomial inversion (no stats dependency available —
      // see qa/contextblind.ts's header comment). It should land close to,
      // not necessarily identical to, doc's stated [20, 39].
      expect(result.lowerBound).toBeGreaterThanOrEqual(15)
      expect(result.lowerBound).toBeLessThanOrEqual(22)
      expect(result.upperBound).toBeGreaterThanOrEqual(36)
      expect(result.upperBound).toBeLessThanOrEqual(42)
    })
  })
})
