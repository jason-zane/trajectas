# Report Rendering & Presentation Design

**Date:** 2026-04-01
**Status:** Approved for implementation planning
**Related:** [Report Generation Design](./2026-03-31-report-generation-design.md), [Brand System Design](./2026-03-28-brand-system-design.md)

## Overview

This spec defines the visual presentation layer for generated reports — how blocks render, how brand colours flow through reports, how the template builder exposes presentation controls, and how the full-page preview works. It builds on the existing report generation infrastructure (block types, config, pipeline, band resolution) defined in the report generation spec.

## Core Principles

### One Report Tier
Participants, clients, and consultants all see the same report. There is no dumbed-down version and no jargon-heavy practitioner version. Deep psychometric data (confidence intervals, item-level breakdowns, norm tables) lives in the admin dashboard and can be accessed when needed — it does not appear in reports.

### Simplicity With Rigour
Reports must be clear enough that anyone can understand their results without needing a practitioner to interpret them. No jargon, no false precision. The data is rigorous; the presentation is accessible.

### Visual-First Scoring
Band label + visual chart/bar is the default score presentation. Numerical scores are opt-in via `showScore` toggle per block (on score-detail and similar blocks) — useful for practitioners and normed scores later. The visual position on a spectrum communicates where someone sits without requiring number interpretation.

### Configurable Display Level
`displayLevel` on the template controls whether results are presented at dimension, factor, or construct level. The visual system renders correctly at any level.

### Configurable Voice
`person_reference` on the template controls narrative voice:
- `you` (default) — "You demonstrate strong capability in..."
- `first_name` — "Sarah demonstrates strong capability in..."
- `participant` — "Participant demonstrates..." (no article, concise)
- `the_participant` — "The participant demonstrates..." (with article, formal)
- `neutral` (new) — "This score reflects strong capability in..." — avoids person reference entirely. The `{{person}}` token is replaced with empty string, and narrative templates for `neutral` mode use subjectless sentence structures (e.g., "Strong capability in..." or "This score reflects..."). The derived narrative builder has a separate sentence template set for `neutral` that restructures phrasing rather than simply dropping a name.

### Configurable Brand
New `brand_mode` field on `campaign_report_config` controls which brand context the report renders in:
- `platform` (default) — the platform's own report colours
- `client` — pulls from the org's `brand_config`
- `custom` — per-campaign colour override

---

## Presentation Mode System

Every block in a report template has a `presentationMode` property that controls its visual treatment. Five modes are available, all designed to work together interchangeably within a single report.

### Featured
Full-width dark accent background. Used for hero moments — profile overviews, top strengths summaries, score overviews with radar charts, closing CTAs. Should be used sparingly (1-2 per report) for maximum impact.

**Visual characteristics:**
- Dark background (configurable via brand)
- Light text, muted eyebrow labels
- Gold/accent colour for chart fills, pills, CTAs
- Largest typography scale

### Open
Content sits directly on the page background. Typography and whitespace do the heavy lifting. The cleanest reading experience — best for narratives, horizontal bar charts, detailed score breakdowns, numbered insights columns, development timelines.

**Visual characteristics:**
- No container or border
- Subtle dividers between sections
- Standard typography scale
- Most readable for long-form text

### Carded
Content in bordered containers, arranged in grids. Best for comparing entities side-by-side, factor breakdowns with mini bars, ranked strength lists, scorecard tables, development action cards.

**Visual characteristics:**
- White card background with subtle border
- Grid layout: 1, 2, or 3 columns (configurable via `columns` property)
- Band label badges inside cards
- Mini bar charts for compact score representation

### Split
Two-column side-by-side layout. For pairing a chart with explanatory narrative, strengths vs. growth comparisons, grouped factor bars with contextual explanation. Best when data-dense content needs explanation alongside it.

**Visual characteristics:**
- 50/50 grid, 40px gap
- One side typically visual (chart), other side text
- Vertically centred or top-aligned depending on content height

### Inset
Recessed background with a coloured left-border accent. For key findings, pattern observations, summary callouts, important takeaways that need to stand out without being a full featured block.

**Visual characteristics:**
- Slightly darker background than page
- 3px left border, accent colour configurable (`insetAccent`)
- Standard to slightly smaller typography
- Multiple inset blocks can stack with different accent colours to differentiate insight types

### Supported Modes Per Block Type

Not every mode works for every block type. The block registry defines `supportedModes` per type:

