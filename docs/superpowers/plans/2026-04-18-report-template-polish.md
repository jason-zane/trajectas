# Report Template Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three report-template improvements — preview page matches the real report shell with PDF download, two new band-scheme palettes, and group-level score/band/anchors in the score_interpretation block.

**Architecture:**
- **Palettes:** generalise `PALETTE_STOPS` to `string[]` and replace the RAG special case with a multi-stop interpolator. Add `soft-rag` and `sage-ladder`.
- **Score interpretation group:** add three optional toggles (`showGroupScore/Band/Anchors`). Both the sample-data generator and the real runner emit a `groupEntity` field when grouping is enabled. Renderer adds a group header row using the existing `SegmentBar` / `BandBadge` components.
- **Preview shell + PDF:** preview page gets `PageHeader` + card wrapper + new `PreviewPdfButton`. New print route + new API endpoint mirror the existing `/print/reports/[snapshotId]` + `/api/reports/[snapshotId]/pdf` pattern, scoped by `(templateId, assessmentId)` with a dedicated HMAC token. No DB persistence — PDF streams as the response body.

**Tech Stack:** Next.js 16 App Router, TypeScript, vitest, `puppeteer-core` + `@sparticuz/chromium-min` for headless PDF, Node `crypto` for HMAC tokens.

**Reference spec:** `docs/superpowers/specs/2026-04-18-report-template-polish-design.md`

---

## Task ordering

Palettes first (smallest, no external deps), then score_interpretation (internal rendering), then preview shell + PDF (depends on nothing but ships the most visible change).

---

## File Plan

**New files:**

| File | Responsibility |
|---|---|
| `src/lib/reports/preview-pdf-token.ts` | HMAC token scoped to `(templateId, assessmentId)` |
| `src/lib/reports/preview-pdf.ts` | `generatePreviewPdf(templateId, assessmentId)` — launches Puppeteer, navigates to print route, returns buffer |
| `src/app/print/report-templates/[id]/preview/page.tsx` | Plain HTML render for preview PDF capture |
| `src/app/api/report-templates/[id]/preview/pdf/route.ts` | PDF API endpoint |
| `src/components/reports/preview-pdf-button.tsx` | Client component — triggers download |
| `tests/unit/band-scheme-palettes.test.ts` | interpolateMultiStop + new palette endpoints |
| `tests/unit/score-interpretation-group.test.ts` | sample-data emits groupEntity correctly |
| `tests/unit/preview-pdf-token.test.ts` | token create / verify / reject |

**Modified files:**

| File | Change |
|---|---|
| `src/lib/reports/band-scheme.ts` | Generalise `PALETTE_STOPS` to `string[]`; add interpolateMultiStop; add `soft-rag`, `sage-ladder` |
| `src/components/band-scheme-editor/band-scheme-editor.tsx` | Add the 2 new palettes to the picker list |
| `src/lib/reports/types.ts` | Extend `ScoreInterpretationConfig` with 3 flags; add `groupEntity` to block data shape via type |
| `src/lib/reports/sample-data.ts` | Emit `groupEntity` in score_interpretation groups |
| `src/lib/reports/runner.ts` | Emit `groupEntity` in score_interpretation groups |
| `src/components/reports/blocks/score-interpretation.tsx` | Render group header row when flags set |
| `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx` | Add the 3 new toggles |
| `src/app/(dashboard)/report-templates/[id]/preview/page.tsx` | PageHeader + card + dropdown in header + PreviewPdfButton |

---

# FEATURE 1 — Palettes

## Task 1: Generalise palette stops + multi-stop interpolator

**Files:**
- Modify: `src/lib/reports/band-scheme.ts`
- Test: `tests/unit/band-scheme-palettes.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/band-scheme-palettes.test.ts
import { describe, it, expect } from 'vitest'
import { getBandColour } from '@/lib/reports/band-scheme'

describe('getBandColour — generalised multi-stop interpolation', () => {
  // red-amber-green is 3-stop: #c62828, #e67a00, #2e7d32
  it('returns first stop at bandIndex 0', () => {
    expect(getBandColour('red-amber-green', 0, 3).toLowerCase()).toBe('#c62828')
  })

  it('returns middle stop at the midpoint for a 3-band scheme', () => {
    expect(getBandColour('red-amber-green', 1, 3).toLowerCase()).toBe('#e67a00')
  })

  it('returns last stop at bandIndex == bandCount - 1', () => {
    expect(getBandColour('red-amber-green', 2, 3).toLowerCase()).toBe('#2e7d32')
  })

  it('interpolates between consecutive stops', () => {
    // halfway between red and amber (not the exact amber midpoint)
    const result = getBandColour('red-amber-green', 1, 5).toLowerCase()
    expect(result).not.toBe('#c62828')
    expect(result).not.toBe('#e67a00')
    // Should be closer to red than amber since bandIndex 1 of 5 is at t=0.25
  })

  it('handles 2-stop palettes (blue-scale)', () => {
    expect(getBandColour('blue-scale', 0, 3).toLowerCase()).toBe('#90caf9')
    expect(getBandColour('blue-scale', 2, 3).toLowerCase()).toBe('#0d47a1')
  })

  it('returns the single stop when bandCount is 1', () => {
    expect(getBandColour('red-amber-green', 0, 1).toLowerCase()).toBe('#c62828')
  })
})
```

