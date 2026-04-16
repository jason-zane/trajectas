# Flexible Taxonomy Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable constructs to relate directly to dimensions without an intermediate factor layer, controlled by a `scoring_level` enum on assessments.

**Architecture:** Parallel junction tables — new `dimension_constructs` (library), `assessment_constructs` (assessment wiring), and `campaign_assessment_constructs` (campaign selection) mirror the existing factor-path tables. A `scoring_level` column on `assessments` branches the scoring and reporting pipelines. All existing factor-level behaviour is untouched.

**Tech Stack:** Supabase/Postgres migrations, Next.js server actions, TypeScript scoring pipeline, report runner

**Spec:** `docs/superpowers/specs/2026-04-16-flexible-taxonomy-hierarchy-design.md`

---

## File Structure

### New files
- `supabase/migrations/YYYYMMDDHHMMSS_flexible_taxonomy_hierarchy.sql` — Schema migration (enum, tables, column changes, RLS, indexes)
- `src/app/actions/construct-selection.ts` — Server actions for campaign construct selection (mirrors `factor-selection.ts`)
- `src/app/actions/dimension-constructs.ts` — CRUD actions for library-level dimension-construct links

### Modified files
- `src/types/scoring.ts` — Add `DimensionConstructLink`, update `PipelineConfig` and `PipelineOutput`
- `src/lib/scoring/pipeline.ts` — Add `aggregateConstructsToDimensions()`, branch `runScoringPipeline()`
- `src/lib/scoring/ctt-session.ts` — Branch scoring path based on `scoring_level`
- `src/lib/reports/runner.ts` — Build `dimensionChildConstructs` map, branch nested score resolution
- `src/app/actions/assessments.ts` — Handle `scoring_level` in assessment CRUD
- `src/app/actions/factor-selection.ts` — Add `getConstructsForAssessment()` for construct-level assessments
- `src/types/database.ts` — Regenerate Supabase types (or manually add new table types)

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_flexible_taxonomy_hierarchy.sql`

**Context:** Read `supabase/migrations/00076_campaign_factor_selection.sql` for the pattern used by `campaign_assessment_factors`. Read `supabase/migrations/00002_taxonomy_hierarchy.sql` for `factor_constructs` shape. Read `supabase/migrations/00001_initial_schema.sql:375-390` for `assessment_competencies` (now `assessment_factors`) shape. Read `supabase/migrations/00001_initial_schema.sql:727-742` for `candidate_scores` shape.

- [ ] **Step 1: Write the migration file**

```sql
-- =============================================================================
-- Flexible taxonomy hierarchy: allow constructs to relate directly to dimensions
-- without an intermediate factor layer.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. New enum: scoring_level
-- ---------------------------------------------------------------------------
CREATE TYPE scoring_level AS ENUM ('factor', 'construct');

-- ---------------------------------------------------------------------------
-- 2. New column on assessments
-- ---------------------------------------------------------------------------
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS scoring_level scoring_level NOT NULL DEFAULT 'factor';

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS min_custom_constructs INT DEFAULT NULL;

COMMENT ON COLUMN assessments.scoring_level IS
  'Whether this assessment scores at factor level (traditional) or construct level (factors skipped).';

COMMENT ON COLUMN assessments.min_custom_constructs IS
  'Minimum constructs required for custom campaign selection. NULL = customisation not allowed. Only applies when scoring_level = construct.';

-- ---------------------------------------------------------------------------
-- 3. New table: dimension_constructs (library level)
-- ---------------------------------------------------------------------------
CREATE TABLE dimension_constructs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_id   UUID NOT NULL REFERENCES dimensions(id) ON DELETE CASCADE,
  construct_id   UUID NOT NULL REFERENCES constructs(id) ON DELETE CASCADE,
  weight         NUMERIC NOT NULL DEFAULT 1.0,
  display_order  INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dimension_constructs_unique UNIQUE (dimension_id, construct_id),
  CONSTRAINT dimension_constructs_weight_positive CHECK (weight > 0)
);

CREATE INDEX idx_dimension_constructs_dimension ON dimension_constructs(dimension_id);
CREATE INDEX idx_dimension_constructs_construct ON dimension_constructs(construct_id);

COMMENT ON TABLE dimension_constructs IS
  'Links constructs directly to dimensions with configurable weights. Parallel to factor_constructs. A construct can appear under multiple dimensions.';

