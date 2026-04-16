# Custom Band Schemes (N-Band) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded 3-band scoring system with a configurable N-band system that cascades platform → partner → template, with presets, palettes, and indicator tier mapping.

**Architecture:** Add a `BandScheme` JSONB column at three levels (new `platform_settings` table, existing `partners` table, existing `report_templates` table). Resolve the effective scheme for each report at generation time. Rewrite `resolveBand()` to walk an ordered band array. Update consumer components to derive colour from palette + band index. Build a shared `BandSchemeEditor` component used at all three configuration levels.

**Tech Stack:** Next.js, Supabase (Postgres), TypeScript, Tailwind CSS, React

**Spec:** `docs/superpowers/specs/2026-04-16-custom-band-schemes-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260417100000_band_schemes.sql` | DB migration: `platform_settings` table, `band_scheme` columns on `partners` and `report_templates`, seed default |
| `src/lib/reports/band-scheme.ts` | Types (`BandScheme`, `BandDefinition`), presets, palettes, `resolveBandScheme()`, `getBandColour()`, `DEFAULT_3_BAND_SCHEME` |
| `src/lib/reports/band-scheme-validation.ts` | `validateBandScheme()` — ensures coverage of 0–100, no gaps/overlaps, label presence |
| `src/components/band-scheme-editor/band-scheme-editor.tsx` | Shared editor component |
| `src/components/band-scheme-editor/band-row.tsx` | Single band row within the editor |
| `src/components/band-scheme-editor/scheme-preview.tsx` | Live preview bar |
| `src/components/band-scheme-editor/use-band-scheme-state.ts` | Shared hook for scheme state management |
| `src/app/actions/platform-settings.ts` | Server actions to load/save platform band scheme |
| `src/app/(dashboard)/settings/reports/band-scheme/page.tsx` | Platform admin configuration page |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/reports/types.ts` | Updated `BandResult` shape: `bandKey`, `bandIndex`, `bandCount`, `indicatorTier` |
| `src/lib/reports/band-resolution.ts` | Rewritten to take a `BandScheme` and return new `BandResult` |
| `src/lib/reports/sample-data.ts` | `bandForScore()` uses the default scheme; populate new `BandResult` fields |
| `src/components/reports/charts/band-badge.tsx` | Derive colour from palette + band index |
| `src/components/reports/charts/segment-bar.tsx` | Derive colour from palette + band index |
| `src/components/reports/charts/mini-bar.tsx` | Derive colour from palette + band index |
| `src/components/reports/charts/bar-chart.tsx` | Pass bandIndex/bandCount through items |
| `src/components/reports/charts/gauge-chart.tsx` | Pass bandIndex/bandCount through items |
| `src/components/reports/charts/scorecard-table.tsx` | Pass bandIndex/bandCount through items |
| `src/components/reports/blocks/score-overview.tsx` | Consume new `BandResult` |
| `src/components/reports/blocks/score-detail.tsx` | Consume new `BandResult` |
| `src/components/reports/blocks/score-interpretation.tsx` | Consume new `BandResult` |
| `src/app/actions/partners.ts` | Add `updatePartnerBandScheme(partnerId, scheme)` |
| `src/app/actions/report-templates.ts` (or equivalent) | Add `updateTemplateBandScheme(templateId, scheme)` |
| `src/types/database.ts` | Add `bandScheme?: BandScheme` to `Partner`, `ReportTemplate` |
| `src/app/(dashboard)/partners/[slug]/settings/page.tsx` | Add band scheme section using `BandSchemeEditor` |
| Template builder settings panel (exact file TBD at implementation time) | Add band scheme section using `BandSchemeEditor` |
| Report generation pipeline | Resolve scheme once at the top and thread through |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260417100000_band_schemes.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Platform-level settings table for global configuration
create table if not exists platform_settings (
  id uuid primary key default gen_random_uuid(),
  band_scheme jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed the platform default with the current 3-band scheme
insert into platform_settings (band_scheme) values (
  '{
    "palette": "red-amber-green",
    "bands": [
      {"key": "developing", "label": "Developing", "min": 0, "max": 40, "indicatorTier": "low"},
      {"key": "effective", "label": "Effective", "min": 41, "max": 69, "indicatorTier": "mid"},
      {"key": "highly_effective", "label": "Highly Effective", "min": 70, "max": 100, "indicatorTier": "high"}
    ]
  }'::jsonb
);

-- Partner-level override (null = inherit from platform)
alter table partners add column if not exists band_scheme jsonb;

-- Template-level override (null = inherit from partner)
alter table report_templates add column if not exists band_scheme jsonb;
```

- [ ] **Step 2: Apply the migration**

Run via the Supabase MCP `apply_migration` tool or via CLI. Expected: migration applies cleanly.

- [ ] **Step 3: Verify the platform_settings row exists**

Run a query:
```sql
select band_scheme from platform_settings limit 1;
```
Expected: returns one row with the seeded 3-band scheme JSON.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260417100000_band_schemes.sql
git commit -m "feat: add band_scheme columns and platform_settings table"
```

---

## Task 2: Band Scheme Types & Presets

**Files:**
- Create: `src/lib/reports/band-scheme.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/lib/reports/band-scheme.ts
// Types, presets, palettes, and cascade resolution for custom band schemes

