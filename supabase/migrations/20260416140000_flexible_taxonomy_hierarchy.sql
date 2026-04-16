-- =============================================================================
-- Flexible taxonomy hierarchy: allow constructs to relate directly to dimensions
-- without an intermediate factor layer.
--
-- New tables: dimension_constructs, assessment_constructs, campaign_assessment_constructs
-- Modified: assessments (scoring_level column), participant_scores (construct_id, scoring_level)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. New enum: scoring_level
-- ---------------------------------------------------------------------------
CREATE TYPE scoring_level AS ENUM ('factor', 'construct');

-- ---------------------------------------------------------------------------
-- 2. New columns on assessments
-- ---------------------------------------------------------------------------
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS scoring_level scoring_level NOT NULL DEFAULT 'factor';

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS min_custom_constructs INT DEFAULT NULL;

COMMENT ON COLUMN assessments.scoring_level IS
  'Whether this assessment scores at factor level (traditional) or construct level (factors skipped).';

COMMENT ON COLUMN assessments.min_custom_constructs IS
  'Minimum constructs required for custom campaign selection. NULL = customisation not allowed. Only applies when scoring_level = construct.';

-- ---------------------------------------------------------------------------
-- 3. New table: dimension_constructs (library level)
-- ---------------------------------------------------------------------------
CREATE TABLE dimension_constructs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_id   UUID NOT NULL REFERENCES dimensions(id) ON DELETE CASCADE,
  construct_id   UUID NOT NULL REFERENCES constructs(id) ON DELETE CASCADE,
  weight         NUMERIC NOT NULL DEFAULT 1.0,
  display_order  INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dimension_constructs_unique UNIQUE (dimension_id, construct_id),
  CONSTRAINT dimension_constructs_weight_positive CHECK (weight > 0)
);

CREATE INDEX idx_dimension_constructs_dimension ON dimension_constructs(dimension_id);
CREATE INDEX idx_dimension_constructs_construct ON dimension_constructs(construct_id);

COMMENT ON TABLE dimension_constructs IS
  'Links constructs directly to dimensions with configurable weights. Parallel to factor_constructs. A construct can appear under multiple dimensions.';

-- ---------------------------------------------------------------------------
-- 4. New table: assessment_constructs (assessment level)
-- ---------------------------------------------------------------------------
CREATE TABLE assessment_constructs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  construct_id   UUID NOT NULL REFERENCES constructs(id) ON DELETE CASCADE,
  dimension_id   UUID REFERENCES dimensions(id) ON DELETE SET NULL,
  display_order  INT NOT NULL DEFAULT 0,
  weight         NUMERIC NOT NULL DEFAULT 1.0,
  min_items      INT,
  max_items      INT,
  item_count     INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT assessment_constructs_unique UNIQUE (assessment_id, construct_id),
  CONSTRAINT assessment_constructs_weight_positive CHECK (weight > 0),
  CONSTRAINT assessment_constructs_items_valid CHECK (
    (min_items IS NULL AND max_items IS NULL)
    OR (min_items IS NULL AND max_items > 0)
    OR (max_items IS NULL AND min_items > 0)
    OR (min_items > 0 AND max_items >= min_items)
  )
);

CREATE INDEX idx_assessment_constructs_assessment ON assessment_constructs(assessment_id);
CREATE INDEX idx_assessment_constructs_construct ON assessment_constructs(construct_id);
CREATE INDEX idx_assessment_constructs_dimension ON assessment_constructs(dimension_id);

COMMENT ON TABLE assessment_constructs IS
  'Links constructs to a construct-level assessment with ordering, weighting, and item-count constraints. Parallel to assessment_factors.';

-- ---------------------------------------------------------------------------
-- 5. New table: campaign_assessment_constructs (campaign level)
-- ---------------------------------------------------------------------------
CREATE TABLE campaign_assessment_constructs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_assessment_id UUID NOT NULL REFERENCES campaign_assessments(id) ON DELETE CASCADE,
  construct_id           UUID NOT NULL REFERENCES constructs(id) ON DELETE CASCADE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_campaign_assessment_construct UNIQUE (campaign_assessment_id, construct_id)
);

CREATE INDEX idx_campaign_assessment_constructs_ca
  ON campaign_assessment_constructs(campaign_assessment_id);

COMMENT ON TABLE campaign_assessment_constructs IS
  'Per-campaign construct selection. No rows = full assessment (all constructs). Rows present = custom selection of specific constructs only.';

-- ---------------------------------------------------------------------------
-- 6. Modify participant_scores
-- ---------------------------------------------------------------------------

-- Make factor_id nullable (existing rows all have it set)
ALTER TABLE participant_scores
  ALTER COLUMN factor_id DROP NOT NULL;

-- Add construct_id column
ALTER TABLE participant_scores
  ADD COLUMN IF NOT EXISTS construct_id UUID REFERENCES constructs(id) ON DELETE RESTRICT;

-- Add scoring_level column
ALTER TABLE participant_scores
  ADD COLUMN IF NOT EXISTS scoring_level scoring_level NOT NULL DEFAULT 'factor';

-- Ensure exactly one of factor_id or construct_id is set
ALTER TABLE participant_scores
  ADD CONSTRAINT participant_scores_entity_check
  CHECK (
    (scoring_level = 'factor' AND factor_id IS NOT NULL AND construct_id IS NULL)
    OR (scoring_level = 'construct' AND construct_id IS NOT NULL AND factor_id IS NULL)
  );

-- Partial unique index for construct-level scores
CREATE UNIQUE INDEX IF NOT EXISTS participant_scores_unique_construct
  ON participant_scores(session_id, construct_id) WHERE scoring_level = 'construct';

CREATE INDEX IF NOT EXISTS idx_participant_scores_construct
  ON participant_scores(construct_id) WHERE construct_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 7. Add construct-level item selection rule columns
-- ---------------------------------------------------------------------------
ALTER TABLE item_selection_rules
  ADD COLUMN IF NOT EXISTS items_per_construct INT,
  ADD COLUMN IF NOT EXISTS total_construct_min INT,
  ADD COLUMN IF NOT EXISTS total_construct_max INT;

-- ---------------------------------------------------------------------------
-- 8. RLS policies
-- ---------------------------------------------------------------------------

-- dimension_constructs
ALTER TABLE dimension_constructs ENABLE ROW LEVEL SECURITY;

CREATE POLICY dimension_constructs_select ON dimension_constructs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY dimension_constructs_insert ON dimension_constructs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY dimension_constructs_update ON dimension_constructs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY dimension_constructs_delete ON dimension_constructs
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );

-- assessment_constructs
ALTER TABLE assessment_constructs ENABLE ROW LEVEL SECURITY;

CREATE POLICY assessment_constructs_select ON assessment_constructs
  FOR SELECT USING (true);
CREATE POLICY assessment_constructs_all_platform_admin ON assessment_constructs
  FOR ALL USING (is_platform_admin());

-- campaign_assessment_constructs
ALTER TABLE campaign_assessment_constructs ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_assessment_constructs_full_access ON campaign_assessment_constructs
  FOR ALL TO authenticated
  USING (is_platform_admin());

CREATE POLICY campaign_assessment_constructs_select ON campaign_assessment_constructs
  FOR SELECT TO authenticated
  USING (
    campaign_assessment_id IN (
      SELECT ca.id FROM campaign_assessments ca
      JOIN campaigns c ON c.id = ca.campaign_id
      WHERE c.client_id = auth_user_client_id()
         OR c.partner_id = auth_user_partner_id()
    )
  );

COMMIT;
