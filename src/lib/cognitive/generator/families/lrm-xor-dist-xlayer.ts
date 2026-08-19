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
 * DISTRACTOR REDESIGN (2026-08-19): re-authored to the asymmetric contract
 * (build-plan §1.1). Hard axis: inner.bars (R7 XOR, weight 1.6). Cheap axis:
 * outer.shape (R6 Latin square, weight 0.9). Cheap-rule discount: R6 halves
 * to 0.45, so predicted-b changes from +1.8 to +1.35 (very hard, but lower
 * headroom). The distractor plan (D1/D2/D3 matching key shape + three distinct
 * bar errors, D4 wrong shape + D1 bars) is attempted first; if it fails G-19
 * or G-20, fallback search handles it.
 *
 * Construction reuses two already-proven-safe pieces:
 *   - outer.shape: the same cyclic-Latin-square construction as M3/M6/M7
 *     (`cyclicLatin`).
 *   - inner.bars: the shared four-bar XOR construction in `xor-bars.ts`,
 *     which M8's family (`lrm-xor-xlayer.ts`) also draws from. That file
 *     carries the full derivation: R7's XOR relation holds exactly in every
 *     row (and, incidentally, down every column), and the grid's three
 *     bar-set collision pairs sit at (1,1)&(3,3), (1,2)&(2,3), (2,1)&(3,2).
 *
 * DUPLICATE-SAFETY PROOF (why `kShape` is fixed at 1, not incidental): the
 * bar construction alone leaves three pairs of cells sharing a bar-set, so
 * outer.shape has to separate them. With `kShape = 1` the shape is a
 * function of `(row + col) mod 3`, and the three collision pairs have
 * `(row+col) mod 3` values of (2, 0), (0, 2) and (0, 2) — distinct within
 * every pair, so the two cells always differ in shape. The pair involving
 * the key, (1,1)&(3,3), is separated the same way, so `KEY_EQUALS_CELL`
 * cannot fire either. With `kShape = 2` the shape is a function of
 * `(col - row) mod 3` instead, which is CONSTANT on the anti-diagonals the
 * bar construction's role map follows: all three collision pairs then have
 * `(col-row) mod 3` equal within the pair (0&0, 1&1, 2&2), so all three
 * become genuine duplicate cells and the key coincides with (1,1) for every
 * `start`. So k=1 is duplicate-free for EVERY choice of
 * shapeSet/startShape/barRoles — no rejection sampling needed, unlike
 * LRM-2R-XLAYER — and `sampleParams` fixes kShape at 1 rather than drawing
 * it (k=2 is provably unsafe here and is not offered as an incidental).
 */
import type { BarId, Element, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, setVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import { chimera, repetition } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { cheapEliminationOk, copyEliminationOk, eliminationResistanceOk, singleRuleSufficiencyOk } from '../qa/degeneracy'
import { combinations4 } from '../combinatorics'
import { cellEq } from '../axes'
import { ALL_BAR_IDS, type BarRoles, barsAt as barsAtRole, sameBars, sortBars, twoBarSets } from './xor-bars'

const SHAPE_AXIS = 'outer.shape'
const BARS_AXIS = 'inner.bars'

const SHAPE_SETS = [
  ['square', 'circle', 'diamond'],
  ['circle', 'triangle', 'square'],
  ['diamond', 'circle', 'triangle'],
  ['square', 'circle', 'pentagon'],
] as const

const KSHAPE = 1 // see the file header proof — 2 is unsafe for this construction, not offered.

export interface XorDistParams {
  shapeSet: readonly [string, string, string]
  startShape: 0 | 1 | 2
  /** `[b0, b1, b2, u]` — row `r` omits `b_{r-1}`; see `xor-bars.ts`. */
  barRoles: BarRoles
}

function cyclicLatin<T>(ladder: readonly T[], k: number, start: number, row: number, col: number): T {
  const idx = (((start + (col - 1) + k * (row - 1)) % 3) + 3) % 3
  return ladder[idx]
}

function barsAt(barRoles: BarRoles, row: number, col: number): BarId[] {
  return barsAtRole(barRoles, row, col)
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
    { type: 'bars', layer: 'inner', bars: sortBars(bars), clipToOuter: true },
  ]
}

