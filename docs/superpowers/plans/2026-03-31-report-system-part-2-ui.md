# Report Generation System — Part 2: UI + Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver all UI surfaces for the report system — block components, report viewers, PDF export, the template builder, campaign integration, and release gate.

**Architecture:** One `<ReportRenderer>` component reads `rendered_data` from a snapshot and maps each block to its React component via `BLOCK_REGISTRY`. Three audience-specific viewer routes share the same renderer. The builder manipulates `BlockConfig[]` in memory and saves to `report_templates.blocks` via `updateReportTemplateBlocks()`. Print mode is controlled by a `?format=print` URL param.

**Tech Stack:** Next.js 15 App Router, React, Tailwind CSS, shadcn/ui, Recharts (radar + bar charts), next/navigation, lucide-react, `html2canvas`/Puppeteer (PDF). Premium CLAUDE.md standards apply throughout.

**Dependency:** Part 1 must be complete before starting this plan (`npx tsc --noEmit` passes, DB migration 00041 applied).

**Read first:** Before writing any Next.js route, read `node_modules/next/dist/docs/` for current App Router conventions.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/reports/` | Create dir | All report UI components |
| `src/components/reports/report-renderer.tsx` | Create | Maps `ResolvedBlockData[]` to block components |
| `src/components/reports/blocks/cover-page.tsx` | Create | Cover page block |
| `src/components/reports/blocks/custom-text.tsx` | Create | Freeform text/markdown block |
| `src/components/reports/blocks/section-divider.tsx` | Create | Visual section break |
| `src/components/reports/blocks/score-overview.tsx` | Create | Radar/bars overview chart |
| `src/components/reports/blocks/score-detail.tsx` | Create | Single entity detail with narrative |
| `src/components/reports/blocks/strengths-highlights.tsx` | Create | Top-N strengths cards/list |
| `src/components/reports/blocks/development-plan.tsx` | Create | Prioritised development suggestions |
| `src/components/reports/blocks/norm-comparison.tsx` | Create | Deferred stub with info message |
| `src/components/reports/blocks/rater-comparison.tsx` | Create | 360 grouped bars |
| `src/components/reports/blocks/gap-analysis.tsx` | Create | Blind spots + hidden strengths |
| `src/components/reports/blocks/open-comments.tsx` | Create | Anonymised rater comments |
| `src/app/(dashboard)/reports/[snapshotId]/page.tsx` | Create | Admin/partner viewer |
| `src/app/(dashboard)/reports/[snapshotId]/loading.tsx` | Create | Admin viewer loading state |
| `src/app/client/reports/[snapshotId]/page.tsx` | Create | Client (HR manager) viewer |
| `src/app/assess/[token]/report/[snapshotId]/page.tsx` | Create | Participant viewer |
| `src/app/api/reports/[snapshotId]/pdf/route.ts` | Create | Puppeteer PDF generation |
| `src/app/(dashboard)/settings/reports/page.tsx` | Create | Template library |
| `src/app/(dashboard)/settings/reports/[id]/builder/page.tsx` | Create | Block builder (three-panel) |
| `src/app/(dashboard)/settings/reports/[id]/builder/block-config-panel.tsx` | Create | Right-panel config editor |
| `src/app/actions/reports.ts` | Modify | Add `getReportSnapshotsForSession` |
| `src/components/app-sidebar.tsx` | Modify | Add "Reports" under Settings |

---

## Task 1: Block Components — Meta Blocks

**Files:**
- Create: `src/components/reports/blocks/cover-page.tsx`
- Create: `src/components/reports/blocks/custom-text.tsx`
- Create: `src/components/reports/blocks/section-divider.tsx`

These blocks are print-safe (no interactive elements).

- [ ] **Step 1: Write `cover-page.tsx`**

```tsx
// src/components/reports/blocks/cover-page.tsx
import type { CoverPageConfig } from '@/lib/reports/types'

interface CoverPageData extends CoverPageConfig {
  participantName?: string
  campaignTitle?: string
  partnerLogoUrl?: string
  generatedAt?: string
}