export type IndicatorTier = 'low' | 'mid' | 'high'
export type PaletteKey = 'red-amber-green' | 'warm-neutral' | 'monochrome' | 'blue-scale'

export interface BandDefinition {
  key: string
  label: string
  min: number
  max: number
  indicatorTier: IndicatorTier
}

export interface BandScheme {
  palette: PaletteKey
  bands: BandDefinition[]
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const PRESETS: Record<string, BandScheme> = {
  '3-band': {
    palette: 'red-amber-green',
    bands: [
      { key: 'developing', label: 'Developing', min: 0, max: 40, indicatorTier: 'low' },
      { key: 'effective', label: 'Effective', min: 41, max: 69, indicatorTier: 'mid' },
      { key: 'highly_effective', label: 'Highly Effective', min: 70, max: 100, indicatorTier: 'high' },
    ],
  },
  '5-band': {
    palette: 'red-amber-green',
    bands: [
      { key: 'emerging', label: 'Emerging', min: 0, max: 20, indicatorTier: 'low' },
      { key: 'developing', label: 'Developing', min: 21, max: 40, indicatorTier: 'low' },
      { key: 'competent', label: 'Competent', min: 41, max: 60, indicatorTier: 'mid' },
      { key: 'effective', label: 'Effective', min: 61, max: 80, indicatorTier: 'high' },
      { key: 'highly_effective', label: 'Highly Effective', min: 81, max: 100, indicatorTier: 'high' },
    ],
  },
  '7-band': {
    palette: 'red-amber-green',
    bands: [
      { key: 'very_low', label: 'Very Low', min: 0, max: 14, indicatorTier: 'low' },
      { key: 'low', label: 'Low', min: 15, max: 28, indicatorTier: 'low' },
      { key: 'below_average', label: 'Below Average', min: 29, max: 42, indicatorTier: 'low' },
      { key: 'average', label: 'Average', min: 43, max: 57, indicatorTier: 'mid' },
      { key: 'above_average', label: 'Above Average', min: 58, max: 71, indicatorTier: 'high' },
      { key: 'high', label: 'High', min: 72, max: 85, indicatorTier: 'high' },
      { key: 'very_high', label: 'Very High', min: 86, max: 100, indicatorTier: 'high' },
    ],
  },
}

export const DEFAULT_3_BAND_SCHEME: BandScheme = PRESETS['3-band']

// ---------------------------------------------------------------------------
// Palettes — colour derivation
// ---------------------------------------------------------------------------

const PALETTE_STOPS: Record<PaletteKey, [string, string]> = {
  'red-amber-green': ['#c62828', '#2e7d32'],  // red → green
  'warm-neutral': ['#8a7a5a', '#c9a962'],     // muted gold range
  'monochrome': ['#6b6b6b', '#1a1a1a'],       // light grey → near-black
  'blue-scale': ['#90caf9', '#0d47a1'],       // light blue → deep blue
}

/**
 * Derive a colour for a band given the palette and its position.
 * For red-amber-green specifically, we interpolate through amber in the middle.
 * Other palettes linearly interpolate between start and end stops.
 */
export function getBandColour(palette: PaletteKey, bandIndex: number, bandCount: number): string {
  if (bandCount <= 1) return PALETTE_STOPS[palette][0]
  const t = bandIndex / (bandCount - 1)  // 0..1

  if (palette === 'red-amber-green') {
    // Three-stop interpolation: red → amber → green
    if (t < 0.5) {
      return interpolateHex('#c62828', '#e67a00', t * 2)
    } else {
      return interpolateHex('#e67a00', '#2e7d32', (t - 0.5) * 2)
    }
  }

  const [start, end] = PALETTE_STOPS[palette]
  return interpolateHex(start, end, t)
}

function interpolateHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16)
  const ag = parseInt(a.slice(3, 5), 16)
  const ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16)
  const bg = parseInt(b.slice(3, 5), 16)
  const bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Cascade resolution
// ---------------------------------------------------------------------------

export function resolveBandScheme(
  template: { bandScheme?: BandScheme | null } | null,
  partner: { bandScheme?: BandScheme | null } | null,
  platform: { bandScheme?: BandScheme | null } | null,
): BandScheme {
  const candidates = [template?.bandScheme, partner?.bandScheme, platform?.bandScheme]
  for (const c of candidates) {
    if (c && isValidScheme(c)) return c
  }
  return DEFAULT_3_BAND_SCHEME
}

function isValidScheme(scheme: BandScheme): boolean {
  if (!scheme.bands || scheme.bands.length < 2) return false
  const sorted = [...scheme.bands].sort((a, b) => a.min - b.min)
  if (sorted[0].min !== 0) return false
  if (sorted[sorted.length - 1].max !== 100) return false
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min !== sorted[i - 1].max + 1) return false
  }
  for (const b of sorted) {
    if (!b.label || !b.key || !b.indicatorTier) return false
  }
  return true
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/band-scheme.ts
git commit -m "feat: add band scheme types, presets, palettes, and resolution"
```

---

## Task 3: Band Scheme Validation

**Files:**
- Create: `src/lib/reports/band-scheme-validation.ts`

- [ ] **Step 1: Create validation module**

```ts
// src/lib/reports/band-scheme-validation.ts
// Detailed validation with per-band errors for the editor UI

