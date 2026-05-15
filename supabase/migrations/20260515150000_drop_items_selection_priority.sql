-- =============================================================================
-- 20260515150000 — Drop items.selection_priority
-- The difficulty band + display_order tiebreaker make selection_priority
-- redundant; production data has zero items with a non-default value and the
-- preceding code change removed every read/write of the column.
-- =============================================================================

DROP INDEX IF EXISTS idx_items_construct_priority;

ALTER TABLE items
  DROP COLUMN IF EXISTS selection_priority;