- [ ] **Step 2: Run test to confirm it passes (should — existing behaviour)**

Run: `npx vitest run tests/unit/band-scheme-palettes.test.ts`
Expected: PASS — these are characterisation tests for existing behaviour.

- [ ] **Step 3: Generalise `PALETTE_STOPS` to `string[]` and add interpolateMultiStop**

Replace the current `PALETTE_STOPS` and `getBandColour` in `src/lib/reports/band-scheme.ts`:

```typescript
const PALETTE_STOPS: Record<PaletteKey, string[]> = {
  'red-amber-green': ['#c62828', '#e67a00', '#2e7d32'],
  'warm-neutral':    ['#8a7a5a', '#c9a962'],
  'monochrome':      ['#6b6b6b', '#1a1a1a'],
  'blue-scale':      ['#90caf9', '#0d47a1'],
}

function interpolateMultiStop(stops: string[], t: number): string {
  if (stops.length === 1) return stops[0]
  const clamped = Math.max(0, Math.min(1, t))
  const scaled = clamped * (stops.length - 1)
  const i = Math.floor(scaled)
  if (i >= stops.length - 1) return stops[stops.length - 1]
  const localT = scaled - i
  return interpolateHex(stops[i], stops[i + 1], localT)
}

export function getBandColour(palette: PaletteKey, bandIndex: number, bandCount: number): string {
  const stops = PALETTE_STOPS[palette]
  if (bandCount <= 1) return stops[0]
  const t = bandIndex / (bandCount - 1)
  return interpolateMultiStop(stops, t)
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/band-scheme-palettes.test.ts`
Expected: PASS — all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/band-scheme.ts tests/unit/band-scheme-palettes.test.ts
git commit -m "refactor: generalise PALETTE_STOPS to string[] with multi-stop interpolation"
```

---

## Task 2: Add `soft-rag` and `sage-ladder` palettes

**Files:**
- Modify: `src/lib/reports/band-scheme.ts`
- Modify: `src/components/band-scheme-editor/band-scheme-editor.tsx`
- Test: `tests/unit/band-scheme-palettes.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/band-scheme-palettes.test.ts`:

```typescript
describe('soft-rag palette', () => {
  it('exposes 3 stops and uses the midpoint as amber', () => {
    expect(getBandColour('soft-rag', 0, 3).toLowerCase()).toBe('#c78a8a')
    expect(getBandColour('soft-rag', 1, 3).toLowerCase()).toBe('#d7b26a')
    expect(getBandColour('soft-rag', 2, 3).toLowerCase()).toBe('#7aa87a')
  })
})

describe('sage-ladder palette', () => {
  it('returns each of the 5 stops at clean offsets', () => {
    expect(getBandColour('sage-ladder', 0, 5).toLowerCase()).toBe('#64748b')
    expect(getBandColour('sage-ladder', 1, 5).toLowerCase()).toBe('#60a5fa')
    expect(getBandColour('sage-ladder', 2, 5).toLowerCase()).toBe('#14b8a6')
    expect(getBandColour('sage-ladder', 3, 5).toLowerCase()).toBe('#84cc16')
    expect(getBandColour('sage-ladder', 4, 5).toLowerCase()).toBe('#22c55e')
  })

  it('works for 3-band schemes (samples stops 0, 2, 4)', () => {
    expect(getBandColour('sage-ladder', 0, 3).toLowerCase()).toBe('#64748b')
    expect(getBandColour('sage-ladder', 2, 3).toLowerCase()).toBe('#22c55e')
  })
})
```

- [ ] **Step 2: Run — tests should fail**

Run: `npx vitest run tests/unit/band-scheme-palettes.test.ts`
Expected: FAIL — palette keys don't exist yet.

- [ ] **Step 3: Extend `PaletteKey` and `PALETTE_STOPS`**

In `src/lib/reports/band-scheme.ts`:

```typescript
export type PaletteKey =
  | 'red-amber-green'
  | 'soft-rag'
  | 'sage-ladder'
  | 'warm-neutral'
  | 'monochrome'
  | 'blue-scale'

const PALETTE_STOPS: Record<PaletteKey, string[]> = {
  'red-amber-green': ['#c62828', '#e67a00', '#2e7d32'],
  'soft-rag':        ['#c78a8a', '#d7b26a', '#7aa87a'],
  'sage-ladder':     ['#64748b', '#60a5fa', '#14b8a6', '#84cc16', '#22c55e'],
  'warm-neutral':    ['#8a7a5a', '#c9a962'],
  'monochrome':      ['#6b6b6b', '#1a1a1a'],
  'blue-scale':      ['#90caf9', '#0d47a1'],
}
```

- [ ] **Step 4: Add options to the editor picker**

In `src/components/band-scheme-editor/band-scheme-editor.tsx` (line ~14):

```typescript
const PALETTES: { value: PaletteKey; label: string }[] = [
  { value: 'red-amber-green', label: 'Red-Amber-Green' },
  { value: 'soft-rag', label: 'Soft RAG' },
  { value: 'sage-ladder', label: 'Sage Ladder' },
  { value: 'warm-neutral', label: 'Warm Neutral' },
  { value: 'monochrome', label: 'Monochrome' },
  { value: 'blue-scale', label: 'Blue Scale' },
]
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/unit/band-scheme-palettes.test.ts && npm run typecheck`
Expected: PASS for all 9 tests; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/band-scheme.ts src/components/band-scheme-editor/band-scheme-editor.tsx tests/unit/band-scheme-palettes.test.ts
git commit -m "feat: add soft-rag and sage-ladder palettes"
```

