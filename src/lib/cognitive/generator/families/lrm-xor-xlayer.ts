/**
 * LRM-XOR-XLAYER — M8's family. Doc 03-logical-reasoning-design.md §6 M8:
 * XOR with cross-layer progression — R7 (inner bars, `C3 = C1 xor C2` per
 * row) + R1 (outer polygon sides: 3 -> 4 -> 5 across each row, i.e. a pure
 * column progression, constant down each row).
 *
 * FINDING (grid-level, same class as LRM-2R-XLAYER's): doc's own M8 grid
 * (§6) has (1,2) and (2,2) BOTH rendering "square, bars={H,V}" — row1's C2
 * operand {H,V} and row2's C2 operand {V,H} are the same SET, and outer
 * shape depends only on column (both are column 2 = square) — a genuine
 * CELL_DUPLICATE in the canonical exemplar, independent of the already-
 * documented G-08 issue doc's own Appendix A raises for M8's bar pattern.
 *
 * This family avoids it by construction rather than by search: doc 03-
 * logical-reasoning-design.md §6 M8 itself notes the row rule is
 * "equivalently stated as distribution-of-two: each bar type appears in
 * exactly two cells per row." Taking that framing literally and applying
 * it to EVERY cell (not just as a side-observation) — bar `i` is missing
 * from column `(col - row - i) mod 3` in every row — makes each cell's
 * bar-set exactly `{all 3 bars} minus {the one missing bar}` and, by
 * construction (proved in the code comment on `missingBarIndex`), (a)
 * satisfies `C3 = C1 xor C2` exactly and (b) gives every one of the 9
 * cells a DIFFERENT bar-set within its own column — so combined with
 * outer.shape's column-only dependence, no two cells can coincide on both
 * axes. No search is needed for this family; the construction is
 * duplicate-free by proof, not by trial.
 */
