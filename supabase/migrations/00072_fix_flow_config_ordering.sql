-- =============================================================================
-- Migration 00072: Fix flow_config page ordering
--
-- review and complete pages had order < 100 which placed them BEFORE the
-- __sections__ sentinel in the flow router. They must be >= 100 to appear
-- after assessment sections. Also fix report and expired ordering.
-- =============================================================================

UPDATE experience_templates
SET flow_config = flow_config
  || '{"review": {"enabled": true, "order": 101}}'::jsonb
  || '{"complete": {"enabled": true, "order": 102}}'::jsonb
  || '{"report": {"enabled": false, "order": 103, "reportMode": "holding"}}'::jsonb
  || '{"expired": {"enabled": true, "order": 999}}'::jsonb
WHERE flow_config->'review'->>'order' IS NOT NULL
  AND (flow_config->'review'->>'order')::int < 100;
