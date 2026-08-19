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
 * DISTRACTOR REDESIGN (2026-08-19): re-authored to the asymmetric contract
 * (build-plan §1.1). Hard axis: inner.bars (R7 XOR, weight 1.6). Cheap axis:
 * outer.shape (R1 progression, weight 0). Since R1's weight is 0, the
 * predicted-b of +0.9 is unchanged. The distractor plan (D1/D2/D3 matching
 * key shape + three distinct bar errors, D4 wrong shape + D1 bars) is
 * attempted first; if it fails G-19 (in-vocabulary), fallback search handles
 * it like before.
 */
import type { BarId, Element, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, setVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { cheapEliminationOk, copyEliminationOk, eliminationResistanceOk, singleRuleSufficiencyOk } from '../qa/degeneracy'
import { combinations4 } from '../combinatorics'
import { cellEq } from '../axes'
import { ALL_BAR_IDS, type BarRoles, barsAt as barsAtRole, sameBars, sortBars, twoBarSets } from './xor-bars'

const SHAPE_AXIS = 'outer.shape'
const BARS_AXIS = 'inner.bars'

/** Sides 3, 4, 5 — the only three regular-polygon shapes in the vocabulary with that side count. */
const SHAPE_LADDER: ShapeId[] = ['triangle', 'square', 'pentagon']

export interface M8Params {
  /** `[b0, b1, b2, u]` — row `r` omits `b_{r-1}`; see `xor-bars.ts`. */
  barRoles: BarRoles
  /** Column direction of the side-count progression. */
  shapeDir: 1 | -1
}

function barsAt(params: M8Params, row: number, col: number): BarId[] {
  return barsAtRole(params.barRoles, row, col)
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
    { type: 'bars', layer: 'inner', bars: sortBars(bars), clipToOuter: true },
  ]
}

