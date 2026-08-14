/**
 * LRM-3R-XLAYER — a second NEW family closing the very-hard gap issue #346
 * identified (see `lrm-xor-dist-xlayer.ts`'s header for the first). Doc 03-
 * logical-reasoning-design.md §9.1's own blueprint-coverage table always
 * called for THREE very-hard families to give the form assembler a real
 * choice, not one — this is the second.
 *
 * Where `LRM-XOR-DIST-XLAYER` reaches very-hard through R7's weight (the
 * taxonomy's single heaviest rule), this family reaches it a different way:
 * genuine THREE-RULE composition (like M7) made cross-layer (like M6),
 * neither of which alone was doc's very-hard exemplar. Construction:
 *
 *   - outer.shape and outer.fill: the SAME fully-orthogonal cyclic Graeco-
 *     Latin-square construction LRM-DIST3X2 (M3's family) uses — kShape and
 *     kFill drawn from {[1,2],[2,1]} so every (shape, fill) pair across the
 *     9 cells is realised exactly once (that family's own proof).
 *   - inner.rotation: a tick, R2, cross-layer, reusing LRM-2R-XLAYER's
 *     (M6's family) 45deg-magnitude construction.
 *
 * DUPLICATE SAFETY, PROVED (not searched): LRM-DIST3X2's own header comment
 * proves that when kShape != kFill (both nonzero mod 3), the pair
 * (shape, fill) alone already takes a DIFFERENT value in every one of the 9
 * cells — a full Graeco-Latin square. That is already a strictly stronger
 * guarantee than this family needs: any two cells already differ on
 * (shape, fill) before rotation is even considered, so the full
 * (shape, fill, rotation) triple is automatically unique too, for EVERY
 * choice of rotation parameters. Unlike LRM-2R-XLAYER (M6's family), which
 * needs rejection sampling because ITS shape axis is a single (non-
 * orthogonal) Latin square, this family needs none — the orthogonality
 * already does the work. `rotBase` is free to vary as a full incidental
 * (0/45/.../315) with no safety check required.
 */
