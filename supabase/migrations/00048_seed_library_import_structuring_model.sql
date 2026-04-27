-- =============================================================================
-- Migration 00048: Historical library_import_structuring model seed
--
-- Production already applied this version before the enum was later moved to
-- 00059. Keep the version locally for migration-history parity, but make fresh
-- database resets skip the seed until 00079 can run after the enum exists.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_prompt_purpose'
      AND e.enumlabel = 'library_import_structuring'
  ) THEN
    EXECUTE $seed$
      INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
      SELECT
          (SELECT id FROM ai_providers WHERE name = 'OpenRouter'),
          'anthropic/claude-sonnet-4-5',
          'Claude Sonnet 4.5',
          false,
          '{"temperature": 0.2, "max_tokens": 3000}'::jsonb,
          'library_import_structuring'
      WHERE NOT EXISTS (
          SELECT 1 FROM ai_model_configs WHERE purpose = 'library_import_structuring'
      )
    $seed$;
  END IF;
END $$;
