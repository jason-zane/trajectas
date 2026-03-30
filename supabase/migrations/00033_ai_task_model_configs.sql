-- =============================================================================
-- Migration 00033: AI Task Model Configs
-- =============================================================================
-- Extends ai_prompt_purpose enum with item_generation and embedding,
-- adds purpose column to ai_model_configs, seeds OpenRouter provider
-- and one default config row per task purpose.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend ai_prompt_purpose enum
-- ---------------------------------------------------------------------------
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'item_generation';
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'preflight_analysis';
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'embedding';

-- ---------------------------------------------------------------------------
-- 2. Add purpose column to ai_model_configs
--    Nullable — existing rows without a purpose are legacy/unnamed configs.
--    Unique constraint enforces one active config per purpose.
-- ---------------------------------------------------------------------------
ALTER TABLE ai_model_configs
    ADD COLUMN IF NOT EXISTS purpose ai_prompt_purpose;

CREATE UNIQUE INDEX IF NOT EXISTS ai_model_configs_purpose_unique
    ON ai_model_configs (purpose)
    WHERE purpose IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Seed OpenRouter provider (idempotent via ON CONFLICT DO NOTHING)
-- ---------------------------------------------------------------------------
INSERT INTO ai_providers (id, name, api_key_env_var, base_url, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'OpenRouter',
    'OpenRouter_API_KEY',
    'https://openrouter.ai/api/v1',
    true
)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Seed one default model config per purpose
--    Uses ON CONFLICT on purpose index so re-running is safe.
-- ---------------------------------------------------------------------------

-- item_generation — Claude Sonnet for writing items (creative, temp 0.8)
INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
SELECT
    (SELECT id FROM ai_providers WHERE name = 'OpenRouter'),
    'anthropic/claude-sonnet-4-5',
    'Claude Sonnet 4.5',
    false,
    '{"temperature": 0.8, "max_tokens": 4096}'::jsonb,
    'item_generation'
WHERE NOT EXISTS (
    SELECT 1 FROM ai_model_configs WHERE purpose = 'item_generation'
);

-- embedding — OpenAI text-embedding-3-small
INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
SELECT
    (SELECT id FROM ai_providers WHERE name = 'OpenRouter'),
    'openai/text-embedding-3-small',
    'OpenAI Text Embedding 3 Small',
    false,
    '{}'::jsonb,
    'embedding'
WHERE NOT EXISTS (
    SELECT 1 FROM ai_model_configs WHERE purpose = 'embedding'
);

-- preflight_analysis — Claude Sonnet, mid temp for construct discrimination
INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
SELECT
    (SELECT id FROM ai_providers WHERE name = 'OpenRouter'),
    'anthropic/claude-sonnet-4-5',
    'Claude Sonnet 4.5',
    false,
    '{"temperature": 0.5, "max_tokens": 2048}'::jsonb,
    'preflight_analysis'
WHERE NOT EXISTS (
    SELECT 1 FROM ai_model_configs WHERE purpose = 'preflight_analysis'
);

-- competency_matching — Claude Sonnet, low temp for consistent rankings
INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
SELECT
    (SELECT id FROM ai_providers WHERE name = 'OpenRouter'),
    'anthropic/claude-sonnet-4-5',
    'Claude Sonnet 4.5',
    false,
    '{"temperature": 0.3, "max_tokens": 4096}'::jsonb,
    'competency_matching'
WHERE NOT EXISTS (
    SELECT 1 FROM ai_model_configs WHERE purpose = 'competency_matching'
);

-- ranking_explanation — Claude Sonnet, mid temp for natural language
INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
SELECT
    (SELECT id FROM ai_providers WHERE name = 'OpenRouter'),
    'anthropic/claude-sonnet-4-5',
    'Claude Sonnet 4.5',
    false,
    '{"temperature": 0.5, "max_tokens": 2048}'::jsonb,
    'ranking_explanation'
WHERE NOT EXISTS (
    SELECT 1 FROM ai_model_configs WHERE purpose = 'ranking_explanation'
);

-- diagnostic_analysis — Claude Sonnet, mid temp for insights
INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
SELECT
    (SELECT id FROM ai_providers WHERE name = 'OpenRouter'),
    'anthropic/claude-sonnet-4-5',
    'Claude Sonnet 4.5',
    false,
    '{"temperature": 0.5, "max_tokens": 4096}'::jsonb,
    'diagnostic_analysis'
WHERE NOT EXISTS (
    SELECT 1 FROM ai_model_configs WHERE purpose = 'diagnostic_analysis'
);