import type { BandScheme, BandDefinition } from './band-scheme'

export interface BandValidationError {
  bandIndex: number   // -1 for scheme-level errors
  field: 'label' | 'min' | 'max' | 'indicatorTier' | 'coverage' | 'count'
  message: string
}

export function validateBandScheme(scheme: BandScheme): BandValidationError[] {
  const errors: BandValidationError[] = []
  const bands = scheme.bands ?? []

  if (bands.length < 2) {
    errors.push({ bandIndex: -1, field: 'count', message: 'Must have at least 2 bands' })
    return errors
  }
  if (bands.length > 10) {
    errors.push({ bandIndex: -1, field: 'count', message: 'Must have at most 10 bands' })
  }

  bands.forEach((band, i) => {
    if (!band.label?.trim()) {
      errors.push({ bandIndex: i, field: 'label', message: 'Label is required' })
    }
    if (typeof band.min !== 'number' || band.min < 0 || band.min > 100) {
      errors.push({ bandIndex: i, field: 'min', message: 'Min must be 0–100' })
    }
    if (typeof band.max !== 'number' || band.max < 0 || band.max > 100) {
      errors.push({ bandIndex: i, field: 'max', message: 'Max must be 0–100' })
    }
    if (band.max < band.min) {
      errors.push({ bandIndex: i, field: 'max', message: 'Max must be ≥ min' })
    }
    if (!['low', 'mid', 'high'].includes(band.indicatorTier)) {
      errors.push({ bandIndex: i, field: 'indicatorTier', message: 'Indicator tier is required' })
    }
  })

  // Coverage check: sorted bands must cover 0–100 with no gaps/overlaps
  const sorted = [...bands].sort((a, b) => a.min - b.min)
  if (sorted[0]?.min !== 0) {
    errors.push({ bandIndex: -1, field: 'coverage', message: 'First band must start at 0' })
  }
  if (sorted[sorted.length - 1]?.max !== 100) {
    errors.push({ bandIndex: -1, field: 'coverage', message: 'Last band must end at 100' })
  }
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (curr.min !== prev.max + 1) {
      errors.push({
        bandIndex: -1,
        field: 'coverage',
        message: `Gap or overlap between "${prev.label}" and "${curr.label}"`,
      })
    }
  }

  return errors
}

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function isSchemeValid(scheme: BandScheme): boolean {
  return validateBandScheme(scheme).length === 0
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/reports/band-scheme-validation.ts
git commit -m "feat: add band scheme validation with per-band errors"
```

---

## Task 4: Rewrite BandResult and resolveBand

**Files:**
- Modify: `src/lib/reports/types.ts`
- Modify: `src/lib/reports/band-resolution.ts`

- [ ] **Step 1: Update BandResult type**

In `src/lib/reports/types.ts`, replace the existing `BandResult` interface:

```ts
export interface BandResult {
  bandKey: string              // e.g. 'developing'
  bandLabel: string            // e.g. 'Developing'
  bandIndex: number            // 0-based position in scheme.bands
  bandCount: number            // total bands in the scheme
  indicatorTier: 'low' | 'mid' | 'high'
  pompScore: number
}
```

The `Band` type (`'low' | 'mid' | 'high'`) can stay — it's still used for the indicator tier mapping. Rename its exported name if needed, but keep the union.

- [ ] **Step 2: Rewrite resolveBand**

Replace the entire contents of `src/lib/reports/band-resolution.ts`:

```ts
// src/lib/reports/band-resolution.ts
// Scheme-based band resolution. Caller passes a resolved BandScheme.

import type { BandResult } from './types'
import type { BandScheme } from './band-scheme'
import { DEFAULT_3_BAND_SCHEME } from './band-scheme'

export function resolveBand(pompScore: number, scheme: BandScheme = DEFAULT_3_BAND_SCHEME): BandResult {
  const rounded = Math.max(0, Math.min(100, Math.round(pompScore)))
  const bandIndex = scheme.bands.findIndex((b) => rounded >= b.min && rounded <= b.max)

  // Fallback: if score somehow doesn't fit any band (corrupted scheme), use first or last
  const safeIndex = bandIndex >= 0 ? bandIndex : (rounded <= scheme.bands[0].min ? 0 : scheme.bands.length - 1)
  const band = scheme.bands[safeIndex]

  return {
    bandKey: band.key,
    bandLabel: band.label,
    bandIndex: safeIndex,
    bandCount: scheme.bands.length,
    indicatorTier: band.indicatorTier,
    pompScore: rounded,
  }
}
```

- [ ] **Step 3: Verify TypeScript still compiles (expect errors from consumers)**

Run: `npx tsc --noEmit`
Expected: errors from files that use the old `band: 'low' | 'mid' | 'high'` property or `thresholdLow/High` on `BandResult`. These are fixed in the next tasks.

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/types.ts src/lib/reports/band-resolution.ts
git commit -m "feat: rewrite BandResult and resolveBand for scheme-based resolution"
```

---

## Task 5: Update Chart Components to Use Palette

**Files:**
- Modify: `src/components/reports/charts/band-badge.tsx`
- Modify: `src/components/reports/charts/segment-bar.tsx`
- Modify: `src/components/reports/charts/mini-bar.tsx`

- [ ] **Step 1: Update SegmentBar to accept band index + palette**

Current API takes `band: 'low' | 'mid' | 'high'`. New API takes `bandIndex`, `bandCount`, `palette`. Colour comes from `getBandColour()`.

```tsx
// src/components/reports/charts/segment-bar.tsx
'use client'
import { cn } from '@/lib/utils'
import { getBandColour, type PaletteKey } from '@/lib/reports/band-scheme'

interface SegmentBarProps {
  value: number
  bandIndex: number
  bandCount: number
  palette: PaletteKey
  className?: string
}

export function SegmentBar({ value, bandIndex, bandCount, palette, className }: SegmentBarProps) {
  const fill = getBandColour(palette, bandIndex, bandCount)
  return (
    <div
      className={cn('h-2 rounded-full w-full', className)}
      style={{ background: 'var(--report-divider)' }}
    >
      <div
        className="h-2 rounded-full"
        style={{ width: `${value}%`, background: fill }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Update MiniBar with the same pattern**

Same signature change. Uses `getBandColour()` for the fill.

- [ ] **Step 3: Update BandBadge**

```tsx
// src/components/reports/charts/band-badge.tsx
// Current version likely switches on 'low' | 'mid' | 'high' for colour.
// New version: derive colour from palette + index, use a subtle background tint.
'use client'
import { getBandColour, type PaletteKey } from '@/lib/reports/band-scheme'

interface BandBadgeProps {
  label: string
  bandIndex: number
  bandCount: number
  palette: PaletteKey
}

export function BandBadge({ label, bandIndex, bandCount, palette }: BandBadgeProps) {
  const colour = getBandColour(palette, bandIndex, bandCount)
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        color: colour,
        background: `${colour}1a`,  // 10% alpha via hex
      }}
    >
      {label}
    </span>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/charts/band-badge.tsx src/components/reports/charts/segment-bar.tsx src/components/reports/charts/mini-bar.tsx