---

# FEATURE 2 — Score interpretation group-level rows

## Task 3: Extend `ScoreInterpretationConfig` with group flags

**Files:**
- Modify: `src/lib/reports/types.ts`

- [ ] **Step 1: Extend the config interface**

In `src/lib/reports/types.ts` (around line 76):

```typescript
export interface ScoreInterpretationConfig {
  displayLevel: 'dimension' | 'factor' | 'construct'
  groupByDimension?: boolean
  showScore?: boolean
  showBandLabel?: boolean
  showAnchors?: boolean
  // NEW — group-level display toggles (default false: no group header row)
  showGroupScore?: boolean
  showGroupBand?: boolean
  showGroupAnchors?: boolean
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/types.ts
git commit -m "feat: extend ScoreInterpretationConfig with group-level display flags"
```

---

## Task 4: Sample data generator emits `groupEntity`

**Files:**
- Modify: `src/lib/reports/sample-data.ts`
- Test: `tests/unit/score-interpretation-group.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/score-interpretation-group.test.ts
import { describe, it, expect } from 'vitest'
import { generateSampleData } from '@/lib/reports/sample-data'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'

describe('generateSampleData — score_interpretation emits groupEntity', () => {
  it('attaches a groupEntity to each grouped cluster', () => {
    const dimensionId = 'd1'
    const blocks = [{
      id: 'b1',
      type: 'score_interpretation',
      order: 0,
      config: { displayLevel: 'factor', groupByDimension: true },
    }]
    const entities = [
      { id: dimensionId, name: 'Emotional Intelligence', type: 'dimension' as const, pompScore: 72, anchorLow: 'Low', anchorHigh: 'High' },
      { id: 'f1', name: 'Self-Awareness', type: 'factor' as const, parentId: dimensionId, pompScore: 68 },
      { id: 'f2', name: 'Self-Regulation', type: 'factor' as const, parentId: dimensionId, pompScore: 76 },
    ]
    const [result] = generateSampleData(
      blocks as never,
      DEFAULT_REPORT_THEME,
      entities,
      'Test',
    )
    const { groups } = result.data as {
      groups: Array<{
        groupName: string | null
        groupEntity: { entityId: string; entityName: string; pompScore: number; bandResult: unknown; anchorLow: string | null; anchorHigh: string | null } | null
        entities: unknown[]
      }>
    }
    expect(groups).toHaveLength(1)
    expect(groups[0].groupName).toBe('Emotional Intelligence')
    expect(groups[0].groupEntity).toBeDefined()
    expect(groups[0].groupEntity!.entityId).toBe(dimensionId)
    expect(groups[0].groupEntity!.entityName).toBe('Emotional Intelligence')
    expect(groups[0].groupEntity!.pompScore).toBe(72)
    expect(groups[0].groupEntity!.anchorLow).toBe('Low')
    expect(groups[0].groupEntity!.anchorHigh).toBe('High')
  })

  it('ungrouped cluster has null groupEntity', () => {
    const blocks = [{
      id: 'b1',
      type: 'score_interpretation',
      order: 0,
      config: { displayLevel: 'factor', groupByDimension: false },
    }]
    const entities = [
      { id: 'f1', name: 'Self-Awareness', type: 'factor' as const, pompScore: 68 },
    ]
    const [result] = generateSampleData(
      blocks as never,
      DEFAULT_REPORT_THEME,
      entities,
      'Test',
    )
    const { groups } = result.data as { groups: Array<{ groupEntity: unknown }> }
    expect(groups[0].groupEntity).toBeNull()
  })
})
```

- [ ] **Step 2: Run — test fails**

Run: `npx vitest run tests/unit/score-interpretation-group.test.ts`
Expected: FAIL — `groupEntity` is undefined.

- [ ] **Step 3: Extend the `score_interpretation` case in `sample-data.ts`**

In `src/lib/reports/sample-data.ts` around line 232 (the `score_interpretation` case), after `parentNameMap` is built, also build a `parentEntityMap` that preserves the full `ScoredEntity`:

