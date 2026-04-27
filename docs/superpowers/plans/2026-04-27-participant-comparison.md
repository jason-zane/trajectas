# Participant Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the participant comparison workspace defined in `docs/superpowers/specs/2026-04-27-participant-comparison-design.md` — a heatmap matrix of selected participants × assessment factors/dimensions, with CSV export, reachable from existing participant lists.

**Architecture:** Bottom-up. Pure libraries first (rollups, CSV, band resolution) so they're TDD-testable without a database. Then server actions, then the API route, then UI components in dependency order, then routes, then wire the "Compare selected" bulk action into existing tables. Portal mirrors come last.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Supabase (`@supabase/ssr`) · TanStack Table · vitest · React Testing Library · sonner · lucide-react.

---

## Pre-flight

The spec was committed on `fix/sanitize-html-jsdom`, which is unrelated to this feature. Before any code changes:

- [ ] **Step 0a: Move to a dedicated branch from main.**

```bash
git fetch origin
git checkout main
git pull --ff-only
git checkout -b feat/participant-comparison
git cherry-pick 2dd2334 d85ad89 78ffc83   # spec + clarification + this plan
```

- [ ] **Step 0b: Verify the spec is on the new branch.**

```bash
git log --oneline -5
ls docs/superpowers/specs/2026-04-27-participant-comparison-design.md
```

Expected: Both spec commits present, file readable.

- [ ] **Step 0c: Confirm local Supabase is running and migrations are applied.**

```bash
npx supabase status
```

Expected: Output includes a postgres URL. If not running: `npm run db:test:start && npm run db:test:reset`.

---

## File structure (overview)

**Create**
```
src/lib/comparison/
  types.ts                              # shared shapes used by libraries + actions + components
  rollup-scores.ts                      # weighted-average rollup, missing-children handling
  build-csv.ts                          # (rows, columns) → CSV string, RFC 4180 escaping
  resolve-bands.ts                      # thin wrapper over resolveBandScheme + getBandColour

src/app/actions/comparison.ts           # getComparisonMatrix, getEligibleAssessmentsForParticipants, getSessionOptionsForRow

src/app/api/comparison/export/route.ts  # POST → text/csv

src/components/comparison/
  comparison-cell.tsx
  comparison-matrix.tsx
  comparison-row-session-popover.tsx
  add-participant-dialog.tsx
  comparison-export-button.tsx
  comparison-selection-bar.tsx
  comparison-workspace.tsx

src/app/(dashboard)/campaigns/[id]/compare/{page,loading}.tsx
src/app/(dashboard)/participants/compare/{page,loading}.tsx
src/app/partner/campaigns/[id]/compare/{page,loading}.tsx
src/app/partner/participants/compare/{page,loading}.tsx       # only if partner global participants list exists
src/app/client/campaigns/[id]/compare/{page,loading}.tsx
src/app/client/participants/compare/{page,loading}.tsx        # only if client global participants list exists

tests/unit/comparison/{rollup-scores,build-csv,resolve-bands}.test.ts
tests/integration/comparison-actions.test.ts
tests/components/comparison-matrix.test.tsx
```

**Modify**
- `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx` — append a "Compare selected" bulk action.
- `src/app/(dashboard)/participants/participants-table.tsx` — append a "Compare selected" bulk action on the Sessions view; add to Participants view if it has a bulk bar.
- Mirror the two file edits above into the partner and client participant managers/tables.

---

## Phase 1 — Pure libraries (TDD, no DB)

### Task 1: Shared types + rollup-scores library

**Files**
- Create: `src/lib/comparison/types.ts`
- Create: `src/lib/comparison/rollup-scores.ts`
- Test: `tests/unit/comparison/rollup-scores.test.ts`

- [ ] **Step 1: Write `types.ts` with the shared comparison shapes.**

These are referenced by libraries, actions, and components. Putting them in one file keeps the API surface explicit.

```ts
// src/lib/comparison/types.ts
export type Granularity = 'dimensions' | 'factors_or_constructs'

export type EntryRequest = {
  campaignParticipantId: string
  sessionIdsByAssessment?: Record<string, string>
}

export type ComparisonRequest = {
  entries: EntryRequest[]
  assessmentIds: string[]
  granularity: Granularity
}

export type ColumnLevel = 'dimension' | 'factor' | 'construct'

export type Column = {
  id: string
  name: string
  level: ColumnLevel
  parentId: string | null
}

export type ColumnGroup = {
  assessmentId: string
  assessmentName: string
  rollup: Column            // single rollup column per group
  children: Column[]
}

export type RowAssessment = {
  assessmentId: string
  sessionId: string | null
  sessionStartedAt: string | null
  sessionStatus: string | null
  attemptNumber: number | null
  cells: Record<string, number | null>   // keyed by Column.id (rollup + children)
}

export type ComparisonRow = {
  entryId: string
  campaignParticipantId: string
  participantName: string
  participantEmail: string
  perAssessment: RowAssessment[]
}

export type ComparisonResult = {
  columns: ColumnGroup[]
  rows: ComparisonRow[]
}

export type ChildScore = { childId: string; score: number | null; weight: number }
```

- [ ] **Step 2: Write the failing test for rollup-scores.**

```ts
// tests/unit/comparison/rollup-scores.test.ts
import { describe, it, expect } from 'vitest'
import { rollupChildren } from '@/lib/comparison/rollup-scores'

describe('rollupChildren', () => {
  it('returns the weighted average rounded to integer', () => {
    expect(
      rollupChildren([
        { childId: 'a', score: 70, weight: 1 },
        { childId: 'b', score: 80, weight: 1 },
        { childId: 'c', score: 90, weight: 2 },
      ]),
    ).toBe(83) // (70+80+180)/4 = 82.5 → 83
  })

  it('returns null if any child score is null', () => {
    expect(
      rollupChildren([
        { childId: 'a', score: 70, weight: 1 },
        { childId: 'b', score: null, weight: 1 },
      ]),
    ).toBeNull()
  })

  it('returns null for an empty input', () => {
    expect(rollupChildren([])).toBeNull()
  })

  it('treats zero weight as a contributing child with weight 0 (skipped)', () => {
    expect(
      rollupChildren([
        { childId: 'a', score: 70, weight: 1 },
        { childId: 'b', score: 80, weight: 0 },
      ]),
    ).toBe(70)
  })

  it('returns null if the total weight is zero', () => {
    expect(rollupChildren([{ childId: 'a', score: 70, weight: 0 }])).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test and confirm it fails.**

```bash
npm run test:unit -- tests/unit/comparison/rollup-scores.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Write the minimal implementation.**

```ts
// src/lib/comparison/rollup-scores.ts
import type { ChildScore } from './types'

/**
 * Weighted average of children, rounded to the nearest integer.
 * Returns null if any child is null, the input is empty, or all weights are zero.
 */
export function rollupChildren(children: ChildScore[]): number | null {
  if (children.length === 0) return null
  let totalWeight = 0
  let weightedSum = 0
  for (const child of children) {
    if (child.score === null) return null
    if (child.weight <= 0) continue
    totalWeight += child.weight
    weightedSum += child.score * child.weight
  }
  if (totalWeight === 0) return null
  return Math.round(weightedSum / totalWeight)
}
```

- [ ] **Step 5: Run the test and confirm pass.**

```bash
npm run test:unit -- tests/unit/comparison/rollup-scores.test.ts
```
Expected: 5 passed.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/comparison/types.ts src/lib/comparison/rollup-scores.ts tests/unit/comparison/rollup-scores.test.ts
git commit -m "feat(comparison): rollup-scores weighted average library"
```

---

### Task 2: build-csv library

**Files**
- Create: `src/lib/comparison/build-csv.ts`
- Test: `tests/unit/comparison/build-csv.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// tests/unit/comparison/build-csv.test.ts
import { describe, it, expect } from 'vitest'
import { buildComparisonCsv } from '@/lib/comparison/build-csv'
import type { ColumnGroup, ComparisonRow } from '@/lib/comparison/types'

const groups: ColumnGroup[] = [
  {
    assessmentId: 'a1',
    assessmentName: 'Leadership',
    rollup: { id: 'd1', name: 'Influence', level: 'dimension', parentId: null },
    children: [
      { id: 'f1', name: 'Persuasion', level: 'factor', parentId: 'd1' },
      { id: 'f2', name: 'Empathy, real', level: 'factor', parentId: 'd1' },
    ],
  },
]

const rows: ComparisonRow[] = [
  {
    entryId: 'e1',
    campaignParticipantId: 'cp1',
    participantName: 'O\'Connor, Sam',
    participantEmail: 'sam@example.com',
    perAssessment: [
      {
        assessmentId: 'a1',
        sessionId: 's1',
        sessionStartedAt: '2026-04-02T10:00:00Z',
        sessionStatus: 'completed',
        attemptNumber: 2,
        cells: { d1: 75, f1: 72, f2: 78 },
      },
    ],
  },
]

