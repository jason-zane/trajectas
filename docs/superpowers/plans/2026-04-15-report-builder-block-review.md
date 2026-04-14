# Report Builder Block Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all block rendering issues, wire config toggles to preview, move headers inside mode wrappers, and fix builder-to-preview data flow so the live preview accurately reflects builder state.

**Architecture:** The report renderer (`report-renderer.tsx`) dispatches to block components via `BLOCK_COMPONENTS` registry. Each block receives `data` (resolved payload), `mode` (presentation mode), and `chartType`. The `ModeWrapper` handles visual chrome (featured/open/carded/split/inset). Headers currently render *above* the `ModeWrapper` — they need to move *inside* it. Sample data generation (`sample-data.ts`) must respect block config (display level, entity selection, toggle states) by filtering the `PreviewEntity[]` passed from the builder.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, Supabase (Postgres)

**Source:** `docs/report-block-review.md`

---

## Task 1: Move headers inside ModeWrapper (systemic fix)

**Files:**
- Modify: `src/components/reports/report-renderer.tsx`
- Modify: `src/components/reports/modes/mode-wrapper.tsx`
- Modify: `src/components/reports/modes/featured-mode.tsx`
- Modify: `src/components/reports/modes/open-mode.tsx`
- Modify: `src/components/reports/modes/carded-mode.tsx`
- Modify: `src/components/reports/modes/split-mode.tsx`
- Modify: `src/components/reports/modes/inset-mode.tsx`

Currently `report-renderer.tsx` renders headers (`eyebrow`, `heading`, `blockDescription`) in a `<div className="px-10 pt-9 space-y-1.5">` **above** the `ModeWrapper`. They need to render **inside** each mode's visual chrome so they inherit the correct background/text colours.

- [ ] **Step 1: Add header props to ModeWrapper**

In `mode-wrapper.tsx`, add `eyebrow`, `heading`, and `blockDescription` to the `ModeWrapperProps` interface. Pass them through to each mode component.

```tsx
interface ModeWrapperProps {
  mode: PresentationMode
  columns?: 1 | 2 | 3
  insetAccent?: string
  eyebrow?: string
  heading?: string
  blockDescription?: string
  children: React.ReactNode
  splitLeft?: React.ReactNode
  splitRight?: React.ReactNode
  className?: string
}
```

Pass `eyebrow`, `heading`, `blockDescription` to each mode component in the switch.

- [ ] **Step 2: Create a shared BlockHeaders helper**

Create a small inline component (or extract to a shared file if it gets large) that renders the three header fields. It accepts a `variant` prop: `'default'` (uses CSS vars for report colours) or `'featured'` (uses `currentColor` / opacity for light-on-dark).

