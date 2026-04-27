-- =============================================================================
-- Migration 00005: Foundation Alignment
-- =============================================================================
-- Combines several foundation fixes and schema expansions:
--
-- Phase 1 fixes:
--   1. Fix is_scored default to true (all dimensions scored by default)
--   2. Remove competency_categories (superseded by dimensions)
--
-- Phase 2 expansions:
--   1. Expanded item types (SJT, cognitive, scale) + media + rubrics
--   2. Multi-tenant diagnostics (partner_id, is_active, competency hints)
--   3. Assessment creation modes (manual, ai_generated, org_choice)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1.2 — Fix is_scored default to true
-- ---------------------------------------------------------------------------
ALTER TABLE dimensions ALTER COLUMN is_scored SET DEFAULT true;
-- ---------------------------------------------------------------------------
-- 1.3 — Remove competency_categories (superseded by dimensions)
-- ---------------------------------------------------------------------------
-- Drop the index on category_id first
DROP INDEX IF EXISTS idx_competencies_category_id;
-- Drop the FK constraint and column from competencies
ALTER TABLE competencies DROP COLUMN IF EXISTS category_id;
-- Drop RLS policies on competency_categories
DROP POLICY IF EXISTS competency_categories_select_authenticated ON competency_categories;
DROP POLICY IF EXISTS competency_categories_all_platform_admin ON competency_categories;
-- Drop the table
DROP TABLE IF EXISTS competency_categories;
-- ---------------------------------------------------------------------------
-- 2.1 — Expanded item types
-- ---------------------------------------------------------------------------

-- Add new response format types
ALTER TYPE response_format_type ADD VALUE IF NOT EXISTS 'sjt';
ALTER TYPE response_format_type ADD VALUE IF NOT EXISTS 'cognitive';
ALTER TYPE response_format_type ADD VALUE IF NOT EXISTS 'scale';
-- Media attachments for items (used by cognitive, SJT with scenarios, etc.)
CREATE TABLE item_media (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id        UUID        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    media_type     TEXT        NOT NULL,  -- 'image', 'audio', 'video', 'html'
    url            TEXT,                  -- external URL or storage path
    content        TEXT,                  -- inline content (e.g. HTML scenario)
    alt_text       TEXT,                  -- accessibility description
    display_order  INT         NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT item_media_type_check CHECK (media_type IN ('image', 'audio', 'video', 'html')),
    CONSTRAINT item_media_has_source CHECK (url IS NOT NULL OR content IS NOT NULL)
);
CREATE INDEX idx_item_media_item ON item_media(item_id);
-- Scoring rubrics for SJT and other multi-option scored items
CREATE TABLE item_scoring_rubrics (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id        UUID        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    option_id      UUID        REFERENCES item_options(id) ON DELETE CASCADE,
    rubric_label   TEXT        NOT NULL,  -- 'best', 'good', 'neutral', 'poor'
    score_value    NUMERIC     NOT NULL,
    explanation    TEXT,                   -- rationale for this scoring
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rubric_label_check CHECK (rubric_label IN ('best', 'good', 'neutral', 'poor'))
);
CREATE INDEX idx_item_scoring_rubrics_item ON item_scoring_rubrics(item_id);
CREATE INDEX idx_item_scoring_rubrics_option ON item_scoring_rubrics(option_id);
-- RLS for new item tables
ALTER TABLE item_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_scoring_rubrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY item_media_select ON item_media FOR SELECT USING (true);
CREATE POLICY item_media_insert ON item_media FOR INSERT WITH CHECK (is_platform_admin() OR is_partner_admin());
CREATE POLICY item_media_update ON item_media FOR UPDATE USING (is_platform_admin() OR is_partner_admin());
CREATE POLICY item_media_delete ON item_media FOR DELETE USING (is_platform_admin());
CREATE POLICY item_scoring_rubrics_select ON item_scoring_rubrics FOR SELECT USING (true);
CREATE POLICY item_scoring_rubrics_insert ON item_scoring_rubrics FOR INSERT WITH CHECK (is_platform_admin() OR is_partner_admin());
CREATE POLICY item_scoring_rubrics_update ON item_scoring_rubrics FOR UPDATE USING (is_platform_admin() OR is_partner_admin());
CREATE POLICY item_scoring_rubrics_delete ON item_scoring_rubrics FOR DELETE USING (is_platform_admin());
-- Triggers
CREATE TRIGGER set_item_media_updated_at
    BEFORE UPDATE ON item_media
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_item_scoring_rubrics_updated_at
    BEFORE UPDATE ON item_scoring_rubrics
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Seed new response formats
INSERT INTO response_formats (id, name, type, config) VALUES
  ('a5000000-0000-0000-0000-000000000005', 'SJT 4-Option', 'sjt',
   '{"options": 4, "scoring": "rubric", "instructions": "Rank the following responses from most effective to least effective."}'),
  ('a5000000-0000-0000-0000-000000000006', 'Pattern Recognition', 'cognitive',
   '{"mediaRequired": true, "timeLimit": 60, "instructions": "Identify the pattern and select the next element in the sequence."}'),
  ('a5000000-0000-0000-0000-000000000007', 'Scale 0-100', 'scale',
   '{"min": 0, "max": 100, "step": 1, "anchors": {"0": "Not at all", "50": "Moderate", "100": "Extremely"}}')
