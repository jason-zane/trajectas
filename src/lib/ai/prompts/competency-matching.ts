/**
 * Prompt templates for the competency-matching use case.
 *
 * Instructs the AI to analyse organisational diagnostic data,
 * rank competencies by relevance, and return structured JSON.
 *
 * Bump PROMPT_VERSION whenever the system prompt changes so cached
 * results can be correlated with the exact prompt that produced them.
 */

import type { MatchingInput, CompetencyRanking } from '@/types/ai'

/** Current version of the matching prompt template. */
export const PROMPT_VERSION = 1

const SYSTEM_PROMPT = `You are an expert organisational psychologist and psychometric assessment designer working within the Talent Fit platform.

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
      "competencyId": "<string>",
      "competencyName": "<string>",
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
}`

/**
 * Build the complete prompt pair for a competency-matching request.
 */
export function buildMatchingPrompt(input: MatchingInput): {
  system: string
  user: string
} {
  return {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
  }
}

function buildUserPrompt(input: MatchingInput): string {
  const dimensions = Object.entries(input.diagnosticData)
    .map(([dimensionId, score]) => `- ${dimensionId}: ${score}`)
    .join('\n')

  const competencies = input.availableCompetencies
    .map((c) => `- **${c.name}** (${c.id})\n  ${c.description}`)
    .join('\n')

  return `## Diagnostic dimension scores

${dimensions}

## Available competencies

${competencies}

Analyse the diagnostic profile above, then rank the competencies by relevance. Return your answer as JSON following the schema described in the system prompt.`
}

/**
 * Type guard to validate a parsed object looks like valid ranking output.
 */
export function isValidRankingsPayload(
  value: unknown,
): value is { rankings: CompetencyRanking[]; summary: string; recommendedCount: { minimum: number; optimal: number; maximum: number } } {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (!Array.isArray(obj.rankings)) return false
  if (typeof obj.summary !== 'string') return false

  return obj.rankings.every(
    (r: unknown) =>
      typeof r === 'object' &&
      r !== null &&
      typeof (r as Record<string, unknown>).competencyId === 'string' &&
      typeof (r as Record<string, unknown>).competencyName === 'string' &&
      typeof (r as Record<string, unknown>).relevanceScore === 'number' &&
      typeof (r as Record<string, unknown>).reasoning === 'string' &&
      typeof (r as Record<string, unknown>).incrementalValue === 'number',
  )
}
