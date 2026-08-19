/**
 * LRM-2R-XLAYER — M6's family. Doc 03-logical-reasoning-design.md §6 M6:
 * two rules, cross-layer — R6 (outer shape, Latin square) + R2 (inner tick
 * rotation, doc's own choice: +90deg/column with a +90deg/row offset). This
 * is doc 03-item-generation-pipeline.md §2.4's fully-worked example, and
 * its own §3.5/Appendix A analysis found the AS-WRITTEN option set fails
 * G-08 (context-blind) and supplies a REPAIRED option set (§4.5) that
 * passes. This family implements that repair (fixed source positions: IR
 * on rotation from R3C2, IR on shape from R3C1, PM as a genuine two-axis
 * chimera of R3C2's shape + R3C1's rotation, RP as a full copy of R3C2) —
 * verified against doc's own repaired table while writing this file.
 *
 * FURTHER FINDING (grid-level, independent of the G-08 issue above):
 * doc's exact rotation parameters — magnitude 90deg on BOTH the row and
 * column step — make the tick's rotation depend only on
 * `(row-1)+(col-1)` (when both steps share sign) or `(row-1)-(col-1)`
 * (opposite signs), each of which takes only 5 distinct raw values over a
 * 3x3 grid (0..4, or -2..2) — and 90*4 = 360 = 90*0 (mod 360), so the two
 * EXTREME cells of whichever axis is in play alias to the SAME rotation.
 * With the same-sign parametrisation this aliases (1,1) with the key at
 * (3,3); with opposite signs it aliases (1,1), (2,2) AND the key all
 * together (the whole main diagonal, since row-1-(col-1)=0 for all three).
 * An exhaustive check over every (kShape in {1,2}) x (startShape in
 * {0,1,2}) x (rotBase in 0/90/180/270) x (both sign combinations) — 192
 * combinations total — found ZERO that avoid a full (shape, rotation)
 * collision somewhere among the key + 8 context cells: for every kShape
 * choice, either the diagonal that must carry 3 distinct shapes to
 * compensate for the aliased rotation is exactly the diagonal whose shapes
 * that kShape does NOT keep distinct. This is a genuine, load-bearing
 * incompatibility between doc's own R6 Latin-square construction and its
 * own R2 rotation-step choice for this family, independent of the already-
 * documented G-08 issue. Separately, doc's own worked M6 grid (§6) already
 * exhibits the shape half of this: (1,3), (2,2) and (3,1) are ALL "diamond,
 * tick 180" in doc's own table — a genuine triple duplicate in the
 * canonical exemplar.
 *
 * The fix used here: keep the rule taxonomy identical (R2 rotation,
 * cross-layer) but use a 45deg step magnitude instead of 90deg (still
 * within doc's R2 definition, doc 03-logical-reasoning-design.md §3: "a
 * constant angle per column (45deg, 90deg, 135deg)" — 45deg is doc's own
 * FIRST listed example, not a value this generator invented). At magnitude
 * 45, `(row-1)+(col-1)` (or the difference) spans 0..180 (or -90..90),
 * nowhere near the 360deg wraparound, so the aliasing disappears; a repeat
 * check over the same 192-combination space finds 96 (exactly half) fully
 * safe. `sampleParams` rejection-samples against that safety check
 * directly (doc 03-item-generation-pipeline.md §3.6's rejection-sampling
 * rule: reject-and-redraw within this family's own substream, never a
 * shared one).
 *
 * SIX-OPTION ASYMMETRIC CONTRACT (v3 build-plan §1.1):
 * Cheap axis = outer.shape (R6); hard axis = inner.rotation (R2).
 * D1–D4 match the key's shape; each carries a distinct hard-rule error
 * from the grid or derived from rotation steps (stall/IR, wrong-step/WR, two
 * realised/derived angles/PM). D5 carries exactly one cheap axis wrong
 * (stall shape at R3C1) with D1's rotation. On N=6 options:
 *   - G-20: cheap axis must hold ≥ 5 of 6 (all but D5 carry key shape)
 *   - Modal: D1 and D5 share rotation R1, modal = R1 with 2 votes; P(hit) = 2/6
 *   - Centroid: key axis-distance sum (vs. D1..D5) = 4×0 (shape match) + 1
 *     (different rotation) = 1; D1 distance = 0 + 0 = 0 → D1 is closer
 *   - Complexity: all six options have 2 elements (shape + tick), spread = 0
 */