```typescript
case 'score_interpretation': {
  const filtered = filterEntities(entities, config)
  const parentNameMap = new Map<string, string>()
  const parentEntityMap = new Map<string, ScoredEntity>()
  for (const e of entities) {
    if (e.type === 'dimension') {
      parentNameMap.set(e.id, e.name)
      parentEntityMap.set(e.id, e as ScoredEntity)
    }
  }

  const groupByDim = config.groupByDimension !== false
  const groupMap = new Map<string, ScoredEntity[]>()
  const ungrouped: ScoredEntity[] = []

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

  const mapEntity = (e: ScoredEntity, i: number) => {
    const anchors = SAMPLE_ANCHORS[i % SAMPLE_ANCHORS.length]
    return {
      entityId: e.id,
      entityName: e.name,
      pompScore: e.pompScore,
      bandResult: e.bandResult,
      anchorLow: e.anchorLow ?? anchors.low,
      anchorHigh: e.anchorHigh ?? anchors.high,
    }
  }

  const mapGroupEntity = (e: ScoredEntity) => ({
    entityId: e.id,
    entityName: e.name,
    pompScore: e.pompScore,
    bandResult: e.bandResult,
    anchorLow: e.anchorLow ?? null,
    anchorHigh: e.anchorHigh ?? null,
  })

  // Lookup the dimension's ScoredEntity by name (we grouped by parentName).
  const parentByName = new Map<string, ScoredEntity>()
  for (const [id, name] of parentNameMap) {
    const entity = parentEntityMap.get(id)
    if (entity) parentByName.set(name, entity)
  }

  const groups: Array<{
    groupName: string | null
    groupEntity: ReturnType<typeof mapGroupEntity> | null
    entities: ReturnType<typeof mapEntity>[]
  }> = []
  for (const [groupName, entries] of groupMap) {
    const parent = parentByName.get(groupName)
    groups.push({
      groupName,
      groupEntity: parent ? mapGroupEntity(parent) : null,
      entities: entries.map(mapEntity),
    })
  }
  if (ungrouped.length > 0) {
    groups.push({ groupName: null, groupEntity: null, entities: ungrouped.map(mapEntity) })
  }

  return {
    palette,
    groups,
    config: {
      displayLevel: config.displayLevel ?? 'factor',
      groupByDimension: groupByDim,
      showScore: config.showScore !== false,
      showBandLabel: config.showBandLabel !== false,
      showAnchors: config.showAnchors !== false,
      showGroupScore: config.showGroupScore === true,
      showGroupBand: config.showGroupBand === true,
      showGroupAnchors: config.showGroupAnchors === true,
    },
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/score-interpretation-group.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/sample-data.ts tests/unit/score-interpretation-group.test.ts
git commit -m "feat: sample-data emits groupEntity for score_interpretation"
```

---

## Task 5: Runner emits `groupEntity`

**Files:**
- Modify: `src/lib/reports/runner.ts`

- [ ] **Step 1: Extend the runner's `score_interpretation` branch**

At `src/lib/reports/runner.ts:752`, mirror the sample-data change. The runner already iterates dimensions via `taxonomyMap` (line 755-756); build a parallel map keyed by dimension name that points to the full taxonomy entity so we can resolve its POMP from `scoreMap`:

```typescript
if (block.type === 'score_interpretation') {
  const filtered = filterScoredEntities(scoreMap, taxonomyMap, block.config as Record<string, unknown>)
  const parentNameMap = new Map<string, string>()
  const parentIdByName = new Map<string, string>()
  for (const [, entity] of taxonomyMap.entries()) {
    if (entity._taxonomy_level === 'dimension') {
      parentNameMap.set(entity.id, entity.name)
      parentIdByName.set(entity.name, entity.id)
    }
  }
  // … existing grouping logic …

  // Compute group POMP per the spec: prefer stored score (scoreMap), fall back
  // to weighted mean of children's POMPs (already handled by aggregator earlier).
  const buildGroupEntity = (groupName: string) => {
    const dimensionId = parentIdByName.get(groupName)
    if (!dimensionId) return null
    const dimension = taxonomyMap.get(dimensionId)
    if (!dimension) return null

    const stored = scoreMap[dimensionId]
    const pompScore = typeof stored === 'number'
      ? stored
      : weightedMeanOfChildren(dimensionId, filtered, taxonomyMap)

    return {
      entityId: dimensionId,
      entityName: String(dimension.name),
      pompScore: Math.round(pompScore),
      bandResult: resolveBand(pompScore, scheme),
      anchorLow: (dimension.anchor_low as string | null) ?? null,
      anchorHigh: (dimension.anchor_high as string | null) ?? null,
    }
  }

  const groups: Array<{ groupName: string | null; groupEntity: unknown; entities: ReturnType<typeof mapEntity>[] }> = []
  for (const [groupName, entries] of groupMap) {
    groups.push({
      groupName,
      groupEntity: buildGroupEntity(groupName),
      entities: entries.map(mapEntity),
    })
  }
  if (ungrouped.length > 0) {
    groups.push({ groupName: null, groupEntity: null, entities: ungrouped.map(mapEntity) })
  }
  return { palette: scheme.palette, groups, config: block.config }
}
```

Add a local helper `weightedMeanOfChildren` just above this `if` block:

