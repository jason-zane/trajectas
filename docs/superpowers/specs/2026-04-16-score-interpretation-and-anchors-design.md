# Score Interpretation Card, Anchor Definitions & Band Configuration

**Date:** 2026-04-16
**Status:** Draft
**Approach:** Incremental (Phase 1: anchors + new card, Phase 2: N-band configuration)

---

## Overview

Three related enhancements to the report scoring system:

1. **Anchor definitions** — short sentences describing what low and high scores mean for each construct, factor, and dimension
2. **Score interpretation card** — a new, compact block type for consultants that shows scores with bars, band labels, and anchor sentences
3. **Customisable band configuration** — replace the hardcoded 3-band system with N configurable ranges (deferred to Phase 2)

Phase 1 delivers anchors and the new card. Phase 2 delivers N-band configuration. The designs are independent — Phase 1 works on the current band system, and Phase 2 extends it without breaking anything.

---

## Phase 1A: Anchor Definitions

### Data Model

Two new nullable text columns on each taxonomy entity table (`dimensions`, `factors`, `constructs`):

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `anchor_low` | `text` | nullable, max 150 chars | Short sentence: what a low score means |
| `anchor_high` | `text` | nullable, max 150 chars | Short sentence: what a high score means |

**No `anchor_mid`.** Anchors describe the poles of the scale; mid is implied.

These sit alongside the existing fields: `definition`, `description`, `indicators_low`, `indicators_mid`, `indicators_high`.

### TypeScript Types

Add to `Dimension`, `Factor`, and `Construct` in `database.ts`:

```ts
anchorLow?: string
anchorHigh?: string
```

Add to `ConstructConfigOverride` (the snapshot stored with generation runs):

```ts
anchorLow?: string
anchorHigh?: string
```

### Library UI

The anchor fields are edited on the entity detail/edit form (same place as `definition`, `description`, and indicator fields). Two text inputs:

- **Low Anchor** — placeholder: "e.g. Tends to feel overwhelmed under pressure"
- **High Anchor** — placeholder: "e.g. Remains composed and focused during setbacks"

Character limit enforced via `maxLength={150}` on both inputs and a `CHECK` constraint on the database columns. Optional — null means no anchor to display.

No changes to the library table views (these remain assignment/toggle views).

### Sample Data

`PreviewEntity` in `sample-data.ts` gains `anchorLow?: string` and `anchorHigh?: string`. The `generateSampleData` function populates these with example anchor text for preview rendering.

---

## Phase 1B: Score Interpretation Block

### Block Registration

New block type `score_interpretation` in the `score` category of `BLOCK_REGISTRY`:

```ts
score_interpretation: {
  label: 'Score Interpretation',
  category: 'score',
  description: 'Compact consultant reference: scores with bars, band labels, and low/high anchor sentences.',
  defaultConfig: {
    displayLevel: 'factor',
    groupByDimension: true,
    showScore: true,
    showBandLabel: true,
    showAnchors: true,
  },
  supportedModes: ['open', 'featured'],
  defaultMode: 'open',
}
```

No `supportedCharts` — this block uses a fixed bar style (filled bar with score marker dot).

### Data Shape

```ts
interface ScoreInterpretationConfig {
  displayLevel: 'dimension' | 'factor' | 'construct'
  groupByDimension: boolean
  showScore: boolean
  showBandLabel: boolean
  showAnchors: boolean
}

interface ScoreInterpretationData {
  groups: Array<{
    groupName: string | null
    entities: Array<{
      entityId: string
      entityName: string
      pompScore: number
      bandResult: BandResult
      anchorLow: string | null
      anchorHigh: string | null
    }>
  }>
  config: ScoreInterpretationConfig
}
```

### Render Component Layout

Each factor renders as (Option B from brainstorming):

1. **Name row:** Factor name (left-aligned), band badge + score (right-aligned)
2. **Bar:** Full-width filled bar with score marker dot, coloured by band
3. **Anchors** (when `showAnchors` enabled): Low anchor text (left) and high anchor text (right) beneath the bar ends

**Anchor text overflow:** Anchor text wraps naturally within its half of the bar width. Font size is 9px (matching existing muted labels in the report system). Each anchor is constrained to its half (flex: 1) with no truncation — the 150-char database limit keeps sentences short enough that wrapping stays within 2 lines at print widths.

Factors are grouped under dimension headings (uppercase, tracking-wider, muted colour) when `groupByDimension` is true.

**Missing anchors:** If both `anchorLow` and `anchorHigh` are null for an entity, the anchor row is omitted entirely (no empty space). If only one is null, the non-null side renders and the null side is blank.

**Density target:** 25 factors across 5 dimensions should fit on 1–2 printed pages.

**Print behaviour:** Standard `break-inside-avoid` on each group. The block supports `pageBreakBefore`, `printHide`, and `screenHide` via the existing print panel.

**Featured mode:** Dark variant — white text, inverted badge colours, bar uses featured accent palette. Same layout structure.

### Builder Configuration

Uses existing builder panel patterns:

- **Content panel:** `DisplayLevelSelect` and `groupByDimension` switch (reused from score overview)
- **Content panel toggles:** `showScore`, `showBandLabel`, `showAnchors` (three SwitchField components)
- **Presentation panel:** Mode selector (open/featured only)
- **Headers panel:** Standard eyebrow, heading, description
- **Print panel:** Standard pageBreakBefore, printHide, screenHide