| Block Type | Featured | Open | Carded | Split | Inset |
|---|---|---|---|---|---|
| cover-page | Yes | — | — | — | — |
| custom-text | — | Yes | — | — | Yes |
| section-divider | — | Yes | — | — | — |
| score-overview | Yes | Yes | — | Yes | — |
| score-detail | Yes | Yes | Yes | Yes | — |
| strengths-highlights | Yes | Yes | Yes | Yes | — |
| development-plan | — | Yes | Yes | Yes | — |
| rater-comparison | — | Yes | Yes | Yes | — |
| gap-analysis | — | Yes | — | Yes | Yes |
| open-comments | — | Yes | — | — | Yes |
| norm-comparison* | — | Yes | Yes | Yes | — |

\* `norm-comparison` is deferred until norm group infrastructure is built. Modes listed here define the eventual visual treatment.

### Default Modes Per Block Type

| Block Type | Default Mode |
|---|---|
| cover-page | Featured |
| custom-text | Open |
| section-divider | Open |
| score-overview | Open |
| score-detail | Open |
| strengths-highlights | Carded |
| development-plan | Carded |
| rater-comparison | Open |
| gap-analysis | Open |
| open-comments | Open |
| norm-comparison | Carded |

---

## Chart & Visualisation Library

Each score-related block type can render its data using one or more chart types. The `chartType` property on the block config selects which visualisation to use.

### Standard Charts

**Horizontal Bar Chart**
The workhorse visualisation. Entity name left-aligned, track with fill and dot indicator. Band labels beneath. Colour-coded by band (high/mid/low from brand config). Scales from 3 to 12+ factors.
- Supported modes: Open, Featured (accent fill on dark), Split

**Radar / Spider Chart**
Polygon overlay on concentric grid rings. Best for 4-7 dimensions as an overview. Data points at vertices with labels outside the chart.
- Supported modes: Featured (gold/accent on dark), Split (sage/primary on light)
- Not recommended for more than 7-8 data points

**Semicircle Gauges**
Arc fill showing position on scale. Rendered in a horizontal row. Best for 4-6 dimensions as a compact overview with band badges beneath each gauge.
- Supported modes: Open

**Segment Bar**
Simple filled bar without dot indicator. Cleaner than the horizontal bar chart when displaying many items — reduces visual noise. Used for scaled-down or inline representations.
- Supported modes: Open, Carded

**Mini Bar**
Small thin bar (4-6px height) inside cards and table cells. Provides visual weight without taking much vertical space.
- Supported modes: Carded (factor cards, scorecard tables)

**Scorecard Table**
Tabular layout inside a card: factor name, parent dimension, mini bar, band badge columns. Best for 8+ factors in a dense, scannable format.
- Supported modes: Carded

### 360 Charts

**Grouped Bar Chart**
Multiple bars per entity, grouped together. Each bar represents a rater source (self, manager, peers, direct reports, overall). Colour-coded per rater source (colours defined in brand config). Legend above or below.
- Supported modes: Open, Split

**360 Radar Overlay**
Multiple polygons on the same radar chart, one per rater source. Self in one colour, raters in another, optional dotted line for overall average. Immediately shows perception alignment or divergence.
- Supported modes: Featured, Split

**Gap Indicators**
Highlights the difference between self and others' ratings rather than raw scores. Blind spots (self high, others low) and hidden strengths (self low, others high). Can render as diverging horizontal bars from a centre line or as a directional indicator list.
- Supported modes: Open, Inset

### Chart Type Availability Per Block

| Block Type | Bar | Radar | Gauges | Segment | Scorecard | Grouped Bar | 360 Radar | Gap |
|---|---|---|---|---|---|---|---|---|
| score-overview | Yes | Yes | Yes | — | — | — | Yes (360) | — |
| score-detail | Yes | — | — | Yes | Yes* | — | — | — |
| strengths-highlights | Yes | — | — | Yes | — | — | — | — |
| rater-comparison | — | — | — | — | — | Yes | Yes | — |
| gap-analysis | — | — | — | — | — | — | — | Yes |
| norm-comparison | Yes | — | — | Yes | Yes | — | — | — |

\* When `score-detail` uses the Scorecard chart type or is in Carded mode, `mini_bar` is used automatically as an internal rendering detail. It is not independently selectable via `chartType`.

---

## Brand & Colour in Reports

### Report Theme Configuration

All report colours are configurable through the brand settings UI. A new "Reports" section in brand settings defines the full colour palette for rendered reports.

