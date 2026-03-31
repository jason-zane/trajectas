# Report Rendering & Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the five-mode presentation system, chart library, brand theming, builder controls, and full-page preview for reports.

**Architecture:** Presentation modes are wrapper components that receive block content as children. Chart components are standalone SVG/HTML renderers consumed by score blocks. Brand report theme is a new property on `BrandConfig` that generates CSS custom properties via the existing token pipeline. The builder gains shared config controls (mode, chart type, columns) and a full-page preview route.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS, Supabase (JSONB), SVG for charts

**Spec:** `docs/superpowers/specs/2026-04-01-report-rendering-design.md`

---

## File Structure

### New Files

**Types & Config:**
- `src/lib/reports/presentation.ts` — `PresentationMode` and `ChartType` enums, `ReportTheme` interface, default report theme values
- `src/lib/reports/report-tokens.ts` — `generateReportCSSTokens(theme: ReportTheme)` → CSS custom properties string

**Presentation Mode Wrappers:**
- `src/components/reports/modes/featured-mode.tsx` — dark accent background wrapper
- `src/components/reports/modes/open-mode.tsx` — bare page wrapper with dividers
- `src/components/reports/modes/carded-mode.tsx` — bordered card grid wrapper
- `src/components/reports/modes/split-mode.tsx` — two-column wrapper
- `src/components/reports/modes/inset-mode.tsx` — recessed callout wrapper
- `src/components/reports/modes/mode-wrapper.tsx` — dispatcher that routes `presentationMode` to correct wrapper

**Chart Components:**
- `src/components/reports/charts/bar-chart.tsx` — horizontal bar chart with dot indicators
- `src/components/reports/charts/radar-chart.tsx` — SVG polygon radar/spider chart
- `src/components/reports/charts/gauge-chart.tsx` — semicircle arc gauges
- `src/components/reports/charts/segment-bar.tsx` — simple filled bar (no dot)
- `src/components/reports/charts/mini-bar.tsx` — thin inline bar for cards/tables
- `src/components/reports/charts/scorecard-table.tsx` — tabular layout with mini bars + badges
- `src/components/reports/charts/band-badge.tsx` — reusable high/mid/low band badge
- `src/components/reports/charts/grouped-bar-chart.tsx` — multi-rater grouped bars (360)
- `src/components/reports/charts/radar-overlay-chart.tsx` — multi-polygon radar (360)
- `src/components/reports/charts/gap-indicator.tsx` — diverging bar gap visualisation (360)

**Preview:**
- `src/app/(dashboard)/settings/reports/[id]/preview/page.tsx` — full-page preview route
- `src/app/(dashboard)/settings/reports/[id]/preview/loading.tsx` — shimmer loading state
- `src/lib/reports/sample-data.ts` — `generateSampleData(template)` utility

**Brand Settings:**
- `src/app/(dashboard)/settings/brand/report-theme-editor.tsx` — report theme colour editor with live preview panel

**Database:**
- `supabase/migrations/00050_report_presentation_system.sql` — brand_mode, page_header_logo, neutral person_reference

### Modified Files

- `src/lib/brand/types.ts` — add `reportTheme?: ReportTheme` to `BrandConfig`
- `src/lib/brand/defaults.ts` — add default `reportTheme` to `TALENT_FIT_DEFAULTS`
- `src/lib/brand/tokens.ts` — call `generateReportCSSTokens` inside `generateCSSTokens`
- `src/lib/reports/types.ts` — add `presentationMode`, `columns`, `chartType`, `insetAccent` to `BlockConfig`; add `resolvedBrandTheme` to `ResolvedBlockData`
- `src/lib/reports/registry.ts` — add `supportedModes`, `supportedCharts`, `defaultMode` to each `BlockMeta`
- `src/lib/reports/runner.ts` — resolve brand theme and freeze into snapshot `resolvedBrandTheme`
- `src/lib/reports/narrative.ts` — add `neutral` person reference sentence templates
- `src/types/database.ts` — add `PresentationMode`, `ChartType` types; add `neutral` to `PersonReferenceType`; add `BrandModeType`
- `src/components/reports/report-renderer.tsx` — wrap blocks in `ModeWrapper`, inject report theme CSS variables
- `src/components/reports/blocks/cover-page.tsx` — add primary/secondary logo, powered-by support
- `src/components/reports/blocks/score-overview.tsx` — use chart components based on `chartType`
- `src/components/reports/blocks/score-detail.tsx` — support all presentation modes and chart types
- `src/components/reports/blocks/strengths-highlights.tsx` — support presentation modes
- `src/components/reports/blocks/development-plan.tsx` — support presentation modes (timeline, cards)
- `src/components/reports/blocks/rater-comparison.tsx` — use grouped bar / 360 radar charts
- `src/components/reports/blocks/gap-analysis.tsx` — use gap indicator chart
- `src/components/reports/blocks/custom-text.tsx` — support inset mode
- `src/app/(dashboard)/settings/reports/[id]/builder/block-builder-client.tsx` — add shared config controls
- `src/app/actions/reports.ts` — add brand theme resolution for preview, brand_mode on campaign config
- `src/app/globals.css` — add print CSS for presentation modes

---

## Task 1: Foundation Types & Enums

**Files:**
- Create: `src/lib/reports/presentation.ts`
- Modify: `src/types/database.ts`
- Modify: `src/lib/reports/types.ts`

- [ ] **Step 1: Create presentation.ts with enums and interfaces**