export const LRM_XOR_XLAYER: FamilyTemplate<M8Params> = {
  code: 'LRM-XOR-XLAYER',
  axes: [BARS_AXIS, SHAPE_AXIS],
  cheapAxes: [SHAPE_AXIS],
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
  distractorPlan: ['IR', 'WR', 'RP', 'RP'],
  sampleParams(rng: Rng): M8Params {
    const barRoles = rng.shuffle(ALL_BAR_IDS) as BarRoles
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
    const keyBarsArr = keyBars.v as BarId[]
    const keyShapeId = keyShape.v as ShapeId

    const c1 = ctx.valueAt(BARS_AXIS, 3, 1)
    const c2 = ctx.valueAt(BARS_AXIS, 3, 2)
    if (c1.t !== 'set' || c2.t !== 'set') throw new Error('bars must be set')
    const c1Bars = c1.v as BarId[]
    const c2Bars = c2.v as BarId[]

    const contextCells = ctx.grid.map((gc) => ({ elements: gc.elements }))

    /**
     * ASYMMETRIC CONTRACT (build-plan §1.1, 2026-08-19 redesign).
     *
     * D1 (IR): key shape + "XOR result minus one bar" — ideally a 1-bar set
     * representing the stall error (lost one element from the XOR). This will
     * be out-of-vocabulary per G-19 (grid shows only 2-bar sets), but we
     * attempt it anyway; if it clears the gates, use it; if it fails G-19, the
     * fallback search handles it.
     *
     * D2 (WR): key shape + wrong operator (UNION instead of XOR). If operands
     * are disjoint (share zero bars), UNION = 4 bars; if they share 1 bar, UNION
     * = 3 bars; if they share both bars, UNION = 2 bars (same as key). In the
     * last case, use INTERSECTION (0 bars) if available; otherwise use operand
     * difference (keep C1 only, or C2 only, whichever differs from the key).
     *
     * D3 (RP/PM): key shape + copy of one operand bar set (perseveration).
     * Prefer C2 (the more recent/salient operand); fall back to C1 if needed.
     *
     * D4 (RP): wrong shape (R3C2) + D1 bars (shared hard value with D1).
     */
    const c2Shape = ctx.valueAt(SHAPE_AXIS, 3, 2)
    if (c2Shape.t !== 'enum') throw new Error('shape must be enum')
    const c2ShapeId = c2Shape.v as ShapeId

    // D1: attempt a 1-bar set (lose one bar from the 2-bar result).
    const d1Bars: BarId[] = [keyBarsArr[0]] // Just the first bar of the XOR result

    // D2: union instead of XOR (wrong operator).
    const union = [...new Set([...c1Bars, ...c2Bars])].sort() as BarId[]
    let d2Bars: BarId[]
    if (union.length === keyBarsArr.length && union.every((b) => keyBarsArr.includes(b))) {
      // Union equals XOR (operands are disjoint or both equal). Use intersection or difference.
      const intersection = c1Bars.filter((b) => c2Bars.includes(b))
      if (intersection.length > 0) {
        d2Bars = intersection as BarId[]
      } else {
        // Operands are disjoint; use the difference (one operand only).
        d2Bars = c1Bars.length > c2Bars.length ? c1Bars : c2Bars
      }
    } else {
      d2Bars = union
    }

    // D3: copy one operand (perseveration).
    const d3Bars = c2Bars.length === keyBarsArr.length && c2Bars.every((b) => keyBarsArr.includes(b)) ? c1Bars : c2Bars

    // D4 bars: same as D1.
    const d4Bars = d1Bars

    const d1: DistractorCandidate = { elements: cell(keyShapeId, d1Bars), label: 'IR', mechanism: 'stall:inner.bars@dropOneElement', wrongAxes: [BARS_AXIS] }
    const d2: DistractorCandidate = { elements: cell(keyShapeId, d2Bars), label: 'WR', mechanism: 'wrongRule:unionInsteadOfXor', wrongAxes: [BARS_AXIS] }
    const d3: DistractorCandidate = { elements: cell(keyShapeId, d3Bars), label: 'RP', mechanism: `perseverate:copyOperand:${sameBars(d3Bars, c1Bars) ? 'C1' : 'C2'}`, wrongAxes: [BARS_AXIS] }
    const d4: DistractorCandidate = { elements: cell(c2ShapeId, d4Bars), label: 'RP', mechanism: 'incompleteCorrelate:wrongShape@R3C2+sharedHardValue', wrongAxes: [SHAPE_AXIS] }

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
          for (let k = 0; k < distinct.length; k++) {
            if (i === j || j === k || i === k) continue
            const [p, q, r] = [distinct[i], distinct[j], distinct[k]]
            const cands: DistractorCandidate[] = [
              { elements: cell(keyShapeId, p.bars), label: p.label, mechanism: p.mech, wrongAxes: [BARS_AXIS] },
              { elements: cell(keyShapeId, q.bars), label: q.label, mechanism: q.mech, wrongAxes: [BARS_AXIS] },
              { elements: cell(keyShapeId, r.bars), label: r.label, mechanism: r.mech, wrongAxes: [BARS_AXIS] },
              { elements: cell(c2ShapeId, p.bars), label: 'PM', mechanism: 'incompleteCorrelate:wrongShape@R3C2+sharedHardValue', wrongAxes: [SHAPE_AXIS] },
            ]
            if (validSet(cands)) return cands
          }
    }

    /**
     * FALLBACK SEARCH: The planned construction may fail G-19 (in-vocabulary)
     * because the 1-bar set for D1 does not appear in the grid. Search all
     * 2-bar combinations (the 6 two-bar sets across 3 shapes = 18 candidates,
     * minus the key) for a 4-subset that clears all gates. Labels are fixed
     * per the distractorPlan: IR, WR, RP, RP.
     */
    const pool = SHAPE_LADDER.flatMap((s) => twoBarSets(ctx.params.barRoles).map((b) => ({ shape: s, bars: b }))).filter((p) => !(p.shape === keyShapeId && sameBars(p.bars, keyBarsArr)))
    const labels: Array<'IR' | 'WR' | 'RP' | 'RP'> = ['IR', 'WR', 'RP', 'RP']
    for (const chosen of combinations4(pool)) {
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
  structuralExtra: (params: M8Params) => ({ barRoles: params.barRoles, shapeDir: params.shapeDir }),
}