describe('buildComparisonCsv', () => {
  it('emits a header row with identity + group columns', () => {
    const csv = buildComparisonCsv({ columns: groups, rows })
    const [header] = csv.split('\n')
    expect(header).toBe(
      ['Participant', 'Email', 'Date', 'Attempt #', 'Assessment', 'Session Status', 'Influence', 'Persuasion', '"Empathy, real"'].join(','),
    )
  })

  it('emits one data row per (participant, assessment) and quotes commas/quotes/newlines', () => {
    const csv = buildComparisonCsv({ columns: groups, rows })
    const [, data] = csv.split('\n')
    expect(data).toBe(
      ['"O\'Connor, Sam"', 'sam@example.com', '2026-04-02', '2', 'Leadership', 'completed', '75', '72', '78'].join(','),
    )
  })

  it('renders blank cells (null) as empty strings', () => {
    const blanked: ComparisonRow[] = [
      {
        ...rows[0],
        perAssessment: [
          {
            ...rows[0].perAssessment[0],
            cells: { d1: null, f1: 72, f2: null },
          },
        ],
      },
    ]
    const csv = buildComparisonCsv({ columns: groups, rows: blanked })
    const [, data] = csv.split('\n')
    expect(data.endsWith(',,72,')).toBe(true)
  })

  it('escapes embedded double quotes by doubling them', () => {
    const csv = buildComparisonCsv({
      columns: groups,
      rows: [
        {
          ...rows[0],
          participantName: 'Say "Hi"',
          perAssessment: rows[0].perAssessment,
        },
      ],
    })
    const [, data] = csv.split('\n')
    expect(data.startsWith('"Say ""Hi"""')).toBe(true)
  })

  it('escapes newlines inside fields', () => {
    const csv = buildComparisonCsv({
      columns: groups,
      rows: [
        {
          ...rows[0],
          participantName: 'Line1\nLine2',
          perAssessment: rows[0].perAssessment,
        },
      ],
    })
    const dataRows = csv.split('\n').slice(1).join('\n')
    expect(dataRows.startsWith('"Line1\nLine2"')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test and confirm fail.**

```bash
npm run test:unit -- tests/unit/comparison/build-csv.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation.**

```ts
// src/lib/comparison/build-csv.ts
import type { ColumnGroup, ComparisonResult } from './types'

const IDENTITY_HEADERS = ['Participant', 'Email', 'Date', 'Attempt #', 'Assessment', 'Session Status'] as const

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'number' ? String(value) : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function isoDate(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function flattenColumns(groups: ColumnGroup[]): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = []
  for (const g of groups) {
    out.push({ id: g.rollup.id, name: g.rollup.name })
    for (const c of g.children) out.push({ id: c.id, name: c.name })
  }
  return out
}

export function buildComparisonCsv(result: ComparisonResult): string {
  const columns = flattenColumns(result.columns)
  const headerRow = [...IDENTITY_HEADERS, ...columns.map((c) => c.name)].map(escapeCell).join(',')

  const dataRows: string[] = []
  for (const row of result.rows) {
    for (const a of row.perAssessment) {
      const group = result.columns.find((g) => g.assessmentId === a.assessmentId)
      const groupColumnIds = new Set<string>([
        group?.rollup.id ?? '',
        ...(group?.children.map((c) => c.id) ?? []),
      ])
      const cells = columns.map((c) => (groupColumnIds.has(c.id) ? a.cells[c.id] ?? null : null))
      const line = [
        row.participantName,
        row.participantEmail,
        isoDate(a.sessionStartedAt),
        a.attemptNumber ?? '',
        group?.assessmentName ?? '',
        a.sessionStatus ?? '',
        ...cells,
      ]
        .map(escapeCell)
        .join(',')
      dataRows.push(line)
    }
  }
  return [headerRow, ...dataRows].join('\n')
}
```

- [ ] **Step 4: Run the test and confirm pass.**

```bash
npm run test:unit -- tests/unit/comparison/build-csv.test.ts
```
Expected: 5 passed.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/comparison/build-csv.ts tests/unit/comparison/build-csv.test.ts
git commit -m "feat(comparison): build-csv library with RFC 4180 escaping"
```

---

### Task 3: resolve-bands wrapper

**Files**
- Create: `src/lib/comparison/resolve-bands.ts`
- Test: `tests/unit/comparison/resolve-bands.test.ts`

- [ ] **Step 1: Read the existing band-scheme helpers** to understand the inputs.

```bash
sed -n '90,140p' src/lib/reports/band-scheme.ts
```

Note the exported `resolveBandScheme(template, partner, platform)`, `getBandColour(palette, bandIndex, bandCount)`, and `DEFAULT_3_BAND_SCHEME`.

- [ ] **Step 2: Write the failing test.**

```ts
// tests/unit/comparison/resolve-bands.test.ts
import { describe, it, expect } from 'vitest'
import { buildCellStyleResolver } from '@/lib/comparison/resolve-bands'
import { DEFAULT_3_BAND_SCHEME } from '@/lib/reports/band-scheme'

describe('buildCellStyleResolver', () => {
  it('returns a style with backgroundColor for an in-band score', () => {
    const get = buildCellStyleResolver({ partner: null, platform: { bandScheme: DEFAULT_3_BAND_SCHEME } })
    const style = get(80)
    expect(style.backgroundColor).toBeTruthy()
  })

  it('returns an empty style for null', () => {
    const get = buildCellStyleResolver({ partner: null, platform: { bandScheme: DEFAULT_3_BAND_SCHEME } })
    expect(get(null)).toEqual({})
  })

  it('clamps scores to [0, 100]', () => {
    const get = buildCellStyleResolver({ partner: null, platform: { bandScheme: DEFAULT_3_BAND_SCHEME } })
    expect(get(150).backgroundColor).toBeTruthy()
    expect(get(-5).backgroundColor).toBeTruthy()
  })

  it('falls back to the default scheme when nothing is provided', () => {
    const get = buildCellStyleResolver({ partner: null, platform: { bandScheme: null } })
    expect(get(50).backgroundColor).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run the test and confirm fail.**

```bash
npm run test:unit -- tests/unit/comparison/resolve-bands.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation.**

```ts
// src/lib/comparison/resolve-bands.ts
import type { CSSProperties } from 'react'
import {
  resolveBandScheme,
  getBandColour,
  DEFAULT_3_BAND_SCHEME,
  type BandScheme,
} from '@/lib/reports/band-scheme'

export type BandResolverInput = {
  partner: { bandScheme: BandScheme | null } | null
  platform: { bandScheme: BandScheme | null }
}

export function buildCellStyleResolver(input: BandResolverInput): (score: number | null) => CSSProperties {
  const scheme = resolveBandScheme(
    /* template */ null,
    input.partner ?? null,
    { bandScheme: input.platform.bandScheme ?? DEFAULT_3_BAND_SCHEME },
  )
  return (score) => {
    if (score === null || Number.isNaN(score)) return {}
    const clamped = Math.max(0, Math.min(100, score))
    const idx = scheme.bands.findIndex((b) => clamped >= b.min && clamped <= b.max)
    if (idx < 0) return {}
    return { backgroundColor: getBandColour(scheme.palette, idx, scheme.bands.length) }
  }
}
```

- [ ] **Step 5: Run the test and confirm pass.**

```bash
npm run test:unit -- tests/unit/comparison/resolve-bands.test.ts
```
Expected: 4 passed.

- [ ] **Step 6: Confirm `resolveBandScheme` accepts `null` for the template arg.** If TypeScript or the runtime validation rejects `null`, adjust by passing `{ bandScheme: null }` instead.

```bash
npm run typecheck
```

- [ ] **Step 7: Commit.**

```bash
git add src/lib/comparison/resolve-bands.ts tests/unit/comparison/resolve-bands.test.ts
git commit -m "feat(comparison): resolve-bands wrapper for cell heat colours"
```

---

## Phase 2 — Server actions

### Task 4: getEligibleAssessmentsForParticipants

**Files**
- Create (incremental): `src/app/actions/comparison.ts`
- Test: `tests/integration/comparison-actions.test.ts`

- [ ] **Step 1: Read the existing auth helpers.** Open `src/lib/auth/authorization.ts` and confirm the shapes of:
  - `requireParticipantAccess(participantId)` (around `:565`) — throws `AuthorizationError` if the caller cannot see this `campaign_participants` row.
  - `requireSessionAccess(sessionId)` (around `:584`) — same idea for a session.
  - `resolveAuthorizedScope()` (no args, cached) — returns the caller's scope object.

  Also skim `src/app/actions/sessions.ts:1-80` for the canonical action shape (imports, `'use server'`, `createClient` vs `createAdminClient`).

- [ ] **Step 2: Write the failing integration test.** Use the local-Supabase test runner per `AGENTS.md`.

```ts
// tests/integration/comparison-actions.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { getEligibleAssessmentsForParticipants } from '@/app/actions/comparison'
// ↓ replace with your project's existing seed/login helpers
import { signInAsAdmin, seedCampaignWithParticipantsAndSessions } from '@tests/integration/helpers'

describe('getEligibleAssessmentsForParticipants', () => {
  beforeAll(async () => {
    await signInAsAdmin()
  })

  it('returns the union of assessments across selected participants with completed-session counts', async () => {
    const { campaignParticipantIds, expectedAssessments } = await seedCampaignWithParticipantsAndSessions()
    const result = await getEligibleAssessmentsForParticipants(campaignParticipantIds)
    expect(result.map((a) => a.assessmentId).sort()).toEqual(expectedAssessments.map((a) => a.id).sort())
    for (const a of result) {
      expect(typeof a.assessmentName).toBe('string')
      expect(typeof a.completedSessionCount).toBe('number')
    }
  })

  it('throws on unauthorized campaign_participant ids', async () => {
    await expect(getEligibleAssessmentsForParticipants(['00000000-0000-0000-0000-000000000000'])).rejects.toBeTruthy()
  })
})
```

If `tests/integration/helpers` does not yet exist, port the smallest piece you need from an existing integration test in `tests/integration/`. Do not invent new seed paths.

- [ ] **Step 3: Run the test and confirm fail.**

```bash
npm run test:integration:local -- tests/integration/comparison-actions.test.ts
```
Expected: FAIL.

- [ ] **Step 4: Implement the action.**

```ts
// src/app/actions/comparison.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireParticipantAccess } from '@/lib/auth/authorization'

export type EligibleAssessment = {
  assessmentId: string
  assessmentName: string
  completedSessionCount: number
}

export async function getEligibleAssessmentsForParticipants(
  campaignParticipantIds: string[],
): Promise<EligibleAssessment[]> {
  if (campaignParticipantIds.length === 0) return []

  // Each requireParticipantAccess call hits the DB. For typical comparison sizes
  // (< 30 participants) this is fine. Throws AuthorizationError on the first
  // unauthorized id, which we let propagate.
  await Promise.all(campaignParticipantIds.map((id) => requireParticipantAccess(id)))

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('participant_sessions')
    .select('assessment_id, status, assessments(id, title)')
    .in('campaign_participant_id', campaignParticipantIds)
  if (error) throw error

  const counts = new Map<string, EligibleAssessment>()
  for (const row of (data ?? []) as Array<{
    assessment_id: string
    status: string
    assessments: { id: string; title: string } | null
  }>) {
    const a = row.assessments
    if (!a) continue
    const existing = counts.get(a.id) ?? {
      assessmentId: a.id,
      assessmentName: a.title,
      completedSessionCount: 0,
    }
    if (row.status === 'completed') existing.completedSessionCount += 1
    counts.set(a.id, existing)
  }
  return [...counts.values()].sort((a, b) => a.assessmentName.localeCompare(b.assessmentName))
}
```

The intent for every action in this file is: "throw `AuthorizationError` if the caller cannot see any of these ids." `requireParticipantAccess` and `requireSessionAccess` already do that — there's no need to re-implement scope filtering.

- [ ] **Step 5: Run the test and confirm pass.**

```bash
npm run test:integration:local -- tests/integration/comparison-actions.test.ts
```
Expected: 2 passed.

- [ ] **Step 6: Commit.**

```bash
git add src/app/actions/comparison.ts tests/integration/comparison-actions.test.ts
git commit -m "feat(comparison): getEligibleAssessmentsForParticipants action"
```

---

### Task 5: getSessionOptionsForRow

**Files**
- Modify: `src/app/actions/comparison.ts`
- Modify: `tests/integration/comparison-actions.test.ts`

- [ ] **Step 1: Append a failing test.**

```ts
// add to tests/integration/comparison-actions.test.ts
import { getSessionOptionsForRow } from '@/app/actions/comparison'

describe('getSessionOptionsForRow', () => {
  it('returns sessions for the given assessments with attempt numbers', async () => {
    const { campaignParticipantId, assessmentIds, sessionsByAssessment } = await seedMultipleAttempts()
    const options = await getSessionOptionsForRow(campaignParticipantId, assessmentIds)
    expect(options.length).toBe(Object.values(sessionsByAssessment).flat().length)
    for (const opt of options) {
      expect(opt.attemptNumber).toBeGreaterThanOrEqual(1)
      expect(typeof opt.startedAt).toBe('string')
    }
  })
})
```

- [ ] **Step 2: Run, confirm fail.**

```bash
npm run test:integration:local -- tests/integration/comparison-actions.test.ts
```

- [ ] **Step 3: Implement.**

```ts
// append to src/app/actions/comparison.ts

export type SessionOption = {
  sessionId: string
  assessmentId: string
  assessmentName: string
  attemptNumber: number
  startedAt: string
  status: string
}

export async function getSessionOptionsForRow(
  campaignParticipantId: string,
  assessmentIds: string[],
): Promise<SessionOption[]> {
  if (assessmentIds.length === 0) return []
  await requireParticipantAccess(campaignParticipantId)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('participant_sessions')
    .select('id, assessment_id, started_at, status, assessments(title)')
    .eq('campaign_participant_id', campaignParticipantId)
    .in('assessment_id', assessmentIds)
    .order('started_at', { ascending: true })
  if (error) throw error

  const perAssessmentCounter = new Map<string, number>()
  return ((data ?? []) as Array<{
    id: string
    assessment_id: string
    started_at: string | null
    status: string
    assessments: { title: string } | null
  }>).map((row) => {
    const next = (perAssessmentCounter.get(row.assessment_id) ?? 0) + 1
    perAssessmentCounter.set(row.assessment_id, next)
    return {
      sessionId: row.id,
      assessmentId: row.assessment_id,
      assessmentName: row.assessments?.title ?? '',
      attemptNumber: next,
      startedAt: row.started_at ?? '',
      status: row.status,
    }
  })
}
```

- [ ] **Step 4: Run, confirm pass.**

- [ ] **Step 5: Commit.**

```bash
git add src/app/actions/comparison.ts tests/integration/comparison-actions.test.ts
git commit -m "feat(comparison): getSessionOptionsForRow action"
```

---

### Task 6: getComparisonMatrix (the main action)

**Files**
- Modify: `src/app/actions/comparison.ts`
- Modify: `tests/integration/comparison-actions.test.ts`

- [ ] **Step 1: Append failing tests** for the four behaviours that matter most. You will be tempted to write more — resist; cover them in the component and unit tests.

```ts
// tests/integration/comparison-actions.test.ts (continued)
import { getComparisonMatrix } from '@/app/actions/comparison'

describe('getComparisonMatrix', () => {
  it('happy path: returns column groups + rows with cells per assessment', async () => {
    const { entries, assessmentIds } = await seedComparable()
    const result = await getComparisonMatrix({ entries, assessmentIds, granularity: 'factors_or_constructs' })
    expect(result.columns.length).toBe(assessmentIds.length)
    for (const g of result.columns) {
      expect(g.rollup.id).toBeTruthy()
      expect(g.children.length).toBeGreaterThan(0)
    }
    for (const row of result.rows) {
      for (const a of row.perAssessment) {
        expect(typeof a.attemptNumber === 'number' || a.attemptNumber === null).toBe(true)
      }
    }
  })

  it('returns dashed cells when no completed session exists for a chosen assessment', async () => {
    const { entries, assessmentIds, missingPair } = await seedWithMissingCompletion()
    const result = await getComparisonMatrix({ entries, assessmentIds, granularity: 'factors_or_constructs' })
    const row = result.rows.find((r) => r.campaignParticipantId === missingPair.cpId)!
    const a = row.perAssessment.find((x) => x.assessmentId === missingPair.assessmentId)!
    expect(a.sessionId).toBeNull()
    for (const v of Object.values(a.cells)) expect(v).toBeNull()
  })

  it('rejects unauthorized campaign_participant ids', async () => {
    await expect(
      getComparisonMatrix({
        entries: [{ campaignParticipantId: '00000000-0000-0000-0000-000000000000' }],
        assessmentIds: [],
        granularity: 'factors_or_constructs',
      }),
    ).rejects.toBeTruthy()
  })

  it('handles a mix of factor-level and construct-level assessments', async () => {
    const { entries, assessmentIds } = await seedMixedScoringLevels()
    const result = await getComparisonMatrix({ entries, assessmentIds, granularity: 'factors_or_constructs' })
    const factorAssessment = result.columns.find((g) => g.children.some((c) => c.level === 'factor'))
    const constructAssessment = result.columns.find((g) => g.children.some((c) => c.level === 'construct'))
    expect(factorAssessment).toBeTruthy()
    expect(constructAssessment).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: Implement the action.** This is the largest function in the plan. It does five things in order:

1. Authorize all `campaignParticipantId` values; authorize any explicit `sessionId`.
2. Resolve session-per-assessment per entry: if not provided, pick most-recent completed (deterministic tiebreaker by `completed_at desc, started_at desc, id desc`).
3. Fetch the assessment metadata + the column structure (factors vs. constructs based on `assessments.scoring_level` and the appropriate junction tables — `assessment_factors` or `assessment_constructs` — joined to `factors`/`constructs`/`dimensions`).
4. Fetch `participant_scores` for the resolved sessions; bucket per (entry, assessment).
5. Compute rollups via `rollupChildren` from `src/lib/comparison/rollup-scores.ts`.

```ts
// append to src/app/actions/comparison.ts
import { requireSessionAccess } from '@/lib/auth/authorization'
import { rollupChildren } from '@/lib/comparison/rollup-scores'
import type {
  ComparisonRequest,
  ComparisonResult,
  ColumnGroup,
  ComparisonRow,
  RowAssessment,
} from '@/lib/comparison/types'

export async function getComparisonMatrix(req: ComparisonRequest): Promise<ComparisonResult> {
  const cpIds = [...new Set(req.entries.map((e) => e.campaignParticipantId))]
  if (cpIds.length === 0) return { columns: [], rows: [] }
  // Authorize every participant id and every explicit session id; both helpers throw on unauthorized.
  await Promise.all(cpIds.map((id) => requireParticipantAccess(id)))
  const explicitSessionIds = req.entries.flatMap((e) => Object.values(e.sessionIdsByAssessment ?? {}))
  if (explicitSessionIds.length) {
    await Promise.all(explicitSessionIds.map((id) => requireSessionAccess(id)))
  }
  const supabase = await createClient()

  // 1) Identity rows
  const { data: cpRows, error: cpErr } = await supabase
    .from('campaign_participants')
    .select('id, email, first_name, last_name')
    .in('id', cpIds)
  if (cpErr) throw cpErr
  const cpById = new Map(
    (cpRows ?? []).map((r) => [
      r.id,
      {
        name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.email,
        email: r.email as string,
      },
    ]),
  )

  // 2) Pull all sessions for these participants restricted to chosen assessments.
  const { data: sessionRows, error: sErr } = await supabase
    .from('participant_sessions')
    .select('id, campaign_participant_id, assessment_id, status, started_at, completed_at')
    .in('campaign_participant_id', cpIds)
    .in('assessment_id', req.assessmentIds)
    .order('completed_at', { ascending: false, nullsFirst: false })
  if (sErr) throw sErr

  // Determine attempt ordinals per (cp, assessment) by started_at asc.
  const attemptByPair = new Map<string, number>() // key = `${cpId}:${assId}:${sessionId}`
  const orderedAsc = [...(sessionRows ?? [])].sort((a, b) =>
    (a.started_at ?? '').localeCompare(b.started_at ?? ''),
  )
  const counter = new Map<string, number>()
  for (const r of orderedAsc) {
    const k = `${r.campaign_participant_id}:${r.assessment_id}`
    const next = (counter.get(k) ?? 0) + 1
    counter.set(k, next)
    attemptByPair.set(`${k}:${r.id}`, next)
  }

  // 3) For each entry/assessment, resolve a sessionId.
  type Resolved = { entryIndex: number; cpId: string; assessmentId: string; sessionId: string | null }
  const resolutions: Resolved[] = []
  req.entries.forEach((entry, idx) => {
    for (const aId of req.assessmentIds) {
      const explicit = entry.sessionIdsByAssessment?.[aId]
      if (explicit) {
        resolutions.push({ entryIndex: idx, cpId: entry.campaignParticipantId, assessmentId: aId, sessionId: explicit })
        continue
      }
      const candidates = (sessionRows ?? []).filter(
        (s) =>
          s.campaign_participant_id === entry.campaignParticipantId &&
          s.assessment_id === aId &&
          s.status === 'completed',
      )
      candidates.sort((a, b) => {
        const c = (b.completed_at ?? '').localeCompare(a.completed_at ?? '')
        if (c !== 0) return c
        const s = (b.started_at ?? '').localeCompare(a.started_at ?? '')
        if (s !== 0) return s
        return b.id.localeCompare(a.id)
      })
      resolutions.push({
        entryIndex: idx,
        cpId: entry.campaignParticipantId,
        assessmentId: aId,
        sessionId: candidates[0]?.id ?? null,
      })
    }
  })

  // 4) Build column groups per assessment using scoring_level.
  const columns = await buildColumnGroups(supabase, req.assessmentIds, req.granularity)

  // 5) Fetch scores for all resolved sessions.
  const sessionIds = resolutions.map((r) => r.sessionId).filter((s): s is string => !!s)
  const { data: scoreRows, error: scErr } = await supabase
    .from('participant_scores')
    .select('participant_session_id, factor_id, construct_id, scaled_score')
    .in('participant_session_id', sessionIds)
  if (scErr) throw scErr

  const scoresBySession = new Map<string, Map<string, number>>()
  for (const r of (scoreRows ?? []) as Array<{
    participant_session_id: string
    factor_id: string | null
    construct_id: string | null
    scaled_score: number | string | null
  }>) {
    const key = r.factor_id ?? r.construct_id
    if (!key || r.scaled_score === null) continue
    const value = typeof r.scaled_score === 'number' ? r.scaled_score : Number(r.scaled_score)
    if (!Number.isFinite(value)) continue
    const m = scoresBySession.get(r.participant_session_id) ?? new Map<string, number>()
    m.set(key, Math.round(value))
    scoresBySession.set(r.participant_session_id, m)
  }

  // 6) Assemble rows.
  const rows: ComparisonRow[] = req.entries.map((entry, idx) => {
    const id = entry.campaignParticipantId
    const cp = cpById.get(id)
    const perAssessment: RowAssessment[] = req.assessmentIds.map((aId) => {
      const res = resolutions.find((r) => r.entryIndex === idx && r.assessmentId === aId)!
      const session = (sessionRows ?? []).find((s) => s.id === res.sessionId) ?? null
      const sScores = res.sessionId ? scoresBySession.get(res.sessionId) ?? new Map<string, number>() : new Map<string, number>()

      const group = columns.find((g) => g.assessmentId === aId)!
      const cells: Record<string, number | null> = {}
      for (const child of group.children) {
        cells[child.id] = sScores.get(child.id) ?? null
      }
      // Compute rollup using equal weight 1.0 by default if explicit weights aren't loaded
      // — children carry their dimension parent. The exact weight loading lives in buildColumnGroups.
      cells[group.rollup.id] = rollupChildren(
        group.children.map((c) => ({ childId: c.id, score: cells[c.id], weight: 1 })),
      )

      return {
        assessmentId: aId,
        sessionId: res.sessionId,
        sessionStartedAt: session?.started_at ?? null,
        sessionStatus: session?.status ?? null,
        attemptNumber: res.sessionId
          ? attemptByPair.get(`${id}:${aId}:${res.sessionId}`) ?? null
          : null,
        cells,
      }
    })

    return {
      entryId: `${id}:${idx}`,
      campaignParticipantId: id,
      participantName: cp?.name ?? '',
      participantEmail: cp?.email ?? '',
      perAssessment,
    }
  })

  return { columns, rows }
}

// --- helpers ---

async function buildColumnGroups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assessmentIds: string[],
  granularity: ComparisonRequest['granularity'],
): Promise<ColumnGroup[]> {
  if (assessmentIds.length === 0) return []
  // Fetch scoring_level + assessment titles
  const { data: aRows, error: aErr } = await supabase
    .from('assessments')
    .select('id, title, scoring_level')
    .in('id', assessmentIds)
  if (aErr) throw aErr

  const groups: ColumnGroup[] = []
  for (const a of (aRows ?? []) as Array<{ id: string; title: string; scoring_level: 'factor' | 'construct' }>) {
    if (a.scoring_level === 'factor') {
      groups.push(await factorLevelGroup(supabase, a.id, a.title, granularity))
    } else {
      groups.push(await constructLevelGroup(supabase, a.id, a.title, granularity))
    }
  }
  return groups
}

async function factorLevelGroup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assessmentId: string,
  assessmentName: string,
  granularity: ComparisonRequest['granularity'],
): Promise<ColumnGroup> {
  // Implementer note: load assessment_factors → factors → factors.dimension_id → dimensions.
  // Build columns: rollup = the dimension row, children = factors under it.
  // For v1 keep this simple: one rollup per assessment (the highest-level grouping shown).
  // Confirm column names against the live schema before writing the SQL — see "Schema check" below.
  // Acceptance:
  //   - rollup.level === 'dimension' (when assessment has dimensions)
  //   - children carry parentId = the rollup id
  //   - all ids exist in the underlying tables
  throw new Error('TODO: implement factorLevelGroup using assessment_factors + factors + dimensions')
}

async function constructLevelGroup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assessmentId: string,
  assessmentName: string,
  granularity: ComparisonRequest['granularity'],
): Promise<ColumnGroup> {
  // Implementer note: load assessment_constructs → constructs → dimensions via the
  // dimension_id on assessment_constructs.
  // Same acceptance shape as factorLevelGroup.
  throw new Error('TODO: implement constructLevelGroup using assessment_constructs + constructs + dimensions')
}
```

The two `TODO` helpers are intentional gaps for the implementer. They depend on schema details (column names on `assessment_factors`, weight columns on the junction tables) that should be verified against the live schema first. Use the local psql command per `AGENTS.md` ("When in doubt, query the live schema") to inspect:

```
\d assessment_factors
\d assessment_constructs
\d factor_constructs
\d dimension_constructs
```

Implement both helpers using the columns the live schema actually has. The plan deliberately avoids prescribing column names that might be stale.

- [ ] **Step 4: Run, confirm pass.**

```bash
npm run test:integration:local -- tests/integration/comparison-actions.test.ts
```

- [ ] **Step 5: Run typecheck and lint.**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 6: Commit.**

```bash
git add src/app/actions/comparison.ts tests/integration/comparison-actions.test.ts
git commit -m "feat(comparison): getComparisonMatrix action"
```

---

## Phase 3 — CSV export route

### Task 7: POST /api/comparison/export

**Files**
- Create: `src/app/api/comparison/export/route.ts`
- Test: `tests/integration/comparison-export.test.ts`

- [ ] **Step 1: Write a failing test that calls the route handler.**

```ts
// tests/integration/comparison-export.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { POST } from '@/app/api/comparison/export/route'
import { signInAsAdmin, seedComparable } from '@tests/integration/helpers'

describe('POST /api/comparison/export', () => {
  beforeAll(async () => { await signInAsAdmin() })

  it('returns text/csv with attachment headers and a header row', async () => {
    const { entries, assessmentIds, campaignSlug } = await seedComparable()
    const req = new Request('http://localhost/api/comparison/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, assessmentIds, granularity: 'factors_or_constructs', campaignSlug }),
    })
    const res = await POST(req)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain(`trajectas-comparison-${campaignSlug}-`)
    const body = await res.text()
    expect(body.split('\n')[0].startsWith('Participant,Email,Date,Attempt #,Assessment,Session Status,')).toBe(true)
  })
})
```

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: Implement.**

```ts
// src/app/api/comparison/export/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getComparisonMatrix } from '@/app/actions/comparison'
import { buildComparisonCsv } from '@/lib/comparison/build-csv'

const Body = z.object({
  entries: z.array(z.object({
    campaignParticipantId: z.string().uuid(),
    sessionIdsByAssessment: z.record(z.string().uuid(), z.string().uuid()).optional(),
  })),
  assessmentIds: z.array(z.string().uuid()),
  granularity: z.enum(['dimensions', 'factors_or_constructs']),
  campaignSlug: z.string().min(1).optional(),
})

function todayUtcYyyymmdd(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export async function POST(req: Request): Promise<Response> {
  const json = await req.json()
  const parsed = Body.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })

  const result = await getComparisonMatrix({
    entries: parsed.data.entries,
    assessmentIds: parsed.data.assessmentIds,
    granularity: parsed.data.granularity,
  })
  const csv = buildComparisonCsv(result)
  const filename = parsed.data.campaignSlug
    ? `trajectas-comparison-${parsed.data.campaignSlug}-${todayUtcYyyymmdd()}.csv`
    : `trajectas-comparison-participants-${todayUtcYyyymmdd()}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

- [ ] **Step 4: Run, confirm pass. Run typecheck.**

- [ ] **Step 5: Commit.**

```bash
git add src/app/api/comparison/export/route.ts tests/integration/comparison-export.test.ts
git commit -m "feat(comparison): CSV export route handler"
```

---

## Phase 4 — UI components (bottom up)

### Task 8: comparison-cell

**Files**
- Create: `src/components/comparison/comparison-cell.tsx`

This is the simplest component: receives a number-or-null and a style resolver; renders.

- [ ] **Step 1: Implement (no test — covered in matrix component test).**

```tsx
// src/components/comparison/comparison-cell.tsx
import { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export function ComparisonCell({
  value,
  style,
  isRollup = false,
}: {
  value: number | null
  style: CSSProperties
  isRollup?: boolean
}) {
  return (
    <td
      className={cn(
        'text-center font-semibold text-[11px] min-w-[36px] max-w-[36px] px-2 py-1.5 border-b border-r border-border last:border-r-0',
        isRollup && 'font-extrabold border-l-2 border-l-border/40',
      )}
      style={style}
    >
      {value === null ? <span className="opacity-60">—</span> : value}
    </td>
  )
}
```

- [ ] **Step 2: Commit.**

```bash
git add src/components/comparison/comparison-cell.tsx
git commit -m "feat(comparison): comparison-cell component"
```

---

### Task 9: comparison-matrix

**Files**
- Create: `src/components/comparison/comparison-matrix.tsx`
- Test: `tests/components/comparison-matrix.test.tsx`

- [ ] **Step 1: Write the failing component test.** Cover: header structure, dashed cell when null, sort by clicking header, in-progress annotation.

```tsx
// tests/components/comparison-matrix.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComparisonMatrix } from '@/components/comparison/comparison-matrix'
import type { ComparisonResult } from '@/lib/comparison/types'

const data: ComparisonResult = {
  columns: [{
    assessmentId: 'a1',
    assessmentName: 'Leadership',
    rollup: { id: 'd1', name: 'Influence', level: 'dimension', parentId: null },
    children: [
      { id: 'f1', name: 'Persuasion', level: 'factor', parentId: 'd1' },
      { id: 'f2', name: 'Empathy', level: 'factor', parentId: 'd1' },
    ],
  }],
  rows: [
    { entryId: 'e1', campaignParticipantId: 'cp1', participantName: 'Sarah', participantEmail: 's@x', perAssessment: [
      { assessmentId: 'a1', sessionId: 's1', sessionStartedAt: '2026-04-02T10:00Z', sessionStatus: 'completed', attemptNumber: 2, cells: { d1: 75, f1: 72, f2: 78 } },
    ]},
    { entryId: 'e2', campaignParticipantId: 'cp2', participantName: 'Marcus', participantEmail: 'm@x', perAssessment: [
      { assessmentId: 'a1', sessionId: null, sessionStartedAt: null, sessionStatus: null, attemptNumber: null, cells: { d1: null, f1: null, f2: null } },
    ]},
  ],
}

describe('ComparisonMatrix', () => {
  it('renders group + child headers and row cells', () => {
    render(<ComparisonMatrix data={data} getCellStyle={() => ({})} onChangeRowSession={() => {}} />)
    expect(screen.getByText('LEADERSHIP')).toBeInTheDocument()
    expect(screen.getByText('Persuasion')).toBeInTheDocument()
    expect(screen.getByText('72')).toBeInTheDocument()
    // dashed row
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('sorts by clicking a child column header', () => {
    render(<ComparisonMatrix data={data} getCellStyle={() => ({})} onChangeRowSession={() => {}} />)
    const header = screen.getByRole('button', { name: /persuasion/i })
    fireEvent.click(header)
    const names = screen.getAllByTestId('row-name').map((n) => n.textContent)
    expect(names[0]).toContain('Sarah')
  })
})
```

- [ ] **Step 2: Run, confirm fail.** `npm run test:component -- tests/components/comparison-matrix.test.tsx`

- [ ] **Step 3: Implement** the matrix component. Keep the table semantic; rotated headers via inline transform.

```tsx
// src/components/comparison/comparison-matrix.tsx
'use client'
import { CSSProperties, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ComparisonResult, ComparisonRow } from '@/lib/comparison/types'
import { ComparisonCell } from './comparison-cell'

type SortKey = { columnId: string; dir: 'asc' | 'desc' } | null

export function ComparisonMatrix({
  data,
  getCellStyle,
  onChangeRowSession,
}: {
  data: ComparisonResult
  getCellStyle: (score: number | null) => CSSProperties
  onChangeRowSession: (entryId: string, assessmentId: string) => void
}) {
  const [sort, setSort] = useState<SortKey>(null)

  const sortedRows = useMemo(() => {
    if (!sort) return data.rows
    const dirMul = sort.dir === 'asc' ? 1 : -1
    const groupId = data.columns.find((g) =>
      g.rollup.id === sort.columnId || g.children.some((c) => c.id === sort.columnId),
    )?.assessmentId
    return [...data.rows].sort((a, b) => {
      const ra = a.perAssessment.find((x) => x.assessmentId === groupId)
      const rb = b.perAssessment.find((x) => x.assessmentId === groupId)
      const va = ra?.cells[sort.columnId] ?? null
      const vb = rb?.cells[sort.columnId] ?? null
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return (va - vb) * dirMul
    })
  }, [data, sort])

  const onClickHeader = (columnId: string) => {
    setSort((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, dir: 'desc' }
      if (prev.dir === 'desc') return { columnId, dir: 'asc' }
      return null
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="text-[11px] border-separate border-spacing-0 w-full">
        <thead>
          <tr>
            <th rowSpan={2} className="px-3 py-2 font-semibold text-xs text-left bg-surface-elevated border-b border-r border-border">Participant</th>
            <th rowSpan={2} className="px-3 py-2 font-semibold text-xs text-left bg-surface-elevated border-b border-r border-border">Date</th>
            <th rowSpan={2} className="px-3 py-2 font-semibold text-xs text-center bg-surface-elevated border-b border-r border-border">#</th>
            {data.columns.map((g) => (
              <th
                key={g.assessmentId}
                colSpan={1 + g.children.length}
                className="px-2 py-1 text-[9px] tracking-widest text-center uppercase bg-black/5 border-b border-r border-border"
              >
                {g.assessmentName}
              </th>
            ))}
          </tr>
          <tr>
            {data.columns.flatMap((g) => [
              <th
                key={g.rollup.id}
                className={cn(
                  'h-28 align-bottom border-b border-r border-border bg-surface-elevated',
                  'min-w-[36px] max-w-[36px] p-0',
                )}
              >
                <button
                  type="button"
                  onClick={() => onClickHeader(g.rollup.id)}
                  className="origin-bottom-left -rotate-[55deg] translate-x-2 whitespace-nowrap pb-1.5 pl-1.5 text-[10px] font-bold uppercase tracking-wider"
                >
                  {g.rollup.name}
                </button>
              </th>,
              ...g.children.map((c) => (
                <th
                  key={c.id}
                  className="h-28 align-bottom border-b border-r border-border bg-surface-elevated min-w-[36px] max-w-[36px] p-0"
                >
                  <button
                    type="button"
                    onClick={() => onClickHeader(c.id)}
                    className="origin-bottom-left -rotate-[55deg] translate-x-2 whitespace-nowrap pb-1.5 pl-1.5 text-[10px] font-medium"
                  >
                    {c.name}
                  </button>
                </th>
              )),
            ])}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <Row key={row.entryId} row={row} columns={data.columns} getCellStyle={getCellStyle} onChangeRowSession={onChangeRowSession} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Row({
  row,
  columns,
  getCellStyle,
  onChangeRowSession,
}: {
  row: ComparisonRow
  columns: ComparisonResult['columns']
  getCellStyle: (score: number | null) => CSSProperties
  onChangeRowSession: (entryId: string, assessmentId: string) => void
}) {
  const repr = [...row.perAssessment].sort((a, b) =>
    (b.sessionStartedAt ?? '').localeCompare(a.sessionStartedAt ?? ''),
  )[0]
  const isInProgress = repr?.sessionStatus && repr.sessionStatus !== 'completed'

  return (
    <tr>
      <td data-testid="row-name" className="font-semibold text-xs px-2.5 py-1.5 border-b border-r border-border min-w-[140px]">{row.participantName}</td>
      <td className="text-[11px] opacity-75 px-2 py-1.5 border-b border-r border-border min-w-[80px]">
        {repr?.sessionStartedAt ? new Date(repr.sessionStartedAt).toLocaleDateString() : '—'}
        {isInProgress && <span className="ml-1 text-[9px] uppercase tracking-wider opacity-70">in progress</span>}
      </td>
      <td className="text-[10px] opacity-60 px-2 py-1.5 border-b border-r border-border text-center min-w-[30px]">
        {repr?.attemptNumber ?? '—'}
      </td>
      {columns.flatMap((g) => {
        const a = row.perAssessment.find((x) => x.assessmentId === g.assessmentId)!
        const cells = [
          <ComparisonCell key={g.rollup.id} value={a.cells[g.rollup.id] ?? null} style={getCellStyle(a.cells[g.rollup.id] ?? null)} isRollup />,
          ...g.children.map((c) => (
            <ComparisonCell key={c.id} value={a.cells[c.id] ?? null} style={getCellStyle(a.cells[c.id] ?? null)} />
          )),
        ]
        return cells
      })}
    </tr>
  )
}
```

- [ ] **Step 4: Run, confirm pass.** Adjust selectors as needed.

- [ ] **Step 5: Commit.**

```bash
git add src/components/comparison/comparison-matrix.tsx tests/components/comparison-matrix.test.tsx
git commit -m "feat(comparison): comparison-matrix component"
```

---

### Task 10: comparison-row-session-popover

**Files**
- Create: `src/components/comparison/comparison-row-session-popover.tsx`

A small popover anchored to the date cell. It calls `getSessionOptionsForRow` on open and emits `(assessmentId, sessionId)` on selection.

- [ ] **Step 1: Implement.** Use the existing project popover primitive (search `src/components/ui/` for a `Popover` or equivalent). If none exists, use `@base-ui/react`'s popover (already in deps).

```tsx
// src/components/comparison/comparison-row-session-popover.tsx
'use client'
import { useEffect, useState } from 'react'
import { getSessionOptionsForRow, type SessionOption } from '@/app/actions/comparison'

export function ComparisonRowSessionPopover({
  campaignParticipantId,
  assessmentIds,
  open,
  onClose,
  onPick,
}: {
  campaignParticipantId: string
  assessmentIds: string[]
  open: boolean
  onClose: () => void
  onPick: (assessmentId: string, sessionId: string) => void
}) {
  const [options, setOptions] = useState<SessionOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    getSessionOptionsForRow(campaignParticipantId, assessmentIds)
      .then((opts) => { if (!cancelled) setOptions(opts) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, campaignParticipantId, assessmentIds])

  if (!open) return null
  return (
    <div role="dialog" className="absolute z-20 mt-1 w-72 rounded-md border border-border bg-card p-2 shadow-lg">
      {loading && <div className="text-xs opacity-70 p-2">Loading sessions…</div>}
      {!loading && options.length === 0 && <div className="text-xs opacity-70 p-2">No sessions found.</div>}
      <ul className="max-h-72 overflow-auto text-xs">
        {options.map((o) => (
          <li key={o.sessionId}>
            <button
              type="button"
              className="w-full text-left rounded px-2 py-1.5 hover:bg-muted"
              onClick={() => { onPick(o.assessmentId, o.sessionId); onClose() }}
            >
              <div className="font-medium">{o.assessmentName} · attempt {o.attemptNumber}</div>
              <div className="opacity-70">{new Date(o.startedAt).toLocaleDateString()} · {o.status}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Commit.** No test for this in v1 — the workspace test exercises it indirectly.

```bash
git add src/components/comparison/comparison-row-session-popover.tsx
git commit -m "feat(comparison): row session popover"
```

---

### Task 11: add-participant-dialog

**Files**
- Create: `src/components/comparison/add-participant-dialog.tsx`

The picker source differs by entry context: for the campaign view it's the campaign's participants list; for the global view it's a cross-campaign search. The dialog accepts a `searchSource` prop that returns `Promise<{ id, name, email }[]>` so the same dialog handles both.

- [ ] **Step 1: Implement.**

```tsx
// src/components/comparison/add-participant-dialog.tsx
'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export type AddPickerOption = { id: string; name: string; email: string }
export type AddPickerSource = (query: string) => Promise<AddPickerOption[]>

export function AddParticipantDialog({
  open,
  onClose,
  onAdd,
  searchSource,
}: {
  open: boolean
  onClose: () => void
  onAdd: (option: AddPickerOption) => void
  searchSource: AddPickerSource
}) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<AddPickerOption[]>([])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const id = setTimeout(async () => {
      const opts = await searchSource(query)
      if (!cancelled) setOptions(opts)
    }, 150)
    return () => { cancelled = true; clearTimeout(id) }
  }, [open, query, searchSource])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 p-12">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Add participant</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background"
        />
        <ul className="mt-3 max-h-80 overflow-auto text-sm">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="w-full text-left rounded px-3 py-2 hover:bg-muted"
                onClick={() => { onAdd(o); onClose() }}
              >
                <div className="font-medium">{o.name}</div>
                <div className="opacity-70 text-xs">{o.email}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit.**

```bash
git add src/components/comparison/add-participant-dialog.tsx
git commit -m "feat(comparison): add-participant-dialog"
```

---

### Task 12: comparison-export-button

**Files**
- Create: `src/components/comparison/comparison-export-button.tsx`

- [ ] **Step 1: Implement.** POSTs to the route, downloads via Blob.

```tsx
// src/components/comparison/comparison-export-button.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { ComparisonRequest } from '@/lib/comparison/types'

export function ComparisonExportButton({
  request,
  campaignSlug,
  disabled,
}: {
  request: ComparisonRequest
  campaignSlug?: string
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)

  async function onClick() {
    setBusy(true)
    try {
      const res = await fetch('/api/comparison/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, campaignSlug }),
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') ?? ''
      const match = /filename="([^"]+)"/.exec(cd)
      const filename = match?.[1] ?? 'trajectas-comparison.csv'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error('Export failed', { description: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button onClick={onClick} disabled={disabled || busy}>
      {busy ? 'Exporting…' : 'Export CSV'}
    </Button>
  )
}
```

- [ ] **Step 2: Commit.**

```bash
git add src/components/comparison/comparison-export-button.tsx
git commit -m "feat(comparison): export button"
```

---

### Task 13: comparison-selection-bar

**Files**
- Create: `src/components/comparison/comparison-selection-bar.tsx`

This is the sticky top bar that orchestrates: participants chips, assessment multi-select, granularity toggle, and the export button.

- [ ] **Step 1: Implement.**

```tsx
// src/components/comparison/comparison-selection-bar.tsx
'use client'
import { Button } from '@/components/ui/button'
import { ComparisonExportButton } from './comparison-export-button'
import type { ComparisonRequest, ComparisonRow, Granularity } from '@/lib/comparison/types'
import type { EligibleAssessment } from '@/app/actions/comparison'

export function ComparisonSelectionBar({
  rows,
  request,
  campaignSlug,
  eligibleAssessments,
  onRemoveEntry,
  onAddEntryClick,
  onToggleAssessment,
  onChangeGranularity,
}: {
  rows: ComparisonRow[]
  request: ComparisonRequest
  campaignSlug?: string
  eligibleAssessments: EligibleAssessment[]
  onRemoveEntry: (entryId: string) => void
  onAddEntryClick: () => void
  onToggleAssessment: (assessmentId: string) => void
  onChangeGranularity: (g: Granularity) => void
}) {
  const isEmpty = request.entries.length === 0
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background/90 backdrop-blur px-4 py-3">
      <div className="flex flex-wrap gap-1.5 items-center min-w-0">
        {rows.map((r) => (
          <span key={r.entryId} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-xs">
            <span className="font-medium">{r.participantName}</span>
            <button type="button" className="opacity-60 hover:opacity-100" onClick={() => onRemoveEntry(r.entryId)} aria-label="Remove">×</button>
          </span>
        ))}
        <Button variant="outline" size="sm" onClick={onAddEntryClick}>+ Add participant</Button>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {eligibleAssessments.map((a) => {
          const active = request.assessmentIds.includes(a.assessmentId)
          return (
            <button
              key={a.assessmentId}
              type="button"
              onClick={() => onToggleAssessment(a.assessmentId)}
              className={`text-xs rounded-full border px-2.5 py-1 ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-surface-elevated'}`}
            >
              {a.assessmentName}
              <span className="ml-1 opacity-70">({a.completedSessionCount})</span>
            </button>
          )
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
          <button type="button" className={`px-2 py-1 ${request.granularity === 'dimensions' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => onChangeGranularity('dimensions')}>Dimensions</button>
          <button type="button" className={`px-2 py-1 ${request.granularity === 'factors_or_constructs' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => onChangeGranularity('factors_or_constructs')}>Factors / Constructs</button>
        </div>
        <ComparisonExportButton request={request} campaignSlug={campaignSlug} disabled={isEmpty} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit.**

```bash
git add src/components/comparison/comparison-selection-bar.tsx
git commit -m "feat(comparison): selection bar"
```

---

### Task 14: comparison-workspace orchestrator

**Files**
- Create: `src/components/comparison/comparison-workspace.tsx`

Owns state, syncs URL, and dispatches the three child components. Uses `useTransition` to fetch fresh matrix data when selection changes.

- [ ] **Step 1: Implement.**

```tsx
// src/components/comparison/comparison-workspace.tsx
'use client'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ComparisonSelectionBar } from './comparison-selection-bar'
import { ComparisonMatrix } from './comparison-matrix'
import { AddParticipantDialog, type AddPickerSource } from './add-participant-dialog'
import { ComparisonRowSessionPopover } from './comparison-row-session-popover'
import { buildCellStyleResolver } from '@/lib/comparison/resolve-bands'
import { getComparisonMatrix, getEligibleAssessmentsForParticipants, type EligibleAssessment } from '@/app/actions/comparison'
import type { BandScheme } from '@/lib/reports/band-scheme'
import type { ComparisonRequest, ComparisonResult, EntryRequest, Granularity } from '@/lib/comparison/types'

type Props = {
  initial: { request: ComparisonRequest; result: ComparisonResult; eligible: EligibleAssessment[] }
  campaignSlug?: string
  partnerBandScheme: BandScheme | null
  platformBandScheme: BandScheme | null
  searchSource: AddPickerSource
}

function encodeEntries(entries: EntryRequest[]): string {
  return Buffer.from(JSON.stringify(entries), 'utf8').toString('base64url')
}
function decodeEntries(s: string): EntryRequest[] {
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) } catch { return [] }
}

export function ComparisonWorkspace({ initial, campaignSlug, partnerBandScheme, platformBandScheme, searchSource }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const [request, setRequest] = useState<ComparisonRequest>(initial.request)
  const [result, setResult] = useState<ComparisonResult>(initial.result)
  const [eligible, setEligible] = useState<EligibleAssessment[]>(initial.eligible)
  const [showAdd, setShowAdd] = useState(false)
  const [popover, setPopover] = useState<{ entryId: string; cpId: string } | null>(null)

  const getCellStyle = useMemo(
    () => buildCellStyleResolver({ partner: { bandScheme: partnerBandScheme }, platform: { bandScheme: platformBandScheme } }),
    [partnerBandScheme, platformBandScheme],
  )

  useEffect(() => {
    const next = new URLSearchParams(params)
    next.set('entries', encodeEntries(request.entries))
    next.set('assessments', request.assessmentIds.join(','))
    next.set('granularity', request.granularity)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [request, pathname, router, params])

  function refetch(nextRequest: ComparisonRequest) {
    startTransition(async () => {
      const [r, e] = await Promise.all([
        getComparisonMatrix(nextRequest),
        getEligibleAssessmentsForParticipants(nextRequest.entries.map((x) => x.campaignParticipantId)),
      ])
      setResult(r); setEligible(e)
    })
  }

  function update(req: ComparisonRequest) {
    setRequest(req); refetch(req)
  }

  function addEntry(cpId: string) {
    update({ ...request, entries: [...request.entries, { campaignParticipantId: cpId }] })
  }

  function removeEntry(entryId: string) {
    const idx = request.entries.findIndex((_, i) => result.rows[i]?.entryId === entryId)
    if (idx < 0) return
    update({ ...request, entries: request.entries.filter((_, i) => i !== idx) })
  }

  function toggleAssessment(aId: string) {
    const next = request.assessmentIds.includes(aId)
      ? request.assessmentIds.filter((x) => x !== aId)
      : [...request.assessmentIds, aId]
    update({ ...request, assessmentIds: next })
  }

  function changeGranularity(g: Granularity) {
    update({ ...request, granularity: g })
  }

  function changeRowSession(entryId: string, assessmentId: string, sessionId: string) {
    const idx = result.rows.findIndex((r) => r.entryId === entryId)
    if (idx < 0) return
    const newEntries = request.entries.map((e, i) => {
      if (i !== idx) return e
      return { ...e, sessionIdsByAssessment: { ...(e.sessionIdsByAssessment ?? {}), [assessmentId]: sessionId } }
    })
    update({ ...request, entries: newEntries })
  }

  return (
    <div className="space-y-4">
      <ComparisonSelectionBar
        rows={result.rows}
        request={request}
        campaignSlug={campaignSlug}
        eligibleAssessments={eligible}
        onRemoveEntry={removeEntry}
        onAddEntryClick={() => setShowAdd(true)}
        onToggleAssessment={toggleAssessment}
        onChangeGranularity={changeGranularity}
      />
      {pending && <div className="text-xs opacity-60 px-4">Updating…</div>}
      <div className="px-4">
        {result.rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm opacity-70">
            No participants selected — add one to start.
          </div>
        ) : (
          <ComparisonMatrix
            data={result}
            getCellStyle={getCellStyle}
            onChangeRowSession={(entryId) => {
              const row = result.rows.find((r) => r.entryId === entryId)
              if (!row) return
              setPopover({ entryId, cpId: row.campaignParticipantId })
            }}
          />
        )}
      </div>

      <AddParticipantDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={(o) => addEntry(o.id)}
        searchSource={searchSource}
      />

      {popover && (
        <ComparisonRowSessionPopover
          campaignParticipantId={popover.cpId}
          assessmentIds={request.assessmentIds}
          open={true}
          onClose={() => setPopover(null)}
          onPick={(aId, sId) => { changeRowSession(popover.entryId, aId, sId); setPopover(null) }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck.**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit.**

```bash
git add src/components/comparison/comparison-workspace.tsx
git commit -m "feat(comparison): workspace orchestrator"
```

---

## Phase 5 — Routes & wiring

### Task 15: Admin routes (campaign + global) and bulk actions

**Files**
- Create: `src/app/(dashboard)/campaigns/[id]/compare/page.tsx`
- Create: `src/app/(dashboard)/campaigns/[id]/compare/loading.tsx`
- Create: `src/app/(dashboard)/participants/compare/page.tsx`
- Create: `src/app/(dashboard)/participants/compare/loading.tsx`
- Modify: `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx`
- Modify: `src/app/(dashboard)/participants/participants-table.tsx`

- [ ] **Step 1: Add a server action that powers the picker.** Next 16 only allows passing server functions to client components if they're server actions in their own right. Add `searchCampaignParticipants(campaignId, query)` and `searchAllParticipants(query)` to `src/app/actions/comparison.ts` and import them from the route pages. Each returns `{ id, name, email }[]`.

- [ ] **Step 2: Build the campaign-scoped page.** Server component that authorizes, loads initial data, renders the workspace.

```tsx
// src/app/(dashboard)/campaigns/[id]/compare/page.tsx
import { redirect } from 'next/navigation'
import { ComparisonWorkspace } from '@/components/comparison/comparison-workspace'
import { getComparisonMatrix, getEligibleAssessmentsForParticipants, searchCampaignParticipants } from '@/app/actions/comparison'
import { getCampaignById } from '@/app/actions/campaigns'
import { getPlatformBandScheme } from '@/app/actions/platform-settings'
import type { ComparisonRequest, EntryRequest, Granularity } from '@/lib/comparison/types'

function decodeEntries(s: string | null): EntryRequest[] {
  if (!s) return []
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) } catch { return [] }
}

export default async function CompareCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ entries?: string; assessments?: string; granularity?: Granularity; ids?: string }>
}) {
  const { id: campaignId } = await params
  const sp = await searchParams
  const campaign = await getCampaignById(campaignId)
  if (!campaign) redirect('/campaigns')

  const initialEntryIds = sp.ids ? sp.ids.split(',') : []
  const decoded = decodeEntries(sp.entries ?? null)
  const entries: EntryRequest[] = decoded.length ? decoded : initialEntryIds.map((id) => ({ campaignParticipantId: id }))
  const assessmentIds = sp.assessments ? sp.assessments.split(',').filter(Boolean) : []
  const granularity: Granularity = sp.granularity === 'dimensions' ? 'dimensions' : 'factors_or_constructs'

  const request: ComparisonRequest = { entries, assessmentIds, granularity }
  const eligible = await getEligibleAssessmentsForParticipants(entries.map((e) => e.campaignParticipantId))

  // Default the assessment selection to the first 5 eligible assessments on first load.
  const effectiveRequest: ComparisonRequest =
    assessmentIds.length === 0
      ? { ...request, assessmentIds: eligible.map((a) => a.assessmentId).slice(0, 5) }
      : request

  const result = await getComparisonMatrix(effectiveRequest)
  const platformBandScheme = await getPlatformBandScheme()
  // Admin: no partner context; partnerBandScheme stays null.

  const searchSource = (query: string) => searchCampaignParticipants(campaignId, query)

  return (
    <div className="space-y-4 max-w-7xl">
      <header className="px-4 pt-4">
        <h1 className="text-xl font-semibold">Compare — {campaign.title}</h1>
      </header>
      <ComparisonWorkspace
        initial={{ request: effectiveRequest, result, eligible }}
        campaignSlug={campaign.slug}
        partnerBandScheme={null}
        platformBandScheme={platformBandScheme}
        searchSource={searchSource}
      />
    </div>
  )
}
```

- [ ] **Step 3: Build a `loading.tsx`** with shimmer skeleton matching the workspace shape (sticky bar + matrix placeholder). Pattern after an existing `loading.tsx` in the project.

- [ ] **Step 4: Build the global `/participants/compare` page.** Same structure as the campaign-scoped one but `searchSource` is `searchAllParticipants(query)`.

- [ ] **Step 5: Modify `campaign-participant-manager.tsx`** to add a "Compare selected" bulk action.

```tsx
// inside campaign-participant-manager.tsx, in the bulkActions array
import { GitCompare } from 'lucide-react'
// ...
const bulkActions: BulkAction<CampaignParticipant>[] = [
  ...existingActions,
  {
    label: 'Compare selected',
    icon: <GitCompare className="size-4" />,
    action: (ids) => {
      const qs = new URLSearchParams({ ids: ids.join(',') })
      router.push(`/campaigns/${campaignId}/compare?${qs.toString()}`)
    },
  },
]
```

- [ ] **Step 6: Modify `participants-table.tsx`** the same way for the global list.

- [ ] **Step 7: Manual smoke check.**

```bash
npm run dev
# Open http://localhost:3002, sign in, go to a campaign with ≥2 participants
# Select 2 rows → "Compare selected" → workspace loads → toggle granularity → export CSV
```

- [ ] **Step 8: Commit each set of files separately so a regression bisect is clean.**

```bash
git add src/app/actions/comparison.ts ; git commit -m "feat(comparison): server-action search sources"
git add src/app/\(dashboard\)/campaigns/\[id\]/compare/ ; git commit -m "feat(comparison): admin campaign compare route"
git add src/app/\(dashboard\)/participants/compare/ ; git commit -m "feat(comparison): admin global compare route"
git add src/app/\(dashboard\)/campaigns/\[id\]/participants/campaign-participant-manager.tsx ; git commit -m "feat(comparison): wire 'Compare selected' on campaign participants tab"
git add src/app/\(dashboard\)/participants/participants-table.tsx ; git commit -m "feat(comparison): wire 'Compare selected' on global participants page"
```

---

### Task 16: Partner portal mirror

**Files**
- Create: `src/app/partner/campaigns/[id]/compare/{page,loading}.tsx`
- Create (only if a partner global participants list exists): `src/app/partner/participants/compare/{page,loading}.tsx`
- Modify: the partner equivalents of `campaign-participant-manager.tsx` and `participants-table.tsx`

- [ ] **Step 1: Locate the existing partner pages.** `ls src/app/partner/campaigns/[id]/participants/` and `ls src/app/partner/participants/ 2>/dev/null`. Confirm whether a global partner participants list exists.

- [ ] **Step 2: Mirror the admin routes**, swapping the search source and the band scheme resolution to use the partner's record. The partner row has its own `band_scheme` column (per `2026-04-16-custom-band-schemes-design.md`). Load it with the existing `getPartnerBandScheme(partnerId)` action.

- [ ] **Step 3: Add the bulk actions** to the partner participant manager / table.

- [ ] **Step 4: Smoke test in a partner-portal session.**

- [ ] **Step 5: Commit per-file as before.**

---

### Task 17: Client portal mirror

**Files**
- Create: `src/app/client/campaigns/[id]/compare/{page,loading}.tsx`
- Create (only if a client global participants list exists): `src/app/client/participants/compare/{page,loading}.tsx`
- Modify: the client equivalents of `campaign-participant-manager.tsx` / `participants-table.tsx`

- [ ] **Step 1: Confirm whether a client global participants list exists.** If not, only the campaign-scoped route + bulk action.

- [ ] **Step 2: Resolve the partner that owns the client** when computing `partnerBandScheme`. Use `resolveClientOrg` from `src/lib/auth/resolve-client-org.ts`.

- [ ] **Step 3: Mirror the routes and the bulk action wiring.**

- [ ] **Step 4: Smoke test in a client-portal session.**

- [ ] **Step 5: Commit per-file as before.**

---

## Phase 6 — Final verification

- [ ] **Step 1: Run the full test suites.**

```bash
npm run test:unit
npm run test:component
npm run test:integration:local
```

All green expected.

- [ ] **Step 2: Lint and typecheck.**

```bash
npm run lint
npm run typecheck
```

- [ ] **Step 3: Smoke checklist (manual, in `npm run dev`).**

- [ ] Admin: pick 2 participants in a campaign → Compare → matrix renders → CSV downloads with correct filename.
- [ ] Toggle granularity Dimensions ↔ Factors/Constructs → columns swap, no error.
- [ ] Add the same participant twice → two rows, distinct date pills, session popover lists all sessions.
- [ ] Pick an in-progress session via the popover → cells update, "in progress" annotation present.
- [ ] Cross-campaign compare from `/participants` → assessment chips show only assessments at least one selected participant has taken.
- [ ] Partner portal: same flow works; cell colours match partner's band scheme.
- [ ] Client portal: same flow works.
- [ ] Bookmark a comparison URL, open in a new tab → state restored.
- [ ] Light + dark mode look right.

- [ ] **Step 4: Push the branch and open a PR** referencing the spec.

```bash
git push -u origin feat/participant-comparison
gh pr create --title "feat: participant comparison matrix (v1)" --body "$(cat <<'EOF'
## Summary
- New comparison workspace for participants × assessment factors/dimensions
- Heatmap matrix with per-row session switcher and compare-against-self
- CSV export
- Triggered from existing campaign and global participant lists

## Test plan
- [ ] All unit, component, and integration tests pass
- [ ] Smoke checklist in spec walkthrough completed (admin / partner / client)
- [ ] Light + dark mode visual check

Spec: docs/superpowers/specs/2026-04-27-participant-comparison-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for the implementer

- **The two `TODO`-marked helpers in Task 6** (`factorLevelGroup`, `constructLevelGroup`) intentionally don't have prescribed SQL — confirm column names against the live schema first (per `AGENTS.md`'s "When in doubt, query the live schema" guidance), mirror the join pattern from `getSessionDetail` in `src/app/actions/sessions.ts`, then implement.
- **Authorization helpers** in this codebase live in `src/lib/auth/authorization.ts`: `requireParticipantAccess(participantId)` and `requireSessionAccess(sessionId)`. Both throw `AuthorizationError` on unauthorized ids and use `createAdminClient()` internally — do not pass a Supabase client to them.
- **Don't widen scope.** No statistics, no PDF, no saved comparisons, no row filters. The spec's Out-of-scope list is binding.
- **If a test seam is missing** (e.g., no `tests/integration/helpers` module yet), port the smallest piece from an existing integration test rather than inventing new infrastructure.
- **Frequent commits.** Each task ends in at least one commit. Don't squash until the PR review.