```tsx
function BlockHeaders({
  eyebrow,
  heading,
  blockDescription,
  variant = 'default',
}: {
  eyebrow?: string
  heading?: string
  blockDescription?: string
  variant?: 'default' | 'featured'
}) {
  if (!eyebrow && !heading && !blockDescription) return null
  const isFeatured = variant === 'featured'
  return (
    <div className="space-y-1.5 mb-6">
      {eyebrow && (
        <p
          className="text-[10px] uppercase tracking-[2px]"
          style={{ color: isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-label-colour)' }}
        >
          {eyebrow}
        </p>
      )}
      {heading && (
        <h2
          className="text-xl font-semibold"
          style={{ color: isFeatured ? 'currentColor' : 'var(--report-heading-colour)' }}
        >
          {heading}
        </h2>
      )}
      {blockDescription && (
        <p
          className="text-sm"
          style={{ color: isFeatured ? 'rgba(255,255,255,0.7)' : 'var(--report-muted-colour)' }}
        >
          {blockDescription}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update each mode component to render headers**

Each mode component receives `eyebrow`, `heading`, `blockDescription` and renders `<BlockHeaders>` as its first child, inside its styled wrapper. `FeaturedMode` passes `variant="featured"`, all others pass `variant="default"`.

Example for `FeaturedMode`:
```tsx
export function FeaturedMode({ children, eyebrow, heading, blockDescription, className }: FeaturedModeProps) {
  return (
    <div data-mode="featured" className={cn('px-10 py-12', className)}
      style={{ background: 'var(--report-featured-bg)', color: 'var(--report-featured-text)' }}>
      <BlockHeaders eyebrow={eyebrow} heading={heading} blockDescription={blockDescription} variant="featured" />
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Remove header rendering from report-renderer.tsx**

Remove the `hasHeaders` block and the `<div className="px-10 pt-9 space-y-1.5">` that renders eyebrow/heading/blockDescription above ModeWrapper. Instead pass them as props to ModeWrapper:

```tsx
<ModeWrapper
  mode={mode}
  columns={block.columns}
  insetAccent={block.insetAccent}
  eyebrow={block.eyebrow}
  heading={block.heading}
  blockDescription={block.blockDescription}
>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```
feat: move block headers inside ModeWrapper for correct visual inheritance
```

---

## Task 2: Fix block ordering in preview

**Files:**
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx`

The builder stores blocks in a JS array where index = visual order. But `parseBlocks()` in the sample data generator sorts by `block.order`. When dragging, only the array position changes — `block.order` is not updated until save. The debounced preview needs to set `order` from the array index before calling `buildTemplatePreviewBlocks`.

- [ ] **Step 1: Set order from array index before preview generation**

In the `useEffect` that generates preview blocks, map the array to set `order` from index:

```tsx
useEffect(() => {
  const previewEntities = entityOptions.map((e) => ({ id: e.id, name: e.label, type: e.type }))
  const ordered = blocks.map((b, i) => ({ ...b, order: i }))
  const timeoutId = window.setTimeout(() => {
    setPreviewBlocks(buildTemplatePreviewBlocks(ordered, previewEntities, name))
  }, 500)
  return () => { window.clearTimeout(timeoutId) }
}, [blocks, entityOptions, name])
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```
fix: sync block order to preview by setting order from array index
```

---

## Task 3: Enhance entity options with hierarchy

**Files:**
- Modify: `src/app/actions/reports.ts` — `getEntityOptions` and `EntityOption`
- Modify: `src/lib/reports/sample-data.ts` — `PreviewEntity`

The sample data generator needs to know which dimension a factor belongs to, and which factors a construct belongs to, so display-level filtering and nested scores work. Extend `EntityOption` (and `PreviewEntity`) with an optional `parentId`.

- [ ] **Step 1: Add parentId to EntityOption**

```ts
export interface EntityOption {
  id: string
  label: string
  type: 'dimension' | 'factor' | 'construct'
  parentId?: string  // factor.dimension_id or construct's parent factor id
}
```

- [ ] **Step 2: Fetch parentId in getEntityOptions**

Change the factors query to include `dimension_id`:
```ts
db.from('factors').select('id, name, dimension_id').is('deleted_at', null).eq('is_active', true),
```

For constructs, join through `factor_constructs` to get the first parent factor:
```ts
db.from('constructs').select('id, name, factor_constructs(factor_id)').is('deleted_at', null).eq('is_active', true),
```

Map them:
```ts
...(factors ?? []).map((f) => ({
  id: f.id, label: f.name, type: 'factor' as const,
  parentId: f.dimension_id ?? undefined,
})),
...(constructs ?? []).map((c) => ({
  id: c.id, label: c.name, type: 'construct' as const,
  parentId: c.factor_constructs?.[0]?.factor_id ?? undefined,
})),
```

- [ ] **Step 3: Add parentId to PreviewEntity**

In `sample-data.ts`:
```ts
export interface PreviewEntity {
  id: string
  name: string
  type: 'dimension' | 'factor' | 'construct'
  parentId?: string
}
```

- [ ] **Step 4: Update the mapping in block-builder-client.tsx**

```ts
const previewEntities = entityOptions.map((e) => ({
  id: e.id, name: e.label, type: e.type, parentId: e.parentId,
}))
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```
feat: add parentId to entity options for hierarchy support
```

---

## Task 4: Wire sample data to respect config (display level, entity selection, custom text)

**Files:**
- Modify: `src/lib/reports/sample-data.ts`

The `generateBlockSampleData` function currently ignores `displayLevel` and `entityIds` config. It needs to filter `entities` by type and by explicit ID selection. Custom text should pass through user-entered content rather than returning hardcoded copy.

- [ ] **Step 1: Add entity filtering helper**

```ts
function filterEntities(
  entities: ScoredEntity[],
  config: Record<string, unknown>,
): ScoredEntity[] {
  let filtered = entities

  // Filter by display level (type)
  const displayLevel = config.displayLevel as string | undefined
  if (displayLevel) {
    filtered = filtered.filter((e) => e.type === displayLevel)
  }

  // Filter by explicit entity IDs
  const entityIds = Array.isArray(config.entityIds) ? config.entityIds as string[] : []
  if (entityIds.length > 0) {
    filtered = filtered.filter((e) => entityIds.includes(e.id))
  }

  return filtered
}
```

- [ ] **Step 2: Apply entity filtering to score_overview**

```ts
case 'score_overview': {
  const filtered = filterEntities(entities, config)
  return {
    scores: filtered.slice(0, 8).map((e) => ({
      entityId: e.id,
      entityName: e.name,
      pompScore: e.pompScore,
      bandResult: makeBandResult(e),
    })),
    config: {
      displayLevel: config.displayLevel ?? 'factor',
      showScore: config.showScore !== false,
      showBandLabel: config.showBandLabel !== false,
      groupByDimension: config.groupByDimension === true,
    },
  }
}
```

- [ ] **Step 3: Apply entity filtering to score_detail**

For score_detail, when no entities are selected, use the first entity matching the display level. If `showNestedScores` is true, include child entities as a `nestedScores` array keyed by parent. Use the multi-entity shape (`entities` array).

```ts
case 'score_detail': {
  const filtered = filterEntities(entities, config)
  if (filtered.length === 0) return { _empty: true }

  const detailEntities = filtered.map((e) => ({
    entityId: e.id,
    entityName: e.name,
    entitySlug: e.name.toLowerCase().replace(/\s+/g, '-'),
    definition: `A measure of capability and effectiveness in ${e.name.toLowerCase()}.`,
    pompScore: e.pompScore,
    bandResult: makeBandResult(e),
    narrative: strengthCommentaries[0],
    developmentSuggestion: developmentSuggestions[0],
  }))

  return {
    entities: detailEntities,
    config: {
      showScore: config.showScore !== false,
      showBandLabel: config.showBandLabel !== false,
      showDefinition: config.showDefinition !== false,
      showIndicators: config.showIndicators !== false,
      showDevelopment: config.showDevelopment === true,
      showNestedScores: config.showNestedScores === true,
    },
  }
}
```

- [ ] **Step 4: Apply entity filtering to strengths_highlights and development_plan**

Both should filter by `displayLevel` and `entityIds` before sorting and slicing.

- [ ] **Step 5: Fix custom_text to pass through user content**

For custom_text, read `config.content` and `config.heading`. Only use sample text as fallback when those are empty:

```ts
case 'custom_text':
  return {
    heading: (typeof config.heading === 'string' && config.heading) || '',
    content: (typeof config.content === 'string' && config.content)
      || `This report presents your results from the ${templateName}. The findings are based on your self-assessment responses and are intended as a development tool, not a definitive evaluation.`,
  }
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 7: Commit**

```
feat: wire display level, entity selection, and custom text through to preview
```

---

## Task 5: Fix cover page

**Files:**
- Modify: `src/components/reports/blocks/cover-page.tsx`
- Modify: `src/lib/reports/registry.ts`
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx` — hide headers tab for cover_page

The cover page has several issues: logo toggle not working (no logo URL in sample data, so the fallback shows nothing), card is too large, and it needs assessment/campaign/report name fields. Also remove the headers panel for cover_page since it has its own content fields.

- [ ] **Step 1: Shrink cover page card**

In `cover-page.tsx`, reduce `min-h-[300px]` to `min-h-[200px]` and `py-16` to `py-10`. Reduce `mb-12` on logo to `mb-8`. Reduce `mt-16` on powered-by to `mt-10`.

- [ ] **Step 2: Show a placeholder logo in preview**

In `sample-data.ts` cover_page case, add a `clientName` field (the template name or "Acme Corp") so the cover page's fallback renders the org name when there's no logo URL:

```ts
case 'cover_page':
  return {
    participantName: 'Alex Morgan',
    campaignTitle: templateName,
    clientName: 'Preview Organisation',
    generatedAt: new Date().toISOString(),
    showDate: config.showDate !== false,
    showLogo: config.showLogo !== false,
    ...
  }
```

- [ ] **Step 3: Hide headers tab for cover_page and section_divider**

In `block-builder-client.tsx`, find where the block tabs are rendered and conditionally exclude the headers tab for block types that don't support them. Look for the `BLOCK_TABS` array or where tabs are rendered. Add a check:

```ts
const BLOCKS_WITHOUT_HEADERS: BlockType[] = ['cover_page', 'section_divider']
```

Filter the tabs array to exclude `'headers'` when the block type is in this list.

- [ ] **Step 4: Remove headers and presentation panels for section_divider**

For section_divider, also hide the presentation tab since it has no mode/chart options. The simplest approach: filter the tabs list based on block type.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```
fix: cover page sizing, logo fallback, hide irrelevant tabs for cover/divider
```

---

## Task 6: Fix bar chart — remove dots, neutral band colours, score positioning

**Files:**
- Modify: `src/components/reports/charts/bar-chart.tsx`
- Modify: `src/lib/reports/presentation.ts` — new neutral band colour CSS vars

- [ ] **Step 1: Remove dot indicator from bar chart**

In `bar-chart.tsx`, delete the dot indicator `<div>` (the one with `w-4 h-4 rounded-full` at line ~66-73). Keep the fill bar.

- [ ] **Step 2: Move score to the far right of each row**

Currently the score sits inline with the name label (line 38-45). Move it to a third grid column at the far right of the bar track. Change the grid template:

```tsx
style={{ gridTemplateColumns: '140px 1fr 36px', gap: '12px' }}
```

Move the score `<span>` out of the name div and into its own column after the bar:

```tsx
{/* Score value */}
<div className="text-[13px] font-semibold tabular-nums text-right"
  style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'var(--report-heading-colour)' }}>
  {showScore ? item.value : ''}
</div>
```

Remove the inline score from the name label.

- [ ] **Step 3: Define neutral band colours**

In `presentation.ts`, replace the brand-based band fill colours in `DEFAULT_REPORT_THEME` with neutral, universally readable colours:

```ts
reportHighBandFill: '#3d8b72',  // muted teal-green
reportMidBandFill: '#d4a843',   // warm amber
reportLowBandFill: '#c75c5c',   // soft red-coral
```

Keep badge colours (bg/text) similarly neutral:
```ts
reportHighBadgeBg: '#e6f2ed',
reportHighBadgeText: '#2a6b52',
reportMidBadgeBg: '#faf3e0',
reportMidBadgeText: '#8a6510',
reportLowBadgeBg: '#fce8e8',
reportLowBadgeText: '#a94442',
```

- [ ] **Step 4: Fix showBandLabels to use real band labels**

In `score-overview.tsx`, the `showBandLabels` prop currently passes `bandLabels={{ low: 'Low', mid: 'Mid', high: 'High' }}` (the BarChart default). Pass the real band labels from the data:

The BarChart component already accepts a `bandLabels` prop. But the current approach renders Low/Mid/High at the bottom of the entire chart — this is actually band threshold labels, not per-item band labels. The user wants the actual band label (e.g., "Highly Proficient") shown per item. This requires the BarChart to optionally render a band badge per row. Add an optional `bandLabel` to each item:

```tsx
interface BarChartItem {
  name: string
  value: number
  band: 'high' | 'mid' | 'low'
  bandLabel?: string
}
```

When `showBandLabels` is true AND items have `bandLabel`, render a `BandBadge` in each row instead of the row of Low/Mid/High at the bottom.

- [ ] **Step 5: Pass bandLabel data from score-overview**

In `score-overview.tsx`, include `bandLabel` in the items passed to BarChart:

```tsx
items={d.scores.map((s) => ({
  name: s.entityName,
  value: s.pompScore,
  band: s.bandResult.band,
  bandLabel: s.bandResult.bandLabel,
}))}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 7: Commit**

```
fix: bar chart - remove dots, neutral band colours, move score to right, per-row band labels
```

---

## Task 7: Fix radar chart label clipping and toggle support

**Files:**
- Modify: `src/components/reports/charts/radar-chart.tsx`
- Modify: `src/components/reports/blocks/score-overview.tsx`

- [ ] **Step 1: Fix label clipping**

The radar chart SVG uses `viewBox="0 0 ${size} ${size}"` but labels extend beyond the viewBox. Fix by:
1. Increase the default `size` from 240 to 300
2. Reduce `maxRadius` to `size / 2 - 50` (more padding for labels)
3. Place labels at `maxRadius + 20` instead of `maxRadius + 16`
4. Add `overflow="visible"` to the SVG element

- [ ] **Step 2: Add showScore and showBandLabel support to radar chart**

Add optional props to `RadarChart`:
```tsx
interface RadarChartProps {
  items: { name: string; value: number; bandLabel?: string }[]
  size?: number
  variant?: 'light' | 'dark'
  showScore?: boolean
  showBandLabel?: boolean
  className?: string
}
```

When `showScore` is true, append the score value after the label text:
```tsx
<text ...>{item.name}{showScore ? ` (${item.value})` : ''}</text>
```

When `showBandLabel` is true and `bandLabel` exists, render a second `<text>` line below the label.

- [ ] **Step 3: Pass toggle props from score-overview**

In `score-overview.tsx`, pass `showScore` and `showBandLabel` from `d.config` to the RadarChart:

```tsx
<RadarChart
  items={d.scores.map((s) => ({ name: s.entityName, value: s.pompScore, bandLabel: s.bandResult.bandLabel }))}
  variant={isFeatured ? 'dark' : 'light'}
  showScore={d.config?.showScore !== false}
  showBandLabel={d.config?.showBandLabel !== false}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```
fix: radar chart label clipping and wire showScore/showBandLabel toggles
```

---

## Task 8: Fix gauge chart toggle support

**Files:**
- Modify: `src/components/reports/charts/gauge-chart.tsx`
- Modify: `src/components/reports/blocks/score-overview.tsx`

- [ ] **Step 1: Add showScore and showBandLabel props to GaugeChart**

```tsx
interface GaugeChartProps {
  items: { name: string; value: number; band: 'high' | 'mid' | 'low'; bandLabel: string }[]
  showScore?: boolean
  showBandLabel?: boolean
  className?: string
}
```

When `showScore`, render the score value inside/below the gauge arc. When `showBandLabel` is false, hide the `BandBadge`.

- [ ] **Step 2: Pass toggles from score-overview**

```tsx
<GaugeChart
  items={...}
  showScore={d.config?.showScore !== false}
  showBandLabel={d.config?.showBandLabel !== false}
/>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```
fix: gauge chart showScore and showBandLabel toggle support
```

---

## Task 9: Fix scorecard chart rendering in score_overview

**Files:**
- Modify: `src/components/reports/blocks/score-overview.tsx`
- Modify: `src/components/reports/charts/scorecard-table.tsx`

The scorecard chart type doesn't render because `score-overview.tsx` only has branches for `radar`, `gauges`, and `bar` — no `scorecard` branch.

- [ ] **Step 1: Add scorecard branch to score-overview**

```tsx
{resolvedChart === 'scorecard' && (
  <ScorecardTable
    items={d.scores.map((s) => ({
      name: s.entityName,
      parentName: '',  // TODO: populate with dimension name when hierarchy available
      value: s.pompScore,
      band: s.bandResult.band,
      bandLabel: s.bandResult.bandLabel,
    }))}
  />
)}
```

Import `ScorecardTable` at the top.

- [ ] **Step 2: Update scorecard to handle missing parentName gracefully**

In `scorecard-table.tsx`, hide the Dimension column when all items have empty `parentName`:

```tsx
const showParent = items.some((i) => i.parentName)
```

Conditionally render the column header and `<td>`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```
fix: add scorecard chart type to score overview block
```

---

## Task 10: Fix score detail — lock to segment, remove duplicate chart selector

**Files:**
- Modify: `src/lib/reports/registry.ts`
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx`

- [ ] **Step 1: Remove supportedCharts from score_detail in registry**

In `registry.ts`, remove the `supportedCharts` line from `score_detail`:

```ts
score_detail: {
  ...
  supportedModes: ['featured', 'open', 'carded', 'split'],
  // Remove: supportedCharts: ['bar', 'segment', 'scorecard'],
  defaultMode: 'open',
},
```

This means the presentation panel won't show a chart type selector (it checks `meta.supportedCharts`).

- [ ] **Step 2: Remove chart type selector from score detail content panel**

In `block-content-panels.tsx`, remove the "Chart type" `<Field>` and `<Select>` from `ScoreDetailContent` (lines ~439-461).

- [ ] **Step 3: Ensure score-detail.tsx always uses segment**

The `ScoreDetailBlock` component already has `const resolvedChart = chartType ?? 'bar'`. Change the default to `'segment'`:

```ts
const resolvedChart = chartType ?? 'segment'
```

In `src/components/reports/blocks/score-detail.tsx`.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```
fix: lock score detail to segment chart, remove duplicate chart selector
```

---

## Task 11: Fix custom text — add featured mode

**Files:**
- Modify: `src/lib/reports/registry.ts`

- [ ] **Step 1: Add 'featured' to custom_text supportedModes**

```ts
custom_text: {
  ...
  supportedModes: ['open', 'inset', 'featured'],
  defaultMode: 'open',
},
```

The `CustomTextBlock` component already handles featured mode with `resolvedMode === 'featured'` colour checks.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```
feat: add featured presentation mode for custom text blocks
```

---

## Task 12: Fix section divider

**Files:**
- Modify: `src/components/reports/blocks/section-divider.tsx`
- Modify: `src/lib/reports/registry.ts`

- [ ] **Step 1: Fix thick rule to full width**

Change thick rule from `w-20` to `w-full`:

```tsx
case 'thick_rule':
  return (
    <div className="mx-10 my-6">
      <div
        className="w-full border-t-[3px] rounded-full"
        style={{ borderColor: 'var(--report-divider)' }}
      />
    </div>
  )
```

Use `var(--report-divider)` instead of `border-primary` for neutral default. Add `mx-10 my-6` wrapper for consistent horizontal padding and vertical spacing.

Also wrap `thin_rule` in similar padding:
```tsx
case 'thin_rule':
default:
  return (
    <div className="mx-10 my-6">
      <div style={{ borderTop: '1px solid var(--report-divider)' }} />
    </div>
  )
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```
fix: section divider thick rule full width, neutral colour, consistent padding
```

---

## Task 13: Fix strengths highlights — remove scores/badges, fix consistency

**Files:**
- Modify: `src/components/reports/blocks/strengths-highlights.tsx`

- [ ] **Step 1: Remove scores and band badges from all layouts**

In `FeaturedLayout`: Remove `<span className="text-[11px] tabular-nums opacity-60 ml-2">{Math.round(h.pompScore)}</span>`.

In `CardedLayout`: Remove the `<BandBadge>` and its import.

In `OpenLayout`: No scores are currently shown — confirm this is already clean.

- [ ] **Step 2: Make numbered format consistent across modes**

All three modes should use the same numbering format. Standardise on the padded two-digit format (`01`, `02`, `03`) for open and carded, and a simple list for featured (no numbers, just bullet points with entity name + commentary).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```
fix: strengths highlights - remove scores/badges, consistent numbering
```

---

## Task 14: Fix column selector for carded mode

**Files:**
- Modify: `src/components/reports/blocks/strengths-highlights.tsx`
- Modify: `src/components/reports/blocks/score-detail.tsx`

The `columns` prop is handled by `CardedMode` which wraps children in a CSS grid. But the block components render their own internal layouts that don't respect the grid. For carded mode blocks, each item needs to be a separate grid child.

- [ ] **Step 1: Investigate current CardedMode behaviour**

`CardedMode` applies `grid grid-cols-{N}` to its children wrapper. This means the block component's children need to be multiple direct children (one per card). Currently `StrengthsHighlightsBlock` in carded mode wraps all items in a single `<div className="space-y-3">` — this is one grid child, so columns don't work.

Fix: In `CardedLayout` for strengths-highlights, return a React fragment with each card as a direct child (no wrapper div), so `CardedMode`'s grid can lay them out:

```tsx
function CardedLayout({ highlights }: { highlights: StrengthEntry[] }) {
  return (
    <>
      {highlights.map((h, i) => (
        <div key={h.entityId} className="border rounded-xl p-5 ..."
          style={{ ... }}>
          ...
        </div>
      ))}
    </>
  )
}
```

- [ ] **Step 2: Apply same pattern to score-detail carded layout**

In `score-detail.tsx`, the `CardedLayout` returns items wrapped in `<div className="space-y-6">` → change to fragment.

Actually, looking at `ScoreDetailBlock`, the carded mode renders each entity through `CardedLayout` which returns a single card — but the outer loop in `ScoreDetailBlock` wraps everything in `<div className="space-y-6">`. This means columns won't work. Move the loop inside each layout and return a fragment for carded mode.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```
fix: carded mode columns - render items as direct grid children
```

---

## Task 15: Inset accent configurable for all blocks with inset mode

**Files:**
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/block-presentation-panel.tsx`

Currently the inset accent colour picker only shows when `currentMode === 'inset'`. This is already correct — it shows conditionally. But we need to ensure all blocks that support `inset` mode actually list it in `supportedModes` in the registry. Check and verify:

- `custom_text`: supports `['open', 'inset', 'featured']` (after Task 11) ✓
- `ai_text`: supports `['open', 'featured', 'inset']` ✓
- Other blocks: check registry entries

- [ ] **Step 1: Verify all blocks that should support inset have it in supportedModes**

Review `registry.ts`. Blocks that make sense with inset: `custom_text`, `ai_text`, `score_detail`, `strengths_highlights`, `development_plan`. Currently `score_detail` doesn't have `inset` — it probably doesn't need it. Confirm current list is correct.

The inset accent picker in `block-presentation-panel.tsx` already works for any block in inset mode. No code changes needed if the registry is already correct.

- [ ] **Step 2: Verify by checking registry supportedModes**

No code change expected. Verify and move on.

- [ ] **Step 3: Commit (if any changes)**

---

## Task 16: Remove hard-coded "Score Overview" / "Key Strengths" / "Development Plan" labels from block components

**Files:**
- Modify: `src/components/reports/blocks/score-overview.tsx`
- Modify: `src/components/reports/blocks/strengths-highlights.tsx`
- Modify: `src/components/reports/blocks/development-plan.tsx`

Several blocks render their own hardcoded section labels (e.g., "Score Overview", "Key Strengths", "Development Plan") inside the component. Now that headers are rendered by ModeWrapper via eyebrow/heading/blockDescription, these internal labels are redundant and may conflict.

- [ ] **Step 1: Remove the hardcoded label from score-overview.tsx**

Remove the `<div className="text-[10px] uppercase tracking-[2px] mb-5" ...>Score Overview</div>` block.

- [ ] **Step 2: Remove hardcoded labels from strengths-highlights.tsx**

Remove "Key Strengths" labels from all three layouts (OpenLayout, CardedLayout, FeaturedLayout).

- [ ] **Step 3: Remove hardcoded labels from development-plan.tsx**

Remove "Development Plan" labels from all three layouts (TimelineLayout, CardedLayout, FeaturedLayout).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```
fix: remove hardcoded section labels from block components (headers now in ModeWrapper)
```

---

## Deferred Items (follow-up work)

These items from the review are **not covered in this plan** because they require significant additional design or data work:

1. **groupByDimension rendering logic** — The toggle is wired to config and sample data, but neither BarChart, RadarChart, nor GaugeChart currently implement grouped rendering (dimension headings with child factors underneath). This needs a separate design pass — likely a new `GroupedBarChart` component or a grouping wrapper. Tracked as follow-up.

2. **Behavioral indicators for score_detail** — The `showIndicators` toggle currently gates narrative text, but the review expects actual behavioral indicator content. This requires the runner to populate indicator data from the DB (the `indicators` field on factors/constructs). For preview, sample indicator data would need to be generated. Tracked as follow-up.

3. **Cover page data pulls** — The review asks for assessment name, campaign name, and report name on the cover page. Currently only `campaignTitle` and `participantName` are available. Adding assessment name requires knowing which assessment the campaign uses — this is a runner-side data fetch. The `clientName` fallback for logo is addressed in Task 5, but the full data pull expansion is follow-up.

---

## Execution Order

Tasks can be parallelised where they don't share files:

**Sequential dependencies:**
- Task 1 (headers in ModeWrapper) should come first — many other tasks reference header behaviour
- Task 3 (entity hierarchy) before Task 4 (wiring display level filtering)
- Task 6 (bar chart fixes) before Task 7 (radar) and Task 8 (gauges) — establishes pattern

**Can be parallelised:**
- Tasks 5, 10, 11, 12, 13, 15, 16 are mostly independent of each other
- Tasks 7, 8, 9 are independent of each other (different chart components)

**Recommended order:**
1. Task 1 — Headers in ModeWrapper (systemic)
2. Task 2 — Block ordering
3. Task 3 — Entity hierarchy
4. Task 4 — Sample data config wiring
5. Task 5 — Cover page fixes
6. Task 6 — Bar chart
7. Tasks 7, 8, 9 — Radar, gauge, scorecard (parallel)
8. Task 10 — Score detail lock to segment
9. Tasks 11, 12, 13, 14 — Custom text featured, divider, strengths, columns (parallel)
10. Task 15 — Inset accent verification
11. Task 16 — Remove hardcoded labels