ON CONFLICT DO NOTHING;
-- ---------------------------------------------------------------------------
-- 2.2 — Multi-tenant diagnostics
-- ---------------------------------------------------------------------------

-- diagnostic_dimensions already has partner_id and is_active from initial schema
-- but diagnostic_templates may need them
ALTER TABLE diagnostic_templates
    ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
-- Bridge table: links diagnostic dimensions to taxonomy competencies
-- This seeds the AI matching context — admin controls which competencies
-- are relevant to each diagnostic dimension
CREATE TABLE diagnostic_competency_hints (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagnostic_dimension_id UUID    NOT NULL REFERENCES diagnostic_dimensions(id) ON DELETE CASCADE,
    competency_id           UUID    NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
    relevance_weight        NUMERIC NOT NULL DEFAULT 1.0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT diagnostic_competency_hints_unique UNIQUE (diagnostic_dimension_id, competency_id),
    CONSTRAINT diagnostic_competency_hints_weight_positive CHECK (relevance_weight > 0)
);
CREATE INDEX idx_diag_comp_hints_dimension ON diagnostic_competency_hints(diagnostic_dimension_id);
CREATE INDEX idx_diag_comp_hints_competency ON diagnostic_competency_hints(competency_id);
ALTER TABLE diagnostic_competency_hints ENABLE ROW LEVEL SECURITY;
CREATE POLICY diagnostic_competency_hints_select ON diagnostic_competency_hints FOR SELECT USING (true);
CREATE POLICY diagnostic_competency_hints_insert ON diagnostic_competency_hints FOR INSERT WITH CHECK (is_platform_admin() OR is_partner_admin());
CREATE POLICY diagnostic_competency_hints_update ON diagnostic_competency_hints FOR UPDATE USING (is_platform_admin() OR is_partner_admin());
CREATE POLICY diagnostic_competency_hints_delete ON diagnostic_competency_hints FOR DELETE USING (is_platform_admin());
-- ---------------------------------------------------------------------------
-- 2.3 — Assessment creation modes
-- ---------------------------------------------------------------------------
CREATE TYPE assessment_creation_mode AS ENUM ('manual', 'ai_generated', 'org_choice');
ALTER TABLE assessments
    ADD COLUMN IF NOT EXISTS creation_mode assessment_creation_mode NOT NULL DEFAULT 'manual';
ALTER TABLE assessments
    ADD COLUMN IF NOT EXISTS matching_run_id UUID REFERENCES matching_runs(id) ON DELETE SET NULL;
CREATE INDEX idx_assessments_creation_mode ON assessments(creation_mode);
CREATE INDEX idx_assessments_matching_run ON assessments(matching_run_id) WHERE matching_run_id IS NOT NULL;
