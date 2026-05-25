-- =============================================================================
-- 20260525150000 — restore items_per_construct on item_selection_rules
-- This column was mistakenly dropped during the taxonomy unification (Phase 3b)
-- — it's the algorithm's "items per leaf entity" config, not a dual-path
-- artifact. Live state was repaired via Supabase MCP; this file makes the
-- repair reproducible from the migration history.
-- =============================================================================

ALTER TABLE item_selection_rules
  ADD COLUMN IF NOT EXISTS items_per_construct INT;

UPDATE item_selection_rules
SET items_per_construct = CASE
  WHEN min_constructs >= 8 THEN 6
  WHEN min_constructs >= 4 THEN 10
  ELSE 15
END
WHERE items_per_construct IS NULL;

ALTER TABLE item_selection_rules
  ALTER COLUMN items_per_construct SET NOT NULL;