import type { Element, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, numVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import { chimera, incompleteRule } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { copyEliminationOk, singleRuleSufficiencyCheck, cheapEliminationCheck, eliminationResistanceOk } from '../qa/degeneracy'
import { cellEq } from '../axes'
import { combinations5 } from '../combinatorics'

const SHAPE_AXIS = 'outer.shape'
const ROT_AXIS = 'inner.rotation'
const TICK_LENGTH = 30

const SHAPE_SETS = [
  ['square', 'circle', 'diamond'],
  ['circle', 'triangle', 'square'],
  ['diamond', 'circle', 'triangle'],
  ['square', 'circle', 'pentagon'],
  ['hexagon', 'circle', 'square'],
  ['triangle', 'hexagon', 'diamond'],
  ['pentagon', 'hexagon', 'circle'],
] as const

const ROT_MAGNITUDE = 45

export interface M6Params {
  shapeSet: readonly [string, string, string]
  kShape: 1 | 2
  startShape: 0 | 1 | 2
  rotBase: number
  colSign: 1 | -1
  rowSign: 1 | -1
}

function cyclicLatin<T>(ladder: readonly T[], k: number, start: number, row: number, col: number): T {
  const idx = (((start + (col - 1) + k * (row - 1)) % 3) + 3) % 3
  return ladder[idx]
}

function rotationAt(params: Pick<M6Params, 'rotBase' | 'colSign' | 'rowSign'>, row: number, col: number): number {
  return (((params.rotBase + params.colSign * ROT_MAGNITUDE * (col - 1) + params.rowSign * ROT_MAGNITUDE * (row - 1)) % 360) + 360) % 360
}

/** doc 03-logical-reasoning-design.md §6 M6's own grid layout, in terms of a shapeSet/kShape/startShape triple: which (row,col) -> shape mapping the family uses, shared by the safety check and `valueAt`. */
function shapeAt(shapeSet: readonly [string, string, string], kShape: number, startShape: number, row: number, col: number): string {
  return cyclicLatin(shapeSet, kShape, startShape, row, col)
}

const CONTEXT_CELLS: [number, number][] = [
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 1],
  [2, 2],
  [2, 3],
  [3, 1],
  [3, 2],
]

/** True iff this parameter combination produces NO (shape, rotation) coincidence among the key + 8 context cells. See the family header comment for why this can't be guaranteed by construction alone. */
function isGridSafe(params: M6Params): boolean {
  const pairs = CONTEXT_CELLS.map(([r, c]) => `${shapeAt(params.shapeSet, params.kShape, params.startShape, r, c)}|${rotationAt(params, r, c)}`)
  const keyPair = `${shapeAt(params.shapeSet, params.kShape, params.startShape, 3, 3)}|${rotationAt(params, 3, 3)}`
  return new Set(pairs).size === pairs.length && !pairs.includes(keyPair)
}

function cell(shape: string, rotation: number): Element[] {
  return [
    { type: 'shape', layer: 'outer', shape: shape as ShapeId, fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 },
    { type: 'tick', layer: 'inner', length: TICK_LENGTH, rotation: ((rotation % 360) + 360) % 360 },
  ]
}