```typescript
// src/lib/reports/presentation.ts

export const PRESENTATION_MODES = ['featured', 'open', 'carded', 'split', 'inset'] as const
export type PresentationMode = (typeof PRESENTATION_MODES)[number]

export const CHART_TYPES = ['bar', 'radar', 'gauges', 'segment', 'scorecard', 'grouped_bar', 'radar_360', 'gap'] as const
export type ChartType = (typeof CHART_TYPES)[number]

export interface ReportTheme {
  // Score colours
  reportHighBandFill: string
  reportMidBandFill: string
  reportLowBandFill: string
  reportHighBadgeBg: string
  reportHighBadgeText: string
  reportMidBadgeBg: string
  reportMidBadgeText: string
  reportLowBadgeBg: string
  reportLowBadgeText: string

  // Surfaces
  reportFeaturedBg: string
  reportFeaturedText: string
  reportFeaturedAccent: string
  reportInsetBg: string
  reportInsetBorder: string
  reportPageBg: string
  reportCardBg: string
  reportCardBorder: string
  reportDivider: string
  reportCtaBg: string
  reportCtaText: string

  // Typography
  reportHeadingColour: string
  reportBodyColour: string
  reportMutedColour: string
  reportLabelColour: string
  reportCoverAccent: string

  // Charts
  reportRadarFill: string
  reportRadarStroke: string
  reportRadarPoint: string
  reportBarDot: string

  // 360 rater colours
  reportRaterSelf: string
  reportRaterManager: string
  reportRaterPeers: string
  reportRaterDirects: string
  reportRaterOverall: string
}

export const DEFAULT_REPORT_THEME: ReportTheme = {
  // Score colours — sage for high, gold for mid, muted rose for low
  reportHighBandFill: '#2d6a5a',
  reportMidBandFill: '#c9a962',
  reportLowBandFill: '#b85c6a',
  reportHighBadgeBg: '#e8f0ed',
  reportHighBadgeText: '#2d6a5a',
  reportMidBadgeBg: '#f5f0e3',
  reportMidBadgeText: '#8b6914',
  reportLowBadgeBg: '#fce8e8',
  reportLowBadgeText: '#b84c4c',

  // Surfaces
  reportFeaturedBg: '#1e3a32',
  reportFeaturedText: '#ffffff',
  reportFeaturedAccent: '#c9a962',
  reportInsetBg: '#f3f2ee',
  reportInsetBorder: '#2d6a5a',
  reportPageBg: '#fafaf8',
  reportCardBg: '#ffffff',
  reportCardBorder: '#e8e6e1',
  reportDivider: '#e8e6e1',
  reportCtaBg: '#c9a962',
  reportCtaText: '#1e3a32',

  // Typography
  reportHeadingColour: '#1a1a1a',
  reportBodyColour: '#555555',
  reportMutedColour: '#999999',
  reportLabelColour: '#999999',
  reportCoverAccent: '#2d6a5a',

  // Charts
  reportRadarFill: 'rgba(45,106,90,0.12)',
  reportRadarStroke: '#2d6a5a',
  reportRadarPoint: '#2d6a5a',
  reportBarDot: '#2d6a5a',

  // 360 rater colours
  reportRaterSelf: '#2d6a5a',
  reportRaterManager: '#5b3fc5',
  reportRaterPeers: '#c9a962',
  reportRaterDirects: '#b85c6a',
  reportRaterOverall: '#666666',
}
```

- [ ] **Step 2: Add types to database.ts**

Add to `src/types/database.ts`:
```typescript
export type PresentationMode = 'featured' | 'open' | 'carded' | 'split' | 'inset'
export type ChartType = 'bar' | 'radar' | 'gauges' | 'segment' | 'scorecard' | 'grouped_bar' | 'radar_360' | 'gap'
export type BrandModeType = 'platform' | 'client' | 'custom'
```

Add `'neutral'` to the existing `PersonReferenceType` union.

- [ ] **Step 3: Update BlockConfig in types.ts**

In `src/lib/reports/types.ts`, add to the `BlockConfig` interface:
```typescript
presentationMode?: PresentationMode
columns?: 1 | 2 | 3
chartType?: ChartType
insetAccent?: string
```

Add to `ResolvedBlockData`:
```typescript
presentationMode?: PresentationMode
columns?: 1 | 2 | 3
chartType?: ChartType
insetAccent?: string
resolvedBrandTheme?: ReportTheme
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/presentation.ts src/types/database.ts src/lib/reports/types.ts
git commit -m "feat(reports): add presentation mode, chart type, and report theme type definitions"
```

---

## Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/00050_report_presentation_system.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add brand_mode to campaign_report_config
ALTER TABLE campaign_report_config
ADD COLUMN brand_mode text NOT NULL DEFAULT 'platform'
CHECK (brand_mode IN ('platform', 'client', 'custom'));

-- Add page_header_logo to report_templates
ALTER TABLE report_templates
ADD COLUMN page_header_logo text NOT NULL DEFAULT 'none'
CHECK (page_header_logo IN ('primary', 'secondary', 'none'));

-- Add 'neutral' to person_reference enum type
-- Note: person_reference uses a Postgres ENUM type, not a CHECK constraint
ALTER TYPE person_reference_type ADD VALUE IF NOT EXISTS 'neutral';
```

Note: Verify the enum type name by reading `00042_report_generation_system.sql`. Adjust if the enum is named differently.

- [ ] **Step 2: Push migration**

Run: `npm run db:push`
Expected: Migration applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00050_report_presentation_system.sql
git commit -m "feat(reports): add brand_mode, page_header_logo, neutral person_reference migration"
```

---

## Task 3: Report Theme in Brand System

**Files:**
- Modify: `src/lib/brand/types.ts`
- Modify: `src/lib/brand/defaults.ts`
- Create: `src/lib/reports/report-tokens.ts`
- Modify: `src/lib/brand/tokens.ts`

- [ ] **Step 1: Add ReportTheme to BrandConfig interface**

In `src/lib/brand/types.ts`, import `ReportTheme` from `@/lib/reports/presentation` and add to `BrandConfig`:
```typescript
reportTheme?: ReportTheme
```

- [ ] **Step 2: Add default reportTheme to TALENT_FIT_DEFAULTS**