**Score Colours:**
- `reportHighBandFill` — bar/gauge/chart fill for high band scores
- `reportMidBandFill` — bar/gauge/chart fill for mid band scores
- `reportLowBandFill` — bar/gauge/chart fill for low band scores
- `reportHighBadgeBg` / `reportHighBadgeText` — band badge styling
- `reportMidBadgeBg` / `reportMidBadgeText`
- `reportLowBadgeBg` / `reportLowBadgeText`

**Surface Colours:**
- `reportFeaturedBg` — featured block background
- `reportFeaturedText` — featured block text
- `reportFeaturedAccent` — accent colour on featured blocks (chart fills, pills, CTAs)
- `reportInsetBg` — inset block background
- `reportInsetBorder` — default inset accent border colour
- `reportPageBg` — page/report background
- `reportCardBg` — card background
- `reportCardBorder` — card border colour
- `reportDivider` — divider/separator colour
- `reportCtaBg` / `reportCtaText` — CTA button colours

**Typography Colours:**
- `reportHeadingColour` — headings
- `reportBodyColour` — body text
- `reportMutedColour` — secondary/muted text
- `reportLabelColour` — section labels and eyebrows
- `reportCoverAccent` — decorative accent on cover page

**Chart Colours:**
- `reportRadarFill` / `reportRadarStroke` — radar polygon
- `reportRadarPoint` — radar data point colour
- `reportBarDot` — dot indicator on bar charts

**360 Rater Colours:**
- `reportRaterSelf` — self-rating colour
- `reportRaterManager` — manager rating colour
- `reportRaterPeers` — peer rating colour
- `reportRaterDirects` — direct report rating colour
- `reportRaterOverall` — overall/average colour

### Storage

These values are stored as a `reportTheme` property nested inside the existing `config` JSONB column on `brand_configs` — consistent with how all other brand properties are stored. The `BrandConfig` TypeScript interface gains an optional `reportTheme?: ReportTheme` property. The platform brand has defaults set through the same UI. Client and custom brands override from the same structure.

### Brand Resolution Flow

1. Admin configures platform report colours in brand settings (Reports section)
2. Client orgs optionally set their own report colours in their brand config
3. Campaign's `brand_mode` (`platform` | `client` | `custom`) determines which config to use
4. At render time, report components read CSS variables set from the active brand config
5. Snapshot freezes the resolved colour values so the PDF remains stable regardless of future brand changes

### Live Preview in Brand Settings

The Reports section of brand settings includes a live preview panel that renders a representative sample of report elements using the current colour values:
- A featured block section
- A horizontal bar chart
- A set of carded factor cards
- An inset callout
- Band badges at all three levels

Changes to colour values update the preview in real-time.

---

## Cover Page & Logo System

### Logo Positions

**Primary logo** (top of cover page):
- Platform mode: Talent Fit logo
- Client mode: client org's logo from their `brand_config`
- Custom mode: logo uploaded for that campaign
- Falls back to organisation name in clean typographic treatment if no logo is uploaded

**Secondary logo** (smaller, bottom or corner of cover):
- For co-branding — e.g., client logo primary, "Powered by Talent Fit" secondary
- Or partner/consulting firm logo alongside the platform logo
- Optional — can be hidden entirely

**"Powered by" / "Prepared by" label:**
- Small text above/beside the secondary logo
- Configurable text: "Powered by Talent Fit", "Prepared by [Partner Name]", or hidden
- Set in cover-page block config: `poweredByText` (string, nullable)

### Page Headers (Multi-Page PDF)

For printed/PDF reports spanning multiple pages, a repeating header can show a small logo in the top corner. This is a template-level setting:
- `pageHeaderLogo`: `primary` | `secondary` | `none`
- Renders at reduced size (height-constrained) with the report title or participant name alongside it

### Cover Page Block Config

The cover-page block config is the canonical definition (supersedes the simpler config in the generation spec):
- `showDate` — boolean (default true)
- `subtitle` — string (nullable, optional subtitle text)
- `showPrimaryLogo` — boolean (default true)
- `showSecondaryLogo` — boolean (default false)
- `showPoweredBy` — boolean (default false)
- `poweredByText` — string (default "Powered by Talent Fit")

---

## Block Configuration in the Template Builder

### New Shared Config Properties

Every block gains these shared configuration options alongside its existing block-specific config:

- `presentationMode` — select: Featured / Open / Carded / Split / Inset (filtered by `supportedModes` for the block type)
- `columns` — select: 1 / 2 / 3 (only shown when mode is Carded)
- `chartType` — select from available chart types for that block type (only shown for score-related blocks)
- `insetAccent` — colour picker or preset select (only shown when mode is Inset)
- `printBreakBefore` — toggle (existing)
- `printHide` / `screenHide` — toggles (existing)

