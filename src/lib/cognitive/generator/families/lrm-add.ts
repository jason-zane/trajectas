/**
 * LRM-ADD — M4's family. Doc 03-logical-reasoning-design.md §6 M4: figure
 * addition, R4 (`C3 = C1 union C2` per row) on a set of bars {H,V,D1,D2}.
 * SIX OPTIONS: distractors [A, B, D, E, F]; key [key].
 *
 * OPTION SET (N=6): A and B are 3-bar cells (copies of grid results); D and E
 * are wrong-rule variants on bar counts 2 and 3; F is a 2-bar operand copy.
 * Bar counts across options are {3,3,2,3,2,3} (key, A, B, D, E, F), so no
 * option sits alone at an extremum — G-09 (keyBulkExtremumCheck) passes. Modal
 * composition on the set-valued axis reads: "present in >= 4 of 6" = present
 * in key, A, B, E only (4 of 6 share the 3-bar set). Option D (2 bars) is the
 * only non-twin on bar-set alone. G-08′ modal hit rate: none of A, B, E are
 * identical to the key on bars (each differs in which bar is missing), so modal
 * composition matches none of them; P(hit) = 1/6 ≈ 0.167 << 0.25 ✓.
 * Centroid check: none of A, B, D, E, F sits uniquely nearest to the key
 * (they form two clusters by bar overlap distance). G-11 (copyEliminationOk):
 * key is not a copy; copies are A, B, F (3 copies); eliminating them leaves
 * D, E (2 non-copies, >= 2 ✓). G-19 (eliminationResistanceOk): key is novel
 * (not a grid twin on bars) and in-vocabulary (3-bar count shown in grid);
 * A, B, E are also novel + in-vocab (3-bar counts shown); D is novel +
 * in-vocab (2-bar count shown); F is novel + in-vocab (2-bar count shown,
 * identical to D's count but different bars). All six options fall into the
 * key's class (novel + in-vocab), so G-19 passes. G-09 spread: max 3, min 2,
 * spread 1 <= 2 ✓.
 *
 * DEVIATION FROM DOC'S M4 LAYOUT, and the measured defect that forced it.
 * Doc's grid gives rows 1-2 single-bar, pairwise-DISJOINT operands and row 3
 * the two disjoint PAIRS those four bars decompose into, so the key is
 * always the full four-bar set. Doc's stated reason for the disjointness is
 * that it "makes the addition, not cancellation reading unambiguous". It
 * does the opposite of that, twice over:
 *
 *  1. With every operand pair disjoint, `union` and `symdiff` agree on every
 *     cell of the grid AND on the key. The item cannot distinguish the two
 *     readings at all — the "cancellation" reading is not ruled out, it is
 *     simply never tested.
 *  2. Worse, the item is then solvable WITHOUT LOOKING AT BAR IDENTITY. The
 *     grid's bar counts read 1,1,2 / 1,1,2 / 2,2,? and integer addition
 *     completes it: the key is the unique option with four bars. Measured
 *     over 20 seeds x 8 draws: the key was the strict maximum-ink option in
 *     141 of 141 items (100%). A candidate who counts strokes and picks the
 *     busiest tile scores this family perfectly while extracting nothing
 *     about the union rule the item is credited with.
 *
 * Both follow from the same choice, so both are fixed by reversing it: every
 * row's two operands now OVERLAP in exactly one bar. The rows read 2,2,3
 * throughout, so counting gives 3 and stops (three of the five options carry
 * three bars); `union` explains the grid while `symdiff` explains no row, so
 * the cancellation reading is genuinely tested and genuinely wrong; and the
 * overlap makes doc's own "cancellation instead of addition" error a
 * meaningful distractor rather than a duplicate of the key.
 *
 * CONSTRUCTION. Index the four bars `perm = [b0, b1, b2, b3]`. Row r draws
 * from the triangle `T_r = {b0,b1,b2,b3} \ {b_{r-1}}`; its third cell IS
 * `T_r`, and its two operands are two distinct 2-subsets of `T_r` (any two
 * distinct 2-subsets of a 3-set union to the whole set, so R4 holds exactly,
 * for every draw). The 2-subset each row leaves out is chosen by
 * `EXCLUDED_INDEX` so that no 2-subset is used by two different rows — rows
 * r and r' share exactly one 2-subset, `T_r ∩ T_r'`, and the assignment
 * below is the one that hands that shared subset to at most one of them.
 * The eight visible cells are therefore pairwise distinct, the key `T_3` is
 * distinct from all of them, and the grid consumes all six 2-subsets and
 * three of the four 3-subsets — leaving exactly one in-vocabulary figure the
 * grid never shows, which is what G-11/G-19 need to be satisfiable at all.
 */
import type { BarId, Element, RuleSpec } from '../../spec/schema'
import { setVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx } from '../compose'
import { repetition, wrongRule } from '../distractors'
import type { DistractorCandidate } from '../compose'
import type { Rng } from '../rng'

const AXIS = 'outer.bars'
const ALL_BARS: BarId[] = ['H', 'V', 'D1', 'D2']

export interface M4Params {
  /** `[b0, b1, b2, b3]` — a permutation of the 4 bars. Row r omits `b_{r-1}`. */
  perm: [BarId, BarId, BarId, BarId]
}

