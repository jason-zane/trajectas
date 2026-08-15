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
import { chimera, incompleteRule, incompleteSetRule, repetition } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { copyEliminationOk, eliminationResistanceOk, singleRuleSufficiencyOk } from '../qa/degeneracy'
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
    const keyBarsArr = keyBars.v as BarId[]

    // A: IR — shape stalls at R3C1, bars correct.
    const shapeStall = ctx.valueAt(SHAPE_AXIS, 3, 1)
    if (shapeStall.t !== 'enum') throw new Error('shape must be enum')
    const a = incompleteRule('stall:outer.shape@R3C1', cell(shapeStall.v, keyBarsArr), SHAPE_AXIS, keyShape, shapeStall)

    // B: IR — the operator applied to the right operands, but cancelling the
    // WRONG bar. Row 3's two operands share exactly one bar (that is what
    // makes their symmetric difference a two-bar set); a solver who cancels
    // one of the DIFFERING bars instead lands on R3C1's or R3C2's own set,
    // still inside the key's shape.
    //
    // FINDING, and the correction this replaces: B used to be "drop one bar
    // from the correct two-bar set", producing a ONE-bar cell — and the
    // previous fix leaned on that explicitly, arguing that because no grid
    // cell shows one bar, B was "a genuinely novel figure". It is the
    // opposite: a figure whose bar count appears in zero visible cells is
    // eliminable by counting, with no rule extraction at all. Chained behind
    // copy-elimination it isolated the key in 129 of 129 items measured. Both
    // variants below are two-bar figures drawn from the item's own
    // vocabulary; `validSet` now runs G-19 (`eliminationResistanceOk`), which
    // rejects the old shape outright.
    const r3c1Bars = ctx.valueAt(BARS_AXIS, 3, 1)
    const r3c2Bars = ctx.valueAt(BARS_AXIS, 3, 2)
    if (r3c1Bars.t !== 'set' || r3c2Bars.t !== 'set') throw new Error('bars must be set')
    const bVariants = [
      { col: 1, bars: r3c1Bars.v as BarId[] },
      { col: 2, bars: r3c2Bars.v as BarId[] },
    ].map(({ col, bars }) => incompleteSetRule(`cancelWrongBar:inner.bars@R3C${col}`, cell(keyShape.v, bars), BARS_AXIS))

    const positions = ctx.grid.map((gc) => {
      const s = ctx.valueAt(SHAPE_AXIS, gc.row, gc.col)
      const bs = ctx.valueAt(BARS_AXIS, gc.row, gc.col)
      if (s.t !== 'enum' || bs.t !== 'set') throw new Error('shape/bars must be enum/set')
      return { row: gc.row, col: gc.col, shape: s.v, bars: bs.v as BarId[] }
    })
    const contextCells = positions.map((p) => ({ elements: cell(p.shape, p.bars) }))
    const barsEqKey = (bars: readonly string[]) => bars.length === keyBarsArr.length && bars.every((x) => (keyBarsArr as readonly string[]).includes(x))
    const wrongAxesFor = (shape: string, bars: readonly string[]) => [...(shape === keyShape.v ? [] : [SHAPE_AXIS]), ...(barsEqKey(bars) ? [] : [BARS_AXIS])]

    const validSet = (candidates: DistractorCandidate[]): boolean => {
      if (candidates.some((cd) => cd.wrongAxes.length === 0)) return false
      if (candidates.some((cd) => cellEq({ elements: cd.elements }, ctx.keyCell))) return false
      for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) if (cellEq({ elements: candidates[i].elements }, { elements: candidates[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...candidates.map((x) => ({ elements: x.elements }))]
      if (!copyEliminationOk(contextCells, cells, 0)) return false
      if (!eliminationResistanceOk(contextCells, cells, 0, ctx.axes)) return false
      if (!singleRuleSufficiencyOk(cells, 0, ctx.axes)) return false
      return contextBlindGate(cells, 0, ctx.axes).ok && giveawayPairGate(cells, ctx.axes).ok
    }

    /**
     * FINDING (the hand-authored plan was DEAD CODE): C and D as originally
     * written — "chimera of R3C2's shape + R3C1's bars" and "full copy of
     * R2C3" — are the SAME CELL by construction, for every parameter draw,
     * so `gateDistractor` rejected the set as DUPLICATE_DISTRACTOR_PAIR and
     * the primary plan executed 0 times in 300 draws. Proof: `KSHAPE` is
     * fixed at 1, so `shapeAt(r,c)` depends only on `(r + c) mod 3` and
     * R3C2 and R2C3 share it; `missingRoleIndex(r,c)` depends only on
     * `(c - r) mod 3` and `missingRoleIndex(3,1) === missingRoleIndex(2,3)
     * === 1`, so R3C1 and R2C3 share their bar-set. C and D therefore
     * coincide on both axes, always. Every item fell through to the copy
     * fallback below, which is where the copy-elimination leak came from.
     *
     * B, C and D are now SEARCHED rather than hand-pinned, in a fixed
     * deterministic order, keeping A (which is sound) fixed.
     */
    const shapeValues = [...new Set(positions.map((p) => p.shape))]
    const recombinations = shapeValues
      .flatMap((s) => twoBarSets(ctx.params.barRoles).map((bars) => ({ shape: s, bars })))
      .filter((p) => !(p.shape === keyShape.v && barsEqKey(p.bars)))
    const describe = (shape: string, bars: readonly BarId[]) => {
      const at = positions.find((q) => q.shape === shape && sameBars(q.bars, bars))
      return at ? `copyCell:R${at.row}C${at.col}` : `recombine:{outer.shape=${shape},inner.bars=${bars.join('+')}}`
    }

    for (const b of bVariants) {
      for (const dPos of positions) {
        const d = repetition(`copyCell:R${dPos.row}C${dPos.col}`, cell(dPos.shape, dPos.bars), wrongAxesFor(dPos.shape, dPos.bars))
        for (const cCand of recombinations) {
          const c = chimera(describe(cCand.shape, cCand.bars), cell(cCand.shape, cCand.bars), wrongAxesFor(cCand.shape, cCand.bars))
          const candidates = [a, b, c, d]
          if (validSet(candidates)) return candidates
        }
      }
    }

    // Last resort, same pattern as every other multi-rule family here: a full
    // 4-subset search over the recombination pool — 3 shapes x the 6 two-bar
    // sets the widened vocabulary affords, minus the key's own combination.
    const labels: Array<'IR' | 'PM' | 'RP'> = ['IR', 'IR', 'PM', 'RP']
    for (const chosen of combinations4(recombinations)) {
      const candidates: DistractorCandidate[] = chosen.map((p, i) => {
        const wrongAxes = wrongAxesFor(p.shape, p.bars)
        const elements = cell(p.shape, p.bars)
        return labels[i] === 'RP' ? repetition(describe(p.shape, p.bars), elements, wrongAxes) : chimera(describe(p.shape, p.bars), elements, wrongAxes)
      })
      if (validSet(candidates)) return candidates
    }
    throw new Error(`LRM-XOR-DIST-XLAYER: no distractor construction cleared G-08/G-10/G-11/G-18/G-19 for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: XorDistParams) => ({ startShape: params.startShape, barRoles: params.barRoles }),
}