### Builder Canvas

The canvas (centre panel) shows a simplified representation of each block with its presentation mode visible — using the mode tag system (Featured/Open/Carded/Split/Inset labels) so the template creator can see the visual rhythm of the report layout at a glance.

### Block Registry Updates

Each block type in `BLOCK_REGISTRY` gains:
- `supportedModes: PresentationMode[]` — which modes are available
- `supportedCharts: ChartType[]` — which chart types are available (score blocks only)
- `defaultMode: PresentationMode` — the default when adding a new block

---

## Full-Page Preview

### Architecture

The template builder gains a "Preview" action that opens a full-page preview route rendering the template with sample data. This is not a side-panel preview — it renders at full report width so the template creator sees exactly what the recipient will see.

### Implementation

- New route: `/settings/reports/[id]/preview`
- Uses the same `ReportRenderer` component that the three viewer routes (admin, client, participant) use
- Populates with synthetic `ResolvedBlockData` generated from:
  - A sample participant (realistic name, date)
  - Scores distributed across the full range (some high, some mid, some low) to show how all band levels render
  - Sample narratives at realistic length
  - Sample taxonomy entities matching the template's `displayLevel`
- Applies the active brand context (platform/client/custom) so colours are accurate
- Supports toggling between screen view and print/PDF layout simulation

### Preview Data Generation

A `generateSampleData(template)` utility produces mock `ResolvedBlockData[]` for all blocks in the template:
- Reads the template's block config to know which entities/levels to mock
- Generates realistic but clearly synthetic data (marked as sample)
- Includes edge cases: very long entity names, short narratives, entities with no development suggestion
- For 360 templates: includes mock rater group scores

### Workflow

1. Template creator builds/edits blocks in the builder
2. Clicks "Preview" — opens the preview route in a new tab or full-screen overlay
3. Sees the report as it will render, with sample data and current brand colours
4. Returns to builder to adjust, previews again
5. Changes are reflected on the next preview (preview always reads current saved template state)

---

## Database Changes

### New Fields

**`campaign_report_configs` table:**
- `brand_mode` — enum: `platform`, `client`, `custom` (default `platform`)

**`brand_configs` table:**
- No new column — `reportTheme` is nested inside the existing `config` JSONB column as an optional property, consistent with the existing brand system architecture

**`report_templates` table:**
- `page_header_logo` — enum: `primary`, `secondary`, `none` (default `none`)

### Updated Types

**`PersonReferenceType` enum:**
- Add `neutral` value

**`PresentationMode` enum (new):**
- `featured`, `open`, `carded`, `split`, `inset`

**`ChartType` enum (new):**
- `bar`, `radar`, `gauges`, `segment`, `scorecard`, `grouped_bar`, `radar_360`, `gap`
- Note: `mini_bar` is not a selectable chart type — it is an internal rendering detail used automatically within Carded mode and Scorecard tables

### Block Config Schema Updates

`BlockConfig` base interface gains:
- `presentationMode: PresentationMode`
- `columns?: 1 | 2 | 3`
- `chartType?: ChartType`
- `insetAccent?: string`

---

## Print & PDF Considerations

- All presentation modes must render correctly in print — Featured blocks use their dark background in print (tested for ink usage)
- `break-inside: avoid` on all carded and inset blocks
- `break-before: page` driven by `printBreakBefore` config per block
- Split mode collapses to stacked layout if the print width can't support two columns (edge case at very narrow margins)
- Brand colours are frozen into the snapshot's `rendered_data` at generation time as a `resolvedBrandTheme` object containing all `report*` colour values as resolved hex strings. This ensures the PDF always matches the brand context that was active when the report was generated, even if brand settings change later
- Light-mode page background forced for print regardless of screen theme
- Page header logo renders on every page after the cover in print mode

---

## Out of Scope

- **Norm comparison visualisations** — deferred until norm group infrastructure is built
- **Interactive/animated charts** — reports are static documents; animation is screen-only polish, not a priority
- **Multiple report tiers** — single tier by design decision; practitioner data lives in admin dashboard
- **Email/notification styling** — report delivery notifications are separate from report rendering
- **Seeded template updates** — existing seeded templates in the generation spec predate the presentation mode system. A follow-up migration will add `presentationMode` and `chartType` values to each block in the seeded templates. This is an implementation task, not a design decision.