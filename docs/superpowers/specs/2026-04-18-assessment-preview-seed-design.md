# Assessment-Scoped Preview Data — Design

## Problem

The report template builder's live preview currently pulls every active library entity and assigns deterministic fake scores by position. The cover page hardcodes "AI Capability Index" as the sample assessment name. There's no way to see what a template looks like when rendered for a specific assessment's actual structure.

With two assessments now in production (AI Capability Index, factor-level; Trajectas Personality Index, construct-level, 24 constructs under 6 dimensions), admins need to preview a template against either assessment's shape.

## Goals

1. Add an assessment dropdown to the report template builder's preview panel
2. Seed a real sample participant + session + scores per assessment so the preview renders through the real report pipeline
3. Seeds stay fresh automatically when assessments are created or updated
4. The standalone `/report-templates/[id]/preview` page honours the same selection via URL param

## Non-Goals

- No generated item responses (we short-circuit the scorer; see §2)
- No AI narrative generation for preview (existing `[Preview]` placeholder stays)
- No scheduled/cron refresh — purely tied to assessment save
- No hiding the Sample Data client from the clients list — platform admins should see it
- No per-user selection persistence on the server (localStorage only)

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Seed depth | Pre-computed scores, no item responses | Matches real `participant_scores` shape; renderer/runner exercised end-to-end; no synthesis of Likert responses |
| Where seeds live | Dedicated "Sample Data" client | No schema change; isolated from real data via `client_id` filter; clear home in DB |
| Dropdown placement | Builder preview panel only; URL param to standalone | Single source of truth (builder); no dual state |
| Seed freshness | Auto-regenerate on assessment create/update | Seeds are cheap; eliminates the "is it stale?" problem |
| Score synthesis | Deterministic hash of entity id | Same entity always gets the same score; easy to diff across runs |

## Data Model

### Sample Data client

Single `clients` row, platform-owned:
- `name`: "Sample Data"
- `partner_id`: NULL
- Well-known UUID: `00000000-0000-4000-8000-000000000001`
- Seeded via migration, idempotent

### Per assessment

Each seeded assessment gets:

1. A **campaign** — `name`: "Preview Sample — {Assessment Title}", `client_id`: sample-client, linked to the assessment
2. A **participant** — shared contact "Sample Participant" (email: `sample+{assessmentId}@trajectas.local`), joined to that campaign
3. A **participant_session** — status `completed`, `submitted_at = now()`
4. **participant_scores** — one row per scored entity in the assessment's scope:
   - Construct-level assessment: every construct in `assessment_constructs` + every dimension reached via `dimension_constructs`
   - Factor-level: every factor in `assessment_factors` + every construct reached via `factor_constructs` + every dimension reached via `factors.dimension_id`

All rows tagged with the right `scoring_level` and appropriate FK (`factor_id` / `construct_id` / `dimension_id`) so the real report runner can resolve them exactly as it would for a production report.

## Score Synthesis (the middle-depth path)

New module: `src/lib/sample-data/score-synth.ts`

```typescript
// Deterministic POMP score 20..90 from an entity ID and salt.
// Hash(entityId + salt) → integer → scaled into the 20-90 band.
// Avoids 0/100 extremes so banding renders realistically.
export function synthScore(entityId: string, salt = 'sample'): number
```

### Construct-level assessments

- Construct POMP = `synthScore(constructId)`
- Dimension POMP = weighted mean of its constructs' POMP, using `dimension_constructs.weight`

### Factor-level assessments

- Construct POMP = `synthScore(constructId)`
- Factor POMP = weighted mean of its constructs, using `factor_constructs.weight`
- Dimension POMP = simple mean of its factors' POMP (factors → dimension is unweighted via `factors.dimension_id`)

Every computed score lands in `participant_scores` with the correct `scoring_level`, `factor_id`, `construct_id`, or `dimension_id` matching the production pipeline's output shape. The runner reads these as it would real scores.

## Seeding Module

New file: `src/lib/sample-data/seed-preview.ts`

Exports:

- `ensurePreviewSampleClient(db): Promise<string>` — returns sample client UUID; idempotent
- `seedAssessmentPreview(db, assessmentId): Promise<void>` — idempotent; upserts campaign + participant + session + scores for one assessment
- `hasPreviewSeed(db, assessmentId): Promise<boolean>`
- `getPreviewSessionId(db, assessmentId): Promise<string | null>`

### Idempotency

- Campaign lookup key: `(client_id = sample, assessment_id = X)` → upsert by that pair
- Participant lookup key: `(campaign_id, email)` → upsert
- Session lookup key: `(participant_id, assessment_id)` → upsert
- Scores: delete-then-reinsert all rows for the session, so schema changes on the assessment propagate cleanly

### Wiring

- `createAssessment` action — after insert: `seedAssessmentPreview(newId)`
- `updateAssessment` action — after update: `seedAssessmentPreview(id)` (regenerates scores if entity structure changed)
- Migration backfill — calls `seedAssessmentPreview` for AI Capability Index and Trajectas Personality Index

Failures in `seedAssessmentPreview` must not fail the parent `createAssessment` / `updateAssessment` call — wrap in try/catch, log, and continue. Seeds are best-effort; a missing seed is recoverable (lazy fallback on preview — see §Preview Rendering).

## Preview Rendering

### Standalone preview page (`/report-templates/[id]/preview`)

