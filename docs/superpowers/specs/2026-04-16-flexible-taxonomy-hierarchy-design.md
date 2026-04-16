# Flexible Taxonomy Hierarchy Design

## Problem

The current data model enforces a rigid dimension → factor → construct hierarchy. Constructs can only reach a dimension through a factor (via `factor_constructs`). This prevents assessments that measure constructs directly under dimensions without an intermediate factor layer — a common need when factors aren't psychometrically justified or when a simpler measurement model is appropriate.

## Goals

1. Allow constructs to relate directly to dimensions at the library level (many-to-many, like `factor_constructs`)
2. Allow assessments to operate at either factor level or construct level — not a mix within a single assessment
3. Preserve all existing factor-level behaviour unchanged
4. Reporting and scoring automatically adapt based on which level the assessment uses
5. Campaign-level selection works for both factor-level and construct-level assessments

## Non-Goals

- Mixed scoring levels within a single assessment (some dimensions with factors, others with direct constructs)
- Removing or deprecating the factor layer
- Changing the item → construct rollup (this stays the same regardless of scoring level)

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Architecture | Parallel junction tables (Approach A) | Clean separation, no existing tables modified, FK constraints preserved |
| Library-level link | `dimension_constructs` junction table | Mirrors `factor_constructs`; supports many-to-many |
| Assessment-level control | `scoring_level` enum on `assessments` | Explicit toggle, default `'factor'` preserves all existing assessments |
| Assessment construct wiring | `assessment_constructs` table with `dimension_id` | Mirrors `assessment_factors`; dimension_id groups constructs for reporting |
| Campaign selection | `campaign_assessment_constructs` table | Mirrors `campaign_assessment_factors`; same "no rows = all, rows = custom" pattern |
| Candidate scores | Make `factor_id` nullable, add `construct_id` column | Both paths write to the same table; CHECK ensures exactly one is set |
| Dimension scores | Computed on read (weighted average of children) | Avoids duplication; children are factors or constructs depending on scoring level |

## Schema Changes

### New enum type

```sql
CREATE TYPE scoring_level AS ENUM ('factor', 'construct');
```

### New column on `assessments`

```sql
ALTER TABLE assessments
  ADD COLUMN scoring_level scoring_level NOT NULL DEFAULT 'factor';

ALTER TABLE assessments
  ADD COLUMN min_custom_constructs INT DEFAULT NULL;

COMMENT ON COLUMN assessments.scoring_level IS
  'Whether this assessment scores at factor level (traditional) or construct level (factors skipped).';

COMMENT ON COLUMN assessments.min_custom_constructs IS
  'Minimum constructs required for custom campaign selection. NULL = customisation not allowed. Only applies when scoring_level = construct.';
```

### New table: `dimension_constructs` (library level)

```sql
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
```

This mirrors `factor_constructs` exactly. A construct can belong to multiple dimensions.

### New table: `assessment_constructs` (assessment level)

```sql
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
```

Mirrors `assessment_factors`. The `dimension_id` column tells the system which dimension this construct groups under for reporting and score aggregation. Nullable for ungrouped constructs.

### New table: `campaign_assessment_constructs` (campaign level)

```sql
CREATE TABLE campaign_assessment_constructs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_assessment_id UUID NOT NULL REFERENCES campaign_assessments(id) ON DELETE CASCADE,
  construct_id           UUID NOT NULL REFERENCES constructs(id) ON DELETE CASCADE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_campaign_assessment_construct UNIQUE (campaign_assessment_id, construct_id)
);

CREATE INDEX idx_campaign_assessment_constructs_ca
  ON campaign_assessment_constructs(campaign_assessment_id);
```

Same semantics as `campaign_assessment_factors`: no rows = full assessment (all constructs), rows present = custom selection.

### Modifications to `candidate_scores`

```sql
-- Make factor_id nullable (was NOT NULL)
ALTER TABLE candidate_scores
  ALTER COLUMN factor_id DROP NOT NULL;

-- Add construct_id column
ALTER TABLE candidate_scores
  ADD COLUMN construct_id UUID REFERENCES constructs(id) ON DELETE RESTRICT;

-- Add scoring_level column
ALTER TABLE candidate_scores
  ADD COLUMN scoring_level scoring_level NOT NULL DEFAULT 'factor';

-- Ensure exactly one of factor_id or construct_id is set
ALTER TABLE candidate_scores
  ADD CONSTRAINT candidate_scores_entity_check
  CHECK (
    (scoring_level = 'factor' AND factor_id IS NOT NULL AND construct_id IS NULL)
    OR (scoring_level = 'construct' AND construct_id IS NOT NULL AND factor_id IS NULL)
  );

-- Update unique constraint
ALTER TABLE candidate_scores
  DROP CONSTRAINT candidate_scores_unique;

ALTER TABLE candidate_scores
  ADD CONSTRAINT candidate_scores_unique_factor
  UNIQUE (session_id, factor_id) WHERE scoring_level = 'factor';

-- Note: partial unique indexes instead of table-level constraints
CREATE UNIQUE INDEX candidate_scores_unique_construct
  ON candidate_scores(session_id, construct_id) WHERE scoring_level = 'construct';

CREATE INDEX idx_candidate_scores_construct ON candidate_scores(construct_id);
```

