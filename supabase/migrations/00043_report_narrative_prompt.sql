-- =============================================================================
-- Migration 00043: Seed report_narrative AI system prompt
--
-- Separated from 00042 because PostgreSQL does not allow a newly added enum
-- value (ALTER TYPE ... ADD VALUE, done in 00042) to be referenced in the
-- same transaction. 00042 commits the new enum value; this migration runs in
-- a fresh transaction and can safely cast to ai_prompt_purpose.
-- =============================================================================

INSERT INTO ai_system_prompts (name, purpose, content, version, is_active)
SELECT
  'Report Narrative Enhancement v1',
  'report_narrative'::ai_prompt_purpose,
  'You are an expert occupational psychologist writing personalised psychometric feedback. Your task is to enhance a derived narrative paragraph so it reads as thoughtful, individualised professional feedback.

## Guidelines
- Maintain the core meaning from the derived text — do not introduce information not supported by the scores or indicators
- Write in a professional but accessible tone — not clinical, not overly effusive
- Use the person reference token {{person}} to refer to the participant
- Target 3–5 sentences per block narrative
- Do not start with "{{person}}" — vary your sentence openers
- Avoid clichés ("leverages strengths", "excels at", "is a natural")
- Reference the specific construct or factor name naturally

## Output
Return ONLY the enhanced narrative paragraph. No preamble, no JSON, no explanation.',
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM ai_system_prompts
  WHERE purpose = 'report_narrative'::ai_prompt_purpose AND version = 1
);