export const LRM_XOR_DIST_XLAYER: FamilyTemplate<XorDistParams> = {
  code: 'LRM-XOR-DIST-XLAYER',
  axes: [SHAPE_AXIS, BARS_AXIS],
  cheapAxes: [SHAPE_AXIS],
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
  // Two real rules (R6=0.9→0.45 with cheap discount, R7=1.6), cross-layer, at
  // the instrument's perceptual-load ceiling of 1 (doc 03-logical-reasoning-
  // design.md §4.1: perceptual organisation held at neutral in this
  // instrument, never higher).
  // predictedB = -2.0 + (0.45+1.6) + 0.5*(2-1) + 0.5*1 + 0.3*1 + 0 = +1.35 ->
  // Very hard, with cheap-rule discount (build-plan §3). The predicted value
  // reflects that R6 (Latin square, cheap axis) is removed before the hard
  // rule (XOR) decides the item.
  radicals: { ruleCount: 2, ruleIds: ['R6', 'R7'], crossLayer: true, perceptualLoad: 1, elementTypes: 4, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'WR', 'RP', 'RP'],
  sampleParams(rng: Rng): XorDistParams {
    const shapeSet = rng.pick(SHAPE_SETS)
    const startShape = rng.int(0, 2) as 0 | 1 | 2
    const barRoles = rng.shuffle(ALL_BAR_IDS) as BarRoles
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
    const keyShapeVal = keyShape.v
    const keyBarsArr = keyBars.v as BarId[]

    const c1 = ctx.valueAt(BARS_AXIS, 3, 1)
    const c2 = ctx.valueAt(BARS_AXIS, 3, 2)
    if (c1.t !== 'set' || c2.t !== 'set') throw new Error('bars must be set')
    const c1Bars = c1.v as BarId[]
    const c2Bars = c2.v as BarId[]

    const positions = ctx.grid.map((gc) => {
      const s = ctx.valueAt(SHAPE_AXIS, gc.row, gc.col)
      const bs = ctx.valueAt(BARS_AXIS, gc.row, gc.col)
      if (s.t !== 'enum' || bs.t !== 'set') throw new Error('shape/bars must be enum/set')
      return { row: gc.row, col: gc.col, shape: s.v, bars: bs.v as BarId[] }
    })
    const contextCells = positions.map((p) => ({ elements: cell(p.shape, p.bars) }))

    /**
     * ASYMMETRIC CONTRACT (build-plan §1.1, 2026-08-19 redesign).
     *
     * D1 (IR): key shape + "inner.bars minus one element" — ideally a 1-bar
     * set representing the stall error. This will be out-of-vocabulary per
     * G-19 (grid shows only 2-bar sets), but we attempt it anyway; if it
     * clears the gates, use it; if it fails G-19, the fallback search handles
     * it.
     *
     * D2 (WR): key shape + wrong operator (UNION instead of XOR). Apply the
     * same logic as XOR-XLAYER: if union equals XOR, use intersection or
     * operand difference instead.
     *
     * D3 (RP/PM): key shape + copy of one operand bar set (perseveration).
     * Prefer C2; fall back to C1 if needed.
     *
     * D4 (RP): wrong shape (R3C1) + D1 bars (shared hard value with D1).
     */
    const r3c1Shape = ctx.valueAt(SHAPE_AXIS, 3, 1)
    if (r3c1Shape.t !== 'enum') throw new Error('shape must be enum')

    // D1: attempt a 1-bar set.
    const d1Bars: BarId[] = [keyBarsArr[0]]

    // D2: union instead of XOR (wrong operator).
    const union = [...new Set([...c1Bars, ...c2Bars])].sort() as BarId[]
    let d2Bars: BarId[]
    if (union.length === keyBarsArr.length && union.every((b) => keyBarsArr.includes(b))) {
      // Union equals XOR. Use intersection or difference.
      const intersection = c1Bars.filter((b) => c2Bars.includes(b))
      if (intersection.length > 0) {
        d2Bars = intersection as BarId[]
      } else {
        d2Bars = c1Bars.length > c2Bars.length ? c1Bars : c2Bars
      }
    } else {
      d2Bars = union
    }

    // D3: copy one operand (perseveration).
    const d3Bars = c2Bars.length === keyBarsArr.length && c2Bars.every((b) => keyBarsArr.includes(b)) ? c1Bars : c2Bars

    // D4 bars: same as D1.
    const d4Bars = d1Bars

    const d1: DistractorCandidate = { elements: cell(keyShapeVal, d1Bars), label: 'IR', mechanism: 'stall:inner.bars@dropOneElement', wrongAxes: [BARS_AXIS] }
    const d2: DistractorCandidate = { elements: cell(keyShapeVal, d2Bars), label: 'WR', mechanism: 'wrongRule:unionInsteadOfXor', wrongAxes: [BARS_AXIS] }
    const d3: DistractorCandidate = { elements: cell(keyShapeVal, d3Bars), label: 'RP', mechanism: `perseverate:copyOperand:${sameBars(d3Bars, c1Bars) ? 'C1' : 'C2'}`, wrongAxes: [BARS_AXIS] }
    const d4: DistractorCandidate = { elements: cell(r3c1Shape.v, d4Bars), label: 'RP', mechanism: 'incompleteCorrelate:wrongShape@R3C1+sharedHardValue', wrongAxes: [SHAPE_AXIS] }

    const barsEqKey = (bars: readonly BarId[]) => bars.length === keyBarsArr.length && bars.every((x) => keyBarsArr.includes(x))
    const wrongAxesFor = (shape: string, bars: readonly BarId[]) => [...(shape === keyShapeVal ? [] : [SHAPE_AXIS]), ...(barsEqKey(bars) ? [] : [BARS_AXIS])]

    const validSet = (candidates: DistractorCandidate[]): boolean => {
      if (candidates.some((cd) => cd.wrongAxes.length === 0)) return false
      if (candidates.some((cd) => cellEq({ elements: cd.elements }, ctx.keyCell))) return false
      for (let i = 0; i < candidates.length; i++)
        for (let j = i + 1; j < candidates.length; j++) if (cellEq({ elements: candidates[i].elements }, { elements: candidates[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...candidates.map((x) => ({ elements: x.elements }))]
      if (!copyEliminationOk(contextCells, cells, 0)) return false
      if (!cheapEliminationOk(cells, 0, ctx.template.cheapAxes)) return false
      if (!eliminationResistanceOk(contextCells, cells, 0, ctx.axes)) return false
      if (!singleRuleSufficiencyOk(cells, 0, ctx.axes, ctx.template.cheapAxes)) return false
      return contextBlindGate(cells, 0, ctx.axes).ok && giveawayPairGate(cells, ctx.axes).ok
    }

    const planned = [d1, d2, d3, d4]
    if (validSet(planned)) return planned

    /**
     * IN-VOCABULARY PRIMARY SEARCH (2026-08-19). Every visible cell in this
     * construction shows exactly two bars, so the two "wrong operator" sets —
     * union (three bars) and intersection (one bar) — and any one-bar stall
     * are out of vocabulary by construction and G-19 rejects them on sight
     * (which is right: a candidate would too). The plan above therefore
     * never clears the gates, and before this block every item paid for the
     * exhaustive recombination search below (~20 ms/item, 30× the other
     * families — enough to time out the smoke test under CI coverage). The
     * wrong bar sets a candidate CAN be shown are the other two-bar sets:
     * the two operand copies (perseveration, RP), the sets pairing one XOR
     * bar with the row's unused bar (a half-right result, IR), and the
     * shared bar with the unused bar (PM). Three of those, in preference
     * order, on the key's shape; D4 = the wrong shape with D1's bars. The
     * contract (D1–D3 hold the cheap value with three distinct hard errors;
     * D4 breaks the cheap axis and shares D1's hard value) is unchanged —
     * only the mechanisms are the ones this construction can honestly show.
     */
    {
      const allBars = ALL_BAR_IDS
      const usedInRow = new Set<BarId>([...c1Bars, ...c2Bars])
      const unused = allBars.filter((b) => !usedInRow.has(b))
      const inVocab: Array<{ bars: BarId[]; label: 'IR' | 'WR' | 'PM' | 'RP'; mech: string }> = []
      inVocab.push({ bars: sortBars(c1Bars), label: 'RP', mech: 'perseverate:copyOperand:C1' }, { bars: sortBars(c2Bars), label: 'RP', mech: 'perseverate:copyOperand:C2' })
      for (const kb of keyBarsArr) for (const u of unused) inVocab.push({ bars: sortBars([kb, u]), label: 'IR', mech: `stall:oneElementKept:${kb}+unused:${u}` })
      const shared = c1Bars.filter((b) => c2Bars.includes(b))
      for (const sb of shared) for (const u of unused) inVocab.push({ bars: sortBars([sb, u]), label: 'PM', mech: `chimera:sharedBar:${sb}+unused:${u}` })
      const distinct = inVocab.filter((v, i) => !barsEqKey(v.bars) && inVocab.findIndex((w) => sameBars(w.bars, v.bars)) === i)
      for (let i = 0; i < distinct.length; i++)
        for (let j = 0; j < distinct.length; j++)
          for (let k = 0; k < distinct.length; k++) {
            if (i === j || j === k || i === k) continue
            const [p, q, r] = [distinct[i], distinct[j], distinct[k]]
            const cands: DistractorCandidate[] = [
              { elements: cell(keyShapeVal, p.bars), label: p.label, mechanism: p.mech, wrongAxes: [BARS_AXIS] },
              { elements: cell(keyShapeVal, q.bars), label: q.label, mechanism: q.mech, wrongAxes: [BARS_AXIS] },
              { elements: cell(keyShapeVal, r.bars), label: r.label, mechanism: r.mech, wrongAxes: [BARS_AXIS] },
              { elements: cell(r3c1Shape.v, p.bars), label: 'PM', mechanism: 'incompleteCorrelate:wrongShape@R3C1+sharedHardValue', wrongAxes: [SHAPE_AXIS] },
            ]
            if (validSet(cands)) return cands
          }
    }

    /**
     * FALLBACK SEARCH: The planned construction may fail G-19 (in-vocabulary)
     * because the 1-bar set for D1 does not appear in the grid. Search all
     * 2-bar combinations across the 3 shape values (3 shapes × 6 two-bar sets
     * = 18 candidates, minus the key) for a 4-subset that clears all gates.
     * Labels are fixed per the distractorPlan: IR, WR, RP, RP.
     */
    const shapeValues = [...new Set(positions.map((p) => p.shape))]
    const recombinations = shapeValues
      .flatMap((s) => twoBarSets(ctx.params.barRoles).map((bars) => ({ shape: s, bars })))
      .filter((p) => !(p.shape === keyShapeVal && barsEqKey(p.bars)))

    const describe = (shape: string, bars: readonly BarId[]) => {
      const at = positions.find((q) => q.shape === shape && sameBars(q.bars, bars))
      return at ? `copyCell:R${at.row}C${at.col}` : `recombine:{outer.shape=${shape},inner.bars=${bars.join('+')}}`
    }

    const labels: Array<'IR' | 'WR' | 'RP' | 'RP'> = ['IR', 'WR', 'RP', 'RP']
    for (const chosen of combinations4(recombinations)) {
      const candidates: DistractorCandidate[] = chosen.map((p, i) => {
        const wrongAxes = wrongAxesFor(p.shape, p.bars)
        const elements = cell(p.shape, p.bars)
        return labels[i] === 'RP' ? repetition(describe(p.shape, p.bars), elements, wrongAxes) : chimera(describe(p.shape, p.bars), elements, wrongAxes)
      })
      if (validSet(candidates)) return candidates
    }
    throw new Error(`LRM-XOR-DIST-XLAYER: no distractor construction cleared G-08/G-10/G-11/G-18/G-19/G-20 for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: XorDistParams) => ({ startShape: params.startShape, barRoles: params.barRoles }),
}
