BEGIN;

-- ==========================================================================
-- 00049_generation_item_diagnostics.sql
-- Persist paper-faithful AI-GENIE review diagnostics per generated item
-- ==========================================================================

ALTER TABLE generated_items
  ADD COLUMN IF NOT EXISTS initial_community_id INT,
  ADD COLUMN IF NOT EXISTS final_community_id INT,
  ADD COLUMN IF NOT EXISTS removal_stage TEXT CHECK (
    removal_stage IS NULL OR removal_stage IN ('uva', 'boot_ega', 'kept')
  ),
  ADD COLUMN IF NOT EXISTS removal_sweep INT CHECK (
    removal_sweep IS NULL OR removal_sweep >= 1
  );

COMMIT;
