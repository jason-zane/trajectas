import 'server-only'
import { z } from 'zod'

/**
 * Structured item spec schema for figural-matrix (LR-M) cognitive items.
 *
 * Normative source: docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
 * 03-item-generation-pipeline.md §2.2, encoding the notation in
 * docs/superpowers/specs/2026-08-12-cognitive-assessments/03-logical-reasoning-design.md §5.1
 * (cell canvas, anchors, attribute vocabulary).
 *
 * Deviation from doc 03 (item-generation-pipeline) §2.2, found by checking the
 * REAL, already-applied migration (20260813100500_cognitive_item_bank.sql)
 * rather than trusting the design doc, per the LR-4 issue instructions:
 *
 *   The doc's `FiguralMatrixSpec` is a single object embedding `options` (5
 *   OptionSpec) alongside `grid`/`rules`/`radicals`/`render`. But the actual
 *   schema splits storage across TWO tables:
 *     - `cognitive_item_specs.spec`   — one row per item. Its CHECK constraint
 *       (`cognitive_item_specs_shape`) only requires `spec ? 'grid'` — it does
 *       NOT require an `options` key.
 *     - `cognitive_option_specs.spec` — one row PER OPTION (option_id PK,
 *       FK to item_options), holding that option's own `{slot, elements}`.
 *   This is the more coherent design: per-sitting option shuffling
 *   (doc 02 §1.3.1's `optionOrder`) and option identity already live on
 *   `item_options` rows, so keying each option's content spec by
 *   `item_options.id` avoids a duplicate, potentially-drifting copy of the
 *   same five options inside the item's own JSON blob.
 *
 *   This module therefore exports `FiguralMatrixItemSpec` (grid/rules/
 *   radicals/render — what `cognitive_item_specs.spec` actually stores) and
 *   `CognitiveOptionSpec` (slot/elements — what each `cognitive_option_specs`
 *   row actually stores) as the two normative, independently-`.strict()`
 *   schemas, plus a `FiguralMatrixSpec` convenience type (item spec + the 5
 *   option specs together) for fixtures/tests and any future single-document
 *   authoring tool. Every field-level vocabulary item (ShapeId, Fill, Anchor,
 *   Element variants, RuleSpec, Radicals, RenderDirectives) is unchanged from
 *   the doc.
 *
 * Security property (doc 02 §2.1): `.strict()` on every object means an
 * unknown key — `key`, `answer`, `correctOption`, `keyIndex`, `solution`,
 * `isCorrect`, or anything else — fails validation at write time. That is
 * belt-and-braces alongside the DB's `cognitive_item_specs_no_key` CHECK
 * constraint; this module is the normative definition, per the issue scope.
 */

// ---------------------------------------------------------------------------
// Closed vocabulary (doc 03-logical-reasoning-design.md §5.1)
// ---------------------------------------------------------------------------

/**
 * Shape vocabulary. The first six are the v1 set (doc 03-logical-reasoning-
 * design.md §5.1). The v3 build plan (2026-08-19, §2) widened it so two items
 * of one family rarely share a shape set and so reflection (R10) has glyphs
 * whose mirror images are visibly distinct:
 *   - `hexagon`, `star`, `cross` — symmetric (orders 6, 5, 4), shape-set filler;
 *   - `semicircle` — a half-disc, flat edge down at rotation 0 (one mirror axis);
 *   - `flag` — a pole with a pennant to the upper right (no symmetry);
 *   - `lshape` — an L with a tall stem and a SHORT foot to the right (no
 *     symmetry — equal arms would be mirror-symmetric about the diagonal,
 *     collapsing the D4 orbit from eight orientations to four);
 *   - `trapezoid` — a right trapezoid, vertical left side, slanted right side
 *     (no symmetry).
 * Render geometry for each lives in render/primitives.ts; rotational-symmetry
 * orders in qa/degeneracy.ts; analytic ink areas in qa/density.ts.
 */
export const ShapeId = z.enum(['circle', 'square', 'triangle', 'diamond', 'pentagon', 'arrow', 'hexagon', 'star', 'cross', 'semicircle', 'flag', 'lshape', 'trapezoid'])
export type ShapeId = z.infer<typeof ShapeId>

export const BarId = z.enum(['H', 'V', 'D1', 'D2'])
export type BarId = z.infer<typeof BarId>

/** `grey` (v3) is a fourth fill, rendered at a fixed mid tone between paper and
 *  ink; the density ladder is outline < hatched < grey < solid. */
export const Fill = z.enum(['outline', 'solid', 'hatched', 'grey'])
export type Fill = z.infer<typeof Fill>

