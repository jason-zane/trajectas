/**
 * LRM-ROT — M2's family. Doc 03-logical-reasoning-design.md §6 M2: arrow
 * rotation progression, R2 on `outer.rotation`, step +45deg/column with a
 * +90deg/row offset (or the mirror-image anticlockwise/negated variants,
 * which is this family's incidental — doc §4.2 licenses "rotation of the
 * entire stimulus set by a cardinal angle" and reflection, and a sign flip
 * on both steps is exactly a 180-degree whole-grid rotation of the same
 * pattern). `arrow` has rotational symmetry order 1 (doc 03-item-
 * generation-pipeline.md §3.5's SYMMETRY_INVISIBLE table), so no step
 * choice here can make a rotation invisible.
 *
 * SIX OPTIONS (v3): five distractors with mechanisms IR (stall at R2C3),
 * PM (stalled rotation with altFill), WR (wrong step rule), and RP
 * (repetition from R3C2, plus a second RP from R2C2). Rotation multiset:
 * {key, irVal, irVal, wrVal, rpVal, rp2Val} where irVal appears 2x (modal
 * on numeric axis, but key not modal). Modal hit rate P(hit) = 0 if key
 * rotation not in {irVal, rpVal, rp2Val}. Complexity spread over 6 rotation
 * values, with fill variation (solid, outline, hatched) on first two
 * rotation values only.
 */
import type { Element, RuleSpec } from '../../spec/schema'
import { numVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx } from '../compose'
import { chimera, incompleteRule, repetition } from '../distractors'
import type { Rng } from '../rng'

const AXIS = 'outer.rotation'
const STEP_COL_MAG = 45
const STEP_ROW_MAG = 90

const FILLS = ['outline', 'solid', 'hatched'] as const

export interface M2Params {
  base: number
  stepCol: number // +-45
  stepRow: number // +-90
  fill: (typeof FILLS)[number]
  altFill: (typeof FILLS)[number]
}

function arrowCell(rotation: number, fill: (typeof FILLS)[number] = 'outline'): Element[] {
  return [{ type: 'shape', layer: 'outer', shape: 'arrow', fill, size: 'M', anchor: 'CTR', rotation: ((rotation % 360) + 360) % 360 }]
}

