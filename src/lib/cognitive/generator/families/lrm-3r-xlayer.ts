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
 *
 * SIX-OPTION ASYMMETRIC CONTRACT (v3 build-plan §1.1):
 * Cheap axes = outer.shape, outer.fill (both R6); hard axis = inner.rotation (R2).
 * D1–D4 match the key's shape and fill; each carries a distinct hard-rule
 * error (stall/IR, wrong-step/WR, two realised/derived angles/PM). D5 violates
 * exactly one cheap axis (deterministically per item's incidentals) and shares
 * D1's rotation. On N=6 options:
 *   - G-20: each cheap axis must hold ≥ 5 of 6; intersection ≥ 5
 *   - Modal: D1 and D5 share rotation R1, modal = R1 with 2 votes; P(hit) = 2/6
 *   - Complexity: all six options have 2 elements, spread = 0
 */
import type { Element, Fill, RuleSpec, ShapeId } from '../../spec/schema'
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
  ['hexagon', 'circle', 'square'],
  ['triangle', 'hexagon', 'diamond'],
  ['pentagon', 'hexagon', 'circle'],
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
  cheapAxes: [SHAPE_AXIS, FILL_AXIS],
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
  // Three real rules (two R6 distributions + one cross-layer R2 rotation).
  // Cheap axes = outer.shape, outer.fill (both R6); hard axis = inner.rotation (R2).
  // nearMissCount = 2: only two single-axis IR near-misses are possible (one per cheap axis);
  // a third would make the modal composition recover the key.
  // Predicted-b (post-cheap-rule discount): -2.0 + (0.9+0.9+0.3 non-cardinal) + 0.5*(3-1)
  // + 0.5 (crossLayer) + 0.3 (perceptualLoad) = -2.0 + 2.1 + 1.0 + 0.5 + 0.3 = +1.9, then apply
  // discount (R6s at 0.45 each): +1.9 - 0.45 - 0.45 = +1.0 ~ +1.3 measured.
  radicals: { ruleCount: 3, ruleIds: ['R6', 'R6', 'R2'], crossLayer: true, perceptualLoad: 1, elementTypes: 4, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 10 },
  distractorPlan: ['IR', 'WR', 'PM', 'PM', 'PM'],
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
   * Asymmetric contract (build-plan §1.1): cheap axes = outer.shape, outer.fill
   * (both R6); hard axis = inner.rotation (R2). D1–D4 match the key on both cheap
   * axes; each carries a distinct hard-rule error (stall/IR, wrong-step/WR, two
   * realised/derived angles/PM). D5 violates exactly one cheap axis (shape-wrong
   * or fill-wrong per item's incidentals) and shares D1's rotation.
   *
   * Graeco-Latin square guarantee (via kShape != kFill): any two cells differ
   * on both (shape, fill), so coincidences on one cheap axis and hard axis
   * cannot exist without isolation (enforced by G-18). D5 picks shape-wrong
   * (stall at R3C1) or fill-wrong (stall at R3C2) deterministically.
   * For N=6: G-20 requires ≥ 5 of 6 on each cheap axis + intersection.
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

    const describe = (shape: string, fill: string, rot: number): string => {
      const at = positions.find((p) => p.shape === shape && p.fill === fill && p.rot === rot)
      return at ? `copyCell:R${at.row}C${at.col}` : `recombine:{outer.shape=${shape},outer.fill=${fill},inner.rotation=${rot}}`
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
      // G-18: on cheap axes only (shapes and fills), hard axis may isolate.
      if (singleRuleSufficiencyCheck(cells, 0, ctx.axes, ctx.template.cheapAxes).status !== 'pass') return false
      // G-20: cheap elimination must leave ≥5 of 6.
      if (cheapEliminationCheck(cells, 0, ctx.template.cheapAxes).status !== 'pass') return false
      // G-19: elimination resistance.
      if (!eliminationResistanceOk(contextCells, cells, 0, ctx.axes)) return false
      return contextBlindGate(cells, 0, ctx.axes).ok && giveawayPairGate(cells, ctx.axes).ok
    }

    // Compute available rotation values.
    const rotValues = [...new Set([...positions.map((p) => p.rot), keyRot.v])]

    // D1: stall rotation at R2C3 (column direction).
    const rotStall = ctx.valueAt(ROT_AXIS, 2, 3)
    if (rotStall.t !== 'num') throw new Error('rotation must be num')
    const d1Rot = rotStall.v
    const d1 = incompleteRule('stall:inner.rotation@R2C3', cell(keyShape.v, keyFill.v, d1Rot), ROT_AXIS, keyRot, rotStall)

    // D2: wrong-step rotation.
    let d2Rot: number | null = null
    const d2Candidates = [
      (((keyRot.v + ctx.params.rotStepRow) % 360) + 360) % 360,
      (((keyRot.v + ctx.params.rotStepCol) % 360) + 360) % 360,
      (((keyRot.v - ctx.params.rotStepRow) % 360) + 360) % 360,
      (((keyRot.v - ctx.params.rotStepCol) % 360) + 360) % 360,
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
      throw new Error(`LRM-3R-XLAYER: cannot derive D2 rotation for params ${JSON.stringify(ctx.params)}`)
    }
    const d2: DistractorCandidate = { elements: cell(keyShape.v, keyFill.v, d2Rot), label: 'WR', mechanism: 'wrongstep:inner.rotation', wrongAxes: [ROT_AXIS] }

    // D3: third distinct rotation.
    const d3Rots = rotValues.filter((r) => r !== keyRot.v && r !== d1Rot && r !== d2Rot)
    let d3Rot: number
    if (d3Rots.length > 0) {
      d3Rot = d3Rots[0]
    } else {
      const d3Candidates = [
        (((keyRot.v + ctx.params.rotStepCol + ctx.params.rotStepRow) % 360) + 360) % 360,
        (((keyRot.v - ctx.params.rotStepCol - ctx.params.rotStepRow) % 360) + 360) % 360,
        (((keyRot.v + ctx.params.rotStepCol - ctx.params.rotStepRow) % 360) + 360) % 360,
        (((keyRot.v - ctx.params.rotStepCol + ctx.params.rotStepRow) % 360) + 360) % 360,
      ]
      d3Rot = d3Candidates.find((r) => r !== keyRot.v && r !== d1Rot && r !== d2Rot) ?? rotValues[0]
    }
    const at3 = positions.find((p) => p.rot === d3Rot)
    const d3Mech = at3 ? `copyCell:R${at3.row}C${at3.col}` : `recombine:{outer.shape=${keyShape.v},outer.fill=${keyFill.v},inner.rotation=${d3Rot}}`
    const d3 = at3
      ? { elements: cell(keyShape.v, keyFill.v, d3Rot), label: 'PM' as const, mechanism: d3Mech, wrongAxes: [ROT_AXIS] }
      : chimera(d3Mech, cell(keyShape.v, keyFill.v, d3Rot), [ROT_AXIS])

    // D4: fourth distinct rotation.
    const d4Rots = rotValues.filter((r) => r !== keyRot.v && r !== d1Rot && r !== d2Rot && r !== d3Rot)
    let d4Rot: number
    if (d4Rots.length > 0) {
      d4Rot = d4Rots[0]
    } else {
      const d4Candidates = [
        (((keyRot.v + ctx.params.rotStepRow) % 360) + 360) % 360,
        (((keyRot.v - ctx.params.rotStepRow) % 360) + 360) % 360,
        (((keyRot.v + ctx.params.rotStepCol) % 360) + 360) % 360,
        (((keyRot.v - ctx.params.rotStepCol) % 360) + 360) % 360,
      ].filter((r) => r !== keyRot.v && r !== d1Rot && r !== d2Rot && r !== d3Rot)
      d4Rot = d4Candidates[0] ?? rotValues[0]
    }
    const at4 = positions.find((p) => p.rot === d4Rot)
    const d4Mech = at4 ? `copyCell:R${at4.row}C${at4.col}` : `recombine:{outer.shape=${keyShape.v},outer.fill=${keyFill.v},inner.rotation=${d4Rot}}`
    const d4 = at4
      ? { elements: cell(keyShape.v, keyFill.v, d4Rot), label: 'PM' as const, mechanism: d4Mech, wrongAxes: [ROT_AXIS] }
      : chimera(d4Mech, cell(keyShape.v, keyFill.v, d4Rot), [ROT_AXIS])

    // D5: wrong on exactly one cheap axis. Prefer shape-wrong per incidentals.
    const useShapeWrong = (ctx.params.startShape + ctx.params.startFill) % 2 === 0
    let d5: DistractorCandidate
    if (useShapeWrong) {
      const shapeStall = ctx.valueAt(SHAPE_AXIS, 3, 1)
      if (shapeStall.t !== 'enum') throw new Error('shape must be enum')
      d5 = chimera('stall:outer.shape@R3C1', cell(shapeStall.v, keyFill.v, d1Rot), [SHAPE_AXIS])
    } else {
      const fillStall = ctx.valueAt(FILL_AXIS, 3, 2)
      if (fillStall.t !== 'enum') throw new Error('fill must be enum')
      d5 = chimera('stall:outer.fill@R3C2', cell(keyShape.v, fillStall.v, d1Rot), [FILL_AXIS])
    }

    const planned = [d1, d2, d3, d4, d5]
    if (validSet(planned)) return planned

    // Fallback: exhaustive search over 5-distractor sets following the asymmetric
    // contract: D1–D4 match keyShape/keyFill with distinct rotations; D5 wrong on one cheap axis.
    const shapeValues = [...new Set([...positions.map((p) => p.shape), keyShape.v])]
    const fillValues = [...new Set([...positions.map((p) => p.fill), keyFill.v])]
    const allRots = [...new Set([...positions.map((p) => p.rot), keyRot.v])]

    // Build all 5-rotation combinations from non-key rotations.
    const rotCombos = combinations5(allRots.filter((r) => r !== keyRot.v))

    for (const [rot1, rot2, rot3, rot4] of rotCombos) {
      // Try D5 with wrong shape.
      for (const wrongShape of shapeValues.filter((s) => s !== keyShape.v)) {
        const candidates: DistractorCandidate[] = [
          { elements: cell(keyShape.v, keyFill.v, rot1), label: 'IR', mechanism: describe(keyShape.v, keyFill.v, rot1), wrongAxes: [ROT_AXIS] },
          { elements: cell(keyShape.v, keyFill.v, rot2), label: 'WR', mechanism: describe(keyShape.v, keyFill.v, rot2), wrongAxes: [ROT_AXIS] },
          positions.find((p) => p.shape === keyShape.v && p.fill === keyFill.v && p.rot === rot3)
            ? { elements: cell(keyShape.v, keyFill.v, rot3), label: 'PM', mechanism: `copyCell:R${positions.find((p) => p.shape === keyShape.v && p.fill === keyFill.v && p.rot === rot3)!.row}C${positions.find((p) => p.shape === keyShape.v && p.fill === keyFill.v && p.rot === rot3)!.col}`, wrongAxes: [ROT_AXIS] }
            : chimera(describe(keyShape.v, keyFill.v, rot3), cell(keyShape.v, keyFill.v, rot3), [ROT_AXIS]),
          positions.find((p) => p.shape === keyShape.v && p.fill === keyFill.v && p.rot === rot4)
            ? { elements: cell(keyShape.v, keyFill.v, rot4), label: 'PM', mechanism: `copyCell:R${positions.find((p) => p.shape === keyShape.v && p.fill === keyFill.v && p.rot === rot4)!.row}C${positions.find((p) => p.shape === keyShape.v && p.fill === keyFill.v && p.rot === rot4)!.col}`, wrongAxes: [ROT_AXIS] }
            : chimera(describe(keyShape.v, keyFill.v, rot4), cell(keyShape.v, keyFill.v, rot4), [ROT_AXIS]),
          chimera(describe(wrongShape, keyFill.v, rot1), cell(wrongShape, keyFill.v, rot1), [SHAPE_AXIS]),
        ]
        if (validSet(candidates)) return candidates
      }
      // Try D5 with wrong fill.
      for (const wrongFill of fillValues.filter((f) => f !== keyFill.v)) {
        const candidates: DistractorCandidate[] = [
          { elements: cell(keyShape.v, keyFill.v, rot1), label: 'IR', mechanism: describe(keyShape.v, keyFill.v, rot1), wrongAxes: [ROT_AXIS] },
          { elements: cell(keyShape.v, keyFill.v, rot2), label: 'WR', mechanism: describe(keyShape.v, keyFill.v, rot2), wrongAxes: [ROT_AXIS] },
          positions.find((p) => p.shape === keyShape.v && p.fill === keyFill.v && p.rot === rot3)
            ? { elements: cell(keyShape.v, keyFill.v, rot3), label: 'PM', mechanism: `copyCell:R${positions.find((p) => p.shape === keyShape.v && p.fill === keyFill.v && p.rot === rot3)!.row}C${positions.find((p) => p.shape === keyShape.v && p.fill === keyFill.v && p.rot === rot3)!.col}`, wrongAxes: [ROT_AXIS] }
            : chimera(describe(keyShape.v, keyFill.v, rot3), cell(keyShape.v, keyFill.v, rot3), [ROT_AXIS]),
          positions.find((p) => p.shape === keyShape.v && p.fill === keyFill.v && p.rot === rot4)
            ? { elements: cell(keyShape.v, keyFill.v, rot4), label: 'PM', mechanism: `copyCell:R${positions.find((p) => p.shape === keyShape.v && p.fill === keyFill.v && p.rot === rot4)!.row}C${positions.find((p) => p.shape === keyShape.v && p.fill === keyFill.v && p.rot === rot4)!.col}`, wrongAxes: [ROT_AXIS] }
            : chimera(describe(keyShape.v, keyFill.v, rot4), cell(keyShape.v, keyFill.v, rot4), [ROT_AXIS]),
          chimera(describe(keyShape.v, wrongFill, rot1), cell(keyShape.v, wrongFill, rot1), [FILL_AXIS]),
        ]
        if (validSet(candidates)) return candidates
      }
    }

    throw new Error(`LRM-3R-XLAYER: no distractor construction cleared all gates for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => true, // 45deg/135deg steps on a tick (asymmetric element) — both non-cardinal; same bonus as LRM-2R-XLAYER/LRM-ROT.
  structuralExtra: (params: ThreeRXLayerParams) => ({ startShape: params.startShape, startFill: params.startFill, rotBase: params.rotBase, rotStepCol: params.rotStepCol, rotStepRow: params.rotStepRow }),
}