/**
 * Orientation state of a shape under the dihedral group D4 (v3, rule R10).
 * Applied AFTER `rotation`, about the element's own anchor point:
 *   reflections — `h` mirrors left-right (about the vertical axis), `v`
 *   top-bottom (horizontal axis), `d1` about the TL–BR diagonal, `d2` about
 *   the TR–BL diagonal;
 *   rotations   — `r90` / `r270` quarter turns clockwise, `hv` a half turn
 *   (= h then v).
 * Eight states, closed under composition (`rules.ts` `composeFlip`), so a
 * glyph with no symmetry has eight visibly distinct orientations — enough for
 * a six-option item whose only rule is a reflection. `rotation` is kept at 0
 * on the axis a reflection rule governs; mixing the two would let one image
 * have two spec encodings (hv ≡ rotation 180).
 */
export const Flip = z.enum(['none', 'h', 'v', 'hv', 'd1', 'd2', 'r90', 'r270'])
export type Flip = z.infer<typeof Flip>

/** Stroke kinds for the `strokes` element (v3): four straight strokes through
 *  the centre plus two half-circle arcs (bowing up / bowing down), all
 *  spanning 70 units so a stroke figure fills the cell. */
export const StrokeId = z.enum(['H', 'V', 'D1', 'D2', 'ARC_T', 'ARC_B'])
export type StrokeId = z.infer<typeof StrokeId>

/** Ring names for the `nest` element (v3): three concentric containers,
 *  largest to smallest. */
export const RingId = z.enum(['R1', 'R2', 'R3'])
export type RingId = z.infer<typeof RingId>

export const SizeToken = z.enum(['S', 'M', 'L'])
export type SizeToken = z.infer<typeof SizeToken>

export const Anchor = z.enum(['TL', 'TR', 'BL', 'BR', 'CTR'])
export type Anchor = z.infer<typeof Anchor>

export const LayerName = z.enum(['outer', 'inner', 'satellite'])
export type LayerName = z.infer<typeof LayerName>

/** Rotation is degrees clockwise from canonical (0deg = apex/point up). */
const Rotation = z.number().int().min(0).max(359)

// ---------------------------------------------------------------------------
// Elements — exactly one of the five drawable variants.
// ---------------------------------------------------------------------------

export const ShapeElement = z
  .object({
    type: z.literal('shape'),
    layer: LayerName,
    shape: ShapeId,
    fill: Fill,
    size: SizeToken,
    anchor: Anchor,
    rotation: Rotation.default(0),
    /** Optional (absent = 'none') so the v1/v2 banks and every existing
     *  family literal stay valid unchanged; read through `?? 'none'`. */
    flip: Flip.optional(),
  })
  .strict()

export const TickElement = z
  .object({
    type: z.literal('tick'),
    layer: LayerName,
    /** Length in canvas units from CTR outward. */
    length: z.number().int().min(10).max(45),
    rotation: Rotation,
  })
  .strict()

export const BarsElement = z
  .object({
    type: z.literal('bars'),
    layer: LayerName,
    /** Canonically sorted H < V < D1 < D2 at read time — see canonical.ts. */
    bars: z.array(BarId).min(1).max(4),
    /** Clip bar geometry to the outer layer's shape in the same cell (doc 03 M8). */
    clipToOuter: z.boolean().default(false),
  })
  .strict()

export const DotsElement = z
  .object({
    type: z.literal('dots'),
    layer: LayerName,
    /** Canonically sorted TL < TR < BL < BR < CTR at read time. */
    anchors: z.array(Anchor).min(1).max(5),
    fill: Fill.default('solid'),
    size: SizeToken.default('S'),
  })
  .strict()

export const RepeatElement = z
  .object({
    type: z.literal('repeat'),
    layer: LayerName,
    shape: ShapeId,
    fill: Fill,
    size: SizeToken,
    /**
     * 1-6, laid out per doc 03 §5.1's count convention (4 = 2+2, 5 = 3+2,
     * 6 = 3+3). Cap raised from 5 to 6 by issue #344: doc 03's own worked M1
     * (§6) specifies a "6 solid circles" wrong-rule distractor (option D,
     * "assumes the step size itself grows"), which a cap of 5 made
     * unrepresentable — collapsing M1's distractor grammar to two
     * perceptual-match distractors and zero wrong-rule distractors. Six is
     * still subitisable when arranged 3+3, consistent with doc 03's own
     * convention for laying out multi-element cells, and re-checked against
     * qa/density.ts's ink-coverage ceiling (six S-sized circles cover
     * ~0.29 of the canvas, comfortably under the 0.38 INK_MAX gate).
     */
    count: z.number().int().min(1).max(6),
    rotation: Rotation.default(0),
  })
  .strict()

