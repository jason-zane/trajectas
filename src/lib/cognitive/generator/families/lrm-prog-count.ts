/**
 * LRM-PROG-COUNT — M1's family. Doc 03-logical-reasoning-design.md §6 M1:
 * double count progression, R1 on `outer.count`, both directions, step 1.
 *
 * DEVIATION (already found and documented by the LR-4 fixture
 * tests/fixtures/cognitive/m1.ts, reused here): doc 03-logical-reasoning-
 * design.md's option D is "6 solid circles", but `RepeatElement.count` caps
 * at 5 and a `Cell` holds at most 4 `elements`, so 6 individual circles
 * aren't representable either way. That single fact also rules out the
 * WHOLE "step grows" WR mechanism doc 03-logical-reasoning-design.md §6 M1
 * describes for its own option D — ANY double progression that spans the
 * full [1,5] range (which a 3x3 grid with step 1/1 necessarily does, since
 * the diagonal covers 4 steps) leaves zero headroom for a numeric wrong-rule
 * distractor without overflowing the schema's count cap in one direction or
 * underflowing it in the other. This family's `distractorPlan` swaps the WR
 * slot for a second near-miss instead.
 *
 * SECOND FINDING, from actually running this family through the
 * context-blind gate (G-08): doc 03-logical-reasoning-design.md's own M1
 * option E ("correct count, wrong element identity") is individually
 * plausible but UNSAFE to combine with the family's only other near-misses
 * (which are correct-identity/wrong-count) on a SINGLE-rule item. With only
 * one rule-governed axis (`outer.count`), G-08's modal-vote scorer looks at
 * that one axis alone — so ANY distractor that keeps the key's count
 * (however wrong its shape/fill) inflates the key's count-value frequency
 * among the 5 options, and on a single axis "inflated" very quickly becomes
 * "the modal (or tied-modal) value", which is an automatic G-08 fail. This
 * is doc 03-item-generation-pipeline.md §4.4/Appendix A's own diagnosis
 * ("if most distractors are near-misses wrong on exactly one axis, the
 * key's value is held by all the options not perturbed on that axis — a
 * majority") taken to its most extreme case: a ONE-axis item has nowhere
 * else for that majority to hide. The fix applied here is the same one
 * Appendix A prescribes for M7: make PAIRS of distractors agree on the same
 * WRONG count (4-and-4, 3-and-3) rather than each perturbing a different
 * axis while leaving count untouched — so no value, including the key's,
 * is the single most-represented one. `buildDistractors` below verifies
 * this arithmetic in its own comment; `qa/contextblind.ts` verifies it
 * again at generation time.
 */
import type { Element, RuleSpec } from '../../spec/schema'
import { type AxisValue, numVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx } from '../compose'
import { chimera, incompleteRule, repetition } from '../distractors'
import type { Rng } from '../rng'

// Restricted to shapes whose per-count-unit ink area (bounding-box width S =
// 25 canvas units) stays inside qa/density.ts's [0.04, 0.38] coverage band
// at BOTH count=1 and count=5 — a real finding from running this family
// through G-15: triangle (~0.027/unit) and diamond (~0.031/unit) both fall
// below the 0.04 floor at count=1, so a lone triangle/diamond at S reads as
// too sparse. circle/square/pentagon all clear the floor.
const SHAPES = ['circle', 'square', 'pentagon'] as const
const FILLS = ['outline', 'solid', 'hatched'] as const

export interface M1Params {
  shape: (typeof SHAPES)[number]
  altShape: (typeof SHAPES)[number]
  fill: (typeof FILLS)[number]
  altFill: (typeof FILLS)[number]
  base: number
  stepCol: number
  stepRow: number
}

const AXIS = 'outer.count'

function repeatCell(shape: (typeof SHAPES)[number], fill: (typeof FILLS)[number], count: number): Element[] {
  return [{ type: 'repeat', layer: 'outer', shape, fill, size: 'S', count, rotation: 0 }]
}