```typescript
function weightedMeanOfChildren(
  dimensionId: string,
  filtered: Map<string, number>,
  taxonomyMap: Map<string, Record<string, unknown>>,
): number {
  let sum = 0
  let count = 0
  for (const [entityId, pomp] of filtered) {
    const entity = taxonomyMap.get(entityId)
    if (!entity) continue
    if (String(entity.dimension_id ?? '') === dimensionId) {
      sum += pomp
      count += 1
    }
  }
  return count === 0 ? 0 : sum / count
}
```

This is an unweighted mean. The spec mentions weighted by `factor_constructs.weight` / `dimension_constructs.weight` — but at runner time we only have `scoreMap` (POMP per entity) and `taxonomyMap`. The runner's existing aggregation has already applied link weights upstream for both factor- and construct-level scoring; at this layer, the simple mean of the already-aggregated children is the correct rollup. Leave the production weighted logic to `scoring/pipeline.ts` where it already lives.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Quick sanity unit test**

Smoke-test the runner isn't feasible at unit level without a large DB fixture. The sample-data test in Task 4 covers the shape; runner correctness is validated during manual acceptance in Task 14.

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/runner.ts
git commit -m "feat: runner emits groupEntity with stored or aggregated dimension POMP"
```

---

## Task 6: Render group header row when flags are set

**Files:**
- Modify: `src/components/reports/blocks/score-interpretation.tsx`

- [ ] **Step 1: Extend data types and add a GroupHeader component**

Replace the top of `src/components/reports/blocks/score-interpretation.tsx` interfaces:

```typescript
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
  groupEntity: InterpretationEntity | null
  entities: InterpretationEntity[]
}
```

- [ ] **Step 2: Replace the group label with a conditional header block**

Replace the `{group.groupName && (<p …>{group.groupName}</p>)}` with:

```tsx
{group.groupName && (
  <GroupHeader
    group={group}
    config={config}
    palette={palette}
    isFeatured={isFeatured}
  />
)}
```

And append a new `GroupHeader` component below `InterpretationRow`:

```tsx
function GroupHeader({
  group,
  config,
  palette,
  isFeatured,
}: {
  group: InterpretationGroup
  config: ScoreInterpretationConfig
  palette: PaletteKey
  isFeatured: boolean
}) {
  const showGroupRow =
    !!group.groupEntity && (config.showGroupScore || config.showGroupBand || config.showGroupAnchors)

  // Plain label (existing behaviour) when no group toggles are on.
  if (!showGroupRow) {
    return (
      <p
        className="text-[12px] font-bold uppercase tracking-[1.5px] pb-2 mb-3"
        style={{
          color: isFeatured ? 'rgba(255,255,255,0.6)' : 'var(--report-label-colour)',
          borderBottom: `2px solid ${isFeatured ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)'}`,
        }}
      >
        {group.groupName}
      </p>
    )
  }

  const entity = group.groupEntity!
  const headingColour = isFeatured ? 'currentColor' : 'var(--report-heading-colour)'
  const mutedColour = isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)'
  const hasAnchors = config.showGroupAnchors && (entity.anchorLow || entity.anchorHigh)

  return (
    <div className="mb-4 pb-3 border-b-2" style={{ borderColor: isFeatured ? 'rgba(255,255,255,0.15)' : 'var(--report-divider)' }}>
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <span
          className="text-[14px] font-bold uppercase tracking-[1px]"
          style={{ color: headingColour }}
        >
          {entity.entityName}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {config.showGroupBand && (
            <BandBadge
              label={entity.bandResult.bandLabel}
              bandIndex={entity.bandResult.bandIndex}
              bandCount={entity.bandResult.bandCount}
              palette={palette}
            />
          )}
          {config.showGroupScore && (
            <span className="text-[15px] font-bold tabular-nums" style={{ color: headingColour }}>
              {Math.round(entity.pompScore)}
            </span>
          )}
        </div>
      </div>

      {(config.showGroupScore || config.showGroupBand) && (
        <SegmentBar
          value={entity.pompScore}
          bandIndex={entity.bandResult.bandIndex}
          bandCount={entity.bandResult.bandCount}
          palette={palette}
          className="mb-1"
        />
      )}

      {hasAnchors && (
        <div className="flex justify-between gap-4 mt-0.5">
          <span className="text-[10px] flex-1" style={{ color: mutedColour }}>
            {entity.anchorLow ?? ''}
          </span>
          <span className="text-[10px] flex-1 text-right" style={{ color: mutedColour }}>
            {entity.anchorHigh ?? ''}
          </span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/blocks/score-interpretation.tsx
git commit -m "feat: render group header with score/band/anchors when toggles are set"
```

---

## Task 7: Add builder toggles for the three new flags

**Files:**
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx`

- [ ] **Step 1: Append three `SwitchField` controls to `ScoreInterpretationContent`**

At `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx`, after the existing `showAnchors` field (line 445), inside the same outer `<div>`, add:

```tsx
<div className="space-y-3 pt-4 border-t border-border/40">
  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Group-level display</p>
  <p className="text-xs text-muted-foreground -mt-2">
    Show the dimension/factor&apos;s own score, band, and anchors above each group.
  </p>
  <SwitchField
    id="interp-showGroupScore"
    label="Group score"
    help="Show the group entity's numeric score and score bar"
    checked={config.showGroupScore as boolean ?? false}
    onChange={(v) => onUpdateConfig('showGroupScore', v)}
  />
  <SwitchField
    id="interp-showGroupBand"
    label="Group band label"
    help="Show the qualitative band label for the group entity"
    checked={config.showGroupBand as boolean ?? false}
    onChange={(v) => onUpdateConfig('showGroupBand', v)}
  />
  <SwitchField
    id="interp-showGroupAnchors"
    label="Group anchors"
    help="Show low/high anchor sentences for the group entity"
    checked={config.showGroupAnchors as boolean ?? false}
    onChange={(v) => onUpdateConfig('showGroupAnchors', v)}
  />
</div>
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS (or only pre-existing warnings).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/report-templates/\[id\]/builder/block-content-panels.tsx
git commit -m "feat: builder toggles for group-level score/band/anchors"
```

---

# FEATURE 3 — Preview shell + PDF

## Task 8: Preview PDF token

**Files:**
- Create: `src/lib/reports/preview-pdf-token.ts`
- Test: `tests/unit/preview-pdf-token.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/preview-pdf-token.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import {
  createPreviewPdfToken,
  verifyPreviewPdfToken,
} from '@/lib/reports/preview-pdf-token'

beforeAll(() => {
  process.env.REPORT_PDF_TOKEN_SECRET = 'test-secret-for-unit-tests'
})

describe('preview PDF token', () => {
  it('round-trips for matching templateId + assessmentId', () => {
    const token = createPreviewPdfToken('template-1', 'assess-1')
    expect(verifyPreviewPdfToken(token, 'template-1', 'assess-1')).toBe(true)
  })

  it('rejects mismatched templateId', () => {
    const token = createPreviewPdfToken('template-1', 'assess-1')
    expect(verifyPreviewPdfToken(token, 'template-OTHER', 'assess-1')).toBe(false)
  })

  it('rejects mismatched assessmentId', () => {
    const token = createPreviewPdfToken('template-1', 'assess-1')
    expect(verifyPreviewPdfToken(token, 'template-1', 'assess-OTHER')).toBe(false)
  })

  it('rejects missing token', () => {
    expect(verifyPreviewPdfToken(null, 't', 'a')).toBe(false)
    expect(verifyPreviewPdfToken(undefined, 't', 'a')).toBe(false)
    expect(verifyPreviewPdfToken('', 't', 'a')).toBe(false)
  })

  it('rejects tampered signature', () => {
    const token = createPreviewPdfToken('template-1', 'assess-1')
    const [payload] = token.split('.')
    const tampered = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`
    expect(verifyPreviewPdfToken(tampered, 'template-1', 'assess-1')).toBe(false)
  })
})
```

- [ ] **Step 2: Run — test fails**

Run: `npx vitest run tests/unit/preview-pdf-token.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/reports/preview-pdf-token.ts`:

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto'

interface PreviewPdfTokenPayload {
  purpose: 'preview_pdf'
  templateId: string
  assessmentId: string
  exp: number
}

function getSigningSecret() {
  const secret =
    process.env.REPORT_PDF_TOKEN_SECRET ??
    process.env.TRAJECTAS_CONTEXT_SECRET ??
    process.env.INTERNAL_API_KEY
  if (!secret) {
    throw new Error(
      'REPORT_PDF_TOKEN_SECRET (or TRAJECTAS_CONTEXT_SECRET / INTERNAL_API_KEY) must be set for PDF token signing.',
    )
  }
  return secret
}

function signPayload(payload: string) {
  return createHmac('sha256', getSigningSecret()).update(payload).digest('base64url')
}

export function createPreviewPdfToken(templateId: string, assessmentId: string, ttlSeconds = 300) {
  const payload = Buffer.from(
    JSON.stringify({
      purpose: 'preview_pdf',
      templateId,
      assessmentId,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    } satisfies PreviewPdfTokenPayload),
  ).toString('base64url')
  return `${payload}.${signPayload(payload)}`
}

export function verifyPreviewPdfToken(
  token: string | null | undefined,
  templateId: string,
  assessmentId: string,
) {
  if (!token) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false

  const expectedSignature = signPayload(payload)
  const expectedBuffer = Buffer.from(expectedSignature)
  const actualBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return false
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PreviewPdfTokenPayload
    return (
      decoded.purpose === 'preview_pdf' &&
      decoded.templateId === templateId &&
      decoded.assessmentId === assessmentId &&
      decoded.exp > Math.floor(Date.now() / 1000)
    )
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/preview-pdf-token.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/preview-pdf-token.ts tests/unit/preview-pdf-token.test.ts
git commit -m "feat: preview-pdf-token module with HMAC scoped to (templateId, assessmentId)"
```

