-- =============================================================================
-- 20260519100000 — Seed report_templates row for the 5Brains custom report.
--
-- Registers the hand-coded 5Brains capability report with custom_report_slug =
-- '5brains'. The dispatcher in src/lib/reports/runner.ts:runCustomReport picks
-- this up and skips the block-resolution pipeline.
-- =============================================================================

INSERT INTO report_templates (
  name,
  description,
  report_type,
  display_level,
  group_by_dimension,
  person_reference,
  auto_release,
  blocks,
  is_active,
  is_default,
  custom_report_slug,
  band_scheme
)
VALUES (
  '5Brains Capability Report',
  'Hand-coded 9-page A4 report for the 5Brains Capability Assessment. Cover, intro, overview, one page per brain, and closing.',
  'self_report',
  'construct',
  true,
  'first_name',
  true,
  '[]'::jsonb,
  true,
  false,
  '5brains',
  jsonb_build_object(
    'palette', 'red-amber-green',
    'bands', jsonb_build_array(
      jsonb_build_object('key', 'low',         'label', 'Low',        'min', 0,  'max', 20,  'indicatorTier', 'low'),
      jsonb_build_object('key', 'developing',  'label', 'Developing', 'min', 21, 'max', 40,  'indicatorTier', 'low'),
      jsonb_build_object('key', 'moderate',    'label', 'Moderate',   'min', 41, 'max', 60,  'indicatorTier', 'mid'),
      jsonb_build_object('key', 'high',        'label', 'High',       'min', 61, 'max', 80,  'indicatorTier', 'high'),
      jsonb_build_object('key', 'very_high',   'label', 'Very High',  'min', 81, 'max', 100, 'indicatorTier', 'high')
    )
  )
)
ON CONFLICT DO NOTHING;