git commit -m "feat: chart components derive colour from palette and band index"
```

---

## Task 6: Update Chart Parent Components (BarChart, GaugeChart, ScorecardTable)

**Files:**
- Modify: `src/components/reports/charts/bar-chart.tsx`
- Modify: `src/components/reports/charts/gauge-chart.tsx`
- Modify: `src/components/reports/charts/scorecard-table.tsx`

These components currently take items with `band: 'low' | 'mid' | 'high'`. Update to take items with `bandIndex: number`, `bandCount: number`, and accept a `palette: PaletteKey` prop at the chart level.

- [ ] **Step 1: BarChart**

Update the `items` array shape:
```ts
{ name: string; value: number; bandIndex: number; bandCount: number; bandLabel?: string }
```
Add a `palette: PaletteKey` prop on the `BarChart` component and pass it through to any internal colour derivation. Replace any `var(--report-${band}-band-fill)` calls with `getBandColour(palette, bandIndex, bandCount)`.

- [ ] **Step 2: GaugeChart**

Same change as BarChart. If the gauge uses the `band` string for segments or thresholds, those also need to use `bandIndex`/`bandCount` and potentially the full band array if the gauge visualises all bands as zones.

- [ ] **Step 3: ScorecardTable**

Same — replace `band` with `bandIndex`/`bandCount` and derive colour via palette.

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: errors now isolated to the score block components, which are fixed next.

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/charts/bar-chart.tsx src/components/reports/charts/gauge-chart.tsx src/components/reports/charts/scorecard-table.tsx
git commit -m "feat: chart parent components accept palette and band position"
```

---

## Task 7: Update Score Block Components

**Files:**
- Modify: `src/components/reports/blocks/score-overview.tsx`
- Modify: `src/components/reports/blocks/score-detail.tsx`
- Modify: `src/components/reports/blocks/score-interpretation.tsx`

Each of these blocks currently reads `bandResult.band` (old shape) and passes it to charts. Update to:
1. Read `bandResult.bandIndex`, `bandResult.bandCount` from the new `BandResult`
2. Read `palette` from the block's data payload (which includes the resolved scheme)
3. Pass `palette`, `bandIndex`, `bandCount` into chart components and `BandBadge`

The block data payload shape needs to include `palette` at the top level (populated by the sample data generator and the real report pipeline). Add `palette: PaletteKey` to the relevant data interfaces.

- [ ] **Step 1: ScoreOverviewBlock**

Add `palette` to `ScoreOverviewData`:
```ts
interface ScoreOverviewData {
  scores: ScoreEntry[]
  config: ScoreOverviewConfig
  palette: PaletteKey   // NEW
}
```

