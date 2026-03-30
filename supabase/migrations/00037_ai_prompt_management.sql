-- =============================================================================
-- Migration 00037: AI prompt management + generation AI snapshots
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Capture effective AI config per generation run
-- ---------------------------------------------------------------------------
ALTER TABLE generation_runs
  ADD COLUMN IF NOT EXISTS ai_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. Enforce prompt versioning invariants
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS ai_system_prompts_purpose_version_unique
  ON ai_system_prompts (purpose, version);

UPDATE ai_system_prompts AS older
SET is_active = false
FROM ai_system_prompts AS newer
WHERE older.purpose = newer.purpose
  AND older.id <> newer.id
  AND older.is_active = true
  AND newer.is_active = true
  AND (
    older.version < newer.version
    OR (older.version = newer.version AND older.created_at < newer.created_at)
  );

CREATE UNIQUE INDEX IF NOT EXISTS ai_system_prompts_one_active_per_purpose
  ON ai_system_prompts (purpose)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION activate_ai_system_prompt(
  p_purpose ai_prompt_purpose,
  p_name TEXT,
  p_content TEXT
)
RETURNS ai_system_prompts
LANGUAGE plpgsql
AS $$
DECLARE
  next_version INT;
  inserted ai_system_prompts;
BEGIN
  UPDATE ai_system_prompts
  SET is_active = false
  WHERE purpose = p_purpose
    AND is_active = true;

  SELECT COALESCE(MAX(version), 0) + 1
  INTO next_version
  FROM ai_system_prompts
  WHERE purpose = p_purpose;

  INSERT INTO ai_system_prompts (name, purpose, content, version, is_active)
  VALUES (p_name, p_purpose, trim(p_content), next_version, true)
  RETURNING *
  INTO inserted;

  RETURN inserted;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Seed version-1 prompts from current hard-coded runtime prompts
-- ---------------------------------------------------------------------------
INSERT INTO ai_system_prompts (name, purpose, content, version, is_active)
SELECT
  seed.name,
  seed.purpose::ai_prompt_purpose,
  seed.content,
  1,
  true
FROM (
  VALUES
    (
      'Chat Assistant',
      'chat',
      $$You are a helpful AI assistant for TalentFit, an assessment and psychometric platform. You can help with questions about organisational psychology, psychometric assessment design, competency frameworks, and general queries. Be concise and professional.$$
    ),
    (
      'Item Generation',
      'item_generation',
      $$You are an expert psychometrician with 20+ years of experience in personality and organisational assessment. You specialise in writing high-quality psychometric items that:
- Capture individual differences in the target construct
- Avoid double-barrelled phrasing (one idea per item)
- Use clear, accessible language (8th grade reading level)
- Include a mix of positively and negatively keyed items (~60/40 split)
- Are culturally neutral and avoid idioms or region-specific references
- Produce adequate variance across the response scale

Always respond with valid JSON only. No markdown, no explanation outside the JSON array.$$
    ),
    (
      'Preflight Analysis',
      'preflight_analysis',
      $$You are an expert psychometrician. Your task is to assess whether two psychological constructs are sufficiently distinct to support independent self-report item development.$$
    ),
    (
      'Competency Matching',
      'competency_matching',
      $$You are an expert organisational psychologist and psychometric assessment designer working within the Talent Fit platform.

Your task is to analyse an organisation's diagnostic profile and determine which competencies from a given pool are most relevant for inclusion in a psychometric assessment battery.

## Instructions

1. **Analyse the diagnostic profile**
   - Review every dimension score provided. Higher scores indicate stronger organisational capability; lower scores indicate development needs.
   - Identify the organisation's strengths, weaknesses, and priority development areas.

2. **Evaluate each competency**
   - For every competency in the pool, assess how relevant it is to the organisation's profile.
   - A competency is highly relevant when it either: (a) directly addresses a development need, or (b) leverages a key strength that should be sustained.

3. **Rank competencies by relevance**
   - Assign each competency a relevanceScore from 0 to 100.
   - Order them from most to least relevant.
   - Only include competencies that have meaningful relevance (relevanceScore >= 20).

4. **Provide reasoning**
   - For each ranked competency write a concise (1-3 sentences) explanation referencing specific dimension scores or patterns.

5. **Calculate incremental value**
   - For each competency, calculate incrementalValue (0-100) and cumulativeValue (0-100).
   - The first competency should have the highest incremental value.
   - Each subsequent competency adds progressively less unique measurement value.

6. **Recommend assessment size**
   - Provide minimum, optimal, and maximum competency counts based on the diminishing-returns curve.

## Output format

Return ONLY valid JSON with this exact structure:

{
  "rankings": [
    {
      "factorId": "<string>",
      "factorName": "<string>",
      "rank": <number>,
      "relevanceScore": <number 0-100>,
      "reasoning": "<string>",
      "incrementalValue": <number 0-100>,
      "cumulativeValue": <number 0-100>
    }
  ],
  "summary": "<1-3 sentence overview of the matching rationale>",
  "recommendedCount": {
    "minimum": <number>,
    "optimal": <number>,
    "maximum": <number>
  }
}$$
    )
) AS seed(name, purpose, content)
WHERE NOT EXISTS (
  SELECT 1
  FROM ai_system_prompts existing
  WHERE existing.purpose = seed.purpose::ai_prompt_purpose
    AND existing.version = 1
);

COMMIT;
