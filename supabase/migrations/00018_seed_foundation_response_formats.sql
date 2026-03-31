-- =============================================================================
-- Migration 00018: Seed Foundation Response Formats
-- =============================================================================
-- Seeds response formats introduced in 00005_foundation_alignment after the
-- response_format_type enum additions have committed.
-- =============================================================================

-- Only seed rows whose type exists in the response_format_type enum.
-- 'cognitive' and 'scale' were planned but never added to the enum,
-- so those rows are omitted to keep the migration idempotent.
INSERT INTO response_formats (id, name, type, config) VALUES
  ('a5000000-0000-0000-0000-000000000005', 'SJT 4-Option', 'sjt',
   '{"options": 4, "scoring": "rubric", "instructions": "Rank the following responses from most effective to least effective."}')
ON CONFLICT DO NOTHING;
