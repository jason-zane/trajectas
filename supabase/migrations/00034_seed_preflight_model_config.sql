-- =============================================================================
-- Migration 00034: Seed preflight_analysis model config
-- =============================================================================
-- Adds a default ai_model_configs row for the preflight_analysis purpose.
-- (preflight_analysis was added to the ai_prompt_purpose enum in 00033.)
-- =============================================================================

INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
SELECT
    (SELECT id FROM ai_providers WHERE name = 'OpenRouter'),
    'anthropic/claude-sonnet-4-5',
    'Claude Sonnet 4.5',
    false,
    '{"temperature": 0.3, "max_tokens": 2048}'::jsonb,
    'preflight_analysis'
WHERE NOT EXISTS (
    SELECT 1 FROM ai_model_configs WHERE purpose = 'preflight_analysis'
);
