/**
 * LRM-XOR-DIST-XLAYER — a NEW family, authored to close the very-hard gap
 * issue #346 identified: none of doc 03-logical-reasoning-design.md's eight
 * exemplars reaches b >= +1.5 once §4.4's formula is applied honestly (see
 * that doc's §4.4 and §6 "Correction" notes — M8, the doc's own intended
 * very-hard anchor, recomputes to +0.9, Hard). This is not a rescale: it is
 * a genuinely harder rule combination the eight exemplars never used —
 * R6 (outer shape, distribution of three, w=0.9) AND R7 (inner bars,
 * symmetric difference, w=1.6) together, cross-layer, in the SAME item.
 * Doc 03-logical-reasoning-design.md §4.1 already predicts this: "hardness
 * beyond three rules is achieved by ... cross-layer rule application ... not
 * by piling on rules" — this family is exactly that, using R7 (the doc's
 * own hardest single rule, §3: "empirically the hardest rule in the
 * Carpenter taxonomy") alongside a genuine second, cross-layer, distributed
 * rule, rather than reusing M8's R1 (weight 0) pairing.
 *
 * Construction reuses two already-proven-safe pieces verbatim:
 *   - outer.shape: the same cyclic-Latin-square construction as M3/M6/M7
 *     (`cyclicLatin`).
 *   - inner.bars: M8's own `missingRoleIndex`/`barsAt` construction, which
 *     that family's header comment proves satisfies R7's XOR relation and
 *     gives every cell in a column a DIFFERENT bar-set.
 *
 * DUPLICATE-SAFETY PROOF (why `kShape` is fixed at 1, not incidental): M8's
 * own proof that its grid is duplicate-free depends on outer.shape being a
 * function of COLUMN ONLY (so a "same missingRoleIndex" group, which spans
 * all three columns, automatically gets three distinct shapes for free).
 * Here outer.shape is a full Latin square — a function of BOTH row and
 * column — so that argument does not transfer unchanged, and had to be
 * re-derived. `missingRoleIndex(row,col) = (col-row) mod 3` is constant
 * along "anti-diagonals" (row-col mod 3 constant); each such group is
 * {(1,1),(2,2),(3,3)}, {(2,1),(3,2),(1,3)} or {(3,1),(1,2),(2,3)} — in every
 * case a TRANSVERSAL of the grid (one cell per row, one cell per column).
 * For a cyclic Latin square `value(row,col) = ladder[(start+(col-1)+k*(row-
 * 1)) mod 3]`, working the three transversals symbolically shows the three
 * shapes on a transversal are ALWAYS a permutation of the full 3-value set
 * (pairwise distinct) when k=1, and ALWAYS contain a repeated pair when
 * k=2 — for every value of `start`, independent of which physical shapes
 * or bars are chosen. (Full derivation: for k=1, each transversal's three
 * shape-ladder indices work out to `{start, start+1, start+2} mod 3` in
 * some order; for k=2, two of the three indices collapse to the same value
 * mod 3.) Combined with M8's own within-column bar-distinctness, this means
 * a k=1 Latin square is duplicate-free (grid-level AND key-vs-context) for
 * EVERY choice of shapeSet/startShape/barRoles/direction — no rejection
 * sampling needed, unlike LRM-2R-XLAYER. `sampleParams` therefore fixes
 * kShape at 1 rather than drawing it (k=2 is provably unsafe for this
 * construction and is not offered as an incidental).
 */
