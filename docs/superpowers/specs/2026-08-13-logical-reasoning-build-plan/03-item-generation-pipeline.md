# Item Generation & Content Pipeline — Figural Matrices (LR-M)

**Status:** Build plan. Engineering specification only.
**Implements:** `docs/superpowers/specs/2026-08-12-cognitive-assessments/03-logical-reasoning-design.md` (hereafter **doc 03**) — its rule taxonomy (§3), radicals/incidentals model (§4), cell-notation grammar (§5.1), distractor grammar (§5.3), mechanical QA battery (§5.4), the eight exemplars M1–M8 (§6), the CIV controls (§7) and the anti-test-wiseness rules (§9).
**Sits inside:** `plan-architecture.md` §6 (generator placement), §1.2 (item bank DDL), §2.1/§2.4/§2.5 (spec validation and rendering).
**Language:** UK English.

**No validation claims are made anywhere in this document.** Every difficulty figure is a *design prior* computed from doc 03 §4.4, never an item property. Every reference to a rule's "difficulty contribution" is a blueprint weight. Nothing described here establishes that the generated items measure anything, discriminate between anyone, or behave as the blueprint predicts. That is the subject of doc 03 §12 and is out of scope. The pipeline's job is to produce items that are *internally correct, uniquely solvable, renderable, and traceable* — nothing more.

---

## 0. What the pipeline is

Eight stages, each with a hard gate. An item that fails a gate never reaches the next stage.

| # | Stage | Where it runs | Gate |
|---|---|---|---|
| 1 | **Family authoring** | `src/lib/cognitive/generator/families/*.ts`, hand-written, code-reviewed | Compiles; family template type-checks against the rule grammar |
| 2 | **Generation** | `generateFamily(template, seed, n)` | Throws on any degeneracy check (§3.5) |
| 3 | **Uniqueness verification** | `qa/uniqueness.ts` | Exactly one admissible completion (§5) |
| 4 | **Distractor synthesis** | `distractors.ts` | Four labelled distractors, all solver-gated (§4) |
| 5 | **Automated QA battery** | `qa/index.ts` | All 17 gates pass (§7) |
| 6 | **Rendering** | `render/matrix-svg.ts` | Render-check gate; SVG hash stable (§6) |
| 7 | **Human review** | Admin UI, two stages | `content_reviewed` → `fairness_reviewed` (§8) |
| 8 | **Promotion** | Lifecycle trigger + form assembly | `piloting` → `calibrated` → `operational` (§9) |

Stages 2–6 are one synchronous function call. `generateFamily` returns only items that passed everything; rejects are counted into `cognitive_generation_runs.qa_summary` with per-gate tallies and are never written to `items`. This is the plan-architecture.md §6 contract ("`qa.ts` is not optional post-hoc validation — `generateFamily` throws if any check fails").

Everything from stage 1 to stage 6 is deterministic given `(generator_version, git_sha, seed, params)`.

---

## 1. Module layout

Extends the skeleton in plan-architecture.md §2.1 and §6.

```
src/lib/cognitive/
  spec/
    schema.ts          # zod, .strict() everywhere — the normative spec definition
    canonical.ts       # canonicalJson(): sorted keys, fixed number format
    hash.ts            # contentHash(), structuralHash()  (§9.3)
    project.ts         # toRenderSpec(): allow-lists grid | options | render
  render/
    geometry.ts        # pure coordinate maths; no SVG strings
    primitives.ts      # circle/square/triangle/diamond/pentagon/arrow/tick/bar/dot/hatch
    matrix-svg.ts      # renderMatrixGrid(), renderOptionTile()
    palette.ts         # ink/paper tokens (§6.5)
  generator/
    rng.ts             # seeded PRNG + named substreams
    axes.ts            # AxisId, AxisValue, AxisLattice, canonical value ordering
    rules.ts           # R0–R9 as AxisRule implementations + per-axis rule-space enumeration
    compose.ts         # family template → 3×3 lattice → cells
    distractors.ts     # WR / IR / PM / RP synthesis + solver gate
    difficulty.ts      # doc 03 §4.4 linear model — computes predicted_b, never typed by hand
    families/
      index.ts         # registry: familyCode → FamilyTemplate
      lrm-prog-count.ts        # M1
      lrm-rot.ts               # M2
      lrm-dist3x2.ts           # M3
      lrm-add.ts               # M4
      lrm-sub.ts               # M5
      lrm-2r-xlayer.ts         # M6
      lrm-3r-dist.ts           # M7
      lrm-xor-xlayer.ts        # M8
    qa/
      uniqueness.ts    # Level A + Level B (§5)
      contextblind.ts  # option-only solvability (§4.4)
      degeneracy.ts    # §3.5
      density.ts       # visual density / legibility metrics
      duplicates.ts    # content + structural hash collision (§9.3)
      index.ts         # runs all 17 gates, returns QaReport
    index.ts           # generateFamily()
scripts/cognitive/
  generate-matrix-bank.mjs     # thin CLI: parse args → call lib → write via service role
  preview-bank.mjs             # renders a batch to a static HTML contact sheet for review
```

Nothing in `generator/` imports from `src/lib/supabase`. The library is pure; the script does I/O. That keeps the whole battery runnable in unit tests with no database.

---

## 2. The item spec format

### 2.1 Design rules the schema enforces

1. **Closed vocabulary.** Every enum is finite and pinned in `schema.ts`. There is no free text and no escape hatch. A renderer reading a valid spec makes no judgement calls (doc 03 §5.1).
2. **No key material.** The spec contains `grid`, `options`, `rules`, `radicals`, `render` and provenance. It contains no key index, no per-option error labels, no rationale. Those live in `item_answer_keys` and `item_option_diagnostics` (plan-architecture.md §1.2.4/§1.2.5, and its recommendation to move `distractorPlan` out of the spec — **taken**).
3. **Absolute coordinates only where geometry is ambiguous.** Elements are specified semantically (`element`, `size`, `anchor`, `rotation`); the renderer resolves them to coordinates by a pinned algorithm (§6.2). This keeps specs small and diffable, and puts all geometry in one testable place.
4. **Canonical ordering.** Layers within a cell, bars within a bar set, anchors within an anchor set, cells within the grid, and options within the option array are all emitted in a fixed order defined by `canonical.ts`. Two specs describing the same item serialise identically.
5. **`.strict()` on every object.** An unknown key fails validation at write time — this is the security property plan-architecture.md §2.1 relies on.

### 2.2 TypeScript types (the normative shape)

```ts
// src/lib/cognitive/spec/schema.ts
import { z } from 'zod'

export const ShapeId   = z.enum(['circle','square','triangle','diamond','pentagon','arrow'])
export const BarId     = z.enum(['H','V','D1','D2'])
export const Fill      = z.enum(['outline','solid','hatched'])
export const SizeToken = z.enum(['S','M','L'])
export const Anchor    = z.enum(['TL','TR','BL','BR','CTR'])
export const LayerName = z.enum(['outer','inner','satellite'])

/** Rotation is degrees clockwise from canonical (0° = apex/point up). */
const Rotation = z.number().int().min(0).max(359)

/** A single drawable. Exactly one of the four variants. */
export const Element = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('shape'),
    layer: LayerName,
    shape: ShapeId,
    fill: Fill,
    size: SizeToken,
    anchor: Anchor,
    rotation: Rotation.default(0),
  }).strict(),
  z.object({
    type: z.literal('tick'),
    layer: LayerName,
    /** Length in canvas units from CTR outward. */
    length: z.number().int().min(10).max(45),
    rotation: Rotation,
  }).strict(),
  z.object({
    type: z.literal('bars'),
    layer: LayerName,
    /** Canonically sorted H < V < D1 < D2. */
    bars: z.array(BarId).min(1).max(4),
    /** Clip bar geometry to the outer layer's shape (doc 03 M8). */
    clipToOuter: z.boolean().default(false),
  }).strict(),
  z.object({
    type: z.literal('dots'),
    layer: LayerName,
    /** Canonically sorted TL < TR < BL < BR < CTR. */
    anchors: z.array(Anchor).min(1).max(5),
    fill: Fill.default('solid'),
    size: SizeToken.default('S'),
  }).strict(),
  z.object({
    type: z.literal('repeat'),
    layer: LayerName,
    shape: ShapeId,
    fill: Fill,
    size: SizeToken,
    /** 1–5, laid out per doc 03 §5.1 count convention (4 = 2+2, 5 = 3+2). */
    count: z.number().int().min(1).max(5),
    rotation: Rotation.default(0),
  }).strict(),
])

export const Cell = z.object({
  /** Ordered back-to-front: outer, then inner, then satellite. */
  elements: z.array(Element).min(1).max(4),
}).strict()

export const GridCell = Cell.extend({
  row: z.number().int().min(1).max(3),
  col: z.number().int().min(1).max(3),
}).strict()

export const OptionSpec = Cell.extend({
  slot: z.enum(['A','B','C','D','E']),
}).strict()
```

The rule block is descriptive metadata for QA, LLTM feature extraction and the audit trail. It is never delivered to a client (plan-architecture.md §2.1 `toRenderSpec` allow-lists `grid | options | render`).

```ts
export const RuleSpec = z.object({
  id: z.enum(['R0','R1','R2','R3','R4','R5','R6','R7','R8','R9']),
  /** '<layer>.<attribute>' — the axis this rule owns. Doc 03 §3 invariant 2:
   *  no two rules in one item may claim the same axis. */
  axis: z.string().regex(/^(outer|inner|satellite)\.[a-z][a-zA-Z]*$/),
  /** Reading directions in which the rule is asserted to hold. */
  direction: z.enum(['row','column','both','row_operator','column_operator']),
  params: z.record(z.union([z.string(), z.number(), z.boolean(),
                            z.array(z.union([z.string(), z.number()]))])),
  /** Human-readable, for the reviewer panel and the audit trail. */
  statement: z.string().min(8).max(240),
}).strict()

export const Radicals = z.object({
  ruleCount: z.number().int().min(1).max(3),
  ruleIds: z.array(z.enum(['R1','R2','R3','R4','R5','R6','R7','R8','R9'])).min(1).max(3),
  crossLayer: z.boolean(),
  /** 0 = sparse, 1 = neutral, 2 = dense-but-capped (doc 03 §4.4 π). Capped at 1 in this
   *  instrument by doc 03 §4.1 (perceptual organisation held at neutral). */
  perceptualLoad: z.number().int().min(0).max(2),
  elementTypes: z.number().int().min(2).max(5),
  nearMissCount: z.number().int().min(0).max(4),
}).strict()

export const RenderDirectives = z.object({
  styleVersion: z.literal('v1'),
  canvas: z.literal(100),
  strokeWidth: z.number().min(1.5).max(3),
  hatchPitch: z.number().min(4).max(6),
  minElementUnits: z.number().min(8),
}).strict()

export const FiguralMatrixSpec = z.object({
  specVersion: z.literal(1),
  kind: z.literal('figural_matrix'),
  grid: z.object({
    rows: z.literal(3),
    cols: z.literal(3),
    blank: z.object({ row: z.literal(3), col: z.literal(3) }).strict(),
    /** Exactly 8 cells; the blank is omitted. Canonically row-major. */
    cells: z.array(GridCell).length(8),
  }).strict(),
  /** Exactly 5, canonically ordered A..E. */
  options: z.array(OptionSpec).length(5),
  rules: z.array(RuleSpec).min(1).max(3),
  radicals: Radicals,
  render: RenderDirectives,
}).strict()

export type FiguralMatrixSpec = z.infer<typeof FiguralMatrixSpec>
```

### 2.3 Provenance and QA, stored alongside

Provenance is not in the spec JSON — it lives in `cognitive_item_specs` columns and `cognitive_generation_runs` (plan-architecture.md §1.2.4/§1.2.7), so the spec hashes to the same value regardless of which run produced it. The `qa` JSONB column carries the battery result:

```ts
export type QaReport = {
  generatorVersion: string        // semver of src/lib/cognitive/generator
  batteryVersion: string          // semver of qa/index.ts — bump forces re-run
  passedAt: string                // ISO
  gates: Record<GateId, {
    status: 'pass' | 'fail' | 'skip'
    detail?: Record<string, unknown>
  }>
  /** Audit artefact: every (direction, rule) tuple that survives the context filter,
   *  per axis. This is what a reviewer is shown to justify uniqueness. */
  admissibleRuleTuples: Array<{ axis: string; direction: string; label: string; implies: string }>
  predictedB: number              // computed by difficulty.ts, never hand-entered
  band: 'easy' | 'moderate' | 'hard' | 'very_hard'
  structuralHash: string
}
```

### 2.4 Worked example — M6 encoded in full

Doc 03 §6, item **M6 — two rules, cross-layer: shape distribution + inner rotation**.
Family `LRM-2R-XLAYER`. Rules R6 (outer shape, Latin square) + R2 (inner tick, +90° per column, +90° row offset). Key = circle with tick at 0°.

