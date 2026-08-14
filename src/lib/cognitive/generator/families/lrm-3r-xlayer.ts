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
import { chimera, incompleteRule } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { combinations4 } from '../combinatorics'
import { cellEq } from '../axes'

const SHAPE_AXIS = 'outer.shape'
const FILL_AXIS = 'outer.fill'
const ROT_AXIS = 'inner.rotation'
const TICK_LENGTH = 30
const ROT_MAGNITUDE = 45 // same magnitude as LRM-2R-XLAYER, for the same reason (90deg aliases on a 3x3 grid); not load-bearing for duplicate-safety here, but kept consistent.

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
}

function cyclicLatin<T>(ladder: readonly T[], k: number, start: number, row: number, col: number): T {
  const idx = (((start + (col - 1) + k * (row - 1)) % 3) + 3) % 3
  return ladder[idx]
}

function rotationAt(rotBase: number, row: number, col: number): number {
  return (((rotBase + ROT_MAGNITUDE * (col - 1) + ROT_MAGNITUDE * (row - 1)) % 360) + 360) % 360
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
    if (axis === ROT_AXIS) return numVal(rotationAt(params.rotBase, row, col))
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
      params: { base: params.rotBase, stepPerColumn: ROT_MAGNITUDE, stepPerRow: ROT_MAGNITUDE, modulus: 360 },
      statement: `Inner tick rotation = ${params.rotBase} + ${ROT_MAGNITUDE}*(col-1) + ${ROT_MAGNITUDE}*(row-1), mod 360.`,
    },
  ],
  // Three real rules (two R6 distributions plus one cross-layer R2
  // rotation) — genuinely more rule content than any single doc 03 §6
  // exemplar combines. predictedB = -2.0 + (0.9+0.9+0.3+0.3 non-cardinal
  // bonus) + 0.5*(3-1) + 0.5*1(crossLayer) + 0.3*1(perceptualLoad) +
  // 0.15*(nearMissCount-2) = -2.0 + 2.4 + 1.0 + 0.5 + 0.3 + 0.15 = +2.35 ->
  // Very hard, with 0.85 of headroom over the +1.5 threshold — reached
  // through rule count and cross-layer mapping, not through inflating
  // nearMissCount (which is set to 3 because the distractor plan below
  // genuinely carries 3 near-miss (IR) distractors, matching LRM-3R-DIST's
  // (M7's) own honest declaration for the same reason).
  radicals: { ruleCount: 3, ruleIds: ['R6', 'R6', 'R2'], crossLayer: true, perceptualLoad: 1, elementTypes: 4, nearMissCount: 3 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 10 },
  distractorPlan: ['IR', 'IR', 'IR', 'PM'],
  sampleParams(rng: Rng): ThreeRXLayerParams {
    const shapeSet = rng.pick(SHAPE_SETS)
    const [kShape, kFill] = rng.pick([
      [1, 2],
      [2, 1],
    ] as const)
    const startShape = rng.int(0, 2) as 0 | 1 | 2
    const startFill = rng.int(0, 2) as 0 | 1 | 2
    const rotBase = rng.int(0, 7) * 45
    return { shapeSet: shapeSet as unknown as [string, string, string], kShape, kFill, startShape, startFill, rotBase }
  },
  buildCell(values) {
    const shape = values[SHAPE_AXIS]
    const fill = values[FILL_AXIS]
    const rot = values[ROT_AXIS]
    if (shape.t !== 'enum' || fill.t !== 'enum' || rot.t !== 'num') throw new Error('shape/fill/rotation must be enum/enum/num')
    return cell(shape.v, fill.v, rot.v)
  },
  buildDistractors(ctx: DistractorCtx<ThreeRXLayerParams>) {
    const keyShape = ctx.valueAt(SHAPE_AXIS, 3, 3)
    const keyFill = ctx.valueAt(FILL_AXIS, 3, 3)
    const keyRot = ctx.valueAt(ROT_AXIS, 3, 3)
    if (keyShape.t !== 'enum' || keyFill.t !== 'enum' || keyRot.t !== 'num') throw new Error('shape/fill/rotation must be enum/enum/num')

    // A: IR — shape stalls at R3C1, fill and rotation correct.
    const shapeStall = ctx.valueAt(SHAPE_AXIS, 3, 1)
    if (shapeStall.t !== 'enum') throw new Error('shape must be enum')
    const a = incompleteRule('stall:outer.shape@R3C1', cell(shapeStall.v, keyFill.v, keyRot.v), SHAPE_AXIS, keyShape, shapeStall)

    // B: IR — fill stalls at R3C2, shape and rotation correct.
    const fillStall = ctx.valueAt(FILL_AXIS, 3, 2)
    if (fillStall.t !== 'enum') throw new Error('fill must be enum')
    const b = incompleteRule('stall:outer.fill@R3C2', cell(keyShape.v, fillStall.v, keyRot.v), FILL_AXIS, keyFill, fillStall)

    // C: IR — rotation stalls at R2C3, shape and fill correct.
    const rotStall = ctx.valueAt(ROT_AXIS, 2, 3)
    if (rotStall.t !== 'num') throw new Error('rotation must be num')
    const c = incompleteRule('stall:inner.rotation@R2C3', cell(keyShape.v, keyFill.v, rotStall.v), ROT_AXIS, keyRot, rotStall)

    // D: PM — chimera taking the shape from A's stall and the rotation from
    // C's stall (fill stays correct) — locally plausible ("two of three
    // attributes look like nearby cells") without satisfying either rule.
    const wrongAxesD = [...(shapeStall.v === keyShape.v ? [] : [SHAPE_AXIS]), ...(rotStall.v === keyRot.v ? [] : [ROT_AXIS])]
    const d = chimera('chimera:{outer.shape<-R3C1,inner.rotation<-R2C3}', cell(shapeStall.v, keyFill.v, rotStall.v), wrongAxesD)

    const validSet = (candidates: DistractorCandidate[]): boolean => {
      if (candidates.some((cd) => cd.wrongAxes.length === 0)) return false
      if (candidates.some((cd) => cellEq({ elements: cd.elements }, ctx.keyCell))) return false
      for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) if (cellEq({ elements: candidates[i].elements }, { elements: candidates[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...candidates.map((x) => ({ elements: x.elements }))]
      return contextBlindGate(cells, 0, ctx.axes).ok && giveawayPairGate(cells, ctx.axes).ok
    }

    const primary = [a, b, c, d]
    if (validSet(primary)) return primary

    // Fallback: search a pool of context-cell whole-copies for a 4-subset
    // clearing G-08/G-10 against the fixed key — the same repair pattern as
    // every other multi-rule family here.
    const positions = ctx.grid.map((gc) => {
      const s = ctx.valueAt(SHAPE_AXIS, gc.row, gc.col)
      const f = ctx.valueAt(FILL_AXIS, gc.row, gc.col)
      const r = ctx.valueAt(ROT_AXIS, gc.row, gc.col)
      if (s.t !== 'enum' || f.t !== 'enum' || r.t !== 'num') throw new Error('shape/fill/rotation must be enum/enum/num')
      return { row: gc.row, col: gc.col, shape: s.v, fill: f.v, rot: r.v }
    })
    const labels: Array<'IR' | 'PM'> = ['IR', 'IR', 'IR', 'PM']
    for (const chosen of combinations4(positions)) {
      const candidates: DistractorCandidate[] = chosen.map((p, i) => {
        const wrongAxes = [...(p.shape === keyShape.v ? [] : [SHAPE_AXIS]), ...(p.fill === keyFill.v ? [] : [FILL_AXIS]), ...(p.rot === keyRot.v ? [] : [ROT_AXIS])]
        const elements = cell(p.shape, p.fill, p.rot)
        const mechanism = `copyCell:R${p.row}C${p.col}`
        return labels[i] === 'PM' ? chimera(mechanism, elements, wrongAxes) : { elements, label: 'IR' as const, mechanism, wrongAxes }
      })
      if (validSet(candidates)) return candidates
    }
    throw new Error(`LRM-3R-XLAYER: no distractor construction cleared both G-08 and G-10 for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => true, // 45deg step on a tick (asymmetric element) — same bonus as LRM-2R-XLAYER/LRM-ROT.
  structuralExtra: (params: ThreeRXLayerParams) => ({ startShape: params.startShape, startFill: params.startFill, rotBase: params.rotBase }),
}