### Modifications to `item_selection_rules`

```sql
ALTER TABLE item_selection_rules
  ADD COLUMN items_per_construct INT,
  ADD COLUMN total_construct_min INT,
  ADD COLUMN total_construct_max INT;
```

### RLS policies

All new tables follow the same pattern as their parallel tables:
- `dimension_constructs`: same as `factor_constructs` (all authenticated read, platform_admin write)
- `assessment_constructs`: same as `assessment_factors` (all read, platform_admin write)
- `campaign_assessment_constructs`: same as `campaign_assessment_factors` (platform_admin full, campaign owner/partner read)

## Scoring Pipeline Changes

### Branch point

All scoring modules (`ctt-session.ts`, `irt/index.ts`, `adaptive/index.ts`, `rule-based.ts`) currently follow:

```
items → construct scores → factor scores (via factor_constructs weights) → dimension scores
```

The change adds a branch after construct scores are computed:

```
items → construct scores → [check assessment.scoring_level]
  → 'factor':    factor scores (via factor_constructs) → dimension scores
  → 'construct': dimension scores (via dimension_constructs/assessment_constructs weights)
```

### Item → construct rollup

**No change.** Items always belong to a construct (`items.construct_id`). The rollup from item responses to construct-level scores is identical regardless of scoring level.

### Construct → dimension rollup (new path)

When `scoring_level = 'construct'`:
1. Fetch `assessment_constructs` rows for this assessment (filtered by `campaign_assessment_constructs` if custom selection exists)
2. Group constructs by `dimension_id`
3. For each dimension: compute weighted average of child construct scores using `dimension_constructs.weight` (or `assessment_constructs.weight`)
4. Write construct-level scores to `candidate_scores` with `scoring_level='construct'`, `construct_id` set, `factor_id` null

### candidate_scores writes

| Scoring level | `factor_id` | `construct_id` | `scoring_level` |
|---|---|---|---|
| Factor (existing) | Set | NULL | `'factor'` |
| Construct (new) | NULL | Set | `'construct'` |

## Assessment Runner RPC Changes

The `assessment_runner` RPC currently fetches items through:
```
assessment_factors → factor_constructs → items
```

For construct-level assessments:
```
assessment_constructs → items (via items.construct_id)
```

The RPC checks `assessment.scoring_level` and follows the appropriate join path. Campaign-level filtering uses `campaign_assessment_constructs` instead of `campaign_assessment_factors`.

## Report Runner Changes

### `fetchTaxonomyEntities()`

No change needed. Already fetches all dimensions, factors, and constructs and annotates each with `_taxonomy_level`.

### `filterScoredEntities()`

No change needed. Already filters by `_taxonomy_level` — will correctly handle construct-level scores when `displayLevel='construct'`.

### `resolveBlockData()` — score_detail

Current behaviour: builds `nestedScores` only when `entity._taxonomy_level === 'dimension'`, looking up child factors via `dimensionChildFactors` map.

Change:
- Build a `dimensionChildConstructs` map from `assessment_constructs` where `dimension_id` is set
- When resolving nested scores for a dimension:
  - If assessment is factor-level → use `dimensionChildFactors` (existing)
  - If assessment is construct-level → use `dimensionChildConstructs` (new)
- The `nestedLabel` config already supports custom labels ("Factors", "Constructs")

### `resolveBlockData()` — score_overview

Current behaviour: resolves `parentName` from `factor.dimension_id` in the taxonomy map.

Change:
- For construct-level scores: resolve `parentName` from `assessment_constructs.dimension_id`
- `groupByParent()` in the component works unchanged

### Strengths, development plan, norm comparison

No changes. These resolvers already filter by `_taxonomy_level` and work with any entity type.

## Report Component Changes

**None.** All report components are hierarchy-agnostic:
- `score_detail.tsx` renders whatever `nestedScores[]` the runner provides
- `score_overview.tsx` groups by `parentName` regardless of entity type
- `strengths_highlights.tsx` and `development_plan.tsx` receive pre-filtered entity lists
- Band resolution works on any entity with POMP thresholds

## UI Changes

### Taxonomy Library

New "Dimension Constructs" management:
- Ability to link constructs directly to dimensions (same UX as linking constructs to factors)
- Accessible from dimension detail page and construct detail page
- Weight and display order configuration per link

### Assessment Builder