In `src/lib/brand/defaults.ts`, import `DEFAULT_REPORT_THEME` and add:
```typescript
reportTheme: DEFAULT_REPORT_THEME,
```

- [ ] **Step 3: Create report-tokens.ts**

```typescript
// src/lib/reports/report-tokens.ts
import type { ReportTheme } from './presentation'

export function generateReportCSSTokens(theme: ReportTheme): string {
  const vars = Object.entries(theme)
    .map(([key, value]) => {
      // Convert camelCase to kebab-case CSS variable
      const cssVar = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      return `  --${cssVar}: ${value};`
    })
    .join('\n')

  return vars
}
```

This converts each `ReportTheme` property into a CSS custom property (e.g., `reportHighBandFill` becomes `--report-high-band-fill: #2d6a5a;`).

- [ ] **Step 4: Integrate into existing token pipeline**

In `src/lib/brand/tokens.ts`, inside the `generateCSSTokens` function, after the existing token generation:

1. Import `generateReportCSSTokens` from `@/lib/reports/report-tokens`
2. Import `DEFAULT_REPORT_THEME` from `@/lib/reports/presentation`
3. Resolve the report theme: `const reportTheme = brandConfig.reportTheme ?? DEFAULT_REPORT_THEME`
4. Append `generateReportCSSTokens(reportTheme)` to the CSS output string inside the `:root` block

- [ ] **Step 5: Verify CSS variables are generated**

Check that loading any page in dev produces the `--report-*` CSS variables in the `:root` styles. Open browser DevTools, Elements, computed styles on `<html>` element and search for `--report-`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/brand/types.ts src/lib/brand/defaults.ts src/lib/reports/report-tokens.ts src/lib/brand/tokens.ts
git commit -m "feat(reports): add report theme to brand system with CSS variable generation"
```

---

## Task 4: Block Registry Updates

**Files:**
- Modify: `src/lib/reports/registry.ts`

- [ ] **Step 1: Update BlockMeta interface**

Add to `BlockMeta` in `src/lib/reports/registry.ts`:
```typescript
supportedModes: PresentationMode[]
supportedCharts?: ChartType[]
defaultMode: PresentationMode
```

Import `PresentationMode` and `ChartType` from `@/lib/reports/presentation`.

- [ ] **Step 2: Update each registry entry**

Add `supportedModes`, `supportedCharts` (for score blocks), and `defaultMode` to each entry in `BLOCK_REGISTRY`. Follow the spec tables exactly:

```typescript
cover_page: {
  // ...existing fields
  supportedModes: ['featured'],
  defaultMode: 'featured',
},
score_overview: {
  // ...existing fields
  supportedModes: ['featured', 'open', 'split'],
  supportedCharts: ['bar', 'radar', 'gauges', 'radar_360'],
  defaultMode: 'open',
},
score_detail: {
  // ...existing fields
  supportedModes: ['featured', 'open', 'carded', 'split'],
  supportedCharts: ['bar', 'segment', 'scorecard'],
  defaultMode: 'open',
},
strengths_highlights: {
  supportedModes: ['featured', 'open', 'carded', 'split'],
  supportedCharts: ['bar', 'segment'],
  defaultMode: 'carded',
},
development_plan: {
  supportedModes: ['open', 'carded', 'split'],
  defaultMode: 'carded',
},
rater_comparison: {
  supportedModes: ['open', 'carded', 'split'],
  supportedCharts: ['grouped_bar', 'radar_360'],
  defaultMode: 'open',
},
gap_analysis: {
  supportedModes: ['open', 'split', 'inset'],
  supportedCharts: ['gap'],
  defaultMode: 'open',
},
open_comments: {
  supportedModes: ['open', 'inset'],
  defaultMode: 'open',
},
norm_comparison: {
  supportedModes: ['open', 'carded', 'split'],
  supportedCharts: ['bar', 'segment', 'scorecard'],
  defaultMode: 'carded',
  isDeferred: true,
},
custom_text: {
  supportedModes: ['open', 'inset'],
  defaultMode: 'open',
},
section_divider: {
  supportedModes: ['open'],
  defaultMode: 'open',
},
```

- [ ] **Step 3: Update cover_page defaultConfig**

Update `cover_page.defaultConfig` to match the new canonical config from the spec:
```typescript
defaultConfig: { showDate: true, subtitle: null, showPrimaryLogo: true, showSecondaryLogo: false, showPoweredBy: false, poweredByText: 'Powered by Talent Fit' }
```

- [ ] **Step 4: Update parseBlocks to set defaults**

In the `parseBlocks` function, for each block that lacks `presentationMode`, set it from `BLOCK_REGISTRY[block.type].defaultMode`. For `chartType`, prefer the existing `defaultConfig.chartType` if present (e.g., `score_overview` already defaults to `'radar'`), otherwise fall back to `supportedCharts[0]`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/registry.ts
git commit -m "feat(reports): add supported modes, chart types, and defaults to block registry"
```

---

## Task 5: Band Badge Component

**Files:**
- Create: `src/components/reports/charts/band-badge.tsx`

- [ ] **Step 1: Create the band badge component**

A reusable component used across all chart and block components to display band labels.

```tsx
// src/components/reports/charts/band-badge.tsx
'use client'

import { cn } from '@/lib/utils'

interface BandBadgeProps {
  band: 'high' | 'mid' | 'low'
  label: string
  className?: string
}

export function BandBadge({ band, label, className }: BandBadgeProps) {
  const bgVar = `var(--report-${band}-badge-bg)`
  const textVar = `var(--report-${band}-badge-text)`

  return (
    <span
      className={cn(
        'inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md',
        className
      )}
      style={{ background: bgVar, color: textVar }}
    >
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reports/charts/band-badge.tsx
git commit -m "feat(reports): add reusable BandBadge component"
```

---

## Task 6: Chart Components — Standard

