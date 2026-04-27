-- =============================================================================
-- 00012_item_weights.sql
-- Add per-item weight within its construct for scoring contribution.
-- Default 1.0 means all items contribute equally.
-- =============================================================================

BEGIN;
ALTER TABLE items
  ADD COLUMN weight NUMERIC(5,2) NOT NULL DEFAULT 1.0;
ALTER TABLE items
  ADD CONSTRAINT items_weight_positive CHECK (weight > 0);
COMMIT;
