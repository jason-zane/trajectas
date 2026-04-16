# Custom Band Schemes (N-Band Configuration)

**Date:** 2026-04-16
**Status:** Draft
**Depends on:** `2026-04-16-score-interpretation-and-anchors-design.md` (Phase 2)

---

## Overview

Replace the hardcoded 3-band scoring system (Developing / Effective / Highly Effective with thresholds at 40/70) with a configurable N-band system that supports any number of bands with custom labels, thresholds, colour palettes, and behavioural indicator tier mappings.

Band schemes cascade across three levels: **platform → partner → template**. Each level can define its own scheme or inherit from the level above.

Entity-level band overrides (`bandLabelLow/Mid/High`, `pompThresholdLow/High` on dimensions, factors, constructs) are removed. All band configuration now lives at one of the three levels above.

---

## Data Model

### Types

```ts
interface BandScheme {
  palette: string              // e.g. 'red-amber-green', 'warm-neutral', 'monochrome', 'blue-scale'
  bands: BandDefinition[]      // ordered low → high, must cover 0–100 with no gaps/overlaps
}

interface BandDefinition {
  key: string                  // slug, e.g. 'developing', 'effective'
  label: string                // display label
  min: number                  // inclusive lower bound (POMP, 0–100)
  max: number                  // inclusive upper bound (POMP, 0–100)
  indicatorTier: 'low' | 'mid' | 'high'   // which library indicator text to display
}
```

### BandResult (replaces current)

```ts
interface BandResult {
  bandKey: string              // e.g. 'developing'
  bandLabel: string            // e.g. 'Developing'
  bandIndex: number            // 0-based position in scheme.bands
  bandCount: number            // total bands in scheme (for palette colour derivation)
  indicatorTier: 'low' | 'mid' | 'high'
  pompScore: number
}
```

The current `band: 'low' | 'mid' | 'high'` field is replaced by `bandKey` (free-form string) and `bandIndex`/`bandCount` (used for colour). `indicatorTier` is what consumers use when they need the library's behavioural indicators.

### Storage

| Level | Table | Column | Default |
|-------|-------|--------|---------|
| Platform | `platform_settings` (or equivalent global config table) | `band_scheme jsonb` | Seeded with current 3-band scheme |
| Partner | `partners` | `band_scheme jsonb` | null (inherits from platform) |
| Template | `report_templates` | `band_scheme jsonb` | null (inherits from partner) |

### Cascade Resolution

```ts
function resolveBandScheme(
  template: { bandScheme: BandScheme | null },
  partner: { bandScheme: BandScheme | null },
  platform: { bandScheme: BandScheme },
): BandScheme {
  return template.bandScheme ?? partner.bandScheme ?? platform.bandScheme ?? DEFAULT_3_BAND_SCHEME
}
```

**Malformed scheme handling:** `resolveBandScheme` validates the returned scheme (bands present, cover 0–100, non-empty labels). If validation fails, log the error and fall back to `DEFAULT_3_BAND_SCHEME` so reports continue to render. Corrupted schemes should not break report generation.

### Presets

| Preset Key | Bands | Default Labels | Default Indicator Tier Mapping |
|-----------|-------|----------------|-------------------------------|
| `3-band` | 0–40, 41–69, 70–100 | Developing, Effective, Highly Effective | low, mid, high |
| `5-band` | 0–20, 21–40, 41–60, 61–80, 81–100 | Emerging, Developing, Competent, Effective, Highly Effective | low, low, mid, high, high |
| `7-band` | 0–14, 15–28, 29–42, 43–57, 58–71, 72–85, 86–100 | Very Low, Low, Below Average, Average, Above Average, High, Very High | low, low, low, mid, high, high, high |

### Palettes

| Palette Key | Description |
|-------------|-------------|
| `red-amber-green` | Traditional traffic light (default) |
| `warm-neutral` | Soft golds and greys — avoids value judgement connotations |
| `monochrome` | Single hue with intensity variation |
| `blue-scale` | Cool blue tones from light to dark |

Palette colours are derived programmatically from `bandIndex` and `bandCount`. A utility `getBandColour(palette: string, bandIndex: number, bandCount: number): string` returns the CSS colour value. Colours are applied as inline styles in the render components — no dynamic CSS variable injection.

---

## Configuration UI

### Shared Editor Component

A reusable `BandSchemeEditor` component used at all three levels. Layout:

- **Preset dropdown** — 3-band (default), 5-band, 7-band. Selecting a preset replaces the bands with preset values. If there are unsaved customisations, a confirmation prompts before replacement.
- **Palette dropdown** — one of the four palette keys
- **Band rows** — ordered list of bands, each row showing: colour dot (derived), label input, min input, max input, indicator tier dropdown (Low/Mid/High), delete button (hidden if fewer than 3 bands remain)
- **Add band button** — appends a new band with default values (requires user to set min/max to fit)
- **Live preview** — a sample score bar showing how the scheme renders, updating as the user edits

### Validation (inline, shown next to offending row)

- Bands must cover 0–100 with no gaps or overlaps
- Must have at least 2 bands, at most 10
- Each band needs a non-empty label, a valid min (0–100), a valid max (0–100) with max ≥ min, and an indicator tier
- `key` is auto-generated from the label (slugified) and is not user-editable in the UI

### Platform Admin Page

Route: `src/app/(dashboard)/settings/reports/band-scheme/page.tsx`

A standalone page with the `BandSchemeEditor`. Saves to the platform-level store. Accessible to platform admins only.