**Files:**
- Create: `src/components/reports/charts/bar-chart.tsx`
- Create: `src/components/reports/charts/radar-chart.tsx`
- Create: `src/components/reports/charts/gauge-chart.tsx`
- Create: `src/components/reports/charts/segment-bar.tsx`
- Create: `src/components/reports/charts/mini-bar.tsx`
- Create: `src/components/reports/charts/scorecard-table.tsx`

Each chart component receives typed data (scores, entities, bands) and reads `--report-*` CSS variables for colours. All are `'use client'` components.

- [ ] **Step 1: Create bar-chart.tsx**

Horizontal bar chart with entity labels, track, fill, dot indicator, and band labels. Props:

```typescript
interface BarChartProps {
  items: { name: string; value: number; band: 'high' | 'mid' | 'low' }[]
  showBandLabels?: boolean  // "Developing" / "Effective" / "Highly Effective" beneath
  showScore?: boolean       // numeric value at end of bar
  variant?: 'light' | 'dark'  // dark = featured mode (white labels, dark bg)
  bandLabels?: { low: string; mid: string; high: string }
  className?: string
}
```

Renders:
- Left column: entity names (right-aligned)
- Right column: track (`--report-divider` bg), fill (colour from `--report-{band}-band-fill`), dot indicator (`--report-bar-dot`)
- Optional band labels row beneath

Reference the mockups in `.superpowers/brainstorm/` for exact styling. Use CSS variables throughout — no hardcoded colours.

- [ ] **Step 2: Create radar-chart.tsx**

SVG radar/spider chart. Props:

```typescript
interface RadarChartProps {
  items: { name: string; value: number }[]  // value 0-100
  size?: number  // default 240
  variant?: 'light' | 'dark'
  className?: string
}
```

Renders:
- Concentric grid rings (3 levels)
- Axis lines from centre to each vertex
- Data polygon with fill (`--report-radar-fill`) and stroke (`--report-radar-stroke`)
- Data points at vertices (`--report-radar-point`)
- Labels outside each vertex

Calculate vertex positions using `Math.cos`/`Math.sin` with angle = `(2 * Math.PI / n) * i - Math.PI / 2`.

- [ ] **Step 3: Create gauge-chart.tsx**

Semicircle arc gauge. Props:

```typescript
interface GaugeChartProps {
  items: { name: string; value: number; band: 'high' | 'mid' | 'low'; bandLabel: string }[]
  className?: string
}
```

Renders a row of semicircle arcs using SVG `<path>` with arc commands. Each gauge shows the entity name and a `BandBadge` beneath.

- [ ] **Step 4: Create segment-bar.tsx**

Simple filled bar without dot indicator. Props:

```typescript
interface SegmentBarProps {
  value: number  // 0-100
  band: 'high' | 'mid' | 'low'
  className?: string
}
```

Simpler than BarChart — just track + fill, used inline within cards and open-mode detail sections.

- [ ] **Step 5: Create mini-bar.tsx**

Thin bar (4-6px) for cards and tables. Props:

```typescript
interface MiniBarProps {
  value: number
  band: 'high' | 'mid' | 'low'
  className?: string
}
```

- [ ] **Step 6: Create scorecard-table.tsx**

Tabular layout with columns: entity name, parent dimension/category, mini bar, band badge. Props:

```typescript
interface ScorecardTableProps {
  items: {
    name: string
    parentName: string
    value: number
    band: 'high' | 'mid' | 'low'
    bandLabel: string
  }[]
  className?: string
}
```

Renders as an HTML `<table>` inside a card. Uses `MiniBar` and `BandBadge` components.

- [ ] **Step 7: Commit**

```bash
git add src/components/reports/charts/
git commit -m "feat(reports): add standard chart components (bar, radar, gauge, segment, mini-bar, scorecard)"
```

---

## Task 7: Chart Components — 360

**Files:**
- Create: `src/components/reports/charts/grouped-bar-chart.tsx`
- Create: `src/components/reports/charts/radar-overlay-chart.tsx`
- Create: `src/components/reports/charts/gap-indicator.tsx`

- [ ] **Step 1: Create grouped-bar-chart.tsx**

Multiple bars per entity grouped together. Props:

```typescript
interface GroupedBarChartProps {
  items: {
    name: string
    scores: { source: 'self' | 'manager' | 'peers' | 'direct_reports' | 'overall'; value: number }[]
  }[]
  visibleSources: string[]  // which rater sources to show
  className?: string
}
```

Each entity row shows 2-5 thin bars stacked vertically within a group. Colours from `--report-rater-self`, `--report-rater-manager`, etc. Legend at top.

- [ ] **Step 2: Create radar-overlay-chart.tsx**

Extends the radar chart concept with multiple polygons. Props:

```typescript
interface RadarOverlayChartProps {
  labels: string[]
  layers: { source: string; values: number[]; color: string; dashed?: boolean }[]
  size?: number
  variant?: 'light' | 'dark'
  className?: string
}
```

Uses the same geometry as `RadarChart` but renders multiple overlapping polygons.

- [ ] **Step 3: Create gap-indicator.tsx**

Diverging horizontal bars showing self vs. others gaps. Props:

```typescript
interface GapIndicatorProps {
  items: {
    name: string
    selfScore: number
    othersScore: number
    gapType: 'blind_spot' | 'hidden_strength' | 'aligned'
  }[]
  className?: string
}
```

Renders diverging bars from a centre line. Blind spots (self > others) extend right in one colour, hidden strengths (others > self) extend left in another.

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/charts/grouped-bar-chart.tsx src/components/reports/charts/radar-overlay-chart.tsx src/components/reports/charts/gap-indicator.tsx
git commit -m "feat(reports): add 360 chart components (grouped bar, radar overlay, gap indicator)"
```

---

## Task 8: Presentation Mode Wrappers

**Files:**
- Create: `src/components/reports/modes/featured-mode.tsx`
- Create: `src/components/reports/modes/open-mode.tsx`
- Create: `src/components/reports/modes/carded-mode.tsx`
- Create: `src/components/reports/modes/split-mode.tsx`
- Create: `src/components/reports/modes/inset-mode.tsx`
- Create: `src/components/reports/modes/mode-wrapper.tsx`

These are layout wrappers that provide the visual treatment. Block components render inside them.

- [ ] **Step 1: Create featured-mode.tsx**

```tsx
'use client'

