-- =============================================================================
-- 00047 — Item selection rules & priority
-- Configurable per-construct item limits based on total construct count,
-- plus a selection_priority column on items for deterministic ranking.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. item_selection_rules table
-- ---------------------------------------------------------------------------
-- The table already exists in the base schema under factor-oriented names.
-- Reshape that legacy table into the construct-oriented global rules model.

ALTER TABLE item_selection_rules
  RENAME COLUMN total_factor_min TO min_constructs;

ALTER TABLE item_selection_rules
  RENAME COLUMN total_factor_max TO max_constructs;

ALTER TABLE item_selection_rules
  RENAME COLUMN items_per_factor TO items_per_construct;

DROP POLICY IF EXISTS item_selection_rules_select ON item_selection_rules;
DROP POLICY IF EXISTS item_selection_rules_all_platform_admin ON item_selection_rules;
DROP POLICY IF EXISTS "Anyone can read item_selection_rules" ON item_selection_rules;
DROP POLICY IF EXISTS "Admins can manage item_selection_rules" ON item_selection_rules;

DROP INDEX IF EXISTS idx_item_selection_rules_assessment;

ALTER TABLE item_selection_rules
  DROP COLUMN IF EXISTS assessment_id,
  DROP COLUMN IF EXISTS description;

ALTER TABLE item_selection_rules
  ALTER COLUMN max_constructs DROP NOT NULL;

ALTER TABLE item_selection_rules
  ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON TABLE item_selection_rules IS 'Configurable thresholds determining how many items per construct are selected based on total construct count.';
COMMENT ON COLUMN item_selection_rules.max_constructs IS 'NULL means "and above" — open-ended upper bound.';

UPDATE item_selection_rules
SET display_order = ranked.display_order
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY min_constructs ASC, id ASC) - 1 AS display_order
  FROM item_selection_rules
) AS ranked
WHERE item_selection_rules.id = ranked.id
  AND item_selection_rules.display_order = 0;

-- RLS
ALTER TABLE item_selection_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read item_selection_rules"
  ON item_selection_rules FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage item_selection_rules"
  ON item_selection_rules FOR ALL
  USING (is_platform_admin() OR is_partner_admin());

-- Seed default rules
INSERT INTO item_selection_rules (min_constructs, max_constructs, items_per_construct, display_order)
SELECT *
FROM (
  VALUES
    (1, 2, 15, 0),
    (3, 5, 10, 1),
    (6, NULL, 6, 2)
) AS seed(min_constructs, max_constructs, items_per_construct, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM item_selection_rules
);

-- ---------------------------------------------------------------------------
-- 2. selection_priority column on items
-- ---------------------------------------------------------------------------

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS selection_priority INT NOT NULL DEFAULT 0;

-- Backfill: use display_order as initial priority
UPDATE items SET selection_priority = display_order WHERE selection_priority = 0 AND display_order > 0;

-- Composite index for efficient per-construct priority ordering
CREATE INDEX IF NOT EXISTS idx_items_construct_priority
  ON items (construct_id, selection_priority, display_order);

DROP TRIGGER IF EXISTS set_item_selection_rules_updated_at ON item_selection_rules;

CREATE TRIGGER set_item_selection_rules_updated_at
  BEFORE UPDATE ON item_selection_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