import type { Element, Fill, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, numVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import { chimera } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { copyEliminationOk, singleRuleSufficiencyOk } from '../qa/degeneracy'
import { combinations4 } from '../combinatorics'
import { cellEq } from '../axes'

const SHAPE_AXIS = 'outer.shape'
const FILL_AXIS = 'outer.fill'
const ROT_AXIS = 'inner.rotation'
const TICK_LENGTH = 30

/**
 * SECOND DEFECT, FIXED (the rotation rule was aliased, and the aliasing made
 * the whole three-rule claim false).
 *
 * The original construction used the SAME 45deg magnitude for the per-column
 * and the per-row step: `rotBase + 45*(col-1) + 45*(row-1)`. That is a
 * function of `row + col` alone. `row + col` takes only 5 values over a 3x3
 * grid, so the rotation axis showed 5 distinct angles across 9 cells — and
 * `row + col === 6` happens at exactly one cell, R3C3. The key's tick angle
 * therefore appeared in NO visible cell, in every single item, which made the
 * tick alone sufficient to pick the key out of any option set drawn from
 * visible values: measured over 12 seeds, the rotation rule alone isolated
 * the key in 129 of 129 items (116 of 116 on this run's seeds). The two Latin
 * squares — 1.8 of the declared b of +2.35 — did no discriminating work at
 * all; declared honestly as the one rule that was actually load-bearing, the
 * item computed to b = -0.45, `moderate`.
 *
 * The fix is to make the two steps differ in magnitude. With 45deg per column
 * and 135deg per row (or the swap — both are offered as an incidental, and
 * both are magnitudes doc 03-logical-reasoning-design.md §3 lists for R2),
 * the 9 cells run 0/45/90 : 135/180/225 : 270/315/(360=0). All eight
 * multiples of 45 are used; `row + col` no longer determines the angle
 * (R1C3 and R3C1 now differ, where before they were forced equal); and the
 * key's own angle coincides with R1C1's, so it is not "the one angle nobody
 * has seen". `2*45 + 2*135 = 360 = 0 (mod 360)` is what makes that last
 * property hold for both orderings.
 *
 * This does NOT by itself fix the isolation — an option set can still fail to
 * carry the key's angle. That is fixed in `buildDistractors` below and gated
 * by G-18 (`qa/degeneracy.ts`'s `singleRuleSufficiencyCheck`). The aliasing
 * fix is what makes a non-isolating option set constructible from realised
 * values in the first place.
 */
const ROT_STEP_PAIRS = [
  { col: 45, row: 135 },
  { col: 135, row: 45 },
] as const

const SHAPE_SETS = [
  ['square', 'circle', 'diamond'],
  ['circle', 'triangle', 'square'],
  ['diamond', 'circle', 'triangle'],
  ['square', 'circle', 'pentagon'],
] as const
const FILL_LADDER = ['outline', 'solid', 'hatched'] as const

export interface ThreeRXLayerParams {
  shapeSet: readonly [string, string, string]
  kShape: 1 | 2
  kFill: 1 | 2
  startShape: 0 | 1 | 2
  startFill: 0 | 1 | 2
  rotBase: number
  rotStepCol: number
  rotStepRow: number
}

function cyclicLatin<T>(ladder: readonly T[], k: number, start: number, row: number, col: number): T {
  const idx = (((start + (col - 1) + k * (row - 1)) % 3) + 3) % 3
  return ladder[idx]
}

function rotationAt(params: Pick<ThreeRXLayerParams, 'rotBase' | 'rotStepCol' | 'rotStepRow'>, row: number, col: number): number {
  return (((params.rotBase + params.rotStepCol * (col - 1) + params.rotStepRow * (row - 1)) % 360) + 360) % 360
}

function cell(shape: string, fill: string, rotation: number): Element[] {
  return [
    { type: 'shape', layer: 'outer', shape: shape as ShapeId, fill: fill as Fill, size: 'L', anchor: 'CTR', rotation: 0 },
    { type: 'tick', layer: 'inner', length: TICK_LENGTH, rotation },
  ]
}

export const LRM_3R_XLAYER: FamilyTemplate<ThreeRXLayerParams> = {
  code: 'LRM-3R-XLAYER',
  axes: [SHAPE_AXIS, FILL_AXIS, ROT_AXIS],
  domains: () => ({
    [SHAPE_AXIS]: { kind: 'unordered-enum' } as AxisDomain,
    [FILL_AXIS]: { kind: 'unordered-enum', ladder: FILL_LADDER.map(enumVal) } as AxisDomain,
    [ROT_AXIS]: { kind: 'numeric-angle' } as AxisDomain,
  }),
  valueAt: (axis, row, col, params) => {
    if (axis === SHAPE_AXIS) return enumVal(cyclicLatin(params.shapeSet, params.kShape, params.startShape, row, col))
    if (axis === FILL_AXIS) return enumVal(cyclicLatin(FILL_LADDER, params.kFill, params.startFill, row, col))
    if (axis === ROT_AXIS) return numVal(rotationAt(params, row, col))
    throw new Error(`unknown axis ${axis}`)
  },
  ruleSpecs: (params): RuleSpec[] => [
    {
      id: 'R6',
      axis: SHAPE_AXIS,
      direction: 'both',
      params: { values: [...params.shapeSet], rowOffset: params.kShape },
      statement: `Outer shape forms a Latin square: each of ${params.shapeSet.join(', ')} appears exactly once per row and once per column.`,
    },
    {
      id: 'R6',
      axis: FILL_AXIS,
      direction: 'both',
      params: { values: [...FILL_LADDER], rowOffset: params.kFill },
      statement: `Fill forms a Latin square: each of ${FILL_LADDER.join(', ')} appears exactly once per row and once per column.`,
    },
    {
      id: 'R2',
      axis: ROT_AXIS,
      direction: 'both',
      params: { base: params.rotBase, stepPerColumn: params.rotStepCol, stepPerRow: params.rotStepRow, modulus: 360 },
      statement: `Inner tick rotation = ${params.rotBase} + ${params.rotStepCol}*(col-1) + ${params.rotStepRow}*(row-1), mod 360.`,
    },
  ],
  // Three real rules (two R6 distributions plus one cross-layer R2
  // rotation) — genuinely more rule content than any single doc 03 §6
  // exemplar combines. predictedB = -2.0 + (0.9+0.9+0.3+0.3 non-cardinal
  // bonus) + 0.5*(3-1) + 0.5*1(crossLayer) + 0.3*1(perceptualLoad) +
  // 0.15*max(0, nearMissCount-2) = -2.0 + 2.4 + 1.0 + 0.5 + 0.3 + 0 = +2.20
  // -> Very hard, with 0.70 of headroom over the +1.5 threshold, reached
  // through rule count and cross-layer mapping alone.
  //
  // nearMissCount CORRECTED 3 -> 2, and it is a correction, not a tuning
  // choice: the previous distractor plan declared three single-axis IR
  // near-misses (one per rule), and that plan provably cannot exist here.
  // Three distractors each wrong on exactly one of three axes, plus the key,
  // leave the key's own value held by 3 of the 5 options on EVERY axis, so
  // the modal blind composition reconstructs the key exactly —
  // `contextBlindGate`'s MODAL_RECOVERS_KEY, which is why the old primary
  // plan executed 0 times in 300 draws and every item silently fell through
  // to a copy-based fallback. Two single-axis near-misses is the most a
  // three-rule item can carry while clearing G-08; the radicals now say so.
  // The formula and its weights (generator/difficulty.ts) are untouched.
  radicals: { ruleCount: 3, ruleIds: ['R6', 'R6', 'R2'], crossLayer: true, perceptualLoad: 1, elementTypes: 4, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 10 },
  distractorPlan: ['IR', 'IR', 'PM', 'PM'],
  sampleParams(rng: Rng): ThreeRXLayerParams {
    const shapeSet = rng.pick(SHAPE_SETS)
    const [kShape, kFill] = rng.pick([
      [1, 2],
      [2, 1],
    ] as const)
    const startShape = rng.int(0, 2) as 0 | 1 | 2
    const startFill = rng.int(0, 2) as 0 | 1 | 2
    const rotBase = rng.int(0, 7) * 45
    const rotSteps = rng.pick(ROT_STEP_PAIRS)
    return { shapeSet: shapeSet as unknown as [string, string, string], kShape, kFill, startShape, startFill, rotBase, rotStepCol: rotSteps.col, rotStepRow: rotSteps.row }
  },
  buildCell(values) {
    const shape = values[SHAPE_AXIS]
    const fill = values[FILL_AXIS]
    const rot = values[ROT_AXIS]
    if (shape.t !== 'enum' || fill.t !== 'enum' || rot.t !== 'num') throw new Error('shape/fill/rotation must be enum/enum/num')
    return cell(shape.v, fill.v, rot.v)
  },
  /**
   * FIRST DEFECT, FIXED (the hand-authored plan was DEAD CODE, and its
   * fallback is where the copy-elimination leak came from).
   *
   * The plan this replaces was "one single-axis IR per rule, plus one PM":
   * A wrong on shape only, B wrong on fill only, C wrong on rotation only, D
   * wrong on shape+rotation. It executed 0 times in 300 draws — it fails
   * G-08:MODAL_RECOVERS_KEY by construction, not by bad luck. With three
   * single-axis near-misses, each axis has the key's own value held by 3 of
   * the 5 options (key + the two distractors that are not wrong on THAT
   * axis), so the modal composition IS the key on all three axes
   * simultaneously. No choice of stall values can change that; it follows
   * from the wrongness PATTERN alone. Every item therefore fell through to a
   * 4-of-8 whole-cell-copy search, which produced items where all four
   * distractors were verbatim copies of visible cells and the key was not —
   * 116 of 116 on this run's seeds.
   *
   * The replacement keeps the pattern reasoning explicit. Write each option
   * as a bit-triple over (shape, fill, rotation), 0 = the key's value:
   *
   *     key 000    d1 A00    d2 0B0    d3 AB0    d4 ABC
   *
   * where {A, B} is a chosen DOMINANT PAIR of axes and C is the third. Two
   * distractors are genuine single-axis near-misses (d1, d2); d3 and d4 are
   * chimeras. On each of the two dominant axes the key's value is held by
   * exactly 2 of 5 options and a wrong value by 3, so the modal composition
   * is d3 — not the key — and `KEY_VALUE_DOMINATES`'s "at least half the
   * axes must be minority" is met with two of three. The centroid's unique
   * minimum is d3 as well. Both G-11 and G-18 fall out of the pattern rather
   * than being searched for:
   *
   *  - G-11 (copy elimination): d3 and d4 agree on both dominant axes and
   *    differ only on C. Since (shape, fill) is a Graeco-Latin bijection over
   *    the 9 cells, any two options that share a (shape, fill) pair map to
   *    the SAME grid position, which carries exactly one rotation — so at
   *    most one of d3/d4 can be a verbatim copy, and at least one is always a
   *    genuinely novel figure. (When the dominant pair includes rotation, the
   *    same argument applies to d1/d3 instead.)
   *  - G-18 (no single rule isolates the key): d2 carries the key's value on
   *    axis A, d1 carries it on axis B, and both carry it on C.
   *
   * Which pair is dominant is rotated per item off the incidentals, so the
   * redundant rule is not systematically the same one across the bank. (One
   * rule IS redundant in every such item: knowing the two dominant axes
   * pins the key. That is a hard limit of 5 options and 3 rules, not a
   * choice — see `singleRuleSufficiencyCheck`'s "structural limit" note.)
   */
  buildDistractors(ctx: DistractorCtx<ThreeRXLayerParams>) {
    const keyShape = ctx.valueAt(SHAPE_AXIS, 3, 3)
    const keyFill = ctx.valueAt(FILL_AXIS, 3, 3)
    const keyRot = ctx.valueAt(ROT_AXIS, 3, 3)
    if (keyShape.t !== 'enum' || keyFill.t !== 'enum' || keyRot.t !== 'num') throw new Error('shape/fill/rotation must be enum/enum/num')

    const positions = ctx.grid.map((gc) => {
      const s = ctx.valueAt(SHAPE_AXIS, gc.row, gc.col)
      const f = ctx.valueAt(FILL_AXIS, gc.row, gc.col)
      const r = ctx.valueAt(ROT_AXIS, gc.row, gc.col)
      if (s.t !== 'enum' || f.t !== 'enum' || r.t !== 'num') throw new Error('shape/fill/rotation must be enum/enum/num')
      return { row: gc.row, col: gc.col, shape: s.v, fill: f.v, rot: r.v }
    })
    const contextCells = positions.map((p) => ({ elements: cell(p.shape, p.fill, p.rot) }))

    const validSet = (candidates: DistractorCandidate[]): boolean => {
      if (candidates.some((cd) => cd.wrongAxes.length === 0)) return false
      if (candidates.some((cd) => cellEq({ elements: cd.elements }, ctx.keyCell))) return false
      for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) if (cellEq({ elements: candidates[i].elements }, { elements: candidates[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...candidates.map((x) => ({ elements: x.elements }))]
      if (!copyEliminationOk(contextCells, cells, 0)) return false
      if (!singleRuleSufficiencyOk(cells, 0, ctx.axes)) return false
      return contextBlindGate(cells, 0, ctx.axes).ok && giveawayPairGate(cells, ctx.axes).ok
    }

    // Wrong-value candidates per axis, in a fixed deterministic preference
    // order: the "stall" value a candidate would read off the nearest cell
    // in that axis's own direction of travel first, then the rest.
    const stallShape = ctx.valueAt(SHAPE_AXIS, 3, 1)
    const stallFill = ctx.valueAt(FILL_AXIS, 3, 2)
    const stallRot = ctx.valueAt(ROT_AXIS, 2, 3)
    if (stallShape.t !== 'enum' || stallFill.t !== 'enum' || stallRot.t !== 'num') throw new Error('shape/fill/rotation must be enum/enum/num')
    const orderedWrong = <T>(all: readonly T[], key: T, preferred: T): T[] => {
      const rest = all.filter((v) => v !== key && v !== preferred)
      return [...(preferred !== key ? [preferred] : []), ...rest]
    }
    const wrongShapes = orderedWrong(ctx.params.shapeSet, keyShape.v, stallShape.v)
    const wrongFills = orderedWrong(FILL_LADDER, keyFill.v, stallFill.v)
    const wrongRots = orderedWrong([...new Set(positions.map((p) => p.rot))], keyRot.v, stallRot.v)

    type Triple = { shape: string; fill: string; rot: number }
    const describe = (t: Triple): string => {
      const at = positions.find((p) => p.shape === t.shape && p.fill === t.fill && p.rot === t.rot)
      return at ? `copyCell:R${at.row}C${at.col}` : `recombine:{outer.shape=${t.shape},outer.fill=${t.fill},inner.rotation=${t.rot}}`
    }
    const wrongAxesOf = (t: Triple): string[] => [
      ...(t.shape === keyShape.v ? [] : [SHAPE_AXIS]),
      ...(t.fill === keyFill.v ? [] : [FILL_AXIS]),
      ...(t.rot === keyRot.v ? [] : [ROT_AXIS]),
    ]

    // The three (dominant-pair, third-axis) assignments, started at an
    // offset derived from the item's own incidentals so the redundant rule
    // varies across the bank. No RNG draw: `sampleParams` has already
    // consumed this item's randomness, and doc §3.6's determinism rules keep
    // distractor choice a pure function of the composed item.
    const key: Triple = { shape: keyShape.v, fill: keyFill.v, rot: keyRot.v }
    const withShape = (t: Triple, v: string): Triple => ({ ...t, shape: v })
    const withFill = (t: Triple, v: string): Triple => ({ ...t, fill: v })
    const withRot = (t: Triple, v: number): Triple => ({ ...t, rot: v })
    type Assignment = { a: { values: readonly (string | number)[]; set: (t: Triple, v: never) => Triple }; b: { values: readonly (string | number)[]; set: (t: Triple, v: never) => Triple }; c: { values: readonly (string | number)[]; set: (t: Triple, v: never) => Triple } }
    const axisShape = { values: wrongShapes as readonly (string | number)[], set: withShape as unknown as (t: Triple, v: never) => Triple }
    const axisFill = { values: wrongFills as readonly (string | number)[], set: withFill as unknown as (t: Triple, v: never) => Triple }
    const axisRot = { values: wrongRots as readonly (string | number)[], set: withRot as unknown as (t: Triple, v: never) => Triple }
    const assignments: Assignment[] = [
      { a: axisShape, b: axisFill, c: axisRot },
      { a: axisShape, b: axisRot, c: axisFill },
      { a: axisFill, b: axisRot, c: axisShape },
    ]
    const offset = (ctx.params.startShape + ctx.params.startFill + ctx.params.rotBase / 45 + (ctx.params.rotStepRow === 45 ? 1 : 0)) % assignments.length

    for (let n = 0; n < assignments.length; n++) {
      const { a: axA, b: axB, c: axC } = assignments[(offset + n) % assignments.length]
      for (const va of axA.values) {
        for (const vb of axB.values) {
          for (const vc of axC.values) {
            const t1 = axA.set(key, va as never)
            const t2 = axB.set(key, vb as never)
            const t3 = axB.set(axA.set(key, va as never), vb as never)
            const t4 = axC.set(t3, vc as never)
            const mk = (t: Triple, label: 'IR' | 'PM'): DistractorCandidate =>
              label === 'PM'
                ? chimera(describe(t), cell(t.shape, t.fill, t.rot), wrongAxesOf(t))
                : { elements: cell(t.shape, t.fill, t.rot), label: 'IR', mechanism: describe(t), wrongAxes: wrongAxesOf(t) }
            const candidates = [mk(t1, 'IR'), mk(t2, 'IR'), mk(t3, 'PM'), mk(t4, 'PM')]
            if (validSet(candidates)) return candidates
          }
        }
      }
    }

    // Last resort: a full 4-subset search over every (realised shape,
    // realised fill, realised rotation) recombination, not just the 8
    // whole-cell copies the previous fallback searched. Reached only if the
    // structured plan above cannot be satisfied for some parameter draw.
    const allTriples: Triple[] = [...ctx.params.shapeSet]
      .flatMap((s) => FILL_LADDER.flatMap((f) => [...new Set([...positions.map((p) => p.rot), keyRot.v])].map((r) => ({ shape: s, fill: f as string, rot: r }))))
      .filter((t) => !(t.shape === key.shape && t.fill === key.fill && t.rot === key.rot))
    const labels: Array<'IR' | 'PM'> = ['IR', 'IR', 'PM', 'PM']
    for (const chosen of combinations4(allTriples)) {
      const candidates: DistractorCandidate[] = chosen.map((t, i) => {
        const elements = cell(t.shape, t.fill, t.rot)
        return labels[i] === 'PM' ? chimera(describe(t), elements, wrongAxesOf(t)) : { elements, label: 'IR' as const, mechanism: describe(t), wrongAxes: wrongAxesOf(t) }
      })
      if (validSet(candidates)) return candidates
    }
    throw new Error(`LRM-3R-XLAYER: no distractor construction cleared G-08/G-10/G-11/G-18 for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => true, // 45deg/135deg steps on a tick (asymmetric element) — both non-cardinal; same bonus as LRM-2R-XLAYER/LRM-ROT.
  structuralExtra: (params: ThreeRXLayerParams) => ({ startShape: params.startShape, startFill: params.startFill, rotBase: params.rotBase, rotStepCol: params.rotStepCol, rotStepRow: params.rotStepRow }),
}
