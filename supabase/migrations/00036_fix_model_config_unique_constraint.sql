-- =============================================================================
-- Migration 00036: Fix ai_model_configs for purpose-based config
-- =============================================================================
-- Migrations 00033-00035 were already marked as applied before their SQL was
-- written, so the enum additions and index never ran. This migration adds all
-- missing enum values, creates the purpose unique index, seeds the OpenRouter
-- provider, and upserts one config row per AI task purpose.
-- =============================================================================

-- 1. Add missing enum values (safe to re-run)
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'item_generation';
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'preflight_analysis';
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'embedding';
ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'chat';

-- 2. Drop old unique constraint if it still exists
ALTER TABLE ai_model_configs
    DROP CONSTRAINT IF EXISTS ai_model_configs_model_unique;

-- 3. Add purpose column if missing
ALTER TABLE ai_model_configs
    ADD COLUMN IF NOT EXISTS purpose ai_prompt_purpose;

-- 4. Remove any duplicate purpose rows before creating the index
DELETE FROM ai_model_configs a
USING ai_model_configs b
WHERE a.purpose IS NOT NULL
  AND a.purpose = b.purpose
  AND a.ctid < b.ctid;

-- 5. Create partial unique index on purpose
CREATE UNIQUE INDEX IF NOT EXISTS ai_model_configs_purpose_unique
    ON ai_model_configs (purpose)
    WHERE purpose IS NOT NULL;

-- 6. Seed OpenRouter provider if not present
INSERT INTO ai_providers (id, name, api_key_env_var, base_url, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'OpenRouter',
    'OpenRouter_API_KEY',
    'https://openrouter.ai/api/v1',
    true
)
ON CONFLICT (name) DO NOTHING;

-- 7. Upsert one config row per purpose
-- Note: no explicit ::ai_prompt_purpose cast — PostgreSQL coerces text→enum
-- implicitly on column assignment, avoiding "enum value not yet committed" errors.
INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
SELECT
    p.id,
    v.model_id,
    v.display_name,
    false,
    v.config::jsonb,
    v.purpose
FROM (VALUES
    ('anthropic/claude-sonnet-4-5',  'Claude Sonnet 4.5',      '{"temperature":0.8,"max_tokens":4096}', 'item_generation'),
    ('anthropic/claude-sonnet-4-5',  'Claude Sonnet 4.5',      '{"temperature":0.3,"max_tokens":2048}', 'preflight_analysis'),
    ('openai/text-embedding-3-small','Text Embedding 3 Small',  '{}',                                   'embedding'),
    ('anthropic/claude-sonnet-4-5',  'Claude Sonnet 4.5',      '{"temperature":0.3,"max_tokens":4096}', 'competency_matching'),
    ('anthropic/claude-sonnet-4-5',  'Claude Sonnet 4.5',      '{"temperature":0.5,"max_tokens":2048}', 'ranking_explanation'),
    ('anthropic/claude-sonnet-4-5',  'Claude Sonnet 4.5',      '{"temperature":0.5,"max_tokens":4096}', 'diagnostic_analysis'),
    ('anthropic/claude-sonnet-4-5',  'Claude Sonnet 4.5',      '{"temperature":0.7,"max_tokens":4096}', 'chat')
) AS v(model_id, display_name, config, purpose)
CROSS JOIN (SELECT id FROM ai_providers WHERE name = 'OpenRouter') AS p
ON CONFLICT (purpose) WHERE purpose IS NOT NULL
DO UPDATE SET
    model_id     = EXCLUDED.model_id,
    display_name = EXCLUDED.display_name;
