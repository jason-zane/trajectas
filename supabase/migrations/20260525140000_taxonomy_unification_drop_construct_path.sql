-- =============================================================================
-- Taxonomy unification — Phase 3b: drop the construct-mode infrastructure.
-- Runs after taxonomy_unification_data_migration. Removes the dual-path
-- tables/columns/enum now that every construct-mode row has been converted
-- to factor-mode via 1:1 wrapper factors (Phase 3a).
-- Backup of the dropped data lives in _taxonomy_unification_backup.
-- =============================================================================

-- 1. Drop the per-campaign and per-assessment construct selection tables.
DROP TABLE IF EXISTS campaign_assessment_constructs;
DROP TABLE IF EXISTS assessment_constructs;
DROP TABLE IF EXISTS dimension_constructs;

-- 2. participant_scores: drop the CHECK constraint, scoring_level column, and
--    construct_id column. Make factor_id NOT NULL again.
ALTER TABLE participant_scores
  DROP CONSTRAINT IF EXISTS participant_scores_entity_check;
DROP INDEX IF EXISTS participant_scores_unique_construct;
DROP INDEX IF EXISTS idx_participant_scores_construct;
ALTER TABLE participant_scores
  DROP COLUMN IF EXISTS scoring_level,
  DROP COLUMN IF EXISTS construct_id;
ALTER TABLE participant_scores
  ALTER COLUMN factor_id SET NOT NULL;

-- 3. assessments: drop scoring_level + min_custom_constructs.
ALTER TABLE assessments
  DROP COLUMN IF EXISTS scoring_level,
  DROP COLUMN IF EXISTS min_custom_constructs;

-- 4. item_selection_rules: drop the construct-mode total-* columns. The
--    items_per_construct column STAYS — it's the algorithm's per-leaf-entity
--    config, not a dual-path artifact.
ALTER TABLE item_selection_rules
  DROP COLUMN IF EXISTS total_construct_min,
  DROP COLUMN IF EXISTS total_construct_max;

-- 5. Drop the scoring_level enum (now unreferenced).
DROP TYPE IF EXISTS scoring_level;

-- 6. Drop the wrapper map (no longer needed; backup preserves history).
DROP TABLE IF EXISTS _migration_wrapper_map;