/**
 * BitgridElement — a 3×3 mini-grid filling one cell (doc 2026-08-19-cognitive-v2-build-plan.md §4).
 * Each of 9 mini-cells is rendered as empty (outline only), black (solid fill),
 * or hatched (cross-hatch pattern). Two independent set-valued axes: black and hatched.
 * Positions 0–8 are indexed row-major (top-left = 0, top-right = 2, bottom-right = 8).
 * The schema enforces disjoint sets: no position can be both black AND hatched.
 */
export const BitgridElement = z
  .object({
    type: z.literal('bitgrid'),
    layer: z.literal('outer'),
    /** Set of mini-cell positions (0–8) to fill with solid black. Canonical ascending order. */
    black: z.array(z.number().int().min(0).max(8)).default([]),
    /** Set of mini-cell positions (0–8) to fill with cross-hatch. Canonical ascending order. */
    hatched: z.array(z.number().int().min(0).max(8)).default([]),
  })
  .strict()
  .refine(
    (el) => {
      const blackSet = new Set(el.black)
      return !el.hatched.some((x) => blackSet.has(x))
    },
    { message: 'bitgrid black and hatched sets must be disjoint' },
  )

/**
 * StrokesElement (v3 build plan §2) — a set of large strokes drawn without a
 * frame, for the stroke-figure families. Set-valued `strokes` axis; the same
 * set-operator machinery `inner.bars` already exercises.
 */
export const StrokesElement = z
  .object({
    type: z.literal('strokes'),
    layer: LayerName,
    /** Canonically sorted H < V < D1 < D2 < ARC_T < ARC_B at read time. */
    strokes: z.array(StrokeId).min(1).max(6),
  })
  .strict()

/**
 * NestElement (v3 build plan §2) — up to three concentric containers, R1
 * (largest, 64 units) ⊃ R2 (44) ⊃ R3 (24), always centred. `rings` is the
 * set of containers present (the set-valued axis union/intersection rules
 * act on); each ring's shape and fill are fixed per item by `ringShapes`/
 * `ringFills`, indexed R1, R2, R3, so a ring looks the same wherever it
 * appears and the only thing that varies is WHICH rings are there.
 */
/** Shapes whose inscribed region contains the next ring down at the fixed
 *  ring widths (64/44/24) — a triangle or star would clip the ring inside it. */
export const NestRingShape = z.enum(['circle', 'square', 'diamond', 'hexagon'])
export type NestRingShape = z.infer<typeof NestRingShape>

export const NestElement = z
  .object({
    type: z.literal('nest'),
    layer: z.literal('outer'),
    /** Canonically sorted R1 < R2 < R3 at read time. */
    rings: z.array(RingId).min(1).max(3),
    ringShapes: z.tuple([NestRingShape, NestRingShape, NestRingShape]),
    /** R1 and R2 must be outline so they never hide the ring inside; R3 may carry any fill. */
    ringFills: z.tuple([z.literal('outline'), z.literal('outline'), Fill]),
  })
  .strict()

export const Element = z.discriminatedUnion('type', [
  ShapeElement,
  TickElement,
  BarsElement,
  DotsElement,
  RepeatElement,
  BitgridElement,
  StrokesElement,
  NestElement,
])
export type Element = z.infer<typeof Element>

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

export const Cell = z
  .object({
    /** Ordered back-to-front: outer, then inner, then satellite (canonical.ts
     *  re-sorts defensively at render time — see render/matrix-svg.ts). */
    elements: z.array(Element).min(1).max(4),
  })
  .strict()

export const GridCell = Cell.extend({
  row: z.number().int().min(1).max(3),
  col: z.number().int().min(1).max(3),
}).strict()
export type GridCell = z.infer<typeof GridCell>

/** Six slots from v3 (2026-08-19 v3 build plan §1); items generated before
 *  that carry five (A–E) and stay valid — option count is a per-item fact. */
export const OptionSlot = z.enum(['A', 'B', 'C', 'D', 'E', 'F'])
export type OptionSlot = z.infer<typeof OptionSlot>

export const OptionSpec = Cell.extend({
  slot: OptionSlot,
}).strict()
export type OptionSpec = z.infer<typeof OptionSpec>

// ---------------------------------------------------------------------------
// Rules / radicals — descriptive metadata for QA, LLTM feature extraction and
// the audit trail. NEVER delivered to a client — see spec/project.ts.
// ---------------------------------------------------------------------------

