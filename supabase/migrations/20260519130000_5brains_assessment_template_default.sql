-- =============================================================================
-- 20260519130000 — Attach the 5Brains report template to the 5Brains
-- assessment as its default report.
--
-- Resolution falls back from campaign_report_templates to this row, so any
-- campaign running the 5Brains Capability Assessment now generates the
-- 5Brains report at session-completion without per-campaign wiring.
-- =============================================================================

INSERT INTO assessment_report_templates (
  assessment_id,
  template_id,
  is_default,
  sort_order
)
SELECT a.id, rt.id, true, 0
FROM assessments a
JOIN report_templates rt ON rt.custom_report_slug = '5brains' AND rt.deleted_at IS NULL
WHERE a.title ILIKE '5Brains Capability Assessment%'
  AND a.deleted_at IS NULL
ON CONFLICT (assessment_id, template_id) DO NOTHING;
