BEGIN;
-- Drop the index if it exists
DROP INDEX IF EXISTS idx_items_factor;
-- Drop the denormalized factor_id column from items
ALTER TABLE items
  DROP COLUMN factor_id;
COMMIT;
