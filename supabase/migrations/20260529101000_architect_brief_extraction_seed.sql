-- =============================================================================
-- Architect: seed the brief_extraction system prompt + model config
--
-- Separated from 20260529100000 because PostgreSQL does not allow a newly
-- added enum value (ALTER TYPE ... ADD VALUE) to be referenced in the same
-- transaction. Both inserts are guarded so resets and re-runs are idempotent.
-- =============================================================================

-- 1. System prompt -----------------------------------------------------------
INSERT INTO ai_system_prompts (name, purpose, content, version, is_active)
SELECT
  'Brief Extraction v1',
  'brief_extraction'::ai_prompt_purpose,
  $$You are an I-O psychology assistant for the Trajectas Assessment Architect.

You read free text about a role — a pasted or uploaded position description, or a short typed description — together with the decision the user is making, and you extract a single structured "brief" that a downstream matcher will use to select assessment factors.

Return ONLY a JSON object (no Markdown, no code fences, no commentary) with exactly this shape:

{
  "role_title": string,                  // best inference of the role title; "" if genuinely unclear
  "level": "ic" | "first_line_manager" | "mid_manager" | "senior_leader" | "executive",
  "function": string,                    // job family, e.g. "sales", "engineering", "operations"; "" if unclear
  "outcome": "selection" | "development" | "team_composition",
  "outcome_intent": string,              // the user's stated decision verbatim, e.g. "succession planning"
  "responsibilities": string[],          // 3-7 concise bullets drawn from the source
  "context_signals": string[],           // e.g. "fast-growth startup", "matrixed org", "regulated industry"
  "technical_requirements": string[],    // domain/technical skills explicitly mentioned
  "confidence": "high" | "medium" | "low" // how well the input supported a useful brief
}

Rules:
- Infer `level` from scope, reports, and seniority language; default to "mid_manager" only when there is genuinely no signal.
- `outcome` is the coarse stored category. Map the user's stated decision onto it: hiring / promotion / succession -> "selection"; development planning / coaching -> "development"; team build / balance -> "team_composition". Preserve the user's exact words in `outcome_intent`.
- Do not invent responsibilities or requirements that are not supported by the input. Fewer accurate bullets beat more speculative ones.
- Set `confidence` to "low" when the input is too thin to extract a meaningful brief (e.g. a single vague sentence). The caller may ask the user for more.
- Output valid JSON only.$$,
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM ai_system_prompts
  WHERE purpose = 'brief_extraction'::ai_prompt_purpose AND version = 1
);

-- 2. Model config -------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_prompt_purpose'
      AND e.enumlabel = 'brief_extraction'
  ) THEN
    EXECUTE $seed$
      INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
      SELECT
          (SELECT id FROM ai_providers WHERE name = 'OpenRouter'),
          'anthropic/claude-sonnet-4-5',
          'Claude Sonnet 4.5',
          false,
          '{"temperature": 0.2, "max_tokens": 1500}'::jsonb,
          'brief_extraction'
      WHERE NOT EXISTS (
          SELECT 1 FROM ai_model_configs WHERE purpose = 'brief_extraction'
      )
    $seed$;
  END IF;
END $$;
