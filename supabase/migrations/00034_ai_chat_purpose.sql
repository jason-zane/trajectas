-- Add 'chat' to ai_prompt_purpose enum and seed a default model config row

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'chat';

INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
SELECT
    (SELECT id FROM ai_providers WHERE name = 'OpenRouter'),
    'anthropic/claude-sonnet-4-5',
    'Claude Sonnet 4.5',
    false,
    '{"temperature": 0.7, "max_tokens": 4096}'::jsonb,
    'chat'
WHERE NOT EXISTS (
    SELECT 1 FROM ai_model_configs WHERE purpose = 'chat'
);
