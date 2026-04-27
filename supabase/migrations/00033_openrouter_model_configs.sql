BEGIN;
-- =========================================================================
-- 00033_openrouter_model_configs.sql
-- Add purpose column to ai_model_configs + seed OpenRouter provider/models
-- =========================================================================

-- 1. Add purpose column (nullable — existing rows have no purpose)
ALTER TABLE ai_model_configs
  ADD COLUMN IF NOT EXISTS purpose TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_model_configs_purpose
  ON ai_model_configs(purpose)
  WHERE purpose IS NOT NULL;
-- 2. Insert OpenRouter provider (idempotent via ON CONFLICT)
INSERT INTO ai_providers (name, api_key_env_var, base_url, is_active)
VALUES (
  'OpenRouter',
  'OpenRouter_API_KEY',
  'https://openrouter.ai/api/v1',
  true
)
ON CONFLICT (name) DO UPDATE SET
  api_key_env_var = EXCLUDED.api_key_env_var,
  base_url        = EXCLUDED.base_url,
  is_active       = EXCLUDED.is_active;
-- 3b. Replace model-level unique constraint with purpose-level unique constraint.
--     Multiple purposes may legitimately use the same model_id (e.g. claude-sonnet-4-5
--     for matching, diagnostic, items, and pre-flight), so (provider_id, model_id) can
--     no longer be globally unique.  The new semantic key is (provider_id, purpose).
ALTER TABLE ai_model_configs
  DROP CONSTRAINT IF EXISTS ai_model_configs_model_unique;
ALTER TABLE ai_model_configs
  DROP CONSTRAINT IF EXISTS ai_model_configs_provider_purpose_unique;
ALTER TABLE ai_model_configs
  ADD CONSTRAINT ai_model_configs_provider_purpose_unique
  UNIQUE (provider_id, purpose);
-- 4. Seed model configs for each task purpose
--    Uses a CTE to get the provider id without knowing it ahead of time.
WITH provider AS (
  SELECT id FROM ai_providers WHERE name = 'OpenRouter'
)
INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, purpose, config)
SELECT
  provider.id,
  t.model_id,
  t.display_name,
  t.is_default,
  t.purpose,
  t.config
FROM provider,
(VALUES
  ('anthropic/claude-sonnet-4-5',      'Claude Sonnet 4.5 — Matching',     true,  'competency_matching',  '{"temperature": 0.3, "max_tokens": 4096}'::jsonb),
  ('google/gemini-2.0-flash-001',      'Gemini 2.0 Flash — Ranking',       true,  'ranking_explanation',  '{"temperature": 0.5, "max_tokens": 2048}'::jsonb),
  ('anthropic/claude-sonnet-4-5',      'Claude Sonnet 4.5 — Diagnostic',   true,  'diagnostic_analysis',  '{"temperature": 0.3, "max_tokens": 4096}'::jsonb),
  ('anthropic/claude-sonnet-4-5',      'Claude Sonnet 4.5 — Items',        true,  'item_generation',      '{"temperature": 0.8, "max_tokens": 4096}'::jsonb),
  ('anthropic/claude-sonnet-4-5',      'Claude Sonnet 4.5 — Pre-flight',   true,  'preflight_analysis',   '{"temperature": 0.3, "max_tokens": 2048}'::jsonb)
) AS t(model_id, display_name, is_default, purpose, config)
ON CONFLICT (provider_id, purpose) DO NOTHING;
COMMIT;