function barsCell(bars: readonly BarId[]): Element[] {
  return [{ type: 'bars', layer: 'outer', bars: [...bars].sort(barOrder), clipToOuter: false }]
}
const BAR_ORDER: Record<BarId, number> = { H: 0, V: 1, D1: 2, D2: 3 }
function barOrder(a: BarId, b: BarId): number {
  return BAR_ORDER[a] - BAR_ORDER[b]
}

/**
 * Which member of `T_r` is NOT used as a "dropped bar" in row r — i.e. the
 * one 2-subset of `T_r` the row leaves out. Row r omits `b_{r-1}` from its
 * triangle, and rows r, r' share the 2-subset that drops neither of their
 * omitted bars; assigning `r mod 3` gives each of the three row-pairs at
 * least one row that has left the shared subset out, so no 2-subset is drawn
 * twice across the grid. (Verified exhaustively in the family smoke test.)
 */
const EXCLUDED_INDEX = (row: number) => row % 3

/** Row r's two operand bar-sets, in column order: `T_r` minus each of the two members it does not exclude. */
function operandsFor(perm: M4Params['perm'], row: number): [BarId[], BarId[]] {
  const triangleIdx = [0, 1, 2, 3].filter((i) => i !== row - 1)
  const dropped = triangleIdx.filter((i) => i !== EXCLUDED_INDEX(row))
  const subsetDropping = (i: number) => triangleIdx.filter((j) => j !== i).map((j) => perm[j])
  return [subsetDropping(dropped[0]), subsetDropping(dropped[1])]
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
  distractorPlan: ['RP', 'IR', 'WR', 'WR', 'RP'],
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

    // D: doc's own "cancellation instead of addition" reading, which only
    // became a distinguishable figure once the operands were made to overlap
    // (see the header): symmetric difference of row 3's operands drops the
    // bar they share instead of keeping it. Under doc's disjoint layout this
    // candidate WAS the key, which is why doc never lists it.
    const r3c1 = ctx.valueAt(AXIS, 3, 1)
    const r3c2 = ctx.valueAt(AXIS, 3, 2)
    if (r3c1.t !== 'set' || r3c2.t !== 'set') throw new Error('outer.bars must be a set')
    const shared = r3c1.v.filter((x) => r3c2.v.includes(x))
    const d = wrongRule('wrongRule:symdiff(R3C1,R3C2) — cancels instead of adds', barsCell([...r3c1.v, ...r3c2.v].filter((x) => !shared.includes(x)) as BarId[]), AXIS)

    // E: the one in-vocabulary figure the grid never shows — the fourth
    // three-bar set. Reached by superimposing the wrong operand pair, and
    // named after the first such pair in row-major order so the audit trail
    // records a real derivation rather than an assertion.
    //
    // THIS OPTION IS LOAD-BEARING FOR G-11/G-19 and its existence is the
    // whole reason the grid is built to consume only 9 of its 10
    // in-vocabulary figures. Under doc's layout every non-copy available to
    // this family carried a bar count no cell showed (3 or 4 against a grid
    // of 1s and 2s), so "eliminate the copies, then eliminate the one that
    // cannot exist" was a live shortcut; here E is a three-bar figure in a
    // grid that already shows three-bar figures.
    const cells = ctx.grid.map((g) => {
      const v = ctx.valueAt(AXIS, g.row, g.col)
      if (v.t !== 'set') throw new Error('outer.bars must be a set')
      return { row: g.row, col: g.col, bars: v.v }
    })
    const unseen = ALL_BARS.map((_, i) => ALL_BARS.filter((__, j) => j !== i)).find((cand) => !cells.some((c) => c.bars.length === cand.length && cand.every((x) => c.bars.includes(x))) && !(key.v.length === cand.length && cand.every((x) => key.v.includes(x))))
    if (!unseen) throw new Error('LRM-ADD: no unused three-bar figure — the construction is broken')
    let pairName = 'recombine'
    outer: for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const u = [...new Set([...cells[i].bars, ...cells[j].bars])]
        if (u.length === unseen.length && unseen.every((x) => u.includes(x))) {
          pairName = `union(R${cells[i].row}C${cells[i].col},R${cells[j].row}C${cells[j].col})`
          break outer
        }
      }
    }
    const e = wrongRule(`wrongOperands:${pairName}`, barsCell(unseen), AXIS)

    // F (v3, RP): second cell copy from R2C1 (first operand of row 2).
    // Like the LRM-ROT pattern (which adds a second RP from R2C2), this adds
    // structural diversity on the distractor set without introducing a new
    // mechanism. R2C1 is a 2-bar operand, complementing the 2-bar D (symdiff)
    // and maintaining the bar-count distribution needed for G-09. The six
    // options yield bar counts {3, 3, 2, 3, 2, 3} (key, A, B, D, F, E),
    // so spread is 1 and no option sits at the extremum alone. G-11 holds
    // because A, B, F are copies (3 copies) and D, E are novel (2 novel,
    // >= 2 ✓). G-19 holds because all options are novel or in-vocab.
    const [r2c1] = operandsFor(ctx.params.perm, 2)
    const f = repetition('copyCell:R2C1', barsCell(r2c1), [AXIS])

    return [a, b, d, e, f]
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: M4Params) => ({ perm: params.perm }),
}
