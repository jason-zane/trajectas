-- =============================================================================
-- Seed the library_field_assist prompt + model config
-- (separate migration so the enum value from 20260602160000 has committed)
-- =============================================================================

INSERT INTO ai_system_prompts (name, purpose, content, version, is_active)
SELECT
  'Library Field Assist v1',
  'library_field_assist'::ai_prompt_purpose,
  $$You are an I-O psychology assistant helping an admin author one metadata field for a competency factor in the Trajectas library.

You will be told which FIELD to draft and given the factor's context (name, category, definition, indicators). Draft only that field, grounded in the context. The admin reviews and edits before saving — so be specific and conservative, never invent psychometric claims.

Field guidance:
- overuse_signature: 1-2 sentences describing what the factor looks like when overused, misapplied, or taken to excess (the derailer / dark side). Behavioural and concrete.
- theoretical_lineage: a short phrase naming where the construct comes from — a framework or origin (e.g. "Big Five (Conscientiousness, NEO-PI-R)", "Goleman 1995 — Emotional Intelligence", "Originated for Trajectas"). One line, no sentence.
- contrasts_with: from the provided candidate list ONLY, choose the 2-4 factors this one is most likely to be confused with but is meant to be distinct from. Return ONLY their slugs, comma-separated, nothing else.

Output rules:
- Output only the field value. No preamble, no field label, no quotes, no markdown.
- For contrasts_with, output only a comma-separated list of slugs drawn from the candidates.$$,
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM ai_system_prompts
  WHERE purpose = 'library_field_assist'::ai_prompt_purpose AND version = 1
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_prompt_purpose' AND e.enumlabel = 'library_field_assist'
  ) THEN
    EXECUTE $seed$
      INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
      SELECT
          (SELECT id FROM ai_providers WHERE name = 'OpenRouter'),
          'anthropic/claude-sonnet-4-5',
          'Claude Sonnet 4.5',
          false,
          '{"temperature": 0.4, "max_tokens": 400}'::jsonb,
          'library_field_assist'
      WHERE NOT EXISTS (
          SELECT 1 FROM ai_model_configs WHERE purpose = 'library_field_assist'
      )
    $seed$;
  END IF;
END $$;