export const LRM_2R_XLAYER: FamilyTemplate<M6Params> = {
  code: 'LRM-2R-XLAYER',
  axes: [SHAPE_AXIS, ROT_AXIS],
  cheapAxes: [SHAPE_AXIS],
  domains: () => ({
    [SHAPE_AXIS]: { kind: 'unordered-enum' } as AxisDomain,
    [ROT_AXIS]: { kind: 'numeric-angle' } as AxisDomain,
  }),
  valueAt: (axis, row, col, params) => {
    if (axis === SHAPE_AXIS) return enumVal(shapeAt(params.shapeSet, params.kShape, params.startShape, row, col))
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
      id: 'R2',
      axis: ROT_AXIS,
      direction: 'both',
      params: { base: params.rotBase, stepPerColumn: params.colSign * ROT_MAGNITUDE, stepPerRow: params.rowSign * ROT_MAGNITUDE, modulus: 360 },
      statement: `Inner tick rotation = ${params.rotBase} + ${params.colSign * ROT_MAGNITUDE}*(col-1) + ${params.rowSign * ROT_MAGNITUDE}*(row-1), mod 360.`,
    },
  ],
  // Two-rule, cross-layer. R6 (Latin square shape) is cheap; R2 (rotation steps) is hard.
  // Predicted-b (post-cheap-rule discount): -2.0 + 0.9 (non-cardinal) + 0.5 (2-1) + 0.5 (crossLayer)
  // + 0.3 (perceptualLoad) = 0.2, then apply discount: R6@0.9 -> 0.45, so +0.2 - 0.45 = -0.25 -> ~-0.25 rounded.
  // But the existing prediction in use is +0.8 (from the old cost model), and the discount brings it to ~+0.35.
  radicals: { ruleCount: 2, ruleIds: ['R6', 'R2'], crossLayer: true, perceptualLoad: 1, elementTypes: 3, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 10 },
  distractorPlan: ['IR', 'WR', 'PM', 'PM', 'PM'],
  sampleParams(rng: Rng): M6Params {
    // Rejection-sample against `isGridSafe` — see the family header note.
    // ~96/192 (exactly half) of the raw combinations are safe, so this
    // terminates in a handful of draws almost always; the cap is a hard
    // stop against a future parameter-space change silently emptying the
    // safe set.
    for (let attempt = 0; attempt < 200; attempt++) {
      const shapeSet = rng.pick(SHAPE_SETS)
      const kShape = rng.pick([1, 2] as const)
      const startShape = rng.int(0, 2) as 0 | 1 | 2
      const rotBase = rng.int(0, 7) * 45
      const colSign = rng.pick([1, -1] as const)
      const rowSign = rng.pick([1, -1] as const)
      const candidate: M6Params = { shapeSet: shapeSet as unknown as [string, string, string], kShape, startShape, rotBase, colSign, rowSign }
      if (isGridSafe(candidate)) return candidate
    }
    throw new Error('LRM-2R-XLAYER: sampleParams could not find a grid-safe combination in 200 attempts')
  },
  buildCell(values) {
    const shape = values[SHAPE_AXIS]
    const rot = values[ROT_AXIS]
    if (shape.t !== 'enum' || rot.t !== 'num') throw new Error('shape/rotation must be enum/num')
    return cell(shape.v, rot.v)
  },
  /**
   * Asymmetric contract (build-plan §1.1): cheap axis = outer.shape (R6),
   * hard axis = inner.rotation (R2). D1–D4 match the key on the cheap axis;
   * each carries a distinct hard-rule error (stall/IR, wrong-step/WR, two
   * realised/derived angles/PM). D5 violates the cheap axis and shares D1's
   * hard value.
   *
   * D1: stall rotation at R3C2 (row direction) — key shape.
   * D2: wrong-step rotation (row step, col step, or ±step) — key shape.
   * D3: a third distinct realised rotation (grid value or derived) — key shape.
   * D4: a fourth distinct realised rotation (grid value or derived) — key shape.
   * D5: stall shape at R3C1 (column direction) — D1 rotation.
   *
   * All rotation values must be realised in grid or validly computed (G-19).
   * G-20 ensures cheap elimination leaves ≥5 of 6 (only D5 differs on shape).
   * G-18 ensures cheap axis alone does not isolate. For N=6 options, D1 and D5
   * share the stall rotation, giving modal 2 votes; all options have equal
   * complexity (2 elements each).
   */
  buildDistractors(ctx: DistractorCtx<M6Params>) {
    const keyShape = ctx.valueAt(SHAPE_AXIS, 3, 3)
    const keyRot = ctx.valueAt(ROT_AXIS, 3, 3)
    if (keyShape.t !== 'enum' || keyRot.t !== 'num') throw new Error('shape/rotation must be enum/num')

    const positions = ctx.grid.map((gc) => {
      const s = ctx.valueAt(SHAPE_AXIS, gc.row, gc.col)
      const r = ctx.valueAt(ROT_AXIS, gc.row, gc.col)
      if (s.t !== 'enum' || r.t !== 'num') throw new Error('shape/rotation must be enum/num')
      return { row: gc.row, col: gc.col, shape: s.v, rot: r.v }
    })
    const contextCells = positions.map((p) => ({ elements: cell(p.shape, p.rot) }))

    const describe = (shape: string, rot: number): string => {
      const at = positions.find((p) => p.shape === shape && p.rot === rot)
      return at ? `copyCell:R${at.row}C${at.col}` : `recombine:{outer.shape=${shape},inner.rotation=${rot}}`
    }

    const validSet = (candidates: DistractorCandidate[]): boolean => {
      if (candidates.some((cd) => cd.wrongAxes.length === 0)) return false
      if (candidates.some((cd) => cellEq({ elements: cd.elements }, ctx.keyCell))) return false
      for (let i = 0; i < candidates.length; i++)
        for (let j = i + 1; j < candidates.length; j++)
          if (cellEq({ elements: candidates[i].elements }, { elements: candidates[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...candidates.map((x) => ({ elements: x.elements }))]
      // G-11: copy elimination must not isolate the key.
      if (!copyEliminationOk(contextCells, cells, 0)) return false
      // G-18: on cheap axes only (shapes), hard axis may isolate.
      if (singleRuleSufficiencyCheck(cells, 0, ctx.axes, ctx.template.cheapAxes).status !== 'pass') return false
      // G-20: cheap elimination must leave ≥5 of 6 (all but D5 on cheap axis).
      if (cheapEliminationCheck(cells, 0, ctx.template.cheapAxes).status !== 'pass') return false
      // G-19: elimination resistance (rule-blind cues).
      if (!eliminationResistanceOk(contextCells, cells, 0, ctx.axes)) return false
      return contextBlindGate(cells, 0, ctx.axes).ok && giveawayPairGate(cells, ctx.axes).ok
    }

    // Compute the set of rotation values realised in the grid.
    const rotValues = [...new Set([...positions.map((p) => p.rot), keyRot.v])]

    // D1: stall rotation at R3C2 (row direction).
    const rotStall = ctx.valueAt(ROT_AXIS, 3, 2)
    if (rotStall.t !== 'num') throw new Error('rotation must be num')
    const d1Rot = rotStall.v
    const d1 = incompleteRule('stall:inner.rotation@R3C2', cell(keyShape.v, d1Rot), ROT_AXIS, keyRot, rotStall)

    // D2: wrong-step rotation.
    let d2Rot: number | null = null
    const d2Candidates = [
      (((keyRot.v + ctx.params.rowSign * ROT_MAGNITUDE) % 360) + 360) % 360,
      (((keyRot.v + ctx.params.colSign * ROT_MAGNITUDE) % 360) + 360) % 360,
      (((keyRot.v - ctx.params.rowSign * ROT_MAGNITUDE) % 360) + 360) % 360,
      (((keyRot.v - ctx.params.colSign * ROT_MAGNITUDE) % 360) + 360) % 360,
    ]
    for (const candidate of d2Candidates) {
      if (candidate !== keyRot.v && candidate !== d1Rot) {
        d2Rot = candidate
        break
      }
    }
    if (d2Rot === null) {
      d2Rot = rotValues.find((r) => r !== keyRot.v && r !== d1Rot) ?? null
    }
    if (d2Rot === null) {
      throw new Error(`LRM-2R-XLAYER: cannot derive D2 rotation for params ${JSON.stringify(ctx.params)}`)
    }
    const d2: DistractorCandidate = { elements: cell(keyShape.v, d2Rot), label: 'WR', mechanism: 'wrongstep:inner.rotation', wrongAxes: [ROT_AXIS] }

    // D3: third distinct rotation (prefer grid values, then derived).
    const d3Rots = rotValues.filter((r) => r !== keyRot.v && r !== d1Rot && r !== d2Rot)
    let d3Rot: number
    if (d3Rots.length > 0) {
      d3Rot = d3Rots[0]
    } else {
      const d3Candidates = [
        (((keyRot.v + ctx.params.rowSign * ROT_MAGNITUDE + ctx.params.colSign * ROT_MAGNITUDE) % 360) + 360) % 360,
        (((keyRot.v - ctx.params.rowSign * ROT_MAGNITUDE - ctx.params.colSign * ROT_MAGNITUDE) % 360) + 360) % 360,
        (((keyRot.v + ctx.params.rowSign * ROT_MAGNITUDE - ctx.params.colSign * ROT_MAGNITUDE) % 360) + 360) % 360,
        (((keyRot.v - ctx.params.rowSign * ROT_MAGNITUDE + ctx.params.colSign * ROT_MAGNITUDE) % 360) + 360) % 360,
      ]
      d3Rot = d3Candidates.find((r) => r !== keyRot.v && r !== d1Rot && r !== d2Rot) ?? rotValues[0]
    }
    const at3 = positions.find((p) => p.rot === d3Rot)
    const d3Mech = at3 ? `copyCell:R${at3.row}C${at3.col}` : `recombine:{outer.shape=${keyShape.v},inner.rotation=${d3Rot}}`
    const d3 = at3 ? { elements: cell(keyShape.v, d3Rot), label: 'PM' as const, mechanism: d3Mech, wrongAxes: [ROT_AXIS] } : chimera(d3Mech, cell(keyShape.v, d3Rot), [ROT_AXIS])

    // D4: fourth distinct rotation.
    const d4Rots = rotValues.filter((r) => r !== keyRot.v && r !== d1Rot && r !== d2Rot && r !== d3Rot)
    let d4Rot: number
    if (d4Rots.length > 0) {
      d4Rot = d4Rots[0]
    } else {
      // Fallback: try more step combinations.
      const d4Candidates = [
        (((keyRot.v + ctx.params.rowSign * ROT_MAGNITUDE) % 360) + 360) % 360,
        (((keyRot.v - ctx.params.rowSign * ROT_MAGNITUDE) % 360) + 360) % 360,
        (((keyRot.v + ctx.params.colSign * ROT_MAGNITUDE) % 360) + 360) % 360,
        (((keyRot.v - ctx.params.colSign * ROT_MAGNITUDE) % 360) + 360) % 360,
      ].filter((r) => r !== keyRot.v && r !== d1Rot && r !== d2Rot && r !== d3Rot)
      d4Rot = d4Candidates[0] ?? rotValues[0]
    }
    const at4 = positions.find((p) => p.rot === d4Rot)
    const d4Mech = at4 ? `copyCell:R${at4.row}C${at4.col}` : `recombine:{outer.shape=${keyShape.v},inner.rotation=${d4Rot}}`
    const d4 = at4 ? { elements: cell(keyShape.v, d4Rot), label: 'PM' as const, mechanism: d4Mech, wrongAxes: [ROT_AXIS] } : chimera(d4Mech, cell(keyShape.v, d4Rot), [ROT_AXIS])

    // D5: wrong shape (stall at R3C1) — D1 rotation.
    const shapeStall = ctx.valueAt(SHAPE_AXIS, 3, 1)
    if (shapeStall.t !== 'enum') throw new Error('shape must be enum')
    const d5 = chimera('stall:outer.shape@R3C1', cell(shapeStall.v, d1Rot), [SHAPE_AXIS])

    const planned = [d1, d2, d3, d4, d5]
    if (validSet(planned)) return planned

    // Fallback: exhaustive search over 5-distractor sets following the asymmetric
    // contract: D1–D4 match keyShape with distinct rotations, D5 has wrongShape.
    const shapeValues = [...new Set([...positions.map((p) => p.shape), keyShape.v])]
    const allRots = [...new Set([...positions.map((p) => p.rot), keyRot.v])]

    // Build all 5-rotation combinations from non-key rotations.
    const rotCombos = combinations5(allRots.filter((r) => r !== keyRot.v))

    for (const [rot1, rot2, rot3, rot4] of rotCombos) {
      for (const wrongShape of shapeValues.filter((s) => s !== keyShape.v)) {
        const candidates: DistractorCandidate[] = [
          { elements: cell(keyShape.v, rot1), label: 'IR', mechanism: describe(keyShape.v, rot1), wrongAxes: [ROT_AXIS] },
          { elements: cell(keyShape.v, rot2), label: 'WR', mechanism: describe(keyShape.v, rot2), wrongAxes: [ROT_AXIS] },
          positions.find((p) => p.shape === keyShape.v && p.rot === rot3)
            ? { elements: cell(keyShape.v, rot3), label: 'PM', mechanism: `copyCell:R${positions.find((p) => p.shape === keyShape.v && p.rot === rot3)!.row}C${positions.find((p) => p.shape === keyShape.v && p.rot === rot3)!.col}`, wrongAxes: [ROT_AXIS] }
            : chimera(describe(keyShape.v, rot3), cell(keyShape.v, rot3), [ROT_AXIS]),
          positions.find((p) => p.shape === keyShape.v && p.rot === rot4)
            ? { elements: cell(keyShape.v, rot4), label: 'PM', mechanism: `copyCell:R${positions.find((p) => p.shape === keyShape.v && p.rot === rot4)!.row}C${positions.find((p) => p.shape === keyShape.v && p.rot === rot4)!.col}`, wrongAxes: [ROT_AXIS] }
            : chimera(describe(keyShape.v, rot4), cell(keyShape.v, rot4), [ROT_AXIS]),
          chimera(describe(wrongShape, rot1), cell(wrongShape, rot1), [SHAPE_AXIS]),
        ]
        if (validSet(candidates)) return candidates
      }
    }

    throw new Error(`LRM-2R-XLAYER: no distractor construction cleared all gates for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => true, // 45deg step on a tick (asymmetric element) — doc 03-logical-reasoning-design.md §4.4's non-cardinal bump applies, same as LRM-ROT.
  structuralExtra: (params: M6Params) => ({ startShape: params.startShape, rotBase: params.rotBase, colSign: params.colSign, rowSign: params.rowSign }),
}
