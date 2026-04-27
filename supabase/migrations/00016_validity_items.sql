BEGIN;
-- New enum for item purpose
CREATE TYPE item_purpose AS ENUM (
  'construct',
  'impression_management',
  'infrequency',
  'attention_check'
);
-- Add purpose column (default = construct for all existing items)
ALTER TABLE items
  ADD COLUMN purpose item_purpose NOT NULL DEFAULT 'construct';
-- Make construct_id nullable (validity items don't belong to constructs)
ALTER TABLE items
  ALTER COLUMN construct_id DROP NOT NULL;
-- Add check constraint: construct items MUST have construct_id, validity items MUST NOT
ALTER TABLE items
  ADD CONSTRAINT items_purpose_construct_check CHECK (
    (purpose = 'construct' AND construct_id IS NOT NULL) OR
    (purpose != 'construct' AND construct_id IS NULL)
  );
-- Add keyed_answer column for attention checks
ALTER TABLE items
  ADD COLUMN keyed_answer NUMERIC;
-- Index for filtering by purpose
CREATE INDEX idx_items_purpose ON items (purpose);
COMMIT;
