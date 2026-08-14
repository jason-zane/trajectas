-- 20260813120000_instrument_builder_engine.sql
-- Instrument builder engine — isolated schema for designing psychometric instruments before respondent data.
--
-- This migration creates a standalone schema for the instrument-builder engine. The engine designs
-- competencies, blueprints, and candidate items BEFORE any assessment is launched. All tables are
-- platform-admin-only (no client/partner scope). No existing table is modified; no FK points FROM
-- an existing table TO these tables (one-way dependency: engine → library constructs/items only).
-- This isolation ensures zero impact on running assessments, campaigns, or scoring.

-- ============================================================================
-- 1. instrument_builds — durable build object (root of an instrument design)
-- ============================================================================
CREATE TABLE IF NOT EXISTS instrument_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  measure_type TEXT NOT NULL,
  brief TEXT,
  audience JSONB,
  use_context TEXT,
  target_construct_count INT,
  target_items_per_construct INT,
  config JSONB,
  preset_id UUID,
  -- SET NULL, not RESTRICT: the engine must never be able to block a runtime
  -- operation on live data. Deleting a profile orphans the build's authorship,
  -- it does not fail. Nullable for the same reason.
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
COMMENT ON TABLE instrument_builds IS
  'Root object for an instrument design session; orchestrates constructs, items, evidence, and stage runs.';

CREATE INDEX IF NOT EXISTS idx_instrument_builds_created_by ON instrument_builds(created_by);
CREATE INDEX IF NOT EXISTS idx_instrument_builds_status ON instrument_builds(status);
CREATE INDEX IF NOT EXISTS idx_instrument_builds_created_at ON instrument_builds(created_at DESC);

DROP TRIGGER IF EXISTS trg_instrument_builds_updated ON instrument_builds;
CREATE TRIGGER trg_instrument_builds_updated
  BEFORE UPDATE ON instrument_builds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 2. instrument_blueprints — competency blueprint within a build
-- ============================================================================
CREATE TABLE IF NOT EXISTS instrument_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES instrument_builds(id) ON DELETE CASCADE,
  construct_id UUID REFERENCES constructs(id) ON DELETE SET NULL,
  draft_construct_name TEXT,
  draft_construct_definition TEXT,
  measure_type TEXT NOT NULL,
  target_alpha NUMERIC,
  exclusions TEXT[],
  notes TEXT,
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
COMMENT ON TABLE instrument_blueprints IS
  'Competency blueprint (construct + structure) within a build; groups facet/intensity cells.';

CREATE INDEX IF NOT EXISTS idx_instrument_blueprints_build_id ON instrument_blueprints(build_id);
CREATE INDEX IF NOT EXISTS idx_instrument_blueprints_construct_id ON instrument_blueprints(construct_id);
CREATE INDEX IF NOT EXISTS idx_instrument_blueprints_status ON instrument_blueprints(status);

DROP TRIGGER IF EXISTS trg_instrument_blueprints_updated ON instrument_blueprints;
CREATE TRIGGER trg_instrument_blueprints_updated
  BEFORE UPDATE ON instrument_blueprints
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 3. instrument_blueprint_cells — facet/intensity grid cells
-- ============================================================================
CREATE TABLE IF NOT EXISTS instrument_blueprint_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES instrument_blueprints(id) ON DELETE CASCADE,
  facet_label TEXT NOT NULL,
  facet_definition TEXT,
  intensity TEXT NOT NULL,
  target_item_count INT NOT NULL DEFAULT 2,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE instrument_blueprint_cells IS
  'A cell in the blueprint grid (one facet × intensity combination) with a target item count.';

