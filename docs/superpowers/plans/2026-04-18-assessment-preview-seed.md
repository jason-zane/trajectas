# Assessment-Scoped Preview Seed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins switch the report template builder's preview between assessments, with each assessment backed by a seeded sample participant + session + POMP scores.

**Architecture:** Deterministic `synthScore(entityId)` produces per-entity POMP values; `seedAssessmentPreview(assessmentId)` upserts a campaign + participant + session + `participant_scores` rows into a shared "Sample Data" client. The seed is wired into `createAssessment`/`updateAssessment` so it stays fresh. Preview (both builder panel and standalone page) reads the seeded scores via `getPreviewEntitiesForAssessment` and feeds them into the existing `generateSampleData` renderer.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase Postgres, vitest for tests, React 19 client components for the dropdown.

**Reference spec:** `docs/superpowers/specs/2026-04-18-assessment-preview-seed-design.md`

---

## File Plan

**New files:**

| File | Responsibility |
|---|---|
| `src/lib/sample-data/score-synth.ts` | Deterministic `synthScore(entityId, salt?) → 20..90` |
| `src/lib/sample-data/seed-preview.ts` | `ensurePreviewSampleClient`, `seedAssessmentPreview`, `hasPreviewSeed`, `getPreviewSessionId` |
| `tests/unit/score-synth.test.ts` | Unit tests for synthScore |
| `tests/unit/seed-preview.test.ts` | Unit tests for seeding (with mocked supabase) |
| `supabase/migrations/{ts}_preview_sample_client.sql` | Inserts the Sample Data client row |

**Modified files:**

| File | Change |
|---|---|
| `src/lib/reports/sample-data.ts` | Extend `PreviewEntity` with optional `pompScore`; use when present |
| `src/app/actions/reports.ts` | Add `listAssessmentsForPreview`, `getPreviewEntitiesForAssessment`, `backfillAllPreviewSeeds` |
| `src/app/actions/assessments.ts` | Call `seedAssessmentPreview` from `createAssessment` & `updateAssessment`, non-blocking |
| `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx` | Assessment dropdown, fetch scoped entities+scores, pass `?assessment=` to Full preview button |
| `src/app/(dashboard)/report-templates/[id]/preview/page.tsx` | Read `?assessment=`, load scoped entities+scores, render via `buildTemplatePreviewBlocks`, fallback banner |

**Data migration (run once after deploy, not a file):**
- Call `backfillAllPreviewSeeds()` to seed both existing assessments via MCP `execute_sql` or a one-off Next.js route handler.

---

## Sample Data Client UUID

Use fixed UUID `00000000-0000-4000-8000-00008A4DC11E` ("SAMDClient" leet-speak to avoid clashes). Define as `PREVIEW_SAMPLE_CLIENT_ID` in `src/lib/sample-data/seed-preview.ts` and reference from everywhere.

---

## Task 1: Deterministic score synthesis

**Files:**
- Create: `src/lib/sample-data/score-synth.ts`
- Test: `tests/unit/score-synth.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/score-synth.test.ts
import { describe, it, expect } from 'vitest'
import { synthScore } from '@/lib/sample-data/score-synth'

describe('synthScore', () => {
  it('is deterministic — same entity id + salt produces the same score', () => {
    const a = synthScore('11111111-1111-1111-1111-111111111111')
    const b = synthScore('11111111-1111-1111-1111-111111111111')
    expect(a).toBe(b)
  })

  it('produces different scores for different entity ids', () => {
    const a = synthScore('11111111-1111-1111-1111-111111111111')
    const b = synthScore('22222222-2222-2222-2222-222222222222')
    expect(a).not.toBe(b)
  })

  it('always returns a value in the 20..90 range (inclusive)', () => {
    for (let i = 0; i < 100; i++) {
      const id = `${i}-aaaa-bbbb-cccc-dddddddddddd`
      const score = synthScore(id)
      expect(score).toBeGreaterThanOrEqual(20)
      expect(score).toBeLessThanOrEqual(90)
    }
  })

  it('returns different output when salt changes', () => {
    const a = synthScore('11111111-1111-1111-1111-111111111111', 'sample')
    const b = synthScore('11111111-1111-1111-1111-111111111111', 'other')
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/score-synth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `synthScore`**

```typescript
// src/lib/sample-data/score-synth.ts

/**
 * Deterministic sample POMP score for preview data.
 *
 * Maps (entityId, salt) → integer in [20, 90]. Avoids 0/100 extremes so
 * bands render realistically. Uses a simple FNV-1a hash; cryptographic
 * strength is not required.
 */
export function synthScore(entityId: string, salt = 'sample'): number {
  const input = `${entityId}:${salt}`
  let hash = 0x811c9dc5 // FNV-1a offset basis (32-bit)
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) // FNV prime
  }
  // Scale into 20..90 inclusive (71 values)
  const unsigned = hash >>> 0
  return 20 + (unsigned % 71)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/score-synth.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sample-data/score-synth.ts tests/unit/score-synth.test.ts
git commit -m "feat: deterministic synthScore for preview POMP values"
```

---

## Task 2: Weighted rollup helpers

**Files:**
- Modify: `src/lib/sample-data/score-synth.ts`
- Test: `tests/unit/score-synth.test.ts`

- [ ] **Step 1: Add failing tests for `weightedMean`**

Append to `tests/unit/score-synth.test.ts`:

```typescript
import { weightedMean } from '@/lib/sample-data/score-synth'