### Partner Settings

New section or tab in `src/app/(dashboard)/partners/[slug]/settings/page.tsx`:

- Two options: "Use platform default" (radio/toggle) or "Override"
- When "Use platform default" is selected: show a read-only preview of the inherited scheme with a "Customise" button
- When "Override" is selected: render the `BandSchemeEditor`

### Template Settings

New section in the template builder settings panel, alongside `displayLevel`, `personReference`, etc. Same two-option pattern as partner settings (inherit or override), using the `BandSchemeEditor`.

---

## Resolution Logic

`resolveBand` rewritten to use the scheme:

```ts
function resolveBand(pompScore: number, scheme: BandScheme): BandResult {
  const bandIndex = scheme.bands.findIndex(b => pompScore >= b.min && pompScore <= b.max)
  const band = scheme.bands[bandIndex]
  if (!band) throw new Error(`No band found for score ${pompScore}`)
  return {
    bandKey: band.key,
    bandLabel: band.label,
    bandIndex,
    bandCount: scheme.bands.length,
    indicatorTier: band.indicatorTier,
    pompScore: Math.round(pompScore),
  }
}
```

Callers of `resolveBand` now need to pass a resolved scheme. The report generation pipeline resolves the scheme once (via `resolveBandScheme(template, partner, platform)`) at the top of the generation run and threads it through.

---

## Migration

### Database migration

- Add `band_scheme jsonb` column to `partners` table (default null)
- Add `band_scheme jsonb` column to `report_templates` table (default null)
- Add `band_scheme jsonb` column to platform settings table (or create the table if it doesn't exist yet)
- Seed the platform-level row with the `3-band` preset
- Leave the deprecated entity-level columns (`band_label_low/mid/high`, `pomp_threshold_low/high`) in place for now — a future follow-up migration drops them

### Code changes

1. New types and presets in `src/lib/reports/band-scheme.ts`
2. Rewrite `src/lib/reports/band-resolution.ts` to use schemes
3. Update `BandBadge`, `SegmentBar`, `MiniBar` to derive colour from palette + index
4. Update `BarChart`, `GaugeChart`, `ScorecardTable` to pass new band data
5. Update `ScoreOverviewBlock`, `ScoreDetailBlock`, `ScoreInterpretationBlock` to consume new `BandResult`
6. Update `sample-data.ts` `bandForScore()` to use the default scheme
7. Update report generation pipeline to resolve scheme and pass through
8. Build `BandSchemeEditor` shared component
9. Build platform admin page
10. Add partner settings section
11. Add template settings section

### Backward compatibility

- On first deploy, all partners and templates have `band_scheme = null`, so everyone inherits the seeded platform default (current 3-band). No visual change for existing reports.
- Entity-level band overrides (`bandLabelLow/Mid/High`, `pompThresholdLow/High`) stop being read. If any entities currently have these fields set, their custom labels revert to whatever scheme applies at the template/partner/platform level. This is a deliberate behaviour change — documented in the release notes.
- Column removal is deferred to a follow-up migration once we're confident no consumers remain.

---

## Files Affected

### New

- `supabase/migrations/YYYYMMDDHHMMSS_band_schemes.sql` — migration
- `src/lib/reports/band-scheme.ts` — types, presets, palettes, `resolveBandScheme()`, `getBandColour()`
- `src/components/band-scheme-editor/band-scheme-editor.tsx` — shared editor
- `src/components/band-scheme-editor/band-row.tsx` — single band row
- `src/components/band-scheme-editor/scheme-preview.tsx` — live preview bar
- `src/app/(dashboard)/settings/reports/band-scheme/page.tsx` — platform admin page

### Modified

- `src/lib/reports/band-resolution.ts` — rewritten for scheme-based resolution
- `src/lib/reports/types.ts` — updated `BandResult`
- `src/components/reports/charts/band-badge.tsx` — colour from palette
- `src/components/reports/charts/segment-bar.tsx` — colour from palette
- `src/components/reports/charts/mini-bar.tsx` — colour from palette
- `src/components/reports/charts/bar-chart.tsx` — band data through
- `src/components/reports/charts/gauge-chart.tsx` — band data through
- `src/components/reports/charts/scorecard-table.tsx` — band data through
- `src/components/reports/blocks/score-overview.tsx` — new `BandResult`
- `src/components/reports/blocks/score-detail.tsx` — new `BandResult`
- `src/components/reports/blocks/score-interpretation.tsx` — new `BandResult`
- `src/lib/reports/sample-data.ts` — `bandForScore()` uses scheme
- `src/app/actions/partners.ts` — save/load partner band scheme
- `src/app/actions/report-templates.ts` — save/load template band scheme
- `src/types/database.ts` — add `bandScheme?: BandScheme` to `Partner`, `ReportTemplate`
- `src/app/(dashboard)/partners/[slug]/settings/page.tsx` — band scheme section
- Template builder settings panel — band scheme section
- Report generation pipeline — resolve and pass scheme

### Unchanged

- The existing `--report-low-band-fill`, `--report-mid-band-fill`, `--report-high-band-fill` CSS variables remain for the default 3-band palette. New palettes compute colours in JS and apply inline.

---

## Out of Scope

- Sten scale / percentile markers on bars (noted as future enhancement in earlier spec)
- Per-entity band overrides (removed — not replaced)
- Norm-derived thresholds (separate future work)
- Migration tool to import existing entity-level overrides into template-level schemes (not needed — there are no material uses of entity-level overrides in production data)
