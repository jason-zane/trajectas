-- =============================================================================
-- Architect: seed the architect_overview system prompt + model config
-- (separate migration so the enum value from 20260530170000 has committed)
-- =============================================================================

INSERT INTO ai_system_prompts (name, purpose, content, version, is_active)
SELECT
  'Architect Overview v1',
  'architect_overview'::ai_prompt_purpose,
  $$You are an I-O psychology assistant for the Trajectas Assessment Architect.

You are given a role brief and the set of competencies an admin has chosen to measure (plus a few notable competencies left out). Write a concise, plain-English summary for the admin.

Cover, in 2-3 sentences:
- What this assessment will actually reveal about candidates/participants for this role.
- What it does not cover well — the meaningful gaps — and, if relevant, what adding the left-out competencies would buy.

Rules:
- 2-3 sentences, no preamble, no bullet points, no markdown, no headings.
- Be specific and grounded in the brief and the chosen competencies. No hype, no filler.
- Speak to the admin designing the assessment, not the candidate.$$,
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM ai_system_prompts
  WHERE purpose = 'architect_overview'::ai_prompt_purpose AND version = 1
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_prompt_purpose' AND e.enumlabel = 'architect_overview'
  ) THEN
    EXECUTE $seed$
      INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
      SELECT
          (SELECT id FROM ai_providers WHERE name = 'OpenRouter'),
          'anthropic/claude-sonnet-4-5',
          'Claude Sonnet 4.5',
          false,
          '{"temperature": 0.4, "max_tokens": 400}'::jsonb,
          'architect_overview'
      WHERE NOT EXISTS (
          SELECT 1 FROM ai_model_configs WHERE purpose = 'architect_overview'
      )
    $seed$;
  END IF;
END $$;