-- ---------------------------------------------------------------------------
-- 4. New table: assessment_constructs (assessment level)
-- ---------------------------------------------------------------------------
CREATE TABLE assessment_constructs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  construct_id   UUID NOT NULL REFERENCES constructs(id) ON DELETE CASCADE,
  dimension_id   UUID REFERENCES dimensions(id) ON DELETE SET NULL,
  display_order  INT NOT NULL DEFAULT 0,
  weight         NUMERIC NOT NULL DEFAULT 1.0,
  min_items      INT,
  max_items      INT,
  item_count     INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT assessment_constructs_unique UNIQUE (assessment_id, construct_id),
  CONSTRAINT assessment_constructs_weight_positive CHECK (weight > 0),
  CONSTRAINT assessment_constructs_items_valid CHECK (
    (min_items IS NULL AND max_items IS NULL)
    OR (min_items IS NULL AND max_items > 0)
    OR (max_items IS NULL AND min_items > 0)
    OR (min_items > 0 AND max_items >= min_items)
  )
);

CREATE INDEX idx_assessment_constructs_assessment ON assessment_constructs(assessment_id);
CREATE INDEX idx_assessment_constructs_construct ON assessment_constructs(construct_id);
CREATE INDEX idx_assessment_constructs_dimension ON assessment_constructs(dimension_id);

COMMENT ON TABLE assessment_constructs IS
  'Links constructs to a construct-level assessment with ordering, weighting, and item-count constraints. Parallel to assessment_factors.';

-- ---------------------------------------------------------------------------
-- 5. New table: campaign_assessment_constructs (campaign level)
-- ---------------------------------------------------------------------------
CREATE TABLE campaign_assessment_constructs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_assessment_id UUID NOT NULL REFERENCES campaign_assessments(id) ON DELETE CASCADE,
  construct_id           UUID NOT NULL REFERENCES constructs(id) ON DELETE CASCADE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_campaign_assessment_construct UNIQUE (campaign_assessment_id, construct_id)
);

CREATE INDEX idx_campaign_assessment_constructs_ca
  ON campaign_assessment_constructs(campaign_assessment_id);

COMMENT ON TABLE campaign_assessment_constructs IS
  'Per-campaign construct selection. No rows = full assessment (all constructs). Rows present = custom selection of specific constructs only.';

-- ---------------------------------------------------------------------------
-- 6. Modify participant_scores (was candidate_scores, renamed in earlier migration)
-- ---------------------------------------------------------------------------

-- Make factor_id nullable (existing rows all have it set)
ALTER TABLE participant_scores
  ALTER COLUMN factor_id DROP NOT NULL;

-- Add construct_id column
ALTER TABLE participant_scores
  ADD COLUMN IF NOT EXISTS construct_id UUID REFERENCES constructs(id) ON DELETE RESTRICT;

-- Add scoring_level column
ALTER TABLE participant_scores
  ADD COLUMN IF NOT EXISTS scoring_level scoring_level NOT NULL DEFAULT 'factor';

-- Ensure exactly one of factor_id or construct_id is set
ALTER TABLE participant_scores
  ADD CONSTRAINT participant_scores_entity_check
  CHECK (
    (scoring_level = 'factor' AND factor_id IS NOT NULL AND construct_id IS NULL)
    OR (scoring_level = 'construct' AND construct_id IS NOT NULL AND factor_id IS NULL)
  );

-- Create partial unique indexes for each scoring path
CREATE UNIQUE INDEX IF NOT EXISTS participant_scores_unique_construct
  ON participant_scores(session_id, construct_id) WHERE scoring_level = 'construct';

CREATE INDEX IF NOT EXISTS idx_participant_scores_construct
  ON participant_scores(construct_id) WHERE construct_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 7. Add construct-level item selection rule columns
-- ---------------------------------------------------------------------------
ALTER TABLE item_selection_rules
  ADD COLUMN IF NOT EXISTS items_per_construct INT,
  ADD COLUMN IF NOT EXISTS total_construct_min INT,
  ADD COLUMN IF NOT EXISTS total_construct_max INT;

-- ---------------------------------------------------------------------------
-- 8. RLS policies
-- ---------------------------------------------------------------------------

-- dimension_constructs
ALTER TABLE dimension_constructs ENABLE ROW LEVEL SECURITY;

CREATE POLICY dimension_constructs_select ON dimension_constructs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY dimension_constructs_insert ON dimension_constructs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY dimension_constructs_update ON dimension_constructs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY dimension_constructs_delete ON dimension_constructs
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );

-- assessment_constructs
ALTER TABLE assessment_constructs ENABLE ROW LEVEL SECURITY;

CREATE POLICY assessment_constructs_select ON assessment_constructs
  FOR SELECT USING (true);
CREATE POLICY assessment_constructs_all_platform_admin ON assessment_constructs
  FOR ALL USING (is_platform_admin());

-- campaign_assessment_constructs
ALTER TABLE campaign_assessment_constructs ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_assessment_constructs_full_access ON campaign_assessment_constructs
  FOR ALL TO authenticated
  USING (is_platform_admin());