- New `scoring_level` toggle on assessment setup: "Score at factor level" / "Score at construct level"
- When construct-level is selected:
  - Factor picker is hidden
  - Construct picker is shown, grouped by dimension (using `dimension_constructs`)
  - `assessment_constructs` rows are created instead of `assessment_factors`
  - `min_custom_constructs` field becomes available

### Campaign Builder

- When the linked assessment has `scoring_level = 'construct'`:
  - Factor selection step switches to construct selection
  - Uses `campaign_assessment_constructs` instead of `campaign_assessment_factors`
  - Same "all or custom" UX pattern

## Migration Safety

### Zero breaking changes to existing data

- `scoring_level` defaults to `'factor'` — all existing assessments unchanged
- `candidate_scores.factor_id` becomes nullable but all existing rows have it set
- New CHECK constraint on `candidate_scores` is satisfied by all existing rows (they all have `scoring_level='factor'`, `factor_id` set, `construct_id` null)
- New tables start empty — no data migration needed
- No existing tables are renamed, dropped, or restructured

### Validation constraints

- `candidate_scores`: CHECK ensures exactly one of `factor_id` or `construct_id` is set, matching `scoring_level`
- `assessment_constructs`: should only have rows when `assessment.scoring_level = 'construct'` (enforced at application level, not DB constraint, to allow migration flexibility)
- `assessment_factors`: should only have rows when `assessment.scoring_level = 'factor'` (same — application-level enforcement)

## Hierarchy Traversal Logic

### Upward traversal (construct → parent)

```
get_parent(construct, assessment):
  if assessment.scoring_level = 'factor':
    return factor_constructs → factor → factor.dimension_id → dimension
  if assessment.scoring_level = 'construct':
    return assessment_constructs.dimension_id → dimension
```

### Downward traversal (dimension → children)

```
get_children(dimension, assessment):
  if assessment.scoring_level = 'factor':
    return factors WHERE dimension_id = dimension.id
      → each factor's constructs via factor_constructs
  if assessment.scoring_level = 'construct':
    return assessment_constructs WHERE dimension_id = dimension.id
```

### Aggregation (dimension score)

```
aggregate_dimension_score(dimension, assessment, scores):
  if assessment.scoring_level = 'factor':
    children = assessment_factors WHERE factor.dimension_id = dimension.id
    return weighted_average(children.map(f => scores[f.id]), children.map(f => f.weight))
  if assessment.scoring_level = 'construct':
    children = assessment_constructs WHERE dimension_id = dimension.id
    return weighted_average(children.map(c => scores[c.construct_id]), children.map(c => c.weight))
```

## Testing Strategy

### Schema tests
- Verify `dimension_constructs` supports many-to-many (same construct, multiple dimensions)
- Verify `assessment_constructs` enforces uniqueness per assessment
- Verify `candidate_scores` CHECK constraint rejects invalid combinations
- Verify all existing data passes new constraints after migration

### Scoring tests
- Factor-level assessment: verify scoring pipeline unchanged (regression)
- Construct-level assessment: verify items → construct scores → dimension scores flow
- Verify `candidate_scores` rows written with correct `scoring_level`, `construct_id`
- Verify dimension aggregation uses `dimension_constructs.weight` or `assessment_constructs.weight`

### Report tests
- Factor-level assessment reports: verify no regression
- Construct-level assessment reports: verify correct entities at each display level
- `score_detail` with `showNestedScores=true` on a dimension in construct-level assessment: verify constructs appear as nested children
- `score_overview` with `groupByDimension=true` in construct-level assessment: verify correct grouping

### Campaign tests
- Construct-level assessment with no custom selection: all constructs included
- Construct-level assessment with custom selection: only selected constructs included
- Factor-level assessment campaign selection: verify no regression

## File Impact Summary

| File/Area | Change type | Risk |
|---|---|---|
| New migration SQL | New tables, columns, constraints | Low — additive only |
| `src/lib/scoring/ctt-session.ts` | Branch after construct scores | Medium — core scoring path |
| `src/lib/scoring/irt/index.ts` | Same branch | Medium |
| `src/lib/scoring/adaptive/index.ts` | Same branch | Medium |
| `src/lib/scoring/rule-based.ts` | Same branch | Medium |
| `src/lib/reports/runner.ts` | `dimensionChildConstructs` map, parentName resolution | Medium |
| `src/lib/reports/types.ts` | No change | None |
| `src/components/reports/blocks/*` | No change | None |
| Assessment runner RPC | Dual join path | Medium |
| Assessment builder UI | Scoring level toggle, construct picker | Low — new UI path |
| Campaign builder UI | Construct selection mode | Low — new UI path |
| Taxonomy library UI | Dimension-construct linking | Low — new UI |
| `item_selection_rules` | New columns | Low — additive |
