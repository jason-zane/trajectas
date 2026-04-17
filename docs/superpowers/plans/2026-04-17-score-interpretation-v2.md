# Score Interpretation v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact `score_interpretation_v2` block type with flanking anchors, band-break ticks, brand-colour parent underline, and independent parent/child display toggles.

**Architecture:** New block type registered alongside v1. Reuses v1's data pipeline (same `InterpretationGroup[]` shape). New `TickedBar` shared chart component. New block component with `GroupHeader` and `FactorRow` sub-components. Builder panel mirrors v1's structure with split anchor toggles.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-04-17-score-interpretation-v2-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/reports/types.ts` | Add `BlockType` entry, config interface, `BlockConfigMap` entry |
| Modify | `src/lib/reports/registry.ts` | Add registry entry with default config |
| Create | `src/components/reports/charts/ticked-bar.tsx` | Shared bar component with band-break tick marks |
| Create | `src/components/reports/blocks/score-interpretation-v2.tsx` | Block component: entry point + GroupHeader + FactorRow |
| Modify | `src/components/reports/report-renderer.tsx` | Import and wire v2 block into BLOCK_MAP |
| Modify | `src/lib/reports/runner.ts` | Add runner case for v2 (reuses v1 grouping logic, v2 config shape) |
| Modify | `src/lib/reports/sample-data.ts` | Add sample data case for v2 (reuses v1 generator, v2 config shape) |
| Modify | `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx` | Builder panel with split anchor toggles |
| Create | `tests/unit/ticked-bar.test.ts` | Unit tests for tick position calculation |
| Create | `tests/unit/score-interpretation-v2.test.ts` | Unit tests for sample data + config resolution |

---

### Task 1: Types and registry entry

**Files:**
- Modify: `src/lib/reports/types.ts:11-28` (BlockType union), `:76-87` (config interface), `:144-158` (BlockConfigMap)
- Modify: `src/lib/reports/registry.ts:61-68` (add after existing score_interpretation)

- [ ] **Step 1: Add `score_interpretation_v2` to `BlockType` union**

In `src/lib/reports/types.ts`, add after line 19 (`'score_interpretation'`):

```typescript
  | 'score_interpretation_v2'
```

- [ ] **Step 2: Add `ScoreInterpretationV2Config` interface**

In `src/lib/reports/types.ts`, add after `ScoreInterpretationConfig` (after line 87):

```typescript
export interface ScoreInterpretationV2Config {
  displayLevel: 'dimension' | 'factor' | 'construct'
  groupByDimension?: boolean

  // Factor-level display toggles (default true)
  showScore?: boolean
  showBandLabel?: boolean
  showAnchorLow?: boolean
  showAnchorHigh?: boolean

  // Parent/group-level display toggles (default false)
  showGroupScore?: boolean
  showGroupBand?: boolean
  showGroupAnchorLow?: boolean
  showGroupAnchorHigh?: boolean
}
```

- [ ] **Step 3: Add to `BlockConfigMap`**

In `src/lib/reports/types.ts`, add after the `score_interpretation` entry in `BlockConfigMap`:

```typescript
  score_interpretation_v2: ScoreInterpretationV2Config
```

- [ ] **Step 4: Add registry entry**

In `src/lib/reports/registry.ts`, add after the `score_interpretation` entry (after line 68):

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

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: no errors related to `score_interpretation_v2`

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/types.ts src/lib/reports/registry.ts
git commit -m "feat(reports): add score_interpretation_v2 type and registry entry"
```

---

### Task 2: TickedBar shared component

**Files:**
- Create: `src/components/reports/charts/ticked-bar.tsx`
- Create: `tests/unit/ticked-bar.test.ts`

- [ ] **Step 1: Write tick position calculation test**

