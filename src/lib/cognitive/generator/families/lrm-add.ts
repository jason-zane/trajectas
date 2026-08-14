/**
 * LRM-ADD — M4's family. Doc 03-logical-reasoning-design.md §6 M4: figure
 * addition, R4 (`C3 = C1 union C2` per row) on a set of bars {H,V,D1,D2}.
 * Rows 1-2 use single-bar, pairwise-DISJOINT operands (doc's own point:
 * that is what makes the "addition, not cancellation" reading unambiguous),
 * and row 3's operands are the two disjoint PAIRS those six single bars
 * decompose into — so the key is always the full 4-bar set, and the
 * incidental space is simply WHICH permutation of {H,V,D1,D2} fills the
 * row1/row2 single-bar slots.
 */
import type { BarId, Element, RuleSpec } from '../../spec/schema'
import { setVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx } from '../compose'
import { incompleteSetRule, repetition } from '../distractors'
import type { DistractorCandidate } from '../compose'
import type { Rng } from '../rng'

const AXIS = 'outer.bars'
const ALL_BARS: BarId[] = ['H', 'V', 'D1', 'D2']

export interface M4Params {
  /** [row1C1, row1C2, row2C1, row2C2] — a permutation of the 4 bars. */
  perm: [BarId, BarId, BarId, BarId]
}

function barsCell(bars: readonly BarId[]): Element[] {
  return [{ type: 'bars', layer: 'outer', bars: [...bars].sort(barOrder), clipToOuter: false }]
}
const BAR_ORDER: Record<BarId, number> = { H: 0, V: 1, D1: 2, D2: 3 }
function barOrder(a: BarId, b: BarId): number {
  return BAR_ORDER[a] - BAR_ORDER[b]
}

/** Row-1/row-2 single-bar operand, and row-3's two-bar operand, per doc's layout. Column 1 gets [perm0, perm2] pairwise; column 2 gets [perm1, perm3]. */
function operandsFor(perm: M4Params['perm'], row: number): [BarId[], BarId[]] {
  if (row === 1) return [[perm[0]], [perm[1]]]
  if (row === 2) return [[perm[2]], [perm[3]]]
  return [
    [perm[0], perm[2]],
    [perm[1], perm[3]],
  ]
}

export const LRM_ADD: FamilyTemplate<M4Params> = {
  code: 'LRM-ADD',
  axes: [AXIS],
  domains: () => ({ [AXIS]: { kind: 'set' } as AxisDomain }),
  valueAt: (axis, row, col, params) => {
    if (axis !== AXIS) throw new Error(`unknown axis ${axis}`)
    const [a, b] = operandsFor(params.perm, row)
    if (col === 1) return setVal(a)
    if (col === 2) return setVal(b)
    return setVal([...new Set([...a, ...b])])
  },
  ruleSpecs: (): RuleSpec[] => [
    {
      id: 'R4',
      axis: AXIS,
      direction: 'row_operator',
      params: { op: 'union' },
      statement: 'The third cell in each row is the superimposition of the first two: every bar present in either of the first two cells appears in the third.',
    },
  ],
  // elementTypes: schema floor is 2; this family draws only a `bars` element
  // type, but the bar SET itself (up to 4 distinct bar identities) is the
  // element-type-analogue in play here.
  radicals: { ruleCount: 1, ruleIds: ['R4'], crossLayer: false, perceptualLoad: 1, elementTypes: 4, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['RP', 'IR', 'IR', 'RP'],
  sampleParams(rng: Rng): M4Params {
    const perm = rng.shuffle(ALL_BARS) as M4Params['perm']
    return { perm }
  },
  buildCell(values) {
    const v = values[AXIS]
    if (v.t !== 'set') throw new Error('outer.bars must be a set')
    return barsCell(v.v as BarId[])
  },
  buildDistractors(ctx: DistractorCtx<M4Params>) {
    const key = ctx.valueAt(AXIS, 3, 3)
    if (key.t !== 'set') throw new Error('outer.bars must be a set')

    // A (doc): copies R1C3 — "the most recently seen combined-looking cell".
    const r1c3 = ctx.valueAt(AXIS, 1, 3)
    if (r1c3.t !== 'set') throw new Error('outer.bars must be a set')
    const a = repetition('copyCell:R1C3', barsCell(r1c3.v as BarId[]), [AXIS])

    // B (doc): adds only the diagonal components — copies R2C3. Doc labels
    // this IR ("a partial superimposition that keeps the 'X' gestalt of row
    // 2"), not PM, so it's built directly rather than via the `chimera`
    // primitive (which always labels PM).
    const r2c3 = ctx.valueAt(AXIS, 2, 3)
    if (r2c3.t !== 'set') throw new Error('outer.bars must be a set')
    const b: DistractorCandidate = { elements: barsCell(r2c3.v as BarId[]), label: 'IR', mechanism: 'partialSuperimposition:copyCell:R2C3', wrongAxes: [AXIS] }

    // D (doc): the near-miss — three of four bars, dropping one. MUST drop
    // `perm[3]` (row2C2) specifically, not an arbitrary bar: that is the
    // one bar held by only 2 of the 5 options (key + B) once A/B/D/E are
    // all in play, which is exactly what keeps G-08's majority vote from
    // reconstructing the full 4-bar key (doc's own Appendix A audit marks
    // M4 as passing G-08 for this precise reason — its D drops the bar that
    // is already the minority one, "D2" in doc's own labelling).
    const dropped = ctx.params.perm[3]
    const d = incompleteSetRule('dropElement:outer.bars[' + dropped + ']', barsCell(key.v.filter((x) => x !== dropped) as BarId[]), AXIS)

    // E (doc): exact copy of R3C1 — the no-operation default.
    const r3c1 = ctx.valueAt(AXIS, 3, 1)
    if (r3c1.t !== 'set') throw new Error('outer.bars must be a set')
    const e = repetition('copyCell:R3C1', barsCell(r3c1.v as BarId[]), [AXIS])

    return [a, b, d, e]
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: M4Params) => ({ perm: params.perm }),
}