export const LRM_ROT: FamilyTemplate<M2Params> = {
  code: 'LRM-ROT',
  axes: [AXIS],
  domains: () => ({ [AXIS]: { kind: 'numeric-angle' } as AxisDomain }),
  valueAt: (axis, row, col, params) => {
    if (axis !== AXIS) throw new Error(`unknown axis ${axis}`)
    const v = (((params.base + params.stepCol * (col - 1) + params.stepRow * (row - 1)) % 360) + 360) % 360
    return numVal(v)
  },
  ruleSpecs: (params): RuleSpec[] => [
    {
      id: 'R2',
      axis: AXIS,
      direction: 'both',
      params: { base: params.base, stepPerColumn: params.stepCol, stepPerRow: params.stepRow, modulus: 360 },
      statement: `Arrow rotation advances ${params.stepCol} degrees clockwise per column and ${params.stepRow} degrees per row, from a base of ${params.base} degrees.`,
    },
  ],
  // elementTypes: schema floor is 2 even though this family draws a single
  // shape (arrow) throughout — the fill-varied PM distractor is the second
  // "identity" in play at the response stage.
  radicals: { ruleCount: 1, ruleIds: ['R2'], crossLayer: false, perceptualLoad: 0, elementTypes: 2, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  // IR and its fill-varied twin below SHARE one wrong rotation value (see
  // the family-level comment on why a single-axis item needs a paired wrong
  // value at all, and why one pair is enough here). For six options, a
  // second RP is added from R2C2 (different row/column, different rotation
  // value than the first RP).
  distractorPlan: ['IR', 'PM', 'WR', 'RP', 'RP'],
  sampleParams(rng: Rng): M2Params {
    const base = rng.int(0, 7) * 45
    // FINDING: only two of the four (colSign, rowSign) combinations are
    // usable. Brute-force check (all 9 cells' values mod 360, base cancels
    // out of the comparison): with sc=+-45, sr=-+90 (opposite signs), the
    // key at (3,3) collides EXACTLY with context cell (2,1) for every base
    // — degeneracy KEY_EQUALS_CELL, unconditionally. With sc/sr the SAME
    // sign (doc 03-logical-reasoning-design.md's own choice, +45/+90, and
    // its mirror -45/-90), the only coincidences are between two CONTEXT
    // cells ((1,3)=(2,1) and (2,3)=(3,1)) — harmless for a single-rule item,
    // see qa/degeneracy.ts's own note on why CELL_DUPLICATE is skipped
    // there. Same-sign is therefore the only safe choice.
    const sign = rng.pick([1, -1])
    const fill = rng.pick(FILLS)
    const altFill = rng.pick(FILLS.filter((f) => f !== fill))
    return { base, stepCol: STEP_COL_MAG * sign, stepRow: STEP_ROW_MAG * sign, fill, altFill }
  },
  buildCell(values, params) {
    const v = values[AXIS]
    if (v.t !== 'num') throw new Error('outer.rotation must be numeric')
    return arrowCell(v.v, params.fill)
  },
  buildDistractors(ctx: DistractorCtx<M2Params>) {
    const { params } = ctx
    const key = ctx.valueAt(AXIS, 3, 3)
    if (key.t !== 'num') throw new Error('outer.rotation must be numeric')

    // IR (doc's own "reads the wrong reference cell" near-miss): stalls at
    // the previous row's value for this column (drops the row offset).
    const irVal = ctx.valueAt(AXIS, 2, 3)
    if (irVal.t !== 'num') throw new Error('outer.rotation must be numeric')
    const ir = incompleteRule('stall:outer.rotation@prevRow', arrowCell(irVal.v, params.fill), AXIS, key, irVal)

    // PM: the SAME stalled rotation as IR, but with the wrong fill — a
    // chimera of "the stalled angle" and "a fill that doesn't belong to any
    // cell showing that angle". Pairs with IR on the rule axis (context-blind repair).
    const pm = chimera('stall:outer.rotation@prevRow+wrongFill', arrowCell(irVal.v, params.altFill), irVal.v === key.v ? [] : [AXIS])

    // WR (doc option A): over-rotation — applies the ROW step magnitude instead of the column step for the final column increment.
    const wrVal = (((key.v - params.stepCol + params.stepRow) % 360) + 360) % 360
    const wr = { elements: arrowCell(wrVal, params.fill), label: 'WR' as const, mechanism: 'wrongRule:appliesRowStepAsColumnStep', wrongAxes: wrVal === key.v ? [] : [AXIS] }

    // RP (doc option B): repetition of R3C2 — the "no change" default.
    const rpVal = ctx.valueAt(AXIS, 3, 2)
    if (rpVal.t !== 'num') throw new Error('outer.rotation must be numeric')
    const rp = repetition('copyCell:R3C2', arrowCell(rpVal.v, params.fill), rpVal.v === key.v ? [] : [AXIS])

    // RP2: repetition of R2C2 — alternative diagonal position with different
    // rotation value, adding structural diversity without changing the modal
    // value (which is already irVal, held by both IR and PM).
    const rp2Val = ctx.valueAt(AXIS, 2, 2)
    if (rp2Val.t !== 'num') throw new Error('outer.rotation must be numeric')
    const rp2 = repetition('copyCell:R2C2', arrowCell(rp2Val.v, params.fill), rp2Val.v === key.v ? [] : [AXIS])

    return [ir, pm, wr, rp, rp2]
  },
  nonCardinalAsymmetricRotation: () => true, // step magnitude 45deg on an asymmetric element (arrow) — doc 03-logical-reasoning-design.md §4.4's non-cardinal bump applies.
  structuralExtra: (params: M2Params) => ({ fill: params.fill, altFill: params.altFill }),
}