CREATE POLICY campaign_assessment_constructs_select ON campaign_assessment_constructs
  FOR SELECT TO authenticated
  USING (
    campaign_assessment_id IN (
      SELECT ca.id FROM campaign_assessments ca
      JOIN campaigns c ON c.id = ca.campaign_id
      WHERE c.client_id = auth_user_client_id()
         OR c.partner_id = auth_user_partner_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 9. Triggers
-- ---------------------------------------------------------------------------
-- No updated_at columns on junction tables — no triggers needed.

COMMIT;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db reset` or `npx supabase migration up`
Expected: Migration applies cleanly, no errors.

- [ ] **Step 3: Regenerate database types**

Run: `npx supabase gen types typescript --local > src/types/database.ts`
Expected: New tables (`dimension_constructs`, `assessment_constructs`, `campaign_assessment_constructs`) and new columns (`assessments.scoring_level`, `participant_scores.construct_id`, `participant_scores.scoring_level`) appear in the generated types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*flexible_taxonomy* src/types/database.ts
git commit -m "feat: add flexible taxonomy hierarchy schema — dimension_constructs, assessment_constructs, scoring_level"
```

---

## Task 2: Scoring Types

**Files:**
- Modify: `src/types/scoring.ts`

**Context:** Read `src/types/scoring.ts` for existing types. Read `src/lib/scoring/pipeline.ts:56-90` for `PipelineConfig`.

- [ ] **Step 1: Add DimensionConstructLink type**

Add after `FactorDimensionLink` (in `pipeline.ts` or `scoring.ts` depending on where it's co-located — the existing `FactorConstructLink` and `FactorDimensionLink` are in `pipeline.ts:55-66`):

In `src/lib/scoring/pipeline.ts`, add after line 66:

```typescript
/** Dimension-construct relationship with weight (for construct-level scoring). */
export interface DimensionConstructLink {
  dimensionId: string
  constructId: string
  weight: number
}
```

- [ ] **Step 2: Update PipelineConfig**

In `src/lib/scoring/pipeline.ts`, update the `PipelineConfig` interface to add:

```typescript
  /** Scoring level: 'factor' (traditional) or 'construct' (factors skipped). */
  scoringLevel?: 'factor' | 'construct'
  /** Dimension-construct links with weights (for construct-level scoring). */
  dimensionConstructLinks?: DimensionConstructLink[]
```

- [ ] **Step 3: Update PipelineOutput**

In `src/types/scoring.ts`, update the `DimensionScore` interface to support both factor and construct children:

```typescript
export interface DimensionScore {
  dimensionId: string
  dimensionName?: string
  scores: ScoreRepresentations
  /** Factor scores that contributed (factor-level scoring). */
  factorScores?: FactorScore[]
  /** Construct scores that contributed (construct-level scoring). */
  constructScores?: ConstructScore[]
}
```

Change `factorScores: FactorScore[]` to `factorScores?: FactorScore[]` (make optional).

- [ ] **Step 4: Commit**

```bash
git add src/lib/scoring/pipeline.ts src/types/scoring.ts
git commit -m "feat: add scoring types for construct-level scoring path"
```

---

## Task 3: Scoring Pipeline — Construct-to-Dimension Aggregation

**Files:**
- Modify: `src/lib/scoring/pipeline.ts`

**Context:** Read `src/lib/scoring/pipeline.ts:298-356` for `aggregateToDimensions()`. The new function follows the same pattern but aggregates construct scores instead of factor scores.

- [ ] **Step 1: Add `aggregateConstructsToDimensions()` function**

Add after `aggregateToDimensions()` (after line 356):

```typescript
// ---------------------------------------------------------------------------
// Step 4b: Weighted rollup from constructs directly to dimensions
// ---------------------------------------------------------------------------

/**
 * Compute dimension scores as weighted average of their construct scores.
 * Used when assessment.scoring_level = 'construct' (factors skipped).
 *
 * @param constructScores        - Construct-level scores.
 * @param dimensionConstructLinks - Which constructs belong to which dimensions, with weights.
 * @param dimensionNames         - Optional dimension name lookup.
 * @returns Array of dimension-level scores.
 */
export function aggregateConstructsToDimensions(
  constructScores: ConstructScore[],
  dimensionConstructLinks: DimensionConstructLink[],
  dimensionNames?: Map<string, string>,
): DimensionScore[] {
  // Index construct scores by ID
  const constructScoreMap = new Map<string, ConstructScore>()
  for (const cs of constructScores) {
    constructScoreMap.set(cs.constructId, cs)
  }

  // Group links by dimension
  const linksByDimension = new Map<string, DimensionConstructLink[]>()
  for (const link of dimensionConstructLinks) {
    const existing = linksByDimension.get(link.dimensionId)
    if (existing) {
      existing.push(link)
    } else {
      linksByDimension.set(link.dimensionId, [link])
    }
  }

  const results: DimensionScore[] = []

  for (const [dimensionId, links] of linksByDimension) {
    let weightedSum = 0
    let totalWeight = 0
    const childConstructScores: ConstructScore[] = []

    for (const link of links) {
      const cs = constructScoreMap.get(link.constructId)
      if (!cs) continue

      weightedSum += cs.scores.pomp * link.weight
      totalWeight += link.weight
      childConstructScores.push(cs)
    }

    if (totalWeight === 0) continue

    const meanPomp = weightedSum / totalWeight

    const scores: ScoreRepresentations = {
      raw: 0,
      rawMax: 0,
      pomp: meanPomp,
    }

    results.push({
      dimensionId,
      dimensionName: dimensionNames?.get(dimensionId),
      scores,
      constructScores: childConstructScores,
    })
  }

  return results
}
```

- [ ] **Step 2: Branch `runScoringPipeline()` based on `scoringLevel`**

Replace the current steps 3–4 block in `runScoringPipeline()` (lines 384-404) with:

```typescript
  let factorScores: FactorScore[] = []
  let dimensionScores: DimensionScore[] = []

  if (config.scoringLevel === 'construct') {
    // Construct-level: skip factors, roll up constructs → dimensions
    dimensionScores = aggregateConstructsToDimensions(
      constructScores,
      config.dimensionConstructLinks ?? [],
      config.dimensionNames,
    )
  } else {
    // Factor-level (default): constructs → factors → dimensions
    factorScores = aggregateToFactors(
      constructScores,
      config.factorConstructLinks,
      config.factorNames,
      config.scoringMethod,
    )

    dimensionScores = aggregateToDimensions(
      factorScores,
      config.factorDimensionLinks,
      config.dimensionNames,
    )
  }

  return {
    sessionId: config.sessionId,
    assessmentId: config.assessmentId,
    constructScores,
    factorScores,
    dimensionScores,
    scoringMethod: config.scoringMethod,
    scoredAt: new Date().toISOString(),
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring/pipeline.ts
git commit -m "feat: add construct-to-dimension aggregation in scoring pipeline"
```

---

## Task 4: CTT Session Scorer — Construct-Level Path

**Files:**
- Modify: `src/lib/scoring/ctt-session.ts`

**Context:** Read `src/lib/scoring/ctt-session.ts` in full. The current flow is: load assessment_factors → load factor_constructs → score items → roll up to factors → upsert participant_scores with factor_id. The construct-level path: load assessment_constructs → score items → upsert participant_scores with construct_id.

- [ ] **Step 1: Fetch `scoring_level` from assessment**

At line 51, update the select to include `scoring_level`:

```typescript
  const { data: session, error: sessionErr } = await db
    .from('participant_sessions')
    .select('assessment_id, assessments(scoring_level)')
    .eq('id', sessionId)
    .single()
```

Extract the scoring level:

```typescript
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoringLevel = ((session as any).assessments as any)?.scoring_level ?? 'factor'
```

- [ ] **Step 2: Add construct-level scoring branch**

After step 6 (construct score computation, around line 167), add the construct-level branch:

```typescript
  if (scoringLevel === 'construct') {
    // Construct-level: load assessment_constructs and write construct scores directly
    const { data: assessmentConstructs } = await db
      .from('assessment_constructs')
      .select('construct_id')
      .eq('assessment_id', session.assessment_id)

    const assessmentConstructIds = new Set(
      (assessmentConstructs ?? []).map((ac) => ac.construct_id)
    )

    // Check for campaign-level construct selection
    const { data: campaignAssessment } = await db
      .from('campaign_assessments')
      .select('id')
      .eq('campaign_id', /* need campaign_id from session */)
      .eq('assessment_id', session.assessment_id)
      .maybeSingle()

    // Filter to assessment constructs only
    const scorableConstructIds = [...constructScores.keys()].filter(
      (id) => assessmentConstructIds.has(id)
    )

    if (scorableConstructIds.length === 0) {
      return { error: 'No construct scores could be calculated for this assessment' }
    }

    const scoreRows = scorableConstructIds.map((constructId) => ({
      session_id: sessionId,
      construct_id: constructId,
      factor_id: null,
      raw_score: constructScores.get(constructId)!,
      scaled_score: constructScores.get(constructId)!,
      scoring_method: 'ctt',
      scoring_level: 'construct',
    }))

    const { error: upsertErr } = await db
      .from('participant_scores')
      .upsert(scoreRows, { onConflict: 'session_id,construct_id' })

    if (upsertErr) return { error: upsertErr.message }

    return { success: true, scoreCount: scoreRows.length }
  }
```

- [ ] **Step 3: Ensure existing factor path sets `scoring_level: 'factor'`**

Update the existing factor score row mapping (around line 216) to include `scoring_level`:

```typescript
  const scoreRows = factorScores.map((fs) => ({
    session_id: sessionId,
    factor_id: fs.factorId,
    construct_id: null,
    raw_score: fs.rawScore,
    scaled_score: fs.scaledScore,
    scoring_method: 'ctt',
    scoring_level: 'factor',
  }))
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/scoring/ctt-session.ts
git commit -m "feat: branch CTT session scorer for construct-level assessments"
```

---

## Task 5: Report Runner — Construct-Level Support

**Files:**
- Modify: `src/lib/reports/runner.ts`

**Context:** Read `src/lib/reports/runner.ts:140-195` for the dimension score computation and `dimensionChildFactors` map building. Read lines `467-477` for the `resolveBlockData` signature. Read lines `496-640` for score_detail resolution. Read lines `576-622` for nested score resolution.

- [ ] **Step 1: Build `dimensionChildConstructs` map alongside `dimensionChildFactors`**

After the `dimensionChildFactors` block (around line 170), add:

```typescript
    // Build dimension → child construct IDs map for construct-level assessments.
    // Uses assessment_constructs.dimension_id to determine grouping.
    const dimensionChildConstructs = new Map<string, string[]>()

    // Determine scoring level from the assessment
    const { data: assessmentMeta } = await db
      .from('assessments')
      .select('scoring_level')
      .eq('id', sessionData.assessmentId)
      .single()

    const scoringLevel = assessmentMeta?.scoring_level ?? 'factor'

    if (scoringLevel === 'construct') {
      const { data: acRows } = await db
        .from('assessment_constructs')
        .select('construct_id, dimension_id')
        .eq('assessment_id', sessionData.assessmentId)

      for (const row of acRows ?? []) {
        if (!row.dimension_id) continue
        const dimId = String(row.dimension_id)
        const list = dimensionChildConstructs.get(dimId) ?? []
        list.push(String(row.construct_id))
        dimensionChildConstructs.set(dimId, list)
      }

      // Fetch any dimensions referenced by assessment_constructs but not in taxonomyMap
      const missingConstructDimIds = [...dimensionChildConstructs.keys()].filter(
        (id) => !taxonomyMap.has(id)
      )
      if (missingConstructDimIds.length > 0) {
        const extraDims = await fetchTaxonomyEntities(db as any, missingConstructDimIds)
        for (const [id, entity] of extraDims) {
          taxonomyMap.set(id, entity)
        }
      }

      // Compute dimension scores from construct scores
      for (const [dimId, constructIds] of dimensionChildConstructs) {
        if (scoreMap[dimId] !== undefined) continue
        const childScores = constructIds
          .map((cId) => scoreMap[cId])
          .filter((s): s is number => s !== undefined)
        if (childScores.length > 0) {
          scoreMap[dimId] = childScores.reduce((a, b) => a + b, 0) / childScores.length
        }
      }
    }
```

- [ ] **Step 2: Pass `dimensionChildConstructs` and `scoringLevel` to `resolveBlockData`**

Update the `resolveBlockData` call (around line 250) to include the new parameters:

```typescript
      const data = await resolveBlockData(
        block,
        scoreMap,
        taxonomyMap,
        template.personReference,
        template.displayLevel,
        sessionData,
        snapshot.narrativeMode === 'ai_enhanced',
        dimensionChildFactors,
        dimensionChildConstructs,
        scoringLevel,
      )
```

Update the `resolveBlockData` signature to accept the new parameters:

```typescript
async function resolveBlockData(
  block: BlockConfig,
  scoreMap: ScoreMap,
  taxonomyMap: Map<string, any>,
  personReference: PersonReferenceType,
  _templateDisplayLevel: ReportDisplayLevel,
  session: SessionData,
  aiEnhance: boolean,
  dimensionChildFactors: Map<string, string[]>,
  dimensionChildConstructs: Map<string, string[]>,
  scoringLevel: string,
): Promise<Record<string, unknown>> {
```

- [ ] **Step 3: Branch nested score resolution in score_detail**

In the score_detail block resolution (around line 576), update the nested scores logic:

```typescript
      // Build nested scores for dimensions
      if (config.showNestedScores && entity._taxonomy_level === 'dimension') {
        const childIds = scoringLevel === 'construct'
          ? (dimensionChildConstructs.get(entityId) ?? [])
          : (dimensionChildFactors.get(entityId) ?? [])

        // ... rest of nested score building uses childIds instead of childFactorIds
      }
```

- [ ] **Step 4: Branch parentName resolution in score_overview**

In the score_overview resolution (around line 644), update `parentName`:

```typescript
      // For construct-level scoring, resolve parentName from assessment_constructs.dimension_id
      const parentName =
        scoringLevel === 'construct' && entity?._taxonomy_level === 'construct'
          ? (() => {
              // Find which dimension this construct belongs to
              for (const [dimId, constructIds] of dimensionChildConstructs) {
                if (constructIds.includes(entityId)) {
                  return taxonomyMap.get(dimId)?.name ?? ''
                }
              }
              return ''
            })()
          : entity?._taxonomy_level === 'factor' && entity?.dimension_id
            ? (taxonomyMap.get(String(entity.dimension_id))?.name ?? '')
            : ''
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/runner.ts
git commit -m "feat: support construct-level scoring in report runner"
```

---

## Task 6: Library CRUD — Dimension-Construct Links

**Files:**
- Create: `src/app/actions/dimension-constructs.ts`

**Context:** Read `src/app/actions/factors.ts` for the pattern used by factor CRUD. Read `src/app/actions/factor-selection.ts` for the factor-construct link management pattern.

- [ ] **Step 1: Create dimension-constructs server actions**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requirePlatformAdmin } from '@/lib/auth/authorization'
import { revalidatePath } from 'next/cache'
import { throwActionError } from '@/lib/security/action-errors'

/**
 * Get all construct links for a dimension.
 */
export async function getDimensionConstructs(dimensionId: string) {
  const db = createAdminClient()

  const { data, error } = await db
    .from('dimension_constructs')
    .select('id, construct_id, weight, display_order, constructs(id, name, slug)')
    .eq('dimension_id', dimensionId)
    .order('display_order')

  if (error) {
    throwActionError('getDimensionConstructs', 'Failed to load dimension constructs.', error)
  }

  return data ?? []
}

/**
 * Get all dimension links for a construct.
 */
export async function getConstructDimensions(constructId: string) {
  const db = createAdminClient()

  const { data, error } = await db
    .from('dimension_constructs')
    .select('id, dimension_id, weight, display_order, dimensions(id, name, slug)')
    .eq('construct_id', constructId)
    .order('display_order')

  if (error) {
    throwActionError('getConstructDimensions', 'Failed to load construct dimensions.', error)
  }

  return data ?? []
}

/**
 * Link a construct to a dimension.
 */
export async function linkConstructToDimension(
  dimensionId: string,
  constructId: string,
  weight: number = 1.0,
  displayOrder: number = 0,
) {
  await requirePlatformAdmin()
  const db = createAdminClient()

  const { error } = await db
    .from('dimension_constructs')
    .upsert(
      { dimension_id: dimensionId, construct_id: constructId, weight, display_order: displayOrder },
      { onConflict: 'dimension_id,construct_id' },
    )

  if (error) {
    throwActionError('linkConstructToDimension', 'Failed to link construct to dimension.', error)
  }

  revalidatePath('/dimensions')
  revalidatePath('/constructs')
}

/**
 * Unlink a construct from a dimension.
 */
export async function unlinkConstructFromDimension(dimensionId: string, constructId: string) {
  await requirePlatformAdmin()
  const db = createAdminClient()

  const { error } = await db
    .from('dimension_constructs')
    .delete()
    .eq('dimension_id', dimensionId)
    .eq('construct_id', constructId)

  if (error) {
    throwActionError('unlinkConstructFromDimension', 'Failed to unlink construct.', error)
  }

  revalidatePath('/dimensions')
  revalidatePath('/constructs')
}

/**
 * Update weight/order of a dimension-construct link.
 */
export async function updateDimensionConstructLink(
  linkId: string,
  updates: { weight?: number; display_order?: number },
) {
  await requirePlatformAdmin()
  const db = createAdminClient()

  const { error } = await db
    .from('dimension_constructs')
    .update(updates)
    .eq('id', linkId)

  if (error) {
    throwActionError('updateDimensionConstructLink', 'Failed to update link.', error)
  }

  revalidatePath('/dimensions')
  revalidatePath('/constructs')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/dimension-constructs.ts
git commit -m "feat: add CRUD server actions for dimension-construct links"
```

---

## Task 7: Campaign Construct Selection Actions

**Files:**
- Create: `src/app/actions/construct-selection.ts`

**Context:** Read `src/app/actions/factor-selection.ts` in full — the new file mirrors it exactly but for constructs.

- [ ] **Step 1: Create construct-selection server actions**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCampaignAccess } from '@/lib/auth/authorization'
import { revalidatePath } from 'next/cache'
import { throwActionError } from '@/lib/security/action-errors'

/**
 * Get construct selection for a campaign-assessment.
 */
export async function getConstructSelectionForCampaignAssessment(
  campaignAssessmentId: string,
): Promise<{ isCustom: boolean; selectedConstructIds: string[] }> {
  const db = await createClient()
  const { data } = await db
    .from('campaign_assessment_constructs')
    .select('construct_id')
    .eq('campaign_assessment_id', campaignAssessmentId)

  if (!data || data.length === 0) {
    return { isCustom: false, selectedConstructIds: [] }
  }

  return {
    isCustom: true,
    selectedConstructIds: data.map((r) => r.construct_id),
  }
}

/**
 * Get constructs for a construct-level assessment, grouped by dimension.
 */
export async function getConstructsForAssessment(assessmentId: string): Promise<
  Array<{
    dimensionId: string | null
    dimensionName: string | null
    constructs: Array<{
      constructId: string
      constructName: string
      constructDescription: string | null
    }>
  }>
> {
  const db = await createClient()

  const { data: acRows, error: acError } = await db
    .from('assessment_constructs')
    .select('construct_id, dimension_id')
    .eq('assessment_id', assessmentId)

  if (acError) {
    throwActionError('getConstructsForAssessment', 'Failed to load assessment constructs.', acError)
  }

  const constructIds = (acRows ?? []).map((r) => r.construct_id)
  if (constructIds.length === 0) return []

  const { data: constructRows, error: constructError } = await db
    .from('constructs')
    .select('id, name, description')
    .in('id', constructIds)
    .is('deleted_at', null)
    .order('name')

  if (constructError) {
    throwActionError('getConstructsForAssessment', 'Failed to load constructs.', constructError)
  }

  // Build dimension ID → construct mapping from assessment_constructs
  const dimensionMap = new Map<string, string>()
  for (const row of acRows ?? []) {
    if (row.dimension_id) {
      dimensionMap.set(row.construct_id, row.dimension_id)
    }
  }

  // Load dimension names
  const dimIds = [...new Set(dimensionMap.values())]
  const { data: dimRows } = dimIds.length > 0
    ? await db.from('dimensions').select('id, name').in('id', dimIds)
    : { data: [] }

  const dimNameMap = new Map<string, string>()
  for (const d of dimRows ?? []) {
    dimNameMap.set(d.id, d.name)
  }

  // Group by dimension
  const grouped = new Map<string, {
    dimensionId: string | null
    dimensionName: string | null
    constructs: Array<{
      constructId: string
      constructName: string
      constructDescription: string | null
    }>
  }>()

  for (const row of constructRows ?? []) {
    const dimId = dimensionMap.get(row.id) ?? null
    const dimKey = dimId ?? '__none__'

    if (!grouped.has(dimKey)) {
      grouped.set(dimKey, {
        dimensionId: dimId,
        dimensionName: dimId ? (dimNameMap.get(dimId) ?? null) : null,
        constructs: [],
      })
    }

    grouped.get(dimKey)!.constructs.push({
      constructId: row.id,
      constructName: row.name,
      constructDescription: row.description ?? null,
    })
  }

  return Array.from(grouped.values())
}

/**
 * Save construct selection for a campaign-assessment.
 */
export async function saveConstructSelection(
  campaignAssessmentId: string,
  constructIds: string[],
): Promise<{ success: true }> {
  const admin = createAdminClient()
  const { data: ca, error: caError } = await admin
    .from('campaign_assessments')
    .select('campaign_id, assessment_id')
    .eq('id', campaignAssessmentId)
    .single()

  if (caError || !ca) {
    throwActionError('saveConstructSelection', 'Campaign assessment not found.', caError)
  }

  await requireCampaignAccess(ca.campaign_id)

  const { data: assessment, error: assessmentError } = await admin
    .from('assessments')
    .select('min_custom_constructs, scoring_level')
    .eq('id', ca.assessment_id)
    .single()

  if (assessmentError || !assessment) {
    throwActionError('saveConstructSelection', 'Assessment not found.', assessmentError)
  }

  if (assessment.scoring_level !== 'construct') {
    throw new Error('This assessment does not use construct-level scoring.')
  }

  const minConstructs = assessment.min_custom_constructs
  if (minConstructs == null) {
    throw new Error('This assessment does not support construct customisation.')
  }

  if (constructIds.length < minConstructs) {
    throw new Error(
      `At least ${minConstructs} construct${minConstructs === 1 ? '' : 's'} must be selected.`,
    )
  }

  // Verify all constructIds are valid assessment_constructs for this assessment
  const { data: validConstructs, error: vcError } = await admin
    .from('assessment_constructs')
    .select('construct_id')
    .eq('assessment_id', ca.assessment_id)
    .in('construct_id', constructIds)

  if (vcError) {
    throwActionError('saveConstructSelection', 'Failed to validate constructs.', vcError)
  }

  const validConstructIds = new Set((validConstructs ?? []).map((r) => r.construct_id))
  const invalid = constructIds.filter((id) => !validConstructIds.has(id))
  if (invalid.length > 0) {
    throw new Error(`Invalid construct IDs: ${invalid.join(', ')}`)
  }

  // Delete existing + insert new rows
  const { error: deleteError } = await admin
    .from('campaign_assessment_constructs')
    .delete()
    .eq('campaign_assessment_id', campaignAssessmentId)

  if (deleteError) {
    throwActionError('saveConstructSelection', 'Failed to clear existing selection.', deleteError)
  }

  const inserts = constructIds.map((constructId) => ({
    campaign_assessment_id: campaignAssessmentId,
    construct_id: constructId,
  }))

  const { error: insertError } = await admin
    .from('campaign_assessment_constructs')
    .insert(inserts)

  if (insertError) {
    throwActionError('saveConstructSelection', 'Failed to save construct selection.', insertError)
  }

  revalidatePath(`/campaigns`)
  return { success: true }
}

/**
 * Clear construct selection for a campaign-assessment.
 */
export async function clearConstructSelection(
  campaignAssessmentId: string,
): Promise<{ success: true }> {
  const admin = createAdminClient()

  const { data: ca, error: caError } = await admin
    .from('campaign_assessments')
    .select('campaign_id')
    .eq('id', campaignAssessmentId)
    .single()

  if (caError || !ca) {
    throwActionError('clearConstructSelection', 'Campaign assessment not found.', caError)
  }

  await requireCampaignAccess(ca.campaign_id)

  const { error: deleteError } = await admin
    .from('campaign_assessment_constructs')
    .delete()
    .eq('campaign_assessment_id', campaignAssessmentId)

  if (deleteError) {
    throwActionError('clearConstructSelection', 'Failed to clear construct selection.', deleteError)
  }

  revalidatePath(`/campaigns`)
  return { success: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/construct-selection.ts
git commit -m "feat: add campaign construct selection server actions"
```

---

## Task 8: Assessment Runner — Construct-Level Item Loading

**Files:**
- Modify: `src/app/actions/assess.ts`

**Context:** Read `src/app/actions/assess.ts:370-412` for the current factor-based item loading in the assessment runner. This is where items are fetched via `assessment_factors → factor_constructs → items`. The construct-level path fetches via `assessment_constructs → items.construct_id`.

- [ ] **Step 1: Fetch scoring_level alongside assessment data**

Update the assessment query (around line 372) to include `scoring_level`:

```typescript
      db
        .from('assessments')
        .select('scoring_level')
        .eq('id', session.assessment_id)
        .single(),
```

- [ ] **Step 2: Add construct-level item loading branch**

After the existing factor-based loading, add:

```typescript
    if (assessmentData?.scoring_level === 'construct') {
      // Construct-level: load assessment_constructs, then items by construct_id
      const { data: acRows } = await db
        .from('assessment_constructs')
        .select('construct_id')
        .eq('assessment_id', session.assessment_id)

      let constructIds = (acRows ?? []).map((r) => r.construct_id)

      // Apply campaign-level construct selection if custom
      if (campaignAssessment) {
        const { data: customConstructs } = await db
          .from('campaign_assessment_constructs')
          .select('construct_id')
          .eq('campaign_assessment_id', campaignAssessment.id)

        if (customConstructs && customConstructs.length > 0) {
          const customSet = new Set(customConstructs.map((r) => r.construct_id))
          constructIds = constructIds.filter((id) => customSet.has(id))
        }
      }

      // Load items belonging to these constructs
      // ... fetch items where construct_id IN constructIds
    }
```

The exact implementation depends on how the rest of the assess.ts function structures item loading. The key change is replacing the `assessment_factors → factor_constructs` join chain with `assessment_constructs → items.construct_id`.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/assess.ts
git commit -m "feat: add construct-level item loading in assessment runner"
```

---

## Task 9: Assessment CRUD — Scoring Level Support

**Files:**
- Modify: `src/app/actions/assessments.ts`

**Context:** Read `src/app/actions/assessments.ts` for the current assessment create/update logic.

- [ ] **Step 1: Add `scoring_level` to assessment create/update**

In the assessment creation action, include `scoring_level` in the insert:

```typescript
  scoring_level: data.scoringLevel ?? 'factor',
  min_custom_constructs: data.scoringLevel === 'construct' ? data.minCustomConstructs : null,
```

In the assessment update action, include:

```typescript
  scoring_level: data.scoringLevel,
  min_custom_constructs: data.scoringLevel === 'construct' ? data.minCustomConstructs : null,
```

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/assessments.ts
git commit -m "feat: support scoring_level in assessment CRUD"
```

---

## Task 10: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify migration applies to remote**

Run: `npx supabase db push --dry-run`
Expected: Shows the migration will be applied, no conflicts.

- [ ] **Step 2: Verify existing factor-level assessments are unaffected**

Run the app locally, navigate to an existing assessment and campaign. Verify:
- Assessment displays correctly
- Campaign factor selection still works
- Scoring produces the same results (if test data exists)
- Reports render correctly

- [ ] **Step 3: Verify construct-level path (manual)**

Using the Supabase dashboard or SQL:
1. Create a test assessment with `scoring_level = 'construct'`
2. Add rows to `dimension_constructs` linking test constructs to a dimension
3. Add rows to `assessment_constructs` referencing those constructs
4. Verify the scoring pipeline handles it (or at minimum, doesn't error for factor-level assessments)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration verification fixes for flexible taxonomy"
```
