-- =============================================================================
-- 20260519120000 — assessment_report_templates
--
-- Lets an assessment own its own default set of report templates. When a
-- participant completes a session, snapshot creation now prefers:
--   1. explicit campaign_report_templates rows (campaign override), then
--   2. assessment_report_templates rows for the session's assessment.
--
-- This is the join table; the resolution change lives in
-- src/app/actions/assess.ts (ensureReportSnapshotsForSession).
-- =============================================================================

CREATE TABLE IF NOT EXISTS assessment_report_templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID        NOT NULL REFERENCES assessments(id)      ON DELETE CASCADE,
  template_id   UUID        NOT NULL REFERENCES report_templates(id) ON DELETE RESTRICT,
  is_default    BOOLEAN     NOT NULL DEFAULT true,
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT assessment_report_templates_unique UNIQUE (assessment_id, template_id)
);

CREATE INDEX IF NOT EXISTS assessment_report_templates_assessment_idx
  ON assessment_report_templates (assessment_id);
CREATE INDEX IF NOT EXISTS assessment_report_templates_template_idx
  ON assessment_report_templates (template_id);

-- Maintain updated_at on row writes.
CREATE OR REPLACE FUNCTION assessment_report_templates_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assessment_report_templates_updated_at ON assessment_report_templates;
CREATE TRIGGER assessment_report_templates_updated_at
  BEFORE UPDATE ON assessment_report_templates
  FOR EACH ROW
  EXECUTE FUNCTION assessment_report_templates_set_updated_at();

-- RLS — service role only. All app access goes through the admin client
-- (matches campaign_report_templates / report_templates post-phase-4).
ALTER TABLE assessment_report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to assessment_report_templates"
  ON assessment_report_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE assessment_report_templates IS
  'Assessment-level default report templates. Falls back to feeding snapshot creation when no campaign_report_templates rows exist for the campaign.';
