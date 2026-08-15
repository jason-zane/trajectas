/**
 * Solution-uniqueness verification (doc 03-item-generation-pipeline.md §5).
 * The highest-value gate in the pipeline: given only the 8 visible context
 * cells, independently re-derive every rule reading consistent with them and
 * confirm they all agree on a single value at (3,3) for every rule-relevant
 * axis (Level A), then confirm exactly one option realises that content and
 * no other option is defensible under any surviving reading (Level B).
 *
 * This module does NOT know how the item was generated. It only looks at
 * the grid's 8 cells and the options — the same information a candidate
 * has — which is what makes it an independent check rather than the
 * generator grading its own homework.
 */
import type { GridCell } from '../../spec/schema'
import { type AxisId, type AxisValue, type CellLike, axesPresentIn, axisEq, axisKey, buildLattice, cellEq, distinctValueCount, readAxis } from '../axes'
import { type AxisDomain, type AxisRule, inferDomain, ruleSpaceFor } from '../rules'

export interface SurvivingRule {
  axis: AxisId
  rule: AxisRule
  implied: AxisValue
}

export type AdmissibleTuple = SurvivingRule[]

export interface LevelAOk {
  ok: true
  impliedByAxis: Record<AxisId, AxisValue>
  admissibleTuples: AdmissibleTuple[]
  perAxisReadings: Record<AxisId, SurvivingRule[]>
}
export interface LevelAFail {
  ok: false
  reason: 'AXIS_UNEXPLAINED' | 'AXIS_AMBIGUOUS'
  detail: Record<string, unknown>
}
export type LevelAResult = LevelAOk | LevelAFail

/**
 * `axes` should be the union of every rule-governed axis PLUS every axis
 * that is observed to vary among the 8 cells (a varying axis with no
 * declared rule is exactly the degeneracy this gate exists to catch — see
 * `detectAllAxes` below, used by callers that don't already know the full
 * axis list). `domains` supplies the candidate-rule search space per axis;
 * an axis with no entry falls back to `inferDomain`.
 */
export function levelA(grid: readonly GridCell[], axes: readonly AxisId[], domains: Partial<Record<AxisId, AxisDomain>> = {}): LevelAResult {
  const impliedByAxis: Record<AxisId, AxisValue> = {}
  const perAxisReadings: Record<AxisId, SurvivingRule[]> = {}

  for (const axis of axes) {
    const lat = buildLattice(grid, (r, c) => readAxis(grid.find((g) => g.row === r && g.col === c) ?? { elements: [] }, axis))
    const varies = distinctValueCount(lat) > 1
    const domain = domains[axis] ?? inferDomain(lat)

    const surviving: SurvivingRule[] = []
    for (const rule of ruleSpaceFor(axis, domain, lat)) {
      if (!rule.explains(lat)) continue
      const implied = rule.implies(lat, 3, 3)
      if (!implied) continue
      surviving.push({ axis, rule, implied })
    }

    if (varies && surviving.length === 0) {
      return { ok: false, reason: 'AXIS_UNEXPLAINED', detail: { axis } }
    }

    const impliedValues = dedupeByKey(surviving.map((s) => s.implied))
    if (impliedValues.length > 1) {
      return {
        ok: false,
        reason: 'AXIS_AMBIGUOUS',
        detail: { axis, readings: surviving.map((s) => ({ rule: s.rule.label, implies: axisKey(s.implied) })) },
      }
    }
    if (impliedValues.length === 0 && !varies) {
      const cells = grid.filter((c) => readAxis(c, axis) !== null)
      const constVal = cells.length > 0 ? readAxis(cells[0], axis) : null
      if (constVal) impliedValues.push(constVal)
    }
    if (impliedValues.length === 0) {
      // Axis observed nowhere at all — nothing to imply, nothing to fail on.
      continue
    }

    impliedByAxis[axis] = impliedValues[0]
    perAxisReadings[axis] = surviving
  }

  // admissibleTuples is a singleton by construction: each axis independently
  // has exactly one implied value once we reach here, so the cartesian
  // product across axes of (axis -> its one implied reading) has one entry.
  // Kept as a list of per-axis SurvivingRule arrays (one tuple = pick one
  // surviving rule per axis) for Level B's defensibility check.
  const tuple: AdmissibleTuple = axes
    .filter((a) => perAxisReadings[a] && perAxisReadings[a].length > 0)
    .map((a) => perAxisReadings[a].find((s) => axisEq(s.implied, impliedByAxis[a]))!)

  return { ok: true, impliedByAxis, admissibleTuples: [tuple], perAxisReadings }
}

function dedupeByKey(values: AxisValue[]): AxisValue[] {
  const seen = new Map<string, AxisValue>()
  for (const v of values) if (!seen.has(axisKey(v))) seen.set(axisKey(v), v)
  return [...seen.values()]
}

export interface LevelBOk {
  ok: true
  keyIndex: number
}
export interface LevelBFail {
  ok: false
  reason: 'KEY_NOT_UNIQUE_AMONG_OPTIONS' | 'DISTRACTOR_DEFENSIBLE'
  detail: Record<string, unknown>
}
export type LevelBResult = LevelBOk | LevelBFail

function tupleSatisfiedBy(tuple: AdmissibleTuple, cell: CellLike): boolean {
  return tuple.every((s) => {
    const v = readAxis(cell, s.axis)
    return v !== null && axisEq(v, s.implied)
  })
}

/** Builds a synthetic {elements} cell out of Level A's implied axis values, for the keyCell-equality check. */
export function keyCellFromImplied(impliedByAxis: Record<AxisId, AxisValue>, buildCell: (values: Record<AxisId, AxisValue>) => CellLike['elements']): CellLike {
  return { elements: buildCell(impliedByAxis) }
}

export function levelB(options: readonly CellLike[], la: LevelAOk): LevelBResult {
  const tuple = la.admissibleTuples[0]
  const realising = options.map((o, i) => ({ o, i })).filter(({ o }) => tupleSatisfiedBy(tuple, o))
  if (realising.length !== 1) {
    return { ok: false, reason: 'KEY_NOT_UNIQUE_AMONG_OPTIONS', detail: { count: realising.length, matches: realising.map((r) => r.i) } }
  }
  const keyIndex = realising[0].i
  for (let i = 0; i < options.length; i++) {
    if (i === keyIndex) continue
    for (const t of la.admissibleTuples) {
      if (tupleSatisfiedBy(t, options[i])) {
        return { ok: false, reason: 'DISTRACTOR_DEFENSIBLE', detail: { slot: i } }
      }
    }
  }
  return { ok: true, keyIndex }
}

/** Every `(layer, attribute)` axis that appears ANYWHERE among the 8 cells — used so Level A also probes axes a family didn't declare as rule-governed (a real AXIS_UNEXPLAINED catch). */
export function detectAllAxes(grid: readonly GridCell[]): AxisId[] {
  const out = new Set<AxisId>()
  for (const cell of grid) for (const axis of axesPresentIn(cell)) out.add(axis)
  return [...out]
}

export { cellEq }