export const LRM_PROG_COUNT: FamilyTemplate<M1Params> = {
  code: 'LRM-PROG-COUNT',
  axes: [AXIS],
  domains: () => ({ [AXIS]: { kind: 'numeric-linear' } as AxisDomain }),
  valueAt: (axis, row, col, params) => {
    if (axis !== AXIS) throw new Error(`unknown axis ${axis}`)
    return numVal(params.base + params.stepCol * (col - 1) + params.stepRow * (row - 1))
  },
  ruleSpecs: (params): RuleSpec[] => [
    {
      id: 'R1',
      axis: AXIS,
      direction: 'both',
      params: { base: params.base, stepPerColumn: params.stepCol, stepPerRow: params.stepRow },
      statement: `Count increases by ${params.stepCol} per column (left to right) and by ${params.stepRow} per row (top to bottom).`,
    },
  ],
  radicals: { ruleCount: 1, ruleIds: ['R1'], crossLayer: false, perceptualLoad: 0, elementTypes: 2, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'PM', 'RP', 'PM'],
  sampleParams(rng: Rng): M1Params {
    const shape = rng.pick(SHAPES)
    const altShape = rng.pick(SHAPES.filter((s) => s !== shape))
    const fill = rng.pick(FILLS)
    const altFill = rng.pick(FILLS.filter((f) => f !== fill))
    const forward = rng.pick([true, false])
    return { shape, altShape, fill, altFill, base: forward ? 1 : 5, stepCol: forward ? 1 : -1, stepRow: forward ? 1 : -1 }
  },
  buildCell(values, params) {
    const v = values[AXIS] as AxisValue
    if (v.t !== 'num') throw new Error('outer.count must be numeric')
    return repeatCell(params.shape, params.fill, v.v)
  },
  buildDistractors(ctx: DistractorCtx<M1Params>) {
    const { params } = ctx
    const key = ctx.valueAt(AXIS, 3, 3)
    const stall = ctx.valueAt(AXIS, 3, 2) // doc's option A: "repeats R3C2's count"
    const rp = ctx.valueAt(AXIS, 3, 1) // doc's option C: "repetition of R3C1"
    if (key.t !== 'num' || stall.t !== 'num' || rp.t !== 'num') throw new Error('outer.count must be numeric')

    // Two PAIRS sharing a wrong count (stall.v twice, rp.v twice) so that,
    // on this item's single rule axis, no count value — including the
    // key's — is the outright plurality. See the family-level comment for
    // why a lone "correct count, wrong identity" distractor is unsafe here.
    const ir = incompleteRule('stall:outer.count@prevColumn', repeatCell(params.shape, params.fill, stall.v), AXIS, key, stall)
    const pmStallWrongShape = chimera('stall:outer.count@prevColumn+wrongShape', repeatCell(params.altShape, params.fill, stall.v), [AXIS])
    const rpCand = repetition('copyCell:R3C1', repeatCell(params.shape, params.fill, rp.v), key.v === rp.v ? [] : [AXIS])
    const pmRpWrongFill = chimera('copyCell:R3C1+wrongFill', repeatCell(params.shape, params.altFill, rp.v), [AXIS])
    return [ir, pmStallWrongShape, rpCand, pmRpWrongFill]
  },
  nonCardinalAsymmetricRotation: () => false,
  // M1 has no distribution to relabel over (a single repeated shape, not a
  // 3-value Latin square) — see qa/duplicates.ts's header finding. Shape
  // and fill identity ARE structurally distinguishing here, so fold them
  // into the structural hash rather than let G-13 collapse every clone
  // that shares the same (base, stepCol, stepRow) into one "duplicate".
  structuralExtra: (params: M1Params) => ({ shape: params.shape, altShape: params.altShape, fill: params.fill, altFill: params.altFill }),
}