---

## Task 9: Print route for preview capture

**Files:**
- Create: `src/app/print/report-templates/[id]/preview/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/print/report-templates/[id]/preview/page.tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  getReportTemplate,
  getPreviewEntitiesForAssessment,
  listAssessmentsForPreview,
} from '@/app/actions/reports'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { buildTemplatePreviewBlocks } from '@/lib/reports/preview'
import { verifyPreviewPdfToken } from '@/lib/reports/preview-pdf-token'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ assessment?: string; pdfToken?: string }>
}

export default async function PrintPreviewPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams

  if (!verifyPreviewPdfToken(sp.pdfToken, id, sp.assessment ?? '')) {
    notFound()
  }

  const [template, assessments] = await Promise.all([
    getReportTemplate(id),
    listAssessmentsForPreview(),
  ])
  if (!template) notFound()

  const selectedId = sp.assessment ?? assessments[0]?.id ?? null
  const previewEntities = selectedId ? await getPreviewEntitiesForAssessment(selectedId) : []

  const sampleBlocks = buildTemplatePreviewBlocks(
    template.blocks as Record<string, unknown>[],
    previewEntities,
    template.name,
  )

  return (
    <Suspense>
      <ReportRenderer blocks={sampleBlocks} className="print-report" />
    </Suspense>
  )
}
```

