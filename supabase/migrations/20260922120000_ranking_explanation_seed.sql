-- =============================================================================
-- Jev competency-matching engine: seed the ranking_explanation system prompt
-- + model config.
--
-- Same guarded/idempotent pattern as
-- 20260529101000_architect_brief_extraction_seed.sql. The `ranking_explanation`
-- enum value already exists on ai_prompt_purpose (00001_initial_schema.sql),
-- so no enum guard is needed here.
--
-- Does NOT touch the competency_matching row — flipping that to the Jev
-- model id (typesafe/jev-1.13) is a separate operational step after deploy.
-- See docs/superpowers/specs/2026-09-22-jev-competency-matching-design.md
-- ("Reasons stage").
-- =============================================================================

-- 1. System prompt -------------------------------------------------------------
INSERT INTO ai_system_prompts (name, purpose, content, version, is_active)
SELECT
  'Ranking Explanation v1',
  'ranking_explanation'::ai_prompt_purpose,
  $$You are an organisational psychologist writing for a hiring manager who has just been shown which competencies an assessment will measure for their role. For each competency, write one or two plain sentences on why measuring it matters for THIS role, anchored in something specific from the role brief. Then write a two-sentence summary of what the set as a whole will and will not reveal. No headings, no jargon, no markdown. Return ONLY JSON: {"summary": string, "reasons": {"<factorId exactly as given>": string}}. Use the factorId from the list as the key, never the name.$$,
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM ai_system_prompts
  WHERE purpose = 'ranking_explanation'::ai_prompt_purpose AND version = 1
);

-- 2. Model config ---------------------------------------------------------------
-- Update in place if a ranking_explanation row already exists (production
-- currently has minimax/minimax-m2.5 there); otherwise insert one, like the
-- brief-extraction seed.
--
-- ai_model_configs.purpose is TEXT, not the ai_prompt_purpose enum (00033
-- added it as TEXT; 00036's later `ADD COLUMN IF NOT EXISTS purpose
-- ai_prompt_purpose` was a no-op against the already-existing column — see
-- "Production does not match the migrations" in AGENTS.md /
-- docs/schema-drift-audit-2026-08-16.md). No ::ai_prompt_purpose cast here.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM ai_model_configs WHERE purpose = 'ranking_explanation'
  ) THEN
    UPDATE ai_model_configs
    SET
      model_id = 'anthropic/claude-haiku-4.5',
      display_name = 'Claude Haiku 4.5',
      config = '{"temperature": 0.4, "max_tokens": 900}'::jsonb,
      updated_at = now()
    WHERE purpose = 'ranking_explanation';
  ELSE
    INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
    SELECT
        (SELECT id FROM ai_providers WHERE name = 'OpenRouter'),
        'anthropic/claude-haiku-4.5',
        'Claude Haiku 4.5',
        false,
        '{"temperature": 0.4, "max_tokens": 900}'::jsonb,
        'ranking_explanation';
  END IF;
END $$;