import type { BarId, Element, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, setVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import { chimera, incompleteRule, incompleteSetRule, repetition } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { combinations4 } from '../combinatorics'
import { cellEq } from '../axes'

const SHAPE_AXIS = 'outer.shape'
const BARS_AXIS = 'inner.bars'

const SHAPE_SETS = [
  ['square', 'circle', 'diamond'],
  ['circle', 'triangle', 'square'],
  ['diamond', 'circle', 'triangle'],
  ['square', 'circle', 'pentagon'],
] as const

const ALL_BARS: BarId[] = ['H', 'V', 'D1']
const KSHAPE = 1 // see the file header proof — 2 is unsafe for this construction, not offered.

export interface XorDistParams {
  shapeSet: readonly [string, string, string]
  startShape: 0 | 1 | 2
  /** Which physical bar plays role 0/1/2 in `missingRoleIndex` (M8's own construction, reused verbatim). */
  barRoles: [BarId, BarId, BarId]
}

function cyclicLatin<T>(ladder: readonly T[], k: number, start: number, row: number, col: number): T {
  const idx = (((start + (col - 1) + k * (row - 1)) % 3) + 3) % 3
  return ladder[idx]
}

/** M8's own construction verbatim: bar `barRoles[i]` is missing from cell `(row,col)` whenever `(col-row) mod 3 === i`. Proven there to satisfy `C3 = C1 xor C2` and to give every column's 3 cells pairwise-distinct bar-sets. */
function missingRoleIndex(row: number, col: number): number {
  return (((col - row) % 3) + 3) % 3
}
function barsAt(barRoles: XorDistParams['barRoles'], row: number, col: number): BarId[] {
  const missing = barRoles[missingRoleIndex(row, col)]
  return ALL_BARS.filter((b) => b !== missing)
}
function shapeAt(params: XorDistParams, row: number, col: number): string {
  return cyclicLatin(params.shapeSet, KSHAPE, params.startShape, row, col)
}

function cell(shape: string, bars: readonly BarId[]): Element[] {
  return [
    // Outer size M (not L): M8's own header comment found L pushes an
    // outline square over the G-15 ink ceiling once its clipped bars are
    // added; M keeps every shape in this family's ink budget the same way.
    { type: 'shape', layer: 'outer', shape: shape as ShapeId, fill: 'outline', size: 'M', anchor: 'CTR', rotation: 0 },
    { type: 'bars', layer: 'inner', bars: [...bars].sort(barOrder), clipToOuter: true },
  ]
}
const BAR_ORDER: Record<BarId, number> = { H: 0, V: 1, D1: 2, D2: 3 }
function barOrder(a: BarId, b: BarId): number {
  return BAR_ORDER[a] - BAR_ORDER[b]
}

export const LRM_XOR_DIST_XLAYER: FamilyTemplate<XorDistParams> = {
  code: 'LRM-XOR-DIST-XLAYER',
  axes: [SHAPE_AXIS, BARS_AXIS],
  domains: () => ({
    [SHAPE_AXIS]: { kind: 'unordered-enum' } as AxisDomain,
    [BARS_AXIS]: { kind: 'set' } as AxisDomain,
  }),
  valueAt: (axis, row, col, params) => {
    if (axis === SHAPE_AXIS) return enumVal(shapeAt(params, row, col))
    if (axis === BARS_AXIS) return setVal(barsAt(params.barRoles, row, col))
    throw new Error(`unknown axis ${axis}`)
  },
  ruleSpecs: (params): RuleSpec[] => [
    {
      id: 'R6',
      axis: SHAPE_AXIS,
      direction: 'both',
      params: { values: [...params.shapeSet], rowOffset: KSHAPE },
      statement: `Outer shape forms a Latin square: each of ${params.shapeSet.join(', ')} appears exactly once per row and once per column.`,
    },
    {
      id: 'R7',
      axis: BARS_AXIS,
      direction: 'row_operator',
      params: { op: 'symdiff' },
      statement: 'The third cell in each row contains exactly the bars that appear in exactly one of the first two cells (their symmetric difference).',
    },
  ],
  // Two real rules (R6=0.9, R7=1.6 — the taxonomy's two heaviest single-rule
  // weights bar R7 itself), cross-layer, at the instrument's perceptual-load
  // ceiling of 1 (doc 03-logical-reasoning-design.md §4.1: perceptual
  // organisation held at neutral in this instrument, never higher).
  // predictedB = -2.0 + (0.9+1.6) + 0.5*(2-1) + 0.5*1 + 0.3*1 + 0 = +1.8 ->
  // Very hard, with 0.3 of headroom over the +1.5 threshold from the rule
  // weights and cross-layer term alone — no need to inflate nearMissCount
  // to reach the band.
  radicals: { ruleCount: 2, ruleIds: ['R6', 'R7'], crossLayer: true, perceptualLoad: 1, elementTypes: 4, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'IR', 'PM', 'RP'],
  sampleParams(rng: Rng): XorDistParams {
    const shapeSet = rng.pick(SHAPE_SETS)
    const startShape = rng.int(0, 2) as 0 | 1 | 2
    const barRoles = rng.shuffle(ALL_BARS) as [BarId, BarId, BarId]
    return { shapeSet: shapeSet as unknown as [string, string, string], startShape, barRoles }
  },
  buildCell(values) {
    const shape = values[SHAPE_AXIS]
    const bars = values[BARS_AXIS]
    if (shape.t !== 'enum' || bars.t !== 'set') throw new Error('shape/bars must be enum/set')
    return cell(shape.v, bars.v as BarId[])
  },
  buildDistractors(ctx: DistractorCtx<XorDistParams>) {
    const keyShape = ctx.valueAt(SHAPE_AXIS, 3, 3)
    const keyBars = ctx.valueAt(BARS_AXIS, 3, 3)
    if (keyShape.t !== 'enum' || keyBars.t !== 'set') throw new Error('shape/bars must be enum/set')
    const keyBarsArr = keyBars.v as BarId[]

    // A: IR — shape stalls at R3C1, bars correct.
    const shapeStall = ctx.valueAt(SHAPE_AXIS, 3, 1)
    if (shapeStall.t !== 'enum') throw new Error('shape must be enum')
    const a = incompleteRule('stall:outer.shape@R3C1', cell(shapeStall.v, keyBarsArr), SHAPE_AXIS, keyShape, shapeStall)

    // B: IR — bars near-miss (drop one bar from the correct 2-bar set,
    // leaving a single bar), shape correct. Mirrors M4/M5's "drop an
    // element during the operation" mechanism (doc 03-logical-reasoning-
    // design.md §5.3's canonical IR shape for a set-valued axis).
    const b = incompleteSetRule(`dropElement:inner.bars[${keyBarsArr[0]}]`, cell(keyShape.v, keyBarsArr.filter((x) => x !== keyBarsArr[0])), BARS_AXIS)

    // C: PM — chimera of R3C2's shape + R3C1's bars.
    const cShape = ctx.valueAt(SHAPE_AXIS, 3, 2)
    const cBars = ctx.valueAt(BARS_AXIS, 3, 1)
    if (cShape.t !== 'enum' || cBars.t !== 'set') throw new Error('shape/bars must be enum/set')
    const wrongAxesC = [...(cShape.v === keyShape.v ? [] : [SHAPE_AXIS]), ...(cBars.v.length === keyBarsArr.length && cBars.v.every((x) => (keyBarsArr as readonly string[]).includes(x)) ? [] : [BARS_AXIS])]
    const c = chimera('chimera:{outer.shape<-R3C2,inner.bars<-R3C1}', cell(cShape.v, cBars.v as BarId[]), wrongAxesC)

    // D: RP — full copy of R2C3.
    const dShape = ctx.valueAt(SHAPE_AXIS, 2, 3)
    const dBars = ctx.valueAt(BARS_AXIS, 2, 3)
    if (dShape.t !== 'enum' || dBars.t !== 'set') throw new Error('shape/bars must be enum/set')
    const wrongAxesD = [...(dShape.v === keyShape.v ? [] : [SHAPE_AXIS]), ...(dBars.v.length === keyBarsArr.length && dBars.v.every((x) => (keyBarsArr as readonly string[]).includes(x)) ? [] : [BARS_AXIS])]
    const d = repetition('copyCell:R2C3', cell(dShape.v, dBars.v as BarId[]), wrongAxesD)

    const validSet = (candidates: DistractorCandidate[]): boolean => {
      if (candidates.some((cd) => cd.wrongAxes.length === 0)) return false
      if (candidates.some((cd) => cellEq({ elements: cd.elements }, ctx.keyCell))) return false
      for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) if (cellEq({ elements: candidates[i].elements }, { elements: candidates[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...candidates.map((x) => ({ elements: x.elements }))]
      return contextBlindGate(cells, 0, ctx.axes).ok && giveawayPairGate(cells, ctx.axes).ok
    }

    const primary = [a, b, c, d]
    if (validSet(primary)) return primary

    // Fallback, same pattern as every other multi-rule family in this
    // generator: search a pool of context-cell copies for a 4-subset that
    // clears G-08/G-10 against the fixed key.
    const positions = ctx.grid.map((gc) => {
      const s = ctx.valueAt(SHAPE_AXIS, gc.row, gc.col)
      const bs = ctx.valueAt(BARS_AXIS, gc.row, gc.col)
      if (s.t !== 'enum' || bs.t !== 'set') throw new Error('shape/bars must be enum/set')
      return { row: gc.row, col: gc.col, shape: s.v, bars: bs.v as BarId[] }
    })
    const labels: Array<'IR' | 'PM' | 'RP'> = ['IR', 'IR', 'PM', 'RP']
    for (const chosen of combinations4(positions)) {
      const candidates: DistractorCandidate[] = chosen.map((p, i) => {
        const wrongAxes = [...(p.shape === keyShape.v ? [] : [SHAPE_AXIS]), ...(p.bars.length === keyBarsArr.length && p.bars.every((x) => keyBarsArr.includes(x)) ? [] : [BARS_AXIS])]
        const mechanism = `copyCell:R${p.row}C${p.col}`
        const elements = cell(p.shape, p.bars)
        return labels[i] === 'RP' ? repetition(mechanism, elements, wrongAxes) : chimera(mechanism, elements, wrongAxes)
      })
      if (validSet(candidates)) return candidates
    }
    throw new Error(`LRM-XOR-DIST-XLAYER: no distractor construction cleared both G-08 and G-10 for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: XorDistParams) => ({ startShape: params.startShape, barRoles: params.barRoles }),
}