### Sample Data Generation

New case in `generateBlockSampleData`:

```ts
case 'score_interpretation': {
  // 1. Filter entities to those matching config.displayLevel (dimension/factor/construct)
  // 2. Score each entity using bandForScore() (same as score_overview)
  // 3. If groupByDimension: group entities by parentName; else single group with null name
  // 4. For each entity, include anchorLow/anchorHigh from entity data
  // 5. If both anchorLow and anchorHigh are null, entity still included (anchors row omitted at render time)
  // Returns: ScoreInterpretationData { groups, config }
}
```

---

## Phase 1C: Score Overview — Anchor Toggle

### Configuration Change

Add to `ScoreOverviewConfig`:

```ts
showAnchors: boolean  // default false
```

### Render Behaviour

When `showAnchors` is true, each score entry in bar, gauge, and scorecard views gets low/high anchor text displayed beneath the bar (same visual treatment as the interpretation card).

**Not applicable to radar chart** — no sensible position for anchor text on a radar. The `showAnchors` toggle is hidden in the builder when chart type is `radar`. The config value is preserved when hidden (not reset to false), so switching back from radar to bar restores the previous setting without data loss.

### Builder Change

New `SwitchField` in the score overview content panel: "Show Anchors". Conditionally hidden (not removed) when `chartType === 'radar'`.

### Why Phase 1C is included

The score overview block already displays scores with bars — adding anchor support here reuses the same anchor rendering logic built for the interpretation card. Shipping them together means the anchor data is immediately useful in both blocks. The implementation cost is one additional `SwitchField` toggle and passing anchor data through the existing score overview data pipeline.

---

## Phase 2: N-Band Configuration (Deferred)

Documented here as a design outline to ensure Phase 1 doesn't create conflicts.

### Current State

- 3 fixed bands: `Band = 'low' | 'mid' | 'high'`
- Named fields on entities: `bandLabelLow/Mid/High`, `pompThresholdLow/High`
- Hardcoded defaults in `DEFAULT_BAND_GLOBALS`: thresholds 40/70, labels Developing/Effective/Highly Effective

### Future State

Ordered array of band definitions:

```ts
interface BandDefinition {
  key: string          // e.g. "developing", "emerging", "effective", "highly_effective"
  label: string        // display label
  min: number          // inclusive lower bound (POMP)
  max: number          // inclusive upper bound (POMP)
  colorToken: string   // theme token for badge/bar colouring
}
```

### Cascade

Three-level inheritance: platform default → partner override → template override.

Each level stores a `bandScheme: BandDefinition[] | null`. Null means inherit from parent. Resolution walks up the chain.

**Configuration UI:**
- Platform admin: global settings area
- Partner: partner settings
- Template: template settings panel (alongside existing `displayLevel`, `personReference`, etc.)

### Migration Path

- Existing named fields (`bandLabelLow`, `pompThresholdLow`, etc.) are deprecated and migrated into array format
- `resolveBand` switches from if/else chain to walking the band array
- Default scheme: `[{key:'low', min:0, max:40}, {key:'mid', min:41, max:69}, {key:'high', min:70, max:100}]`
- All existing reports continue working unchanged

### Why This Doesn't Block Phase 1

- Anchor definitions (`anchorLow`/`anchorHigh`) are two-pole — they describe scale endpoints, not band boundaries. They remain valid regardless of how many bands exist.
- The interpretation card's bar reads from whatever band system is active. When N-band lands, the bar and badge just render from the new scheme.
- Score overview anchor toggle is also band-agnostic.

### Future Enhancement: Sten/Percentile Scale

The bar component in the interpretation card could later support:
- Standard deviation tick marks along the bar
- Normal distribution percentile points
- Sten scale segmentation (1–10)

This builds naturally on top of the N-band bar but is a separate enhancement.

---

## Files Affected (Phase 1)

### New Files
- `src/components/reports/blocks/score-interpretation.tsx` — render component
- Supabase migration for `anchor_low`/`anchor_high` columns

### Modified Files
- `src/types/database.ts` — add `anchorLow`/`anchorHigh` to Dimension, Factor, Construct, ConstructConfigOverride
- `src/lib/reports/types.ts` — add `ScoreInterpretationConfig`, extend `BlockType` union, extend `ScoreOverviewConfig`
- `src/lib/reports/registry.ts` — add `score_interpretation` to `BLOCK_REGISTRY`
- `src/lib/reports/sample-data.ts` — add `score_interpretation` case, add anchors to `PreviewEntity`
- `src/lib/reports/presentation.ts` — if needed for new mode support
- `src/components/reports/blocks/score-overview.tsx` — anchor rendering when `showAnchors` enabled
- `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx` — add `ScoreInterpretationContent` panel, add `showAnchors` toggle to score overview panel
- Entity edit forms (dimension/factor/construct) — add anchor text inputs
- `src/app/actions/` — update server actions for anchor field persistence

### Unchanged
- `src/lib/reports/band-resolution.ts` — no changes in Phase 1
- Library table views — remain assignment/toggle only