Create `tests/unit/ticked-bar.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeTickPositions } from '@/components/reports/charts/ticked-bar'
import type { BandDefinition } from '@/lib/reports/band-scheme'

const THREE_BANDS: BandDefinition[] = [
  { key: 'developing', label: 'Developing', min: 0, max: 40, indicatorTier: 'low' },
  { key: 'effective', label: 'Effective', min: 41, max: 69, indicatorTier: 'mid' },
  { key: 'highly_effective', label: 'Highly Effective', min: 70, max: 100, indicatorTier: 'high' },
]

const FIVE_BANDS: BandDefinition[] = [
  { key: 'emerging', label: 'Emerging', min: 0, max: 20, indicatorTier: 'low' },
  { key: 'developing', label: 'Developing', min: 21, max: 40, indicatorTier: 'low' },
  { key: 'competent', label: 'Competent', min: 41, max: 60, indicatorTier: 'mid' },
  { key: 'effective', label: 'Effective', min: 61, max: 80, indicatorTier: 'high' },
  { key: 'highly_effective', label: 'Highly Effective', min: 81, max: 100, indicatorTier: 'high' },
]

describe('computeTickPositions', () => {
  it('returns N-1 ticks for N bands (3-band)', () => {
    const ticks = computeTickPositions(THREE_BANDS)
    expect(ticks).toEqual([40, 69])
  })

  it('returns N-1 ticks for N bands (5-band)', () => {
    const ticks = computeTickPositions(FIVE_BANDS)
    expect(ticks).toEqual([20, 40, 60, 80])
  })

  it('returns empty array for single band', () => {
    const single: BandDefinition[] = [
      { key: 'all', label: 'All', min: 0, max: 100, indicatorTier: 'mid' },
    ]
    expect(computeTickPositions(single)).toEqual([])
  })

  it('returns empty array for empty bands', () => {
    expect(computeTickPositions([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ticked-bar.test.ts 2>&1 | tail -10`
Expected: FAIL — `computeTickPositions` not found

- [ ] **Step 3: Create TickedBar component**

Create `src/components/reports/charts/ticked-bar.tsx`:

```typescript
'use client'

import { cn } from '@/lib/utils'
import { getBandColour, type PaletteKey, type BandDefinition } from '@/lib/reports/band-scheme'

/** Compute tick positions (percentages) from band boundaries. */
export function computeTickPositions(bands: BandDefinition[]): number[] {
  if (bands.length <= 1) return []
  return bands.slice(0, -1).map((b) => b.max)
}

interface TickedBarProps {
  value: number
  bandIndex: number
  bandCount: number
  palette: PaletteKey
  bands: BandDefinition[]
  /** Tick colour — defaults to rgba(0,0,0,0.22) */
  tickColour?: string
  className?: string
}

export function TickedBar({
  value,
  bandIndex,
  bandCount,
  palette,
  bands,
  tickColour = 'rgba(0,0,0,0.22)',
  className,
}: TickedBarProps) {
  const fill = getBandColour(palette, bandIndex, bandCount)
  const ticks = computeTickPositions(bands)

  return (
    <div
      className={cn('rounded-full w-full relative overflow-hidden', className)}
      style={{ background: 'var(--report-divider)' }}
    >
      <div
        className="absolute top-0 left-0 bottom-0 rounded-full"
        style={{ width: `${value}%`, background: fill }}
      />
      {ticks.map((t) => (
        <span
          key={t}
          className="absolute top-0 bottom-0 w-[1.5px]"
          style={{
            left: `${t}%`,
            background: tickColour,
            transform: 'translateX(-50%)',
          }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ticked-bar.test.ts 2>&1 | tail -10`
Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/charts/ticked-bar.tsx tests/unit/ticked-bar.test.ts
git commit -m "feat(reports): add TickedBar component with band-break ticks"
```

---

### Task 3: Score Interpretation v2 block component

**Files:**
- Create: `src/components/reports/blocks/score-interpretation-v2.tsx`

Reference: existing v1 at `src/components/reports/blocks/score-interpretation.tsx` and spec.

- [ ] **Step 1: Create the block component**

Create `src/components/reports/blocks/score-interpretation-v2.tsx`:

```typescript
import type { ScoreInterpretationV2Config, BandResult } from '@/lib/reports/types'
import type { PresentationMode } from '@/lib/reports/presentation'
import type { PaletteKey, BandDefinition } from '@/lib/reports/band-scheme'
import { BandBadge } from '../charts/band-badge'
import { TickedBar } from '../charts/ticked-bar'

// ---------------------------------------------------------------------------
// Data interfaces (same shape as v1)
// ---------------------------------------------------------------------------

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