```json
{
  "specVersion": 1,
  "kind": "figural_matrix",
  "grid": {
    "rows": 3,
    "cols": 3,
    "blank": { "row": 3, "col": 3 },
    "cells": [
      { "row": 1, "col": 1, "elements": [
        { "type": "shape", "layer": "outer", "shape": "square",   "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
        { "type": "tick",  "layer": "inner", "length": 30, "rotation": 0 }
      ]},
      { "row": 1, "col": 2, "elements": [
        { "type": "shape", "layer": "outer", "shape": "circle",   "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
        { "type": "tick",  "layer": "inner", "length": 30, "rotation": 90 }
      ]},
      { "row": 1, "col": 3, "elements": [
        { "type": "shape", "layer": "outer", "shape": "diamond",  "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
        { "type": "tick",  "layer": "inner", "length": 30, "rotation": 180 }
      ]},
      { "row": 2, "col": 1, "elements": [
        { "type": "shape", "layer": "outer", "shape": "circle",   "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
        { "type": "tick",  "layer": "inner", "length": 30, "rotation": 90 }
      ]},
      { "row": 2, "col": 2, "elements": [
        { "type": "shape", "layer": "outer", "shape": "diamond",  "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
        { "type": "tick",  "layer": "inner", "length": 30, "rotation": 180 }
      ]},
      { "row": 2, "col": 3, "elements": [
        { "type": "shape", "layer": "outer", "shape": "square",   "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
        { "type": "tick",  "layer": "inner", "length": 30, "rotation": 270 }
      ]},
      { "row": 3, "col": 1, "elements": [
        { "type": "shape", "layer": "outer", "shape": "diamond",  "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
        { "type": "tick",  "layer": "inner", "length": 30, "rotation": 180 }
      ]},
      { "row": 3, "col": 2, "elements": [
        { "type": "shape", "layer": "outer", "shape": "square",   "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
        { "type": "tick",  "layer": "inner", "length": 30, "rotation": 270 }
      ]}
    ]
  },
  "options": [
    { "slot": "A", "elements": [
      { "type": "shape", "layer": "outer", "shape": "circle",  "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
      { "type": "tick",  "layer": "inner", "length": 30, "rotation": 270 }
    ]},
    { "slot": "B", "elements": [
      { "type": "shape", "layer": "outer", "shape": "circle",  "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
      { "type": "tick",  "layer": "inner", "length": 30, "rotation": 0 }
    ]},
    { "slot": "C", "elements": [
      { "type": "shape", "layer": "outer", "shape": "diamond", "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
      { "type": "tick",  "layer": "inner", "length": 30, "rotation": 0 }
    ]},
    { "slot": "D", "elements": [
      { "type": "shape", "layer": "outer", "shape": "circle",  "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
      { "type": "tick",  "layer": "inner", "length": 30, "rotation": 180 }
    ]},
    { "slot": "E", "elements": [
      { "type": "shape", "layer": "outer", "shape": "square",  "fill": "outline", "size": "L", "anchor": "CTR", "rotation": 0 },
      { "type": "tick",  "layer": "inner", "length": 30, "rotation": 0 }
    ]}
  ],
  "rules": [
    { "id": "R6", "axis": "outer.shape", "direction": "both",
      "params": { "values": ["square", "circle", "diamond"], "rowOffset": 1 },
      "statement": "Outer shape forms a Latin square: each of square, circle, diamond appears exactly once per row and once per column." },
    { "id": "R2", "axis": "inner.rotation", "direction": "both",
      "params": { "base": 0, "stepPerColumn": 90, "stepPerRow": 90, "modulus": 360 },
      "statement": "Inner tick rotation = 90*(row-1) + 90*(col-1) mod 360." }
  ],
  "radicals": {
    "ruleCount": 2,
    "ruleIds": ["R6", "R2"],
    "crossLayer": true,
    "perceptualLoad": 1,
    "elementTypes": 3,
    "nearMissCount": 2
  },
  "render": {
    "styleVersion": "v1",
    "canvas": 100,
    "strokeWidth": 2,
    "hatchPitch": 4,
    "minElementUnits": 10
  }
}
```

**The secure sidecar** (written in the same transaction, to the RLS-denied tables):

```jsonc
// item_answer_keys
{ "item_id": "…", "correct_option_id": "<id of slot B>", "scoring_rule": "dichotomous",
  "rationale": "Row 3 and column 3 both lack 'circle' on the outer Latin square. Tick rotation at (3,3) = 90*2 + 90*2 = 360 = 0 deg. Unique completion: outline circle, tick pointing up." }

// item_option_diagnostics — one row per option, including the key
[
  { "option_id": "<A>", "error_label": "IR",
    "rationale": "Shape correct; rotation stalls at R3C2's 270 deg. Solves R6, fails R2." },
  { "option_id": "<B>", "error_label": null, "rationale": "Key." },
  { "option_id": "<C>", "error_label": "IR",
    "rationale": "Rotation correct; repeats R3C1's diamond. Solves R2, fails the R6 elimination." },
  { "option_id": "<D>", "error_label": "PM",
    "rationale": "Correct shape with R3C1's tick angle: a chimera of the two nearest cells that reads as locally consistent with the row." },
  { "option_id": "<E>", "error_label": "RP",
    "rationale": "Copies R3C2's outer shape with a correctly rotated tick; catches candidates who finish R2 then grab the adjacent shape rather than running the elimination." }
]
```

Note what is *not* in the spec: no `key`, no `distractorPlan`, no `correctOption`. The `cognitive_item_specs_no_key` CHECK constraint and `.strict()` both reject those keys. The delivered projection is narrower still — `grid`, `options`, `render` (plan-architecture.md §2.1).

> **QA verdict on M6 as written.** This exemplar **fails gate G-08 (context-blind solvability)**. Across the five options the modal outer shape is `circle` (3 of 5) and the modal tick rotation is `0°` (3 of 5); the composition of the per-axis modal values is `circle + tick 0°`, which is the key. A candidate who never looks at the grid recovers the answer by voting. Six of doc 03's eight exemplars fail this gate. The repair procedure and the full audit are in **Appendix A**; the repaired M6 option set is at **§4.5**.

---

## 3. The generation algorithm

### 3.1 The axis abstraction

Everything hangs off one idea: **an item is a set of independent attribute lattices**, one per `(layer, attribute)` axis, each governed by at most one rule. This is not a convenience — it is doc 03 §3 composition invariant 2 ("rules within one item must operate on disjoint attribute dimensions") turned into a data structure. It is also what makes uniqueness verification cheap (§5.2).

```ts
// src/lib/cognitive/generator/axes.ts
export type AxisId =
  | 'outer.shape' | 'outer.fill' | 'outer.size' | 'outer.rotation' | 'outer.count'
  | 'inner.rotation' | 'inner.length' | 'inner.bars' | 'inner.shape' | 'inner.fill'
  | 'satellite.anchors' | 'satellite.count' | 'satellite.fill'

export type AxisValue =
  | { t: 'enum'; v: string }                    // shape, fill, size, anchor
  | { t: 'num';  v: number }                    // rotation, count, length
  | { t: 'set';  v: readonly string[] }         // bars, occupied anchors — canonically sorted

/** 3x3, row-major, 1-indexed on access. null at the blank cell. */
export type AxisLattice = (AxisValue | null)[][]

export function axisEq(a: AxisValue, b: AxisValue): boolean {
  if (a.t !== b.t) return false
  if (a.t === 'set' && b.t === 'set') {
    return a.v.length === b.v.length && a.v.every((x, i) => x === b.v[i])
  }
  return (a as { v: unknown }).v === (b as { v: unknown }).v
}

/** Stable string form, used for canonical ordering and hashing. */
export function axisKey(a: AxisValue): string {
  return a.t === 'set' ? `set:${a.v.join('|')}` : `${a.t}:${a.v}`
}
```

### 3.2 Rules as objects

Each rule is an object that can (a) say whether it explains an observed lattice and (b) say what it implies at a coordinate. That single interface covers pointwise rules (R0/R1/R2/R6/R8/R9), row-operator rules (R4/R5/R7) and path rules (R3) without special-casing.

```ts
// src/lib/cognitive/generator/rules.ts
export type RuleId = 'R0'|'R1'|'R2'|'R3'|'R4'|'R5'|'R6'|'R7'|'R8'|'R9'
export type Direction = 'row' | 'column' | 'both' | 'row_operator' | 'column_operator'

export interface AxisRule {
  readonly id: RuleId
  readonly axis: AxisId
  readonly direction: Direction
  /** Stable identity for dedupe and for the audit artefact. */
  readonly label: string
  /** True iff every observed cell of `lat` is consistent with this rule. */
  explains(lat: AxisLattice): boolean
  /** Value implied at (row, col), or null if undetermined from what is observed. */
  implies(lat: AxisLattice, row: number, col: number): AxisValue | null
}
```

Representative implementations:

```ts
/** R1 / R8 / R9 as ordered progression: value index advances by a constant step. */
export function progression(
  axis: AxisId, ladder: readonly AxisValue[],
  stepCol: number, stepRow: number, direction: Direction,
): AxisRule {
  const idx = (v: AxisValue) => ladder.findIndex(x => axisEq(x, v))
  const at = (r: number, c: number, base: number) => {
    const i = base + stepCol * (c - 1) + stepRow * (r - 1)
    return i >= 0 && i < ladder.length ? ladder[i] : null
  }
  return {
    id: 'R1', axis, direction,
    label: `prog(${axis},+${stepCol}/col,+${stepRow}/row)`,
    explains(lat) {
      const seed = lat[0][0]
      if (!seed) return false
      const base = idx(seed)
      if (base < 0) return false
      for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) {
        const obs = lat[r - 1][c - 1]
        if (!obs) continue
        const exp = at(r, c, base)
        if (!exp || !axisEq(exp, obs)) return false
      }
      return true
    },
    implies(lat, row, col) {
      const seed = lat[0][0]
      if (!seed) return null
      return at(row, col, idx(seed))
    },
  }
}

/** R2: modular rotation. Distinct from progression because it wraps. */
export function rotation(
  axis: AxisId, stepCol: number, stepRow: number, direction: Direction,
): AxisRule {
  const at = (r: number, c: number, base: number) =>
    ({ t: 'num' as const, v: (((base + stepCol * (c - 1) + stepRow * (r - 1)) % 360) + 360) % 360 })
  return {
    id: 'R2', axis, direction,
    label: `rot(${axis},+${stepCol}/col,+${stepRow}/row)`,
    explains(lat) {
      const seed = lat[0][0]
      if (!seed || seed.t !== 'num') return false
      for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) {
        const obs = lat[r - 1][c - 1]
        if (!obs) continue
        if (!axisEq(at(r, c, seed.v), obs)) return false
      }
      return true
    },
    implies(lat, row, col) {
      const seed = lat[0][0]
      return seed && seed.t === 'num' ? at(row, col, seed.v) : null
    },
  }
}

/** R6: Latin square. Fully determined by the observations; no parameters. */
export function latinSquare(axis: AxisId, values: readonly AxisValue[]): AxisRule {
  const keys = values.map(axisKey)
  const line = (lat: AxisLattice, kind: 'row' | 'col', i: number) =>
    [0, 1, 2].map(j => (kind === 'row' ? lat[i][j] : lat[j][i]))
  return {
    id: 'R6', axis, direction: 'both',
    label: `latin(${axis},{${keys.join(',')}})`,
    explains(lat) {
      for (const kind of ['row', 'col'] as const) {
        for (let i = 0; i < 3; i++) {
          const seen = line(lat, kind, i).filter(Boolean).map(v => axisKey(v!))
          if (new Set(seen).size !== seen.length) return false     // duplicate in a line
          if (seen.some(k => !keys.includes(k))) return false      // value outside the set
        }
      }
      return true
    },
    implies(lat, row, col) {
      if (lat[row - 1][col - 1]) return lat[row - 1][col - 1]
      const missing = (kind: 'row' | 'col', i: number) => {
        const seen = new Set(line(lat, kind, i).filter(Boolean).map(v => axisKey(v!)))
        const rest = values.filter(v => !seen.has(axisKey(v)))
        return rest.length === 1 ? rest[0] : null
      }
      const byRow = missing('row', row - 1)
      const byCol = missing('col', col - 1)
      if (byRow && byCol) return axisEq(byRow, byCol) ? byRow : null
      return byRow ?? byCol
    },
  }
}

/** R4 / R5 / R7: binary set operators applied along rows (or columns). */
export function setOperator(
  axis: AxisId, op: 'union' | 'difference' | 'symdiff', direction: 'row_operator' | 'column_operator',
): AxisRule {
  const apply = (a: readonly string[], b: readonly string[]) => {
    const A = new Set(a), B = new Set(b)
    const out =
      op === 'union'      ? [...new Set([...a, ...b])]
    : op === 'difference' ? a.filter(x => !B.has(x))
    :                       [...a.filter(x => !B.has(x)), ...b.filter(x => !A.has(x))]
    return { t: 'set' as const, v: canonicalSort(out) }
  }
  const operands = (lat: AxisLattice, r: number, c: number) =>
    direction === 'row_operator'
      ? [lat[r - 1][0], lat[r - 1][1]] as const
      : [lat[0][c - 1], lat[1][c - 1]] as const
  const target = direction === 'row_operator'
    ? (r: number, c: number) => c === 3
    : (r: number, c: number) => r === 3
  return {
    id: op === 'union' ? 'R4' : op === 'difference' ? 'R5' : 'R7',
    axis, direction, label: `${op}(${axis},${direction})`,
    explains(lat) {
      for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) {
        if (!target(r, c)) continue
        const obs = lat[r - 1][c - 1]
        if (!obs) continue
        const [x, y] = operands(lat, r, c)
        if (!x || !y || x.t !== 'set' || y.t !== 'set') return false
        if (!axisEq(apply(x.v, y.v), obs)) return false
      }
      return true
    },
    implies(lat, row, col) {
      if (!target(row, col)) return null
      const [x, y] = operands(lat, row, col)
      return x && y && x.t === 'set' && y.t === 'set' ? apply(x.v, y.v) : null
    },
  }
}
```

`R3` (movement) is a path rule: the anchor set advances one step along a declared cycle (`['TL','TR','BR','BL']` or `['TL','CTR','BR']`) per column, with a row offset. It is a `progression` over an anchor ladder with wraparound; the implementation reuses `rotation`'s modular arithmetic over indices rather than degrees.

### 3.3 Family templates

A family is the unit of authorship. It fixes the radicals (doc 03 §4.1) and declares which incidentals may vary (doc 03 §4.2).

