-- Inserts the platform-level "Sample Data" client that owns preview campaigns/
-- participants/sessions/scores for every assessment. Idempotent by UUID.

INSERT INTO clients (id, partner_id, name, slug, is_active, settings)
VALUES (
  '00000000-0000-4000-8000-00008a4dc11e'::uuid,
  NULL,
  'Sample Data',
  'sample-data',
  true,
  '{"preview_only": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