Note on the `[data-print="true"]` selector: `ReportRenderer` (see `src/components/reports/report-renderer.tsx:66`) sets `data-print="true"` **only when** the URL carries `?format=print`. Our `generatePreviewPdf` (Task 10) builds the URL with `?format=print&assessment=...&pdfToken=...`, so the selector is set automatically. No explicit wrapper needed — same pattern the existing `/print/reports/[snapshotId]/page.tsx` uses.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/print/report-templates/\[id\]/preview/page.tsx
git commit -m "feat: print route for preview PDF capture"
```

---

## Task 10: Preview PDF generator

**Files:**
- Create: `src/lib/reports/preview-pdf.ts`

- [ ] **Step 1: Implement**

```typescript
// src/lib/reports/preview-pdf.ts
import { launchReportPdfBrowser } from '@/lib/reports/pdf-browser'
import { createPreviewPdfToken } from '@/lib/reports/preview-pdf-token'

function getAppUrl() {
  return (
    process.env.ADMIN_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3002'
  )
}

export async function generatePreviewPdf(
  templateId: string,
  assessmentId: string,
): Promise<Buffer> {
  const token = createPreviewPdfToken(templateId, assessmentId)
  const url =
    `${getAppUrl()}/print/report-templates/${templateId}/preview?format=print` +
    `&assessment=${encodeURIComponent(assessmentId)}` +
    `&pdfToken=${encodeURIComponent(token)}`

  const browser = await launchReportPdfBrowser()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 794, height: 1123 })
    await page.emulateMediaType('print')

    const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
    if (!response || !response.ok()) {
      throw new Error(`Print render failed with status ${response?.status() ?? 'unknown'}`)
    }

    await page.waitForSelector('[data-print="true"]', { timeout: 10000 })
    await page.evaluate(async () => {
      if ('fonts' in document) {
        await document.fonts.ready
      }
    })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/preview-pdf.ts
