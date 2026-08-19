import { describe, it, expect } from 'vitest'
import { contextBlindGate, batchBlindHitRate, modalHitRate } from '@/lib/cognitive/generator/qa/contextblind'
import type { CellLike } from '@/lib/cognitive/generator/axes'

const repeatCircle = (count: number): CellLike => ({ elements: [{ type: 'repeat', layer: 'outer', shape: 'circle', fill: 'solid', size: 'S', count, rotation: 0 }] })

describe('qa/contextblind — context-blind gate', () => {
  it('REJECTS an option set solvable from the options alone under G-08\': doc 03-logical-reasoning-design.md M1 as literally written (issue #344: now checked against doc\'s TRUE D value, 6 circles — the count cap was raised from 5 to 6 specifically so this is representable; see tests/fixtures/cognitive/m1.ts)', () => {
    // doc's own M1 options (§6): A=4, B=5(key), C=3, D=6, E=5 squares.
    // Appendix A's own audit table marks this exact option set as FAILING
    // G-08 ("count 5 (x2), shape circle (x4) -> 5 circles" recovers the
    // key from the options alone, with no need to look at the grid) — and
    // that finding is UNCHANGED by restoring D's true value: the culprit is
    // E (same count as the key, wrong shape), not D. Under G-08', the modal
    // on count is {5} (B, E both at 5), so matched = {B(key), E}; P(hit) =
    // 1/2 = 0.5 > 0.25, fails MODAL_HIT_RATE.
    const options: CellLike[] = [
      repeatCircle(4), // A
      repeatCircle(5), // B (key)
      repeatCircle(3), // C
      repeatCircle(6), // D — doc's true wrong-rule value, representable since issue #344 raised the count cap
      { elements: [{ type: 'repeat', layer: 'outer', shape: 'square', fill: 'solid', size: 'S', count: 5, rotation: 0 }] }, // E
    ]
    const result = contextBlindGate(options, 1, ['outer.count'])
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('MODAL_HIT_RATE')
  })

  it('HISTORICAL: REJECTS doc 03-logical-reasoning-design.md\'s ORIGINAL (pre-2026-08-14, 90deg-step) M6 as literally written (Appendix A\'s own finding, reproduced independently) — kept as a regression guard against reintroducing a 90deg cross-layer tick step on a 3x3 grid without the aliasing fix', () => {
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
    // Modal outer.shape = circle (3/5: A,B,D), modal inner.rotation = 0deg (3/5: B,C,E).
    // Cartesian product: (circle, 0deg) matches B (key), and that is one of the matched options;
    // P(hit) = 1/1 = 1.0 > 0.25, fails MODAL_HIT_RATE.
    expect(result.reason).toBe('MODAL_HIT_RATE')
  })

  it('CORRECTED (issue #346): doc 03-logical-reasoning-design.md\'s current M6 table (45deg tick step, duplicate-free — see the "Correction" note under §6 M6) PASSES G-08 with the option set src/lib/cognitive/generator/families/lrm-2r-xlayer.ts\'s own repair search produces for this exact grid (also pinned in tests/fixtures/cognitive/m6.ts)', () => {
    const shapeTickOption = (shape: 'circle' | 'diamond' | 'square', tick: number): CellLike => ({
      elements: [
        { type: 'shape', layer: 'outer', shape, fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 },
        { type: 'tick', layer: 'inner', length: 30, rotation: tick },
      ],
    })
    const options: CellLike[] = [
      shapeTickOption('square', 0), // A — copyCell:R1C1 (PM)
      shapeTickOption('circle', 0), // B (key)
      shapeTickOption('square', 45), // C — copyCell:R2C3 (PM)
      shapeTickOption('square', 315), // D — copyCell:R3C2 (RP)
      shapeTickOption('circle', 45), // E — copyCell:R1C2 (PM)
    ]
    const result = contextBlindGate(options, 1, ['outer.shape', 'inner.rotation'])
    expect(result.ok).toBe(true)
  })

  it('FINDING: doc 03-item-generation-pipeline.md §4.5\'s own repaired M6 option set does NOT actually clear G-08\' under the expected-hit-rate bound, contradicting its prose', () => {
    // Doc's §4.5 prose says of its repair: "No modal composition equals the
    // key; the key's value is in the minority on 2 of 2 axes" and "Passes
    // G-08". Under G-08', the question is whether the modal compositions
    // give P(hit) ≤ 0.25. The repaired table has:
    //   shape:    circle x2 (A,key), diamond x1 (C), square x2 (D,E) -> no strict modal (2-way tie)
    //   rotation: 270 x2 (A,E), 0 x2 (key,C), 180 x1 (D)              -> no strict modal (2-way tie)
    // With tied values, the cartesian product includes (circle, 0deg), which
    // matches only B (the key). P(hit) = 1.0 > 0.25, so this still fails
    // G-08'. The actual fix shipped for M6 (issue #346) changes the tick's
    // step magnitude to 45deg, eliminating the duplicate this repair was
    // band-aiding around; see lrm-2r-xlayer.ts and the "CORRECTED" test above.
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
    expect(result.reason).toBe('MODAL_HIT_RATE')
  })

  it('G-08\' passes when P(hit) ≤ 0.25 and CENTROID does not uniquely pick the key', () => {
    // Four options at count 5, one at count 2. Modal = 5 (4/5).
    // P(hit) = 1/4 = 0.25, passes MODAL_HIT_RATE.
    // Centroid: indices 0-3 all have distance 1 (to each other 0, to index 4 is 1).
    // Index 4 has distance 4. Minimum is 1 (tied at 0-3), so centroid = [0,1,2,3],
    // length 4, not unique, passes CENTROID check.
    const options: CellLike[] = [repeatCircle(5), repeatCircle(5), repeatCircle(5), repeatCircle(5), repeatCircle(2)]
    const result = contextBlindGate(options, 0, ['outer.count'])
    expect(result.ok).toBe(true)
  })

  describe('modalHitRate', () => {
    it('computes P(hit) = 1/5 when all options have distinct values (all tied for modal)', () => {
      // Single-axis item where every option has a distinct value. All values
      // are tied (each appears once), so modal = {1,2,3,4,5}. The cartesian
      // product (trivial on one axis) includes all 5 individual compositions,
      // so matched = all 5 options. Key at index 2 (count 3), P(hit) = 1/5 = 0.2.
      const options: CellLike[] = [
        repeatCircle(1),
        repeatCircle(2),
        repeatCircle(3), // key
        repeatCircle(4),
        repeatCircle(5),
      ]
      const result = modalHitRate(options, 2, ['outer.count'])
      expect(result.pHit).toBeCloseTo(0.2)
      expect(result.matched.length).toBe(5)
    })

    it('computes P(hit) = 1/|matched| when key is in matched', () => {
      // Options: circle(5), circle(5), diamond(5), diamond(3), square(3).
      // Modal count = {5} (3 of 5: indices 0, 1, 2); matched = {0, 1, 2}.
      // Key at index 1, so P(hit) = 1/3 ≈ 0.33 > 0.25.
      const options: CellLike[] = [
        repeatCircle(5), // 0
        repeatCircle(5), // 1 (key)
        repeatCircle(5), // 2
        repeatCircle(3), // 3
        repeatCircle(3), // 4
      ]
      const result = modalHitRate(options, 1, ['outer.count'])
      expect(result.pHit).toBeCloseTo(1 / 3)
      expect(result.matched).toContain(1)
    })

    it('computes P(hit) = 0 when key is not in matched', () => {
      // Options: circle(5), circle(3), diamond(3), square(3), square(2).
      // Modal count = {3} (3 of 5: indices 1, 2, 3); matched = {1, 2, 3}.
      // Key at index 0 (count 5), not in matched, so P(hit) = 0.
      const options: CellLike[] = [
        repeatCircle(5), // 0 (key)
        repeatCircle(3), // 1
        repeatCircle(3), // 2
        repeatCircle(3), // 3
        repeatCircle(2), // 4
      ]
      const result = modalHitRate(options, 0, ['outer.count'])
      expect(result.pHit).toBe(0)
      expect(result.matched).not.toContain(0)
    })

    it('shows P(hit) = 0.25 at boundary (passes both checks)', () => {
      // Modal count = 5 (4/5); matched = {0,1,2,3}.
      // Key at index 0, P(hit) = 1/4 = 0.25, passes MODAL_HIT_RATE.
      // Centroid: 0-3 have total distance 1 each (to each other 0, to 4 is 1).
      // 4 has distance 4 (4 edges to 0-3). Minimum is 1 (tied), so centroid
      // has length 4, not unique, passes CENTROID.
      const options: CellLike[] = [
        repeatCircle(5), // 0 (key)
        repeatCircle(5), // 1
        repeatCircle(5), // 2
        repeatCircle(5), // 3
        repeatCircle(1), // 4
      ]
      const { pHit } = modalHitRate(options, 0, ['outer.count'])
      expect(pHit).toBeCloseTo(0.25)

      const result = contextBlindGate(options, 0, ['outer.count'])
      expect(result.ok).toBe(true)
    })

    it('rejects G-08\' when P(hit) > 0.25', () => {
      // Options: circle(5) x3, circle(3) x2. Modal = 5 (3/5); matched = 3;
      // Key at index 0, P(hit) = 1/3 > 0.25.
      const options: CellLike[] = [
        repeatCircle(5), // 0 (key)
        repeatCircle(5), // 1
        repeatCircle(5), // 2
        repeatCircle(3), // 3
        repeatCircle(3), // 4
      ]
      const result = contextBlindGate(options, 0, ['outer.count'])
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('MODAL_HIT_RATE')
    })
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