/** R0–R9 per doc 03-logical-reasoning-design.md §3; R10 reflection, R11
 *  intersection, R12 count arithmetic added by the v3 build plan §2. */
export const RuleId = z.enum(['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12'])
export type RuleId = z.infer<typeof RuleId>

export const RuleParamValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
])

export const RuleSpec = z
  .object({
    id: RuleId,
    /** '<layer>.<attribute>' — the axis this rule owns. Doc 03 (item-gen) §3
     *  invariant 2: no two rules in one item may claim the same axis. */
    axis: z.string().regex(/^(outer|inner|satellite)\.[a-z][a-zA-Z]*$/),
    /** Reading directions in which the rule is asserted to hold. */
    direction: z.enum(['row', 'column', 'both', 'row_operator', 'column_operator']),
    params: z.record(z.string(), RuleParamValue),
    /** Human-readable, for the reviewer panel and the audit trail. */
    statement: z.string().min(8).max(240),
  })
  .strict()
export type RuleSpec = z.infer<typeof RuleSpec>

export const Radicals = z
  .object({
    ruleCount: z.number().int().min(1).max(3),
    ruleIds: z.array(RuleId).min(1).max(3),
    crossLayer: z.boolean(),
    /** 0 = sparse, 1 = neutral, 2 = dense-but-capped. Capped at 1 in this
     *  instrument (perceptual organisation held at neutral, doc 03 §4.1). */
    perceptualLoad: z.number().int().min(0).max(2),
    elementTypes: z.number().int().min(2).max(5),
    nearMissCount: z.number().int().min(0).max(4),
  })
  .strict()
export type Radicals = z.infer<typeof Radicals>

// ---------------------------------------------------------------------------
// Render directives
// ---------------------------------------------------------------------------

export const RenderDirectives = z
  .object({
    styleVersion: z.literal('v1'),
    canvas: z.literal(100),
    strokeWidth: z.number().min(1.5).max(3),
    hatchPitch: z.number().min(4).max(6),
    minElementUnits: z.number().min(8),
  })
  .strict()
export type RenderDirectives = z.infer<typeof RenderDirectives>

// ---------------------------------------------------------------------------
// The grid (8 cells; R3C3 is always the blank/response cell)
// ---------------------------------------------------------------------------

export const Grid = z
  .object({
    rows: z.literal(3),
    cols: z.literal(3),
    blank: z.object({ row: z.literal(3), col: z.literal(3) }).strict(),
    /** Exactly 8 cells; the blank is omitted. Canonically row-major. */
    cells: z.array(GridCell).length(8),
  })
  .strict()
export type Grid = z.infer<typeof Grid>

// ---------------------------------------------------------------------------
// Item-level spec — what `cognitive_item_specs.spec` stores.
// ---------------------------------------------------------------------------

export const FiguralMatrixItemSpec = z
  .object({
    specVersion: z.literal(1),
    kind: z.literal('figural_matrix'),
    grid: Grid,
    rules: z.array(RuleSpec).min(1).max(3),
    radicals: Radicals,
    render: RenderDirectives,
  })
  .strict()
  // Belt-and-braces alongside the DB CHECK (cognitive_item_specs_no_key):
  // reject any top-level key-shaped property outright, in case a future
  // widening of this schema ever adds an object type permissive enough to
  // carry one under a plausible name.
  .refine(
    (spec) =>
      !('key' in spec) &&
      !('answer' in spec) &&
      !('correctOption' in spec) &&
      !('keyIndex' in spec) &&
      !('solution' in spec),
    { message: 'spec must not carry key-shaped fields' },
  )
export type FiguralMatrixItemSpec = z.infer<typeof FiguralMatrixItemSpec>

// ---------------------------------------------------------------------------
// Option-level spec — what each `cognitive_option_specs` row stores.
// ---------------------------------------------------------------------------

export const CognitiveOptionSpec = OptionSpec
export type CognitiveOptionSpec = z.infer<typeof CognitiveOptionSpec>

// ---------------------------------------------------------------------------
// Combined convenience shape — fixtures, tests, and any future
// single-document authoring/import tool. NOT a storage shape.
// ---------------------------------------------------------------------------

export const FiguralMatrixSpec = FiguralMatrixItemSpec.and(
  // 5 = items generated before v3 (the v1/v2 banks in production); 6 = v3 on.
  z.object({ options: z.array(OptionSpec).min(5).max(6) }),
)
export type FiguralMatrixSpec = z.infer<typeof FiguralMatrixSpec>

/** kind discriminator shared with the DB's `cognitive_spec_kind` enum. */
export const CognitiveSpecKind = z.literal('figural_matrix')
