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
 * This family avoids it by construction rather than by search, using the
 * four-bar XOR construction in `xor-bars.ts` — see that file for the full
 * derivation and for why the earlier THREE-bar version of it had to be
 * replaced (it made the 9 grid cells exhaust the family's entire 9-cell
 * vocabulary, so no in-vocabulary non-copy distractor could exist and the
 * only available repair was an out-of-vocabulary import that a candidate
 * could eliminate on sight). Briefly: row `r` draws from a three-bar
 * triangle that omits `barRoles[r-1]`, each cell drops one further bar by
 * role, and the result (a) satisfies `C3 = C1 xor C2` exactly in every row,
 * (b) puts the grid's three bar-set collision pairs in different COLUMNS —
 * so `outer.shape`'s column-only dependence separates them and no two cells
 * coincide on both axes, key included — and (c) leaves 9 of the 18
 * (shape, bar-set) combinations unused and available as honest distractors.
 * No search is needed for the GRID; the construction is duplicate-free by
 * proof, not by trial.
 *
 * SIX-OPTION CONTRACT (2026-08-19, build-plan §1.1): asymmetric with
 * hard axis inner.bars (R7 XOR, weight 1.6) and cheap axis outer.shape
 * (R1 progression, weight 0). Predicted-b unchanged at +0.9. D1–D3 hold
 * key shape with three distinct in-vocabulary bar errors; D4–D5 break the
 * cheap axis. Modal computation (per-position majority > 3 of 6): if all
 * six options show the same bars in position i, modal hit rate >= 1/2
 * (fails G-08); if key shape appears in all six, G-20 requires >= 5
 * options to carry key shape. Centroid distance (sum of per-axis differences
 * over 2 axes): key minimizes iff distractor complexity spread is tightly
 * controlled. Elimination gates: G-20 requires >= 5/6 options with key
 * shape on cheap axis and >= 5/6 in their intersection; G-19 requires >= 2
 * in key's (ruleAxisTwin, outOfVocab) class; G-10 requires >= 2 options
 * differing on exactly one axis (giveaway pair). The planned construction
 * attempts first; if it fails G-19, the in-vocabulary search tries three
 * distinct key-shape operand copies + one operand+shared pair, on key
 * shape; D4/D5 = wrong-shape copies of D1 bars (incompleteCorrelate,
 * breaks cheap axis). Fallback searches 5-element subsets of recombined
 * (shape, bars) pairs, with labels fixed IR/WR/RP/RP/RP.
 */
import type { BarId, Element, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, setVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { cheapEliminationOk, copyEliminationOk, eliminationResistanceOk, singleRuleSufficiencyOk } from '../qa/degeneracy'
import { combinations5 } from '../combinatorics'
import { cellEq } from '../axes'
import { ALL_BAR_IDS, type BarRoles, barsAt as barsAtRole, sameBars, sortBars, twoBarSets } from './xor-bars'

const SHAPE_AXIS = 'outer.shape'
const BARS_AXIS = 'inner.bars'

/** Side-count ladders: 3-4-5 (v1) and 4-5-6 (v3, hexagon joined the vocabulary) — a per-item incidental. */
const SHAPE_LADDERS: readonly ShapeId[][] = [
  ['triangle', 'square', 'pentagon'],
  ['square', 'pentagon', 'hexagon'],
]

export interface M8Params {
  /** `[b0, b1, b2, u]` — row `r` omits `b_{r-1}`; see `xor-bars.ts`. */
  barRoles: BarRoles
  /** Column direction of the side-count progression. */
  shapeDir: 1 | -1
  /** Index into SHAPE_LADDERS. */
  ladderIdx: 0 | 1
}

function barsAt(params: M8Params, row: number, col: number): BarId[] {
  return barsAtRole(params.barRoles, row, col)
}

function shapeAt(params: M8Params, col: number): ShapeId {
  const ladder = SHAPE_LADDERS[params.ladderIdx]
  const idx = params.shapeDir === 1 ? col - 1 : ladder.length - col
  return ladder[idx]
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
    { type: 'bars', layer: 'inner', bars: sortBars(bars), clipToOuter: true },
  ]
}