describe('weightedMean', () => {
  it('returns the weighted mean, rounded to the nearest integer', () => {
    expect(weightedMean([{ value: 60, weight: 1 }, { value: 80, weight: 3 }])).toBe(75)
  })

  it('returns 0 for an empty input', () => {
    expect(weightedMean([])).toBe(0)
  })

  it('falls back to unweighted mean when total weight is 0', () => {
    expect(weightedMean([{ value: 40, weight: 0 }, { value: 60, weight: 0 }])).toBe(50)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/score-synth.test.ts`
Expected: FAIL — `weightedMean` is not exported.

- [ ] **Step 3: Implement `weightedMean`**

Append to `src/lib/sample-data/score-synth.ts`:

```typescript
/** Weighted mean, rounded to the nearest integer. Returns 0 for empty input. */
export function weightedMean(items: Array<{ value: number; weight: number }>): number {
  if (items.length === 0) return 0
  let sum = 0
  let totalWeight = 0
  for (const { value, weight } of items) {
    sum += value * weight
    totalWeight += weight
  }
  if (totalWeight === 0) {
    // Degenerate case — fall back to unweighted mean
    const avg = items.reduce((a, b) => a + b.value, 0) / items.length
    return Math.round(avg)
  }
  return Math.round(sum / totalWeight)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/score-synth.test.ts`
Expected: PASS — all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sample-data/score-synth.ts tests/unit/score-synth.test.ts
git commit -m "feat: add weightedMean helper for preview score rollups"
```

---

## Task 3: Sample Data client migration

**Files:**
- Create: `supabase/migrations/20260418100000_preview_sample_client.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260418100000_preview_sample_client.sql
-- Inserts the platform-level "Sample Data" client that owns preview campaigns/
-- participants/sessions/scores for every assessment. Idempotent by UUID.

INSERT INTO clients (id, partner_id, name, slug, is_active, settings)
VALUES (
  '00000000-0000-4000-8000-00008a4dc11e'::uuid,
  NULL,
  'Sample Data',
  'sample-data',
  true,
  '{"preview_only": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Apply via MCP**

Invoke `mcp__claude_ai_Supabase__apply_migration` with:
- `project_id`: `rwpfwfcaxoevnvtkdmkx`
- `name`: `preview_sample_client`
- `query`: the SQL body above

Expected: `{"success":true}`.

- [ ] **Step 3: Verify**

Run via `mcp__claude_ai_Supabase__execute_sql`:
```sql
SELECT id, name, slug FROM clients WHERE id = '00000000-0000-4000-8000-00008a4dc11e';
```
Expected: one row with `name='Sample Data'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260418100000_preview_sample_client.sql
git commit -m "feat: add Sample Data client for preview seeds"
```

---

## Task 4: `ensurePreviewSampleClient`

**Files:**
- Create: `src/lib/sample-data/seed-preview.ts`
- Test: `tests/unit/seed-preview.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/seed-preview.test.ts
import { describe, it, expect, vi } from 'vitest'
import { PREVIEW_SAMPLE_CLIENT_ID, ensurePreviewSampleClient } from '@/lib/sample-data/seed-preview'

describe('ensurePreviewSampleClient', () => {
  it('returns the well-known client id', async () => {
    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: PREVIEW_SAMPLE_CLIENT_ID }, error: null }),
          }),
        }),
      }),
    }
    // @ts-expect-error — duck-typed client for unit test
    const id = await ensurePreviewSampleClient(db)
    expect(id).toBe(PREVIEW_SAMPLE_CLIENT_ID)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/seed-preview.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/lib/sample-data/seed-preview.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export const PREVIEW_SAMPLE_CLIENT_ID = '00000000-0000-4000-8000-00008a4dc11e'
export const PREVIEW_SAMPLE_EMAIL_DOMAIN = '@trajectas.local'
export const PREVIEW_SAMPLE_PARTICIPANT_FIRST = 'Alex'
export const PREVIEW_SAMPLE_PARTICIPANT_LAST = 'Morgan'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>

/**
 * Returns the well-known Sample Data client id. The migration guarantees the
 * row exists; this function exists so callers don't hardcode the UUID and so
 * we have a single place to swap the ID if needed.
 */
