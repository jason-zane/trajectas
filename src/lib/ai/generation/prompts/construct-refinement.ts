import type { ConstructChange, ConstructDraftState } from '@/types/generation'

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
  allConstructs?: Array<{ name: string; definition?: string }>
  changes?: ConstructChange[]
}): string {
  const { constructName, currentDraft, overlappingPairs, parentFactors, allConstructs, changes } = params

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

  const overlappingNames = new Set(overlappingPairs.map((p) => p.otherConstructName))
  const landscapeConstructs = (allConstructs ?? []).filter(
    (c) => c.name !== constructName && !overlappingNames.has(c.name),
  )

  const landscapeSection = landscapeConstructs.length > 0
    ? `\n## Other Constructs in Set\n\nEach construct must maintain a unique behavioural lane. When revising fields to reduce overlap with the flagged constructs, ensure your suggestions do not drift toward any other construct in the set.\n\n${landscapeConstructs.map((c) => `- **${c.name}**: ${c.definition ?? '(no definition)'}`).join('\n')}`
    : ''

  const changesSection = changes?.length
    ? `\n\n## Changes Since Last Check\n\nThe following constructs were recently refined. Evaluate the current definitions on their own merit — do not re-litigate changes that were intentionally made unless they have created a genuine new problem.\n\n${changes.map((c) => `**${c.constructName}** — ${c.field} was updated:\n- Previous: "${c.previousValue}"\n- Current: "${c.currentValue}"`).join('\n\n')}`
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
${factorSection}${landscapeSection}${changesSection}

## Instructions

1. Identify which fields (definition, description, indicatorsLow, indicatorsMid, indicatorsHigh) are driving the overlap.
2. For each problematic field, suggest a revised version that preserves the original meaning while removing the overlap territory.
3. Do NOT suggest changes to fields that are already distinct — omit them from the suggestions array.
4. Only suggest changes to fields where the overlap is genuinely problematic. Prefer the smallest edit that resolves the issue. Do not rewrite fields that are already distinct — omit them from the suggestions array.
5. Your goal is surgical precision, not comprehensive rewriting.
6. In your analysis, explain what is driving the overlap and what sharpening direction you recommend.
7. Do NOT use markdown formatting (bold, italic, headers) in suggested text — return plain text only.

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

/** Strip markdown bold/italic from plain-text fields. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/\*(.+?)\*/g, '$1')        // *italic*
    .replace(/__(.+?)__/g, '$1')        // __bold__
    .replace(/_(.+?)_/g, '$1')          // _italic_
}

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
      analysis: stripMarkdown(parsed.analysis),
      suggestions: suggestions.map((s) => ({
        ...s,
        original: stripMarkdown(s.original),
        suggested: stripMarkdown(s.suggested),
        reason: stripMarkdown(s.reason),
      })),
    }
  } catch {
    return null
  }
}
