/**
 * Prompt templates for the competency-matching use case.
 *
 * Instructs the AI to analyse client diagnostic data,
 * rank competencies by relevance, and return structured JSON.
 *
 * Bump PROMPT_VERSION whenever the system prompt changes so cached
 * results can be correlated with the exact prompt that produced them.
 */

import type { Brief, MatchingInput, MatchingSource, FactorRanking } from '@/types/ai'

/** Current version of the matching prompt template. */
export const PROMPT_VERSION = 2

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
  const factors = input.availableFactors
    .map((f) => {
      const fns = f.applicableFunctions?.length
        ? ` _(suited to functions: ${f.applicableFunctions.join(', ')})_`
        : ''
      return `- **${f.name}** (${f.id})${fns}\n  ${f.definition}`
    })
    .join('\n')

  return `${buildSignal(input.source)}

## Available factors

${factors}

Analyse the signal above, then rank the factors by relevance. Return your answer as JSON following the schema described in the system prompt.`
}

/** Render the source signal — either diagnostic scores or a role brief. */
function buildSignal(source: MatchingSource): string {
  if (source.kind === 'diagnostic') {
    const dimensions = Object.entries(source.diagnosticData)
      .map(([dimensionId, score]) => `- ${dimensionId}: ${score}`)
      .join('\n')
    return `## Diagnostic dimension scores\n\n${dimensions}`
  }
  return buildBriefSignal(source.brief)
}

function buildBriefSignal(brief: Brief): string {
  const list = (items: string[]) =>
    items.length ? items.map((i) => `- ${i}`).join('\n') : '- (none stated)'

  return `## Role brief

- **Role title:** ${brief.roleTitle || '(unspecified)'}
- **Level:** ${brief.level}
- **Function:** ${brief.function || '(unspecified)'}
- **Decision (outcome):** ${brief.outcome}
- **Stated intent:** ${brief.outcomeIntent || brief.outcome}

### Responsibilities
${list(brief.responsibilities)}

### Context signals
${list(brief.contextSignals)}

### Technical requirements
${list(brief.technicalRequirements)}`
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