export async function ensurePreviewSampleClient(db: DB): Promise<string> {
  const { data, error } = await db
    .from('clients')
    .select('id')
    .eq('id', PREVIEW_SAMPLE_CLIENT_ID)
    .maybeSingle()
  if (error) throw new Error(`ensurePreviewSampleClient: ${error.message}`)
  if (!data) {
    throw new Error(
      `Sample Data client row missing — did you apply migration 20260418100000_preview_sample_client.sql?`,
    )
  }
  return PREVIEW_SAMPLE_CLIENT_ID
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/seed-preview.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sample-data/seed-preview.ts tests/unit/seed-preview.test.ts
git commit -m "feat: seed-preview module skeleton + ensurePreviewSampleClient"
```

---

## Task 5: `seedAssessmentPreview` — construct-level path

**Files:**
- Modify: `src/lib/sample-data/seed-preview.ts`
- Modify: `tests/unit/seed-preview.test.ts`

**Source-of-truth reference before writing:** Read `src/lib/scoring/ctt-session.ts` to see the exact `participant_scores` row shape written by the production scorer (column names for `scoring_method`, `raw_score`, `scaled_score`, `percentile`). Our seed must match that shape so the runner and UI don't care whether scores are seeded or real.

- [ ] **Step 1: Add failing test**

Append to `tests/unit/seed-preview.test.ts`:

```typescript
import { seedAssessmentPreview } from '@/lib/sample-data/seed-preview'

describe('seedAssessmentPreview (construct-level)', () => {
  it('upserts campaign, participant, session, and one score per construct', async () => {
    // Build a chainable mock supabase that records .insert/.upsert calls.
    // See tests/integration/report-template-actions.test.ts for a pattern.
    // Assert:
    //  - One insert/upsert to `campaigns` for (sample_client, assessment)
    //  - One to `campaign_participants` for the sample email
    //  - One to `participant_sessions` with status='completed'
    //  - N to `participant_scores`, one per construct, with scoring_level='construct'
    //    and scaled_score produced by synthScore(constructId)
    //  - One upsert per dimension with scoring_level='dimension' IF the
    //    participant_scores.scoring_level enum allows it. (See migration
    //    `20260416140000_flexible_taxonomy_hierarchy.sql` — if 'dimension'
    //    is not a valid enum value, dimension scores are computed on the fly
    //    by the renderer and we skip persisting them.)
  })
})
```

- [ ] **Step 2: Verify enum values of `scoring_level`**

Before implementing, run via MCP `execute_sql`:

```sql
SELECT unnest(enum_range(NULL::scoring_level)) AS value;
```

If the enum only has `('factor','construct')`, then we **only** store factor or construct rows; dimensions are aggregated at render time. Use that as the spec. If the enum includes `'dimension'`, we can optionally also persist dimension rollups.

**Expected for v1:** only `factor` and `construct`. Implement without dimension-level rows.

- [ ] **Step 3: Implement construct-level seeding**

Add to `src/lib/sample-data/seed-preview.ts`:

```typescript
import { synthScore, weightedMean } from './score-synth'

export interface SeedResult {
  campaignId: string
  participantId: string
  sessionId: string
  scoreCount: number
}

const SAMPLE_SCORING_METHOD = 'ctt'

export async function seedAssessmentPreview(db: DB, assessmentId: string): Promise<SeedResult> {
  await ensurePreviewSampleClient(db)

  // 1) Look up the assessment to get its scoring_level and title
  const assessment = await db
    .from('assessments')
    .select('id, title, scoring_level')
    .eq('id', assessmentId)
    .is('deleted_at', null)
    .maybeSingle()
  if (assessment.error) throw new Error(assessment.error.message)
  if (!assessment.data) throw new Error(`seedAssessmentPreview: assessment ${assessmentId} not found`)

  const { title, scoring_level: scoringLevel } = assessment.data as {
    title: string
    scoring_level: 'factor' | 'construct'
  }

  // 2) Upsert campaign by natural key (client + assessment)
  const campaignSlug = `preview-${assessmentId}`
  const campaignTitle = `Preview Sample — ${title}`
  const existingCampaign = await db
    .from('campaigns')
    .select('id')
    .eq('client_id', PREVIEW_SAMPLE_CLIENT_ID)
    .eq('slug', campaignSlug)
    .maybeSingle()
  let campaignId = existingCampaign.data?.id
  if (!campaignId) {
    const ins = await db
      .from('campaigns')
      .insert({
        client_id: PREVIEW_SAMPLE_CLIENT_ID,
        title: campaignTitle,
        slug: campaignSlug,
        status: 'active',
        brand_mode: 'platform',
      })
      .select('id')
      .single()
    if (ins.error) throw new Error(`seedAssessmentPreview/campaign insert: ${ins.error.message}`)
    campaignId = ins.data.id
  }

  // 3) Upsert campaign_participant by (campaign_id, email)
  const sampleEmail = `sample+${assessmentId}${PREVIEW_SAMPLE_EMAIL_DOMAIN}`
  const existingParticipant = await db
    .from('campaign_participants')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('email', sampleEmail)
    .maybeSingle()
  let participantId = existingParticipant.data?.id
  if (!participantId) {
    const ins = await db
      .from('campaign_participants')
      .insert({
        campaign_id: campaignId,
        email: sampleEmail,
        first_name: PREVIEW_SAMPLE_PARTICIPANT_FIRST,
        last_name: PREVIEW_SAMPLE_PARTICIPANT_LAST,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (ins.error) throw new Error(`seedAssessmentPreview/participant insert: ${ins.error.message}`)
    participantId = ins.data.id
  }

  // 4) Upsert participant_session (status completed)
  const existingSession = await db
    .from('participant_sessions')
    .select('id')
    .eq('assessment_id', assessmentId)
    .eq('campaign_participant_id', participantId)
    .maybeSingle()
  let sessionId = existingSession.data?.id
  if (!sessionId) {
    const ins = await db
      .from('participant_sessions')
      .insert({
        assessment_id: assessmentId,
        campaign_id: campaignId,
        campaign_participant_id: participantId,
        client_id: PREVIEW_SAMPLE_CLIENT_ID,
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        processing_status: 'complete',
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (ins.error) throw new Error(`seedAssessmentPreview/session insert: ${ins.error.message}`)
    sessionId = ins.data.id
  }

  // 5) Clear + insert scores (clear-and-reinsert keeps it simple; idempotent)
  await db.from('participant_scores').delete().eq('session_id', sessionId)

  let scoreCount = 0
  if (scoringLevel === 'construct') {
    scoreCount = await seedConstructScores(db, sessionId, assessmentId)
  } else {
    scoreCount = await seedFactorScores(db, sessionId, assessmentId)
  }

  return { campaignId: campaignId!, participantId: participantId!, sessionId: sessionId!, scoreCount }
}

async function seedConstructScores(db: DB, sessionId: string, assessmentId: string): Promise<number> {
  const { data, error } = await db
    .from('assessment_constructs')
    .select('construct_id')
    .eq('assessment_id', assessmentId)
  if (error) throw new Error(`seedConstructScores: ${error.message}`)
  const rows = (data ?? []).map((r) => {
    const score = synthScore(r.construct_id)
    return {
      session_id: sessionId,
      construct_id: r.construct_id,
      factor_id: null,
      scoring_level: 'construct',
      scoring_method: SAMPLE_SCORING_METHOD,
      raw_score: score,
      scaled_score: score,
    }
  })
  if (rows.length === 0) return 0
  const ins = await db.from('participant_scores').insert(rows)
  if (ins.error) throw new Error(`seedConstructScores/insert: ${ins.error.message}`)
  return rows.length
}

// Factor-level path implemented in Task 6
async function seedFactorScores(_db: DB, _sessionId: string, _assessmentId: string): Promise<number> {
  throw new Error('seedFactorScores: not implemented yet')
}
```

- [ ] **Step 4: Flesh out the construct-level unit test**

Replace the placeholder with a real assertion:

```typescript
import { describe, it, expect, vi } from 'vitest'
// ... imports

// Minimal chainable mock that records calls and returns scripted data
function makeChain(scripted: Record<string, unknown>) {
  // See tests/integration/report-template-actions.test.ts lines 30-80 for the
  // full pattern. For this unit test, a small chain works because we only need
  // to test the *shape* of what goes into .insert().
  // Implementation: track a call log, replay scripted return values by table.
}

it('construct-level: inserts one score row per construct, scaled_score from synthScore', async () => {
  const constructIds = [
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  ]
  const insertCalls: Array<{ table: string; rows: unknown[] }> = []
  const db = makeChain({
    clients: { maybeSingle: { data: { id: PREVIEW_SAMPLE_CLIENT_ID } } },
    assessments: { maybeSingle: { data: { id: 'assess-1', title: 'Test', scoring_level: 'construct' } } },
    campaigns: { maybeSingle: { data: null }, insert: { data: { id: 'camp-1' } } },
    campaign_participants: { maybeSingle: { data: null }, insert: { data: { id: 'part-1' } } },
    participant_sessions: { maybeSingle: { data: null }, insert: { data: { id: 'sess-1' } } },
    assessment_constructs: { data: constructIds.map((construct_id) => ({ construct_id })) },
    participant_scores: { delete: {}, insert: { data: null } },
  }, insertCalls)

  const result = await seedAssessmentPreview(db as never, 'assess-1')
  expect(result.scoreCount).toBe(2)
  const scoreInsert = insertCalls.find((c) => c.table === 'participant_scores')
  expect(scoreInsert).toBeDefined()
  expect((scoreInsert!.rows as Array<Record<string, unknown>>)[0].scoring_level).toBe('construct')
  expect((scoreInsert!.rows as Array<Record<string, unknown>>).every((r) => typeof r.scaled_score === 'number')).toBe(true)
})
```

Build the `makeChain` helper by adapting `queryBuilder` in `tests/integration/report-template-actions.test.ts`. Keep it in a fixture file `tests/unit/helpers/supabase-mock.ts` if it grows.

- [ ] **Step 5: Run tests; ensure passing**

Run: `npx vitest run tests/unit/seed-preview.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sample-data/seed-preview.ts tests/unit/seed-preview.test.ts tests/unit/helpers/supabase-mock.ts
git commit -m "feat: seedAssessmentPreview construct-level path"
```

---

## Task 6: `seedFactorScores` — factor-level path

**Files:**
- Modify: `src/lib/sample-data/seed-preview.ts`
- Modify: `tests/unit/seed-preview.test.ts`

- [ ] **Step 1: Add failing test**

```typescript
it('factor-level: inserts one row per factor, scaled_score = weighted mean of child constructs', async () => {
  // Fixture: 1 factor with 2 child constructs (weights 1 and 3)
  // Expected: factor row with scoring_level='factor', scaled_score = weightedMean of synthScore(construct_a), synthScore(construct_b)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/seed-preview.test.ts`

- [ ] **Step 3: Implement**

Replace the stub:

```typescript
async function seedFactorScores(db: DB, sessionId: string, assessmentId: string): Promise<number> {
  const { data, error } = await db
    .from('assessment_factors')
    .select('factor_id, factors(id, dimension_id, factor_constructs(construct_id, weight))')
    .eq('assessment_id', assessmentId)
  if (error) throw new Error(`seedFactorScores: ${error.message}`)

  const rows = (data ?? []).map((row: {
    factor_id: string
    factors: { id: string; dimension_id: string | null; factor_constructs: Array<{ construct_id: string; weight: number }> }
  }) => {
    const constructs = row.factors?.factor_constructs ?? []
    const factorScore = constructs.length === 0
      ? synthScore(row.factor_id)
      : weightedMean(constructs.map((c) => ({ value: synthScore(c.construct_id), weight: Number(c.weight) })))
    return {
      session_id: sessionId,
      factor_id: row.factor_id,
      construct_id: null,
      scoring_level: 'factor',
      scoring_method: SAMPLE_SCORING_METHOD,
      raw_score: factorScore,
      scaled_score: factorScore,
    }
  })
  if (rows.length === 0) return 0
  const ins = await db.from('participant_scores').insert(rows)
  if (ins.error) throw new Error(`seedFactorScores/insert: ${ins.error.message}`)
  return rows.length
}
```

- [ ] **Step 4: Run tests — ensure passing**

Run: `npx vitest run tests/unit/seed-preview.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/sample-data/seed-preview.ts tests/unit/seed-preview.test.ts
git commit -m "feat: seedAssessmentPreview factor-level path with weighted rollup"
```

---

## Task 7: Idempotency + helpers `hasPreviewSeed`, `getPreviewSessionId`

**Files:**
- Modify: `src/lib/sample-data/seed-preview.ts`
- Modify: `tests/unit/seed-preview.test.ts`

- [ ] **Step 1: Add failing tests**

```typescript
it('is idempotent — running twice yields the same campaign/session ids', async () => {
  // Second call should reuse the existing campaign/participant/session rows
  // and re-insert scores. Score rows may have different DB ids each run; what
  // matters is that we have N rows after each run (not 2N).
})

it('hasPreviewSeed returns true after seeding, false before', async () => { /* ... */ })
it('getPreviewSessionId returns the session id after seeding', async () => { /* ... */ })
```

- [ ] **Step 2: Implement helpers**

```typescript
export async function hasPreviewSeed(db: DB, assessmentId: string): Promise<boolean> {
  const { data } = await db
    .from('participant_sessions')
    .select('id')
    .eq('assessment_id', assessmentId)
    .eq('client_id', PREVIEW_SAMPLE_CLIENT_ID)
    .maybeSingle()
  return !!data
}

export async function getPreviewSessionId(db: DB, assessmentId: string): Promise<string | null> {
  const { data } = await db
    .from('participant_sessions')
    .select('id')
    .eq('assessment_id', assessmentId)
    .eq('client_id', PREVIEW_SAMPLE_CLIENT_ID)
    .maybeSingle()
  return data?.id ?? null
}
```

- [ ] **Step 3: Run tests, ensure passing, commit**

```bash
git add src/lib/sample-data/seed-preview.ts tests/unit/seed-preview.test.ts
git commit -m "feat: add hasPreviewSeed and getPreviewSessionId helpers"
```

---

## Task 8: Wire seeding into `createAssessment` / `updateAssessment`

**Files:**
- Modify: `src/app/actions/assessments.ts`

- [ ] **Step 1: Locate the return points**

Grep for `createAssessment` and `updateAssessment` exports in `src/app/actions/assessments.ts`. Note the transaction boundaries — we want to call `seedAssessmentPreview` **after** the main write has committed, wrapped in try/catch so a seed failure never fails the parent request.

- [ ] **Step 2: Add seed hook**

```typescript
// in src/app/actions/assessments.ts, after successful createAssessment/updateAssessment:
import { seedAssessmentPreview } from '@/lib/sample-data/seed-preview'

// After the insert/update returns successfully:
try {
  await seedAssessmentPreview(db, assessmentId)
} catch (err) {
  // Preview seed is best-effort; don't fail the user's request. Log for visibility.
  console.warn(`[createAssessment] preview seed failed for ${assessmentId}:`, err)
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Manual smoke test via existing integration tests**

Run: `npx vitest run tests/integration/`
Expected: existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/assessments.ts
git commit -m "feat: auto-seed preview data on assessment create/update"
```

---

## Task 9: Extend `PreviewEntity` with optional `pompScore`

**Files:**
- Modify: `src/lib/reports/sample-data.ts`
- Test: `tests/unit/reports-sample-data.test.ts` (new)

- [ ] **Step 1: Write failing test for pompScore pass-through**

```typescript
// tests/unit/reports-sample-data.test.ts
import { describe, it, expect } from 'vitest'
import { generateSampleData } from '@/lib/reports/sample-data'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'

describe('generateSampleData — honours PreviewEntity.pompScore', () => {
  it('uses entity.pompScore when present, ignores default distribution', () => {
    const blocks = [{ id: 'b1', type: 'score_overview', order: 0, config: {} }]
    const entities = [
      { id: 'e1', name: 'Foo', type: 'factor' as const, pompScore: 42 },
      { id: 'e2', name: 'Bar', type: 'factor' as const, pompScore: 78 },
    ]
    const [result] = generateSampleData(blocks as never, DEFAULT_REPORT_THEME, entities, 'Test')
    const scores = (result.data as { scores: Array<{ pompScore: number }> }).scores
    expect(scores[0].pompScore).toBe(42)
    expect(scores[1].pompScore).toBe(78)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/reports-sample-data.test.ts`
Expected: FAIL — pompScore ignored.

- [ ] **Step 3: Update `PreviewEntity` and `scoreEntities`**

```typescript
// src/lib/reports/sample-data.ts
export interface PreviewEntity {
  id: string
  name: string
  type: 'dimension' | 'factor' | 'construct'
  parentId?: string
  // ... existing fields
  /** If present, use this POMP score instead of the deterministic distribution. */
  pompScore?: number
}

function scoreEntities(entities: PreviewEntity[], scheme: BandScheme): ScoredEntity[] {
  return entities.map((e, i) => {
    const pompScore = e.pompScore ?? PREVIEW_SCORES[i % PREVIEW_SCORES.length]
    return { ...e, pompScore, bandResult: resolveBand(pompScore, scheme) }
  })
}
```

- [ ] **Step 4: Run tests, ensure passing, commit**

```bash
git add src/lib/reports/sample-data.ts tests/unit/reports-sample-data.test.ts
git commit -m "feat: PreviewEntity accepts optional pompScore; generator uses it when present"
```

---

## Task 10: Server actions — `listAssessmentsForPreview` and `getPreviewEntitiesForAssessment`

**Files:**
- Modify: `src/app/actions/reports.ts`

- [ ] **Step 1: Add `listAssessmentsForPreview`**

Append near the other preview-adjacent actions (after `getEntityOptions`):

```typescript
export interface PreviewAssessmentOption {
  id: string
  title: string
  scoringLevel: 'factor' | 'construct'
}

export async function listAssessmentsForPreview(): Promise<PreviewAssessmentOption[]> {
  const scope = await resolveAuthorizedScope()
  ensureReportTemplateLibraryAccess(scope)
  const db = createAdminClient()
  const { data, error } = await db
    .from('assessments')
    .select('id, title, scoring_level')
    .is('deleted_at', null)
    .eq('status', 'active')
    .order('title', { ascending: true })
  if (error) throwActionError('listAssessmentsForPreview', 'Unable to load assessments.', error)
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    scoringLevel: row.scoring_level as 'factor' | 'construct',
  }))
}
```

- [ ] **Step 2: Add `getPreviewEntitiesForAssessment`**

```typescript
export async function getPreviewEntitiesForAssessment(
  assessmentId: string,
): Promise<PreviewEntity[]> {
  const scope = await resolveAuthorizedScope()
  ensureReportTemplateLibraryAccess(scope)
  const db = createAdminClient()

  // Resolve scoring level + seeded session id
  const { data: assessment } = await db
    .from('assessments')
    .select('id, scoring_level')
    .eq('id', assessmentId)
    .maybeSingle()
  if (!assessment) throwActionError('getPreviewEntitiesForAssessment', 'Assessment not found.')

  const scoringLevel = assessment.scoring_level as 'factor' | 'construct'

  const sessionId = await getPreviewSessionId(db, assessmentId)
  const scores = sessionId
    ? await db.from('participant_scores').select('factor_id, construct_id, scaled_score').eq('session_id', sessionId)
    : { data: [] as Array<{ factor_id: string | null; construct_id: string | null; scaled_score: number }> }

  const scoreByEntity = new Map<string, number>()
  for (const row of scores.data ?? []) {
    const entityId = row.factor_id ?? row.construct_id
    if (entityId) scoreByEntity.set(entityId, Number(row.scaled_score))
  }

  // Load the scoped entities (factors + their constructs + dimensions; or constructs + dimensions)
  // Convert each into a PreviewEntity with pompScore populated from scoreByEntity.
  // Dimensions get POMP computed via weightedMean from their child scores (renderer does this but we pre-compute for consistency).

  // Implementation: see the existing getEntityOptions() pattern; just filter by assessment's linked entities.
  // ... (full code generated during implementation; too long to repeat inline)

  return entities // PreviewEntity[]
}
```

Full pseudocode (for implementer to expand):
1. `scoringLevel === 'construct'`: load `assessment_constructs` → join constructs; for each construct, pull POMP from `scoreByEntity`. Also load each construct's linked dimensions via `dimension_constructs`, dedupe, compute dimension POMP as weighted mean of its constructs' POMPs. Include dimensions in output with `parentId=undefined`, constructs with `parentId=<dimensionId>`.
2. `scoringLevel === 'factor'`: load `assessment_factors` → join factors; constructs via `factor_constructs`; dimensions via `factors.dimension_id`. Factor POMP from `scoreByEntity`. Construct POMP from `synthScore(constructId)` (constructs aren't persisted in factor mode). Dimension POMP = mean of its factors' POMPs.
3. Include `definition`, `description`, `indicatorsLow/mid/high`, `strengthCommentary`, `developmentSuggestion`, `anchorLow`, `anchorHigh` on every entity — these drive the rendered copy.

- [ ] **Step 3: Integration test**

Add to `tests/integration/report-template-actions.test.ts` (or new file `tests/integration/preview-actions.test.ts`):

```typescript
it('listAssessmentsForPreview returns active assessments sorted by title', async () => { /* ... */ })
it('getPreviewEntitiesForAssessment (construct-level) returns constructs with pompScore from seeded session', async () => { /* ... */ })
it('getPreviewEntitiesForAssessment falls back to synthScore when no seed exists', async () => {
  // safety net: if hasPreviewSeed returns false, pompScores come from synthScore
  // so the UI never breaks
})
```

- [ ] **Step 4: Run tests, commit**

```bash
git add src/app/actions/reports.ts tests/integration/preview-actions.test.ts
git commit -m "feat: server actions to list assessments and load scoped preview entities"
```

---

## Task 11: Builder dropdown + wiring

**Files:**
- Modify: `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx`

- [ ] **Step 1: Add state + fetch**

Add near the other `useState` calls around line 249:

```typescript
const [previewAssessments, setPreviewAssessments] = useState<PreviewAssessmentOption[]>([])
const [selectedPreviewAssessmentId, setSelectedPreviewAssessmentId] = useState<string | null>(null)
```

Replace the current `useEffect` that fetches entities (line 273) with:

```typescript
useEffect(() => {
  // Load assessment list once
  listAssessmentsForPreview().then((items) => {
    setPreviewAssessments(items)
    // Restore last selection or default to first
    const saved = typeof window !== 'undefined'
      ? window.localStorage.getItem(`preview-assessment-${templateId}`)
      : null
    const initial = items.find((a) => a.id === saved) ?? items[0]
    if (initial) setSelectedPreviewAssessmentId(initial.id)
  })
}, [templateId])

useEffect(() => {
  if (!selectedPreviewAssessmentId) return
  getPreviewEntitiesForAssessment(selectedPreviewAssessmentId).then((entities) => {
    setEntityOptions(entities.map((e) => ({
      id: e.id,
      label: e.name,
      type: e.type,
      parentId: e.parentId,
      definition: e.definition,
      description: e.description,
      indicatorsLow: e.indicatorsLow,
      indicatorsMid: e.indicatorsMid,
      indicatorsHigh: e.indicatorsHigh,
      strengthCommentary: e.strengthCommentary,
      developmentSuggestion: e.developmentSuggestion,
      // Pass pompScore through the entity option so scoreEntities picks it up
      // @ts-expect-error — pompScore is not on EntityOption; we carry it via the shape below
      pompScore: e.pompScore,
    })))
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`preview-assessment-${templateId}`, selectedPreviewAssessmentId)
    }
  })
}, [selectedPreviewAssessmentId, templateId])
```

Note: `EntityOption` in `src/app/actions/reports.ts` doesn't carry `pompScore`. Either widen `EntityOption` to include it, or store the raw `PreviewEntity[]` result and map to `PreviewEntity` at the `buildTemplatePreviewBlocks` call site. **Prefer the latter** — keeps `EntityOption` stable for the picker UI. So the state becomes:

```typescript
const [previewEntities, setPreviewEntities] = useState<PreviewEntity[]>([])
```

and the `buildTemplatePreviewBlocks` call on line 286 becomes `buildTemplatePreviewBlocks(ordered, previewEntities, name)`.

- [ ] **Step 2: Add the dropdown UI in the preview panel header**

Find `TemplatePreviewSurface` (around line 990). Add before the "Full preview" button:

```tsx
<select
  value={selectedPreviewAssessmentId ?? ''}
  onChange={(e) => setSelectedPreviewAssessmentId(e.target.value)}
  className="text-xs rounded border px-2 py-1"
  aria-label="Preview as assessment"
>
  {previewAssessments.map((a) => (
    <option key={a.id} value={a.id}>{a.title}</option>
  ))}
</select>
```

Check `docs/ui-standards.md` for the canonical select styling; use the existing Select component if one exists (search for `Select` import in the same file).

- [ ] **Step 3: Pass `?assessment=` through to the Full preview button**

Find the button on line 1011:

```typescript
onClick={() => window.open(`${basePath}/${templateId}/preview`, '_blank')}
```

Change to:

```typescript
onClick={() => {
  const url = new URL(`${basePath}/${templateId}/preview`, window.location.origin)
  if (selectedPreviewAssessmentId) url.searchParams.set('assessment', selectedPreviewAssessmentId)
  window.open(url.toString(), '_blank')
}}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx
git commit -m "feat: assessment dropdown in report template preview panel"
```

---

## Task 12: Standalone preview page — URL param + scoped entities

**Files:**
- Modify: `src/app/(dashboard)/report-templates/[id]/preview/page.tsx`

- [ ] **Step 1: Accept `?assessment=` and load scoped entities**

Replace the existing page:

```tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  getReportTemplate,
  getPreviewEntitiesForAssessment,
  listAssessmentsForPreview,
} from '@/app/actions/reports'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { buildTemplatePreviewBlocks } from '@/lib/reports/preview'

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
  const selectedAssessment = assessments.find((a) => a.id === selectedId) ?? null

  const previewEntities = selectedId
    ? await getPreviewEntitiesForAssessment(selectedId)
    : []

  const sampleBlocks = buildTemplatePreviewBlocks(
    template.blocks as Record<string, unknown>[],
    previewEntities,
    template.name,
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--report-page-bg, #fafaf8)' }}>
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200">
        Preview — showing sample data
        {selectedAssessment ? ` for ${selectedAssessment.title}` : ''}.{' '}
        <a href={`/report-templates/${id}/builder`} className="underline hover:no-underline">
          Back to builder
        </a>
      </div>
      <Suspense>
        <ReportRenderer blocks={sampleBlocks} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`

- [ ] **Step 3: Manual smoke check**

- Navigate to `/report-templates/<anyId>/preview?assessment=9fac1ea2-d0c6-4127-8861-4774e1c38ce0` → should render AI Capability Index.
- Navigate to `/report-templates/<anyId>/preview?assessment=f231ebc1-b7e1-49e7-b103-0bee6ca6296c` → should render Trajectas Personality Index.

(Only possible after Task 13 applies backfill; verify both after Task 13 completes.)

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/report-templates/[id]/preview/page.tsx
git commit -m "feat: standalone preview honours ?assessment= URL param"
```

---

## Task 13: Backfill existing assessments + deploy verification

**Files:**
- Create: `src/app/actions/reports.ts` (append `backfillAllPreviewSeeds`)

- [ ] **Step 1: Add `backfillAllPreviewSeeds` admin action**

```typescript
export async function backfillAllPreviewSeeds(): Promise<{ seededAssessmentIds: string[] }> {
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) throw new Error('Unauthorized')
  const db = createAdminClient()
  const { data: assessments } = await db
    .from('assessments')
    .select('id')
    .is('deleted_at', null)
    .eq('status', 'active')
  const seeded: string[] = []
  for (const a of assessments ?? []) {
    try {
      await seedAssessmentPreview(db, a.id)
      seeded.push(a.id)
    } catch (err) {
      console.warn(`[backfillAllPreviewSeeds] failed for ${a.id}:`, err)
    }
  }
  return { seededAssessmentIds: seeded }
}
```

- [ ] **Step 2: Dispatch the backfill**

**Option A — MCP SQL direct call (preferred for this one-off):**
Call `mcp__claude_ai_Supabase__execute_sql` to run the seeding directly via SQL functions. Not feasible because the seed logic is TS. Use Option B.

**Option B — Temporary admin route:**
Create `src/app/api/_internal/backfill-preview-seeds/route.ts` (gated on platform admin) that calls `backfillAllPreviewSeeds()`. Invoke via `curl` with an authorized session cookie after deploy.

**Option C (SIMPLEST for this plan):** Perform the backfill via MCP by manually running the seeding logic as SQL (compute synthScore in SQL, insert rows). See Task 13.3.

- [ ] **Step 3: Execute the backfill**

Use Option B. After deploy:
```bash
curl -b "<auth-cookie>" -X POST https://<host>/api/_internal/backfill-preview-seeds
```
Or run via the browser while logged in as platform admin.

Expected: `{"seededAssessmentIds": ["9fac1ea2-…", "f231ebc1-…"]}`

- [ ] **Step 4: Verify via MCP**

```sql
SELECT a.id, a.title, a.scoring_level,
  (SELECT COUNT(*) FROM participant_sessions ps
    WHERE ps.assessment_id = a.id AND ps.client_id = '00000000-0000-4000-8000-00008a4dc11e') AS session_count,
  (SELECT COUNT(*) FROM participant_scores s
    JOIN participant_sessions ps ON ps.id = s.session_id
    WHERE ps.assessment_id = a.id AND ps.client_id = '00000000-0000-4000-8000-00008a4dc11e') AS score_count
FROM assessments a
WHERE a.deleted_at IS NULL AND a.status = 'active';
```

Expected: each active assessment has session_count=1 and score_count>0.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/reports.ts src/app/api/_internal/backfill-preview-seeds/route.ts
git commit -m "feat: backfillAllPreviewSeeds action + internal backfill route"
```

---

## Task 14: Final integration smoke test + commit cleanup

- [ ] **Step 1: Full test suite**

Run: `npm run test` and `npm run typecheck` and `npm run lint`
Expected: all pass.

- [ ] **Step 2: Manual acceptance (localhost)**

1. `npm run dev`
2. Log in as platform admin.
3. Navigate to any report template builder.
4. Confirm the preview panel shows the new dropdown and defaults to one of the two assessments.
5. Switch to the other assessment → preview blocks re-render with the new entity set and POMP values.
6. Click "Full preview" → standalone page opens with `?assessment=<id>` and renders the same scoped preview.
7. Create a brand-new test assessment through the builder → confirm a sample session+scores appear in `participant_sessions`/`participant_scores` for the Sample Data client.

- [ ] **Step 3: Finishing skill**

When all tasks are green, invoke `superpowers:finishing-a-development-branch` to decide on merge/PR.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Seed write fails silently and preview always shows fallback | Log warnings in both the create/update hook and the backfill action; include assertion in Task 14 step 2 |
| Sample Data client shows in the clients list and confuses admins | Accepted — labelled "Sample Data". Easy to filter later if needed. |
| `participant_scores.scoring_level` enum rejects dimension-level rows | We don't insert dimension rows; dimensions are aggregated at render time. Verified in Task 5 step 2 before implementing. |
| `getPreviewEntitiesForAssessment` returns too much data for large assessments | Unlikely at current scale (≤24 constructs per assessment). If this grows, add server-side caching. |
| `localStorage` selection becomes stale when an assessment is deleted | `useEffect` restores to first option if saved ID isn't in the list — implemented in Task 11 step 1 |