export const LRM_XOR_XLAYER: FamilyTemplate<M8Params> = {
  code: 'LRM-XOR-XLAYER',
  axes: [BARS_AXIS, SHAPE_AXIS],
  cheapAxes: [SHAPE_AXIS],
  domains: (params) => ({
    [SHAPE_AXIS]: { kind: 'ordered-enum', ladder: SHAPE_LADDERS[params.ladderIdx].map(enumVal) } as AxisDomain,
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
      params: { ladder: SHAPE_LADDERS[params.ladderIdx], stepPerColumn: params.shapeDir, stepPerRow: 0 },
      statement: 'The outer polygon gains one side per column (triangle, square, pentagon), the same in every row.',
    },
  ],
  radicals: { ruleCount: 2, ruleIds: ['R7', 'R1'], crossLayer: true, perceptualLoad: 1, elementTypes: 4, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'WR', 'RP', 'RP', 'RP'],
  sampleParams(rng: Rng): M8Params {
    const barRoles = rng.shuffle(ALL_BAR_IDS) as BarRoles
    const shapeDir = rng.pick([1, -1] as const)
    const ladderIdx = rng.pick([0, 1] as const)
    return { barRoles, shapeDir, ladderIdx }
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
    const keyBarsArr = keyBars.v as BarId[]
    const keyShapeId = keyShape.v as ShapeId

    const c1 = ctx.valueAt(BARS_AXIS, 3, 1)
    const c2 = ctx.valueAt(BARS_AXIS, 3, 2)
    if (c1.t !== 'set' || c2.t !== 'set') throw new Error('bars must be set')
    const c1Bars = c1.v as BarId[]
    const c2Bars = c2.v as BarId[]

    const contextCells = ctx.grid.map((gc) => ({ elements: gc.elements }))

    /**
     * ASYMMETRIC CONTRACT (build-plan §1.1, 2026-08-19 redesign, six options).
     *
     * D1 (IR): key shape + "XOR result minus one bar" — ideally a 1-bar set
     * representing the stall error. Out-of-vocabulary per G-19; attempted
     * first, fallback search handles if it fails.
     *
     * D2 (WR): key shape + wrong operator (UNION instead of XOR). Apply the
     * same logic as before: if union equals XOR, use intersection or difference.
     *
     * D3 (RP): key shape + copy of one operand bar set (perseveration).
     * Prefer C2; fall back to C1 if needed.
     *
     * D4 (RP): wrong shape (R3C2) + D1 bars (shared hard value with D1).
     *
     * D5 (RP): another wrong shape + D1 bars. On six options, break the
     * cheap axis with two distinct wrong shapes.
     */
    const c2Shape = ctx.valueAt(SHAPE_AXIS, 3, 2)
    if (c2Shape.t !== 'enum') throw new Error('shape must be enum')
    const c2ShapeId = c2Shape.v as ShapeId

    // Find a third shape for D5 (different from keyShape and c2Shape).
    let d5ShapeId: ShapeId = 'triangle'
    for (const candidate of SHAPE_LADDERS[ctx.params.ladderIdx]) {
      if (candidate !== keyShapeId && candidate !== c2ShapeId) {
        d5ShapeId = candidate
        break
      }
    }

    // D1: attempt a 1-bar set (lose one bar from the 2-bar result).
    const d1Bars: BarId[] = [keyBarsArr[0]]

    // D2: union instead of XOR (wrong operator).
    const union = [...new Set([...c1Bars, ...c2Bars])].sort() as BarId[]
    let d2Bars: BarId[]
    if (union.length === keyBarsArr.length && union.every((b) => keyBarsArr.includes(b))) {
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

    // D4 and D5 bars: same as D1.
    const d4Bars = d1Bars
    const d5Bars = d1Bars

    const d1: DistractorCandidate = { elements: cell(keyShapeId, d1Bars), label: 'IR', mechanism: 'stall:inner.bars@dropOneElement', wrongAxes: [BARS_AXIS] }
    const d2: DistractorCandidate = { elements: cell(keyShapeId, d2Bars), label: 'WR', mechanism: 'wrongRule:unionInsteadOfXor', wrongAxes: [BARS_AXIS] }
    const d3: DistractorCandidate = { elements: cell(keyShapeId, d3Bars), label: 'RP', mechanism: `perseverate:copyOperand:${sameBars(d3Bars, c1Bars) ? 'C1' : 'C2'}`, wrongAxes: [BARS_AXIS] }
    const d4: DistractorCandidate = { elements: cell(c2ShapeId, d4Bars), label: 'RP', mechanism: 'incompleteCorrelate:wrongShape@R3C2+sharedHardValue', wrongAxes: [SHAPE_AXIS] }
    const d5: DistractorCandidate = { elements: cell(d5ShapeId, d5Bars), label: 'RP', mechanism: 'incompleteCorrelate:wrongShape+sharedHardValue', wrongAxes: [SHAPE_AXIS] }

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

    const planned = [d1, d2, d3, d4, d5]
    if (validSet(planned)) return planned

    /**
     * IN-VOCABULARY PRIMARY SEARCH (2026-08-19, six options). Every visible
     * cell shows exactly two bars, so 1-bar (union/intersection/stall) are
     * out-of-vocabulary and G-19 rejects them. The plan above therefore never
     * clears the gates, and this block searches for honest in-vocabulary
     * constructions. Honest bar sets are the two operand copies (RP), pairs
     * of one XOR bar with the unused bar (IR), and shared bar with unused
     * (PM). Four of those on the key's shape; D4/D5 = wrong shapes with D1's
     * bars. The contract (D1–D3 hold key shape with three distinct hard
     * errors; D4–D5 break the cheap axis and share D1's hard value) extends
     * to six options — only the mechanisms change to match this construction.
     */
    {
      const allBars = ALL_BAR_IDS
      const barsEqKey = (bars: readonly BarId[]) => bars.length === keyBarsArr.length && bars.every((x) => keyBarsArr.includes(x))
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
          for (let k = 0; k < distinct.length; k++)
            for (let l = 0; l < distinct.length; l++) {
              if (i === j || i === k || i === l || j === k || j === l || k === l) continue
              const [p, q, r, s] = [distinct[i], distinct[j], distinct[k], distinct[l]]
              // Six-option asymmetric contract (v3 build plan §1): D1–D4 hold the
              // key's shape with four distinct in-vocabulary wrong bar sets; D5
              // breaks the cheap axis (the stall shape, R3C2's) and shares D1's
              // bars. 5 of 6 options carry the key's shape — G-20's ≥ N−1.
              const cands: DistractorCandidate[] = [
                { elements: cell(keyShapeId, p.bars), label: p.label, mechanism: p.mech, wrongAxes: [BARS_AXIS] },
                { elements: cell(keyShapeId, q.bars), label: q.label, mechanism: q.mech, wrongAxes: [BARS_AXIS] },
                { elements: cell(keyShapeId, r.bars), label: r.label, mechanism: r.mech, wrongAxes: [BARS_AXIS] },
                { elements: cell(keyShapeId, s.bars), label: s.label, mechanism: s.mech, wrongAxes: [BARS_AXIS] },
                { elements: cell(c2ShapeId, p.bars), label: 'PM', mechanism: 'incompleteCorrelate:wrongShape@R3C2+sharedHardValue', wrongAxes: [SHAPE_AXIS] },
              ]
              if (validSet(cands)) return cands
            }
    }

    /**
     * FALLBACK SEARCH: The planned construction may fail G-19 (in-vocabulary)
     * because the 1-bar set for D1 does not appear in the grid. Search all
     * 2-bar combinations (the 6 two-bar sets across 3 shapes = 18 candidates,
     * minus the key) for a 5-subset that clears all gates. Labels are fixed
     * per the distractorPlan: IR, WR, RP, RP, RP.
     */
    const pool = SHAPE_LADDERS[ctx.params.ladderIdx].flatMap((s) => twoBarSets(ctx.params.barRoles).map((b) => ({ shape: s, bars: b }))).filter((p) => !(p.shape === keyShapeId && sameBars(p.bars, keyBarsArr)))
    const labels: Array<'IR' | 'WR' | 'RP' | 'RP' | 'RP'> = ['IR', 'WR', 'RP', 'RP', 'RP']
    for (const chosen of combinations5(pool)) {
      const candidates: DistractorCandidate[] = chosen.map((p, i) => {
        const wrongAxes = [...(p.shape === keyShapeId ? [] : [SHAPE_AXIS]), ...(sameBars(p.bars, keyBarsArr) ? [] : [BARS_AXIS])]
        const mechanism = `recombine:{outer.shape=${p.shape},inner.bars=${p.bars.join('+')}}`
        return { elements: cell(p.shape, p.bars), label: labels[i], mechanism, wrongAxes }
      })
      if (validSet(candidates)) return candidates
    }
    throw new Error(`LRM-XOR-XLAYER: no distractor construction cleared G-08/G-10/G-11/G-18/G-19/G-20 for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: M8Params) => ({ barRoles: params.barRoles, shapeDir: params.shapeDir, ladderIdx: params.ladderIdx }),
}
