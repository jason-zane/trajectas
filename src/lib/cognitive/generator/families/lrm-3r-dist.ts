/**
 * LRM-3R-DIST — balanced fractional design for a three-cheap-rules item.
 * Doc 03-logical-reasoning-design.md §6 M7: three rules — R6 (shape,
 * Latin square) + R6 (fill, Latin square) + R1 (count = column index: 1, 2,
 * 3). Shape and fill reuse LRM-DIST3X2's orthogonal cyclic-Latin-square
 * construction (kShape != kFill in {1,2}); count is independent (depends
 * only on column).
 *
 * V3 REDESIGN (2026-08-19, build-plan §1.2–1.3): six-option variant (key +
 * five distractors). All three axes are cheap (no hard-axis distinction).
 * Structural limit in qa/degeneracy.ts G-18 proves 3-rule items cannot
 * simultaneously satisfy "no single rule isolates key" AND "no pair isolates
 * key". This family accepts the first: every axis has key value in <= 3 of 6,
 * with wrong value holding >= 3 of 6, so no axis isolates by elimination alone.
 *
 * Six-option set (determined by exhaustive search for pHit = 0):
 * Key (000) + five distractors: AB0, A0C, 0BC, ABC, A00.
 * Per-axis composition on key value (0):
 *  - Shape (A): key in 2/6, wrong (A=1) in 4/6 → modal is wrong (strict)
 *  - Fill (B): key in 3/6, wrong (B=1) in 3/6 → tie, but modal never recovers key
 *  - Count (C): key in 3/6, wrong (C=1) in 3/6 → tie, but modal never recovers key
 * Modal compositions: {(A=1, B=0), (A=1, B=0, C=1), (A=1, B=1, C=0), (A=1, B=1, C=1)}
 * All compositions require A=1, so key (000) has pHit = 0; no blind scorer recovers it.
 *
 * The five distractors:
 * - AB0: wrong on shape and fill, correct on count
 * - A0C: wrong on shape and count, correct on fill
 * - 0BC: wrong on fill and count, correct on shape
 * - ABC: wrong on all three axes (the all-wrong corner)
 * - A00: wrong on shape only, correct on fill and count
 *
 * A/B/C are non-key values (preference: stall values from R3C1/R3C2/R2C3,
 * fallback to other realised values). Every option's wrongness is legible from
 * axis values alone, enforcing rule understanding over option-set guessing.
 *
 * G-18 (all axes cheap): key value in 2–3 of 6 on each axis → no single rule
 * isolates. Two rules together still narrow down but don't force uniqueness.
 * Post-discount predicted b ~0.15 (MODERATE; positions 19–20 pilot data);
 * no longer counted for ceiling. Centroid and modal both fail to recover key.
 *
 * cheapAxes is declared (all three axes), so G-20 skips and G-18 applies
 * the ≥ 2 requirement to all three axes unchanged.
 */
import type { Element, Fill, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, numVal, cellEq } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import { chimera } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { copyEliminationOk, singleRuleSufficiencyOk, eliminationResistanceOk } from '../qa/degeneracy'

const SHAPE_AXIS = 'outer.shape'
const FILL_AXIS = 'outer.fill'
const COUNT_AXIS = 'outer.count'

// Restricted to circle/square/pentagon — see LRM-PROG-COUNT's header note
// (same finding, same fix): at count=1, size S=25, triangle (~0.027 ink
// fraction) and diamond (~0.031) both fall below the 0.04 G-15 floor. This
// family also renders `repeat` elements down to count=1, so the same
// restriction applies — and those three shapes are the only ones that
// clear the floor, so there is exactly one safe 3-element set; incidental
// diversity comes from `kShape`/`startShape` (which physical shape plays
// which Latin-square role) rather than from swapping the set itself.
const SHAPE_SETS = [['circle', 'square', 'pentagon']] as const
const FILL_LADDER = ['outline', 'solid', 'hatched'] as const

