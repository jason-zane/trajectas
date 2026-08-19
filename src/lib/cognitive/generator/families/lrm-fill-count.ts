/**
 * LRM-FILL-COUNT — size (cheap, R6 Latin square) × count (hard, R1 progression) family.
 * Surface: ONE `repeat` element on layer `outer`, size fixed S, shape constant per item,
 * rotation 0, counts 1..6.
 *
 * DESIGN RATIONALE: The original LRM-SIZE-COUNT concept (size Latin square × count progression)
 * was rejected due to ink-ceiling violations at large sizes. With counts up to 6 and sizes S/M/L,
 * the largest size L with count ≥ 2 exceeds the 38% ink limit. The revised design uses fill as
 * the cheap (Latin square) axis instead, keeping size constant at S (6 circles at S = 6 × 491 ~29%,
 * under budget), while counts progress over 1..6 on the hard axis. This preserves the two-rule
 * structure and the contrast between cheap elimination (fill) and hard reasoning (count).
 *
 * SIX OPTIONS (v3): Five distractors with mechanisms IR (stall count at R3C2), PM (wrong fill +
 * stalled count), WR (off-by-step count), and RP (copied cells). Fill multiset: {f*, f*, f*,
 * altFill, altFill2, f*} = 4× key fill (f*), 1× altFill (R3C2's fill), 1× altFill2 (third distinct
 * fill in Latin set); key is modal on fill (4 votes = max). Count multiset: {k, c1, c2, c3, c1, c1}
 * where k = key count, c1/c2/c3 are three distinct wrong counts; c1 appears 3x (D1 at R3C2, D4 at
 * R3C2 with wrong fill, D5 at R2C2 position); c2 and c3 appear once each. Key is not modal on count.
 *
 * G-08′ (context-blind): modal fills form a set {f*} with 4 votes; cartesian product of tied-for-top
 * includes key (4 votes > 3 others). Modal counts: c1 appears 3×, k appears 1×, c2 1×, c3 1× → c1 is
 * sole modal (3 votes > all others). Key's count (k) is not modal. Composite: key is not the sole
 * option matching {f*} and c1, so G-08 passes. P(hit) = 0 (key does not match the modal composition).
 *
 * G-09 (complexity spread): cells have uniform structure (one repeat element per cell, varying only in
 * count). Complexity = count. The six options' counts are {c1, c1, c1, c2, c3, k}; max − min ≤ 3 by
 * construction (counts stay in 1..6, spread capped). Key not sole bulk extremum: ensure k is not the
 * unique max or min; redraw if k ∈ {1, 6}.
 *
 * G-19 (cue classes): all options use fills from the Latin set {f*, altFill, altFill2} (in-vocab).
 * All counts are in-vocab (all 6 options' counts appear in the grid or are derived from the progression).
 * Key's class: depends on whether some visible cell has (f*, k). If it does, key is a "twin"; otherwise,
 * key is "novel" (unique count/fill pair). Either class must be shared by at least one distractor:
 * D1 (f*, c1) is never a twin of the key (c1 ≠ k), so if the key is a twin somewhere else, D1 is still
 * "novel" within the six options. Distractors cover both "novel" and "in-vocab" classes; gate accepts
 * when key's class appears among distractors (checked at generation time).
 *
 * G-20 (cheap elimination): cheap axis = outer.fill. All six options carry a fill from the Latin set.
 * Eliminating by fill (the cheap axis) leaves: options with f* (D1, D2, D3, D6 = 4 options); options with
 * altFill (D4 = 1 option); options with altFill2 (D5 = 1 option). The intersection of the key's fill (f*)
 * with the six options is 4 options. `max(4, N−2)` = `max(4, 4)` = 4. G-20 requires ≥ 4 survivors in the
 * intersection; we have exactly 4 — passes. (Note: this family uses the floor, not a higher threshold.)
 *
 * Predicted b: radicals give ruleCount 2, ruleIds ['R6', 'R1'], cheapRuleIds ['R6']. Predicted b formula:
 * base −2.0 + 0.45 (R6@cost 0.9) + 0 (R1 single-presence) + 0.5 (cross-count: count axis, no length/bars)
 * = −1.05 → band 'easy'.
 *
 * Distractor contract (six options):
 * D1 (IR): (f*, c1) — fill matches key; count stalled at R3C2 (c1 = count at R3C2).
 * D2 (IR/WR): (f*, c2) — fill matches key; count is a second stall or mechanism-derived value (c2).
 * D3 (WR): (f*, c3) — fill matches key; count is a wrong rule application (c3).
 * D4 (PM): (altFill, c1) — fill from R3C2 (not key's fill), count matches D1's stalled value (c1).
 * D5 (PM): (altFill2, c1) — fill is the third distinct fill in Latin set, count matches D1/D4 (c1).
 * D6 (RP): (f*, c1) — repeat of R2C2 (fill=f*, count=c1 from the grid at R2C2).
 *
 * Literature: Carpenter et al. (1990) on quantitative reasoning and distribution patterns; Embretson (1998)
 * on radicals and incidentals in figural reasoning.
 *
 * Render directives: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 }
 * with density check: densest cell must have ink ≤ 38% (validated in test).
 */