Replace all `s.bandResult.band` references with `s.bandResult.bandIndex` + `s.bandResult.bandCount`. Pass `palette={d.palette}` to chart components and `BandBadge` (where it's used, e.g. in score-detail).

- [ ] **Step 2: ScoreDetailBlock**

Same update. `BandBadge` call signatures change:
```tsx
<BandBadge
  label={entity.bandResult.bandLabel}
  bandIndex={entity.bandResult.bandIndex}
  bandCount={entity.bandResult.bandCount}
  palette={d.palette}
/>
```

- [ ] **Step 3: ScoreInterpretationBlock**

Same update. `SegmentBar` call:
```tsx
<SegmentBar
  value={entity.pompScore}
  bandIndex={entity.bandResult.bandIndex}
  bandCount={entity.bandResult.bandCount}
  palette={d.palette}
  className="mb-1"
/>
```

Add `palette` to `ScoreInterpretationData`.

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: clean, except possibly sample-data.ts which is next.

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/blocks/score-overview.tsx src/components/reports/blocks/score-detail.tsx src/components/reports/blocks/score-interpretation.tsx
git commit -m "feat: score blocks consume new BandResult and palette"
```

---

## Task 8: Update Sample Data Generator

**Files:**
- Modify: `src/lib/reports/sample-data.ts`

- [ ] **Step 1: Update bandForScore to use a scheme**

The old `bandForScore()` returns `{ band, bandLabel }` for the 3-band hardcoded system. Replace:

```ts
import { DEFAULT_3_BAND_SCHEME, type BandScheme } from './band-scheme'
import { resolveBand } from './band-resolution'

type ScoredEntity = PreviewEntity & { pompScore: number; bandResult: BandResult }

function scoreEntities(entities: PreviewEntity[], scheme: BandScheme = DEFAULT_3_BAND_SCHEME): ScoredEntity[] {
  return entities.map((e, i) => {
    const pompScore = PREVIEW_SCORES[i % PREVIEW_SCORES.length]
    return { ...e, pompScore, bandResult: resolveBand(pompScore, scheme) }
  })
}
```

- [ ] **Step 2: Update resolveIndicator to use indicatorTier instead of band**

The existing `resolveIndicator(entity, band)` takes a band string. Update to take `indicatorTier`:

```ts
function resolveIndicator(entity: ScoredEntity, tier: 'high' | 'mid' | 'low'): string | null {
  if (tier === 'high' && hasContent(entity.indicatorsHigh)) return entity.indicatorsHigh!
  if (tier === 'mid' && hasContent(entity.indicatorsMid)) return entity.indicatorsMid!
  if (tier === 'low' && hasContent(entity.indicatorsLow)) return entity.indicatorsLow!
  // Fallback to any available
  if (hasContent(entity.indicatorsHigh)) return entity.indicatorsHigh!
  if (hasContent(entity.indicatorsMid)) return entity.indicatorsMid!
  if (hasContent(entity.indicatorsLow)) return entity.indicatorsLow!
  return null
}
```

Callers change from `resolveIndicator(e, e.band)` to `resolveIndicator(e, e.bandResult.indicatorTier)`.

- [ ] **Step 3: Add palette to all block data returns**

Every case in `generateBlockSampleData` that returns data for a score block needs to include `palette`. The default scheme's palette is `'red-amber-green'`. Add to the return shape for `score_overview`, `score_detail`, `score_interpretation`, `strengths_highlights`, `development_plan`:

```ts
return {
  ...existing,
  palette: scheme.palette,
}
```

- [ ] **Step 4: Thread scheme through generateSampleData**

The `generateSampleData()` top-level function needs a `scheme?: BandScheme` parameter, defaulting to `DEFAULT_3_BAND_SCHEME`. Pass it to `scoreEntities()` and include `palette` in block data outputs.

```ts
export function generateSampleData(
  templateBlocks: Record<string, unknown>[] | BlockConfig[],
  reportTheme: ReportTheme,
  entities: PreviewEntity[] = [],
  templateName = 'Assessment Report',
  scheme: BandScheme = DEFAULT_3_BAND_SCHEME,
): ResolvedBlockData[] {
  const scored = scoreEntities(entities, scheme)
  // ...
}
```

- [ ] **Step 4b: Update all callers of generateSampleData**

Run: `grep -rn "generateSampleData" src/`
For each caller, pass the resolved scheme as the 5th argument. Callers that don't have scheme context yet (e.g. early-phase previews) can pass `DEFAULT_3_BAND_SCHEME` temporarily — Task 9 wires the real scheme through for pipeline consumers.

- [ ] **Step 5: Update makeBandResult helper**

Replace the old `makeBandResult` with the new shape or remove it — use `resolveBand(e.pompScore, scheme)` directly where needed. Entities already carry `bandResult` after `scoreEntities`.

- [ ] **Step 6: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reports/sample-data.ts
git commit -m "feat: sample data generator uses band schemes"
```

---

## Task 9: Report Generation Pipeline Integration

**Files:**
- Modify: report generation code (exact file to be identified at implementation time — search for where `generateSampleData` is called in the real pipeline, or where template data is assembled for rendering)

- [ ] **Step 1: Locate the pipeline integration point**

The real report generator (as opposed to the template preview) assembles data for each block. Find it with these greps:
- `grep -rn "resolveBand\|makeBandResult" src/ --include='*.ts' --include='*.tsx'` — find callers outside `sample-data.ts` and `band-resolution.ts`
- `grep -rn "ResolvedBlockData" src/ --include='*.ts'` — find where block data is constructed in the real pipeline
- `grep -rn "generateSampleData" src/` — find preview callers to update alongside the real pipeline

Likely files: `src/lib/reports/report-runner.ts`, `src/app/actions/reports.ts`, or equivalent. If multiple pipelines exist, update each.

- [ ] **Step 2: Resolve scheme once at top of generation run**

At the start of a report generation, load:
- Template record (with its `bandScheme`)
- Partner record (with its `bandScheme`)
- Platform settings (with its `bandScheme`)

Call `resolveBandScheme(template, partner, platform)` to get the effective scheme. Pass this scheme into all `resolveBand()` calls and include `scheme.palette` in each block's data payload.

- [ ] **Step 3: Update callers of generateSampleData in the preview flow**

Template preview needs the scheme too. Where `generateSampleData` is called from the builder's preview, load the template's `bandScheme`, partner's `bandScheme`, platform's `bandScheme`, resolve via `resolveBandScheme`, and pass to `generateSampleData`.

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`
Open the template builder preview. Verify the existing 3-band scheme renders identically to before (no visual regression).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: report pipeline resolves band scheme from template/partner/platform"
```

---

## Task 10: Server Actions for Band Scheme Persistence

**Files:**
- Create: `src/app/actions/platform-settings.ts`
- Modify: `src/app/actions/partners.ts`
- Modify: the template actions file (find via grep for `updateReportTemplate` or similar)

- [ ] **Step 1: Create platform-settings actions**

**Note:** Before implementing, grep for the existing auth helper pattern — look for `requireAdminScope`, `requirePlatformAdmin`, or similar in `src/lib/auth/` or existing server action files. Use whatever function is already established. The plan below uses `requireAdminScope()` as a placeholder — replace if your codebase uses a different helper for platform-admin-only actions.

```ts
// src/app/actions/platform-settings.ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/require-scope'  // verify actual helper
import { revalidatePath } from 'next/cache'
import { isSchemeValid } from '@/lib/reports/band-scheme-validation'
import type { BandScheme } from '@/lib/reports/band-scheme'

export async function getPlatformBandScheme(): Promise<BandScheme | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('platform_settings')
    .select('band_scheme')
    .limit(1)
    .single()
  if (error) return null
  return data?.band_scheme as BandScheme | null
}

export async function updatePlatformBandScheme(scheme: BandScheme) {
  await requireAdminScope()  // must be platform-admin-only — verify scope check
  if (!isSchemeValid(scheme)) return { error: 'Invalid band scheme' }

  const db = createAdminClient()
  const { data: rows } = await db.from('platform_settings').select('id').limit(1)
  const id = rows?.[0]?.id

  if (id) {
    const { error } = await db
      .from('platform_settings')
      .update({ band_scheme: scheme, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { error } = await db.from('platform_settings').insert({ band_scheme: scheme })
    if (error) return { error: error.message }
  }

  revalidatePath('/settings/reports/band-scheme')
  return { success: true }
}
```

- [ ] **Step 2: Add updatePartnerBandScheme**

In `src/app/actions/partners.ts`, add:

```ts
export async function updatePartnerBandScheme(partnerId: string, scheme: BandScheme | null) {
  const scope = await requireAdminScope()
  if (scheme && !isSchemeValid(scheme)) return { error: 'Invalid band scheme' }

  const db = createAdminClient()
  const { error } = await db
    .from('partners')
    .update({ band_scheme: scheme })
    .eq('id', partnerId)

  if (error) return { error: error.message }
  revalidatePath(`/partners/${partnerId}/settings`)
  return { success: true }
}
```

- [ ] **Step 3: Add updateTemplateBandScheme**

In the template actions file (find via grep for existing template update functions), add an analogous function.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: server actions for band scheme persistence at all three levels"
```

---

## Task 11: Band Scheme Editor — Components

**Files:**
- Create: `src/components/band-scheme-editor/use-band-scheme-state.ts`
- Create: `src/components/band-scheme-editor/band-row.tsx`
- Create: `src/components/band-scheme-editor/scheme-preview.tsx`
- Create: `src/components/band-scheme-editor/band-scheme-editor.tsx`

- [ ] **Step 1: Shared state hook**

```ts
// src/components/band-scheme-editor/use-band-scheme-state.ts
'use client'

import { useState, useCallback } from 'react'
import type { BandScheme, BandDefinition, PaletteKey } from '@/lib/reports/band-scheme'
import { PRESETS } from '@/lib/reports/band-scheme'
import { slugify } from '@/lib/reports/band-scheme-validation'

export function useBandSchemeState(initial: BandScheme) {
  const [scheme, setScheme] = useState<BandScheme>(initial)

  const loadPreset = useCallback((presetKey: keyof typeof PRESETS) => {
    setScheme({ ...PRESETS[presetKey] })
  }, [])

  const setPalette = useCallback((palette: PaletteKey) => {
    setScheme((s) => ({ ...s, palette }))
  }, [])

  const updateBand = useCallback((index: number, patch: Partial<BandDefinition>) => {
    setScheme((s) => {
      const bands = [...s.bands]
      const next = { ...bands[index], ...patch }
      // Auto-slug key from label if label changed
      if (patch.label !== undefined) next.key = slugify(patch.label)
      bands[index] = next
      return { ...s, bands }
    })
  }, [])

  const addBand = useCallback(() => {
    setScheme((s) => {
      const lastMax = s.bands[s.bands.length - 1].max
      if (lastMax >= 100) return s  // can't add if already at max
      const newBand: BandDefinition = {
        key: `band_${s.bands.length + 1}`,
        label: `Band ${s.bands.length + 1}`,
        min: lastMax + 1,
        max: 100,
        indicatorTier: 'mid',
      }
      return { ...s, bands: [...s.bands, newBand] }
    })
  }, [])

  const removeBand = useCallback((index: number) => {
    setScheme((s) => {
      if (s.bands.length <= 2) return s
      const bands = s.bands.filter((_, i) => i !== index)
      return { ...s, bands }
    })
  }, [])

  return { scheme, setScheme, loadPreset, setPalette, updateBand, addBand, removeBand }
}
```

- [ ] **Step 2: Band row component**

```tsx
// src/components/band-scheme-editor/band-row.tsx
'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { getBandColour, type PaletteKey, type BandDefinition } from '@/lib/reports/band-scheme'
import type { BandValidationError } from '@/lib/reports/band-scheme-validation'

interface BandRowProps {
  band: BandDefinition
  index: number
  bandCount: number
  palette: PaletteKey
  errors: BandValidationError[]
  canRemove: boolean
  onUpdate: (patch: Partial<BandDefinition>) => void
  onRemove: () => void
}

export function BandRow({ band, index, bandCount, palette, errors, canRemove, onUpdate, onRemove }: BandRowProps) {
  const colour = getBandColour(palette, index, bandCount)
  const err = (field: string) => errors.find((e) => e.bandIndex === index && e.field === field)

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: colour }} />
      <Input
        value={band.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        placeholder="Label"
        className="h-8 text-sm flex-1"
        aria-invalid={!!err('label')}
      />
      <Input
        type="number"
        value={band.min}
        onChange={(e) => onUpdate({ min: Number(e.target.value) })}
        className="h-8 text-sm w-16"
        min={0}
        max={100}
      />
      <span className="text-xs text-muted-foreground">–</span>
      <Input
        type="number"
        value={band.max}
        onChange={(e) => onUpdate({ max: Number(e.target.value) })}
        className="h-8 text-sm w-16"
        min={0}
        max={100}
      />
      <Select
        value={band.indicatorTier}
        onValueChange={(v) => onUpdate({ indicatorTier: v as 'low' | 'mid' | 'high' })}
      >
        <SelectTrigger className="h-8 text-sm w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="mid">Mid</SelectItem>
          <SelectItem value="high">High</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={!canRemove}
        className="h-8 w-8 shrink-0"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Scheme preview**

```tsx
// src/components/band-scheme-editor/scheme-preview.tsx
'use client'

import { getBandColour, type BandScheme } from '@/lib/reports/band-scheme'

export function SchemePreview({ scheme }: { scheme: BandScheme }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
      <div className="flex h-4 w-full rounded-full overflow-hidden border">
        {scheme.bands.map((band, i) => {
          const width = Math.max(0, band.max - band.min + 1)
          const colour = getBandColour(scheme.palette, i, scheme.bands.length)
          return (
            <div
              key={i}
              style={{ width: `${width}%`, background: colour }}
              title={`${band.label} (${band.min}–${band.max})`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Main editor component**

```tsx
// src/components/band-scheme-editor/band-scheme-editor.tsx
'use client'

import { useMemo, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { PRESETS, type BandScheme, type PaletteKey } from '@/lib/reports/band-scheme'
import { validateBandScheme } from '@/lib/reports/band-scheme-validation'
import { useBandSchemeState } from './use-band-scheme-state'
import { BandRow } from './band-row'
import { SchemePreview } from './scheme-preview'

const PALETTES: { value: PaletteKey; label: string }[] = [
  { value: 'red-amber-green', label: 'Red-Amber-Green' },
  { value: 'warm-neutral', label: 'Warm Neutral' },
  { value: 'monochrome', label: 'Monochrome' },
  { value: 'blue-scale', label: 'Blue Scale' },
]

interface BandSchemeEditorProps {
  initial: BandScheme
  onChange: (scheme: BandScheme, isValid: boolean) => void
}

export function BandSchemeEditor({ initial, onChange }: BandSchemeEditorProps) {
  const { scheme, loadPreset, setPalette, updateBand, addBand, removeBand } = useBandSchemeState(initial)
  const errors = useMemo(() => validateBandScheme(scheme), [scheme])
  const schemeErrors = errors.filter((e) => e.bandIndex === -1)

  // Notify parent on every change
  useEffect(() => {
    onChange(scheme, errors.length === 0)
  }, [scheme, errors, onChange])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Preset</Label>
          <Select onValueChange={(v) => loadPreset(v as keyof typeof PRESETS)}>
            <SelectTrigger className="h-8 w-32 text-sm"><SelectValue placeholder="Load preset" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3-band">3-band</SelectItem>
              <SelectItem value="5-band">5-band</SelectItem>
              <SelectItem value="7-band">7-band</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Palette</Label>
          <Select value={scheme.palette} onValueChange={(v) => setPalette(v as PaletteKey)}>
            <SelectTrigger className="h-8 w-40 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PALETTES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {scheme.bands.map((band, i) => (
          <BandRow
            key={i}
            band={band}
            index={i}
            bandCount={scheme.bands.length}
            palette={scheme.palette}
            errors={errors}
            canRemove={scheme.bands.length > 2}
            onUpdate={(patch) => updateBand(i, patch)}
            onRemove={() => removeBand(i)}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addBand}
        disabled={scheme.bands.length >= 10 || scheme.bands[scheme.bands.length - 1].max >= 100}
      >
        <Plus className="size-4 mr-1" />
        Add band
      </Button>

      {schemeErrors.length > 0 && (
        <ul className="text-xs text-destructive space-y-0.5">
          {schemeErrors.map((e, i) => <li key={i}>{e.message}</li>)}
        </ul>
      )}

      <SchemePreview scheme={scheme} />
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/band-scheme-editor/
git commit -m "feat: shared BandSchemeEditor component with presets and palette"
```

---

## Task 12: Platform Admin Page

**Files:**
- Create: `src/app/(dashboard)/settings/reports/band-scheme/page.tsx`

- [ ] **Step 1: Build the page**

```tsx
// src/app/(dashboard)/settings/reports/band-scheme/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { BandSchemeEditor } from '@/components/band-scheme-editor/band-scheme-editor'
import { getPlatformBandScheme, updatePlatformBandScheme } from '@/app/actions/platform-settings'
import { DEFAULT_3_BAND_SCHEME, type BandScheme } from '@/lib/reports/band-scheme'

export default function BandSchemePage() {
  const [initial, setInitial] = useState<BandScheme | null>(null)
  const [draft, setDraft] = useState<BandScheme | null>(null)
  const [isValid, setIsValid] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getPlatformBandScheme().then((s) => setInitial(s ?? DEFAULT_3_BAND_SCHEME))
  }, [])

  if (!initial) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>

  async function handleSave() {
    if (!draft || !isValid) return
    setSaving(true)
    const result = await updatePlatformBandScheme(draft)
    setSaving(false)
    if ('error' in result) {
      toast.error(result.error!)
    } else {
      toast.success('Band scheme saved')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader title="Platform Band Scheme" description="Global default band configuration used when a partner or template doesn't override it." />
      <BandSchemeEditor initial={initial} onChange={(s, valid) => { setDraft(s); setIsValid(valid) }} />
      <Button onClick={handleSave} disabled={!isValid || saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Run: `npm run dev`
Navigate to `/settings/reports/band-scheme` (platform admin route). Verify the editor loads with the seeded 3-band scheme, you can select presets, change palette, edit bands, and save.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/reports/band-scheme/page.tsx
git commit -m "feat: platform admin page for global band scheme config"
```

---

## Task 13: Partner Settings Integration

**Files:**
- Modify: `src/app/(dashboard)/partners/[slug]/settings/page.tsx`

- [ ] **Step 1: Read the existing partner settings page**

Read the file to understand its structure — does it use tabs or sections? Find the right place to add a "Band Scheme" section.

- [ ] **Step 2: Add band scheme section**

Add a new section or tab with:
- A toggle/radio: "Use platform default" vs "Override"
- When "Use platform default": display a read-only `SchemePreview` of the inherited scheme with an "Override" button
- When "Override": render `BandSchemeEditor` with the partner's current scheme (or the inherited one as a starting point)
- Save button that calls `updatePartnerBandScheme(partnerId, scheme or null)` — passing `null` to clear the override

```tsx
// Pseudocode for the new section
const [mode, setMode] = useState<'inherit' | 'override'>(partner.bandScheme ? 'override' : 'inherit')
const [draft, setDraft] = useState<BandScheme | null>(partner.bandScheme)

async function handleSave() {
  const result = await updatePartnerBandScheme(partner.id, mode === 'inherit' ? null : draft)
  // toast
}
```

- [ ] **Step 3: Verify**

Run dev server, open a partner's settings, verify the band scheme section works end-to-end.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/partners/\[slug\]/settings/page.tsx
git commit -m "feat: partner settings band scheme section"
```

---

## Task 14: Template Settings Integration

**Files:**
- Modify: the template builder settings panel (exact file TBD — find via grep for the existing settings panel components like `displayLevel`, `personReference`)

- [ ] **Step 1: Locate the template settings panel**

Search for where `displayLevel` and `personReference` are edited in the template builder. Likely in a file like `template-settings-panel.tsx` or within `block-builder-client.tsx`.

- [ ] **Step 2: Add band scheme section**

Mirror the partner pattern: inherit (from partner) vs override (with `BandSchemeEditor`).

Add a save handler that calls `updateTemplateBandScheme(templateId, scheme or null)`.

- [ ] **Step 3: Verify**

Open a template in the builder, navigate to settings, verify the band scheme section works end-to-end. The preview should re-render with the new scheme when changed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: template settings band scheme section"
```

---

## Task 15: Final Verification & Cleanup

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Linter**

Run: `npx next lint`
Expected: no new warnings.

- [ ] **Step 3: End-to-end flow test**

In the browser:
1. Configure a 5-band scheme at the platform level
2. Verify a partner that inherits shows the 5-band scheme in its preview
3. Override the scheme at a partner level with a different palette
4. Verify a template under that partner inherits the partner's scheme
5. Override the scheme at the template level
6. Open the template preview and confirm all three levels respect the cascade
7. Verify indicator tier mapping works — a 5-band scheme with two "low" bands at the bottom should pull the low-tier indicator text for both

- [ ] **Step 4: Visual regression check**

Before/after the migration: open a template that existed pre-migration and confirm it renders identically (since all band_scheme columns default null and the platform default matches the old hardcoded behaviour).

- [ ] **Step 5: Commit any final cleanup**

```bash
git add -A
git commit -m "chore: final cleanup for custom band schemes"
```
