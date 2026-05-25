# Taxonomy Unification — Single-Path Factor Architecture

**Status:** Implemented 2026-05-25 (PRs #182–#186). Live DB migrated. Follow-ups deferred (see below).
**Date:** 2026-05-25
**Author:** Jason Hunt (with Claude)
**Supersedes:** Significant portions of [`2026-04-16-flexible-taxonomy-hierarchy-design.md`](./2026-04-16-flexible-taxonomy-hierarchy-design.md) and [`2026-04-16-flexible-taxonomy-ui-design.md`](./2026-04-16-flexible-taxonomy-ui-design.md)
**Related:** [`2026-05-24-ai-assessment-creator-design.md`](./2026-05-24-ai-assessment-creator-design.md)

## Implementation summary (post-build)

- **Phase 1 (PR #182):** factor.composition_locked column, duplicate-as-factor button, lock toggle, lock enforcement in updateFactor.
- **Phase 2 (PR #183):** bulk-import auto-wrap orphan constructs into 1:1 locked factors.
- **Phase 3 (PR #184):** the big migration. 49 wrapper factors created, 614 participant_scores converted from construct to factor mode, dual-path tables/columns/enum dropped, ~37 application files simplified.
- **Phase 4 (PR #185):** construct removed from displayLevel options in report builders and compare/trajectory level toggles. 4 existing report templates auto-migrated.
- **Phase 5 (PR #186):** this doc updated to reflect actual outcome; design docs themselves checked into the repo.

Live DB state preserved: `_taxonomy_unification_backup` holds 536 rows (dimension_constructs, assessment_constructs, campaign_assessment_constructs, construct-mode participant_scores, construct-mode assessments) for rollback safety. Drop the backup table after a confidence period.

## Deferred to follow-up

- **Platform-admin construct drill-down** inside `/(dashboard)/participants/[id]/...`. Data exists; this is purely additive role-gated UI.
- **Partner UI parity** for "Duplicate as parent factor" — no partner construct-authoring surface exists today, so nothing to attach the button to. Tracked as a separate piece of work to build the partner authoring surface first.
- **Drop the `_taxonomy_unification_backup` table** after ~30 days of confidence.
- **Restore correction** for the `items_per_construct` column (it was mistakenly dropped in Phase 3b and re-added in `20260525150000_restore_items_per_construct.sql` — see that migration's header for context).

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Background](#background)
3. [The Problem with the Dual-Path Architecture](#the-problem-with-the-dual-path-architecture)
4. [The Decision](#the-decision)
5. [Architectural Model](#architectural-model)
6. [Schema Changes](#schema-changes)
7. [New Features Introduced by This Change](#new-features-introduced-by-this-change)
8. [Data Migration](#data-migration)
9. [Surface Map — What Changes Where](#surface-map--what-changes-where)
10. [Implementation Sequence](#implementation-sequence)
11. [Risk Assessment](#risk-assessment)
12. [Open Questions](#open-questions)
13. [Appendix: Affected Files](#appendix-affected-files)

---

## Executive Summary

Trajectas currently supports two parallel scoring paths for assessments — `scoring_level = 'factor'` (constructs roll up to factors, then dimensions) and `scoring_level = 'construct'` (constructs roll up to dimensions directly, skipping the factor layer). The dual path was introduced 2026-04-16 to solve a real psychometric concern: "when factors aren't psychometrically justified or when a simpler measurement model is appropriate."

**Decision:** Collapse the dual path into a single factor-only architecture. The original psychometric flexibility is preserved by allowing 1:1 factors (a factor with one construct child) and adding a composition lock to protect those configurations from drift. Construct-level data remains computable and is exposed only as a platform-admin drill-down within the participant results view — never in customer-facing reports, comparisons, or assessment composition.

**Why now:**
- Pre-customer (~25 constructs in the library), migration cost is at its lowest
- The dual-path branching touches ~40 files across three portals (admin, partner, client); every new feature pays this tax
- The upcoming AI assessment creator depends on a single matching surface — building it against the dual path would entrench the complexity
- The 1:1 factor pattern preserves the original psychometric concern without the dual-path tax

**What stays unchanged:**
- Items still belong to constructs (item-anchor relationship preserved)
- Item generation pipeline (per-construct)
- Construct admin pages (authoring flow stays)
- Three-level hierarchy (dimensions → factors → constructs) — only the construct-direct shortcut goes away
- Respondent / item-runner UX (items rendered regardless of factor/construct grouping)

---

## Background

### The current hierarchy

```
dimensions (top, strategic groupings, never scored directly)
  └─ factors (mid-level, what clients recognise as "competencies")
      └─ constructs (leaf, what items measure, the psychometric anchor)
          └─ items (questions answered by respondents)
```

### The construct-direct mode (introduced 2026-04-16)

The `flexible_taxonomy_hierarchy` migration added a second path:

```
dimensions
  └─ constructs (direct — no factor layer)
      └─ items
```

Controlled by `assessments.scoring_level` (enum: `factor` | `construct`). When set to `construct`, the assessment uses `assessment_constructs` (with denormalised `dimension_id`) instead of `assessment_factors`, and scores roll up via `aggregateConstructsToDimensions` instead of `aggregateToFactors → aggregateToDimensions`.

The original design (see `2026-04-16-flexible-taxonomy-hierarchy-design.md`) was conservative and well-executed: parallel tables, no breaking changes, additive only.

### Why the original design was reasonable

The motivating problem is real. Some measurement models genuinely don't have a meaningful intermediate factor layer — either because the constructs under a dimension don't cluster into psychometrically distinct factors, or because a simpler model is more appropriate for the use case (e.g., research instruments, fine-grained development feedback, single-construct sub-tests).

### Why it has become a problem

- **Blast radius:** ~40 files across three portals (admin, partner, client) carry `scoring_level` branching. Every new feature must be built for both modes.
- **No shared code path between branches** — the two scoring pipelines, the two composition UIs, the two campaign pickers, the two report data flows are entirely parallel.
- **Test surface doubles** — every assessment scenario needs factor-mode and construct-mode coverage.
- **Cognitive overhead** — new contributors and AI agents must learn two paths and the conditions for choosing between them.
- **The forthcoming AI matcher** would need to handle both modes, complicating prompts, rationales, and the UI.

### What we learned during the audit

A critical clarifying insight from the original design doc:

> "Items always belong to a construct (`items.construct_id`). The rollup from item responses to construct-level scores is identical regardless of scoring level."

This means the construct level is structurally preserved as the item-anchor. The factor/construct distinction is only about *aggregation paths*. A 1:1 factor wrapping a single construct produces psychometrically equivalent scores to construct-direct mode, using the same items.

This is what makes unification cleanly possible.

---

## The Problem with the Dual-Path Architecture

Three concrete costs accrue every time we extend the platform:

### 1. Every new feature has to handle both paths

For example, the AI assessment creator (`2026-05-24-ai-assessment-creator-design.md`) would need:
- Two matching prompts (factor-level matching vs construct-level matching)
- Two picker UIs in the wizard
- Two rationale templates ("we picked this factor because…" vs "we picked this construct directly because…")
- Two assembly paths

### 2. Cross-portal duplication

The admin builder, the partner builder, and the client portal each need their own dual-path handling:

| Concern | Admin | Partner | Client |
|---|---|---|---|
| Assessment composition | dual | dual | n/a |
| Campaign picker | dual | dual | dual |
| Score viewing | dual | dual | dual |
| Reports | dual | dual | dual |

Three portals × multiple surfaces × two paths = a quadratic cost that has already been paid once and would be paid again with every new feature.

### 3. Mental model drift

A platform admin or partner asks "what level does this assessment score at?" The answer is "it depends on the assessment." This is asking customers to learn an internal architectural detail that doesn't add value to their workflow. Customers care about *competencies* (factors). The factor/construct distinction is an internal psychometric concern.

---

## The Decision

**Adopt a single-path factor architecture for all customer-facing surfaces.** Constructs remain a first-class library entity (they are the item-anchor) but are never surfaced as a scoring or composition unit. The 1:1 factor pattern preserves the psychometric flexibility that motivated the original dual-path design.

### Key principles

1. **Factor is the universal language** across every customer-facing surface — reports, compare, trajectory, assessment building, AI matching, campaign composition, bulk import outputs.
2. **A factor with one child construct is a perfectly valid factor.** Not a stub. Not a wrapper. Just a factor. The data model does not distinguish 1:1 factors from N:1 factors.
3. **Composition lock prevents drift.** Any factor can be locked to prevent constructs from being added or removed. Locks default to ON when factors are created via the "duplicate as factor" mechanism. Admin-toggleable.
4. **Construct-level data remains computable** because items belong to constructs. Construct scores are derivable on demand.
5. **Construct-level data is exposed only as a platform-admin drill-down** within the participant results UI. Never in customer-facing reports. Never in partner-facing UI. Never in client-facing UI.

### What this preserves

- The original psychometric motivation (constructs can be measured without a meaningful factor cluster) — via 1:1 factors
- Score continuity over time — via composition lock
- Item-level authoring and generation — unchanged
- The three-level taxonomy (dimensions → factors → constructs) — unchanged

### What this removes

- The customer-visible choice between factor-mode and construct-mode assessments
- The construct level as a customer-facing display option
- All dual-path branching code (~40 files)
- The `dimension_constructs` library table (library-level construct-direct-to-dimension link)
- The construct-mode scoring pipeline

---

## Architectural Model

### Factor as universal language

Every customer-facing surface operates exclusively on factors:

| Surface | Levels shown |
|---|---|
| Reports (rendered + block builder) | Dimension, Factor |
| Compare page (admin, partner, client) | Dimension, Factor |
| Trajectory page (admin, partner, client) | Dimension, Factor |
| Assessment builder | Factor |
| Campaign composition | Factor |
| AI assessment creator / matcher | Factor |
| Bulk import outputs | Factor (constructs auto-wrap to factors) |
| Item runner (respondent) | Items belong to constructs internally but the word never appears in the UI |

### Constructs as a first-class but internal concept

Constructs remain real entities in the library because:
- Items must belong to a construct (item-anchor relationship)
- Item generation runs per-construct (existing `/generate/*` flow)
- Construct authoring is a psychometric discipline activity that should continue
- The platform admin drill-down needs construct identity to display

What changes about constructs:
- Every construct must have a parent factor (enforced via the publishability bar)
- The "Linked Dimensions" UI on construct pages goes away (`dimension_constructs` is removed)
- The "Linked Constructs" UI on dimension pages goes away
- Constructs cannot be selected directly in assessment composition

### 1:1 factors are first-class

A factor with one construct child is a normal factor. The platform does not distinguish stub-like factors from composite factors. Authoring discipline ensures that 1:1 factors exist intentionally:

- They are created either by manual authoring or via the "Duplicate as parent factor" button on a construct page
- They default to `composition_locked = true` when created via duplication
- They can be promoted to composite factors by an admin (unlocking, adding sibling constructs)

### Composition lock

A new boolean on `factors`: `composition_locked`.

**Semantics:**
- `false` (default for new manually-authored factors): constructs can be freely added, removed, or reweighted
- `true` (default for factors created via "duplicate as factor", or any factor that has been used in a published campaign): constructs cannot be added or removed; weights cannot change

**Admin override:** Any admin can toggle the lock off. When unlocking a factor that has been used in published assessments, the UI warns: *"Unlocking this factor may break score continuity for past respondents. Existing scores will remain valid against the prior composition, but future scores will use the new composition. Proceed?"*

**Auto-lock triggers:**
- Created via "Duplicate as parent factor" → locks on creation
- First respondent completion on any assessment using the factor → locks automatically (composition stability matters from the moment real scores exist)
- Manually toggled by admin → as configured

### Platform admin construct drill-down

A new capability surfaced inside the existing participant results view in `/(dashboard)/participants/[id]/...`. NOT a new page.

**Behaviour:**
- Default view (everyone): dimension → factor scores
- Platform admin only: each factor score row has an expander (`▸ Constructs`) that reveals per-construct scores beneath
- Item-level data may sit one level deeper (separate decision later)
- This affordance does NOT appear in:
  - Templated reports (PDF exports, client portal report views)
  - Partner UI
  - Client UI
  - Any surface other than the live admin participant view

**Implementation:** A role check on the row component (`role === 'platform_admin'`) controls visibility. The data path (computing construct scores from item responses) is already in the codebase — it's the same aggregation logic, just exposed to a different caller.

---

## Schema Changes

### Tables to drop

```sql
DROP TABLE campaign_assessment_constructs;
DROP TABLE assessment_constructs;
DROP TABLE dimension_constructs;
```

Rationale:
- `assessment_constructs` and `campaign_assessment_constructs` exist only to support construct-mode assessments — no longer needed
- `dimension_constructs` exists only to support construct-direct library links — no longer needed (constructs reach dimensions via factors only)

### Columns to drop

```sql
ALTER TABLE assessments DROP COLUMN scoring_level;
ALTER TABLE assessments DROP COLUMN min_custom_constructs;

ALTER TABLE participant_scores DROP CONSTRAINT participant_scores_entity_check;
ALTER TABLE participant_scores DROP COLUMN scoring_level;
ALTER TABLE participant_scores DROP COLUMN construct_id;
ALTER TABLE participant_scores ALTER COLUMN factor_id SET NOT NULL;

ALTER TABLE item_selection_rules DROP COLUMN items_per_construct;
ALTER TABLE item_selection_rules DROP COLUMN total_construct_min;
ALTER TABLE item_selection_rules DROP COLUMN total_construct_max;

DROP TYPE scoring_level;
```

### Columns to add

```sql
ALTER TABLE factors
  ADD COLUMN composition_locked BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN factors.composition_locked IS
  'When true, constructs cannot be added to or removed from this factor, and weights are frozen. Protects psychometric meaning over time. Auto-set to true when factor is created via "duplicate from construct" and on first respondent completion of any assessment using the factor.';
```

### Constraints to add

```sql
-- Every construct must have at least one parent factor before it can be used in any assessment
-- Enforced via trigger rather than CHECK because it's a join condition

CREATE OR REPLACE FUNCTION check_construct_has_factor()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM factor_constructs WHERE construct_id = NEW.construct_id
  ) THEN
    RAISE EXCEPTION 'Construct % has no parent factor. Use "Duplicate as parent factor" or link to an existing factor before adding to an assessment.', NEW.construct_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to assessment_factors join: when a factor is added to an assessment, all its constructs must
-- already be parented. This is implicit since factors only contain their parented constructs, so the
-- real enforcement is on construct deletion / unlinking — prevent orphaning constructs that are in use.

CREATE OR REPLACE FUNCTION prevent_construct_orphan()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM items WHERE construct_id = OLD.construct_id
  ) AND NOT EXISTS (
    SELECT 1 FROM factor_constructs WHERE construct_id = OLD.construct_id AND id != OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot remove the last factor parent from construct %, it has items that need a measurement context.', OLD.construct_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_construct_orphan_on_unlink
  BEFORE DELETE ON factor_constructs
  FOR EACH ROW EXECUTE FUNCTION prevent_construct_orphan();
```

### Existing tables that survive unchanged

- `dimensions` — unchanged
- `factors` — unchanged except for the new `composition_locked` column
- `constructs` — unchanged
- `factor_constructs` — unchanged (the canonical construct-to-factor link)
- `assessment_factors` — unchanged
- `campaign_assessment_factors` — unchanged
- `items` — unchanged (still links to constructs)
- `participant_scores` — only `factor_id` matters now

---

## New Features Introduced by This Change

These features are introduced specifically to support the migration and the resulting model.

### 1. "Duplicate as parent factor" button

**Location:** Construct admin form (`construct-form.tsx`) AND partner construct authoring UI

**Behaviour:**
1. Admin opens a construct, sees a button "Duplicate as parent factor"
2. Click → optional dialog to override the factor's name/description (defaults to mirror the construct)
3. Server action atomically:
   - Creates a `factors` row with name/description (copied from construct unless overridden)
   - Sets `composition_locked = true`
   - Sets `dimension_id` to the construct's currently linked dimension (if exactly one — otherwise prompts for dimension choice)
   - Inserts a `factor_constructs` row linking the new factor to the construct with weight 1.0
4. Returns the new factor's id; UI redirects to the new factor's edit page

**Why this matters:**
- It's the authoring escape valve that makes the unified model ergonomic. The fear of "I have to manually create a factor every time" goes away with one button.
- It's the same mechanism used by the data migration to convert existing construct-direct assessments
- Same mechanism used by bulk import auto-wrap

**Partner UI parity:** Same button on whatever surface partners use to author constructs. Confirm location during implementation.

### 2. Composition lock toggle on factor form

**Location:** Factor admin form (`factor-form.tsx`) AND partner factor authoring UI

**Behaviour:**
- Visible as a toggle in the factor's settings section
- Helper text: *"When locked, constructs cannot be added or removed from this factor. Protects score comparability over time."*
- Unlocking when scores exist shows a warning dialog (see [Composition lock](#composition-lock) above)
- Adding/removing constructs from a locked factor is blocked at the server action level

### 3. Bulk import auto-wrap

**Location:** `src/app/actions/bulk-import.ts` and the import UI

**Behaviour:**
- When importing constructs without a specified factor parent, the import auto-creates a 1:1 locked factor for each
- Import preview shows which constructs will be auto-wrapped vs which already have factor parents
- Admin can override on the preview screen — assign multiple imported constructs to a shared (composite) factor, or attach to an existing factor

**Note:** The platform admin still sees all levels in the bulk import UI for full curation power. The customer-facing restriction (factor-only) does not apply to the import tooling.

### 4. Platform admin construct drill-down

**Location:** Inline within `/(dashboard)/participants/[id]/...` results view

**Behaviour:**
- For users with `role === 'platform_admin'`, each factor score row has a `▸ Constructs` expander
- Expanded view shows: per-construct score, item count, contribution to the factor's score
- Hidden for all other roles
- Not exposed in templated reports, partner UI, or client UI

**Implementation notes:**
- Data path is already computed by the runner; just needs a new query path that exposes it
- Could be a small server action `getConstructScoresForFactor(sessionId, factorId)` called on expand
- UI: a simple `Collapsible` underneath the factor row, role-gated

---

## Data Migration

### Pre-migration check

Before the migration runs, count the affected rows in production:

```sql
SELECT COUNT(*) FROM assessments WHERE scoring_level = 'construct';
SELECT COUNT(*) FROM assessment_constructs;
SELECT COUNT(*) FROM campaign_assessment_constructs;
SELECT COUNT(*) FROM participant_scores WHERE scoring_level = 'construct';
SELECT COUNT(*) FROM dimension_constructs;
```

**Known context (2026-05-25):** ~25 constructs total in the library. Construct-direct assessment count expected to be small. If counts come back larger than expected, revisit the migration shape before proceeding.

### Migration procedure

The migration is one transaction with the following stages:

#### Stage 1: Convert `dimension_constructs` library links

For each row in `dimension_constructs`:

```sql
-- For each (dimension_id, construct_id, weight) in dimension_constructs:
-- 1. Check if a factor already exists for this construct under this dimension
-- 2. If not, create a 1:1 locked factor

WITH conversions AS (
  SELECT dc.dimension_id, dc.construct_id, dc.weight, c.name, c.description
  FROM dimension_constructs dc
  JOIN constructs c ON c.id = dc.construct_id
  WHERE NOT EXISTS (
    SELECT 1 FROM factor_constructs fc
    JOIN factors f ON f.id = fc.factor_id
    WHERE fc.construct_id = dc.construct_id
      AND f.dimension_id = dc.dimension_id
  )
),
new_factors AS (
  INSERT INTO factors (name, description, dimension_id, composition_locked, source_id, status)
  SELECT name, description, dimension_id, true, NULL, 'published'
  FROM conversions
  RETURNING id, dimension_id, name
)
INSERT INTO factor_constructs (factor_id, construct_id, weight)
SELECT nf.id, c.construct_id, c.weight
FROM new_factors nf
JOIN conversions c ON c.dimension_id = nf.dimension_id AND c.name = nf.name;
```

#### Stage 2: Convert construct-direct assessments

For each assessment with `scoring_level = 'construct'`:

```
For each row in assessment_constructs:
  1. Find or create a 1:1 locked factor for the (construct_id, dimension_id) pair
  2. Insert assessment_factors row pointing at that factor
  3. Copy weight, display_order, item_count, min_items, max_items
```

Then convert `campaign_assessment_constructs` rows to `campaign_assessment_factors` rows pointing at the same new factors.

#### Stage 3: Convert participant_scores

```sql
-- For each participant_scores row with scoring_level = 'construct':
-- 1. Find the corresponding factor that was created for this construct in stage 2
-- 2. Update the row to use that factor_id, null out construct_id

UPDATE participant_scores ps
SET factor_id = (
  SELECT fc.factor_id
  FROM factor_constructs fc
  JOIN factors f ON f.id = fc.factor_id
  WHERE fc.construct_id = ps.construct_id
    AND f.composition_locked = true
  -- Pick the factor we just created if multiple exist; tiebreak strategy TBD
  ORDER BY f.created_at DESC
  LIMIT 1
),
construct_id = NULL,
scoring_level = 'factor'
WHERE scoring_level = 'construct';
```

**Tiebreak strategy:** If multiple locked 1:1 factors exist for the same construct under different dimensions (rare but possible), the migration needs to pick the one that matches the original assessment's dimension. Refine the SQL with the join to `assessment_constructs.dimension_id` before running.

#### Stage 4: Drop construct-mode infrastructure

After all data is migrated and verified:

```sql
DROP TABLE campaign_assessment_constructs;
DROP TABLE assessment_constructs;
DROP TABLE dimension_constructs;

ALTER TABLE assessments DROP COLUMN scoring_level;
ALTER TABLE assessments DROP COLUMN min_custom_constructs;

ALTER TABLE participant_scores DROP CONSTRAINT participant_scores_entity_check;
ALTER TABLE participant_scores DROP COLUMN scoring_level;
ALTER TABLE participant_scores DROP COLUMN construct_id;
ALTER TABLE participant_scores ALTER COLUMN factor_id SET NOT NULL;

ALTER TABLE item_selection_rules DROP COLUMN items_per_construct;
ALTER TABLE item_selection_rules DROP COLUMN total_construct_min;
ALTER TABLE item_selection_rules DROP COLUMN total_construct_max;

DROP TYPE scoring_level;
```

#### Stage 5: Add new schema elements

```sql
ALTER TABLE factors ADD COLUMN composition_locked BOOLEAN NOT NULL DEFAULT false;
-- Plus triggers from "Constraints to add" section
```

### Rollback considerations

The migration is destructive (drops tables, columns, types). Rollback requires:
1. Database restore from pre-migration backup
2. Code revert to pre-migration commits
3. Manual reconciliation of any new data written between migration and rollback

**Recommendation:** Take a logical backup of `dimension_constructs`, `assessment_constructs`, `campaign_assessment_constructs`, and the dropped columns BEFORE the migration runs. Store as JSONB rows in a `migration_backup_2026_05_25` table that persists for ~30 days. Drop after confidence is established.

---

## Surface Map — What Changes Where

The codebase has ~40 files touched by the dual-path architecture across three layers. This section maps each.

### Layer 1: Goes away entirely (scoring_level branching removed)

**Scoring & data pipeline (4 files):**
- `src/lib/scoring/pipeline.ts` — `aggregateConstructsToDimensions` removed
- `src/lib/scoring/ctt-session.ts` — dual path collapses
- `src/app/actions/assess.ts` — score-write branching removed
- `src/lib/supabase/mappers.ts` — single composition shape

**Composition & campaign server actions (5 files):**
- `src/app/actions/assessments.ts` — single composition write path
- `src/app/actions/campaigns.ts` — single composition retrieval
- `src/app/actions/construct-selection.ts` — DELETABLE
- `src/app/actions/dimension-constructs.ts` — DELETABLE
- `src/app/actions/client-entitlements.ts` — single composition shape

**Admin assessment builder UI (5 files):**
- `src/app/(dashboard)/assessments/create/create-form.tsx` — scoring_level toggle removed
- `src/app/(dashboard)/assessments/[id]/edit/settings/settings-panel.tsx` — locked scoring_level display removed
- `src/app/(dashboard)/assessments/[id]/edit/settings/page.tsx`
- `src/app/(dashboard)/assessments/[id]/edit/composition/composition-editor.tsx` — branching removed
- `src/app/(dashboard)/assessments/[id]/edit/composition/page.tsx`
- `src/app/(dashboard)/assessments/[id]/edit/overview/overview-form.tsx`

**Admin assessment composition canvas (3 files DELETABLE):**
- `src/app/(dashboard)/assessments/construct-source.tsx`
- `src/app/(dashboard)/assessments/draggable-construct-card.tsx`
- `src/app/(dashboard)/assessments/sortable-construct-card.tsx`

**Partner assessment builder (3 files):**
- `src/app/partner/assessments/[id]/edit/composition/page.tsx`
- `src/app/partner/assessments/[id]/edit/presentation/page.tsx`
- `src/app/partner/assessments/[id]/edit/settings/page.tsx`

**Campaign composition (3 files):**
- `src/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list.tsx` — picker branching removed
- `src/app/(dashboard)/campaigns/[id]/assessments/page.tsx` — dual data fetch removed
- `src/components/campaigns/quick-launch-modal.tsx` — construct fetch calls removed

**Construct picker for campaigns (DELETABLE):**
- `src/app/(dashboard)/campaigns/[id]/assessments/construct-picker.tsx`

**Reports — scoring branch only (3 files):**
- `src/lib/reports/runner.ts` — `scoringLevel` parameter removed; `dimensionChildConstructs` map removed
- `src/lib/reports/report-context.ts` — composition resolution simplifies
- `src/lib/reports/preview-entities.ts` — preview gen simplifies

**Other supporting files (8 files):**
- `src/lib/notifications/consultant-notification.ts` — single composition format
- `src/lib/sample-data/seed-preview.ts` — single seeding path
- `src/lib/validations/assessments.ts` — Zod schema simplifies
- `src/types/database.ts` — regenerated from schema
- `src/app/actions/comparison.ts` — scoring_level branch removed, displayLevel logic stays (but construct value removed — see Layer 2)
- `src/app/actions/trajectory-data.ts` — same
- `src/app/actions/sessions.ts` — same
- `src/app/actions/reports.ts` — same
- `src/app/actions/generation.ts` — same
- `src/app/actions/bulk-import.ts` — adds auto-wrap (new feature)

**Client portal (3 files):**
- `src/app/client/campaigns/[id]/assessments/page.tsx`
- `src/app/client/campaigns/page.tsx`
- `src/app/client/dashboard/page.tsx`

### Layer 2: Construct removed from displayLevel options

These files keep the `displayLevel` concept (dimension/factor remain valid options) but lose the `construct` option entirely:

**Report template builder (8 files — dropdown loses 'construct' option):**
- `src/app/(dashboard)/report-templates/[id]/builder/block-content-panels.tsx` — dropdown options change from `{dimension, factor, construct}` to `{dimension, factor}`
- `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx`
- `src/app/(dashboard)/report-templates/[id]/builder/page.tsx`
- `src/app/(dashboard)/report-templates/create-template-button.tsx`
- `src/app/(dashboard)/report-templates/report-templates-table.tsx`
- `src/app/(dashboard)/clients/[slug]/reports/report-assignments.tsx`
- `src/app/(dashboard)/partners/[slug]/reports/partner-report-assignments.tsx`
- `src/app/partner/report-templates/[id]/builder/page.tsx`

**Reports validation (1 file):**
- `src/lib/validations/reports.ts` — `displayLevel` Zod schema removes 'construct' as valid value

**Report blocks (9 files — simplify to dimension/factor only):**
- `src/components/reports/blocks/score-detail.tsx`
- `src/components/reports/blocks/score-overview.tsx`
- `src/components/reports/blocks/score-interpretation.tsx`
- `src/components/reports/blocks/score-interpretation-v2.tsx`
- `src/components/reports/blocks/norm-comparison.tsx`
- `src/components/reports/blocks/strengths-highlights.tsx`
- `src/components/reports/blocks/development-plan.tsx`
- `src/components/reports/blocks/gap-analysis.tsx`
- `src/components/reports/blocks/rater-comparison.tsx`

**Compare pages — `levels` URL param drops construct (6 files):**
- `src/app/(dashboard)/participants/compare/page.tsx`
- `src/app/(dashboard)/campaigns/[id]/compare/page.tsx`
- `src/app/client/participants/compare/page.tsx`
- `src/app/client/campaigns/[id]/compare/page.tsx`
- `src/app/api/comparison/export/route.ts`
- `src/app/actions/saved-comparisons.ts`

**Trajectory pages — level views drop construct (2 files):**
- `src/app/(dashboard)/participants/trajectory/page.tsx`
- `src/app/actions/trajectory.ts`

### Layer 3: STAYS unchanged (construct authoring + admin diagnostics)

**Construct authoring (gains "duplicate as factor" button):**
- `src/app/(dashboard)/constructs/` — list, create, edit pages
- `src/app/(dashboard)/constructs/construct-form.tsx` — adds the "Duplicate as parent factor" button; removes "Linked Dimensions" subsection
- Partner equivalent — add same button (location to confirm)

**Item generation (per-construct — unchanged):**
- `src/app/(dashboard)/generate/new/construct-picker.tsx`
- `src/app/(dashboard)/generate/new/configurator-canvas.tsx`
- `src/app/(dashboard)/generate/new/page.tsx`
- `src/app/(dashboard)/generate/[runId]/*` — review, progress, quality, network-graph
- `src/app/(dashboard)/generate/presets/*`
- `src/app/api/generation/readiness/route.ts`

**Library navigation:**
- `src/app/(dashboard)/dimensions/` — list and edit pages; remove "Linked Constructs" subsection from edit form
- `src/app/(dashboard)/factors/` — list, create, edit pages; add composition_locked toggle to settings
- `src/app/(dashboard)/constructs/` — as above

**Bulk import (gains auto-wrap):**
- `src/app/actions/bulk-import.ts` — adds auto-wrap orphan constructs into 1:1 locked factors
- Bulk import UI shows all levels (platform admin tool)

### Layer 4: Platform admin construct drill-down (NEW)

**New surface inside existing participant view:**
- `src/app/(dashboard)/participants/[id]/...` — result view gains a role-gated `▸ Constructs` expander beneath each factor score row
- Server action: new `getConstructScoresForFactor(sessionId, factorId)` returning per-construct aggregates from item responses
- Role check: `role === 'platform_admin'` controls visibility
- Does NOT appear in: templated reports, partner UI, client UI, any other surface

### Layer 5: Unchanged (respondent / item runner)

- Survey UI — items belong to constructs internally; respondent never sees the concept

---

## Implementation Sequence

This change is large enough to warrant phasing. Each phase ships independently.

### Phase 1: Author-side enablers (no migration yet)

Ship the authoring escape valves so the migration becomes ergonomic:

1. **`composition_locked` column on factors** (schema only)
2. **"Duplicate as parent factor" button** on construct form (admin + partner)
3. **Composition lock toggle** on factor form (admin + partner)
4. **Unit tests** for the duplicate-as-factor server action

After this phase: admins can manually clean up any construct-direct usage they want, in advance of the migration. Useful for hand-curated cleanup of the existing ~25 constructs.

### Phase 2: Bulk import auto-wrap

5. **Bulk import auto-wrap logic** — adds the import-time escape valve
6. **Import preview UI changes** — show auto-wrap intent before commit

After this phase: any future imports are safely funnelled to the unified model.

### Phase 3: Data + code migration (the big one)

7. **Pre-migration data check** — confirm counts
8. **Take logical backup** of soon-to-be-dropped tables/columns
9. **Run the data migration** (Stage 1-4 above)
10. **Remove Layer 1 code** (~37 files) — type errors guide the cleanup
11. **Add Layer 5 (admin drill-down)** — small new feature

Phase 3 is the high-risk, high-reward push. Do it in a single PR if feasible (so the codebase doesn't sit half-migrated), but with thorough test coverage. The type system will catch the bulk of any miss.

### Phase 4: Tighten displayLevel

12. **Remove 'construct' from displayLevel options** in all 8 report builder files
13. **Remove construct from `levels` URL param** in compare and trajectory pages
14. **Simplify report blocks** to dimension+factor only

Phase 4 is cleanup of customer-facing complexity. Lower risk because the data path doesn't change.

### Phase 5: Documentation + tests

15. Update `2026-05-24-ai-assessment-creator-design.md` to assume single-path
16. Mark `2026-04-16-flexible-taxonomy-hierarchy-design.md` and `2026-04-16-flexible-taxonomy-ui-design.md` as superseded
17. Add regression tests for the unified scoring path
18. Add tests for the duplicate-as-factor mechanism and composition lock

---

## Risk Assessment

### High-risk items

- **Data migration correctness** — `participant_scores` is the most sensitive table. A bad migration corrupts historical scores. Mitigation: logical backup before migration, exhaustive verification queries before dropping columns.
- **Three-portal scope** — admin, partner, client UIs all need coordinated updates. Mitigation: type system catches most missed branches; Phase 1 + 2 reduce the surface area before Phase 3.
- **Composition lock auto-trigger on first respondent completion** — needs careful logic to handle race conditions and to handle cases where existing factors with prior scores should retroactively lock. Mitigation: separate migration step that auto-locks any factor with prior scores at migration time.

### Medium-risk items

- **Bulk import UX clarity** — admins need to understand which constructs will be auto-wrapped vs which will attach to existing factors. Mitigation: preview screen with explicit indication.
- **Partner UI parity** — easy to forget the partner-side equivalents. Mitigation: explicit Phase 1 checklist covering both admin and partner authoring surfaces.
- **The drill-down feature scope** — risk of expanding to "let's also show item-level" or "let's also expose to partners." Mitigation: explicitly out of scope for v1.

### Low-risk items

- **Respondent UX** — completely unchanged because items belong to constructs regardless
- **Report block rendering** — already hierarchy-agnostic per original design doc
- **Library navigation pages** — additive changes only (new button, new toggle)

---

## Open Questions

These should be answered or deliberately deferred before Phase 3.

1. **Pre-migration count of `scoring_level = 'construct'` assessments and `participant_scores` rows.** Critical input to migration sizing. Run before Phase 3 starts.
2. **Partner UI location for "Duplicate as parent factor"** — need to confirm exact surface (likely under `/app/partner/assessments/` or a partner library equivalent).
3. **Composition lock auto-trigger timing** — first respondent completion is the recommended default, but could also be:
   - First completion of any session against any assessment using this factor (broader)
   - When the factor is added to a published assessment (earlier)
   - Manual only (no auto-trigger)
4. **Tiebreak strategy in Stage 3 migration** — when multiple locked 1:1 factors exist for the same construct, the SQL needs to pick the right one. Refine before running.
5. **Should item-level drill-down be part of v1 admin drill-down or deferred?** Construct-level only is simpler; item-level would expose IRT parameters. Recommend deferring.
6. **Diagnostic flow independence** — `src/app/(dashboard)/diagnostics/` uses `diagnostic_dimensions` (a separate table from `dimensions`). Confirm no interaction with the unification before Phase 3.
7. **Sample data files** — `src/lib/reports/sample-data.ts` and `5brains.ts` may have hardcoded construct-direct shapes. Grep before Phase 3.
8. **Matching directory** — `src/app/(dashboard)/matching/` exists but wasn't traced in this audit. Confirm independence before Phase 3.
9. **Drill-down design** — small UX decision: inline expander vs side panel vs modal. Recommend inline expander (lightest weight).
10. **Soft-deletion of dropped tables** — should the dropped tables be retained as `*_archived` versions for a grace period? Recommendation: no, the logical backup table is enough.

---

## Appendix: Affected Files

### Schema migrations (write these)

```
supabase/migrations/<timestamp>_taxonomy_unification.sql
  -- Stages 1-5 from "Data Migration" section above
```

### Code files — full list

See [Surface Map](#surface-map--what-changes-where) above. Roughly:

- **Layer 1 (delete or simplify):** 37 files
- **Layer 2 (displayLevel simplification):** 26 files (8 builder + 1 validation + 9 blocks + 6 compare + 2 trajectory)
- **Layer 3 (unchanged + new buttons):** authoring pages stay; add ~3 new buttons/toggles
- **Layer 4 (new admin drill-down):** ~2-3 new files (server action + UI component)
- **Layer 5 (respondent):** 0 files

### Related design docs

- [`2026-04-16-flexible-taxonomy-hierarchy-design.md`](./2026-04-16-flexible-taxonomy-hierarchy-design.md) — **superseded by this doc** (the dual-path it designs is being removed)
- [`2026-04-16-flexible-taxonomy-ui-design.md`](./2026-04-16-flexible-taxonomy-ui-design.md) — **superseded by this doc** (the construct-mode UI it designs is being removed)
- [`2026-05-24-ai-assessment-creator-design.md`](./2026-05-24-ai-assessment-creator-design.md) — depends on this unification being complete; assumes single-path matching going forward
- [`2026-04-20-org-diagnostic-campaigns-and-roles-design.md`](./2026-04-20-org-diagnostic-campaigns-and-roles-design.md) — uses separate `diagnostic_dimensions` table; should be independent of this change but worth confirming during implementation