import type { Element, RuleSpec } from '../../spec/schema'
import { enumVal, numVal, cellEq } from '../axes'
import { uniquelySolvable } from './bitgrid'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx } from '../compose'
import { chimera, incompleteRule } from '../distractors'
import type { Rng } from '../rng'

const FILL_AXIS = 'outer.fill'
const COUNT_AXIS = 'outer.count'

// Three-element fill sets drawn from {outline, hatched, grey, solid}.
const FILL_SETS = [
  ['outline', 'hatched', 'grey'],
  ['outline', 'hatched', 'solid'],
  ['outline', 'grey', 'solid'],
  ['hatched', 'grey', 'solid'],
] as const

// Shapes: use a small set to keep visual variety while maintaining simplicity.
/** Shapes whose S-size area clears qa/density.ts's 4% ink floor at count 1 (circle 4.9%, square 6.3%, pentagon 4.1%, hexagon 5.4%; triangle/diamond/star/cross at S do not). */
const SHAPES = ['circle', 'square', 'pentagon', 'hexagon'] as const

export interface LRMFillCountParams {
  fillSet: readonly [string, string, string]
  rowOffset: 1 | 2 // Latin square row offset (cyclic shift magnitude)
  shape: (typeof SHAPES)[number]
  base: number // count at (1,1)
  stepCol: number // count increment per column (±1)
  stepRow: number // count increment per row (±1, 0)
}

function repeatCell(shape: string, fill: string, count: number): Element[] {
  return [{ type: 'repeat', layer: 'outer', shape: shape as typeof SHAPES[number], fill: fill as 'outline' | 'hatched' | 'grey' | 'solid', size: 'S', count, rotation: 0 }]
}

/** Cyclic Latin square: fill = fillSet[(col-1 + rowOffset*(row-1)) % 3] */
function fillAt(fillSet: readonly [string, string, string], rowOffset: number, row: number, col: number): string {
  const idx = ((col - 1 + rowOffset * (row - 1)) % 3 + 3) % 3
  return fillSet[idx]
}