CREATE INDEX IF NOT EXISTS idx_instrument_blueprint_cells_blueprint_id
  ON instrument_blueprint_cells(blueprint_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_instrument_blueprint_cells_facet_intensity
  ON instrument_blueprint_cells(blueprint_id, facet_label, intensity);

-- ============================================================================
-- 4. instrument_candidate_items — items inside the engine (before publish)
-- ============================================================================
CREATE TABLE IF NOT EXISTS instrument_candidate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES instrument_builds(id) ON DELETE CASCADE,
  blueprint_cell_id UUID REFERENCES instrument_blueprint_cells(id) ON DELETE SET NULL,
  stem TEXT NOT NULL,
  stem_observer TEXT,
  reverse_scored BOOLEAN DEFAULT false,
  rationale TEXT,
  facet TEXT,
  difficulty_tier TEXT,
  sd_risk TEXT,
  sd_rating NUMERIC,
  reading_grade NUMERIC,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'candidate',
  published_item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
COMMENT ON TABLE instrument_candidate_items IS
  'A candidate item (stem + options) during engine design; moves to published_items on publish.';

CREATE INDEX IF NOT EXISTS idx_instrument_candidate_items_build_id
  ON instrument_candidate_items(build_id);
CREATE INDEX IF NOT EXISTS idx_instrument_candidate_items_blueprint_cell_id
  ON instrument_candidate_items(blueprint_cell_id);
CREATE INDEX IF NOT EXISTS idx_instrument_candidate_items_published_item_id
  ON instrument_candidate_items(published_item_id);
CREATE INDEX IF NOT EXISTS idx_instrument_candidate_items_status
  ON instrument_candidate_items(status);

DROP TRIGGER IF EXISTS trg_instrument_candidate_items_updated ON instrument_candidate_items;
CREATE TRIGGER trg_instrument_candidate_items_updated
  BEFORE UPDATE ON instrument_candidate_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 5. instrument_congruence_ratings — rater alignment on item placement
-- ============================================================================
CREATE TABLE IF NOT EXISTS instrument_congruence_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_item_id UUID NOT NULL REFERENCES instrument_candidate_items(id) ON DELETE CASCADE,
  rater_index INT NOT NULL,
  rater_model TEXT NOT NULL,
  assigned_blueprint_id UUID REFERENCES instrument_blueprints(id) ON DELETE SET NULL,
  -- CASCADE, not RESTRICT: deleting a build cascades to its blueprints, and a
  -- RESTRICT here would make that cascade fail whenever ratings exist. Both
  -- sides are engine-internal, so cascading is safe.
  intended_blueprint_id UUID NOT NULL REFERENCES instrument_blueprints(id) ON DELETE CASCADE,
  relevance INT NOT NULL CHECK (relevance BETWEEN 1 AND 4),
  named_facet TEXT,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE instrument_congruence_ratings IS
  'Ratings from (AI or expert) raters on whether items align with intended blueprint cells.';

CREATE INDEX IF NOT EXISTS idx_instrument_congruence_ratings_candidate_item_id
  ON instrument_congruence_ratings(candidate_item_id);
CREATE INDEX IF NOT EXISTS idx_instrument_congruence_ratings_assigned_blueprint_id
  ON instrument_congruence_ratings(assigned_blueprint_id);
CREATE INDEX IF NOT EXISTS idx_instrument_congruence_ratings_intended_blueprint_id
  ON instrument_congruence_ratings(intended_blueprint_id);

-- ============================================================================
-- 6. instrument_evidence — append-only ledger of validity claims
-- ============================================================================
CREATE TABLE IF NOT EXISTS instrument_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES instrument_builds(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('item', 'construct', 'instrument')),
  target_id UUID NOT NULL,
  claim TEXT NOT NULL,
  value NUMERIC NOT NULL,
  interval_low NUMERIC,
  interval_high NUMERIC,
  evidence_class TEXT NOT NULL CHECK (evidence_class IN ('a_priori', 'synthetic', 'empirical')),
  method TEXT NOT NULL,
  sample_size INT,
  superseded_by UUID REFERENCES instrument_evidence(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE instrument_evidence IS
  'Append-only ledger of validity/quality claims (a priori, synthetic, empirical) for items and constructs.';

CREATE INDEX IF NOT EXISTS idx_instrument_evidence_build_id
  ON instrument_evidence(build_id);
CREATE INDEX IF NOT EXISTS idx_instrument_evidence_target
  ON instrument_evidence(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_instrument_evidence_claim_active
  ON instrument_evidence(target_type, target_id, claim) WHERE superseded_by IS NULL;

-- ============================================================================
-- 7. instrument_stage_runs — execution log for multi-stage pipeline
-- ============================================================================
CREATE TABLE IF NOT EXISTS instrument_stage_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES instrument_builds(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failure', 'paused')),
  severity TEXT,
  progress_pct INT DEFAULT 0,
  detail TEXT,
  input_snapshot JSONB,
  output_snapshot JSONB,
  token_usage JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE instrument_stage_runs IS
  'Execution log for each stage in the instrument-builder pipeline (e.g., generation, review, publish).';

CREATE INDEX IF NOT EXISTS idx_instrument_stage_runs_build_id
  ON instrument_stage_runs(build_id);
CREATE INDEX IF NOT EXISTS idx_instrument_stage_runs_stage_key
  ON instrument_stage_runs(stage_key);
CREATE INDEX IF NOT EXISTS idx_instrument_stage_runs_status
  ON instrument_stage_runs(status);
CREATE INDEX IF NOT EXISTS idx_instrument_stage_runs_created_at
  ON instrument_stage_runs(created_at DESC);

-- ============================================================================
-- RLS Policies (platform-admin only)
-- ============================================================================

ALTER TABLE instrument_builds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "instrument_builds_platform_admin_all" ON instrument_builds;
CREATE POLICY "instrument_builds_platform_admin_all" ON instrument_builds
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

ALTER TABLE instrument_blueprints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "instrument_blueprints_platform_admin_all" ON instrument_blueprints;
CREATE POLICY "instrument_blueprints_platform_admin_all" ON instrument_blueprints
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

ALTER TABLE instrument_blueprint_cells ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "instrument_blueprint_cells_platform_admin_all" ON instrument_blueprint_cells;
CREATE POLICY "instrument_blueprint_cells_platform_admin_all" ON instrument_blueprint_cells
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

ALTER TABLE instrument_candidate_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "instrument_candidate_items_platform_admin_all" ON instrument_candidate_items;
CREATE POLICY "instrument_candidate_items_platform_admin_all" ON instrument_candidate_items
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

ALTER TABLE instrument_congruence_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "instrument_congruence_ratings_platform_admin_all" ON instrument_congruence_ratings;
CREATE POLICY "instrument_congruence_ratings_platform_admin_all" ON instrument_congruence_ratings
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

ALTER TABLE instrument_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "instrument_evidence_platform_admin_all" ON instrument_evidence;
CREATE POLICY "instrument_evidence_platform_admin_all" ON instrument_evidence
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

ALTER TABLE instrument_stage_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "instrument_stage_runs_platform_admin_all" ON instrument_stage_runs;
CREATE POLICY "instrument_stage_runs_platform_admin_all" ON instrument_stage_runs
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ============================================================================
-- Data API Grants (explicit for durability; accounts for Supabase CLI 2.106+)
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON instrument_builds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON instrument_blueprints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON instrument_blueprint_cells TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON instrument_candidate_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON instrument_congruence_ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON instrument_evidence TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON instrument_stage_runs TO authenticated;
