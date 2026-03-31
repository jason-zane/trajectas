import type { ConstructForGeneration } from '@/types/generation'

export function buildItemGenerationPrompt(params: {
  construct:        ConstructForGeneration
  batchSize:        number
  responseFormatDescription: string
  previousItems:    string[]
  contrastConstructs?: Array<Pick<ConstructForGeneration, "name" | "definition" | "description">>
}): string {
  const {
    construct,
    batchSize,
    responseFormatDescription,
    previousItems,
    contrastConstructs = [],
  } = params

  const indicatorSection = [
    construct.indicatorsLow  ? `Low scorers: ${construct.indicatorsLow}`  : null,
    construct.indicatorsMid  ? `Mid scorers: ${construct.indicatorsMid}`  : null,
    construct.indicatorsHigh ? `High scorers: ${construct.indicatorsHigh}` : null,
  ].filter(Boolean).join('\n')

  const contrastSection = contrastConstructs.length > 0
    ? `\n## Keep This Construct Distinct From:\n${contrastConstructs
        .map((other) => `- ${other.name}${other.definition ? `: ${other.definition}` : other.description ? `: ${other.description}` : ''}`)
        .join('\n')}`
    : ''

  const previousSection = previousItems.length > 0
    ? `\n## Existing or already-generated items for this construct (do NOT repeat, paraphrase, or make a near-neighbour of any of these):\n${previousItems.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : ''

  return `Generate ${batchSize} NEW psychometric items for the following construct.

## Construct: ${construct.name}
${construct.definition ? `Definition: ${construct.definition}` : ''}
${construct.description ? `Description: ${construct.description}` : ''}
${indicatorSection ? `\nBehavioural Indicators:\n${indicatorSection}` : ''}
${contrastSection}

## Response Format
${responseFormatDescription}
${previousSection}

## Diversity Requirements
- Cover different behavioural expressions of the construct rather than repeating one narrow theme.
- Vary the context, phrasing, and sentence openings across items.
- Include a mix of observable behaviour, judgement, tendency, and response-to-situation where appropriate.
- Do not generate generic "good employee" items that could fit several constructs equally well.
- Make each item specific enough that it clearly fits this construct better than the contrast constructs.

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

  let parsed = JSON.parse(cleaned) as unknown
  // Models sometimes wrap the array in an object like { "items": [...] }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    const firstArray = Object.values(obj).find(Array.isArray)
    if (firstArray) parsed = firstArray
  }
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
