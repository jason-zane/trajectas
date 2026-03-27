-- =============================================================================
-- 00008_naming_refactor.sql
-- Rename competencies → factors, traits → constructs, competency_traits → factor_constructs
-- Also rename columns, constraints, indexes, policies, and triggers.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1a. Rename tables
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE competencies RENAME TO factors;
ALTER TABLE traits RENAME TO constructs;
ALTER TABLE competency_traits RENAME TO factor_constructs;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1b. Rename columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE factor_constructs RENAME COLUMN competency_id TO factor_id;
ALTER TABLE factor_constructs RENAME COLUMN trait_id TO construct_id;
ALTER TABLE items RENAME COLUMN trait_id TO construct_id;
ALTER TABLE items RENAME COLUMN competency_id TO factor_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1c. Rename constraints
-- ─────────────────────────────────────────────────────────────────────────────

-- constructs (was traits)
ALTER TABLE constructs RENAME CONSTRAINT traits_slug_unique TO constructs_slug_unique;
ALTER TABLE constructs RENAME CONSTRAINT traits_slug_format TO constructs_slug_format;
ALTER TABLE constructs RENAME CONSTRAINT traits_name_not_empty TO constructs_name_not_empty;

-- factors (was competencies)
ALTER TABLE factors RENAME CONSTRAINT competencies_slug_unique TO factors_slug_unique;
ALTER TABLE factors RENAME CONSTRAINT competencies_slug_format TO factors_slug_format;
ALTER TABLE factors RENAME CONSTRAINT competencies_name_not_empty TO factors_name_not_empty;

-- factor_constructs (was competency_traits)
ALTER TABLE factor_constructs RENAME CONSTRAINT competency_traits_unique TO factor_constructs_unique;
ALTER TABLE factor_constructs RENAME CONSTRAINT competency_traits_weight_positive TO factor_constructs_weight_positive;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1d. Rename indexes
-- ─────────────────────────────────────────────────────────────────────────────
ALTER INDEX idx_competencies_dimension RENAME TO idx_factors_dimension;
ALTER INDEX idx_competencies_active RENAME TO idx_factors_active;
ALTER INDEX idx_competencies_partner RENAME TO idx_factors_partner;
ALTER INDEX idx_traits_partner RENAME TO idx_constructs_partner;
ALTER INDEX idx_traits_active RENAME TO idx_constructs_active;
ALTER INDEX idx_competency_traits_competency RENAME TO idx_factor_constructs_factor;
ALTER INDEX idx_competency_traits_trait RENAME TO idx_factor_constructs_construct;
ALTER INDEX idx_items_trait RENAME TO idx_items_construct;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1e. Replace RLS policies (cannot rename — drop + recreate)
-- ─────────────────────────────────────────────────────────────────────────────

-- constructs (was traits)
DROP POLICY IF EXISTS traits_select ON constructs;
DROP POLICY IF EXISTS traits_insert ON constructs;
DROP POLICY IF EXISTS traits_update ON constructs;
DROP POLICY IF EXISTS traits_delete ON constructs;

CREATE POLICY constructs_select ON constructs FOR SELECT TO authenticated USING (true);
CREATE POLICY constructs_insert ON constructs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY constructs_update ON constructs FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY constructs_delete ON constructs FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );

-- factors (was competencies)
DROP POLICY IF EXISTS competencies_select_authenticated ON factors;
DROP POLICY IF EXISTS competencies_all_platform_admin ON factors;

CREATE POLICY factors_select ON factors FOR SELECT TO authenticated USING (true);
CREATE POLICY factors_insert ON factors FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY factors_update ON factors FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY factors_delete ON factors FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );

-- factor_constructs (was competency_traits)
DROP POLICY IF EXISTS competency_traits_select ON factor_constructs;
DROP POLICY IF EXISTS competency_traits_insert ON factor_constructs;
DROP POLICY IF EXISTS competency_traits_update ON factor_constructs;
DROP POLICY IF EXISTS competency_traits_delete ON factor_constructs;

CREATE POLICY factor_constructs_select ON factor_constructs FOR SELECT TO authenticated USING (true);
CREATE POLICY factor_constructs_insert ON factor_constructs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY factor_constructs_update ON factor_constructs FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY factor_constructs_delete ON factor_constructs FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 1f. Rename triggers
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TRIGGER set_traits_updated_at ON constructs RENAME TO set_constructs_updated_at;
ALTER TRIGGER trg_competencies_updated_at ON factors RENAME TO trg_factors_updated_at;

COMMIT;