```ts
// src/lib/cognitive/generator/families/index.ts
export interface FamilyTemplate {
  code: string                       // 'LRM-2R-XLAYER'
  kind: 'figural_matrix'
  /** Which axes are rule-governed, and how the rule is instantiated from sampled parameters. */
  buildRules(p: SampledParams): AxisRule[]
  /** How each rule-governed axis is materialised back into cell elements. */
  materialise(lattices: Record<AxisId, AxisLattice>, p: SampledParams): { grid: GridCell[]; keyCell: Cell }
  /** Incidental parameter space — everything the PRNG is allowed to choose. */
  incidentals: IncidentalSpace
  /** Radicals — fixed for the whole family, asserted equal on every sibling. */
  radicals: Radicals
  /** Distractor plan: which error labels, in what quantity. Doc 03 §5.3/§4.1. */
  distractorPlan: Array<'WR' | 'IR' | 'PM' | 'RP'>   // length 4
}

export interface IncidentalSpace {
  /** Candidate shape sets, all matched on perceptual complexity (§3.4). */
  shapeSets?: ReadonlyArray<readonly ShapeId[]>
  /** Whole-grid reflections permitted (rule directions transformed accordingly). */
  reflections?: ReadonlyArray<'none' | 'horizontal' | 'vertical'>
  /** Whole-stimulus cardinal rotations — only when no rotation rule is present. */
  cardinalRotations?: ReadonlyArray<0 | 90 | 180 | 270>
  /** Permutations of the value ordering inside a Latin square. */
  latinPermutations?: boolean
  /** Fill sets, when fill is not rule-governed. */
  fillSets?: ReadonlyArray<readonly Fill[]>
  /** Size band within the permitted range. */
  sizeTokens?: ReadonlyArray<SizeToken>
}
```

`LRM-2R-XLAYER` (M6's family) instantiated:

```ts
// src/lib/cognitive/generator/families/lrm-2r-xlayer.ts
export const LRM_2R_XLAYER: FamilyTemplate = {
  code: 'LRM-2R-XLAYER',
  kind: 'figural_matrix',
  incidentals: {
    shapeSets: [
      ['square', 'circle', 'diamond'],
      ['circle', 'triangle', 'square'],
      ['diamond', 'circle', 'triangle'],
      ['square', 'circle', 'pentagon'],
    ],
    reflections: ['none', 'horizontal', 'vertical'],
    latinPermutations: true,
    // No cardinal rotation: an R2 rule is present, so rotating the stimulus set
    // would collide with the rule axis (doc 03 §4.2).
    cardinalRotations: [0],
    sizeTokens: ['L'],
  },
  radicals: {
    ruleCount: 2, ruleIds: ['R6', 'R2'], crossLayer: true,
    perceptualLoad: 1, elementTypes: 3, nearMissCount: 2,
  },
  distractorPlan: ['IR', 'IR', 'PM', 'RP'],
  buildRules(p) {
    return [
      latinSquare('outer.shape', p.shapeSet.map(s => ({ t: 'enum', v: s }))),
      rotation('inner.rotation', p.tickStepCol, p.tickStepRow, 'both'),
    ]
  },
  materialise(lat, p) { /* … §3.4 … */ },
}
```

Sibling count is bounded by the incidental space, not by the seed: 4 shape sets × 3 reflections × 6 Latin permutations × 2 tick-step signs = 144 nominal combinations, of which the degeneracy and duplicate gates remove a substantial fraction. That is comfortably enough for the 8–10 clones per family doc 03 §12 Stage 2 asks for, with room for later bank refresh.

### 3.4 Composition: template → grid

```ts
// src/lib/cognitive/generator/compose.ts
export function composeItem(t: FamilyTemplate, rng: Rng): ComposedItem {
  // 1. Sample incidentals from a dedicated substream so that changing the
  //    distractor policy later does not shift the grids (§3.6).
  const params = sampleIncidentals(t.incidentals, rng.sub('incidentals'))

  // 2. Instantiate rules and assert axis disjointness (doc 03 §3 invariant 2).
  const rules = t.buildRules(params)
  const axes = rules.map(r => r.axis)
  if (new Set(axes).size !== axes.length) {
    throw new GeneratorError('AXIS_COLLISION', { axes })
  }

  // 3. Fill each rule-governed lattice from its rule.
  const lattices: Record<AxisId, AxisLattice> = {}
  for (const rule of rules) {
    const lat = emptyLattice()
    // Seed cell (1,1) from sampled params, then let the rule fill the rest.
    lat[0][0] = params.seeds[rule.axis]
    for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) {
      const v = rule.implies(lat, r, c)
      if (!v) throw new GeneratorError('RULE_UNDETERMINED', { axis: rule.axis, r, c })
      lat[r - 1][c - 1] = v
    }
    lattices[rule.axis] = lat
  }

  // 4. Constant axes (R0) are filled with a single sampled value.
  for (const [axis, value] of Object.entries(params.constants)) {
    lattices[axis as AxisId] = constantLattice(value)
  }

  // 5. Materialise cells; the key cell is (3,3) before it is removed.
  const { grid, keyCell } = t.materialise(lattices, params)

  // 6. Apply whole-grid incidental transforms (reflection, cardinal rotation),
  //    transforming rule directions with them.
  const transformed = applyGridTransform(grid, keyCell, rules, params.transform)

  return { ...transformed, rules: transformed.rules, params, template: t }
}
```

Step 6 is where doc 03 §4.2's "incidental hygiene rule" bites. Reflecting a grid transforms a `+45° clockwise` rotation rule into `−45°`, and a `TL→TR→BR` movement path into `TR→TL→BL`. If the transform is applied to the cells but not to the rule objects, the rule metadata desynchronises from the geometry and every downstream check silently verifies the wrong thing. `applyGridTransform` therefore returns transformed rules, and a unit test asserts `rules.every(r => r.explains(latticeOf(grid, r.axis)))` after the transform.

### 3.5 Degeneracy checks — how ugly and broken items are avoided

Every check below throws inside `composeItem` or immediately after. They are separate from the QA battery (§7) because they are *generation-time* preconditions: a family that trips them frequently is misauthored, and the run log's per-check tallies are the signal.

**Rule-level degeneracy**

| Check | Rejects |
|---|---|
| `STEP_ZERO` | R1/R2/R8/R9 with `stepCol == 0 && stepRow == 0` — the rule is R0 in disguise |
| `LADDER_OVERRUN` | A progression whose index leaves the ladder at any of the 9 cells (e.g. count 4 → 5 → 6 with a max of 5) |
| `ROTATION_ALIAS` | R2 where `(stepCol × 2) % 360 == 0` on a shape with 2-fold symmetry — a 180° step on a bar is invisible |
| `SYMMETRY_INVISIBLE` | Any rotation rule on an element whose rotational symmetry order divides the step: circle (∞), square (90°), diamond (90°). A 90° tick step is fine; a 90° *square* step is not |
| `OPERAND_EMPTY` | R4/R5/R7 where either operand set is empty in any row |
| `SUBSET_VIOLATION` | R5 where `C2 ⊄ C1` in any row (doc 03 M5 requires this) |
| `OPERATOR_IDENTITY` | R4/R5/R7 where the result equals one of its operands in ≥2 of 3 rows — the operation is not doing visible work |
| `SYMDIFF_EMPTY` | R7 where `C1 △ C2 = ∅` in any row |
| `LATIN_TRIVIAL` | R6 whose permutation is the identity in both directions (row 1 = row 2 = row 3) |

**Grid-level degeneracy**

| Check | Rejects |
|---|---|
| `CELL_DUPLICATE` | Any two of the 9 cells structurally identical — licenses a "find the repeat" reading |
| `KEY_EQUALS_CELL` | The key cell equals any context cell (see the note below) |
| `ROW_DUPLICATE` | Row 3 is a permutation of row 1 or row 2 |
| `AXIS_CONSTANT_DECLARED` | An axis declared rule-governed whose lattice is in fact constant |
| `EMPTY_CELL` | Any cell with zero elements |

**Visual degeneracy (`qa/density.ts`)**

| Check | Threshold |
|---|---|
| `INK_COVERAGE` | Rasterised ink coverage of a cell outside 4%–38% of canvas area |
| `INK_VARIANCE` | Max/min ink coverage across the 9 cells > 4.0 — one cell dominates and pulls the eye |
| `ELEMENT_OVERLAP` | Two elements on the *same* layer whose bounding boxes overlap by > 15% of the smaller box. Cross-layer overlap (inner inside outer) is licensed by design |
| `MIN_SEPARATION` | Any two element edges closer than 4 canvas units without touching — reads as a rendering artefact |
| `OPTION_COMPLEXITY_SPREAD` | Element count across the 5 options spans more than 2 (doc 03 §9 rule 3: "no option is conspicuously busier or sparser than the set") |

Ink coverage is measured, not estimated: `density.ts` rasterises the cell SVG to a 200×200 alpha buffer with `@resvg/resvg-js` and counts non-transparent pixels. This is the same code path the render gate uses, so it costs one extra raster per cell.

> **`KEY_EQUALS_CELL` and the "never pick a repeat" heuristic.** Forbidding full-cell coincidence between key and context is necessary: with an RP distractor in every item, a key that *also* copies a cell makes the two indistinguishable on the RP reading. But the forbid has a cost — a test-wise candidate who learns "eliminate any option that reproduces a grid cell" removes one distractor for free, raising the blind-guess rate from .200 to .250. The mitigation is partial-layer coincidence, which is common and unavoidable: in M6 the key's *outer* layer (circle) matches R1C2 and R2C1 exactly, and only the tick differs, so "looks like a cell I've seen" is not decisive. The QA battery measures this: gate **G-11** requires that in ≥ 60% of a batch, the key shares a complete layer with at least one context cell. Whether to go further and permit full coincidence in a controlled minority of items is **open question OQ-3** (§11).

### 3.6 Determinism and the PRNG

Use `pure-rand`'s `xoroshiro128plus` with `uniformInt`, not `Math.random` and not modulo. Substreams are derived by `jump()` so that each concern advances independently:

```ts
// src/lib/cognitive/generator/rng.ts
import { xoroshiro128plus, uniformInt } from 'pure-rand'

const SUBSTREAMS = ['incidentals', 'distractors', 'keyPosition', 'repair'] as const
export type SubstreamName = typeof SUBSTREAMS[number]

export interface Rng {
  int(min: number, max: number): number
  pick<T>(xs: readonly T[]): T
  shuffle<T>(xs: readonly T[]): T[]
  sub(name: SubstreamName): Rng
}

export function makeRng(seed: string): Rng {
  const root = xoroshiro128plus(fnv1a32(seed))
  return wrap(root, 0)
}

function wrap(gen: RandomGenerator, jumps: number): Rng {
  let g = gen
  return {
    int(min, max) { const [v, next] = uniformInt(min, max)(g); g = next; return v },
    pick(xs) { return xs[this.int(0, xs.length - 1)] },
    shuffle(xs) { /* Fisher-Yates using this.int */ },
    sub(name) {
      let j = gen
      // Deterministic, name-indexed jump distance.
      for (let i = 0; i <= SUBSTREAMS.indexOf(name); i++) j = j.jump!()
      return wrap(j, jumps + 1)
    },
  }
}
```

Three determinism rules, each with a unit test:

1. **Rejection sampling never advances a shared stream.** Discarded candidates consume randomness; if that happens on the main stream, adding one degeneracy check silently changes every subsequent item. Rejection loops run on `sub('repair')`, which nothing else reads.
2. **Draw order is pinned and documented.** `incidentals → grid materialisation → distractors → key position`. A test asserts a committed fixture bank regenerates byte-identically.
3. **No floating-point accumulation.** All geometry is recomputed from the spec in absolute terms (§6.2), never accumulated through successive transforms.

### 3.7 Targeting difficulty

`difficulty.ts` implements doc 03 §4.4 verbatim, and the value in the spec is always its output — never typed by a human:

```ts
// src/lib/cognitive/generator/difficulty.ts
const W: Record<RuleId, number> = {
  R0: 0, R1: 0.0, R2: 0.3, R8: 0.2, R9: 0.2,
  R3: 0.6, R4: 0.8, R5: 0.8, R6: 0.9, R7: 1.6,
}
const BETA0 = -2.0, GAMMA = 0.5, LAMBDA = 0.5, PI = 0.3, DELTA = 0.15

export function predictedB(rad: Radicals, opts: { nonCardinalAsymmetricRotation: boolean }): number {
  const ruleSum = rad.ruleIds.reduce((s, id) => s + W[id], 0)
    + (opts.nonCardinalAsymmetricRotation ? 0.3 : 0)
  return BETA0
    + ruleSum
    + GAMMA  * (rad.ruleCount - 1)
    + LAMBDA * (rad.crossLayer ? 1 : 0)
    + PI     * rad.perceptualLoad
    + DELTA  * Math.max(0, rad.nearMissCount - 2)
}

export function band(b: number): Band {
  return b < -1.0 ? 'easy' : b < 0.5 ? 'moderate' : b < 1.5 ? 'hard' : 'very_hard'
}
```

Targeting works by **selecting the family, not by tuning the item**. To fill a hard slot, the assembler picks families whose `predictedB` falls in the band; it does not adjust an existing family's radicals to move it. Radicals are fixed per family by definition (doc 03 §4.1), and a family whose siblings differ in radicals is not a family.

Two consequences worth stating plainly:

- **The blueprint must be authored to hit the bands.** If no family lands in `very_hard`, the bank has no very-hard items, and no amount of generation fixes it. Blueprint coverage is a §9.1 planning problem.
- **doc 03's stated exemplar b values do not reconcile with its own formula.** Running §4.4 over the exemplars' declared radicals gives M1 = −1.5 (doc says −2.0), M6 = +0.5 (doc says +0.7) and M8 = +0.6 (doc says +2.2). The M8 gap of 1.6 logits cannot be closed by the π and δ terms, whose combined maximum is +0.9. Either the weights or the stated values need revising before the generator is authored, because gate **G-14** asserts `|spec.predictedB − predictedB(spec.radicals)| < 0.005` and every exemplar fixture would fail it as written. This is **open question OQ-1** (§11).

---

## 4. Distractor generation

### 4.1 What each grammar label means algorithmically

Doc 03 §5.3 defines four labels. Each becomes a generator with a *named reference* — the specific wrong reasoning step it encodes — so that the rationale written into `item_option_diagnostics` is derived, not composed by hand.

```ts
// src/lib/cognitive/generator/distractors.ts
export type ErrorLabel = 'WR' | 'IR' | 'PM' | 'RP'

export interface DistractorCandidate {
  cell: Cell
  label: ErrorLabel
  /** The named error, for the rationale and for later distractor-trace analysis. */
  mechanism: string
  /** Which axes it is wrong on. Empty => it is a defensible answer => rejected. */
  wrongAxes: AxisId[]
}
```

**IR — incomplete rule** (doc 03: "correct on a subset of the operating rules, violating exactly one"). Take the key; pick one rule-governed axis; substitute the value produced by a *named stall*:

```ts
function incompleteRule(ctx: Ctx, axis: AxisId, stall: 'prevColumn' | 'prevRow'): DistractorCandidate {
  const lat = ctx.lattices[axis]
  const stalled = stall === 'prevColumn' ? lat[2][1] : lat[1][2]   // (3,2) or (2,3)
  return {
    cell: withAxis(ctx.keyCell, axis, stalled!),
    label: 'IR',
    mechanism: `stall:${axis}@${stall}`,
    wrongAxes: [axis],
  }
}
```

Requires ≥ 2 rule axes, which is why single-rule families (M2, M4, M5) draw their near-misses from WR instead. Doc 03's own M4/M5 distractor rationales confirm this: their "IR" options are element-dropping errors within the *operation*, which is a WR-shaped mechanism on a set axis. Handle set axes with a dedicated stall:

```ts
/** For set-valued axes: apply the correct operation, then drop one element.
 *  Doc 03 M4 option D ("three of four bars, dropping D2") and M5 option A
 *  ("correct subtraction but drops CTR"). */
function incompleteSetRule(ctx: Ctx, axis: AxisId, dropIndex: number): DistractorCandidate {
  const key = axisOf(ctx.keyCell, axis) as { t: 'set'; v: readonly string[] }
  if (key.v.length < 2) return null
  const dropped = key.v.filter((_, i) => i !== dropIndex % key.v.length)
  return {
    cell: withAxis(ctx.keyCell, axis, { t: 'set', v: canonicalSort(dropped) }),
    label: 'IR', mechanism: `dropElement:${axis}[${key.v[dropIndex % key.v.length]}]`,
    wrongAxes: [axis],
  }
}
```

**WR — wrong rule.** Substitute a different rule *from the same rule family* on one axis and recompute (3,3), holding every other axis correct. The substitution table is the mechanism name:

| Correct rule | Wrong-rule substitutions |
|---|---|
| R7 symmetric difference | union (R4), intersection, difference (R5) |
| R4 union | symmetric difference, intersection |
| R5 difference | reverse difference (C2 ∖ C1), union |
| R1 progression step *k* | step 2*k*, step −*k*, step-doubling (*k*, 2*k*, 3*k*) |
| R2 rotation step *k* | step −*k* (anticlockwise), row step applied as column step |
| R6 Latin square | wrap the row's own sequence (repeat row 1's C3 value) |

