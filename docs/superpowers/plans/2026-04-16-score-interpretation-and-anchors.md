# Score Interpretation Card & Anchor Definitions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add low/high anchor definitions to taxonomy entities, build a new compact score interpretation block for consultants, and add anchor toggle to the existing score overview block.

**Architecture:** Three-phase incremental build — data layer first (migration + types + actions), then the new block (types → registry → sample data → render → builder), then the score overview enhancement. Each task produces a working, committable unit.

**Tech Stack:** Next.js, Supabase (Postgres), TypeScript, Tailwind CSS, React

**Spec:** `docs/superpowers/specs/2026-04-16-score-interpretation-and-anchors-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260416120000_anchor_definitions.sql` | DB migration: add `anchor_low`/`anchor_high` to dimensions, factors, constructs |
| `src/components/reports/blocks/score-interpretation.tsx` | Render component for the new score interpretation block |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/database.ts` | Add `anchorLow`/`anchorHigh` to `Dimension`, `Factor`, `Construct`, `ConstructConfigOverride` |
| `src/app/actions/factors.ts` | Add `anchorLow`/`anchorHigh` to `ALLOWED_FACTOR_FIELDS` and `camelToSnakeMap` |
| `src/app/actions/dimensions.ts` | Add `anchorLow`/`anchorHigh` to `ALLOWED_FIELDS` |
| `src/app/actions/constructs.ts` | Add `anchorLow`/`anchorHigh` to `ALLOWED_FIELDS` |
| `src/app/(dashboard)/factors/factor-form.tsx` | Add anchor auto-save hooks + text inputs in a new Anchors section |
| `src/app/(dashboard)/dimensions/dimension-form.tsx` | Same anchor inputs |
| `src/app/(dashboard)/constructs/construct-form.tsx` | Same anchor inputs |
| `src/lib/reports/types.ts` | Add `score_interpretation` to `BlockType`, add `ScoreInterpretationConfig`, add `showAnchors` to `ScoreOverviewConfig` |
| `src/lib/reports/registry.ts` | Add `score_interpretation` entry to `BLOCK_REGISTRY` |
| `src/lib/reports/sample-data.ts` | Add `anchorLow`/`anchorHigh` to `PreviewEntity`, add `score_interpretation` case |
| `src/components/reports/report-renderer.tsx` | Import and register `ScoreInterpretationBlock` |
| `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx` | Add `ScoreInterpretationContent` panel, add `showAnchors` toggle to `ScoreOverviewContent`, register in `CONTENT_PANELS` |
| `src/components/reports/blocks/score-overview.tsx` | Pass `anchorLow`/`anchorHigh` data and render anchor text when `showAnchors` is enabled |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260416120000_anchor_definitions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add anchor definitions (low/high pole sentences) to taxonomy entity tables
alter table dimensions
  add column anchor_low text check (char_length(anchor_low) <= 150),
  add column anchor_high text check (char_length(anchor_high) <= 150);

alter table factors
  add column anchor_low text check (char_length(anchor_low) <= 150),
  add column anchor_high text check (char_length(anchor_high) <= 150);

alter table constructs
  add column anchor_low text check (char_length(anchor_low) <= 150),
  add column anchor_high text check (char_length(anchor_high) <= 150);
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` (or the project's migration command)
Expected: Migration applies cleanly, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260416120000_anchor_definitions.sql
git commit -m "feat: add anchor_low/anchor_high columns to taxonomy tables"
```

---

## Task 2: TypeScript Types — Database & Report Engine

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/reports/types.ts`

- [ ] **Step 1: Add anchor fields to database types**

In `src/types/database.ts`, add to each of the three entity interfaces (`Dimension`, `Factor`, `Construct`), alongside the existing `indicatorsHigh` field:

```ts
/** Short sentence describing what a low score on this entity means. */
anchorLow?: string
/** Short sentence describing what a high score on this entity means. */
anchorHigh?: string
```

Also add to `ConstructConfigOverride` (the snapshot stored with generation runs):

```ts
anchorLow?: string
anchorHigh?: string
```

- [ ] **Step 2: Add score_interpretation to BlockType union**

In `src/lib/reports/types.ts`, add `'score_interpretation'` to the `BlockType` union after `'score_detail'`:

```ts
export type BlockType =
  // Meta
  | 'cover_page'
  | 'custom_text'
  | 'section_divider'
  // Score (self-report + 360)
  | 'score_overview'
  | 'score_detail'
  | 'score_interpretation'    // <-- NEW
  | 'strengths_highlights'
  // ... rest unchanged
```

- [ ] **Step 3: Add ScoreInterpretationConfig interface**

In `src/lib/reports/types.ts`, after `ScoreOverviewConfig`:

```ts
export interface ScoreInterpretationConfig {
  displayLevel: 'dimension' | 'factor' | 'construct'
  groupByDimension?: boolean
  showScore?: boolean
  showBandLabel?: boolean
  showAnchors?: boolean
}
```

- [ ] **Step 4: Add showAnchors to ScoreOverviewConfig**

In `src/lib/reports/types.ts`, add to `ScoreOverviewConfig`:

```ts
export interface ScoreOverviewConfig {
  displayLevel: 'dimension' | 'factor' | 'construct'
  groupByDimension?: boolean
  showDimensionScore?: boolean
  showScore?: boolean
  showBandLabel?: boolean
  showAnchors?: boolean   // <-- NEW
  entityIds?: string[]
}
```

- [ ] **Step 5: Register in BlockConfigMap**

In `src/lib/reports/types.ts`, add to `BlockConfigMap`:

```ts
export type BlockConfigMap = {
  // ... existing entries ...
  score_interpretation: ScoreInterpretationConfig   // <-- NEW
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors. (There will be errors from registry.ts and report-renderer.tsx not knowing about the new block type yet — that's expected and fixed in Tasks 3-4.)

- [ ] **Step 7: Commit**

```bash
git add src/types/database.ts src/lib/reports/types.ts
git commit -m "feat: add anchor types and score_interpretation block type"
```

---

## Task 3: Server Actions — Allow Anchor Fields

**Files:**
- Modify: `src/app/actions/factors.ts`
- Modify: `src/app/actions/dimensions.ts`
- Modify: `src/app/actions/constructs.ts`

- [ ] **Step 1: Update factors.ts**

In `src/app/actions/factors.ts`, add to `ALLOWED_FACTOR_FIELDS` array (~line 421):

```ts
const ALLOWED_FACTOR_FIELDS = ['description', 'definition', 'indicators_low', 'indicators_mid', 'indicators_high', 'development_suggestion', 'strength_commentary', 'anchor_low', 'anchor_high'] as const
```

And add to `camelToSnakeMap` (~line 424):

```ts
const camelToSnakeMap: Record<string, AllowedFactorField> = {
  // ... existing entries ...
  anchorLow: 'anchor_low',
  anchorHigh: 'anchor_high',
}
```

- [ ] **Step 2: Update dimensions.ts**

In `src/app/actions/dimensions.ts`, add to `ALLOWED_FIELDS` (~line 307):

```ts
const ALLOWED_FIELDS: Record<string, string> = {
  // ... existing entries ...
  anchorLow: 'anchor_low',
  anchorHigh: 'anchor_high',
}
```

- [ ] **Step 3: Update constructs.ts**

In `src/app/actions/constructs.ts`, add to `ALLOWED_FIELDS` (~line 366):

```ts
const ALLOWED_FIELDS: Record<string, string> = {
  // ... existing entries ...
  anchorLow: 'anchor_low',
  anchorHigh: 'anchor_high',
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/factors.ts src/app/actions/dimensions.ts src/app/actions/constructs.ts
git commit -m "feat: allow anchor_low/anchor_high in taxonomy field updates"
```

---

## Task 4: Entity Forms — Anchor Inputs

**Files:**
- Modify: `src/app/(dashboard)/factors/factor-form.tsx`
- Modify: `src/app/(dashboard)/dimensions/dimension-form.tsx`
- Modify: `src/app/(dashboard)/constructs/construct-form.tsx`

The pattern is identical across all three forms. Each uses `useAutoSave` hooks for text fields in edit mode, and local state in create mode. Follow the exact same pattern as `indicatorsLow`/`indicatorsMid`/`indicatorsHigh`.

- [ ] **Step 1: Add anchor state and auto-save hooks to factor-form.tsx**

Add create-mode state (~line 115, after `createDevelopmentSuggestion`):

```ts
const [createAnchorLow, setCreateAnchorLow] = useState(initialData?.anchorLow ?? "")
const [createAnchorHigh, setCreateAnchorHigh] = useState(initialData?.anchorHigh ?? "")
```

Add auto-save hooks (~line 157, after `developmentSuggestionAutoSave`):

```ts
const anchorLowAutoSave = useAutoSave({
  initialValue: initialData?.anchorLow ?? "",
  onSave: (val) => updateFactorField(factorId!, "anchorLow", val),
  enabled: mode === "edit" && !!factorId,
})

const anchorHighAutoSave = useAutoSave({
  initialValue: initialData?.anchorHigh ?? "",
  onSave: (val) => updateFactorField(factorId!, "anchorHigh", val),
  enabled: mode === "edit" && !!factorId,
})
```

Add resolved values (~line 167, after `developmentSuggestion`):

```ts
const anchorLow = mode === "edit" ? anchorLowAutoSave.value : createAnchorLow
const anchorHigh = mode === "edit" ? anchorHighAutoSave.value : createAnchorHigh
```

- [ ] **Step 2: Add anchor inputs to the factor form UI**

Find the Indicators tab area in the form. Add a new section for anchors — either as part of the existing tabs or as a dedicated "Anchors" section. Place it before/alongside the indicators section. Use plain `Input` elements (not `RichTextEditor` — anchors are short plain-text sentences):

```tsx
{/* Anchors */}
<div className="space-y-4">
  <p className="text-sm text-muted-foreground">
    Define what low and high scores mean for this factor. Short sentences used as scale anchors in reports.
  </p>
  <div className="space-y-2">
    <Label>Low Anchor</Label>
    <Input
      value={anchorLow}
      onChange={(e) => mode === "edit" ? anchorLowAutoSave.setValue(e.target.value) : setCreateAnchorLow(e.target.value)}
      onBlur={() => mode === "edit" && anchorLowAutoSave.flush?.()}
      placeholder="e.g. Tends to feel overwhelmed under pressure"
      maxLength={150}
      className="text-sm"
    />
    {mode === "edit" && <AutoSaveIndicator state={anchorLowAutoSave.state} />}
  </div>
  <div className="space-y-2">
    <Label>High Anchor</Label>
    <Input
      value={anchorHigh}
      onChange={(e) => mode === "edit" ? anchorHighAutoSave.setValue(e.target.value) : setCreateAnchorHigh(e.target.value)}
      onBlur={() => mode === "edit" && anchorHighAutoSave.flush?.()}
      placeholder="e.g. Remains composed and focused during setbacks"
      maxLength={150}
      className="text-sm"
    />
    {mode === "edit" && <AutoSaveIndicator state={anchorHighAutoSave.state} />}
  </div>
</div>
```

- [ ] **Step 3: Repeat for dimension-form.tsx and construct-form.tsx**

Apply the same pattern: create-mode state, auto-save hooks using `updateDimensionField`/`updateConstructField`, resolved values, and Input UI. The code is structurally identical — just the action function name differs.

- [ ] **Step 4: Also ensure create actions include anchor fields**

Check that `createFactor`, `createDimension`, and `createConstruct` server actions include `anchor_low` and `anchor_high` in their insert payloads when provided. If the create actions take a form data object, add the fields. If they use a fixed field list, extend it.

- [ ] **Step 5: Verify in browser**

Run: `npm run dev`
Navigate to any factor edit page, confirm the Low Anchor and High Anchor inputs appear. Type a value, tab away, confirm auto-save fires.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/factors/factor-form.tsx src/app/(dashboard)/dimensions/dimension-form.tsx src/app/(dashboard)/constructs/construct-form.tsx
git commit -m "feat: add anchor low/high inputs to entity edit forms"
```

---

## Task 5: Block Registry — Register score_interpretation

**Files:**
- Modify: `src/lib/reports/registry.ts`

- [ ] **Step 1: Add score_interpretation to BLOCK_REGISTRY**

In `src/lib/reports/registry.ts`, add after `score_detail` entry (~line 60):

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
},
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: May still have errors from report-renderer.tsx (component not yet created). Registry itself should compile.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/registry.ts
git commit -m "feat: register score_interpretation block type"
```

---

## Task 6: Sample Data — Anchors & Interpretation Block

**Files:**
- Modify: `src/lib/reports/sample-data.ts`

- [ ] **Step 1: Add anchor fields to PreviewEntity**

In `src/lib/reports/sample-data.ts`, add to the `PreviewEntity` interface (~line 24):

```ts
export interface PreviewEntity {
  // ... existing fields ...
  anchorLow?: string
  anchorHigh?: string
}
```

- [ ] **Step 2: Add sample anchor text**

Add sample anchors constant near the other SAMPLE_ constants (~line 85):

```ts
const SAMPLE_ANCHORS: Array<{ low: string; high: string }> = [
  { low: 'Tends to avoid complex challenges', high: 'Actively seeks out complex challenges' },
  { low: 'Prefers individual work environments', high: 'Thrives in collaborative settings' },
  { low: 'Relies on established approaches', high: 'Generates novel solutions readily' },
  { low: 'Focuses on immediate concerns', high: 'Takes a long-term strategic view' },
  { low: 'Prefers stable environments', high: 'Adapts quickly to change' },
]
```

- [ ] **Step 3: Add score_interpretation case to generateBlockSampleData**

In the `switch (type)` block (~line 193), add before the default/deferred cases:

```ts
case 'score_interpretation': {
  const filtered = filterEntities(entities, config)
  const parentNameMap = new Map<string, string>()
  for (const e of entities) {
    if (e.type === 'dimension') parentNameMap.set(e.id, e.name)
  }

  // Group by parent when groupByDimension enabled
  const groupByDim = config.groupByDimension === true
  const groupMap = new Map<string, typeof scored>()
  const ungrouped: typeof scored = []

  for (const e of filtered) {
    const parentName = e.parentId ? (parentNameMap.get(e.parentId) ?? null) : null
    if (groupByDim && parentName) {
      const list = groupMap.get(parentName) ?? []
      list.push(e)
      groupMap.set(parentName, list)
    } else {
      ungrouped.push(e)
    }
  }

  const groups: Array<{ groupName: string | null; entities: unknown[] }> = []
  for (const [groupName, entries] of groupMap) {
    groups.push({
      groupName,
      entities: entries.map((e, i) => {
        const anchors = SAMPLE_ANCHORS[i % SAMPLE_ANCHORS.length]
        return {
          entityId: e.id,
          entityName: e.name,
          pompScore: e.pompScore,
          bandResult: makeBandResult(e),
          anchorLow: e.anchorLow ?? anchors.low,
          anchorHigh: e.anchorHigh ?? anchors.high,
        }
      }),
    })
  }
  if (ungrouped.length > 0) {
    groups.push({
      groupName: null,
      entities: ungrouped.map((e, i) => {
        const anchors = SAMPLE_ANCHORS[i % SAMPLE_ANCHORS.length]
        return {
          entityId: e.id,
          entityName: e.name,
          pompScore: e.pompScore,
          bandResult: makeBandResult(e),
          anchorLow: e.anchorLow ?? anchors.low,
          anchorHigh: e.anchorHigh ?? anchors.high,
        }
      }),
    })
  }

  return {
    groups,
    config: {
      displayLevel: config.displayLevel ?? 'factor',
      groupByDimension: groupByDim,
      showScore: config.showScore !== false,
      showBandLabel: config.showBandLabel !== false,
      showAnchors: config.showAnchors !== false,
    },
  }
}
```

- [ ] **Step 4: Add anchor data to score_overview sample data**

In the existing `case 'score_overview':` block, extend each score entry to include anchors:

```ts
// In the scores mapping, add:
anchorLow: e.anchorLow ?? SAMPLE_ANCHORS[i % SAMPLE_ANCHORS.length].low,
anchorHigh: e.anchorHigh ?? SAMPLE_ANCHORS[i % SAMPLE_ANCHORS.length].high,
```

And add `showAnchors` to the config output:

```ts
config: {
  // ... existing fields ...
  showAnchors: config.showAnchors === true,
},
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/sample-data.ts
git commit -m "feat: add anchor sample data and score_interpretation generator"
```

---

## Task 7: Render Component — score-interpretation.tsx

**Files:**
- Create: `src/components/reports/blocks/score-interpretation.tsx`

- [ ] **Step 1: Create the render component**

Create `src/components/reports/blocks/score-interpretation.tsx`. Reference the score-overview.tsx and score-detail.tsx patterns for styling conventions (CSS custom properties for theming, featured/open variants).

```tsx
import type { ScoreInterpretationConfig, BandResult } from '@/lib/reports/types'
import type { PresentationMode } from '@/lib/reports/presentation'
import { BandBadge } from '../charts/band-badge'

interface InterpretationEntity {
  entityId: string
  entityName: string
  pompScore: number
  bandResult: BandResult
  anchorLow: string | null
  anchorHigh: string | null
}

interface InterpretationGroup {
  groupName: string | null
  entities: InterpretationEntity[]
}

interface ScoreInterpretationData {
  groups: InterpretationGroup[]
  config: ScoreInterpretationConfig
}

export function ScoreInterpretationBlock({
  data,
  mode,
}: {
  data: Record<string, unknown>
  mode?: PresentationMode
}) {
  const d = data as unknown as ScoreInterpretationData
  if (!d.groups?.length) return null

  const isFeatured = mode === 'featured'
  const { config } = d

  return (
    <div className="space-y-6">
      {d.groups.map((group, gi) => (
        <div key={gi}>
          {group.groupName && (
            <p
              className="text-[12px] font-bold uppercase tracking-[1.5px] pb-2 mb-3"
              style={{
                color: isFeatured ? 'rgba(255,255,255,0.6)' : 'var(--report-label-colour)',
                borderBottom: `2px solid ${isFeatured ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)'}`,
              }}
            >
              {group.groupName}
            </p>
          )}
          <div className="space-y-4">
            {group.entities.map((entity) => (
              <InterpretationRow
                key={entity.entityId}
                entity={entity}
                config={config}
                isFeatured={isFeatured}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function InterpretationRow({
  entity,
  config,
  isFeatured,
}: {
  entity: InterpretationEntity
  config: ScoreInterpretationConfig
  isFeatured: boolean
}) {
  const headingColour = isFeatured ? 'currentColor' : 'var(--report-heading-colour)'
  const mutedColour = isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)'
  const barBg = isFeatured ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)'
  const hasAnchors = config.showAnchors && (entity.anchorLow || entity.anchorHigh)

  // Band-to-colour mapping for the bar fill
  const bandColours: Record<string, string> = {
    high: isFeatured ? '#6ee7a0' : '#2e7d32',
    mid: isFeatured ? '#f0c060' : '#e67a00',
    low: isFeatured ? '#f08080' : '#c62828',
  }
  const barColour = bandColours[entity.bandResult.band] ?? bandColours.mid

  return (
    <div className="break-inside-avoid">
      {/* Row 1: Name + badge + score */}
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <span
          className="text-[12px] font-semibold"
          style={{ color: headingColour }}
        >
          {entity.entityName}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {config.showBandLabel && (
            <BandBadge band={entity.bandResult.band} label={entity.bandResult.bandLabel} />
          )}
          {config.showScore && (
            <span
              className="text-[13px] font-bold tabular-nums"
              style={{ color: headingColour }}
            >
              {Math.round(entity.pompScore)}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Full-width bar with score marker */}
      <div
        className="relative h-[6px] rounded-full mb-1"
        style={{ background: barBg }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${Math.round(entity.pompScore)}%`,
            background: barColour,
            opacity: isFeatured ? 0.8 : 0.7,
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full shadow-sm"
          style={{
            left: `${Math.round(entity.pompScore)}%`,
            transform: 'translate(-50%, -50%)',
            background: barColour,
          }}
        />
      </div>

      {/* Row 3: Anchors (optional) */}
      {hasAnchors && (
        <div className="flex justify-between gap-4 mt-0.5">
          <span className="text-[9px] flex-1" style={{ color: mutedColour }}>
            {entity.anchorLow ?? ''}
          </span>
          <span className="text-[9px] flex-1 text-right" style={{ color: mutedColour }}>
            {entity.anchorHigh ?? ''}
          </span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Register in report-renderer.tsx**

In `src/components/reports/report-renderer.tsx`, add the import and registry entry:

```ts
import { ScoreInterpretationBlock } from './blocks/score-interpretation'

// In the BLOCK_COMPONENTS map:
score_interpretation: ScoreInterpretationBlock,
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Navigate to the template builder. Add a Score Interpretation block. The preview should render with sample data: grouped dimension headings, factor rows with bars and anchor text.

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/blocks/score-interpretation.tsx src/components/reports/report-renderer.tsx
git commit -m "feat: score interpretation block render component"
```

---

## Task 8: Builder Content Panel — Interpretation & Overview Anchors

**Files:**
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx`

- [ ] **Step 1: Add ScoreInterpretationContent panel**

In `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx`, add a new panel function after `ScoreDetailContent` (~line 483):

```tsx
function ScoreInterpretationContent({ block, onUpdateConfig }: BlockContentPanelProps) {
  const config = block.config as Record<string, unknown>
  return (
    <div className="space-y-4">
      <DisplayLevelSelect
        value={String(config.displayLevel ?? 'factor')}
        onChange={(v) => onUpdateConfig('displayLevel', v)}
      />
      <SwitchField
        id="interp-groupByDimension"
        label="Group by dimension"
        help="Group factors/constructs under their parent dimension heading"
        checked={config.groupByDimension as boolean ?? true}
        onChange={(v) => onUpdateConfig('groupByDimension', v)}
      />
      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display toggles</p>
        <SwitchField
          id="interp-showScore"
          label="Score"
          help="Display the numeric score value"
          checked={config.showScore as boolean ?? true}
          onChange={(v) => onUpdateConfig('showScore', v)}
        />
        <SwitchField
          id="interp-showBandLabel"
          label="Band label"
          help="Qualitative label like 'Highly Effective' or 'Developing'"
          checked={config.showBandLabel as boolean ?? true}
          onChange={(v) => onUpdateConfig('showBandLabel', v)}
        />
        <SwitchField
          id="interp-showAnchors"
          label="Anchors"
          help="Low/high anchor sentences beneath each score bar"
          checked={config.showAnchors as boolean ?? true}
          onChange={(v) => onUpdateConfig('showAnchors', v)}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add showAnchors toggle to ScoreOverviewContent**

In the existing `ScoreOverviewContent` function, add a new `SwitchField` after the `groupByDimension` toggle (~line 390). Conditionally hide when chart type is radar:

```tsx
{block.chartType !== 'radar' && (
  <SwitchField
    id="overview-showAnchors"
    label="Show anchors"
    help="Display low/high anchor sentences beneath each score bar"
    checked={config.showAnchors as boolean ?? false}
    onChange={(v) => onUpdateConfig('showAnchors', v)}
  />
)}
```

- [ ] **Step 3: Register in CONTENT_PANELS**

In the `CONTENT_PANELS` map (~line 617), add:

```ts
score_interpretation: ScoreInterpretationContent,
```

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`
1. Open the template builder. Add a Score Interpretation block — verify the content panel shows DisplayLevel, Group by dimension, Score, Band label, and Anchors toggles.
2. Edit an existing Score Overview block — verify the "Show anchors" toggle appears when chart type is bar/gauges/scorecard, and disappears when chart type is radar.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx
git commit -m "feat: builder panels for score interpretation and overview anchors"
```

---

## Task 9: Score Overview — Anchor Rendering

**Files:**
- Modify: `src/components/reports/blocks/score-overview.tsx`

- [ ] **Step 1: Extend ScoreEntry to include anchors**

In `src/components/reports/blocks/score-overview.tsx`, add to the `ScoreEntry` interface (~line 8):

```ts
interface ScoreEntry {
  entityId: string
  entityName: string
  pompScore: number
  bandResult: BandResult
  parentName?: string
  anchorLow?: string    // <-- NEW
  anchorHigh?: string   // <-- NEW
}
```

And add `showAnchors` to the config read (~line 29):

```ts
const showAnchors = d.config?.showAnchors === true
```

- [ ] **Step 2: Add anchor rendering to bar chart groups**

In the `resolvedChart === 'bar'` section, after each `<BarChart>` component, add anchor rendering. The anchors should appear below each bar item. This requires modifying how the BarChart data flows, or adding anchor text below the chart.

The simplest approach: render anchor text below each group's `<BarChart>`. Since the BarChart renders all items in a group, the anchors need to be rendered per-item beneath the chart. Check how `BarChart` renders its items — if it renders individual bars, we may need to pass anchors through. If not, render a separate anchor list below.

**Pragmatic approach:** Add a new optional `anchors` prop to the BarChart items or render a separate lightweight anchor row beneath the bar chart output for each entity. Examine the BarChart component to decide.

The same applies to GaugeChart and ScorecardTable.

> **Note to implementer:** Read `src/components/reports/charts/bar-chart.tsx`, `gauge-chart.tsx`, and `scorecard-table.tsx` to determine the best integration point. The goal is: when `showAnchors` is true, display the low/high anchor text beneath each entity's bar/gauge/row. Keep it as simple as possible — if the chart components can't easily accommodate it, render the anchors as a separate element after each chart.

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Add a Score Overview block with `showAnchors` enabled. Verify anchor text appears beneath bars/gauges/scorecard rows. Switch to radar — verify anchors are not shown.

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/blocks/score-overview.tsx
git commit -m "feat: render anchor text in score overview when showAnchors enabled"
```

---

## Task 10: Final Verification & Cleanup

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run linter**

Run: `npx next lint`
Expected: No new warnings/errors.

- [ ] **Step 3: Run dev server and test full flow**

1. Create/edit a factor — add Low Anchor and High Anchor text
2. Open template builder — add a Score Interpretation block, verify preview renders with dimension grouping, bars, badges, scores, and anchor text
3. Toggle showAnchors off — verify anchors disappear
4. Add a Score Overview block — enable showAnchors, verify anchors appear beneath bars
5. Switch chart type to radar — verify anchor toggle disappears

- [ ] **Step 4: Verify print/PDF rendering**

Open the report preview and use browser print. Confirm:
- Score interpretation block density: 5 factors per dimension group should be compact
- Page breaks respect `break-inside-avoid` on groups
- Anchor text is legible at print size

- [ ] **Step 5: Commit any cleanup**

```bash
git add -A
git commit -m "chore: final cleanup for score interpretation and anchors"
```
