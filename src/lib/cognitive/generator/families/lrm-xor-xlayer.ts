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
 */
import type { BarId, Element, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, setVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import { repetition } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { copyEliminationOk, eliminationResistanceOk, singleRuleSufficiencyOk } from '../qa/degeneracy'
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

    const contextCells = ctx.grid.map((gc) => ({ elements: gc.elements }))

    const validSet = (candidates: DistractorCandidate[]): boolean => {
      if (candidates.some((cd) => cd.wrongAxes.length === 0)) return false
      if (candidates.some((cd) => cellEq({ elements: cd.elements }, ctx.keyCell))) return false
      for (let i = 0; i < candidates.length; i++)
        for (let j = i + 1; j < candidates.length; j++) if (cellEq({ elements: candidates[i].elements }, { elements: candidates[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...candidates.map((x) => ({ elements: x.elements }))]
      if (!copyEliminationOk(contextCells, cells, 0)) return false
      if (!eliminationResistanceOk(contextCells, cells, 0, ctx.axes)) return false
      if (!singleRuleSufficiencyOk(cells, 0, ctx.axes)) return false
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
    /**
     * SECOND FINDING (the copy-elimination leak, G-11) AND ITS CORRECTION.
     * The recombination pool this fallback originally searched was the 3
     * shapes x the 3 TWO-bar sets a three-bar universe affords — and that is
     * exactly the 9 cells of the grid. Every 4-subset of it was therefore
     * four verbatim copies of visible cells, and since the key was the one
     * combination the grid did not show, "eliminate every option that
     * reproduces a cell" identified the key in 84 of 84 items measured.
     *
     * The first repair added the ONE-bar and THREE-bar sets (what the
     * intersection and union wrong-operator errors produce). That did not
     * work, and could not have: no cell in a three-bar grid shows one or
     * three bars, so the imported option was eliminable by a second
     * rule-blind cue and the pair (copy-elimination, then "that bar count is
     * impossible") isolated the key in 121 of 121 items measured. It is the
     * same escape hatch `families/lrm-dist3x2.ts` was unregistered for
     * reaching, and the theorem there applies here verbatim: while the grid
     * exhausts the vocabulary, EVERY non-key non-copy must carry a feature
     * value appearing in zero visible cells.
     *
     * The real repair is upstream, in `xor-bars.ts`: the bar universe is now
     * all four schema bar positions, so the grid's 9 cells consume only 9 of
     * 18 (shape, bar-set) combinations and the remaining 9 are honest
     * two-bar figures built from bars the candidate has already seen. THIS
     * pool is exactly those in-vocabulary combinations. It deliberately does
     * NOT carry one- or three-bar sets: `validSet` now also runs G-19
     * (`eliminationResistanceOk`), which would reject a set relying on them.
     */
    const pool = SHAPE_LADDER.flatMap((s) => twoBarSets(ctx.params.barRoles).map((b) => ({ shape: s, bars: b }))).filter((p) => !(p.shape === keyShapeId && sameBars(p.bars, keyBars.v)))
    const labels: Array<'WR' | 'IR'> = ['WR', 'WR', 'IR', 'IR']
    for (const chosen of combinations4(pool)) {
      const candidates: DistractorCandidate[] = chosen.map((p, i) => {
        const wrongAxes = [...(p.shape === keyShapeId ? [] : [SHAPE_AXIS]), ...(sameBars(p.bars, keyBars.v) ? [] : [BARS_AXIS])]
        const mechanism = `recombine:{outer.shape=${p.shape},inner.bars=${p.bars.join('+')}}`
        return { elements: cell(p.shape, p.bars), label: labels[i], mechanism, wrongAxes }
      })
      if (validSet(candidates)) return candidates
    }
    throw new Error(`LRM-XOR-XLAYER: no distractor construction cleared G-08/G-10/G-11/G-18/G-19 for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: M8Params) => ({ barRoles: params.barRoles, shapeDir: params.shapeDir }),
}
