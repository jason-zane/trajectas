# Score Interpretation v2 — Design Spec

## Goal

Create a new `score_interpretation_v2` block type that sits alongside the existing `score_interpretation` block in the registry. The v2 block uses a compact "flanking anchors" layout that fits 6 dimension groups × 4 factors across **2 A4 pages** instead of 3.

---

## Block identity

| Field | Value |
|---|---|
| Registry key | `score_interpretation_v2` |
| Label | Score Interpretation (Compact) |
| Category | `score` |
| Supported modes | `open`, `featured` |
| Default mode | `open` |

The existing `score_interpretation` block is unchanged.

---

## Layout — "flanking anchors"

Each factor row uses a **2-row structure** instead of v1's 3-row:

```
Row 1: Factor Name                                    [Band Badge]  Score
Row 2: [low anchor text]   [═══ bar ═══]   [high anchor text]
```

Anchors sit on either side of the bar in a 3-column CSS grid (`1fr <bar> 1fr`), flanking it on the same line. This eliminates the dedicated anchor row that v1 uses, saving ~40-50% vertical space.

### Typography (matches v1 base sizes)

| Element | Factor row | Parent/group row |
|---|---|---|
| Entity name | 12 px, semibold (600) | 13.5 px, bold (700), underlined |
| Score | 13 px, bold, tabular-nums | 15 px, bold, tabular-nums |
| Band badge | 9 px, uppercase pill | 9.5 px, uppercase pill |
| Bar height | 12 px, rounded | 14 px, rounded |
| Anchor text | 9 px, `#6b7280` | 9 px, `#4b5563` (slightly darker) |

### Anchor text handling

- Anchors are clamped to **2 lines maximum** via `-webkit-line-clamp: 2` with ellipsis overflow.
- Recommended author budget: ≤ 70 characters per anchor.
- Bar grid columns: `1fr 65mm 1fr` (parent row), `1fr 60mm 1fr` (factor row). Anchor columns get ~44 mm each, fitting ~55-65 characters in 2 lines at 9 px.

---

## Bar with band-break ticks

The continuous progress bar gains **thin vertical tick marks** at each band threshold, making it easy to see where a score sits relative to band boundaries.

| Property | Value |
|---|---|
| Tick width | 1.5 px |
| Tick colour | `rgba(0,0,0,0.22)` (factors), `rgba(0,0,0,0.28)` (parent) |
| Tick height | Full bar height |
| Positioning | Absolute `left: <threshold>%`, derived from `BandScheme.bands` boundaries |

Ticks are responsive to the active band scheme — a 3-band scheme renders 2 ticks, a 5-band scheme renders 4, a 7-band scheme renders 6, etc. Tick positions are calculated from the `max` value of each band (except the last band).

---

## Parent/group row

When `groupByDimension` is on, each group renders a **parent row** above its child factors.

### Visual differentiation from factors

1. **Underlined name** — the dimension name gets `text-decoration: underline` with `text-decoration-thickness: 1.5px`, `text-underline-offset: 3px`. The underline colour uses the **report brand colour** (`var(--primary)` or the brand accent from the report theme), not near-black.
2. **Bumped typography** — name 13.5 px, score 15 px, bar 14 px (see table above).
3. **Indented children** — factor rows are indented `5 mm` from the left edge, creating a spatial parent/child cue.

### When `groupByDimension` is off

Factors display flat with no parent row, no indent, and no grouping — identical to v1 ungrouped mode.

---

## Configuration interface

```typescript
export interface ScoreInterpretationV2Config {
  displayLevel: 'dimension' | 'factor' | 'construct'
  groupByDimension?: boolean              // default true

  // Factor-level display toggles (default all true)
  showScore?: boolean
  showBandLabel?: boolean
  showAnchorLow?: boolean
  showAnchorHigh?: boolean

  // Parent/group-level display toggles (default all false)
  showGroupScore?: boolean
  showGroupBand?: boolean
  showGroupAnchorLow?: boolean
  showGroupAnchorHigh?: boolean
}
```

Key changes from v1's `ScoreInterpretationConfig`:
- `showAnchors` (single boolean) → split into `showAnchorLow` and `showAnchorHigh` for independent control.
- `showGroupAnchors` (single boolean) → split into `showGroupAnchorLow` and `showGroupAnchorHigh`.
- All other toggles carry forward with the same semantics.

---

## Spacing budget (A4 fit)

Target: 3 expanded groups per A4 page → 6 groups across 2 pages.

| Element | Height |
|---|---|
| A4 usable height (18 mm top/bottom insets) | ~261 mm |
| Block title (page 1 only) | ~4 mm |
| Parent row (name + bar line) | ~12 mm |
| Parent → children gap | ~1.5 mm |
| Single factor row (head + bar line) | ~10 mm |
| Factor-to-factor gap | ~2 mm |
| 4 factors total | ~46 mm |
| Between-group margin | ~8 mm |
| **Per group total** | **~68 mm** |
| **3 groups** | **~204 mm** (fits within 261 mm) |

When group toggles are all off (plain label header only), each group is ~56 mm → even more headroom.

---

## Registry entry

```typescript
score_interpretation_v2: {
  label: 'Score Interpretation (Compact)',
  category: 'score',
  description: 'Compact consultant reference with flanking anchors, band-break ticks, and independent parent/child toggles.',
  defaultConfig: {
    displayLevel: 'factor',
    groupByDimension: true,
    showScore: true,
    showBandLabel: true,
    showAnchorLow: true,
    showAnchorHigh: true,
  },
  supportedModes: ['open', 'featured'],
  defaultMode: 'open',
},
```

---

## Builder panel

The builder panel mirrors v1's `ScoreInterpretationContent` but with the split anchor toggles:

**Factor display toggles:**
- Score (on/off)
- Band label (on/off)
- Low anchor (on/off)
- High anchor (on/off)

**Group-level display toggles** (visible only when "Group by dimension" is on):
- Group score (on/off)
- Group band label (on/off)
- Group low anchor (on/off)
- Group high anchor (on/off)

---

## Component structure

```
src/components/reports/blocks/score-interpretation-v2.tsx
├── ScoreInterpretationV2Block (entry point)
├── GroupHeader (parent row — underlined name, brand-accent underline, bar+ticks, flanking anchors)
├── FactorRow (child row — name, bar+ticks, flanking anchors)
└── TickedBar (shared bar component with band-break ticks)
```

`TickedBar` is a new shared component that wraps `SegmentBar`-style rendering with tick marks derived from the active `BandScheme`. It can be used by v1 or other blocks later if desired.

---

## Data flow

No changes to the report runner's data pipeline. `score_interpretation_v2` consumes the same `InterpretationGroup[]` data shape as v1. The runner case for `score_interpretation_v2` can reuse v1's data resolution logic — the only difference is the rendered component and config type.

---

## Featured mode

When `mode === 'featured'`, the block renders on a dark background (same as v1):
- Text colours flip to white/white-alpha variants.
- Bar track colour: `rgba(255,255,255,0.15)`.
- Tick colour: `rgba(255,255,255,0.3)`.
- Brand underline stays as-is (brand colours are typically high-contrast).

---

## Print considerations

- `break-inside-avoid` on each `.group-block` to prevent mid-group page breaks.
- The 5 mm child indent and flanking anchor grid use `mm` units for precise A4 rendering.
- Bar tick positions are percentage-based and scale correctly at any DPI.