import { cn } from '@/lib/utils'

interface FeaturedModeProps {
  children: React.ReactNode
  className?: string
}

export function FeaturedMode({ children, className }: FeaturedModeProps) {
  return (
    <div
      data-mode="featured"
      className={cn('px-10 py-12', className)}
      style={{
        background: 'var(--report-featured-bg)',
        color: 'var(--report-featured-text)',
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create open-mode.tsx**

```tsx
export function OpenMode({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-mode="open" className={cn('px-10 py-9', className)}>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Create carded-mode.tsx**

```tsx
interface CardedModeProps {
  children: React.ReactNode
  columns?: 1 | 2 | 3
  className?: string
}

export function CardedMode({ children, columns = 1, className }: CardedModeProps) {
  const gridClass = columns === 3 ? 'grid-cols-3' : columns === 2 ? 'grid-cols-2' : 'grid-cols-1'

  return (
    <div data-mode="carded" className={cn('px-10 py-9', className)}>
      <div className={cn('grid gap-4', gridClass)}>
        {children}
      </div>
    </div>
  )
}
```

Note: Some blocks in carded mode render a single card (e.g., development-plan), others render a grid of cards (e.g., score-detail with multiple entities). The block component decides how to use the grid. When a single card is needed, the block wraps its content in one card div and uses `columns={1}`.

- [ ] **Step 4: Create split-mode.tsx**

```tsx
interface SplitModeProps {
  left: React.ReactNode
  right: React.ReactNode
  className?: string
}

export function SplitMode({ left, right, className }: SplitModeProps) {
  return (
    <div data-mode="split" className={cn('px-10 py-9 grid grid-cols-2 gap-10 items-center', className)}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  )
}
```

Block components using split mode will need to provide `left` and `right` content rather than `children`.

- [ ] **Step 5: Create inset-mode.tsx**

```tsx
interface InsetModeProps {
  children: React.ReactNode
  accentColor?: string  // CSS colour value, defaults to --report-inset-border
  className?: string
}

export function InsetMode({ children, accentColor, className }: InsetModeProps) {
  return (
    <div data-mode="inset" className={cn('mx-10 my-9', className)}>
      <div
        className="rounded-xl p-7"
        style={{
          background: 'var(--report-inset-bg)',
          borderLeft: `3px solid ${accentColor || 'var(--report-inset-border)'}`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create mode-wrapper.tsx dispatcher**

```tsx
import type { PresentationMode } from '@/lib/reports/presentation'
import { FeaturedMode } from './featured-mode'
import { OpenMode } from './open-mode'
import { CardedMode } from './carded-mode'
import { SplitMode } from './split-mode'
import { InsetMode } from './inset-mode'

interface ModeWrapperProps {
  mode: PresentationMode
  columns?: 1 | 2 | 3
  insetAccent?: string
  children: React.ReactNode
  // Split mode content — block provides these when mode is 'split'
  splitLeft?: React.ReactNode
  splitRight?: React.ReactNode
  className?: string
}

export function ModeWrapper({ mode, columns, insetAccent, children, splitLeft, splitRight, className }: ModeWrapperProps) {
  switch (mode) {
    case 'featured':
      return <FeaturedMode className={className}>{children}</FeaturedMode>
    case 'open':
      return <OpenMode className={className}>{children}</OpenMode>
    case 'carded':
      return <CardedMode columns={columns} className={className}>{children}</CardedMode>
    case 'split':
      return <SplitMode left={splitLeft ?? children} right={splitRight ?? null} className={className} />
    case 'inset':
      return <InsetMode accentColor={insetAccent} className={className}>{children}</InsetMode>
    default:
      return <OpenMode className={className}>{children}</OpenMode>
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/reports/modes/
git commit -m "feat(reports): add presentation mode wrapper components"
```

---

## Task 9: Neutral Person Reference

**Files:**
- Modify: `src/lib/reports/narrative.ts`

- [ ] **Step 1: Add neutral sentence templates**

In `src/lib/reports/narrative.ts`, find the person reference substitution logic (the `{{person}}` token replacement). Add handling for `neutral`:

- When `personReference === 'neutral'`, use a separate set of sentence templates that restructure phrasing to be subjectless
- The `{{person}}` token is replaced with empty string
- Sentence openers like "You demonstrate..." become "This score reflects..." or "Strong capability in..."

Add a `NEUTRAL_TEMPLATES` map or modify the template selection logic to detect `neutral` and use alternative phrasing. The key templates to create:

```typescript
const NEUTRAL_SENTENCE_OPENERS: Record<string, string> = {
  high: 'This score reflects strong capability in',
  mid: 'This score indicates solid, developing capability in',
  low: 'This score suggests emerging capability in',
}
```

Adjust the `buildDerivedNarrative` function to check `personReference === 'neutral'` and use these openers instead of the person-prefixed ones.

- [ ] **Step 2: Verify existing tests pass (if any)**

Run: `npm run test -- --grep narrative` or check if narrative tests exist.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/narrative.ts
git commit -m "feat(reports): add neutral person reference sentence templates"
```

---

## Task 10: ReportRenderer Updates

**Files:**
- Modify: `src/components/reports/report-renderer.tsx`

- [ ] **Step 1: Import and integrate ModeWrapper**

Update `ReportRenderer` to:

1. Import `ModeWrapper` from `@/components/reports/modes/mode-wrapper`
2. For each block, read `block.presentationMode` (default to `'open'` if missing)
3. Wrap the block component output in `<ModeWrapper>`
4. If the block has a `resolvedBrandTheme`, inject it as inline CSS variables on the report container

```tsx
// Inside the render loop:
const BlockComponent = BLOCK_COMPONENTS[block.type]
if (!BlockComponent) return null

const mode = block.presentationMode ?? 'open'

return (
  <ModeWrapper
    key={block.blockId}
    mode={mode}
    columns={block.columns}
    insetAccent={block.insetAccent}
    className={block.printBreakBefore ? 'print:break-before-page' : undefined}
  >
    <BlockComponent data={block.data} mode={mode} chartType={block.chartType} />
  </ModeWrapper>
)
```

- [ ] **Step 2: Update BlockComponent type signature**

Update the `BlockComponent` type to accept optional `mode` and `chartType` props:

```typescript
type BlockComponent = (props: {
  data: Record<string, unknown>
  mode?: PresentationMode
  chartType?: ChartType
}) => React.ReactElement | null
```

Update all existing block components to accept (and initially ignore) these new props. They'll use them as each block is refactored in subsequent tasks.

- [ ] **Step 3: Add report theme CSS injection**

At the top of the report container, inject the resolved brand theme as CSS variables. Read `resolvedBrandTheme` from the first block that has it and convert to inline style:

```tsx
function themeToStyle(theme: ReportTheme): React.CSSProperties {
  const style: Record<string, string> = {}
  for (const [key, value] of Object.entries(theme)) {
    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
    style[cssVar] = value
  }
  return style as React.CSSProperties
}

// In the component:
const brandTheme = blocks.find(b => b.resolvedBrandTheme)?.resolvedBrandTheme
return (
  <div className={cn('report-container', className)} style={brandTheme ? themeToStyle(brandTheme) : undefined}>
    {/* ...blocks */}
  </div>
)
```

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/report-renderer.tsx src/components/reports/blocks/*.tsx
git commit -m "feat(reports): integrate presentation mode wrappers into ReportRenderer"
```

---

## Task 11: Refactor Block Components

**Files:**
- Modify: All files in `src/components/reports/blocks/`

This is the largest task. Each block component needs to:
1. Accept `mode` and `chartType` props
2. Adapt its rendering based on the mode (the wrapper handles the container; the block handles internal layout)
3. Use chart components instead of inline rendering
4. Read `--report-*` CSS variables for all colours

- [ ] **Step 1: Refactor cover-page.tsx**

Update to support:
- Primary/secondary logo positions
- `showPoweredBy` + `poweredByText`
- Reads logo URLs from `data.primaryLogoUrl`, `data.secondaryLogoUrl`
- `data.organizationName` as text fallback when no logo
- Always renders in featured mode (its only supported mode)

- [ ] **Step 2: Refactor score-overview.tsx**

This block currently renders a basic bar chart inline. Refactor to:
- Read `chartType` prop (default `'bar'`)
- When `bar`: render `<BarChart>` component
- When `radar`: render `<RadarChart>` component
- When `gauges`: render `<GaugeChart>` component
- Adapt internal layout based on `mode`:
  - `featured`: use light text, dark variant on charts
  - `open`: standard layout with section label
  - `split`: provide chart as one side, summary narrative as the other

- [ ] **Step 3: Refactor score-detail.tsx**

Currently renders all entities in a list. Refactor to:
- In `open` mode: entity name + band + bar + narrative stacked vertically, dividers between entities
- In `carded` mode: each entity as a card with mini-bar and band badge (the `ModeWrapper` grid handles column layout)
- In `featured` mode: single entity hero with large bar and narrative
- In `split` mode: chart on one side, narrative on the other
- Chart selection: `bar` (default), `segment` (no dot), `scorecard` (table layout)

- [ ] **Step 4: Refactor strengths-highlights.tsx**

- In `open` mode: numbered insights (01, 02, 03) in columns
- In `carded` mode: ranked cards (1, 2, 3) with band badge and narrative
- In `featured` mode: headline list of strength names with summary
- In `split` mode: bar chart of top strengths + narrative

- [ ] **Step 5: Refactor development-plan.tsx**

- In `open` mode: timeline layout with dots and connectors
- In `carded` mode: numbered icon cards (01, 02, 03) with related factors
- In `split` mode: recommendations on one side, related scores on the other

- [ ] **Step 6: Refactor rater-comparison.tsx**

- Use `GroupedBarChart` component when `chartType === 'grouped_bar'`
- Use `RadarOverlayChart` when `chartType === 'radar_360'`
- Read rater colours from CSS variables (`--report-rater-self`, etc.)
- In `carded` mode: render each entity as a card showing mini grouped bars or rater source comparison chips with scores

- [ ] **Step 7: Refactor gap-analysis.tsx**

- Use `GapIndicator` component
- In `open` mode: full-width diverging bars
- In `inset` mode: compact callout highlighting the most significant gaps

- [ ] **Step 8: Refactor custom-text.tsx and open-comments.tsx**

- `custom-text`: works in `open` (current) and `inset` (new — adds callout styling)
- `open-comments`: works in `open` (current) and `inset` (quoted format with accent border)

- [ ] **Step 9: Commit**

```bash
git add src/components/reports/blocks/
git commit -m "feat(reports): refactor all block components for presentation modes and chart types"
```

---

## Task 12: Runner — Brand Theme Resolution & Snapshot Freezing

**Files:**
- Modify: `src/lib/reports/runner.ts`

- [ ] **Step 1: Add brand theme resolution to the runner**

In `processSnapshot`, after fetching the template and campaign config:

1. Read `campaign_report_config.brand_mode` for the campaign
2. Based on `brand_mode`:
   - `platform`: use the platform brand config's `reportTheme` (fallback to `DEFAULT_REPORT_THEME`)
   - `client`: load the org's `brand_config` and read its `reportTheme` (fallback to platform defaults)
   - `custom`: load custom brand config for the campaign (future — for now, fallback to platform)
3. Attach `resolvedBrandTheme` to the **first block** in the resolved data array only (to avoid duplicating the full theme object across all blocks). Note: this is an implementation shortcut — the theme must always be present on the first block in the array. If a more robust approach is needed later, store it at the snapshot level outside the blocks array

- [ ] **Step 2: Pass presentation config through to resolved data**

In `resolveBlockData`, copy `presentationMode`, `columns`, `chartType`, and `insetAccent` from the `BlockConfig` to the `ResolvedBlockData` output. These are template-defined properties that need to survive into the frozen snapshot.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/runner.ts
git commit -m "feat(reports): resolve brand theme and freeze presentation config into snapshots"
```

---

## Task 13: Builder UI — Shared Config Controls

**Files:**
- Modify: `src/app/(dashboard)/settings/reports/[id]/builder/block-builder-client.tsx`

- [ ] **Step 1: Add presentation mode selector**

In the block config panel (right panel), add a select dropdown for `presentationMode`. Filter options by `BLOCK_REGISTRY[block.type].supportedModes`. Show the mode tag styling (coloured badges) in the dropdown options for visual reference.

- [ ] **Step 2: Add columns selector**

Show a `columns` select (1/2/3) only when `presentationMode === 'carded'`.

- [ ] **Step 3: Add chart type selector**

Show a `chartType` select only when the block type has `supportedCharts` in the registry. Filter options by `BLOCK_REGISTRY[block.type].supportedCharts`.

- [ ] **Step 4: Add inset accent colour picker**

Show a colour picker or preset selector only when `presentationMode === 'inset'`. Presets could be: sage (default), gold, violet — mapped to brand CSS variables.

- [ ] **Step 5: Update canvas block cards**

On each block card in the canvas (centre panel), show a small coloured mode tag (e.g., "FEATURED", "OPEN", "CARDED") so the template creator can see the visual rhythm at a glance.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/settings/reports/[id]/builder/block-builder-client.tsx
git commit -m "feat(reports): add presentation mode and chart type controls to template builder"
```

---

## Task 14: Full-Page Preview

**Files:**
- Create: `src/lib/reports/sample-data.ts`
- Create: `src/app/(dashboard)/settings/reports/[id]/preview/page.tsx`
- Create: `src/app/(dashboard)/settings/reports/[id]/preview/loading.tsx`

- [ ] **Step 1: Create sample data generator**

```typescript
// src/lib/reports/sample-data.ts
import type { ReportTemplate } from '@/types/database'
import type { ResolvedBlockData } from '@/lib/reports/types'
import type { ReportTheme } from '@/lib/reports/presentation'

export function generateSampleData(
  template: ReportTemplate,
  reportTheme: ReportTheme
): ResolvedBlockData[]
```

The function should handle all block types, generating appropriate mock data for each based on its `type` and `config`. Use realistic sample data:
- Participant: "Alex Morgan", date: today
- 5 sample dimensions with scores: 82, 74, 71, 58, 45 (mix of high/mid)
- 10 sample factors distributed under dimensions
- Sample narratives (2-3 sentences each)
- Sample strengths, development recommendations
- For 360: sample rater group scores

Use the `displayLevel` from the template to determine whether to generate dimension-level or factor-level data. Attach `resolvedBrandTheme` to the first block only.

Include edge cases: one very long entity name, one short narrative, one entity with no development suggestion.

- [ ] **Step 2: Create preview route**

Server component that:
1. Loads the template via `getReportTemplate(params.id)`
2. Resolves brand config via `getEffectiveBrand()`
3. Generates CSS tokens via `generateCSSTokens(brandConfig)`
4. Generates sample data via `generateSampleData(template, reportTheme)`
5. Renders with a sample banner at top ("Preview — showing sample data") and a link back to the builder
6. Injects CSS using the existing pattern (server-generated trusted CSS in a `<style>` tag, same approach as the assess report viewer at `src/app/assess/[token]/report/[snapshotId]/page.tsx`)
7. Renders `<ReportRenderer blocks={sampleBlocks} />`

- [ ] **Step 3: Add preview button to builder**

In `block-builder-client.tsx`, add a "Preview" button in the header area that links to `/settings/reports/${templateId}/preview` and opens in a new tab.

- [ ] **Step 4: Create loading.tsx for preview route**

Create `src/app/(dashboard)/settings/reports/[id]/preview/loading.tsx` with a shimmer layout matching the report structure (use `animate-shimmer` per CLAUDE.md guidelines).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/sample-data.ts "src/app/(dashboard)/settings/reports/[id]/preview/"
git commit -m "feat(reports): add full-page preview route with sample data generation"
```

---

## Task 15: Brand Settings — Report Theme Editor

**Files:**
- Create: `src/app/(dashboard)/settings/brand/report-theme-editor.tsx`
- Modify: brand settings page (find exact path — likely `src/app/(dashboard)/settings/brand/page.tsx`)

- [ ] **Step 1: Create report theme editor component**

A form with colour pickers grouped by category (Score Colours, Surfaces, Typography, Charts, 360 Raters). Uses the existing colour picker component if one exists in the codebase, otherwise a standard `<input type="color">` with hex display.

Each colour field maps to a `ReportTheme` property. The form state is initialised from the current brand config's `reportTheme` (or `DEFAULT_REPORT_THEME` if none set).

- [ ] **Step 2: Add live preview panel**

Below or beside the colour pickers, render a preview panel showing:
- A small featured block section (dark bg, heading, accent text)
- A horizontal bar chart with 3 items (one high, one mid, one low)
- A row of 3 band badges (high, mid, low)
- A small carded section with 2 cards
- A small inset callout

These use inline styles from the form state (not CSS variables) so they update in real-time as colours change.

- [ ] **Step 3: Wire save action**

On save, update the brand config's `reportTheme` property via the existing brand update action. The `reportTheme` object gets merged into the existing `config` JSONB.

- [ ] **Step 4: Add "Reports" tab/section to brand settings page**

Add the `ReportThemeEditor` as a new section or tab in the existing brand settings page.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/settings/brand/report-theme-editor.tsx src/app/(dashboard)/settings/brand/
git commit -m "feat(reports): add report theme editor with live preview to brand settings"
```

---

## Task 16: Cover Page Logo System

**Files:**
- Modify: `src/components/reports/blocks/cover-page.tsx`
- Modify: `src/lib/reports/runner.ts`

- [ ] **Step 1: Update cover page to handle logos**

Read from `data`:
- `primaryLogoUrl` — resolved at render time from brand config based on brand_mode
- `secondaryLogoUrl` — partner or platform logo for co-branding
- `showPrimaryLogo`, `showSecondaryLogo`, `showPoweredBy`, `poweredByText`
- `organizationName` — text fallback when no logo

Render:
- Primary logo at top (or org name in typographic treatment if no logo)
- Secondary logo smaller at bottom with "Powered by" text above it
- Cover page always uses featured mode styling

- [ ] **Step 2: Update runner to resolve logos**

In `runner.ts`, when processing the `cover_page` block:
- Based on `brand_mode`, resolve the correct logo URL:
  - `platform`: platform logo from brand config (`brandConfig.logoUrl`)
  - `client`: org logo from org's brand config
  - `custom`: custom logo URL (future — for now, fallback to platform)
- Set `primaryLogoUrl`, `secondaryLogoUrl`, `organizationName` in the resolved block data

- [ ] **Step 3: Commit**

```bash
git add src/components/reports/blocks/cover-page.tsx src/lib/reports/runner.ts
git commit -m "feat(reports): add primary/secondary logo and co-branding to cover page"
```

---

## Task 17: Campaign Brand Mode Selector

**Files:**
- Modify: `src/app/(dashboard)/campaigns/[id]/settings/report-config-panel.tsx`
- Modify: `src/app/actions/reports.ts`

- [ ] **Step 1: Add brand_mode selector to campaign report config panel**

In the campaign report settings panel (where template assignment happens), add a `brand_mode` select dropdown with options:
- Platform (default) — uses your platform's report colours
- Client — uses the organisation's brand colours
- Custom — per-campaign override (future — show as disabled with "Coming soon" label)

- [ ] **Step 2: Update upsertCampaignReportConfig action**

Include `brand_mode` in the upsert action. Read it from the form data and persist to the `brand_mode` column on `campaign_report_config`.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/campaigns/[id]/settings/report-config-panel.tsx src/app/actions/reports.ts
git commit -m "feat(reports): add brand_mode selector to campaign report configuration"
```

---

## Task 18: Print CSS Updates

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/reports/modes/*.tsx` (ensure `data-mode` attributes are set)

- [ ] **Step 1: Add print styles for presentation modes**

In `src/app/globals.css`, within the existing `@media print` block or `@page` rules:

```css
/* Featured mode keeps dark background in print */
[data-mode="featured"] {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* Carded and inset blocks avoid page breaks inside */
[data-mode="carded"],
[data-mode="inset"] {
  break-inside: avoid;
}
```

Verify that each mode wrapper component has the `data-mode` attribute set (should already be done in Task 8).

- [ ] **Step 2: Add page header logo for multi-page PDF**

If `template.pageHeaderLogo` is `'primary'` or `'secondary'`, render a fixed-position header element with the appropriate logo that appears on every page after the cover in print mode. Use CSS `position: running(pageHeader)` and `@page { @top-right { content: element(pageHeader) } }` for modern print engines, or a fixed-position `print:block hidden` fallback element.

Read the `pageHeaderLogo` template setting and conditionally render a `<div className="report-page-header hidden print:block">` containing the logo image and report title.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css src/components/reports/report-renderer.tsx
git commit -m "feat(reports): add print CSS for presentation modes and page header logo"
```

---

## Task 19: Update Seeded Templates

**Files:**
- Create: `supabase/migrations/00051_seed_presentation_modes.sql` (adjust number to next available)

- [ ] **Step 1: Write migration to update seeded template blocks**

Update the `blocks` JSONB on any seeded report templates to include `presentationMode` and `chartType` values. Check which seeded templates exist by reading migration `00042_report_generation_system.sql` or `00051_seed_report_ai_prompts.sql`.

Use the defaults from the block registry as a starting point, then adjust for a good default report layout:

- cover_page: `presentationMode: 'featured'`
- score_overview: `presentationMode: 'open'`, `chartType: 'bar'`
- score_detail: `presentationMode: 'open'`, `chartType: 'bar'`
- strengths_highlights: `presentationMode: 'carded'`
- development_plan: `presentationMode: 'carded'`

Use a SQL UPDATE with `jsonb_set` or rebuild the blocks array as needed.

- [ ] **Step 2: Push migration**

Run: `npm run db:push`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(reports): seed presentation modes on existing report templates"
```

---

## Task 20: Integration Verification

- [ ] **Step 1: Test full flow manually**

1. Start dev server: `npm run dev`
2. Go to Settings, Brand, Reports section. Verify colour pickers load with defaults. Change a colour, verify the preview updates. Save.
3. Go to Settings, Reports, pick a template, Builder. Verify new controls appear (presentation mode, chart type, columns).
4. Set blocks to different modes. Click Preview. Verify the full-page preview renders with sample data and correct brand colours.
5. Verify print preview looks correct (Cmd+P or `?format=print`).
6. Generate an actual report snapshot and verify it renders with the new presentation modes.

- [ ] **Step 2: Commit any fixes**

```bash
git add -u
git commit -m "fix(reports): integration fixes for presentation system"
```