- Reads `?assessment=<id>` URL param
- If the assessment has a seed: loads the seeded `participant_session_id`, invokes the real report runner, renders output
- If no seed (safety net): falls back to current behaviour (library entities + deterministic fake scores) with a banner "Sample seed missing for this assessment — showing generic preview"
- Banner text: "Preview — showing sample data for {Assessment Title}"

### Builder live preview panel (`block-builder-client.tsx`)

- New dropdown in the preview panel header:
  ```
  Preview as: [ AI Capability Index ▾ ]   [Full preview]
  ```
- Options = active assessments sorted alphabetically
- Default = `localStorage['preview-assessment-' + templateId]` ?? first option
- On change:
  - Fetch `getPreviewEntitiesForAssessment(assessmentId)` → `PreviewEntity[]` with `pompScore` populated from seeded scores
  - Re-run `buildTemplatePreviewBlocks(blocks, entities, templateName)` with those entities
  - Persist to localStorage
- "Full preview" button passes `?assessment=<selected-id>` through

### Small edit to `sample-data.ts`

`PreviewEntity` gains an optional `pompScore?: number`. `scoreEntities()` uses it when present; otherwise falls back to the current `PREVIEW_SCORES[i % length]` array. Back-compat for any other caller.

## Server Actions

Both live in `src/app/actions/reports.ts` (or split to `preview-data.ts` if file bloats):

- `listAssessmentsForPreview()` → `{ id, title, scoringLevel }[]`
- `getPreviewEntitiesForAssessment(assessmentId)` → `PreviewEntity[]` with real `pompScore` from the seeded session, following the assessment's entity scope (factor/construct level)

Both require platform admin / template editor auth (match existing `ensureReportTemplateLibraryAccess`).

## Migrations

1. **Schema-ish migration** — `supabase/migrations/{ts}_preview_sample_client.sql`:
   - Inserts the Sample Data client row if not present (idempotent upsert by UUID)
   - No schema changes

2. **Data migration** (applied via MCP, not committed as a `.sql` file because it invokes JS seeding logic):
   - After deployment, call `seedAssessmentPreview` for:
     - `9fac1ea2-d0c6-4127-8861-4774e1c38ce0` (AI Capability Index)
     - `f231ebc1-b7e1-49e7-b103-0bee6ca6296c` (Trajectas Personality Index)
   - Alternative: if we need this to be purely SQL-based, port `synthScore` + rollup logic into a PL/pgSQL function and run from migration. Simpler to do it from TS via a one-shot admin server action invoked once post-deploy.

**Chosen approach:** one-shot admin server action `backfillAllPreviewSeeds()` that iterates active assessments and calls `seedAssessmentPreview`. Run manually once after the feature deploys.

## File Impact

| File | Change | Risk |
|---|---|---|
| `src/lib/sample-data/score-synth.ts` | New — deterministic score function | Low |
| `src/lib/sample-data/seed-preview.ts` | New — seeding module | Low |
| `src/lib/reports/sample-data.ts` | Add optional `pompScore` to `PreviewEntity`; use it when present | Low |
| `src/app/actions/assessments.ts` | Call `seedAssessmentPreview` after create/update (try/catch, non-blocking) | Low |
| `src/app/actions/reports.ts` | Add `listAssessmentsForPreview`, `getPreviewEntitiesForAssessment`, `backfillAllPreviewSeeds` | Low |
| `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx` | Dropdown in preview panel, wire fetch, `?assessment=` on Full preview button | Medium |
| `src/app/(dashboard)/report-templates/[id]/preview/page.tsx` | Read `?assessment=`, call real runner with seeded session, fallback banner | Medium |
| `supabase/migrations/{ts}_preview_sample_client.sql` | Sample Data client row | Low |

## Testing Strategy

### Manual acceptance
- Create a new assessment → sample data client has a new campaign/session/scores; preview dropdown includes it
- Update an existing assessment's entities → seeded scores regenerate (inspect `participant_scores` timestamps)
- Switch the builder dropdown between the two assessments → entity list and scores reflect correctly
- Click "Full preview" → standalone page renders with `?assessment=` param and matches the builder preview

### Component-level
- `synthScore` determinism: same input → same output
- `synthScore` range: always returns 20–90
- `seedAssessmentPreview` idempotency: run twice → same row counts, no duplicates
- Weighted rollup: manual fixture of 3 constructs with weights (1, 2, 3) → dimension score = weighted mean

## Rollout

1. Ship the feature flag-free. The Sample Data client is invisible to end-users; platform admins see the new dropdown.
2. Post-deploy: run `backfillAllPreviewSeeds()` once via a server-action dispatch (admin-only route handler or temporary script)
3. New assessments created after deploy seed automatically via the `createAssessment` hook

## Open Questions Resolved

- **Does the builder preview use the real runner?** No — it stays on `sample-data.ts` for speed (updates every 500ms as blocks change). Only the **standalone** preview calls the real runner. The builder preview fetches real scores but runs them through the existing lightweight `generateSampleData` path.
- **What happens with deleted assessments?** The seeded campaign/participant/session stays but the assessment is soft-deleted — drop-down filters `deleted_at IS NULL`. Orphan rows are harmless.
- **What about partner-owned assessments?** The dropdown lists all active assessments regardless of partner, because the template builder is a platform-admin surface. If partner-scoped report template builders need this later, filter by partner_id.