```ts
function wrongRule(ctx: Ctx, axis: AxisId, sub: RuleSubstitution): DistractorCandidate {
  const wrongLat = fillLattice(sub.build(ctx.params), ctx.lattices[axis])
  const v = sub.build(ctx.params).implies(wrongLat, 3, 3)
  return v && { cell: withAxis(ctx.keyCell, axis, v), label: 'WR',
                mechanism: `wrongRule:${axis}:${sub.name}`, wrongAxes: [axis] }
}
```

Doc 03's M8 options B (intersection instead of XOR) and C (union instead of XOR) are exactly this generator with `sub = 'intersection'` and `sub = 'union'`.

**PM — perceptual match.** A chimera assembled from spatially adjacent context cells, so it is locally plausible without satisfying anything:

```ts
/** Take axis values from two different context cells adjacent to the gap.
 *  Doc 03 M6 option D: "circle with tick 180 reproduces R3C1's tick inside the
 *  correct shape — a chimera of the two nearest cells". */
function chimera(ctx: Ctx, from: Record<AxisId, [row: number, col: number]>): DistractorCandidate {
  let cell = ctx.keyCell
  const wrong: AxisId[] = []
  for (const [axis, [r, c]] of Object.entries(from) as [AxisId, [number, number]][]) {
    const v = ctx.lattices[axis][r - 1][c - 1]!
    if (!axisEq(v, axisOf(ctx.keyCell, axis))) wrong.push(axis)
    cell = withAxis(cell, axis, v)
  }
  return { cell, label: 'PM', mechanism: `chimera:${describe(from)}`, wrongAxes: wrong }
}

/** Rotation-specific PM: the 180-degree confusion. Doc 03 M2 option C:
 *  "the 180-degree opposite of the key; mirror confusions are the signature
 *  error in mental rotation". */
function mirrorConfusion(ctx: Ctx, axis: AxisId): DistractorCandidate { /* … */ }
```

**RP — repetition.** An exact copy of a named context cell, preference-ordered R3C2 → R3C1 → R2C3:

```ts
function repetition(ctx: Ctx, row: number, col: number): DistractorCandidate {
  const cell = ctx.grid.find(g => g.row === row && g.col === col)!
  return { cell: stripCoords(cell), label: 'RP', mechanism: `copyCell:R${row}C${col}`,
           wrongAxes: ctx.ruleAxes.filter(a => !axisEq(axisOf(cell, a), axisOf(ctx.keyCell, a))) }
}
```

### 4.2 The solver gate

Every candidate passes through the same verifier that proves uniqueness (§5). This is the RAVEN-FAIR discipline: the generator's own solver adjudicates, and the acceptance test is `>=`, not `>`, so ties are rejected.

```ts
export function gateDistractor(c: DistractorCandidate, ctx: Ctx): GateResult {
  if (c.wrongAxes.length === 0)                 return reject('SATISFIES_ALL_RULES')
  if (cellEq(c.cell, ctx.keyCell))              return reject('EQUALS_KEY')
  if (ctx.accepted.some(o => cellEq(o.cell, c.cell))) return reject('DUPLICATE_OPTION')

  // The decisive check: does this candidate satisfy EVERY surviving rule tuple,
  // not just the declared ones? A candidate can violate the intended rule and
  // still be a defensible answer under an alternative reading of the context.
  for (const tuple of ctx.admissibleTuples) {
    if (tupleSatisfiedBy(tuple, c.cell, ctx)) return reject('DEFENSIBLY_CORRECT')
  }

  // Doc 03 §9 rule 3: option homogeneity.
  if (Math.abs(elementCount(c.cell) - elementCount(ctx.keyCell)) > 2)
    return reject('COMPLEXITY_OUTLIER')

  return accept()
}
```

`ctx.admissibleTuples` comes from the Level A pass (§5.2) and is normally a single tuple, because Level A rejects the item outright if it is not. Keeping the loop general is cheap and means the gate stays correct if Level A is ever relaxed to permit a declared ambiguity.

### 4.3 Assembly order

```ts
export function buildOptions(ctx: Ctx, plan: ErrorLabel[], rng: Rng): OptionSpec[] {
  const accepted: DistractorCandidate[] = []
  const generators = enumerateGenerators(ctx, plan)   // ordered, deterministic

  for (const label of plan) {
    let placed = false
    for (const gen of generators.filter(g => g.label === label)) {
      const c = gen.run()
      if (c && gateDistractor(c, { ...ctx, accepted }).ok) { accepted.push(c); placed = true; break }
    }
    if (!placed) throw new GeneratorError('DISTRACTOR_EXHAUSTED', { label, family: ctx.family })
  }

  // Context-blind balance repair, then key placement.
  const balanced = repairBalance(ctx, accepted, rng.sub('repair'))
  return placeOptions(ctx.keyCell, balanced, rng.sub('keyPosition'))
}
```

`DISTRACTOR_EXHAUSTED` is a *family authoring* error, not a bad-luck error: if a family cannot produce four gated distractors of the planned labels for any incidental setting, the plan is wrong for that family. It throws rather than degrading, because the alternative — silently substituting a different label — would make `item_option_diagnostics` lie, and those labels are what make the pilot's distractor-trace analysis (doc 03 §12 Stage 2) interpretable.

**Never pad.** There is no fallback that emits a blank or near-blank option. An option set that cannot be completed is a rejected item.

### 4.4 Context-blind solvability

The I-RAVEN finding is that an option set built entirely from single-attribute perturbations of the key lets a solver recover the key from the options alone: the key is the option whose value on each attribute is the modal value across the set. Doc 03's grammar is less exposed than RAVEN's — RP copies whole cells and PM builds chimeras, both of which move multiple axes at once — but it is not immune, and six of the eight exemplars fail (Appendix A).

Two blind scorers, both run over the options only:

```ts
// src/lib/cognitive/generator/qa/contextblind.ts

/** Scorer 1 — per-axis modal vote. Set-valued axes vote per element presence. */
export function modalComposition(options: Cell[], axes: AxisId[]): Cell[] {
  const modal: Partial<Record<AxisId, AxisValue[]>> = {}
  for (const axis of axes) {
    const vals = options.map(o => axisOf(o, axis))
    if (vals[0].t === 'set') {
      const universe = [...new Set(vals.flatMap(v => (v as SetVal).v))].sort()
      const present = universe.filter(el =>
        vals.filter(v => (v as SetVal).v.includes(el)).length * 2 > options.length)
      modal[axis] = [{ t: 'set', v: present }]
    } else {
      const counts = new Map<string, number>()
      for (const v of vals) counts.set(axisKey(v), (counts.get(axisKey(v)) ?? 0) + 1)
      const top = Math.max(...counts.values())
      modal[axis] = vals.filter(v => counts.get(axisKey(v)) === top)
    }
  }
  return cartesianCells(modal, axes)   // all compositions of tied modal values
}

/** Scorer 2 — nearest-to-centroid. The option with the smallest summed
 *  axis-wise distance to the other four. Catches sets where the key is the
 *  "average" option even when no single axis is modal. */
export function centroidPick(options: Cell[], axes: AxisId[]): number[] { /* … */ }

export function contextBlindGate(options: Cell[], keyIndex: number, axes: AxisId[]): GateResult {
  const modal = modalComposition(options, axes)
  if (modal.some(m => cellEq(m, options[keyIndex]))) return fail('MODAL_RECOVERS_KEY')
  if (centroidPick(options, axes).includes(keyIndex)) return fail('CENTROID_RECOVERS_KEY')

  // Per-axis balance: on at least half the rule axes, the key's value must be
  // held by no more than 2 of the 5 options.
  const minority = axes.filter(a =>
    options.filter(o => axisEq(axisOf(o, a), axisOf(options[keyIndex], a))).length <= 2)
  if (minority.length < Math.ceil(axes.length / 2)) return fail('KEY_VALUE_DOMINATES')

  return pass()
}
```

**Batch-level assertion.** Per-item gates are necessary but not sufficient: a bank can pass item-by-item and still leak in aggregate. Gate **G-09** runs both blind scorers across the whole run and requires the hit rate to be indistinguishable from chance (0.200 for five options) at a two-sided exact binomial test, α = .05. For a 144-item bank the acceptance interval is 20–39 hits inclusive. A run outside it fails wholesale — no items are written.

### 4.5 Balance repair, and the repaired M6

When `contextBlindGate` fails, `repairBalance` mutates *distractors only*, never the key (doc 03 §9 rule 4: "checked and broken at QA by adjusting distractors, never the key"). The move that works is to make two distractors agree on a wrong value for an axis, which flips that axis's modal value away from the key:

```ts
function repairBalance(ctx: Ctx, accepted: DistractorCandidate[], rng: Rng): DistractorCandidate[] {
  for (let attempt = 0; attempt < 24; attempt++) {
    const cells = [ctx.keyCell, ...accepted.map(a => a.cell)]
    const g = contextBlindGate(cells, 0, ctx.ruleAxes)
    if (g.ok) return accepted

    // Pick the axis where the key's value is most over-represented, and
    // re-run one distractor's generator with a reference that moves it.
    const axis = mostKeyDominatedAxis(cells, 0, ctx.ruleAxes)
    const victim = pickVictim(accepted, axis, rng)          // never the only carrier of a label
    const replacement = regenerate(ctx, victim, { avoidKeyValueOn: axis, rng })
    if (replacement && gateDistractor(replacement, { ...ctx, accepted: without(accepted, victim) }).ok) {
      accepted = replace(accepted, victim, replacement)
    }
  }
  throw new GeneratorError('BALANCE_UNREPAIRABLE', { family: ctx.family })
}
```

Applied to M6, the repair changes option **D** from `circle + tick 180°` to `square + tick 180°`, which is still a legitimate PM (a chimera of R3C2's shape with R3C1's tick — arguably a *better* PM, since it takes one axis from each of the two cells nearest the gap rather than one axis from a cell and one from the key):

