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
-- ---------------------------------------------------------------------------
-- The initial data seeding is handled in 00036_fix_model_config_unique_constraint.
-- PostgreSQL enum values added above are not safe to reuse again in the same
-- transaction during a clean migration replay.