import type { BarId, Element, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, setVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import { repetition } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { combinations4 } from '../combinatorics'
import { cellEq } from '../axes'

const SHAPE_AXIS = 'outer.shape'
const BARS_AXIS = 'inner.bars'

/** Sides 3, 4, 5 — the only three regular-polygon shapes in the vocabulary with that side count. */
const SHAPE_LADDER: ShapeId[] = ['triangle', 'square', 'pentagon']
const ALL_BARS: BarId[] = ['H', 'V', 'D1']

export interface M8Params {
  /** Which physical bar plays role 0/1/2 in `missingBarIndex`. */
  barRoles: [BarId, BarId, BarId]
  /** Column direction of the side-count progression. */
  shapeDir: 1 | -1
}

/** See the file header proof: bar `barRoles[i]` is missing from row `row`'s column `((col - row - i) % 3 + 3) % 3 + 1`. Equivalently, for a given (row, col), the missing role index is `(col - row) mod 3` — proved to make `C3 = C1 xor C2` hold and every column's 3 cells pairwise bar-distinct. */
function missingRoleIndex(row: number, col: number): number {
  return (((col - row) % 3) + 3) % 3
}

function barsAt(params: M8Params, row: number, col: number): BarId[] {
  const missing = params.barRoles[missingRoleIndex(row, col)]
  return ALL_BARS.filter((b) => b !== missing)
}

function shapeAt(params: M8Params, col: number): ShapeId {
  const idx = params.shapeDir === 1 ? col - 1 : SHAPE_LADDER.length - col
  return SHAPE_LADDER[idx]
}

function cell(shape: ShapeId, bars: readonly BarId[]): Element[] {
  return [
    // FINDING: doc 03-logical-reasoning-design.md §6 M8 specifies size L for
    // the outer polygon, but an outline `square` at L (bounding-box width
    // 60, i.e. area 3600/10000 = 0.36 of the canvas) plus its 2 clipped
    // bars (0.024) totals 0.384 — over qa/density.ts's 0.38 INK_MAX
    // ceiling by a hair, every time a square appears (guaranteed once per
    // row here, since the outer shape is constant down each row). Dropped
    // to M to stay inside the ceiling with headroom; still well clear of
    // the 0.04 floor for every shape in the ladder at this size.
    { type: 'shape', layer: 'outer', shape, fill: 'outline', size: 'M', anchor: 'CTR', rotation: 0 },
    { type: 'bars', layer: 'inner', bars: [...bars].sort(barOrder), clipToOuter: true },
  ]
}
const BAR_ORDER: Record<BarId, number> = { H: 0, V: 1, D1: 2, D2: 3 }
function barOrder(a: BarId, b: BarId): number {
  return BAR_ORDER[a] - BAR_ORDER[b]
}

export const LRM_XOR_XLAYER: FamilyTemplate<M8Params> = {
  code: 'LRM-XOR-XLAYER',
  axes: [BARS_AXIS, SHAPE_AXIS],
  domains: () => ({
    [SHAPE_AXIS]: { kind: 'ordered-enum', ladder: SHAPE_LADDER.map(enumVal) } as AxisDomain,
    [BARS_AXIS]: { kind: 'set' } as AxisDomain,
  }),
  valueAt: (axis, row, col, params) => {
    if (axis === SHAPE_AXIS) return enumVal(shapeAt(params, col))
    if (axis === BARS_AXIS) return setVal(barsAt(params, row, col))
    throw new Error(`unknown axis ${axis}`)
  },
  ruleSpecs: (params): RuleSpec[] => [
    {
      id: 'R7',
      axis: BARS_AXIS,
      direction: 'row_operator',
      params: { op: 'symdiff' },
      statement: 'The third cell in each row contains exactly the bars that appear in exactly one of the first two cells (their symmetric difference).',
    },
    {
      id: 'R1',
      axis: SHAPE_AXIS,
      direction: 'column',
      params: { ladder: SHAPE_LADDER, stepPerColumn: params.shapeDir, stepPerRow: 0 },
      statement: 'The outer polygon gains one side per column (triangle, square, pentagon), the same in every row.',
    },
  ],
  radicals: { ruleCount: 2, ruleIds: ['R7', 'R1'], crossLayer: true, perceptualLoad: 1, elementTypes: 4, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['WR', 'WR', 'IR', 'RP'],
  sampleParams(rng: Rng): M8Params {
    const barRoles = rng.shuffle(ALL_BARS) as [BarId, BarId, BarId]
    const shapeDir = rng.pick([1, -1] as const)
    return { barRoles, shapeDir }
  },
  buildCell(values) {
    const shape = values[SHAPE_AXIS]
    const bars = values[BARS_AXIS]
    if (shape.t !== 'enum' || bars.t !== 'set') throw new Error('shape/bars must be enum/set')
    return cell(shape.v as ShapeId, bars.v as BarId[])
  },
  buildDistractors(ctx: DistractorCtx<M8Params>) {
    const keyBars = ctx.valueAt(BARS_AXIS, 3, 3)
    const keyShape = ctx.valueAt(SHAPE_AXIS, 3, 3)
    if (keyBars.t !== 'set' || keyShape.t !== 'enum') throw new Error('bars/shape must be set/enum')
    const keyShapeId = keyShape.v as ShapeId

    // B (doc): intersection instead of symmetric difference — keeps only the shared bar.
    const c1 = ctx.valueAt(BARS_AXIS, 3, 1)
    const c2 = ctx.valueAt(BARS_AXIS, 3, 2)
    if (c1.t !== 'set' || c2.t !== 'set') throw new Error('bars must be set')
    const intersection = c1.v.filter((x) => c2.v.includes(x))
    const wr1: DistractorCandidate = { elements: cell(keyShapeId, intersection as BarId[]), label: 'WR', mechanism: 'wrongRule:intersection', wrongAxes: [BARS_AXIS] }

    // C (doc): union instead of symmetric difference — keeps everything.
    const union = [...new Set([...c1.v, ...c2.v])]
    const wr2: DistractorCandidate = { elements: cell(keyShapeId, union as BarId[]), label: 'WR', mechanism: 'wrongRule:union', wrongAxes: [BARS_AXIS] }

    // D (doc): inner bars fully correct, outer layer wrong — repeats C2's shape (the previous column).
    const c2Shape = ctx.valueAt(SHAPE_AXIS, 3, 2)
    if (c2Shape.t !== 'enum') throw new Error('shape must be enum')
    const ir: DistractorCandidate = { elements: cell(c2Shape.v as ShapeId, keyBars.v as BarId[]), label: 'IR', mechanism: 'stall:outer.shape@prevColumn', wrongAxes: [SHAPE_AXIS] }

    // E (doc): copies R3C2's inner set inside the correct pentagon.
    const rpBars = ctx.valueAt(BARS_AXIS, 3, 2)
    if (rpBars.t !== 'set') throw new Error('bars must be set')
    const rp = repetition('chimera:copyCell:R3C2.bars+correctShape', cell(keyShapeId, rpBars.v as BarId[]), [BARS_AXIS])

    const validSet = (candidates: DistractorCandidate[]): boolean => {
      if (candidates.some((cd) => cd.wrongAxes.length === 0)) return false
      if (candidates.some((cd) => cellEq({ elements: cd.elements }, ctx.keyCell))) return false
      for (let i = 0; i < candidates.length; i++)
        for (let j = i + 1; j < candidates.length; j++) if (cellEq({ elements: candidates[i].elements }, { elements: candidates[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...candidates.map((x) => ({ elements: x.elements }))]
      return contextBlindGate(cells, 0, ctx.axes).ok && giveawayPairGate(cells, ctx.axes).ok
    }

    const docStyle = [wr1, wr2, ir, rp]
    if (validSet(docStyle)) return docStyle

    /**
     * FURTHER FINDING: this construction (three of the four distractors
     * keep the key's shape, matching doc's own M8 option layout 1-for-1)
     * clears the MODAL scorer the same way doc 03-item-generation-
     * pipeline.md Appendix A found for M8 — but fails the CENTROID scorer
     * (qa/contextblind.ts's `centroidPick`), which doc's Appendix A never
     * ran against M8 (it only ever applied the modal-vote check by hand).
     * With 4 of 5 options sharing a shape, the key sits close to every
     * other option in aggregate axis-distance regardless of the modal
     * tally. Fall back to a pool-and-search repair, as elsewhere.
     */
    const shapeValues = SHAPE_LADDER
    const barValues: BarId[][] = [
      [ALL_BARS[0], ALL_BARS[1]],
      [ALL_BARS[0], ALL_BARS[2]],
      [ALL_BARS[1], ALL_BARS[2]],
    ]
    const pool = shapeValues
      .flatMap((s) => barValues.map((b) => ({ shape: s, bars: b })))
      .filter((p) => !(p.shape === keyShapeId && p.bars.length === (keyBars.v as BarId[]).length && p.bars.every((x) => (keyBars.v as BarId[]).includes(x))))
    const labels: Array<'WR' | 'IR'> = ['WR', 'WR', 'IR', 'IR']
    for (const chosen of combinations4(pool)) {
      const candidates: DistractorCandidate[] = chosen.map((p, i) => {
        const wrongAxes = [...(p.shape === keyShapeId ? [] : [SHAPE_AXIS]), ...(p.bars.every((x) => (keyBars.v as BarId[]).includes(x)) && p.bars.length === (keyBars.v as BarId[]).length ? [] : [BARS_AXIS])]
        const mechanism = `recombine:{outer.shape=${p.shape},inner.bars=${p.bars.join('+')}}`
        return { elements: cell(p.shape, p.bars), label: labels[i], mechanism, wrongAxes }
      })
      if (validSet(candidates)) return candidates
    }
    throw new Error(`LRM-XOR-XLAYER: no distractor construction cleared both G-08 and G-10 for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: M8Params) => ({ barRoles: params.barRoles, shapeDir: params.shapeDir }),
}
