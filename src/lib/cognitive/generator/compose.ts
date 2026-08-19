/**
 * Family template -> composed item (8 grid cells + key cell + rule metadata).
 *
 * DEVIATION FROM DOC 03-ITEM-GENERATION-PIPELINE.MD §3.4's SKETCH, worth
 * reporting: that section fills each rule's lattice by seeding `lat[0][0]`
 * from a sampled value and then calling `rule.implies(lat, r, c)` cell by
 * cell in row-major order. That works for progression/rotation (each
 * `implies` only needs the seed) and for the set-operators (each row's
 * derived cell only needs that row's other two cells, which row-major order
 * already fills first). It does NOT work for `latinSquare` as doc's own
 * §3.2 defines it: that rule's `implies` reconstructs a missing value by
 * ELIMINATION from the other two cells in its row/column — which requires
 * 2 of 3 cells already known. Row-major fill from a single seed at (1,1)
 * never has 2 of 3 known for (1,2) or (1,3): only the seed itself is filled
 * when they're computed, so elimination cannot determine them. The doc's
 * own worked M6 example (§2.4) is NOT actually reachable by the algorithm
 * its own §3.4 describes.
 *
 * This module resolves the gap by giving every rule-governed axis a
 * closed-form `valueAt(row, col)` function instead of a lattice-fill loop —
 * generation computes each cell directly (e.g. a Latin square is generated
 * as `ladder[(col-1 + rowOffset*(row-1)) % 3]`, a cyclic shift — this is
 * exactly the structure of doc 03-logical-reasoning-design.md §6's M6 grid:
 * row 1 = square,circle,diamond; row 2 = circle,diamond,square (shift 1);
 * row 3 = diamond,square,circle (shift 2)). The lattice/`explains`/`implies`
 * machinery in rules.ts is reserved for VERIFICATION (qa/uniqueness.ts),
 * where — critically — 8 of 9 cells ARE already known, so elimination poses
 * no bootstrapping problem there. That separation is also a correctness
 * property: verification re-derives the rule space independently of how
 * generation built the grid, rather than the generator checking its own
 * homework.
 */
import type { GridCell, RuleSpec } from '../spec/schema'
import type { AxisDomain } from './rules'
import type { AxisId, AxisValue } from './axes'
import type { Rng } from './rng'
import type { Radicals as RadicalsType, RenderDirectives } from '../spec/schema'

export type ErrorLabel = 'WR' | 'IR' | 'PM' | 'RP'

export interface DistractorCandidate {
  /** Elements only — slot is assigned later by placeOptions. */
  elements: import('../spec/schema').Element[]
  label: ErrorLabel
  /** Named mechanism, for the audit trail (item_option_diagnostics.rationale in the eventual DB row). */
  mechanism: string
  /** Which axes this candidate is wrong on relative to the key. Empty => defensible => must be rejected. */
  wrongAxes: AxisId[]
}

export interface DistractorCtx<P> {
  grid: GridCell[]
  keyCell: { elements: import('../spec/schema').Element[] }
  axes: AxisId[]
  valueAt: (axis: AxisId, row: number, col: number) => AxisValue
  params: P
  template: FamilyTemplate<P>
}

export interface FamilyTemplate<P = unknown> {
  code: string
  /** Rule-governed axes, in the canonical order they appear in `rules[]`. */
  axes: AxisId[]
  /** Cheap axes — those governed by low-inference rules (constants, Latin squares, single-step progressions on visually dominant attributes). Subset of `axes`; empty or undefined means no cheap/hard distinction. Used by gates G-08', G-18, G-20 to scope elimination resistance and difficulty priors to the hard axes only. See build-plan §1 for the terminology and per-gate semantics. */
  cheapAxes?: AxisId[]
  domains(params: P): Record<AxisId, AxisDomain>
  valueAt(axis: AxisId, row: number, col: number, params: P): AxisValue
  ruleSpecs(params: P): RuleSpec[]
  radicals: RadicalsType
  render: RenderDirectives
  /** Fixed order — doc 03-item-generation-pipeline.md §3.3's `distractorPlan`. */
  distractorPlan: ErrorLabel[]
  sampleParams(rng: Rng): P
  buildCell(values: Record<AxisId, AxisValue>, params: P): import('../spec/schema').Element[]
  buildDistractors(ctx: DistractorCtx<P>, rng: Rng): DistractorCandidate[]
  nonCardinalAsymmetricRotation(params: P): boolean
  /** Which of this family's OWN incidentals are structurally distinguishing rather than a relabelling symmetry — see qa/duplicates.ts's header note. Defaults to `{}` (fully collapsed) if omitted. */
  structuralExtra?(params: P): unknown
  /** doc 03-item-generation-pipeline.md's OQ-3 — see qa/degeneracy.ts's `gridLevelDegeneracy` doc comment. Only `families/lrm-move.ts` sets this. */
  permitKeyEqualsCell?: boolean
}

export interface ComposedItem<P = unknown> {
  template: FamilyTemplate<P>
  params: P
  grid: GridCell[] // 8 cells, row-major, blank at (3,3)
  keyCell: { elements: import('../spec/schema').Element[] }
  rules: RuleSpec[]
  domains: Record<AxisId, AxisDomain>
  valueAt: (axis: AxisId, row: number, col: number) => AxisValue
}

// Explicit field declarations, not TS constructor-parameter-property
// shorthand: the pilot-bank script (scripts/cognitive/) runs this file
// under plain Node's built-in TypeScript stripping (no bundler, no
// tsx/ts-node — see that script's own header comment), which only ERASES
// type syntax and cannot handle parameter properties (they also declare a
// class field, which isn't erasable).
export class GeneratorError extends Error {
  readonly code: string
  readonly detail: Record<string, unknown>
  constructor(code: string, detail: Record<string, unknown> = {}) {
    super(`${code}: ${JSON.stringify(detail)}`)
    this.name = 'GeneratorError'
    this.code = code
    this.detail = detail
  }
}

export function composeItem<P>(template: FamilyTemplate<P>, rng: Rng): ComposedItem<P> {
  const params = template.sampleParams(rng.sub('incidentals'))

  const axes = template.axes
  if (new Set(axes).size !== axes.length) {
    throw new GeneratorError('AXIS_COLLISION', { axes, family: template.code })
  }

  const valueAt = (axis: AxisId, row: number, col: number) => template.valueAt(axis, row, col, params)

  const valuesAt = (row: number, col: number) => {
    const values: Record<AxisId, AxisValue> = {}
    for (const axis of axes) values[axis] = valueAt(axis, row, col)
    return values
  }

  const grid: GridCell[] = []
  for (let row = 1; row <= 3; row++) {
    for (let col = 1; col <= 3; col++) {
      if (row === 3 && col === 3) continue
      grid.push({ row, col, elements: template.buildCell(valuesAt(row, col), params) })
    }
  }
  const keyCell = { elements: template.buildCell(valuesAt(3, 3), params) }

  return {
    template,
    params,
    grid,
    keyCell,
    rules: template.ruleSpecs(params),
    domains: template.domains(params),
    valueAt,
  }
}