git commit -m "feat: generatePreviewPdf — Puppeteer-based preview capture"
```

---

## Task 11: PDF API endpoint

**Files:**
- Create: `src/app/api/report-templates/[id]/preview/pdf/route.ts`

- [ ] **Step 1: Implement**

```typescript
// src/app/api/report-templates/[id]/preview/pdf/route.ts
import {
  AuthenticationRequiredError,
  AuthorizationError,
  canManageReportTemplateLibrary,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { generatePreviewPdf } from '@/lib/reports/preview-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: templateId } = await params
  const url = new URL(request.url)
  const assessmentId = url.searchParams.get('assessment')

  if (!assessmentId) {
    return Response.json({ error: 'assessment query param is required' }, { status: 400 })
  }

  try {
    const scope = await resolveAuthorizedScope()
    if (!canManageReportTemplateLibrary(scope)) {
      throw new AuthorizationError(
        'Only platform or partner administrators can download report previews.',
      )
    }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  try {
    const pdf = await generatePreviewPdf(templateId, assessmentId)
    return new Response(
      new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength),
      {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="template-${templateId}-preview.pdf"`,
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Preview PDF generation failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/report-templates/\[id\]/preview/pdf/route.ts
git commit -m "feat: API endpoint to generate preview PDFs on demand"
```

---

## Task 12: PreviewPdfButton component

**Files:**
- Create: `src/components/reports/preview-pdf-button.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/reports/preview-pdf-button.tsx
'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface PreviewPdfButtonProps {
  templateId: string
  assessmentId: string | null
}

export function PreviewPdfButton({ templateId, assessmentId }: PreviewPdfButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!assessmentId) {
      toast.error('Choose an assessment first.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/report-templates/${templateId}/preview/pdf?assessment=${encodeURIComponent(assessmentId)}`,
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `template-${templateId}-preview.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PDF download failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading || !assessmentId}>
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      {loading ? 'Preparing…' : 'Download PDF'}
    </Button>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/reports/preview-pdf-button.tsx
git commit -m "feat: PreviewPdfButton — triggers preview PDF download"
```

---

## Task 13: Preview page shell — PageHeader, card, dropdown in header

**Files:**
- Modify: `src/app/(dashboard)/report-templates/[id]/preview/page.tsx`

- [ ] **Step 1: Replace the page with the viewer-style shell**

```tsx
// src/app/(dashboard)/report-templates/[id]/preview/page.tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { PreviewPdfButton } from '@/components/reports/preview-pdf-button'
import {
  getReportTemplate,
  getPreviewEntitiesForAssessment,
  listAssessmentsForPreview,
} from '@/app/actions/reports'
import { buildTemplatePreviewBlocks } from '@/lib/reports/preview'
import { PreviewAssessmentSelector } from './preview-assessment-selector'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ assessment?: string }>
}

export default async function PreviewPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams

  const [template, assessments] = await Promise.all([
    getReportTemplate(id),
    listAssessmentsForPreview(),
  ])
  if (!template) notFound()

  const selectedId = sp.assessment ?? assessments[0]?.id ?? null
  const selectedAssessment = selectedId
    ? assessments.find((a) => a.id === selectedId) ?? null
    : null

  const previewEntities = selectedId
    ? await getPreviewEntitiesForAssessment(selectedId)
    : []

  const sampleBlocks = buildTemplatePreviewBlocks(
    template.blocks as Record<string, unknown>[],
    previewEntities,
    template.name,
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <PageHeader
        eyebrow="Report templates"
        title={template.name}
        description={
          selectedAssessment
            ? `Preview — sample data for ${selectedAssessment.title}`
            : 'Preview'
        }
      >
        <div className="flex items-center gap-2">
          <PreviewAssessmentSelector
            templateId={id}
            assessments={assessments}
            selectedAssessmentId={selectedId}
          />
          <PreviewPdfButton templateId={id} assessmentId={selectedId} />
        </div>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Suspense>
          <ReportRenderer blocks={sampleBlocks} />
        </Suspense>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the client-side selector component**

`src/app/(dashboard)/report-templates/[id]/preview/preview-assessment-selector.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import type { PreviewAssessmentOption } from '@/app/actions/reports'

interface Props {
  templateId: string
  assessments: PreviewAssessmentOption[]
  selectedAssessmentId: string | null
}

export function PreviewAssessmentSelector({
  templateId,
  assessments,
  selectedAssessmentId,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  if (assessments.length === 0) return null

  return (
    <select
      value={selectedAssessmentId ?? ''}
      onChange={(e) => {
        const next = e.target.value
        startTransition(() => {
          router.replace(`/report-templates/${templateId}/preview?assessment=${encodeURIComponent(next)}`)
        })
      }}
      className="rounded-md border border-border bg-background px-2 py-1 text-xs"
      aria-label="Preview as assessment"
    >
      {assessments.map((a) => (
        <option key={a.id} value={a.id}>{a.title}</option>
      ))}
    </select>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/report-templates/\[id\]/preview/
git commit -m "feat: preview page uses viewer shell with dropdown and PDF download"
```

---

## Task 14: Final verification + acceptance

- [ ] **Step 1: Full test suite + typecheck + lint**

Run: `npm run typecheck && npx vitest run && npm run lint`
Expected: typecheck + lint pass; vitest shows only the same pre-existing failures that exist on main (not introduced by this plan).

- [ ] **Step 2: Manual acceptance checklist**

Start dev server: `npm run dev`, log in as platform admin.

**Palettes:**
- Navigate to `/settings/reports/band-scheme` → picker shows 6 palette options including `Soft RAG` and `Sage Ladder`.
- Select `soft-rag`, save, open a preview — band colours are the softer RAG triplet.
- Select `sage-ladder`, save — 3-band shows slate/teal/green; 5-band shows all 5 stops.

**Score interpretation:**
- In the builder, pick a template with a score_interpretation block.
- Under "Group-level display", toggle `Group score` — preview shows the dimension POMP and bar in the header row.
- Toggle `Group band label` — band badge appears in header.
- Toggle `Group anchors` — anchor sentences appear under the header bar.
- Turn all three off → header reverts to plain label (existing behaviour unchanged).

**Preview shell + PDF:**
- Open `/report-templates/<id>/preview` — shell has PageHeader + card + dropdown + Download PDF in the top-right.
- Change dropdown — URL updates, blocks re-render with the new assessment's scoped entities.
- Click Download PDF — browser downloads a .pdf matching what's on screen.

- [ ] **Step 3: Finishing skill**

When everything green, invoke `superpowers:finishing-a-development-branch`.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Puppeteer in production (Vercel) can't find Chromium | `@sparticuz/chromium-min` already used by real PDF path; same helper, same config |
| `data-print="true"` selector missing from preview render | Verify the ReportRenderer sets it unconditionally (same component used by real print route) |
| Group POMP rollup differs between preview (weighted mean) and runner (average of aggregated POMPs) | Leave the weighted logic in the scoring pipeline where it already runs; at render time we only ever work with already-aggregated POMPs |
| Dev ADMIN_APP_URL mismatch causes Puppeteer to fetch the wrong host | Same env var used by existing PDF pipeline; already works |
| Lint/typecheck regression on `block-content-panels.tsx` (large file) | Changes are additive; no existing code touched |
