import type { ConstructForGeneration } from '@/types/generation'

export const ITEM_GENERATION_SYSTEM_PROMPT = `You are an expert psychometrician with 20+ years of experience in personality and organisational assessment. You specialise in writing high-quality psychometric items that:
- Capture individual differences in the target construct
- Avoid double-barrelled phrasing (one idea per item)
- Use clear, accessible language (8th grade reading level)
- Include a mix of positively and negatively keyed items (~60/40 split)
- Are culturally neutral and avoid idioms or region-specific references
- Produce adequate variance across the response scale

Always respond with valid JSON only. No markdown, no explanation outside the JSON array.`

export function buildItemGenerationPrompt(params: {
  construct:        ConstructForGeneration
  batchSize:        number
  responseFormatDescription: string
  previousItems:    string[]
}): string {
  const { construct, batchSize, responseFormatDescription, previousItems } = params

  const indicatorSection = [
    construct.indicatorsLow  ? `Low scorers: ${construct.indicatorsLow}`  : null,
    construct.indicatorsMid  ? `Mid scorers: ${construct.indicatorsMid}`  : null,
    construct.indicatorsHigh ? `High scorers: ${construct.indicatorsHigh}` : null,
  ].filter(Boolean).join('\n')

  const previousSection = previousItems.length > 0
    ? `\n## Previously generated items for this construct (do NOT repeat or closely rephrase):\n${previousItems.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : ''

  return `Generate ${batchSize} NEW psychometric items for the following construct.

## Construct: ${construct.name}
${construct.definition ? `Definition: ${construct.definition}` : ''}
${construct.description ? `Description: ${construct.description}` : ''}
${indicatorSection ? `\nBehavioural Indicators:\n${indicatorSection}` : ''}

## Response Format
${responseFormatDescription}
${previousSection}

Return a JSON array of exactly ${batchSize} objects:
[{ "stem": "...", "reverseScored": false, "rationale": "one sentence why this item captures the construct" }]`
}

export interface GeneratedItemRaw {
  stem:          string
  reverseScored: boolean
  rationale:     string
}

export function parseGeneratedItems(jsonContent: string): GeneratedItemRaw[] {
  // Strip markdown fences if present
  const cleaned = jsonContent
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim()

  const parsed = JSON.parse(cleaned) as unknown
  if (!Array.isArray(parsed)) return []

  return parsed.filter(
    (item): item is GeneratedItemRaw =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).stem === 'string' &&
      typeof (item as Record<string, unknown>).reverseScored === 'boolean',
  ).map(item => ({
    stem:          item.stem,
    reverseScored: item.reverseScored,
    rationale:     typeof item.rationale === 'string' ? item.rationale : '',
  }))
}