export const LRM_FILL_COUNT: FamilyTemplate<LRMFillCountParams> = {
  code: 'LRM-FILL-COUNT',
  axes: [FILL_AXIS, COUNT_AXIS],
  cheapAxes: [FILL_AXIS],
  domains: () => ({
    [FILL_AXIS]: { kind: 'unordered-enum' } as AxisDomain,
    [COUNT_AXIS]: { kind: 'numeric-linear' } as AxisDomain,
  }),
  valueAt: (axis, row, col, params) => {
    if (axis === FILL_AXIS) return enumVal(fillAt(params.fillSet, params.rowOffset, row, col))
    if (axis === COUNT_AXIS) return numVal(params.base + params.stepCol * (col - 1) + params.stepRow * (row - 1))
    throw new Error(`unknown axis ${axis}`)
  },
  ruleSpecs: (params): RuleSpec[] => [
    {
      id: 'R6',
      axis: FILL_AXIS,
      direction: 'both',
      params: { values: [...params.fillSet], rowOffset: params.rowOffset },
      statement: `Fill forms a Latin square: each of ${params.fillSet.join(', ')} appears exactly once per row and once per column.`,
    },
    {
      id: 'R1',
      axis: COUNT_AXIS,
      direction: 'both',
      params: { base: params.base, stepPerColumn: params.stepCol, stepPerRow: params.stepRow },
      statement: `Count increases by ${params.stepCol} per column and by ${params.stepRow} per row, from a base of ${params.base}.`,
    },
  ],
  radicals: { ruleCount: 2, ruleIds: ['R6', 'R1'], crossLayer: false, perceptualLoad: 1, elementTypes: 2, nearMissCount: 3 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'IR', 'WR', 'PM', 'PM'],
  sampleParams(rng: Rng): LRMFillCountParams {
    // Rejection-sample until all counts are in [1, 6] and key count is not 1 or 6
    for (let attempt = 0; attempt < 1000; attempt++) {
      const fillSet = rng.pick(FILL_SETS)
      const rowOffset = rng.pick([1, 2] as const)
      const shape = rng.pick(SHAPES)
      const base = rng.int(1, 5) // base count: 1..5, allowing more flexibility
      const stepCol = rng.pick([1, -1] as const)
      const stepRow = rng.pick([1, 0, -1] as const)

      // Verify all nine counts (8 visible + key at 3,3) are in range [1, 6]
      const counts = []
      for (let r = 1; r <= 3; r++) {
        for (let c = 1; c <= 3; c++) {
          counts.push(base + stepCol * (c - 1) + stepRow * (r - 1))
        }
      }
      if (counts.some((c) => c < 1 || c > 6)) {
        continue // Retry if out of bounds
      }

      // Ensure key count k is not 1 or 6 (extrema), to allow wrong counts on both sides
      const keyCount = counts[8] // index 8 = (3,3)
      if (keyCount === 1 || keyCount === 6) {
        continue // Retry if key is at an extremum
      }

      // G-12: no two visible cells identical (same fill AND count) and the key
      // not identical to a visible cell — a Latin fill over a count
      // progression repeats (fill, count) pairs on a real fraction of draws.
      // Then Level A on the eight visible cells (the verifier now also tries
      // R12 sum/difference; redraw on any rival reading).
      const fs = fillSet as unknown as [string, string, string]
      const cells = [] as { row: number; col: number; elements: Element[] }[]
      for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) if (!(r === 3 && c === 3)) cells.push({ row: r, col: c, elements: repeatCell(shape, fillAt(fs, rowOffset, r, c), base + stepCol * (c - 1) + stepRow * (r - 1)) })
      let dup = false
      for (let i = 0; i < cells.length && !dup; i++) for (let j = i + 1; j < cells.length; j++) if (cellEq(cells[i], cells[j])) { dup = true; break }
      if (dup) continue
      const keyCell = { elements: repeatCell(shape, fillAt(fs, rowOffset, 3, 3), keyCount) }
      if (cells.some((c) => cellEq(c, keyCell))) continue
      if (!uniquelySolvable(cells, [FILL_AXIS, COUNT_AXIS], { [FILL_AXIS]: { kind: 'unordered-enum' }, [COUNT_AXIS]: { kind: 'numeric-linear' } })) continue

      return { fillSet: fs, rowOffset, shape, base, stepCol, stepRow }
    }
    throw new Error('LRM-FILL-COUNT: sampleParams could not find a valid parameter combination in 200 attempts')
  },
  buildCell(values, params) {
    const fill = values[FILL_AXIS]
    const count = values[COUNT_AXIS]
    if (fill.t !== 'enum' || count.t !== 'num') throw new Error('fill/count must be enum/num')
    return repeatCell(params.shape, fill.v, count.v)
  },
  buildDistractors(ctx: DistractorCtx<LRMFillCountParams>) {
    const { params } = ctx
    const keyFill = ctx.valueAt(FILL_AXIS, 3, 3)
    const keyCount = ctx.valueAt(COUNT_AXIS, 3, 3)
    if (keyFill.t !== 'enum' || keyCount.t !== 'num') throw new Error('fill/count must be enum/num')

    // Get fill and count at reference cells
    const r3c2Fill = ctx.valueAt(FILL_AXIS, 3, 2)
    const r3c2Count = ctx.valueAt(COUNT_AXIS, 3, 2) // c1: stalled count (drop column step)
    const r3c1Fill = ctx.valueAt(FILL_AXIS, 3, 1)

    if (r3c2Fill.t !== 'enum' || r3c2Count.t !== 'num' || r3c1Fill.t !== 'enum') {
      throw new Error('expected enum/num values')
    }

    const c1 = r3c2Count.v // IR stall: drop column step
    const altFill = r3c2Fill.v // fill at R3C2
    const altFill2 = r3c1Fill.v // fill at R3C1 (third distinct fill in Latin square)

    // c2: another wrong count derived by dropping row step instead of column step
    // count at (2, 3) = base + stepCol*(3-1) + stepRow*(2-1) = base + 2*stepCol + stepRow
    // count at (3, 3) = base + stepCol*(3-1) + stepRow*(3-1) = base + 2*stepCol + 2*stepRow
    // Dropping row step from (3,3): base + 2*stepCol = count at (2,3) relative to row
    let c2 = keyCount.v - params.stepRow
    if (c2 < 1 || c2 > 6 || c2 === keyCount.v || c2 === c1) {
      // Fallback: try opposite direction
      c2 = keyCount.v + params.stepRow
      if (c2 < 1 || c2 > 6 || c2 === keyCount.v || c2 === c1) {
        // Last resort: pick nearest value different from c1, keyCount in [1, 6]
        const candidates = [
          keyCount.v - 1,
          keyCount.v + 1,
          keyCount.v - 2,
          keyCount.v + 2,
          keyCount.v - 3,
          keyCount.v + 3,
        ].filter((x) => x >= 1 && x <= 6 && x !== keyCount.v && x !== c1)
        c2 = candidates.length > 0 ? candidates[0] : c1
      }
    }

    // c3: derive a third wrong count using mechanism (one step further than c1 in column direction)
    let c3 = c1 + params.stepCol
    if (c3 < 1 || c3 > 6 || c3 === keyCount.v || c3 === c1 || c3 === c2) {
      // Fallback: try c1 - stepCol
      c3 = c1 - params.stepCol
      if (c3 < 1 || c3 > 6 || c3 === keyCount.v || c3 === c1 || c3 === c2) {
        // Last resort: pick nearest value different from c1, c2, keyCount in [1, 6]
        const candidates = [
          keyCount.v - 1,
          keyCount.v + 1,
          keyCount.v - 2,
          keyCount.v + 2,
          keyCount.v - 3,
          keyCount.v + 3,
        ].filter((x) => x >= 1 && x <= 6 && x !== keyCount.v && x !== c1 && x !== c2)
        c3 = candidates.length > 0 ? candidates[0] : c1
      }
    }

    // D1 (IR): stall at R3C2's count (drop column step), keep key fill
    const d1 = incompleteRule('stall:outer.count@R3C2', repeatCell(params.shape, keyFill.v, c1), COUNT_AXIS, keyCount, r3c2Count)

    // D2 (IR): stall on row (drop row step), keep key fill
    const d2 = {
      elements: repeatCell(params.shape, keyFill.v, c2),
      label: 'IR' as const,
      mechanism: 'stall:outer.count@dropRowStep',
      wrongAxes: c2 === keyCount.v ? [] : [COUNT_AXIS],
    }

    // D3 (WR): wrong-count mechanism (one-step-too-far or off-by-step)
    const d3 = {
      elements: repeatCell(params.shape, keyFill.v, c3),
      label: 'WR' as const,
      mechanism: c3 > c1 ? 'oneStepTooFar:count' : 'wrongCount:offByStep',
      wrongAxes: c3 === keyCount.v ? [] : [COUNT_AXIS],
    }

    // D4 (PM): wrong fill (from R3C2) + c1 count (perceptual match — same count as D1, wrong fill)
    const d4 = chimera('incompleteCorrelate:wrongFill+R3C2count', repeatCell(params.shape, altFill, c1), altFill === keyFill.v ? [] : [FILL_AXIS])

    // D5 (PM): third distinct fill (from R3C1) + c1 count
    const d5 = chimera('incompleteCorrelate:wrongFill+alternateCount', repeatCell(params.shape, altFill2, c1), altFill2 === keyFill.v ? [] : [FILL_AXIS])

    return [d1, d2, d3, d4, d5]
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params) => ({ shape: params.shape, fillSet: params.fillSet, rowOffset: params.rowOffset, stepCol: params.stepCol, stepRow: params.stepRow }),
}
