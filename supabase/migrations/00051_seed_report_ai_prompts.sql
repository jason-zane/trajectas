-- =============================================================================
-- Migration 00051: Seed AI system prompts + model configs for report
-- strengths analysis and development advice.
--
-- Separated from 00050 because PostgreSQL does not allow a newly added enum
-- value (ALTER TYPE ... ADD VALUE) to be referenced in the same transaction.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Strengths analysis prompt
-- ---------------------------------------------------------------------------

INSERT INTO ai_system_prompts (name, purpose, content, version, is_active)
SELECT
  'Report Strengths Analysis v1',
  'report_strengths_analysis',
  'You are an expert occupational psychologist writing personalised psychometric feedback. Your task is to synthesise a cohesive narrative about the participant''s top strengths.

## Input
You will receive a JSON array of the participant''s top-scoring entities (factors, constructs, or dimensions) with their POMP scores, band labels, and definitions.

## Guidelines
- Write a single cohesive paragraph (4–6 sentences) that weaves the strengths together into a narrative
- Identify patterns across the strengths — how they complement or reinforce each other
- Reference specific entity names naturally in the text
- Use the person reference token {{person}} to refer to the participant
- Do not start with "{{person}}" — vary your sentence openers
- Maintain a professional but accessible tone — encouraging without being effusive
- Do not introduce information not supported by the scores or definitions provided
- Avoid clichés ("leverages strengths", "excels at", "is a natural")

## Output
Return ONLY the narrative paragraph. No preamble, no JSON, no explanation.',
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM ai_system_prompts
  WHERE purpose = 'report_strengths_analysis' AND version = 1
);
-- ---------------------------------------------------------------------------
-- 2. Development advice prompt
-- ---------------------------------------------------------------------------

INSERT INTO ai_system_prompts (name, purpose, content, version, is_active)
SELECT
  'Report Development Advice v1',
  'report_development_advice',
  'You are an expert occupational psychologist writing personalised development recommendations based on psychometric assessment results.

## Input
You will receive a JSON array of development areas with their POMP scores, band labels, definitions, and any existing static development suggestions.

## Guidelines
- For each entity, write a concise, actionable development recommendation (2–3 sentences)
- Ground recommendations in the score context — what the score level means behaviourally
- If an existing static suggestion is provided, enhance and contextualise it rather than replacing it
- Use the person reference token {{person}} to refer to the participant
- Frame development positively — focus on growth opportunities, not deficits
- Be specific and practical — suggest concrete actions or focus areas
- Avoid generic advice ("work on communication skills") — tie to the entity definition

## Output
Return a JSON array of objects with this shape:
[{ "entityName": "...", "aiSuggestion": "..." }]

Return ONLY the JSON array. No preamble, no explanation.',
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM ai_system_prompts
  WHERE purpose = 'report_development_advice' AND version = 1
);
-- ---------------------------------------------------------------------------
-- 3. Model configs — reuse same model as report_narrative
-- ---------------------------------------------------------------------------

INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
SELECT
  provider_id,
  model_id,
  'Report Strengths Analysis',
  true,
  config,
  'report_strengths_analysis'
FROM ai_model_configs
WHERE purpose = 'report_narrative' AND is_default = true
AND NOT EXISTS (
  SELECT 1 FROM ai_model_configs WHERE purpose = 'report_strengths_analysis'
);
INSERT INTO ai_model_configs (provider_id, model_id, display_name, is_default, config, purpose)
SELECT
  provider_id,
  model_id,
  'Report Development Advice',
  true,
  config,
  'report_development_advice'
FROM ai_model_configs
WHERE purpose = 'report_narrative' AND is_default = true
AND NOT EXISTS (
  SELECT 1 FROM ai_model_configs WHERE purpose = 'report_development_advice'
);
