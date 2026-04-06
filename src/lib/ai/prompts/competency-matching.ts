/**
 * Prompt templates for the competency-matching use case.
 *
 * Instructs the AI to analyse client diagnostic data,
 * rank competencies by relevance, and return structured JSON.
 *
 * Bump PROMPT_VERSION whenever the system prompt changes so cached
 * results can be correlated with the exact prompt that produced them.
 */

import type { MatchingInput, FactorRanking } from '@/types/ai'

/** Current version of the matching prompt template. */
export const PROMPT_VERSION = 1

/**
 * Build the complete prompt pair for a competency-matching request.
 */
export function buildMatchingPrompt(input: MatchingInput): {
  user: string
} {
  return {
    user: buildUserPrompt(input),
  }
}

function buildUserPrompt(input: MatchingInput): string {
  const dimensions = Object.entries(input.diagnosticData)
    .map(([dimensionId, score]) => `- ${dimensionId}: ${score}`)
    .join('\n')

  const competencies = input.availableFactors
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
): value is { rankings: FactorRanking[]; summary: string; recommendedCount: { minimum: number; optimal: number; maximum: number } } {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (!Array.isArray(obj.rankings)) return false
  if (typeof obj.summary !== 'string') return false

  return obj.rankings.every(
    (r: unknown) =>
      typeof r === 'object' &&
      r !== null &&
      typeof (r as Record<string, unknown>).factorId === 'string' &&
      typeof (r as Record<string, unknown>).factorName === 'string' &&
      typeof (r as Record<string, unknown>).relevanceScore === 'number' &&
      typeof (r as Record<string, unknown>).reasoning === 'string' &&
      typeof (r as Record<string, unknown>).incrementalValue === 'number',
  )
}