| Slot | Cell | Label | Mechanism |
|---|---|---|---|
| A | circle, tick 270° | IR | `stall:inner.rotation@prevColumn` |
| **B** | **circle, tick 0°** | **KEY** | — |
| C | diamond, tick 0° | IR | `stall:outer.shape@prevColumn` |
| D | square, tick 180° | PM | `chimera:{outer.shape←R3C2, inner.rotation←R3C1}` |
| E | square, tick 270° | RP | `copyCell:R3C2` |

Blind check: outer shape is `circle` ×2, `diamond` ×1, `square` ×2 — tied, key value held by 2. Tick rotation is `0°` ×2, `270°` ×2, `180°` ×1 — tied, key value held by 2. No modal composition equals the key; the key's value is in the minority on 2 of 2 axes. Passes G-08 and G-09.

Every distractor is still gated: `circle/270°` fails R2; `diamond/0°` fails R6 (diamond already sits at R3C1); `square/180°` fails both; `square/270°` is R3C2 verbatim and fails both. None satisfies the admissible rule tuple.

---

## 5. Solution-uniqueness verification

This is the highest-value gate in the pipeline and the one no published generator performs completely. It runs in two levels, and the second depends on the first.

### 5.1 What "unique" has to mean

Not "the generator intended one answer". Not "only one option matches the rules we wrote down". The item is admissible only if:

> **Level A.** Given the eight visible context cells, every rule assignment drawn from the declared rule space that is consistent with those cells implies the *same* content at (3,3) — in every reading direction the rendering exposes (row, column, both diagonals).
>
> **Level B.** Exactly one of the five options realises that content, and no other option satisfies any surviving assignment.

Level A is what makes the item *determinate*: it rules out the case where the context genuinely underdetermines the answer and the candidate's "wrong" answer was defensible. Level B is what makes the *option set* correct. Doc 03 §5.4 lists uniqueness (check 1), column consistency (check 2) and accidental-regularity (check 4) as three separate gates; Level A subsumes all three, because a column reading and an unintended alternation are both just additional (direction, rule) tuples in the same enumeration. The QA report still records them as three named results so the technical manual can be written against doc 03's numbering.

### 5.2 The factorisation that makes it cheap

A naive enumeration over joint rule assignments is large: with ~13 candidate axes, ~40 rules per axis and up to 3 rules per item, the joint space is in the millions. It is unnecessary, because **consistency of a rule on axis *a* depends only on the nine observed values of axis *a***. The space factorises.

```ts
// src/lib/cognitive/generator/qa/uniqueness.ts

export type SurvivingRule = { axis: AxisId; rule: AxisRule; implied: AxisValue }

export function levelA(grid: GridCell[], axes: AxisId[], domains: AxisDomains): LevelAResult {
  const perAxis: Record<AxisId, SurvivingRule[]> = {}
  const impliedByAxis: Record<AxisId, AxisValue[]> = {}

  for (const axis of axes) {
    const lat = latticeOf(grid, axis)            // 3x3 with null at (3,3)
    const varies = distinctValues(lat) > 1

    const surviving: SurvivingRule[] = []
    for (const rule of ruleSpaceFor(axis, domains[axis])) {
      if (!rule.explains(lat)) continue
      const implied = rule.implies(lat, 3, 3)
      if (!implied) continue                     // consistent but silent at (3,3)
      surviving.push({ axis, rule, implied })
    }

    if (varies && surviving.length === 0) {
      return fail('AXIS_UNEXPLAINED', { axis })  // the axis varies with no readable rule
    }

    const implied = dedupeByKey(surviving.map(s => s.implied))
    if (implied.length > 1) {
      return fail('AXIS_AMBIGUOUS', {
        axis,
        readings: surviving.map(s => ({ rule: s.rule.label, implies: axisKey(s.implied) })),
      })
    }
    if (implied.length === 0 && !varies) {
      // Constant axis: the constant reading is the only reading.
      implied.push(lat[0][0]!)
    }

    perAxis[axis] = surviving
    impliedByAxis[axis] = implied
  }

  return ok({
    keyCell: assembleCell(impliedByAxis),
    admissibleTuples: [cartesian(perAxis)],     // singleton by construction
    perAxisReadings: perAxis,
  })
}
```

**Cost.** 13 axes × ~40 candidate rules × 9 cell comparisons ≈ 4,700 primitive operations per item, plus set-operator rules which are O(|set|). Sub-millisecond in Node. Generating and verifying 144 items is a few seconds including rasterisation for the density and render gates. There is no reason to skip this gate for performance and no reason to sample rather than enumerate.

**What `ruleSpaceFor` enumerates.** The space must be a superset of what the generator can produce — otherwise Level A cannot catch an alternative reading — and a superset of what a competent human solver would try. For each axis:

| Rule | Enumerated variants |
|---|---|
| R0 constant | 1 (row, column, both — collapse to one) |
| R1/R8/R9 progression | step ∈ {±1, ±2} × {row, column, both, row-with-offset} = 16 |
| R2 rotation | step ∈ {±45, ±90, ±135, ±180} × row offset ∈ {0, ±45, ±90, ±180} = 32 |
| R3 movement | 3 anchor cycles × direction ∈ {fwd, rev} × {row, column} = 12 |
| R6 Latin square | 1 (parameterless — the observations determine it) |
| R4/R5/R7 set operators | 4 ops (union, difference, reverse-difference, symdiff) × 2 directions = 8 |
| Alternation / symmetry probes | 6 (ABA row alternation, column alternation, reflective symmetry about the centre cell, 180° rotational symmetry, main-diagonal constancy, anti-diagonal constancy) |

The last row is what doc 03 §5.4 check 4 calls the accidental-regularity scan. Those probes have no generator counterpart — they exist purely to catch readings a candidate might find. Adding a probe is cheap and strictly increases the gate's strictness, so the enumeration should be extended whenever a reviewer reports a reading the scan missed. **Gate G-04 records the probe-set version**, so an item verified under an older probe set is re-verified when the set grows (this is what `QaReport.batteryVersion` is for).

**Directional asymmetry is handled, not assumed away.** M8's XOR holds row-wise and not column-wise. The column readings of `inner.bars` simply fail `explains` and contribute nothing — that is correct behaviour, not a defect. What matters is that no *other* column rule survives on that axis, and the enumeration checks it. Verified by hand against M8's bar sets: column 1 is `{H}, {D1,V}, {H,D1}` — not a union, difference, symmetric difference, distribution-of-two, or any alternation, so `Consistent(column) = ∅`. Doc 03's own M8 note ("columns do not carry the XOR rule; the accidental-regularity scan confirms no rival rule licenses another option") is exactly this result, now mechanised.

### 5.3 Level B

```ts
export function levelB(options: Cell[], la: LevelAResult, axes: AxisId[]): LevelBResult {
  const realising = options
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => cellEq(o, la.keyCell))
  if (realising.length !== 1) return fail('KEY_NOT_UNIQUE_AMONG_OPTIONS', { count: realising.length })

  const keyIndex = realising[0].i
  for (let i = 0; i < options.length; i++) {
    if (i === keyIndex) continue
    for (const tuple of la.admissibleTuples) {
      if (tupleSatisfiedBy(tuple, options[i], axes)) {
        return fail('DISTRACTOR_DEFENSIBLE', { slot: 'ABCDE'[i], tuple: describe(tuple) })
      }
    }
  }
  return ok({ keyIndex })
}
```

Note the deliberate redundancy: given `|admissibleTuples| === 1` and the key cell being the unique realisation, `DISTRACTOR_DEFENSIBLE` is unreachable. It is kept because it is the assertion a reviewer and an auditor actually want to see stated, it costs microseconds, and it is the check that must survive if Level A is ever relaxed.

### 5.4 The audit artefact

`QaReport.admissibleRuleTuples` persists every surviving `(axis, direction, rule label, implied value)` row. This is what makes uniqueness *demonstrable* rather than asserted. It appears in the reviewer panel (§8.2) as the "why this is the only answer" block, and it is what the technical manual reproduces for a sampled subset of items.

For repaired M6 it is two rows:

```
outer.shape      | both | latin(outer.shape,{square,circle,diamond}) | enum:circle
inner.rotation   | both | rot(inner.rotation,+90/col,+90/row)        | num:0
```

Two rows, one per axis, each with a single reading. That is what an admissible item looks like.

---

## 6. The SVG renderer

### 6.1 Position

Server-side, pure, string-emitting; no DOM, no browser, no external fetch. Three consumers share it: delivery (plan-architecture.md §2.4 renders inline per request), the QA render and density gates, and the admin preview contact sheet. The rasteriser used by the QA gates is `@resvg/resvg-js` — deterministic, Rust, prebuilt for linux-x64-gnu, no Chromium. The repo's existing `puppeteer-core` + `@sparticuz/chromium-min` is deliberately *not* reused here: Chromium's raster output is not stable across versions, which would break the content-addressed density and render checks.

### 6.2 Coordinate system

One cell = one `<svg viewBox="0 0 100 100">`. Anchors per doc 03 §5.1: TL (20,20), TR (80,20), BL (20,80), BR (80,80), CTR (50,50). Sizes as bounding-box width: S = 25, M = 40, L = 60.

**All coordinates are computed absolutely in TypeScript and emitted as literals.** No `transform` attributes, no nested transform stacks, no accumulation. A rotated triangle is emitted as three rotated points, not as a `<polygon>` inside a `rotate()`. This is a determinism requirement, not a style preference: accumulated float transforms make the SVG string — and therefore the content hash and the raster — dependent on evaluation order.

```ts
// src/lib/cognitive/render/geometry.ts

/** Rotate (x,y) about (cx,cy) by theta degrees clockwise. */
export function rot(x: number, y: number, cx: number, cy: number, deg: number): [number, number] {
  const t = (deg * Math.PI) / 180, s = Math.sin(t), c = Math.cos(t)
  const dx = x - cx, dy = y - cy
  return [cx + dx * c - dy * s, cy + dx * s + dy * c]
}

/** Regular n-gon, apex up, bounding-box WIDTH = size. */
export function polygon(n: number, cx: number, cy: number, size: number, deg: number): Pt[] {
  // Circumradius chosen so the bounding-box width equals `size`.
  const halfWidth = n % 2 === 0
    ? Math.cos(Math.PI / n)                         // even n: vertices span the width
    : Math.sin(Math.PI * Math.floor(n / 2) / n)     // odd n: widest chord
  const R = size / (2 * halfWidth)
  return Array.from({ length: n }, (_, i) => {
    const a = -90 + (360 / n) * i
    return rot(cx + R * Math.cos((a * Math.PI) / 180),
               cy + R * Math.sin((a * Math.PI) / 180), cx, cy, deg)
  })
}

/** Fixed number formatting — the single source of truth for hash stability. */
export function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}
```

Primitives, all in canvas units:

| Element | Geometry |
|---|---|
| `circle` | `<circle cx cy r=size/2>` |
| `square` | `polygon(4, …)` rotated 45° from the diamond orientation, emitted as `<polygon>` so rotation is uniform with the others |
| `triangle` | `polygon(3, …)`, apex up at rotation 0 |
| `diamond` | `polygon(4, …)` at rotation 0 (a square rotated 45°, per doc 03 §5.1) |
| `pentagon` | `polygon(5, …)`, apex up |
| `arrow` | Shaft `(cx, cy+size/2)`→`(cx, cy−size/2+headLen)` with `shaftWidth = 0.12·size`; head a 3-point polygon with `headWidth = 0.45·size`, `headLen = 0.35·size`. Emitted as one closed `<polygon>` of 7 points so fill and stroke behave as a single figure |
| `tick` | `<line>` from CTR to `(50 + L·sin θ, 50 − L·cos θ)` |
| `bars` | H `(20,50)→(80,50)`; V `(50,20)→(50,80)`; D1 `(50−d,50−d)→(50+d,50+d)`; D2 `(50+d,50−d)→(50−d,50+d)` with `d = 60/(2√2) = 21.213` — all length 60 through CTR per doc 03 §5.1 |
| `dots` | Solid circles of size S at each named anchor |
| `repeat` | *n* copies laid out per doc 03 §5.1: 1–3 in one centred row with 8-unit gaps; 4 as 2+2; 5 as 3+2, top row first, both rows centred |

### 6.3 Fills without ids

`outline` is `fill="none"`. `solid` is `fill="{ink}"`. `hatched` needs 45° lines clipped to the shape — and the obvious implementations (`<pattern>`, `<clipPath>`) both require `id` attributes, which are a collision hazard when a dozen SVGs are inlined on one page and a hash-stability hazard if the id is derived from anything positional.

**Emit clipped hatch geometry directly.** For each shape, intersect the 45° line family with the shape's boundary analytically and emit only the resulting segments:

```ts
// src/lib/cognitive/render/primitives.ts
export function hatchSegments(shape: ResolvedShape, pitch: number): Seg[] {
  const { minX, minY, maxX, maxY } = bbox(shape)
  const segs: Seg[] = []
  // 45 degree family: x + y = k, stepping k by pitch*sqrt(2).
  const step = pitch * Math.SQRT2
  const kMin = Math.ceil((minX + minY) / step) * step
  for (let k = kMin; k <= maxX + maxY; k += step) {
    const chord = shape.kind === 'circle'
      ? clipLineToCircle(k, shape)          // closed form
      : clipLineToPolygon(k, shape.points)  // Sutherland-style, returns 0..1 spans
    if (chord && length(chord) >= 3) segs.push(chord)   // drop slivers under 3 units
  }
  return segs
}
```

`clipLineToPolygon` for a convex polygon is a 20-line parametric intersection; every shape in the vocabulary is convex. The output has no ids, no `<defs>`, no external references, and hashes stably. The 3-unit sliver floor stops hairline fragments appearing at the shape's corners, which is a visible ugliness at phone scale.