export function CoverPageBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as CoverPageData
  const date = d.showDate && d.generatedAt
    ? new Date(d.generatedAt).toLocaleDateString('en-AU', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-16 text-center print:min-h-screen print:py-24">
      {d.showLogo && d.partnerLogoUrl && (
        <img src={d.partnerLogoUrl} alt="Partner logo" className="h-12 mb-12 object-contain" />
      )}
      <div className="space-y-4">
        {d.participantName && (
          <h1 className="text-4xl font-semibold tracking-tight">{d.participantName}</h1>
        )}
        {d.subtitle && (
          <p className="text-xl text-muted-foreground">{d.subtitle}</p>
        )}
        {d.campaignTitle && (
          <p className="text-lg text-muted-foreground">{d.campaignTitle}</p>
        )}
        {date && (
          <p className="text-sm text-muted-foreground mt-8">{date}</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `custom-text.tsx`**

Use `react-markdown` (already in package.json) or a simple inline markdown renderer. Check `package.json` for available markdown packages. If none, render plain text with newlines preserved.

```tsx
// src/components/reports/blocks/custom-text.tsx
// Check if react-markdown is available: grep '"react-markdown"' package.json
// If available, use it. Otherwise use a <pre>-style whitespace-preserved div.

interface CustomTextData {
  heading?: string
  content: string
}

export function CustomTextBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as CustomTextData
  return (
    <div className="space-y-3">
      {d.heading && (
        <h2 className="text-xl font-semibold">{d.heading}</h2>
      )}
      <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
        {d.content}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `section-divider.tsx`**

```tsx
// src/components/reports/blocks/section-divider.tsx
interface SectionDividerData {
  title: string
  subtitle?: string
}

export function SectionDividerBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as SectionDividerData
  return (
    <div className="py-8 border-b border-border">
      <h2 className="text-2xl font-semibold">{d.title}</h2>
      {d.subtitle && <p className="text-muted-foreground mt-1">{d.subtitle}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/blocks/cover-page.tsx src/components/reports/blocks/custom-text.tsx src/components/reports/blocks/section-divider.tsx
git commit -m "feat: add meta block components — cover page, custom text, section divider"
```

---

## Task 2: Block Components — Score Blocks

**Files:**
- Create: `src/components/reports/blocks/score-overview.tsx`
- Create: `src/components/reports/blocks/score-detail.tsx`

These are the most important blocks — used in every template.

- [ ] **Step 1: Check available charting libraries**

```bash
grep -E '"recharts|"chart\.js|"@nivo' package.json
```

Use whatever is available. If none, use a plain horizontal bar implemented with Tailwind (a `div` with `width: ${score}%` works fine for print).

- [ ] **Step 2: Write `score-overview.tsx`**

Key decisions:
- `chartType: 'radar'` → use Recharts `<RadarChart>` (client component, `"use client"`)
- `chartType: 'bars'` → horizontal bars (can be server-rendered with Tailwind)
- For print: wrap chart in `print:hidden` and render a Tailwind bar version as `hidden print:block`

```tsx
// src/components/reports/blocks/score-overview.tsx
'use client'

import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { ScoreOverviewConfig } from '@/lib/reports/types'
import type { BandResult } from '@/lib/reports/types'

interface ScoreEntry {
  entityId: string
  entityName: string
  pompScore: number
  bandResult: BandResult
}

interface ScoreOverviewData {
  scores: ScoreEntry[]
  config: ScoreOverviewConfig
}

export function ScoreOverviewBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as ScoreOverviewData
  const { scores, config } = d

  if (!scores?.length) return null

  const chartData = scores.map((s) => ({
    subject: s.entityName,
    score: Math.round(s.pompScore),
    fullMark: 100,
  }))

  if (config.chartType === 'radar') {
    return (
      <div className="space-y-4">
        {/* Radar chart — hidden in print, replaced by bars */}
        <div className="h-[360px] print:hidden">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
              />
              <Tooltip formatter={(v: number) => [`${v}`, 'Score']} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {/* Print-only bar fallback */}
        <div className="hidden print:block space-y-2">
          {scores.map((s) => (
            <ScoreBarRow key={s.entityId} entry={s} />
          ))}
        </div>
      </div>
    )
  }

  // bars mode
  return (
    <div className="space-y-2">
      {scores.map((s) => (
        <ScoreBarRow key={s.entityId} entry={s} />
      ))}
    </div>
  )
}

function ScoreBarRow({ entry }: { entry: ScoreEntry }) {
  return (
    <div className="grid grid-cols-[200px_1fr_60px] items-center gap-4">
      <span className="text-sm font-medium truncate">{entry.entityName}</span>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${entry.pompScore}%` }}
        />
      </div>
      <span className="text-sm tabular-nums text-right text-muted-foreground">
        {Math.round(entry.pompScore)}
      </span>
    </div>
  )
}
```

- [ ] **Step 3: Write `score-detail.tsx`**

This is the primary workhorse block. It shows: score bar, band label badge, definition, narrative paragraph, development suggestion.

```tsx
// src/components/reports/blocks/score-detail.tsx
import type { ScoreDetailConfig, BandResult, Band } from '@/lib/reports/types'

interface ScoreDetailData {
  entityId: string
  entityName: string
  entitySlug: string
  definition?: string
  pompScore: number
  bandResult: BandResult
  narrative: string | null
  developmentSuggestion: string | null
  config: ScoreDetailConfig
  _empty?: boolean
}

const BAND_STYLES: Record<Band, string> = {
  low: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  mid: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  high: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
}

export function ScoreDetailBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as ScoreDetailData
  if (d._empty) return null

  const { config, bandResult } = d

  return (
    <div className="space-y-4 py-2 break-inside-avoid">
      {/* Header: entity name + score */}
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold">{d.entityName}</h3>
        {config.showScore && (
          <div className="flex items-center gap-2 shrink-0">
            {config.showBandLabel && (
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${BAND_STYLES[bandResult.band]}`}
              >
                {bandResult.bandLabel}
              </span>
            )}
            <span className="text-2xl font-bold tabular-nums text-primary">
              {Math.round(d.pompScore)}
            </span>
          </div>
        )}
      </div>

      {/* Score bar */}
      {config.showScore && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${d.pompScore}%` }}
          />
        </div>
      )}

      {/* Definition */}
      {config.showDefinition && d.definition && (
        <p className="text-sm text-muted-foreground italic">{d.definition}</p>
      )}

      {/* Narrative */}
      {(config.showIndicators || config.showDefinition) && d.narrative && (
        <p className="text-sm leading-relaxed">{d.narrative}</p>
      )}

      {/* Development suggestion */}
      {config.showDevelopment && d.developmentSuggestion && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">Development</p>
          <p className="text-sm">{d.developmentSuggestion}</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/blocks/score-overview.tsx src/components/reports/blocks/score-detail.tsx
git commit -m "feat: add score block components — overview chart and detail with narrative"
```

---

## Task 3: Block Components — Highlight + Deferred Blocks

**Files:**
- Create: `src/components/reports/blocks/strengths-highlights.tsx`
- Create: `src/components/reports/blocks/development-plan.tsx`
- Create: `src/components/reports/blocks/norm-comparison.tsx`

- [ ] **Step 1: Write `strengths-highlights.tsx`**

```tsx
// src/components/reports/blocks/strengths-highlights.tsx
interface StrengthEntry {
  entityId: string
  entityName: string
  pompScore: number
}

interface StrengthsData {
  highlights: StrengthEntry[]
  config: { topN: number; style: 'cards' | 'list' }
}

export function StrengthsHighlightsBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as StrengthsData
  if (!d.highlights?.length) return null

  if (d.config.style === 'cards') {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">Key Strengths</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {d.highlights.map((h) => (
            <div
              key={h.entityId}
              className="rounded-xl border border-border bg-card p-4 text-center space-y-2"
            >
              <p className="text-2xl font-bold text-primary tabular-nums">
                {Math.round(h.pompScore)}
              </p>
              <p className="text-sm font-medium">{h.entityName}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // list style
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Key Strengths</h3>
      <ul className="space-y-2">
        {d.highlights.map((h, i) => (
          <li key={h.entityId} className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground w-5">{i + 1}.</span>
            <span className="text-sm font-medium flex-1">{h.entityName}</span>
            <span className="text-sm tabular-nums text-primary font-semibold">
              {Math.round(h.pompScore)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Write `development-plan.tsx`**

```tsx
// src/components/reports/blocks/development-plan.tsx
interface DevelopmentItem {
  entityId: string
  entityName: string
  pompScore: number
  suggestion: string | null
}

interface DevelopmentData {
  items: DevelopmentItem[]
  config: { maxItems: number }
}

export function DevelopmentPlanBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as DevelopmentData
  if (!d.items?.length) return null

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Development Plan</h3>
      {d.items.map((item, i) => (
        <div key={item.entityId} className="flex gap-4">
          <div className="flex-none w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
            {i + 1}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{item.entityName}</p>
            {item.suggestion && (
              <p className="text-sm text-muted-foreground">{item.suggestion}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write `norm-comparison.tsx` (deferred stub)**

```tsx
// src/components/reports/blocks/norm-comparison.tsx
export function NormComparisonBlock() {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
      Norm comparison data is not yet available. This block will appear once norm groups are configured for this assessment.
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/blocks/strengths-highlights.tsx src/components/reports/blocks/development-plan.tsx src/components/reports/blocks/norm-comparison.tsx
git commit -m "feat: add highlight block components — strengths, development plan, norm stub"
```

---

## Task 4: Block Components — 360 Blocks

**Files:**
- Create: `src/components/reports/blocks/rater-comparison.tsx`
- Create: `src/components/reports/blocks/gap-analysis.tsx`
- Create: `src/components/reports/blocks/open-comments.tsx`

Note: 360 blocks receive data with `_360: true` from the runner until full 360 rater data resolution is implemented. Render an informative placeholder if data is not yet available.

- [ ] **Step 1: Write `rater-comparison.tsx`**

```tsx
// src/components/reports/blocks/rater-comparison.tsx
// Shows grouped bars: self vs manager vs peers vs direct_reports per factor

const RATER_LABELS: Record<string, string> = {
  self: 'Self',
  manager: 'Manager',
  peers: 'Peers',
  direct_reports: 'Direct Reports',
}

const RATER_COLORS: Record<string, string> = {
  self: 'hsl(var(--primary))',
  manager: 'hsl(var(--chart-2, 210 100% 56%))',
  peers: 'hsl(var(--chart-3, 160 60% 45%))',
  direct_reports: 'hsl(var(--chart-4, 30 80% 55%))',
}

interface RaterEntry {
  entityName: string
  scores: Record<string, number>  // raterGroup → pompScore
}

interface RaterComparisonData {
  entries?: RaterEntry[]
  raterGroups: string[]
  _360?: boolean
}

export function RaterComparisonBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as RaterComparisonData

  if (d._360 || !d.entries?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
        Rater comparison data will appear here once 360 responses are collected and scored.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Rater Comparison</h3>
      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {d.raterGroups.map((rg) => (
          <div key={rg} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ background: RATER_COLORS[rg] ?? 'hsl(var(--muted-foreground))' }} />
            {RATER_LABELS[rg] ?? rg}
          </div>
        ))}
      </div>
      {/* Grouped bars */}
      <div className="space-y-3">
        {d.entries.map((entry) => (
          <div key={entry.entityName} className="space-y-1">
            <p className="text-sm font-medium">{entry.entityName}</p>
            {d.raterGroups.map((rg) => {
              const score = entry.scores[rg]
              if (score === undefined) return null
              return (
                <div key={rg} className="grid grid-cols-[80px_1fr_40px] items-center gap-2">
                  <span className="text-xs text-muted-foreground">{RATER_LABELS[rg] ?? rg}</span>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${score}%`, background: RATER_COLORS[rg] ?? 'hsl(var(--primary))' }} />
                  </div>
                  <span className="text-xs tabular-nums text-right">{Math.round(score)}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `gap-analysis.tsx`**

```tsx
// src/components/reports/blocks/gap-analysis.tsx
interface GapItem {
  entityName: string
  selfScore: number
  othersScore: number
  gap: number
  type: 'blind_spot' | 'hidden_strength'
}

interface GapAnalysisData {
  blindSpots?: GapItem[]
  hiddenStrengths?: GapItem[]
  _360?: boolean
}

export function GapAnalysisBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as GapAnalysisData

  if (d._360 || (!d.blindSpots?.length && !d.hiddenStrengths?.length)) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
        Gap analysis will appear here once 360 responses are collected and scored.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {d.blindSpots && d.blindSpots.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-amber-600">Potential Blind Spots</h4>
          <p className="text-xs text-muted-foreground">Areas where self-rating exceeds others&apos; ratings</p>
          {d.blindSpots.map((item) => (
            <div key={item.entityName} className="flex items-center justify-between text-sm">
              <span>{item.entityName}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                Self: {Math.round(item.selfScore)} · Others: {Math.round(item.othersScore)}
              </span>
            </div>
          ))}
        </div>
      )}
      {d.hiddenStrengths && d.hiddenStrengths.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-emerald-600">Hidden Strengths</h4>
          <p className="text-xs text-muted-foreground">Areas where others rate higher than self-rating</p>
          {d.hiddenStrengths.map((item) => (
            <div key={item.entityName} className="flex items-center justify-between text-sm">
              <span>{item.entityName}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                Self: {Math.round(item.selfScore)} · Others: {Math.round(item.othersScore)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write `open-comments.tsx`**

```tsx
// src/components/reports/blocks/open-comments.tsx
interface CommentGroup {
  factorName?: string
  comments: string[]
}

interface OpenCommentsData {
  groups?: CommentGroup[]
  minRatersForDisplay: number
  _360?: boolean
}

export function OpenCommentsBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as OpenCommentsData

  if (d._360 || !d.groups?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
        Open comments will appear here once sufficient rater responses are collected (minimum {d.minRatersForDisplay ?? 3} per group for anonymity).
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Open Comments</h3>
      {d.groups.map((group, i) => (
        <div key={i} className="space-y-3">
          {group.factorName && (
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {group.factorName}
            </h4>
          )}
          <ul className="space-y-2">
            {group.comments.map((comment, j) => (
              <li key={j} className="text-sm pl-4 border-l-2 border-muted">
                &ldquo;{comment}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/blocks/rater-comparison.tsx src/components/reports/blocks/gap-analysis.tsx src/components/reports/blocks/open-comments.tsx
git commit -m "feat: add 360 block components — rater comparison, gap analysis, open comments"
```

---

## Task 5: ReportRenderer + Print CSS

**Files:**
- Create: `src/components/reports/report-renderer.tsx`
- Modify: `src/app/globals.css` (add `@page` print rule)

The renderer is a client component (uses `useSearchParams` to detect `?format=print`).

- [ ] **Step 1: Write `report-renderer.tsx`**

```tsx
// src/components/reports/report-renderer.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { CoverPageBlock } from './blocks/cover-page'
import { CustomTextBlock } from './blocks/custom-text'
import { SectionDividerBlock } from './blocks/section-divider'
import { ScoreOverviewBlock } from './blocks/score-overview'
import { ScoreDetailBlock } from './blocks/score-detail'
import { StrengthsHighlightsBlock } from './blocks/strengths-highlights'
import { DevelopmentPlanBlock } from './blocks/development-plan'
import { NormComparisonBlock } from './blocks/norm-comparison'
import { RaterComparisonBlock } from './blocks/rater-comparison'
import { GapAnalysisBlock } from './blocks/gap-analysis'
import { OpenCommentsBlock } from './blocks/open-comments'
import type { ResolvedBlockData, BlockType } from '@/lib/reports/types'

type BlockComponent = (props: { data: Record<string, unknown> }) => React.ReactElement | null

const BLOCK_COMPONENTS: Record<BlockType, BlockComponent> = {
  cover_page: CoverPageBlock,
  custom_text: CustomTextBlock,
  section_divider: SectionDividerBlock,
  score_overview: ScoreOverviewBlock,
  score_detail: ScoreDetailBlock,
  strengths_highlights: StrengthsHighlightsBlock,
  development_plan: DevelopmentPlanBlock,
  norm_comparison: NormComparisonBlock,
  rater_comparison: RaterComparisonBlock,
  gap_analysis: GapAnalysisBlock,
  open_comments: OpenCommentsBlock,
}

interface ReportRendererProps {
  blocks: ResolvedBlockData[]
  className?: string
}

export function ReportRenderer({ blocks, className }: ReportRendererProps) {
  const searchParams = useSearchParams()
  const isPrint = searchParams.get('format') === 'print'

  return (
    <div
      data-print={isPrint ? 'true' : undefined}
      className={`space-y-8 ${className ?? ''}`}
    >
      {blocks
        .filter((block) => !block.skipped)
        .filter((block) => isPrint ? !block.printHide : !block.screenHide)
        .map((block) => {
          const Component = BLOCK_COMPONENTS[block.type]
          if (!Component) return null

          return (
            <div
              key={block.blockId}
              className={block.printBreakBefore ? 'print:break-before-page' : ''}
            >
              <Component data={block.data} />
            </div>
          )
        })}
    </div>
  )
}
```

- [ ] **Step 2: Add print CSS to `src/app/globals.css`**

Find `globals.css` and add at the bottom:

```css
/* ============================================================
   Report print styles
   ============================================================ */
@media print {
  @page {
    margin: 20mm;
    size: A4;
  }

  /* Hide everything that isn't the report */
  nav,
  header,
  aside,
  [data-sidebar],
  .print\:hidden {
    display: none !important;
  }

  /* Report container fills page */
  [data-print="true"] {
    max-width: 100%;
    padding: 0;
  }

  /* Prevent awkward page breaks */
  .break-inside-avoid {
    break-inside: avoid;
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/report-renderer.tsx src/app/globals.css
git commit -m "feat: add ReportRenderer — block mapping, print mode, print CSS"
```

---

## Task 6: Admin/Partner Viewer Route

**Files:**
- Create: `src/app/(dashboard)/reports/[snapshotId]/page.tsx`
- Create: `src/app/(dashboard)/reports/[snapshotId]/loading.tsx`

Consultant sees `ready` + `released` snapshots. Includes a "Download PDF" button and a "Release" button when status = `ready`.

**Read first:** `node_modules/next/dist/docs/` — verify async params pattern for App Router.

- [ ] **Step 1: Write the loading state**

```tsx
// src/app/(dashboard)/reports/[snapshotId]/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function ReportLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 p-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-[400px] w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}
```

- [ ] **Step 2: Write the page**

```tsx
// src/app/(dashboard)/reports/[snapshotId]/page.tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Download, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/page-header'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { getReportSnapshot } from '@/app/actions/reports'
import { ReleaseSnapshotButton } from './release-snapshot-button'
import type { ResolvedBlockData } from '@/lib/reports/types'

interface Props {
  params: Promise<{ snapshotId: string }>
  searchParams: Promise<{ format?: string }>
}

export default async function ReportViewerPage({ params, searchParams }: Props) {
  const { snapshotId } = await params
  const { format } = await searchParams
  const isPrint = format === 'print'

  const snapshot = await getReportSnapshot(snapshotId)
  if (!snapshot) notFound()
  if (!['ready', 'released'].includes(snapshot.status)) notFound()

  const blocks = (snapshot.renderedData ?? []) as ResolvedBlockData[]

  if (isPrint) {
    // Minimal chrome for print/PDF
    return (
      <div className="p-0">
        <ReportRenderer blocks={blocks} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <PageHeader
        eyebrow="Reports"
        title="Report Preview"
        description={`${snapshot.audienceType} audience · ${snapshot.narrativeMode}`}
      >
        <div className="flex items-center gap-2">
          {snapshot.status === 'ready' && (
            <ReleaseSnapshotButton snapshotId={snapshotId} />
          )}
          {snapshot.pdfUrl && (
            <a href={snapshot.pdfUrl} download>
              <Button variant="outline">
                <Download className="size-4" />
                Download PDF
              </Button>
            </a>
          )}
        </div>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card shadow-sm p-8">
        <Suspense>
          <ReportRenderer blocks={blocks} />
        </Suspense>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `release-snapshot-button.tsx`**

```tsx
// src/app/(dashboard)/reports/[snapshotId]/release-snapshot-button.tsx
'use client'

import { useTransition } from 'react'
import { CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { releaseSnapshot } from '@/app/actions/reports'

export function ReleaseSnapshotButton({ snapshotId }: { snapshotId: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <Button
      disabled={isPending}
      onClick={() => startTransition(async () => {
        await releaseSnapshot(snapshotId)
        toast.success('Report released')
      })}
    >
      <CheckCircle className="size-4" />
      {isPending ? 'Releasing…' : 'Release Report'}
    </Button>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/reports/
git commit -m "feat: add admin report viewer — release button, print mode, PDF download"
```

---

## Task 7: Client (HR Manager) Viewer Route

**Files:**
- Create: `src/app/client/reports/[snapshotId]/page.tsx`

This route lives on the client surface. It only shows `released_at IS NOT NULL` snapshots for `hr_manager` audience. Use the existing client surface auth pattern.

- [ ] **Step 1: Write the page**

Follow the same pattern as the admin viewer. Key differences:
- No release button (HR managers cannot release)
- No admin navigation — uses client surface layout
- Still shows PDF download if `pdfUrl` is set
- Renders `notFound()` if `released_at` is null

Read `src/app/client/` to understand the existing client surface layout before writing this file.

```tsx
// src/app/client/reports/[snapshotId]/page.tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { getReportSnapshot } from '@/app/actions/reports'
import type { ResolvedBlockData } from '@/lib/reports/types'

interface Props {
  params: Promise<{ snapshotId: string }>
}

export default async function ClientReportViewerPage({ params }: Props) {
  const { snapshotId } = await params
  const snapshot = await getReportSnapshot(snapshotId)
  if (!snapshot || !snapshot.releasedAt || snapshot.audienceType !== 'hr_manager') {
    notFound()
  }

  const blocks = (snapshot.renderedData ?? []) as ResolvedBlockData[]

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 p-6">
      {snapshot.pdfUrl && (
        <div className="flex justify-end">
          <a href={snapshot.pdfUrl} download>
            <Button variant="outline">
              <Download className="size-4" />
              Download PDF
            </Button>
          </a>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card shadow-sm p-8">
        <Suspense>
          <ReportRenderer blocks={blocks} />
        </Suspense>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/client/reports/
git commit -m "feat: add client surface report viewer for HR managers"
```

---

## Task 8: Participant Viewer Route

**Files:**
- Create: `src/app/assess/[token]/report/[snapshotId]/page.tsx`

This replaces the existing `ReportScreen` placeholder. Token-based auth (same as the rest of the assess surface). Only renders if `released_at IS NOT NULL` and `audience_type = 'participant'`.

- [ ] **Step 1: Read the existing assess surface**

Read `src/app/assess/[token]/` to understand the token-auth pattern before writing the file.

- [ ] **Step 2: Write the page**

```tsx
// src/app/assess/[token]/report/[snapshotId]/page.tsx
// Follow token-auth pattern from the rest of src/app/assess/[token]/
// Key: token validates the participant — if valid, check snapshot.audienceType === 'participant'
//      and snapshot.releasedAt is not null before rendering

import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { getReportSnapshot } from '@/app/actions/reports'
import type { ResolvedBlockData } from '@/lib/reports/types'

interface Props {
  params: Promise<{ token: string; snapshotId: string }>
}

export default async function ParticipantReportPage({ params }: Props) {
  const { snapshotId } = await params
  // Token validation is handled by the assess layout — assume participant is authenticated
  const snapshot = await getReportSnapshot(snapshotId)
  if (!snapshot || !snapshot.releasedAt || snapshot.audienceType !== 'participant') {
    notFound()
  }

  const blocks = (snapshot.renderedData ?? []) as ResolvedBlockData[]

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 p-6">
      {snapshot.pdfUrl && (
        <div className="flex justify-end">
          <a href={snapshot.pdfUrl} download>
            <Button variant="outline">
              <Download className="size-4" />
              Download Report
            </Button>
          </a>
        </div>
      )}
      <div className="space-y-8">
        <Suspense>
          <ReportRenderer blocks={blocks} />
        </Suspense>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/assess/
git commit -m "feat: add participant report viewer on assess surface"
```

---

## Task 9: PDF Generation API Route

**Files:**
- Create: `src/app/api/reports/[snapshotId]/pdf/route.ts`

Puppeteer renders the admin viewer with `?format=print` and stores the result in Supabase Storage.

**Install Puppeteer if not present:**
```bash
grep '"puppeteer' package.json  # check if already installed
npm install puppeteer-core @sparticuz/chromium  # serverless-safe Puppeteer
```

- [ ] **Step 1: Write the PDF route**

```typescript
// src/app/api/reports/[snapshotId]/pdf/route.ts
import { requireAdminScope, AuthenticationRequiredError, AuthorizationError } from '@/lib/auth/authorization'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  try {
    await requireAdminScope()
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  const { snapshotId } = await params

  try {
    // Dynamic import — Puppeteer is only available in Node.js runtime
    const chromium = await import('@sparticuz/chromium')
    const puppeteer = await import('puppeteer-core')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const url = `${appUrl}/reports/${snapshotId}?format=print`

    const browser = await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    })

    const page = await browser.newPage()
    // Inject service-role auth cookie
    const serviceJwt = process.env.SUPABASE_SERVICE_JWT
    if (serviceJwt) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const host = new URL(supabaseUrl).host
      await page.setCookie({ name: 'sb-access-token', value: serviceJwt, domain: host })
    }

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' } })
    await browser.close()

    // Upload to Supabase Storage
    const db = await createAdminClient()
    const storagePath = `reports/${snapshotId}.pdf`
    const { error: uploadError } = await db.storage
      .from('reports')
      .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true })

    if (uploadError) throw uploadError

    const { data: urlData } = db.storage.from('reports').getPublicUrl(storagePath)

    // Update snapshot with pdf_url
    await db
      .from('report_snapshots')
      .update({ pdf_url: urlData.publicUrl })
      .eq('id', snapshotId)

    return Response.json({ pdfUrl: urlData.publicUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF generation failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
```

**Note:** If `@sparticuz/chromium` is not feasible (e.g. local dev), use a simple `puppeteer` package and adjust `executablePath` to the local Chrome. Add `SUPABASE_SERVICE_JWT` to `.env.example`. Create the `reports` storage bucket in Supabase if it doesn't exist.

- [ ] **Step 2: Add `SUPABASE_SERVICE_JWT` to `.env.example`**

```bash
echo "SUPABASE_SERVICE_JWT=" >> .env.example
```

- [ ] **Step 3: Verify TypeScript compiles (errors about Puppeteer types are acceptable at this stage)**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reports/ .env.example
git commit -m "feat: add PDF generation API route via Puppeteer + Supabase Storage"
```

---

## Task 10: Template Library Page

**Files:**
- Create: `src/app/(dashboard)/settings/reports/page.tsx`
- Create: `src/app/(dashboard)/settings/reports/loading.tsx`

Follows the CLAUDE.md premium UI standards: `PageHeader`, table or card grid, `ScrollReveal`, interactive cards with `TiltCard` if using grid layout.

- [ ] **Step 1: Write `loading.tsx`**

```tsx
// src/app/(dashboard)/settings/reports/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function ReportTemplatesLoading() {
  return (
    <div className="space-y-8 max-w-5xl">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `page.tsx`**

Use a card grid (same premium pattern as Constructs/Factors pages). Each card: template name, report type badge, block count, description, actions (clone, edit, delete).

Key imports needed: `getReportTemplates`, `cloneReportTemplate`, `deleteReportTemplate` from actions/reports, `TiltCard`, `ScrollReveal`, `Card` with `variant="interactive"`.

```tsx
// src/app/(dashboard)/settings/reports/page.tsx
import Link from 'next/link'
import { Plus, FileText, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import { ScrollReveal } from '@/components/scroll-reveal'
import { TiltCard } from '@/components/tilt-card'
import { EmptyState } from '@/components/empty-state'
import { getReportTemplates } from '@/app/actions/reports'
import { CreateTemplateButton } from './create-template-button'
import { CloneTemplateButton } from './clone-template-button'
import { DeleteTemplateButton } from './delete-template-button'

export default async function ReportTemplatesPage() {
  const templates = await getReportTemplates()

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Settings"
        title="Report Templates"
        description="Configure reusable report layouts for each audience. Each template is audience-specific."
      >
        <CreateTemplateButton />
      </PageHeader>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create your first report template to start configuring reports for your campaigns."
          actionLabel="Create Template"
          actionHref="/settings/reports/new"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template, index) => (
            <ScrollReveal key={template.id} delay={index * 60}>
              <TiltCard>
                <Card variant="interactive" className="group/card h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover/card:shadow-[0_0_20px_var(--glow-color)] transition-shadow duration-300" style={{ '--glow-color': 'var(--primary)' } as React.CSSProperties}>
                        <FileText className="size-5" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {template.reportType === '360' ? '360°' : 'Self-Report'}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mt-2">
                      <Link href={`/settings/reports/${template.id}/builder`} className="hover:text-primary transition-colors">
                        {template.name}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {template.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                    )}
                    <p className="text-caption">
                      {template.blocks.length} block{template.blocks.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <Link href={`/settings/reports/${template.id}/builder`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">Edit</Button>
                      </Link>
                      <CloneTemplateButton templateId={template.id} />
                      {!template.partnerId && (
                        <span className="text-xs text-muted-foreground">Platform</span>
                      )}
                      {template.partnerId && (
                        <DeleteTemplateButton templateId={template.id} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TiltCard>
            </ScrollReveal>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write client action buttons**

Create three small `"use client"` wrappers following the `DeleteRunButton` pattern:
- `create-template-button.tsx` — opens a dialog to collect name + report_type, calls `createReportTemplate`, redirects to builder
- `clone-template-button.tsx` — icon button, calls `cloneReportTemplate`, toast
- `delete-template-button.tsx` — icon button, `ConfirmDialog`, calls `deleteReportTemplate`, toast

These follow the exact patterns in `src/app/(dashboard)/generate/delete-run-button.tsx` — read that file before writing.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/settings/reports/
git commit -m "feat: add report template library page — card grid with create/clone/delete"
```

---

## Task 11: Block Builder Page

**Files:**
- Create: `src/app/(dashboard)/settings/reports/[id]/builder/page.tsx`
- Create: `src/app/(dashboard)/settings/reports/[id]/builder/block-config-panel.tsx`

Three-panel layout: palette (left) | canvas (centre) | config (right). The canvas is client-side — drag reorder + block selection.

**Important:** This is the most complex UI in the plan. Keep state minimal — the source of truth is the `blocks` array in the database. Save on every meaningful change (add, remove, reorder, config update) via `updateReportTemplateBlocks()`.

- [ ] **Step 1: Write `page.tsx` (server wrapper)**

```tsx
// src/app/(dashboard)/settings/reports/[id]/builder/page.tsx
import { notFound } from 'next/navigation'
import { getReportTemplate } from '@/app/actions/reports'
import { BlockBuilderClient } from './block-builder-client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BuilderPage({ params }: Props) {
  const { id } = await params
  const template = await getReportTemplate(id)
  if (!template) notFound()

  return <BlockBuilderClient template={template} />
}
```

- [ ] **Step 2: Write `block-builder-client.tsx` (three-panel client component)**

This is a `"use client"` component. State: `blocks` (working copy of template.blocks), `selectedBlockId`.

Three panels use CSS grid: `grid-cols-[220px_1fr_300px]`.

Key behaviors:
- **Left panel (Palette):** List of all block types from `BLOCK_REGISTRY`, grouped by category. Click to add a new block with `defaultConfig`. Deferred blocks shown greyed out.
- **Centre panel (Canvas):** Ordered list of current blocks. Each row: drag handle, block label, key config summary, delete button. Click row to select (shows config in right panel). Drag to reorder using `@dnd-kit/sortable` (check if available) or simple up/down arrow buttons.
- **Right panel (Config):** Shows `<BlockConfigPanel>` for the selected block. Changes update the block in state and auto-save via `updateReportTemplateBlocks` with 500ms debounce.
- **Top bar:** Template name (read-only display), Preview button (opens `/reports/{previewSnapshotId}?format=print` in new tab — note: preview requires a real snapshot), Save button (manual save + toast).

```tsx
// src/app/(dashboard)/settings/reports/[id]/builder/block-builder-client.tsx
'use client'

import { useState, useCallback, useTransition } from 'react'
import { Plus, Trash2, GripVertical, Eye, Save } from 'lucide-react'
import { toast } from 'sonner'
import { v4 as uuid } from 'uuid'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BLOCK_REGISTRY, BLOCK_CATEGORIES, parseBlocks } from '@/lib/reports/registry'
import { updateReportTemplateBlocks } from '@/app/actions/reports'
import { BlockConfigPanel } from './block-config-panel'
import type { ReportTemplate } from '@/types/database'
import type { BlockConfig, BlockType } from '@/lib/reports/types'

interface Props {
  template: ReportTemplate
}

export function BlockBuilderClient({ template }: Props) {
  const [blocks, setBlocks] = useState<BlockConfig[]>(
    () => parseBlocks(template.blocks as Record<string, unknown>[])
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null

  const save = useCallback((newBlocks: BlockConfig[]) => {
    startTransition(async () => {
      await updateReportTemplateBlocks(template.id, newBlocks as unknown as Record<string, unknown>[])
      toast.success('Template saved')
    })
  }, [template.id])

  const addBlock = (type: BlockType) => {
    const meta = BLOCK_REGISTRY[type]
    const newBlock: BlockConfig = {
      id: uuid(),
      type,
      order: blocks.length + 1,
      config: meta.defaultConfig as BlockConfig['config'],
    }
    const updated = [...blocks, newBlock]
    setBlocks(updated)
    setSelectedId(newBlock.id)
    save(updated)
  }

  const removeBlock = (id: string) => {
    const updated = blocks.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i + 1 }))
    setBlocks(updated)
    if (selectedId === id) setSelectedId(null)
    save(updated)
  }

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const idx = blocks.findIndex((b) => b.id === id)
    if (idx === -1) return
    const newBlocks = [...blocks]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= newBlocks.length) return
    ;[newBlocks[idx], newBlocks[swapIdx]] = [newBlocks[swapIdx], newBlocks[idx]]
    const reordered = newBlocks.map((b, i) => ({ ...b, order: i + 1 }))
    setBlocks(reordered)
    save(reordered)
  }

  const updateBlockConfig = (id: string, config: Record<string, unknown>) => {
    const updated = blocks.map((b) => b.id === id ? { ...b, config } as BlockConfig : b)
    setBlocks(updated)
    save(updated)
  }

  // Group palette by category
  const paletteGroups = Object.entries(BLOCK_CATEGORIES)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([cat, meta]) => ({
      cat,
      label: meta.label,
      blocks: Object.entries(BLOCK_REGISTRY)
        .filter(([, m]) => m.category === cat)
        .map(([type, m]) => ({ type: type as BlockType, ...m })),
    }))

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div>
          <h1 className="font-semibold">{template.name}</h1>
          <p className="text-xs text-muted-foreground">
            {template.reportType === '360' ? '360°' : 'Self-Report'} · {template.displayLevel} level
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => save(blocks)} disabled={isPending}>
            <Save className="size-4" />
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex-1 grid grid-cols-[220px_1fr_300px] overflow-hidden">
        {/* Left: Palette */}
        <div className="border-r border-border overflow-y-auto p-4 space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Block</p>
          {paletteGroups.map((group) => (
            <div key={group.cat} className="space-y-1">
              <p className="text-xs text-muted-foreground">{group.label}</p>
              {group.blocks.map((b) => (
                <button
                  key={b.type}
                  disabled={!!b.isDeferred}
                  onClick={() => !b.isDeferred && addBlock(b.type)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {b.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Centre: Canvas */}
        <div className="overflow-y-auto p-6 space-y-2">
          {blocks.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-16">
              Add blocks from the palette on the left.
            </div>
          )}
          {blocks.map((block, idx) => {
            const meta = BLOCK_REGISTRY[block.type]
            const isSelected = block.id === selectedId
            return (
              <div
                key={block.id}
                onClick={() => setSelectedId(block.id)}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
              >
                <GripVertical className="size-4 text-muted-foreground/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{meta.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{meta.description}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'up') }}
                    disabled={idx === 0}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  >↑</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'down') }}
                    disabled={idx === blocks.length - 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  >↓</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeBlock(block.id) }}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Right: Config panel */}
        <div className="border-l border-border overflow-y-auto p-4">
          {selectedBlock ? (
            <BlockConfigPanel
              block={selectedBlock}
              onChange={(config) => updateBlockConfig(selectedBlock.id, config)}
            />
          ) : (
            <div className="text-center text-muted-foreground text-sm py-8">
              Select a block to configure it.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `block-config-panel.tsx`**

Renders config fields per block type. Use `Input`, `Switch`, `Select` from shadcn/ui. Each change fires `onChange` immediately (no save button in the panel — save is debounced in the parent).

```tsx
// src/app/(dashboard)/settings/reports/[id]/builder/block-config-panel.tsx
'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BLOCK_REGISTRY } from '@/lib/reports/registry'
import type { BlockConfig } from '@/lib/reports/types'

interface Props {
  block: BlockConfig
  onChange: (config: Record<string, unknown>) => void
}

export function BlockConfigPanel({ block, onChange }: Props) {
  const meta = BLOCK_REGISTRY[block.type]
  const config = block.config as Record<string, unknown>

  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value })

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold text-sm">{meta.label}</p>
        <p className="text-xs text-muted-foreground">{meta.description}</p>
      </div>

      {/* cover_page config */}
      {block.type === 'cover_page' && (
        <>
          <ConfigSwitch label="Show date" value={config.showDate as boolean} onChange={(v) => set('showDate', v)} />
          <ConfigSwitch label="Show logo" value={config.showLogo as boolean} onChange={(v) => set('showLogo', v)} />
          <ConfigInput label="Subtitle" value={config.subtitle as string ?? ''} onChange={(v) => set('subtitle', v)} />
        </>
      )}

      {/* custom_text config */}
      {block.type === 'custom_text' && (
        <>
          <ConfigInput label="Heading" value={config.heading as string ?? ''} onChange={(v) => set('heading', v)} />
          <div className="space-y-1.5">
            <Label className="text-xs">Content (markdown)</Label>
            <textarea
              rows={6}
              value={config.content as string ?? ''}
              onChange={(e) => set('content', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
            />
          </div>
        </>
      )}

      {/* section_divider config */}
      {block.type === 'section_divider' && (
        <>
          <ConfigInput label="Title" value={config.title as string ?? ''} onChange={(v) => set('title', v)} />
          <ConfigInput label="Subtitle" value={config.subtitle as string ?? ''} onChange={(v) => set('subtitle', v)} />
        </>
      )}

      {/* score_overview config */}
      {block.type === 'score_overview' && (
        <>
          <ConfigSelect
            label="Chart type"
            value={config.chartType as string ?? 'radar'}
            options={[{ value: 'radar', label: 'Radar' }, { value: 'bars', label: 'Horizontal Bars' }]}
            onChange={(v) => set('chartType', v)}
          />
          <ConfigSelect
            label="Display level"
            value={config.displayLevel as string ?? 'factor'}
            options={[
              { value: 'dimension', label: 'Dimension' },
              { value: 'factor', label: 'Factor' },
              { value: 'construct', label: 'Construct' },
            ]}
            onChange={(v) => set('displayLevel', v)}
          />
          <ConfigSwitch label="Group by dimension" value={config.groupByDimension as boolean} onChange={(v) => set('groupByDimension', v)} />
          <ConfigSwitch label="Show dimension score" value={config.showDimensionScore as boolean} onChange={(v) => set('showDimensionScore', v)} />
        </>
      )}

      {/* score_detail config */}
      {block.type === 'score_detail' && (
        <>
          <ConfigInput label="Entity ID" value={config.entityId as string ?? ''} placeholder="UUID of factor/construct" onChange={(v) => set('entityId', v || null)} />
          <ConfigSelect
            label="Display level"
            value={config.displayLevel as string ?? 'factor'}
            options={[
              { value: 'dimension', label: 'Dimension' },
              { value: 'factor', label: 'Factor' },
              { value: 'construct', label: 'Construct' },
            ]}
            onChange={(v) => set('displayLevel', v)}
          />
          <ConfigSwitch label="Show score" value={config.showScore as boolean} onChange={(v) => set('showScore', v)} />
          <ConfigSwitch label="Show band label" value={config.showBandLabel as boolean} onChange={(v) => set('showBandLabel', v)} />
          <ConfigSwitch label="Show definition" value={config.showDefinition as boolean} onChange={(v) => set('showDefinition', v)} />
          <ConfigSwitch label="Show indicators (narrative)" value={config.showIndicators as boolean} onChange={(v) => set('showIndicators', v)} />
          <ConfigSwitch label="Show development suggestion" value={config.showDevelopment as boolean} onChange={(v) => set('showDevelopment', v)} />
          <ConfigSwitch label="Show child breakdown" value={config.showChildBreakdown as boolean} onChange={(v) => set('showChildBreakdown', v)} />
        </>
      )}

      {/* strengths_highlights config */}
      {block.type === 'strengths_highlights' && (
        <>
          <ConfigInput label="Top N" value={String(config.topN ?? 3)} onChange={(v) => set('topN', Number(v))} type="number" />
          <ConfigSelect
            label="Style"
            value={config.style as string ?? 'cards'}
            options={[{ value: 'cards', label: 'Cards' }, { value: 'list', label: 'List' }]}
            onChange={(v) => set('style', v)}
          />
        </>
      )}

      {/* development_plan config */}
      {block.type === 'development_plan' && (
        <>
          <ConfigInput label="Max items" value={String(config.maxItems ?? 3)} onChange={(v) => set('maxItems', Number(v))} type="number" />
          <ConfigSwitch label="Prioritise by lowest score" value={config.prioritiseByScore as boolean} onChange={(v) => set('prioritiseByScore', v)} />
        </>
      )}

      {/* Print options (all blocks) */}
      <div className="pt-4 border-t border-border space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Print Options</p>
        <ConfigSwitch label="Page break before" value={block.printBreakBefore ?? false} onChange={(v) => onChange({ ...config, _printBreakBefore: v })} />
        <ConfigSwitch label="Hide in PDF" value={block.printHide ?? false} onChange={(v) => onChange({ ...config, _printHide: v })} />
        <ConfigSwitch label="Hide on screen" value={block.screenHide ?? false} onChange={(v) => onChange({ ...config, _screenHide: v })} />
      </div>
    </div>
  )
}

// ---- small reusable field components ----

function ConfigSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs font-normal">{label}</Label>
      <Switch checked={!!value} onCheckedChange={onChange} />
    </div>
  )
}

function ConfigInput({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  )
}

function ConfigSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/settings/reports/
git commit -m "feat: add block builder — three-panel layout, palette, canvas, config panel"
```

---

## Task 12: Campaign Form Integration

**Files:**
- Modify: find the campaign form/edit page (check `src/app/(dashboard)/campaigns/`)
- Create: `src/app/(dashboard)/campaigns/[id]/report-config-tab.tsx`

Read the campaign form file before modifying it. The goal is to add a "Reports" tab that shows three `Select` dropdowns — one per audience — each listing available templates for that report type.

- [ ] **Step 1: Locate the campaign edit form**

```bash
find src/app -name "*.tsx" | xargs grep -l "campaign" | grep -i "edit\|form"
```

Read the file. Understand the tab structure. The existing form likely has tabs (Details, Assessments, etc.).

- [ ] **Step 2: Write `report-config-tab.tsx`**

```tsx
// src/app/(dashboard)/campaigns/[id]/report-config-tab.tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { upsertCampaignReportConfig } from '@/app/actions/reports'
import type { ReportTemplate, CampaignReportConfig } from '@/types/database'

interface Props {
  campaignId: string
  templates: ReportTemplate[]
  currentConfig: CampaignReportConfig | null
}

const NONE = '__none__'

export function ReportConfigTab({ campaignId, templates, currentConfig }: Props) {
  const [participantId, setParticipantId] = useState(currentConfig?.participantTemplateId ?? NONE)
  const [hrManagerId, setHrManagerId] = useState(currentConfig?.hrManagerTemplateId ?? NONE)
  const [consultantId, setConsultantId] = useState(currentConfig?.consultantTemplateId ?? NONE)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    startTransition(async () => {
      await upsertCampaignReportConfig(campaignId, {
        participantTemplateId: participantId === NONE ? null : participantId,
        hrManagerTemplateId: hrManagerId === NONE ? null : hrManagerId,
        consultantTemplateId: consultantId === NONE ? null : consultantId,
      })
      toast.success('Report configuration saved')
    })
  }

  const templateOptions = templates.filter((t) => t.isActive)

  return (
    <div className="space-y-6 max-w-lg">
      <p className="text-sm text-muted-foreground">
        Assign a report template to each audience. Participants receive their report automatically when their session completes (if auto-release is enabled on the template).
      </p>

      <AudienceTemplateSelect
        label="Participant Report"
        description="Shown to the participant on the assess surface after release."
        value={participantId}
        onChange={setParticipantId}
        options={templateOptions}
      />

      <AudienceTemplateSelect
        label="HR Manager Report"
        description="Shown to organisation members on the client surface after release."
        value={hrManagerId}
        onChange={setHrManagerId}
        options={templateOptions}
      />

      <AudienceTemplateSelect
        label="Consultant Report"
        description="Available to consultants immediately when ready. Not shown to other audiences."
        value={consultantId}
        onChange={setConsultantId}
        options={templateOptions}
      />

      <Button onClick={handleSave} disabled={isPending}>
        {isPending ? 'Saving…' : 'Save Report Configuration'}
      </Button>
    </div>
  )
}

function AudienceTemplateSelect({
  label, description, value, onChange, options,
}: {
  label: string
  description: string
  value: string
  onChange: (v: string) => void
  options: ReportTemplate[]
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="No report" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No report</SelectItem>
          {options.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

- [ ] **Step 3: Add the tab to the campaign edit page**

Read the campaign edit file, then add the Reports tab:
- Import `ReportConfigTab`
- Fetch `getReportTemplates()` and `getCampaignReportConfig(campaignId)` in the server component
- Add a "Reports" tab to the tab list
- Render `<ReportConfigTab>` in the tab panel

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/campaigns/
git commit -m "feat: add report config tab to campaign form — audience template selectors"
```

---

## Task 13: Release Gate + Snapshot List

**Files:**
- Create: `src/app/(dashboard)/reports/page.tsx` (reports index — list of snapshots by campaign)
- Create: `src/app/(dashboard)/reports/page.tsx`

A consultant needs to see all ready/released snapshots and release them per audience. This is a server component table page.

- [ ] **Step 1: Add `getReportSnapshotsForCampaign` to actions if missing**

It was included in Task 4 (Part 1). If needed, also add `getAllReadySnapshots()` for the index page:

```typescript
export async function getAllReadySnapshots(): Promise<ReportSnapshot[]> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('*')
    .in('status', ['ready', 'released'])
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapReportSnapshotRow)
}
```

- [ ] **Step 2: Write the reports index page**

```tsx
// src/app/(dashboard)/reports/page.tsx
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/page-header'
import { ScrollReveal } from '@/components/scroll-reveal'
import { EmptyState } from '@/components/empty-state'
import { getAllReadySnapshots } from '@/app/actions/reports'
import { ReleaseSnapshotButton } from './[snapshotId]/release-snapshot-button'

const AUDIENCE_LABELS = {
  participant: 'Participant',
  hr_manager: 'HR Manager',
  consultant: 'Consultant',
}

const STATUS_STYLES = {
  ready: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  released: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
  pending: '',
  generating: '',
}

export default async function ReportsPage() {
  const snapshots = await getAllReadySnapshots()

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Reports"
        title="Report Snapshots"
        description="Review and release generated reports to their intended audience."
      />

      {snapshots.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="Reports are generated automatically when participants complete their sessions."
        />
      ) : (
        <ScrollReveal>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead className="w-32">Audience</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-36">Generated</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snap) => (
                  <TableRow key={snap.id} className="group">
                    <TableCell>
                      <Link href={`/reports/${snap.id}`} className="text-sm font-medium hover:text-primary transition-colors">
                        {snap.participantSessionId.slice(0, 8)}…
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{AUDIENCE_LABELS[snap.audienceType]}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[snap.status]}>
                        {snap.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {snap.generatedAt
                        ? new Date(snap.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {snap.status === 'ready' && (
                          <ReleaseSnapshotButton snapshotId={snap.id} />
                        )}
                        <Link href={`/reports/${snap.id}`}>
                          <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollReveal>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/reports/page.tsx
git commit -m "feat: add report snapshots index page with release gate"
```

---

## Task 14: Sidebar Navigation

**Files:**
- Modify: `src/components/app-sidebar.tsx`

Add "Reports" to the sidebar under a logical section (near Campaigns or as a top-level item).

- [ ] **Step 1: Read the sidebar file**

```
Read src/components/app-sidebar.tsx
```

- [ ] **Step 2: Add nav entry**

Add `{ title: "Reports", href: "/reports", icon: FileText }` to the appropriate section (likely alongside Campaigns — these are operational, not library).

Add "Report Templates" under Settings: `{ title: "Report Templates", href: "/settings/reports", icon: Layout }`.

Use `FileText` and `Layout` from lucide-react (already imported likely — check and import if missing).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat: add Reports and Report Templates to sidebar navigation"
```

---

## Final Verification

- [ ] **Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Smoke test: template library**

Navigate to `/settings/reports`. Verify 4 seeded templates appear. Clone one. Verify clone appears. Navigate to builder. Add a block from palette. Verify it appears in canvas. Select it. Verify config panel appears.

- [ ] **Smoke test: viewer**

Find any snapshot in `report_snapshots` with `status = 'ready'`. Navigate to `/reports/{snapshotId}`. Verify the report renders with the correct blocks.

- [ ] **Smoke test: campaign form**

Navigate to a campaign's edit page. Verify the Reports tab appears. Select a template for the participant audience. Save. Verify `campaign_report_config` row is created/updated in the DB.

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: complete report generation system UI — blocks, viewers, builder, release gate"
```

---

## Part 2 Complete

At this point the full Report Generation System is implemented end-to-end:

- 11 block components (3 meta, 5 score/highlight, 3 360-only)
- ReportRenderer with print mode
- Three audience-specific viewer routes
- PDF generation via Puppeteer
- Template library + three-panel block builder
- Campaign report configuration tab
- Release gate with snapshot index
- Sidebar navigation entries

**Known limitations (v1 scope):**
- 360 block data resolution (rater_comparison, gap_analysis, open_comments) shows placeholder until 360 rater scoring is implemented
- norm_comparison block is registered but always deferred
- PDF generation requires Puppeteer + service-role JWT setup in production environment
- AI narrative enhancement is wired but requires `OPENROUTER_API_KEY` and an active `report_narrative` prompt in the DB (seeded by Part 1)