export interface M7Params {
  shapeSet: readonly [string, string, string]
  kShape: 1 | 2
  kFill: 1 | 2
  startShape: 0 | 1 | 2
  startFill: 0 | 1 | 2
}

function cyclicLatin<T>(ladder: readonly T[], k: number, start: number, row: number, col: number): T {
  const idx = (((start + (col - 1) + k * (row - 1)) % 3) + 3) % 3
  return ladder[idx]
}

function repeatCell(shape: string, fill: string, count: number): Element[] {
  return [{ type: 'repeat', layer: 'outer', shape: shape as ShapeId, fill: fill as Fill, size: 'S', count, rotation: 0 }]
}

export const LRM_3R_DIST: FamilyTemplate<M7Params> = {
  code: 'LRM-3R-DIST',
  axes: [SHAPE_AXIS, FILL_AXIS, COUNT_AXIS],
  // ALL three axes are cheap — two Latin squares on the dominant attributes
  // and a count that equals the column index — and the family says so. With
  // every declared axis cheap, G-20 skips (`ALL_AXES_CHEAP`: there is no hard
  // rule for the cheap-elimination invariant to protect) and G-18 applies
  // the ≥ 2 requirement to all three axes; the balanced fractional design
  // below gives every axis the key's value in exactly 2 of 5 options, so no
  // single rule isolates the key. The structural limit in qa/degeneracy.ts's
  // G-18 header still holds — a 3-rule item cannot also stop a solver who
  // has TWO rules — and this family accepts it: two cheap rules leave the
  // key. That is why it is MODERATE by design, not hard: with the cheap-rule
  // discount (difficulty.ts) predictedB = -2.0 + (0.45 + 0.45 + 0) +
  // 0.5*(3-1) + 0 + 0.3 + 0.15*max(0, 3-2) = +0.35, which is what the first
  // pilot measured operationally (positions 19–20 cleared in 10–12 s each,
  // single-rule pace). It stays in the bank as the three-cheap-rules
  // working-memory item and is no longer counted on for the ceiling.
  cheapAxes: [SHAPE_AXIS, FILL_AXIS, COUNT_AXIS],
  domains: () => ({
    [SHAPE_AXIS]: { kind: 'unordered-enum' } as AxisDomain,
    [FILL_AXIS]: { kind: 'unordered-enum', ladder: FILL_LADDER.map(enumVal) } as AxisDomain,
    [COUNT_AXIS]: { kind: 'numeric-linear' } as AxisDomain,
  }),
  valueAt: (axis, row, col, params) => {
    if (axis === SHAPE_AXIS) return enumVal(cyclicLatin(params.shapeSet, params.kShape, params.startShape, row, col))
    if (axis === FILL_AXIS) return enumVal(cyclicLatin(FILL_LADDER, params.kFill, params.startFill, row, col))
    if (axis === COUNT_AXIS) return numVal(col)
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
      id: 'R1',
      axis: COUNT_AXIS,
      direction: 'column',
      params: { base: 1, stepPerColumn: 1, stepPerRow: 0 },
      statement: 'Count equals the column index: 1 in column 1, 2 in column 2, 3 in column 3, for every row.',
    },
  ],
  radicals: { ruleCount: 3, ruleIds: ['R6', 'R6', 'R1'], crossLayer: false, perceptualLoad: 1, elementTypes: 3, nearMissCount: 3 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  // Typical realisation: four chimeras and one repetition (ABC built from
  // stall values is usually a verbatim copy of a visible cell; A00 is usually
  // a chimera because (stall-shape, stall-fill, stall-count) rarely converges
  // on a single grid cell). The realised label per option is decided in
  // buildDistractors and audited by G-07.
  distractorPlan: ['PM', 'PM', 'PM', 'PM', 'RP'],
  sampleParams(rng: Rng): M7Params {
    const shapeSet = rng.pick(SHAPE_SETS)
    const [kShape, kFill] = rng.pick([
      [1, 2],
      [2, 1],
    ] as const)
    const startShape = rng.int(0, 2) as 0 | 1 | 2
    const startFill = rng.int(0, 2) as 0 | 1 | 2
    return { shapeSet: shapeSet as unknown as [string, string, string], kShape, kFill, startShape, startFill }
  },
  buildCell(values) {
    const shape = values[SHAPE_AXIS]
    const fill = values[FILL_AXIS]
    const count = values[COUNT_AXIS]
    if (shape.t !== 'enum' || fill.t !== 'enum' || count.t !== 'num') throw new Error('shape/fill/count must be enum/enum/num')
    return repeatCell(shape.v, fill.v, count.v)
  },
  /**
   * Balanced fractional design: construct distractors AB0, A0C, 0BC, ABC
   * where each pattern has exactly two axes wrong and forms a 2³⁻¹ fractional
   * factorial plus the all-wrong corner.
   *
   * Algorithm: collect all realised values for each axis on the grid, then
   * pick non-key values (preference: stall values from R3C1/R3C2/R2C3,
   * fallback to any other realised value). Construct the four distractors
   * deterministically from those values, then validate against all gates.
   */
  buildDistractors(ctx: DistractorCtx<M7Params>) {
    const keyShape = ctx.valueAt(SHAPE_AXIS, 3, 3)
    const keyFill = ctx.valueAt(FILL_AXIS, 3, 3)
    const keyCount = ctx.valueAt(COUNT_AXIS, 3, 3)
    if (keyShape.t !== 'enum' || keyFill.t !== 'enum' || keyCount.t !== 'num')
      throw new Error('shape/fill/count must be enum/enum/num')

    // Collect all realised values for each axis.
    const shapeValues: Set<string> = new Set()
    const fillValues: Set<string> = new Set()
    const countValues: Set<number> = new Set()
    for (const gc of ctx.grid) {
      const s = ctx.valueAt(SHAPE_AXIS, gc.row, gc.col)
      const f = ctx.valueAt(FILL_AXIS, gc.row, gc.col)
      const c = ctx.valueAt(COUNT_AXIS, gc.row, gc.col)
      if (s.t === 'enum') shapeValues.add(s.v)
      if (f.t === 'enum') fillValues.add(f.v)
      if (c.t === 'num') countValues.add(c.v)
    }

    // Stall value preference: R3C1 for shape, R3C2 for fill, R2C3 for count.
    const stallShape = ctx.valueAt(SHAPE_AXIS, 3, 1)
    const stallFill = ctx.valueAt(FILL_AXIS, 3, 2)
    const stallCount = ctx.valueAt(COUNT_AXIS, 2, 3)
    if (stallShape.t !== 'enum' || stallFill.t !== 'enum' || stallCount.t !== 'num')
      throw new Error('stall values must be enum/enum/num')

    // Pick A, B, C (wrong values on shape, fill, count).
    const pickWrongValue = (keyValue: string, values: Set<string>, stallValue: string): string => {
      if (stallValue !== keyValue) return stallValue
      // Fallback: pick any other realised value.
      for (const v of values) if (v !== keyValue) return v
      throw new Error('no alternative value available')
    }

    const pickWrongCount = (keyValue: number, values: Set<number>, stallValue: number): number => {
      if (stallValue !== keyValue) return stallValue
      for (const c of values) if (c !== keyValue) return c
      throw new Error('no alternative count available')
    }

    const A = pickWrongValue(keyShape.v, shapeValues, stallShape.v)
    const B = pickWrongValue(keyFill.v, fillValues, stallFill.v)
    const C = pickWrongCount(keyCount.v, countValues, stallCount.v)

    // Construct the five distractors: AB0, A0C, 0BC, A00, ABC.
    type Candidate = { shape: string; fill: string; count: number; label: 'PM' | 'RP'; wrongAxisCount: number }
    const candidates: Candidate[] = [
      { shape: A, fill: B, count: keyCount.v, label: 'PM', wrongAxisCount: 2 },
      { shape: A, fill: keyFill.v, count: C, label: 'PM', wrongAxisCount: 2 },
      { shape: keyShape.v, fill: B, count: C, label: 'PM', wrongAxisCount: 2 },
      { shape: A, fill: keyFill.v, count: keyCount.v, label: 'PM', wrongAxisCount: 1 },
      { shape: A, fill: B, count: C, label: 'RP', wrongAxisCount: 3 },
    ]

    // Build and validate the full option set.
    const validSet = (distrs: DistractorCandidate[]): boolean => {
      // Every distractor must be wrong on at least one axis.
      if (distrs.some((cd) => cd.wrongAxes.length === 0)) return false
      // No distractor equals the key cell verbatim.
      if (distrs.some((cd) => cellEq({ elements: cd.elements }, ctx.keyCell))) return false
      // No two distractors are identical.
      for (let i = 0; i < distrs.length; i++)
        for (let j = i + 1; j < distrs.length; j++)
          if (cellEq({ elements: distrs[i].elements }, { elements: distrs[j].elements })) return false

      const cells = [{ elements: ctx.keyCell.elements }, ...distrs.map((x) => ({ elements: x.elements }))]

      // G-08 — context blind (modal hit rate and centroid).
      if (!contextBlindGate(cells, 0, ctx.axes).ok) return false
      // G-10 — no giveaway pairs.
      if (!giveawayPairGate(cells, ctx.axes).ok) return false
      // G-11 — copy elimination must not isolate key.
      if (!copyEliminationOk(ctx.grid, cells, 0)) return false
      // G-18 — no single rule isolates key. cheapAxes = all axes, so the scoped
      // check is the unscoped one: every axis must keep ≥ 2 options.
      if (!singleRuleSufficiencyOk(cells, 0, ctx.axes, ctx.template.cheapAxes)) return false
      // G-19 — elimination resistance (rule-blind cue chain).
      if (!eliminationResistanceOk(ctx.grid, cells, 0, ctx.axes)) return false

      return true
    }

    // Build the distractors with PM/RP labels and test.
    const distractors: DistractorCandidate[] = candidates.map((cand) => {
      const elements = repeatCell(cand.shape, cand.fill, cand.count)
      const wrongAxes = [
        ...(cand.shape === keyShape.v ? [] : [SHAPE_AXIS]),
        ...(cand.fill === keyFill.v ? [] : [FILL_AXIS]),
        ...(cand.count === keyCount.v ? [] : [COUNT_AXIS]),
      ]
      // Labels are what the option IS, not what the plan hoped: ABC (the
      // all-wrong corner) is a repetition (RP) only when it reproduces a
      // visible cell verbatim — with stall values it usually does (A, B, C
      // are read off R3C1 / R3C2 / R2C3) — and a chimera (PM) otherwise. The
      // three two-wrong corners and the one-wrong corner (A00) are chimeras.
      // `distractorPlan` states the typical case; G-07 audits realised labels.
      let corner: string
      if (cand.wrongAxisCount === 1) {
        corner = 'A00'
      } else if (cand.wrongAxisCount === 2) {
        corner = ['AB0', 'A0C', '0BC'][candidates.indexOf(cand)]
      } else {
        corner = 'ABC'
      }
      const copyOf = ctx.grid.find((gc) => cellEq({ elements: gc.elements }, { elements }))
      if (cand.label === 'RP' && copyOf) {
        return { elements, label: 'RP' as const, mechanism: `fractional-factorial:${corner}[${A},${B},${C}]:copyCell:R${copyOf.row}C${copyOf.col}`, wrongAxes }
      }
      return chimera(`fractional-factorial:${corner}[${A},${B},${C}]`, elements, wrongAxes)
    })

    if (validSet(distractors)) return distractors

    throw new Error(`LRM-3R-DIST: balanced fractional design failed validation for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: M7Params) => ({ startShape: params.startShape, startFill: params.startFill }),
}
