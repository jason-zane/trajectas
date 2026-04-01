import type { ConstructDraftState } from '@/types/generation'

interface RefinementPairContext {
  otherConstructName: string
  cosineSimilarity: number
  overlapSummary?: string
  sharedSignals?: string[]
  uniqueSignalsForTarget?: string[]
  refinementGuidance?: string
}

interface ParentFactorContext {
  name: string
  definition?: string
  indicatorsHigh?: string
}

export interface RefinementSuggestion {
  field: keyof ConstructDraftState
  original: string
  suggested: string
  reason: string
}

export interface RefinementResult {
  analysis: string
  suggestions: RefinementSuggestion[]
}

export function buildRefinementPrompt(params: {
  constructName: string
  currentDraft: ConstructDraftState
  overlappingPairs: RefinementPairContext[]
  parentFactors: ParentFactorContext[]
}): string {
  const { constructName, currentDraft, overlappingPairs, parentFactors } = params

  const pairsSection = overlappingPairs.map((pair) => {
    const parts = [`- **${pair.otherConstructName}** (cosine: ${pair.cosineSimilarity.toFixed(3)})`]
    if (pair.overlapSummary) parts.push(`  Overlap: ${pair.overlapSummary}`)
    if (pair.sharedSignals?.length) parts.push(`  Shared signals: ${pair.sharedSignals.join(', ')}`)
    if (pair.uniqueSignalsForTarget?.length) parts.push(`  Unique to ${constructName}: ${pair.uniqueSignalsForTarget.join(', ')}`)
    if (pair.refinementGuidance) parts.push(`  Guidance: ${pair.refinementGuidance}`)
    return parts.join('\n')
  }).join('\n')

  const factorSection = parentFactors.length > 0
    ? `\n## Parent Factors\nThis construct sits beneath the following higher-order factor(s). Use this hierarchy to inform the sharpening direction.\n${parentFactors.map((f) => {
        const parts = [`- **${f.name}**`]
        if (f.definition) parts.push(`  Definition: ${f.definition}`)
        if (f.indicatorsHigh) parts.push(`  High-performer indicators: ${f.indicatorsHigh}`)
        return parts.join('\n')
      }).join('\n')}\n\nIf the construct sits under multiple factors, look for a sharpening direction that serves all of them, or note where the factor contexts suggest different directions.`
    : ''

  const fieldsSection = [
    `Definition: ${currentDraft.definition || '(empty)'}`,
    `Description: ${currentDraft.description || '(empty)'}`,
    `Low indicators: ${currentDraft.indicatorsLow || '(empty)'}`,
    `Mid indicators: ${currentDraft.indicatorsMid || '(empty)'}`,
    `High indicators: ${currentDraft.indicatorsHigh || '(empty)'}`,
  ].join('\n')

  return `Analyse the following construct and suggest targeted improvements to reduce overlap with neighbouring constructs. Only suggest changes to fields that are contributing to the overlap — leave distinct fields untouched.

## Construct: ${constructName}

### Current Fields
${fieldsSection}

## Overlapping Constructs
${pairsSection}
${factorSection}

## Instructions

1. Identify which fields (definition, description, indicatorsLow, indicatorsMid, indicatorsHigh) are driving the overlap.
2. For each problematic field, suggest a revised version that preserves the original meaning while removing the overlap territory.
3. Do NOT suggest changes to fields that are already distinct — omit them from the suggestions array.
4. In your analysis, explain what is driving the overlap and what sharpening direction you recommend.

Respond in JSON:
{
  "analysis": "2-3 sentences explaining what drives the overlap and the recommended direction",
  "suggestions": [
    {
      "field": "definition | description | indicatorsLow | indicatorsMid | indicatorsHigh",
      "original": "the current text",
      "suggested": "the improved text",
      "reason": "one sentence why this field needs change"
    }
  ]
}`
}

const VALID_FIELDS = new Set(['definition', 'description', 'indicatorsLow', 'indicatorsMid', 'indicatorsHigh'])

export function parseRefinementResponse(jsonContent: string): RefinementResult | null {
  try {
    const cleaned = jsonContent
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim()

    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    if (typeof parsed.analysis !== 'string') return null

    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((s): s is RefinementSuggestion =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as Record<string, unknown>).field === 'string' &&
          VALID_FIELDS.has((s as Record<string, unknown>).field as string) &&
          typeof (s as Record<string, unknown>).original === 'string' &&
          typeof (s as Record<string, unknown>).suggested === 'string' &&
          typeof (s as Record<string, unknown>).reason === 'string'
        )
      : []

    return {
      analysis: parsed.analysis,
      suggestions,
    }
  } catch {
    return null
  }
}