interface ScoreInterpretationV2Data {
  groups: InterpretationGroup[]
  config: ScoreInterpretationV2Config
  palette: PaletteKey
  bands: BandDefinition[]
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function ScoreInterpretationV2Block({
  data,
  mode,
}: {
  data: Record<string, unknown>
  mode?: PresentationMode
}) {
  const d = data as unknown as ScoreInterpretationV2Data
  if (!d.groups?.length) return null

  const isFeatured = mode === 'featured'
  const { config, palette, bands } = d

  return (
    <div className="space-y-[8mm]">
      {d.groups.map((group, gi) => (
        <div key={gi} className="break-inside-avoid">
          {group.groupName && config.groupByDimension !== false && (
            <GroupHeader
              group={group}
              config={config}
              palette={palette}
              bands={bands}
              isFeatured={isFeatured}
            />
          )}
          <div className={group.groupName && config.groupByDimension !== false ? 'pl-[5mm] pt-1' : ''}>
            {group.entities.map((entity) => (
              <FactorRow
                key={entity.entityId}
                entity={entity}
                config={config}
                palette={palette}
                bands={bands}
                isFeatured={isFeatured}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group header (parent row with underlined name)
// ---------------------------------------------------------------------------

function GroupHeader({
  group,
  config,
  palette,
  bands,
  isFeatured,
}: {
  group: InterpretationGroup
  config: ScoreInterpretationV2Config
  palette: PaletteKey
  bands: BandDefinition[]
  isFeatured: boolean
}) {
  const showExpanded =
    !!group.groupEntity &&
    (config.showGroupScore || config.showGroupBand || config.showGroupAnchorLow || config.showGroupAnchorHigh)

  const headingColour = isFeatured ? 'currentColor' : 'var(--report-heading-colour)'
  const mutedColour = isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)'
  const underlineColour = isFeatured ? 'rgba(255,255,255,0.6)' : 'var(--primary)'

  // Plain label — when no group toggles are on
  if (!showExpanded) {
    return (
      <p
        className="text-[13.5px] font-bold pb-1 mb-1"
        style={{
          color: headingColour,
          textDecoration: 'underline',
          textDecorationThickness: '1.5px',
          textUnderlineOffset: '3px',
          textDecorationColor: underlineColour,
        }}
      >
        {group.groupName}
      </p>
    )
  }

  const entity = group.groupEntity!
  const hasAnchorLow = config.showGroupAnchorLow && entity.anchorLow
  const hasAnchorHigh = config.showGroupAnchorHigh && entity.anchorHigh
  const showBar = config.showGroupScore || config.showGroupBand

  return (
    <div className="mb-1">
      {/* Name + badge + score */}
      <div className="flex items-baseline justify-between gap-4 mb-[3px]">
        <span
          className="text-[13.5px] font-bold"
          style={{
            color: headingColour,
            textDecoration: 'underline',
            textDecorationThickness: '1.5px',
            textUnderlineOffset: '3px',
            textDecorationColor: underlineColour,
          }}
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
              className="!text-[9.5px] !px-2 !py-0.5"
            />
          )}
          {config.showGroupScore && (
            <span
              className="text-[15px] font-bold tabular-nums"
              style={{ color: headingColour }}
            >
              {Math.round(entity.pompScore)}
            </span>
          )}
        </div>
      </div>

      {/* Bar with flanking anchors */}
      {showBar && (
        <div
          className="grid items-center gap-[3mm]"
          style={{ gridTemplateColumns: '1fr 65mm 1fr' }}
        >
          {hasAnchorLow ? (
            <span
              className="text-[9px] leading-[1.3] line-clamp-2"
              style={{ color: isFeatured ? 'rgba(255,255,255,0.5)' : '#4b5563' }}
            >
              {entity.anchorLow}
            </span>
          ) : <span />}
          <TickedBar
            value={entity.pompScore}
            bandIndex={entity.bandResult.bandIndex}
            bandCount={entity.bandResult.bandCount}
            palette={palette}
            bands={bands}
            tickColour={isFeatured ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)'}
            className="h-[14px]"
          />
          {hasAnchorHigh ? (
            <span
              className="text-[9px] leading-[1.3] text-right line-clamp-2"
              style={{ color: isFeatured ? 'rgba(255,255,255,0.5)' : '#4b5563' }}
            >
              {entity.anchorHigh}
            </span>
          ) : <span />}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Factor row (child)
// ---------------------------------------------------------------------------

function FactorRow({
  entity,
  config,
  palette,
  bands,
  isFeatured,
}: {
  entity: InterpretationEntity
  config: ScoreInterpretationV2Config
  palette: PaletteKey
  bands: BandDefinition[]
  isFeatured: boolean
}) {
  const headingColour = isFeatured ? 'currentColor' : 'var(--report-heading-colour)'
  const mutedColour = isFeatured ? 'rgba(255,255,255,0.5)' : 'var(--report-muted-colour)'
  const hasAnchorLow = config.showAnchorLow && entity.anchorLow
  const hasAnchorHigh = config.showAnchorHigh && entity.anchorHigh

  return (
    <div className="break-inside-avoid mb-[6px] last:mb-0">
      {/* Name + badge + score */}
      <div className="flex items-baseline justify-between gap-4 mb-[2px]">
        <span
          className="text-[12px] font-semibold"
          style={{ color: headingColour }}
        >
          {entity.entityName}
        </span>
        <div className="flex items-center gap-[6px] shrink-0">
          {config.showBandLabel && (
            <BandBadge
              label={entity.bandResult.bandLabel}
              bandIndex={entity.bandResult.bandIndex}
              bandCount={entity.bandResult.bandCount}
              palette={palette}
            />
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

      {/* Bar with flanking anchors */}
      <div
        className="grid items-center gap-[3mm]"
        style={{ gridTemplateColumns: '1fr 60mm 1fr' }}
      >
        {hasAnchorLow ? (
          <span
            className="text-[9px] leading-[1.3] line-clamp-2"
            style={{ color: mutedColour }}
          >
            {entity.anchorLow}
          </span>
        ) : <span />}
        <TickedBar
          value={entity.pompScore}
          bandIndex={entity.bandResult.bandIndex}
          bandCount={entity.bandResult.bandCount}
          palette={palette}
          bands={bands}
          tickColour={isFeatured ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.22)'}
          className="h-3"
        />
        {hasAnchorHigh ? (
          <span
            className="text-[9px] leading-[1.3] text-right line-clamp-2"
            style={{ color: mutedColour }}
          >
            {entity.anchorHigh}
          </span>
        ) : <span />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/reports/blocks/score-interpretation-v2.tsx
git commit -m "feat(reports): add ScoreInterpretationV2Block component"
```

---

### Task 4: Runner and sample data

**Files:**
- Modify: `src/lib/reports/runner.ts:734-813` (add v2 case after v1)
- Modify: `src/lib/reports/sample-data.ts:234-315` (add v2 case after v1)
- Create: `tests/unit/score-interpretation-v2.test.ts`

- [ ] **Step 1: Write sample data test**

Create `tests/unit/score-interpretation-v2.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateSampleData } from '@/lib/reports/sample-data'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'

describe('generateSampleData — score_interpretation_v2', () => {
  const blocks = [{
    id: 'b1',
    type: 'score_interpretation_v2',
    order: 0,
    config: {
      displayLevel: 'factor',
      groupByDimension: true,
      showScore: true,
      showBandLabel: true,
      showAnchorLow: true,
      showAnchorHigh: true,
    },
  }]
  const entities = [
    { id: 'd1', name: 'Cognitive Agility', type: 'dimension' as const, pompScore: 72, anchorLow: 'Low dim', anchorHigh: 'High dim' },
    { id: 'f1', name: 'Abstract Reasoning', type: 'factor' as const, parentId: 'd1', pompScore: 68 },
    { id: 'f2', name: 'Pattern Recognition', type: 'factor' as const, parentId: 'd1', pompScore: 84 },
  ]

  it('resolves groups with v2 config shape (split anchor toggles)', () => {
    const [result] = generateSampleData(blocks as never, DEFAULT_REPORT_THEME, entities, 'Test')
    const data = result.data as {
      groups: Array<{ groupName: string | null; groupEntity: unknown; entities: unknown[] }>
      config: Record<string, unknown>
      bands: unknown[]
    }
    expect(data.groups).toHaveLength(1)
    expect(data.groups[0].groupName).toBe('Cognitive Agility')
    expect(data.groups[0].entities).toHaveLength(2)
    // v2 config has split anchor toggles
    expect(data.config.showAnchorLow).toBe(true)
    expect(data.config.showAnchorHigh).toBe(true)
    // v2 includes bands array for tick rendering
    expect(data.bands).toBeDefined()
    expect(Array.isArray(data.bands)).toBe(true)
    expect(data.bands.length).toBeGreaterThan(0)
  })

  it('resolves ungrouped when groupByDimension is false', () => {
    const ungroupedBlocks = [{
      ...blocks[0],
      config: { ...blocks[0].config, groupByDimension: false },
    }]
    const [result] = generateSampleData(ungroupedBlocks as never, DEFAULT_REPORT_THEME, entities, 'Test')
    const data = result.data as { groups: Array<{ groupName: string | null }> }
    // All factors land in ungrouped bucket
    expect(data.groups.some((g) => g.groupName === null)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/score-interpretation-v2.test.ts 2>&1 | tail -10`
Expected: FAIL — v2 block type not handled

- [ ] **Step 3: Add v2 case to sample data generator**

In `src/lib/reports/sample-data.ts`, find the `case 'score_interpretation':` block (line 234) and add a new case for v2 directly after its closing `}` (line 315). The v2 case reuses the same grouping logic but resolves the v2 config shape and includes bands:

```typescript
    case 'score_interpretation_v2': {
      const filtered = filterEntities(entities, config)
      const parentNameMap = new Map<string, string>()
      const parentScoredMap = new Map<string, ScoredEntity>()
      for (const e of entities) {
        if (e.type === 'dimension') {
          parentNameMap.set(e.id, e.name)
          parentScoredMap.set(e.id, e)
        }
      }

      const groupByDim = config.groupByDimension !== false
      const groupMap = new Map<string, { parentId: string | null; items: ScoredEntity[] }>()
      const ungrouped: ScoredEntity[] = []

      for (const e of filtered) {
        const parentName = e.parentId ? (parentNameMap.get(e.parentId) ?? null) : null
        if (groupByDim && parentName) {
          const group = groupMap.get(parentName) ?? { parentId: e.parentId ?? null, items: [] }
          group.items.push(e)
          groupMap.set(parentName, group)
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

      type GroupEntity = ReturnType<typeof mapGroupEntity>
      const groups: Array<{
        groupName: string | null
        groupEntity: GroupEntity | null
        entities: ReturnType<typeof mapEntity>[]
      }> = []
      for (const [groupName, group] of groupMap) {
        const parent = group.parentId ? parentScoredMap.get(group.parentId) : undefined
        groups.push({
          groupName,
          groupEntity: parent ? mapGroupEntity(parent) : null,
          entities: group.items.map(mapEntity),
        })
      }
      if (ungrouped.length > 0) {
        groups.push({ groupName: null, groupEntity: null, entities: ungrouped.map(mapEntity) })
      }

      return {
        palette,
        bands: scheme.bands,
        groups,
        config: {
          displayLevel: config.displayLevel ?? 'factor',
          groupByDimension: groupByDim,
          showScore: config.showScore !== false,
          showBandLabel: config.showBandLabel !== false,
          showAnchorLow: config.showAnchorLow !== false,
          showAnchorHigh: config.showAnchorHigh !== false,
          showGroupScore: config.showGroupScore === true,
          showGroupBand: config.showGroupBand === true,
          showGroupAnchorLow: config.showGroupAnchorLow === true,
          showGroupAnchorHigh: config.showGroupAnchorHigh === true,
        },
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/score-interpretation-v2.test.ts 2>&1 | tail -10`
Expected: both tests PASS

- [ ] **Step 5: Add v2 case to runner**

In `src/lib/reports/runner.ts`, find the v1 `if (block.type === 'score_interpretation')` block ending with `return { palette: scheme.palette, groups, config: block.config }` at line 812. Add the v2 case after it:

```typescript
  if (block.type === 'score_interpretation_v2') {
    // Reuse v1 grouping logic — same data shape, v2 config
    const filtered = filterScoredEntities(scoreMap, taxonomyMap, block.config as Record<string, unknown>)
    const parentNameMap = new Map<string, string>()
    const parentIdByName = new Map<string, string>()
    for (const [, entity] of taxonomyMap.entries()) {
      if (entity._taxonomy_level === 'dimension') {
        parentNameMap.set(entity.id, entity.name)
        parentIdByName.set(entity.name, entity.id)
      }
    }
    const groupByDim = (block.config as Record<string, unknown>).groupByDimension !== false
    const groupMap = new Map<string, Array<{ entityId: string; entity: Record<string, unknown>; pompScore: number }>>()
    const ungrouped: Array<{ entityId: string; entity: Record<string, unknown>; pompScore: number }> = []
    for (const [entityId, pompScore] of filtered) {
      const entity = taxonomyMap.get(entityId)
      if (!entity) continue
      const parentId = entity.dimension_id ? String(entity.dimension_id) : null
      const parentName = parentId ? (parentNameMap.get(parentId) ?? null) : null
      if (groupByDim && parentName) {
        const list = groupMap.get(parentName) ?? []
        list.push({ entityId, entity, pompScore })
        groupMap.set(parentName, list)
      } else {
        ungrouped.push({ entityId, entity, pompScore })
      }
    }
    const mapEntity = (item: { entityId: string; entity: Record<string, unknown>; pompScore: number }) => ({
      entityId: item.entityId,
      entityName: item.entity.name,
      pompScore: Math.round(item.pompScore),
      bandResult: resolveBand(item.pompScore, scheme),
      anchorLow: (item.entity.anchor_low as string | null) ?? null,
      anchorHigh: (item.entity.anchor_high as string | null) ?? null,
    })

    const buildGroupEntity = (
      groupName: string,
      children: Array<{ pompScore: number }>,
    ) => {
      const dimensionId = parentIdByName.get(groupName)
      if (!dimensionId) return null
      const dimension = taxonomyMap.get(dimensionId)
      if (!dimension) return null
      const stored = scoreMap[dimensionId]
      const pompScore = typeof stored === 'number'
        ? stored
        : children.length === 0
          ? 0
          : children.reduce((sum, c) => sum + c.pompScore, 0) / children.length
      return {
        entityId: dimensionId,
        entityName: String(dimension.name),
        pompScore: Math.round(pompScore),
        bandResult: resolveBand(pompScore, scheme),
        anchorLow: (dimension.anchor_low as string | null) ?? null,
        anchorHigh: (dimension.anchor_high as string | null) ?? null,
      }
    }

    const groups: Array<{
      groupName: string | null
      groupEntity: ReturnType<typeof buildGroupEntity>
      entities: ReturnType<typeof mapEntity>[]
    }> = []
    for (const [groupName, entries] of groupMap) {
      groups.push({
        groupName,
        groupEntity: buildGroupEntity(groupName, entries),
        entities: entries.map(mapEntity),
      })
    }
    if (ungrouped.length > 0) {
      groups.push({ groupName: null, groupEntity: null, entities: ungrouped.map(mapEntity) })
    }
    return { palette: scheme.palette, bands: scheme.bands, groups, config: block.config }
  }
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/reports/runner.ts src/lib/reports/sample-data.ts tests/unit/score-interpretation-v2.test.ts
git commit -m "feat(reports): add runner + sample data for score_interpretation_v2"
```

---

### Task 5: Wire report renderer

**Files:**
- Modify: `src/components/reports/report-renderer.tsx:9` (import), `:33` (BLOCK_MAP entry)

- [ ] **Step 1: Add import and BLOCK_MAP entry**

In `src/components/reports/report-renderer.tsx`:

Add import after the v1 import (line 9):
```typescript
import { ScoreInterpretationV2Block } from './blocks/score-interpretation-v2'
```

Add to BLOCK_MAP after the v1 entry (line 33):
```typescript
  score_interpretation_v2: ScoreInterpretationV2Block,
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/reports/report-renderer.tsx
git commit -m "feat(reports): wire ScoreInterpretationV2Block into renderer"
```

---

### Task 6: Builder panel

**Files:**
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx`

- [ ] **Step 1: Add the v2 builder panel function**

In `block-content-panels.tsx`, add after `ScoreInterpretationContent` (after line 476):

```typescript
// ---------------------------------------------------------------------------
// Score Interpretation v2
// ---------------------------------------------------------------------------

function ScoreInterpretationV2Content({ block, onUpdateConfig }: BlockContentPanelProps) {
  const config = block.config as Record<string, unknown>
  return (
    <div className="space-y-4">
      <DisplayLevelSelect
        value={String(config.displayLevel ?? 'factor')}
        onChange={(v) => onUpdateConfig('displayLevel', v)}
      />
      <SwitchField
        id="interp2-groupByDimension"
        label="Group by dimension"
        help="Group factors/constructs under their parent dimension heading"
        checked={config.groupByDimension as boolean ?? true}
        onChange={(v) => onUpdateConfig('groupByDimension', v)}
      />
      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Factor display</p>
        <SwitchField
          id="interp2-showScore"
          label="Score"
          help="Display the numeric score value"
          checked={config.showScore as boolean ?? true}
          onChange={(v) => onUpdateConfig('showScore', v)}
        />
        <SwitchField
          id="interp2-showBandLabel"
          label="Band label"
          help="Qualitative label like 'Highly Effective' or 'Developing'"
          checked={config.showBandLabel as boolean ?? true}
          onChange={(v) => onUpdateConfig('showBandLabel', v)}
        />
        <SwitchField
          id="interp2-showAnchorLow"
          label="Low anchor"
          help="Low-end behavioural indicator text"
          checked={config.showAnchorLow as boolean ?? true}
          onChange={(v) => onUpdateConfig('showAnchorLow', v)}
        />
        <SwitchField
          id="interp2-showAnchorHigh"
          label="High anchor"
          help="High-end behavioural indicator text"
          checked={config.showAnchorHigh as boolean ?? true}
          onChange={(v) => onUpdateConfig('showAnchorHigh', v)}
        />
      </div>
      <div className="space-y-3 pt-4 border-t border-border/40">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dimension display</p>
        <p className="text-xs text-muted-foreground -mt-2">
          Show the dimension&apos;s own score, band, and anchors above each group. Applies only when &quot;Group by dimension&quot; is on.
        </p>
        <SwitchField
          id="interp2-showGroupScore"
          label="Dimension score"
          help="Show the dimension's numeric score and bar"
          checked={config.showGroupScore as boolean ?? false}
          onChange={(v) => onUpdateConfig('showGroupScore', v)}
        />
        <SwitchField
          id="interp2-showGroupBand"
          label="Dimension band label"
          help="Show the qualitative band label for the dimension"
          checked={config.showGroupBand as boolean ?? false}
          onChange={(v) => onUpdateConfig('showGroupBand', v)}
        />
        <SwitchField
          id="interp2-showGroupAnchorLow"
          label="Dimension low anchor"
          help="Low-end behavioural indicator for the dimension"
          checked={config.showGroupAnchorLow as boolean ?? false}
          onChange={(v) => onUpdateConfig('showGroupAnchorLow', v)}
        />
        <SwitchField
          id="interp2-showGroupAnchorHigh"
          label="Dimension high anchor"
          help="High-end behavioural indicator for the dimension"
          checked={config.showGroupAnchorHigh as boolean ?? false}
          onChange={(v) => onUpdateConfig('showGroupAnchorHigh', v)}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Register in the PANEL_MAP**

Find the `PANEL_MAP` object (search for `score_interpretation: ScoreInterpretationContent`) and add after it:

```typescript
  score_interpretation_v2: ScoreInterpretationV2Content,
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/report-templates/\[id\]/builder/block-content-panels.tsx
git commit -m "feat(reports): add builder panel for score_interpretation_v2"
```

---

### Task 7: Run all tests and verify

**Files:** none (verification only)

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run 2>&1 | tail -20`
Expected: all tests pass, including existing v1 tests and new v2 tests

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit --pretty 2>&1 | tail -10`
Expected: no errors

- [ ] **Step 3: Run lint**

Run: `npx next lint 2>&1 | tail -10`
Expected: no errors

- [ ] **Step 4: Manual verification — preview in the builder**

Open the report template builder in the browser, add a "Score Interpretation (Compact)" block, and verify:
- Block appears in the add-block menu
- Config panel shows split anchor toggles
- Preview renders the flanking anchor layout
- Band-break ticks visible on bars
- Parent row shows underlined name in brand colour when group toggles are on
- Children are indented when grouped

- [ ] **Step 5: Final commit (if any lint/type fixes needed)**

```bash
git add -A
git commit -m "fix(reports): address lint/type issues in score_interpretation_v2"
```
