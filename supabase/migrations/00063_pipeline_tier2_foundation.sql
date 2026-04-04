-- =============================================================================
-- Migration 00063: Pipeline Tier 2 Foundation (schema changes)
--
-- 1. Extend ai_prompt_purpose enum with item_critique, synthetic_respondent
-- 2. Add pipeline_metadata JSONB column to generated_items
-- 3. Update removal_stage check constraint to allow 'critique' and 'leakage'
--
-- Note: Enum value seeding is in 00064 because PostgreSQL requires new enum
-- values to be committed before they can be referenced.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend ai_prompt_purpose enum
-- ---------------------------------------------------------------------------

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'item_critique';
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'synthetic_respondent';

-- ---------------------------------------------------------------------------
-- 2. Add pipeline_metadata JSONB column to generated_items
-- ---------------------------------------------------------------------------

ALTER TABLE generated_items
  ADD COLUMN IF NOT EXISTS pipeline_metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN generated_items.pipeline_metadata IS
  'Per-item metadata from Tier 2 pipeline stages (critique verdicts, leakage scores, difficulty estimates)';

-- ---------------------------------------------------------------------------
-- 3. Update removal_stage check constraint
-- ---------------------------------------------------------------------------

ALTER TABLE generated_items DROP CONSTRAINT IF EXISTS generated_items_removal_stage_check;

ALTER TABLE generated_items
  ADD CONSTRAINT generated_items_removal_stage_check
  CHECK (removal_stage IS NULL OR removal_stage IN ('critique', 'leakage', 'uva', 'boot_ega', 'kept'));
