import type { ConstructForGeneration } from '@/types/generation'

export function buildItemGenerationPrompt(params: {
  construct:        ConstructForGeneration
  batchSize:        number
  responseFormatDescription: string
  previousItems:    string[]
  previousFacets?:  string[]
  difficultySteering?: string
  contrastConstructs?: Array<Pick<ConstructForGeneration, "name" | "definition" | "description">>
}): string {
  const {
    construct,
    batchSize,
    responseFormatDescription,
    previousItems,
    previousFacets = [],
    difficultySteering = '',
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

  const facetCoverageSection = previousFacets.length > 0
    ? `\n## Facet Coverage\nPrevious batches covered these facets: ${previousFacets.join(', ')}.\nExplore different behavioural expressions of the construct that are not yet represented.`
    : ''

  const parentFactorSection = construct.parentFactors && construct.parentFactors.length > 0
    ? `\n## Criterion Linkage — Parent Factors\nThis construct sits beneath the following higher-order factor(s). Items should be behaviourally consistent with these factors while remaining specific to the construct.\n${construct.parentFactors.map((f) => {
        const parts = [`- **${f.name}**`]
        if (f.definition) parts.push(`  Definition: ${f.definition}`)
        if (f.indicatorsHigh) parts.push(`  High-performer indicators: ${f.indicatorsHigh}`)
        return parts.join('\n')
      }).join('\n')}`
    : ''

  return `Generate ${batchSize} NEW psychometric items for the following construct.

## Construct: ${construct.name}
${construct.definition ? `Definition: ${construct.definition}` : ''}
${construct.description ? `Description: ${construct.description}` : ''}
${indicatorSection ? `\nBehavioural Indicators:\n${indicatorSection}` : ''}
${contrastSection}
${parentFactorSection}

## Response Format
${responseFormatDescription}
${previousSection}
${facetCoverageSection}
${difficultySteering}
## Per-Item Metadata
For each item, also provide:
- **difficultyTier**: How easy the item is to endorse. "easy" = most people agree, "moderate" = typical spread, "hard" = only strong scorers agree. For factor-level items use "foundation" / "applied" / "demanding" instead.
- **sdRisk**: Social desirability risk. "low" = neutral, "moderate" = somewhat desirable, "high" = strongly desirable or undesirable.
- **facet**: A 2–4 word label for the narrow behavioural facet this item taps (e.g. "conflict initiation", "schedule adherence").

## Diversity Requirements
- Cover different behavioural expressions of the construct rather than repeating one narrow theme.
- Vary the context, phrasing, and sentence openings across items.
- Include a mix of observable behaviour, judgement, tendency, and response-to-situation where appropriate.
- Do not generate generic "good employee" items that could fit several constructs equally well.
- Make each item specific enough that it clearly fits this construct better than the contrast constructs.

Return a JSON array of exactly ${batchSize} objects:
[{ "stem": "...", "reverseScored": false, "rationale": "one sentence why this item captures the construct", "difficultyTier": "moderate", "sdRisk": "low", "facet": "narrow facet label" }]`
}

export interface GeneratedItemRaw {
  stem:           string
  reverseScored:  boolean
  rationale:      string
  difficultyTier?: string
  sdRisk?:        string
  facet?:         string
}

const VALID_DIFFICULTY_TIERS = new Set(['easy', 'moderate', 'hard', 'foundation', 'applied', 'demanding'])
const VALID_SD_RISKS = new Set(['low', 'moderate', 'high'])

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
  ).map(item => {
    const raw = item as unknown as Record<string, unknown>
    const difficultyTier = typeof raw.difficultyTier === 'string' && VALID_DIFFICULTY_TIERS.has(raw.difficultyTier)
      ? raw.difficultyTier
      : undefined
    const sdRisk = typeof raw.sdRisk === 'string' && VALID_SD_RISKS.has(raw.sdRisk)
      ? raw.sdRisk
      : undefined
    const facet = typeof raw.facet === 'string' && raw.facet.length > 0
      ? raw.facet
      : undefined
    return {
      stem:           item.stem,
      reverseScored:  item.reverseScored,
      rationale:      typeof item.rationale === 'string' ? item.rationale : '',
      difficultyTier,
      sdRisk,
      facet,
    }
  })
}
