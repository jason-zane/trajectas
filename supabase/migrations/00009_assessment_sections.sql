-- =============================================================================
-- 00009_assessment_sections.sql
-- Assessment sections, section items, item ordering, and additional response
-- format seed data (7-point Likert, SJT).
-- =============================================================================

BEGIN;
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enums
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE item_ordering AS ENUM (
  'fixed',
  'randomised',
  'interleaved_by_construct'
);
-- ─────────────────────────────────────────────────────────────────────────────
-- 2. assessment_sections
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE assessment_sections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  response_format_id UUID NOT NULL REFERENCES response_formats(id),
  title           TEXT NOT NULL,
  instructions    TEXT,
  display_order   INT NOT NULL DEFAULT 0,
  item_ordering   item_ordering NOT NULL DEFAULT 'interleaved_by_construct',
  items_per_page  INT,
  time_limit_seconds INT,
  allow_back_nav  BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ,

  CONSTRAINT assessment_sections_title_not_empty CHECK (char_length(trim(title)) > 0),
  CONSTRAINT assessment_sections_display_order_positive CHECK (display_order >= 0),
  CONSTRAINT assessment_sections_items_per_page_positive CHECK (items_per_page IS NULL OR items_per_page > 0),
  CONSTRAINT assessment_sections_time_limit_positive CHECK (time_limit_seconds IS NULL OR time_limit_seconds > 0)
);
-- ─────────────────────────────────────────────────────────────────────────────
-- 3. assessment_section_items
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE assessment_section_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id    UUID NOT NULL REFERENCES assessment_sections(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT assessment_section_items_unique UNIQUE (section_id, item_id),
  CONSTRAINT assessment_section_items_order_positive CHECK (display_order >= 0)
);
-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Add section_id to candidate_responses
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE candidate_responses
  ADD COLUMN section_id UUID REFERENCES assessment_sections(id);
-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_assessment_sections_assessment ON assessment_sections(assessment_id);
CREATE INDEX idx_assessment_sections_format ON assessment_sections(response_format_id);
CREATE INDEX idx_assessment_section_items_section ON assessment_section_items(section_id);
CREATE INDEX idx_assessment_section_items_item ON assessment_section_items(item_id);
CREATE INDEX idx_candidate_responses_section ON candidate_responses(section_id);
-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Triggers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER set_assessment_sections_updated_at
  BEFORE UPDATE ON assessment_sections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Row-Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE assessment_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_section_items ENABLE ROW LEVEL SECURITY;
-- assessment_sections
CREATE POLICY assessment_sections_select ON assessment_sections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY assessment_sections_insert ON assessment_sections
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY assessment_sections_update ON assessment_sections
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY assessment_sections_delete ON assessment_sections
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
-- assessment_section_items
CREATE POLICY assessment_section_items_select ON assessment_section_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY assessment_section_items_insert ON assessment_section_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY assessment_section_items_update ON assessment_section_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
CREATE POLICY assessment_section_items_delete ON assessment_section_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin')
  );
-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Seed additional response formats
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO response_formats (id, name, type, config, is_active) VALUES
  -- 7-point Agreement Likert
  ('a5000000-0000-0000-0000-000000000005', '7-point Agreement Likert', 'likert',
   '{"points": 7, "anchorType": "agreement", "anchors": {"1": "Strongly Disagree", "2": "Disagree", "3": "Slightly Disagree", "4": "Neutral", "5": "Slightly Agree", "6": "Agree", "7": "Strongly Agree"}}',
   true),
  -- 5-point Frequency Likert
  ('a5000000-0000-0000-0000-000000000006', '5-point Frequency Likert', 'likert',
   '{"points": 5, "anchorType": "frequency", "anchors": {"1": "Never", "2": "Rarely", "3": "Sometimes", "4": "Often", "5": "Always"}}',
   true),
  -- 5-point Capability Likert
  ('a5000000-0000-0000-0000-000000000007', '5-point Capability Likert', 'likert',
   '{"points": 5, "anchorType": "capability", "anchors": {"1": "Not at all Confident", "2": "Slightly Confident", "3": "Moderately Confident", "4": "Very Confident", "5": "Extremely Confident"}}',
   true),
  -- SJT (Situational Judgement Test)
  ('a5000000-0000-0000-0000-000000000008', 'Situational Judgement', 'sjt',
   '{"scoringType": "rate_effectiveness", "optionsPerScenario": 4, "rubricLabels": ["best", "good", "neutral", "poor"], "rubricValues": [4, 3, 2, 1]}',
   true)
ON CONFLICT DO NOTHING;
-- Add anchorType to existing 5-point Likert format config
UPDATE response_formats
  SET config = '{"points": 5, "anchorType": "agreement", "anchors": {"1": "Strongly Disagree", "2": "Disagree", "3": "Neutral", "4": "Agree", "5": "Strongly Agree"}}'
  WHERE id = 'a5000000-0000-0000-0000-000000000001';
COMMIT;