Hatch pitch is `render.hatchPitch`, default 4 (doc 03 §5.1's "4 px spacing at reference scale"). See §6.4 for why this is the tightest constraint in the whole layout and why the schema allows 4–6.

### 6.4 Mobile layout and the legibility budget

Doc 03 §7.3 sets the floor at a **360 CSS px** viewport, so designing to 360 satisfies the 375 px iPhone width with margin. All figures below are at 360.

```
360 px viewport
  − 16 px padding each side              = 328 px content width
Grid: 3 cells + 2 gutters of 6 px        → cell = (328 − 12) / 3 = 105.33 → 105 px
Scale                                     = 105 / 100 = 1.05 CSS px per canvas unit
Options: 3 per row + 2 on the second row
         tile = (328 − 2 × 8) / 3        = 104 px   (doc 03 floor: 64 px)
```

The second row holds two tiles at the *same* 104 px, left-aligned — not stretched to fill, because equal tile size across all five options is part of option homogeneity (doc 03 §9 rule 3).

Legibility budget at 1.05 px/unit:

| Quantity | Canvas units | CSS px | doc 03 floor | Headroom |
|---|---|---|---|---|
| Stroke width | 2 | 2.10 | 1.5 | ✓ |
| Minimum element extent | 10 | 10.50 | 8 | ✓ |
| Size S | 25 | 26.25 | 8 | ✓ |
| Dot (size S) | 25 | 26.25 | 8 | ✓ |
| Tick length | 30 | 31.50 | 8 | ✓ |
| Hatch pitch | 4 | **4.20** | — | **marginal** |
| Hatch gap (pitch − stroke) | 2.8 | **2.94** | — | **marginal** |

Hatch is the binding constraint. A 4.2 px pitch with a 1.26 px hatch stroke leaves a ~2.9 px gap, which resolves at DPR ≥ 2 and is at the edge at DPR 1. Two responses, both implemented:

1. `render.hatchPitch` is a spec field, schema range 4–6, default 4 per doc 03. Raising it is a `render_style_version` bump, which changes `content_hash` and therefore constitutes a new item — the lifecycle trigger enforces this and it is the correct behaviour.
2. Gate **G-15** rasterises every hatched cell at 105 × 105 device px (DPR 1) and asserts that the alternating light/dark run-length histogram along the hatch normal has no run shorter than 2 device px. An item whose hatch collapses at DPR 1 fails.

Everything else scales up on wider viewports by increasing the CSS pixel size of the same 100-unit canvas. Layout never reflows the *composition*: the 3×3 grid and the 3+2 option block keep their arrangement at every width, so the amount of the item visible at once does not vary by device. That is a deliberate control on the device-comparability question doc 03 §12 Stage 3 makes a DIF obligation.

### 6.5 Palette, and the honest position on colour

**Colour is not an encoding channel anywhere in this instrument** (doc 03 §1.4, §7.4). Fill state is carried by pattern — `outline` / `hatched` / `solid` — and every item survives full desaturation without loss of information. The renderer therefore has a two-token palette:

```ts
// src/lib/cognitive/render/palette.ts
export const PALETTE = {
  light: {
    ink:         '#111827',   // all stimulus geometry: strokes and solid fills
    paper:       '#FFFFFF',   // cell background
    cellRule:    '#D1D5DB',   // 1 px cell border — chrome, not stimulus
    blankMark:   '#9CA3AF',   // the "?" placeholder in R3C3
  },
  dark: {
    ink:         '#F9FAFB',
    paper:       '#111827',
    cellRule:    '#374151',
    blankMark:   '#6B7280',
  },
} as const
```

`#111827` on `#FFFFFF` is a contrast ratio of about 16.9:1, and the dark inversion is the same ratio — both far above doc 03 §7.3's 4.5:1 floor and above WCAG 2.2 SC 1.4.11's 3:1 for graphical objects.

UI chrome around the stimulus (selection ring, focus ring, Confirm button) is not part of the item and lives in the platform's existing design tokens. It must not be used to distinguish options from one another beyond "selected / not selected".

**Okabe–Ito.** The task asked for a colour-blind-safe palette, and here it is — with the caveat that it is *not used for stimuli*:

```
#000000 black          #E69F00 orange         #56B4E9 sky blue      #009E73 bluish green
#F0E442 yellow         #0072B2 blue           #D55E00 vermilion     #CC79A7 reddish purple
```

Its only sanctioned uses are (a) admin/QA diagnostic overlays — the density heatmap, the reviewer's rule-highlight overlay, the LLTM radical colouring in analytics — and (b) any future non-figural item type where colour is genuinely decorative. If a future change ever proposes making colour an encoding channel in a figural item, that is a change to doc 03 §1.4 and needs to be argued there, not solved with a palette.

**Dark mode is a delivery covariate.** The same spec renders in both themes and both meet contrast, but `solid` versus `outline` is a luminance contrast that inverts. For the pilot, lock light mode and record the theme with every response alongside device class, so it is available to the device-DIF analysis doc 03 §12 Stage 3 requires. Offering dark mode before that analysis exists would introduce an uncontrolled presentation variable.

### 6.6 Output discipline

`renderMatrixGrid` and `renderOptionTile` emit strings under fixed rules, all unit-tested:

- Attributes in a fixed order: `points|cx|cy|r|x1|y1|x2|y2`, then `fill`, then `stroke`, then `stroke-width`, then `stroke-linecap`.
- All numbers through `fmt()`.
- No `<text>`, no `font-*` — option letters A–E are DOM text outside the SVG, so output never depends on the host's font set.
- No `id`, no `<defs>`, no `<use>`, no `xlink:`, no `href`, no `<foreignObject>`, no `on*` attributes, no `<script>`.
- No `transform` attributes.
- `shape-rendering="geometricPrecision"` on the root so strokes are not auto-snapped differently across engines.

Two tests pin this, matching plan-architecture.md §2.4's safety argument for `dangerouslySetInnerHTML`: (a) rendering every fixture never emits any forbidden token; (b) every emitted numeric attribute is finite. A third test asserts `sha256(renderMatrixGrid(spec))` matches a committed golden value for each fixture, which is what makes a renderer change visible in code review rather than silent in production.

### 6.7 Accessibility, stated honestly

Restating doc 03 §7.4 as the implementation position, because it is easy to soften by accident:

- **Figural matrix items cannot be made meaningfully screen-reader accessible.** A cell-by-cell verbal description does not present the same item to a different modality — it converts an inductive visual-relational task into a verbal working-memory task. That is a different construct. The platform does not pretend otherwise.
- The `aria-label` is therefore a *descriptive identification*, not a description of content: `"Figural reasoning item 7 of 18. A three-by-three grid of geometric figures with the bottom-right cell missing, and five answer options."` This is what WCAG 2.2 SC 1.1.1's test-and-exercise exception provides for, and the accessibility statement should cite it in those terms rather than claim conformance by alt text.
- Everything else in the standard applies fully and is not excused: no colour-only encoding (SC 1.4.1) — satisfied by design, colour carries nothing; ≥ 3:1 for graphical objects (SC 1.4.11) — satisfied at 16.9:1; target size — option tiles are 104 × 104 CSS px, above SC 2.5.5's 44 px AAA threshold and well above SC 2.5.8's 24 px AA; full keyboard operability with a visible focus ring that does not overlap the figure; no drag, no double-tap; tap-then-Confirm (doc 03 §7.3).
- A documented alternative route exists and is a product requirement, not a policy statement: the LR-D component is fully screen-reader compatible, an individually administered assessment through the client's adjustments process replaces LR-M, and the platform must not auto-reject a candidate for an unattempted LR-M under a declared adjustment.

---

## 7. Automated QA gates

Every gate is a pure function returning `{ status, detail }`, and the composite report is written to `cognitive_item_specs.qa`. `generateFamily` throws on any `fail`. Gates G-01 to G-14 are per-item; G-15 to G-17 are per-batch.

| ID | Gate | Passes when | doc 03 ref | Module |
|---|---|---|---|---|
| **G-01** | Schema validity | `FiguralMatrixSpec.parse()` succeeds; `.strict()` rejects unknown keys | §5.1 | `spec/schema.ts` |
| **G-02** | Axis disjointness | No two rules claim the same `(layer, attribute)` axis | §3 inv. 2 | `compose.ts` |
| **G-03** | Uniqueness — Level A | Every axis has exactly one implied value at (3,3); no axis varies unexplained | §5.4 #1 | `qa/uniqueness.ts` |
| **G-04** | Column consistency | Reported separately: every declared rule with `direction ∈ {both}` survives the column reading | §5.4 #2 | `qa/uniqueness.ts` |
| **G-05** | Accidental regularity | Reported separately: no alternation/symmetry/diagonal probe survives with a different implied value. Records the probe-set version | §5.4 #4 | `qa/uniqueness.ts` |
| **G-06** | Uniqueness — Level B | Exactly one option realises the implied cell; no other option satisfies a surviving tuple | §5.4 #1 | `qa/uniqueness.ts` |
| **G-07** | Distractor audit | Each distractor violates ≥ 1 rule, carries a label from {WR, IR, PM, RP}, and its label matches its generator's mechanism | §5.4 #3 | `distractors.ts` |
| **G-08** | Context-blind (item) | Neither the modal-composition nor the centroid scorer recovers the key; the key's value is in the minority on ≥ ⌈k/2⌉ rule axes | §9 rules 3–4 | `qa/contextblind.ts` |
| **G-09** | Option homogeneity | No two options structurally identical; element-count spread ≤ 2; no option is a blank or degenerate cell | §9 rule 3 | `qa/density.ts` |
| **G-10** | Giveaway pairs | No two options are exact complements on every rule axis such that the remaining three are jointly eliminable | §9 rule 5 | `qa/contextblind.ts` |
| **G-11** | Repeat-heuristic resistance | The key shares a complete layer with ≥ 1 context cell (measured; batch threshold at G-17) | §3.5 note | `qa/degeneracy.ts` |
| **G-12** | Degeneracy | All rule-level, grid-level and visual-degeneracy checks in §3.5 pass | §4.2 hygiene | `qa/degeneracy.ts` |
| **G-13** | Duplicate detection | Neither `content_hash` nor `structural_hash` collides with any existing bank item (§9.3) | §4.2 | `qa/duplicates.ts` |
| **G-14** | Difficulty consistency | `|spec.predictedB − predictedB(spec.radicals)| < 0.005`; `band` matches `band(predictedB)`; radicals equal the family's declared radicals | §4.4 | `difficulty.ts` |
| **G-15** | Render check | At a 360 px viewport: every element ≥ 8 CSS px, stroke ≥ 1.5 CSS px, contrast ≥ 4.5:1, hatch run-length ≥ 2 device px at DPR 1; SVG contains no forbidden token; raster hash stable across two runs | §5.4 #5, §7.3 | `qa/density.ts` |
| **G-16** | Key-position balance (batch) | Across the generated batch, key slot counts A–E differ by ≤ 1; no more than two consecutive positions in the emitted order share a slot | §9 rule 2 | `qa/index.ts` |
| **G-17** | Context-blind (batch) | Blind-scorer hit rate within the exact binomial 95% interval around 0.200; and ≥ 60% of items pass G-11's shared-layer measure | §9 rules 2–4 | `qa/contextblind.ts` |

Three notes on how the gates are meant to behave:

**Gates fail the run, not just the item.** G-16 and G-17 are batch properties. If a run of 144 items produces key-slot counts of A=40, B=20, C=30, D=27, E=27, no items are written — the key-position substream is reseeded and the run repeats. Writing a skewed batch and fixing it at form-assembly time would be possible but leaves the bank permanently skewed for every future form.

**`batteryVersion` forces re-verification.** Adding an accidental-regularity probe or tightening a threshold bumps `batteryVersion`. A nightly CI job re-runs the battery over every non-retired item at the current version and flags any that would now fail. Those items move to `suspended`, not silently retired — a human decides.

**The battery is a correctness gate, not a quality gate.** Passing all 17 says the item is internally consistent, uniquely solvable, legible and traceable. It says nothing about whether the item is *good*, whether the distractors are attractive, or whether it belongs in the band the model assigns. Those are the human reviewer's job (§8) and the pilot's job (doc 03 §12).

---

## 8. Human review workflow

### 8.1 Two stages, matching the lifecycle enum

plan-architecture.md §1.1 defines `draft → content_reviewed → fairness_reviewed → piloting`. Two distinct reviews with distinct rubrics and, ideally, distinct reviewers.

**Stage 1 — content review.** Reviewer: someone fluent in the rule taxonomy — a psychometrician or a trained item writer. Question: *is this a well-formed matrix item that does what its rule statement says?*

**Stage 2 — fairness and accessibility review.** Reviewer: someone with fairness/accessibility responsibility, explicitly *not* the content reviewer. Question: *could this item disadvantage someone for a reason unrelated to reasoning?* Kept separate because the automated-item-review literature is consistent that machine flagging fails specifically on bias, sensitivity, fairness and accessibility, so this is the stage that must not be compressed or automated away.

### 8.2 What the reviewer actually sees

One item per screen:

1. **The rendered item** exactly as a candidate sees it, at a 360 px frame, with a device toggle (360 / 768 / 1280) and a greyscale toggle.
2. **The key**, highlighted.
3. **The rule statements** in prose, from `RuleSpec.statement`.
4. **The uniqueness artefact** — `admissibleRuleTuples`, rendered as "the only reading of this grid: outer shape forms a Latin square (implies circle); inner tick rotates +90°/column (implies 0°)".
5. **Per-option rationales** from `item_option_diagnostics`, each with its label and mechanism.
6. **The QA report**, all 17 gates, collapsed to a green bar unless something is `skip`.
7. **The family context** — the other siblings already reviewed, as thumbnails, so the reviewer can see whether this clone is meaningfully different from its siblings or is a near-repeat that the structural hash did not catch.

### 8.3 Content-review rubric

Every criterion is a yes/no. Any `no` blocks approval and requires a written reason.

| # | Criterion |
|---|---|
| C1 | The rendered grid matches the rule statements — the rules describe what is actually drawn |
| C2 | I can solve the item from the grid alone, and I reach the stated key |
| C3 | I cannot construct a second defensible answer among the five options |
| C4 | Each distractor is producible by the error its label names — I can describe the candidate who would pick it |
| C5 | No distractor is obviously wrong at a glance (inert), and none is more attractive than the key |
| C6 | The item is not solvable from the options alone (spot-check of G-08) |
| C7 | The stimulus is legible at 360 px and in greyscale; no element reads as a rendering artefact |
| C8 | The item contains no letters, digits, clock faces, dice pips, playing-card motifs, arrows with conventional meanings, or national/religious symbols (doc 03 §7.2) |
| C9 | The assigned band is plausible for the item as drawn — flagged, not blocking, but recorded, because a systematic content-reviewer/model disagreement is itself a blueprint signal |
| C10 | This clone is meaningfully distinct from its siblings — not a near-repeat |

### 8.4 Fairness-review rubric

| # | Criterion |
|---|---|
| F1 | No element or configuration carries cultural, religious, national or gendered meaning |
| F2 | Solving does not depend on a left-to-right scan habit — the rules are recoverable column-wise (confirming G-04 by eye) |
| F3 | No dependence on colour discrimination; the item is unchanged in greyscale and under deuteranopia, protanopia and tritanopia simulation |
| F4 | No dependence on fine visual acuity beyond the doc 03 §7.3 floors; nothing hinges on a distinction smaller than the minimum element size |
| F5 | No dependence on knowledge, vocabulary, numeracy beyond counting to five, or schooling |
| F6 | The stimulus does not require precise motor control to inspect; nothing depends on hover, zoom or scroll |
| F7 | The item does not induce a strategy that a coached candidate could exploit disproportionately — specifically, it is not a bare instance of a single difficult logical rule that a short coaching intervention would teach |
| F8 | Nothing in the item is likely to distress or distract (no forms resembling weapons, wounds, or religious iconography by accident) |

F3 runs a simulation, not a judgement: the reviewer sees the item rendered through the three CVD matrices side by side. Since colour carries nothing, this should always pass; it is retained because it is cheap and because it catches a regression where someone introduces a colour token.

### 8.5 Throughput

Planning assumptions for scheduling, not measured figures. Revise from the first batch's actuals.

| Stage | Condition | Items/hour |
|---|---|---|
| Content review | First batch of a new family, reviewer calibrating on the rule set | 12–15 |
| Content review | Steady state, siblings of a reviewed family, all gates green | 25–40 |
| Content review | Very-hard band (R7, cross-layer) — genuinely requires solving the item | 10–15 |
| Fairness review | Any band; narrower checklist, no solving required | 40–60 |

The dominant cost in content review is criterion C2 — the reviewer must actually solve the item, and a very-hard item takes a competent reviewer a minute or two plus the time to check the other four options. A 144-item pilot bank is therefore roughly **5–8 hours of content review and 3–4 hours of fairness review**, plus rework. Budget two working days of reviewer time per 150-item batch and expect a 10–20% revise-or-reject rate on the first batch from any new family, dropping sharply once family templates are settled.

Two throughput levers that are worth having and cheap to build: the contact-sheet preview (`scripts/cognitive/preview-bank.mjs`) so a reviewer can triage 30 items visually before opening any of them, and keyboard-only approval (`A` approve, `R` revise, `X` reject, `→` next) so steady-state review does not involve the mouse.

### 8.6 Recording sign-off

Neither review stage has a table in plan-architecture.md. Proposed, sitting alongside the other secure-set tables (RLS-denied, service-role only):

```sql
CREATE TYPE item_review_stage    AS ENUM ('content','fairness');
CREATE TYPE item_review_decision AS ENUM ('approve','revise','reject');

CREATE TABLE item_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  item_version  INT  NOT NULL,
  -- The exact bytes reviewed. If the item changes, the sign-off is void.
  content_hash  TEXT NOT NULL,
  battery_version TEXT NOT NULL,
  stage         item_review_stage NOT NULL,
  decision      item_review_decision NOT NULL,
  /** { "C1": true, "C2": true, … } — one key per rubric criterion. */
  rubric        JSONB NOT NULL,
  notes         TEXT,
  reviewer_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reviewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT item_reviews_rubric_object CHECK (jsonb_typeof(rubric) = 'object')
);
CREATE INDEX idx_item_reviews_item ON item_reviews(item_id, stage, reviewed_at DESC);

ALTER TABLE item_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE item_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE item_reviews TO service_role;
```

The lifecycle guard in plan-architecture.md §1.2.3 gains two clauses:

```sql
-- draft -> content_reviewed requires an approve at the CURRENT content_hash.
IF NEW.lifecycle_state = 'content_reviewed' AND OLD.lifecycle_state = 'draft' THEN
  IF NOT EXISTS (
    SELECT 1 FROM item_reviews r
    WHERE r.item_id = NEW.id AND r.stage = 'content'
      AND r.decision = 'approve' AND r.content_hash = NEW.content_hash
  ) THEN
    RAISE EXCEPTION 'item % has no content-review approval at hash %', NEW.id, NEW.content_hash;
  END IF;
END IF;

-- content_reviewed -> fairness_reviewed requires a DIFFERENT reviewer.
IF NEW.lifecycle_state = 'fairness_reviewed' AND OLD.lifecycle_state = 'content_reviewed' THEN
  IF NOT EXISTS (
    SELECT 1 FROM item_reviews f
    JOIN item_reviews c ON c.item_id = f.item_id AND c.stage = 'content'
                       AND c.decision = 'approve' AND c.content_hash = NEW.content_hash
    WHERE f.item_id = NEW.id AND f.stage = 'fairness'
      AND f.decision = 'approve' AND f.content_hash = NEW.content_hash
      AND f.reviewer_id <> c.reviewer_id
  ) THEN
    RAISE EXCEPTION 'item % needs an independent fairness approval at hash %',
      NEW.id, NEW.content_hash;
  END IF;
END IF;
```

Binding sign-off to `content_hash` is the point. An item edited after approval loses its approval automatically — there is no way to approve an item and then quietly change it, because the frozen-content trigger already forbids editing at `calibrated`/`operational`/`retired`, and at `draft`/`content_reviewed` a content change invalidates the hash the approval was recorded against.

`decision = 'revise'` writes a row and leaves the item at `draft` with the notes attached. Revision means regenerating with a different seed or amending the family template — never hand-editing a spec, because a hand-edited spec is not reproducible from `(generator_version, git_sha, seed, params)` and breaks the provenance contract.

---

## 9. Bank management

### 9.1 How many items, at each stage

| Stage | Families | Siblings/family | Items | What it supports |
|---|---|---|---|---|
| **Exemplar fixtures** | 8 | 1 | 8 | Pins the renderer and the QA battery independently of the generator (plan-architecture.md §6) |
| **Pilot pool** | 18 | 8 | 144 | doc 03 §12 Stage 2's "6–10 clones per family, ≈ 120 matrix items", administered in linked counterbalanced booklets |
| **Operational form** | 18 | 1 each | 18 | doc 03 §2 form length. One sibling per family per form — never two siblings in the same sitting |
| **Parallel forms at launch** | 18 | 2 | 36 in rotation | Two forms; a third and fourth held back as unexposed reserve |
| **Exposure-controlled bank** | 36–54 | 4–6 | 150–300 | Band-stratified sampling with family-level exposure caps (§9.4) |

The 18 families are not 18 arbitrary items. They are the cells of a blueprint that has to cover doc 03 §4.4's four bands with enough families per band that the assembler has a choice:

| Band | Predicted b | Form slots | Families needed (pilot) | Families needed (exposure-controlled) |
|---|---|---|---|---|
| Easy | b < −1.0 | 4 | 4 | 8 |
| Moderate | −1.0 ≤ b < +0.5 | 5 | 5 | 12 |
| Hard | +0.5 ≤ b < +1.5 | 6 | 6 | 18 |
| Very hard | b ≥ +1.5 | 3 | 3 | 8 |
| | | **18** | **18** | **46** |

Doc 03's eight exemplars cover four of these cells and give the pattern for the rest; the remaining ten families are new authoring work (§10). Note that under the §4.4 weights as written, reaching `very_hard` requires R7 plus a second rule plus cross-layer mapping — the very-hard cell is narrow, which is the practical form of open question OQ-1.

**A hard constraint on form assembly.** One sibling per family per form. Two clones of the same template in one sitting create local response dependence: they share surface structure, so a candidate who cracks one has a shortcut into the other. The consequence — inflated internal-consistency estimates — is exactly the kind of thing that makes a headline reliability figure optimistic, and it is avoidable at zero cost by a constraint in the assembler. Enforced as a check in `participant_section_forms` assembly and asserted in an integration test.

### 9.2 Families and isomorphs

- A **family** is a `FamilyTemplate`: fixed radicals, fixed rule set, declared incidental space. It is the row in `item_families`, and its `code` (`LRM-2R-XLAYER`) is stable for the life of the bank.
- A **sibling** (isomorph, clone) is one draw from the family's incidental space. It is a row in `items` with `family_id` set, `parent_item_id` pointing at the family's exemplar, and its own `content_hash`.
- Siblings are **not** parallel items and must never be described as such. They share radicals by construction; whether they share difficulty is an empirical question that doc 03 §12 Stage 2's LLTM regression is designed to answer. The defensible statement is that siblings share a *designed radical profile* — and the bank's data model deliberately keeps them as distinct items with distinct parameters rather than collapsing them to a family-level parameter.
- Because of that, `item_parameters` are per-item from the start, not per-family. If the pilot shows within-family variance is negligible, family-level pooling can be introduced later; the reverse migration (splitting a pooled parameter back out) is not possible.
- The exemplar of a family (`item_families.exemplar_item_id`) is the hand-written fixture, not a generated sibling. It is the reference the renderer and battery tests pin against, and it may or may not be operational.

### 9.3 Duplicate detection

Two hashes, both stored on `items` and `cognitive_item_specs`:

**`content_hash`** — `sha256(canonicalJson({ spec, generatorVersion, renderStyleVersion }))`. Exact-duplicate detection, and the value the review sign-off and the frozen-form snapshot bind to.

**`structural_hash`** — the same spec canonicalised *up to the incidental symmetry group*, so that two siblings which are the same item under a reflection collide even though their specs differ:

```ts
// src/lib/cognitive/spec/hash.ts
export function structuralHash(spec: FiguralMatrixSpec): string {
  const orbit: string[] = []
  for (const reflect of ['none', 'horizontal', 'vertical', 'both'] as const) {
    for (const rotate of [0, 90, 180, 270] as const) {
      for (const relabel of shapeRelabellings(spec)) {      // ≤ 6 for a 3-shape set
        const t = applySymmetry(spec, { reflect, rotate, relabel })
        orbit.push(canonicalJson(stripIncidentals(t)))
      }
    }
  }
  orbit.sort()                       // lexicographically smallest = orbit representative
  return sha256(orbit[0])
}
```

At most 4 × 4 × 6 = 96 transforms, each a cheap object rewrite — under a millisecond. `stripIncidentals` removes absolute sizes, stroke weights and the key's slot position, so the hash captures *structure* only.

Gate G-13 rejects a candidate whose `structural_hash` already exists **within its family** (a genuine near-repeat) and *warns* on a collision across families (usually a sign that two family templates have converged and one should be retired). Cross-family collisions go into `cognitive_generation_runs.qa_summary` for a human to look at rather than blocking the run.

### 9.4 Lifecycle and exposure

The lifecycle states and transitions are plan-architecture.md §1.1/§1.2.3. What this document adds is what each transition *means* operationally:

| State | Meaning | Entry condition |
|---|---|---|
| `draft` | Generated, all 17 gates green, unreviewed | `generateFamily` wrote it |
| `content_reviewed` | A qualified reviewer approved it at this hash | §8.6 trigger |
| `fairness_reviewed` | An independent reviewer approved fairness at this hash | §8.6 trigger |
| `piloting` | Eligible for pilot booklets only. Never in an operational form | Manual, batch-level |
| `calibrated` | Has parameters from a completed calibration run. Content frozen | `item_parameters` row exists for the current `calibration_run` |
| `operational` | Eligible for operational form assembly | Manual promotion; requires `calibrated` |
| `suspended` | Temporarily withdrawn — drift flag, battery-version failure, DIF flag, exposure cap breached | Automatic or manual |
| `retired` | Permanently withdrawn. Kept for audit; never assembled | Manual |
| `killed` | Rejected before piloting; kept only so its seed is not regenerated | From `draft` or `piloting` |

**Exposure is budgeted at family level, not item level.** A candidate who has seen one sibling has effectively seen the family: the radicals are identical and the rule set is identical, so retest exposure transfers almost entirely. Two mechanisms:

```sql
-- Per-family exposure counters, maintained by the form assembler.
ALTER TABLE item_families
  ADD COLUMN exposure_count      BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN exposure_cap        BIGINT,          -- NULL = uncapped
  ADD COLUMN last_exposed_at     TIMESTAMPTZ;

-- Per-candidate family history, so a retest never repeats a family.
CREATE TABLE participant_family_exposures (
  participant_id UUID NOT NULL,
  family_id      UUID NOT NULL REFERENCES item_families(id) ON DELETE RESTRICT,
  item_id        UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  session_id     UUID NOT NULL REFERENCES participant_sessions(id) ON DELETE CASCADE,
  exposed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, family_id, session_id)
);
CREATE INDEX idx_pfe_participant ON participant_family_exposures(participant_id, family_id);
```

The assembler's rule, in order:

1. Exclude every family in this participant's `participant_family_exposures` (doc 03 §9 rule 8: identical sibling items are never served to the same candidate across retests — strengthened here from sibling to family).
2. Fill each band's slots from the eligible families, preferring the lowest `exposure_count` within band.
3. Within the chosen family, pick the sibling with the lowest `exposure_count`, excluding any the participant has seen.
4. Refuse to assemble and raise an operational alert if any band cannot be filled — do not silently substitute a family from an adjacent band, because that changes what the form is.

**The arithmetic, honestly.** With 18 families and 18 slots, every family appears in every sitting and the family-level exposure rate is 1.0 — there is no exposure control at all, only incidental randomisation and sibling rotation. Meaningful exposure control needs *more families than slots*: with F families sampled uniformly into 18 slots, the family exposure rate is 18/F. Reaching 0.5 needs 36 families; reaching 0.33 needs 54. This is why §9.1's exposure-controlled row lists 36–54 families, and why the honest position at launch is that exposure control is weak and rests on the bank growing. That should be stated in the technical manual rather than implied away.

**Bank refresh.** Each refresh generates a new batch under a new run, reviews it, pilots it seeded into live sittings, and promotes on calibration. Retiring a family retires all its siblings together — retiring one sibling while its siblings stay operational leaves the family's exposure history and its calibration pooling inconsistent.

---

## 10. What to build first

The temptation is to build the general grammar-driven composer — an engine that enumerates the rule space, composes arbitrary rule sets onto arbitrary layer bindings, and generates the whole bank from a blueprint. That is the right end state and the wrong first move. It is several thousand lines, most of its generality is unexercised until the blueprint is settled, and none of it is needed to put 144 items in front of a pilot.

### 10.1 The minimum that unblocks a pilot

Everything here is required. Nothing here is optional.

| # | Deliverable | Why it cannot be deferred |
|---|---|---|
| 1 | `spec/schema.ts`, `canonical.ts`, `hash.ts` (content hash), `project.ts` | The spec format is the interface between generation, storage, delivery and QA. Every other piece depends on it, and changing it later is a data migration |
| 2 | `render/` — geometry, primitives, `matrix-svg.ts`, palette | Needed by delivery, by the QA render gate, and by the reviewer UI. Only the primitives M1–M8 use: circle, square, triangle, diamond, pentagon, arrow, tick, bars, dots, repeat-layout, hatch |
| 3 | The eight exemplar fixtures, hand-written to the schema | They pin the renderer and the battery independently of the generator. They are also the reviewer's calibration set |
| 4 | `generator/axes.ts`, `rules.ts` — R1, R2, R4, R5, R6, R7 only | The six rules the eight exemplar families use. **R3 (movement), R8 and R9 as standalone rules are deferred** — R8/R9 appear only as ladders under R1/R6, which `progression` and `latinSquare` already cover |
| 5 | `qa/uniqueness.ts` — Level A and Level B, with the full accidental-regularity probe set | The highest-value gate, and only ~250 lines given the factorisation. Building the pipeline without it means piloting items that may have two defensible answers, which is unrecoverable — the pilot data would be uninterpretable and the money spent |
| 6 | `qa/contextblind.ts` | Six of eight exemplars fail it. Without this gate the bank ships with a systematic option-only leak |
| 7 | `distractors.ts` — the four label generators plus the solver gate plus `repairBalance` | doc 03's distractor grammar is a design requirement, and the labels are what make the pilot's distractor-trace analysis interpretable |
| 8 | `qa/degeneracy.ts`, `qa/density.ts`, `qa/duplicates.ts` (content hash only) | Degeneracy and density are what stop ugly and broken items. Content-hash duplicate detection is trivial |
| 9 | `difficulty.ts` | Two dozen lines, and it is what stops predicted-b values being typed by hand |
| 10 | Eight `families/*.ts` templates for M1–M8, plus ten more to fill the blueprint | This is the real work. Each template is 60–120 lines of declarative parameterisation, not general machinery |
| 11 | `scripts/cognitive/generate-matrix-bank.mjs` and `preview-bank.mjs` | The CLI and the reviewer contact sheet |
| 12 | `item_reviews` table, the two lifecycle-guard clauses, and the reviewer UI | Sign-off is a gate, and an ungated bank cannot be promoted |

**Deliberately deferred, with the reason:**

| Deferred | Why it is safe to defer |
|---|---|
| The general grammar-driven composer | Family templates cover the whole pilot blueprint. The composer earns its keep at bank generation 2, once the LLTM regression says which radicals actually move difficulty and which parts of the space are worth searching |
| `structural_hash` (§9.3) | Content-hash collision plus the reviewer's sibling-thumbnail panel (C10) catches near-repeats at 144 items. It becomes necessary at 300+ |
| R3 movement rules | No exemplar uses them; adding a family later is additive |
| Raster pre-baking and per-session watermarking | plan-architecture.md §2.4 already defers this to Phase 2. Inline SVG per request is correct for the pilot |
| Dark-mode rendering | §6.5 — locking to light mode for the pilot removes an uncontrolled presentation variable |
| Family-level parameter pooling | §9.2 — per-item parameters first; pooling is a decision the pilot informs and the reverse is impossible |
| Automated pre-review triage | Worth building later as a filter to save reviewer slots, but it filters and does not certify, and human fairness review stays intact regardless |

### 10.2 Sequencing

Four slices, each independently shippable and independently reviewable.

**Slice 1 — spec and renderer.** Items 1, 2, 3. No database. Deliverable: `npm run preview:matrices` produces an HTML contact sheet of the eight exemplars rendered at 360/768/1280 px in colour and greyscale, with golden-hash tests in CI. This is the slice that gets looked at by a human who will say "the pentagon is wrong" or "the hatch is too tight", and it is much cheaper to hear that now.

**Slice 2 — verification.** Items 5, 6, 8, 9. Still no database. Deliverable: the battery runs over the eight fixtures and produces a `QaReport` for each. **Expect six of eight to fail G-08**, which is the point — the slice is done when the exemplars have been repaired per Appendix A and all eight pass.

**Slice 3 — generation.** Items 4, 7, 10, 11. Deliverable: `node scripts/cognitive/generate-matrix-bank.mjs --seed=… --families=all --clones=8` produces 144 candidate items in memory, writes a contact sheet, and reports per-gate rejection tallies. Reproducibility test: two runs at the same seed produce identical content hashes.

**Slice 4 — persistence and review.** Item 12, plus the write path through the service-role client into `items`, `item_options`, `cognitive_item_specs`, `cognitive_option_specs`, `item_answer_keys`, `item_option_diagnostics`, `cognitive_generation_runs`. Deliverable: a generated bank in the database at `draft`, and a reviewer UI that can move it to `fairness_reviewed`.

Slices 1 and 2 are the ones that must not be rushed, because everything downstream inherits their errors. Slice 3 is mostly declarative authoring once the machinery in 1 and 2 exists.

---

## 11. Open questions

| # | Question | Recommendation |
|---|---|---|
| **OQ-1** | doc 03's stated exemplar b values do not reconcile with its own §4.4 formula (M1 −2.0 vs −1.5, M6 +0.7 vs +0.5, M8 +2.2 vs +0.6). Gate G-14 fails every exemplar as written | Fix the weights, not the stated values. The M8 gap suggests R7 and cross-layer interact rather than add — consider an interaction term, or raise w(R7). Must be settled before family authoring, since the blueprint's band coverage depends on it |
| **OQ-2** | Six of eight exemplars fail the context-blind gate (Appendix A) | Repair per Appendix A and re-issue doc 03's §6 option sets. The exemplars are the reviewer's calibration set and the fixtures the battery pins against; shipping them with a known leak would train reviewers on the wrong standard |
| **OQ-3** | `KEY_EQUALS_CELL` forbids the key duplicating a context cell, which makes "eliminate any option that copies a cell" a free elimination | Recommend permitting full coincidence in a controlled minority (~15%) of items where the rule set allows it, with a gate requiring ≥ 2 cell-copying options in those items so the heuristic cannot isolate. Alternatively accept it and quantify the guess-rate cost (.200 → .250). Needs a decision before the distractor plan is fixed per family |
| **OQ-4** | Hatch pitch 4 canvas units is marginal at DPR 1 (2.9 px gap) | Ship at 4 per doc 03 with gate G-15 measuring it. If G-15 fails on real devices, bump `render_style_version` to v2 with pitch 5 — which is a new-item event, so decide before the pilot bank is generated, not after |
| **OQ-5** | The 18-family pilot bank gives a family exposure rate of 1.0 — no exposure control at launch | Accept for the pilot and state it plainly in the technical manual. Plan the 36-family bank as the first refresh. Do not describe incidental randomisation as exposure control |
| **OQ-6** | Whether the fairness reviewer must be a different person, or merely a different review pass | Recommend a different person, enforced by the trigger in §8.6. If headcount makes that impossible at pilot scale, make it a different *session* at least 24 hours apart and record both timestamps — but the trigger should be written for the strong version and relaxed explicitly, not omitted |
| **OQ-7** | `item_reviews` is not in plan-architecture.md's migration set | Add to Migration B, or a Migration B2. It is a prerequisite for the lifecycle guard clauses and therefore for promoting any item past `draft` |

---

## Appendix A — the eight exemplars against the context-blind gate

Method: for each exemplar, take the five options from doc 03 §6, extract the value on each rule-governed axis, compute the per-axis modal value across the five options (set-valued axes vote per element presence), and compose. If the composition equals the key, a candidate who never looks at the grid recovers the answer.

| Item | Axes | Modal composition | Key | Verdict |
|---|---|---|---|---|
| **M1** | count, shape | count 5 (×2), shape circle (×4) → **5 circles** | 5 circles | **FAIL** |
| **M2** | rotation, element | rotation 270° (×2), element arrow (×4) → **arrow 270°** | arrow 270° | **FAIL** |
| **M3** | shape, fill | shape circle (×3), fill outline (×3) → **outline circle** | outline circle | **FAIL** |
| **M4** | bars {H,V,D1,D2} | H yes (4/5), V yes (3/5), D1 yes (4/5), D2 **no** (2/5) → **{H,V,D1}** | {H,V,D1,D2} | **pass** |
| **M5** | dots {TL,TR,BL,BR,CTR} | TL yes (3), TR no (1), BL no (2), BR yes (4), CTR yes (3) → **{TL,BR,CTR}** | {TL,BR,CTR} | **FAIL** |
| **M6** | outer.shape, inner.rotation | circle (×3), 0° (×3) → **circle, tick 0°** | circle, tick 0° | **FAIL** |
| **M7** | count, fill, shape | count 3 (×4), fill outline (×3), shape circle (×4) → **3 outline circles** | 3 outline circles | **FAIL** |
| **M8** | outer.shape, bars | pentagon (×4); H yes (3), V yes (4), D1 **yes** (3) → **pentagon {H,V,D1}** | pentagon {H,V} | **pass** |

Six of eight fail. The two that pass do so for the same reason: M4 and M8 have a set-valued axis on which the key's element-presence pattern is *not* the majority pattern — M4's key includes D2 where only 2 of 5 options do, and M8's key excludes D1 where 3 of 5 options include it. That is the structural property `repairBalance` is engineering deliberately.

**The failure mode is systematic, not incidental.** It follows directly from a well-intentioned distractor design: if most distractors are near-misses wrong on exactly one axis, then on every axis the key's value is held by all the options that were not perturbed on that axis — a majority. Doc 03 §4.1 explicitly makes near-miss proportion a difficulty radical and §6 M7 leans into it ("three IR + one PM"), so the hardest items are the *most* exposed. M7, the three-rule item, is the worst case in the set: the key is modal on all three axes.

**The repair, applied uniformly.** For a *k*-axis item with four distractors, require the key's value to be held by ≤ 2 of the 5 options on at least ⌈*k*/2⌉ axes. Achieved by making two distractors agree on the *same* wrong value for one axis, rather than each being wrong on a different axis. This costs nothing in distractor quality — the labels and mechanisms are unchanged — and it is the reason `repairBalance` mutates rather than regenerates.

Worked for M7 (key = 3 outline circles; axes count, fill, shape):

| Slot | doc 03 as written | Repaired | Label | Mechanism |
|---|---|---|---|---|
| A | 3 hatched circles | 3 hatched circles | PM | `chimera:{fill←R2C2, shape←R2C2}` |
| B | 2 outline circles | 2 hatched circles | IR | `stall:count@prevColumn` + fill moved to hatched |
| C | 3 solid circles | 3 solid triangles | IR | `stall:fill@prevColumn` + shape moved to triangle |
| **D** | **3 outline circles** | **3 outline circles** | **KEY** | — |
| E | 3 outline triangles | 3 outline triangles | IR | `stall:shape@prevRow` |

Repaired tallies — count: 3 (×4), 2 (×1) → modal 3 = key value, but this is the one axis where the key stays modal. Fill: hatched (×2), outline (×2), solid (×1) → tied, key value held by 2. Shape: circle (×2), triangle (×2)... with A, B circles and C, E triangles plus D circle, that is circle ×3, triangle ×2 — key value held by 3, still modal.

That is not yet sufficient: ⌈3/2⌉ = 2 axes need the key value at ≤ 2, and only fill qualifies. A second pass moves A from `3 hatched circles` to `3 hatched triangles` (still a legitimate PM — it takes fill from R2C2 and shape from R3C2), giving shape: circle ×2 (B, D), triangle ×3 (A, C, E) → key value held by 2. Two axes now qualify, and the modal composition is `3 hatched triangles`, which is option A, not the key.

This is exactly the loop `repairBalance` runs, and it is why the repair is iterative rather than a single closed-form adjustment: moving one axis off the key's value can push another axis onto it, and the gate has to be re-evaluated after each move.
