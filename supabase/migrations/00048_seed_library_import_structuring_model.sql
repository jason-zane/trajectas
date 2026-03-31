-- =============================================================================
-- Migration 00047: Seed library_import_structuring AI model config
-- =============================================================================

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
);
