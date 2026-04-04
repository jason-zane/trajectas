import type { GeneratedItemRaw } from './item-generation'

export interface CritiqueInput {
  items: GeneratedItemRaw[]
  constructName: string
  constructDefinition?: string
  constructDescription?: string
  constructIndicatorsLow?: string
  constructIndicatorsMid?: string
  constructIndicatorsHigh?: string
  contrastConstructs?: Array<{ name: string; definition?: string }>
}

export interface CritiqueVerdict {
  originalStem: string
  verdict: 'keep' | 'revise' | 'drop'
  revisedStem?: string
  reason?: string
}

export function buildCritiquePrompt(input: CritiqueInput): string {
  const constructSection = [
    `## Target Construct: ${input.constructName}`,
    input.constructDefinition ? `Definition: ${input.constructDefinition}` : null,
    input.constructDescription ? `Description: ${input.constructDescription}` : null,
    input.constructIndicatorsLow ? `Low scorers: ${input.constructIndicatorsLow}` : null,
    input.constructIndicatorsMid ? `Mid scorers: ${input.constructIndicatorsMid}` : null,
    input.constructIndicatorsHigh ? `High scorers: ${input.constructIndicatorsHigh}` : null,
  ].filter(Boolean).join('\n')

  const contrastSection = input.contrastConstructs?.length
    ? `\n## Contrast Constructs (items should NOT fit these):\n${input.contrastConstructs.map((c) => `- ${c.name}${c.definition ? `: ${c.definition}` : ''}`).join('\n')}`
    : ''

  const itemsSection = input.items
    .map((item, i) => `${i + 1}. "${item.stem}" (${item.reverseScored ? 'reverse-scored' : 'positively-scored'})`)
    .join('\n')

  return `Review the following ${input.items.length} items for the construct described below. For each item, decide whether to keep, revise, or drop it.

${constructSection}
${contrastSection}

## Items to Review

${itemsSection}

Return a JSON array with one entry per item, in the same order:
[{ "originalStem": "...", "verdict": "keep|revise|drop", "revisedStem": "...(only if revise)", "reason": "one sentence (required for revise and drop)" }]`
}

const VALID_VERDICTS = new Set(['keep', 'revise', 'drop'])

export function parseCritiqueResponse(jsonContent: string): CritiqueVerdict[] | null {
  try {
    const cleaned = jsonContent
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim()

    let parsed = JSON.parse(cleaned) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>
      const firstArray = Object.values(obj).find(Array.isArray)
      if (firstArray) parsed = firstArray
    }
    if (!Array.isArray(parsed)) return null

    return parsed.filter(
      (item): item is CritiqueVerdict =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).originalStem === 'string' &&
        typeof (item as Record<string, unknown>).verdict === 'string' &&
        VALID_VERDICTS.has((item as Record<string, unknown>).verdict as string),
    ).map((item) => ({
      originalStem: item.originalStem,
      verdict: item.verdict,
      ...(item.verdict === 'revise' && typeof item.revisedStem === 'string' ? { revisedStem: item.revisedStem } : {}),
      ...(item.reason && typeof item.reason === 'string' ? { reason: item.reason } : {}),
    }))
  } catch {
    return null
  }
}
