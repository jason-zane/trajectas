import type { ConstructChange } from '@/types/generation'

export function buildDiscriminationPrompt(
  constructA: {
    name: string
    definition: string
    description?: string
    indicatorsLow?: string
    indicatorsMid?: string
    indicatorsHigh?: string
  },
  constructB: {
    name: string
    definition: string
    description?: string
    indicatorsLow?: string
    indicatorsMid?: string
    indicatorsHigh?: string
  },
  context?: {
    otherConstructs?: Array<{ name: string; definition?: string }>
    changes?: ConstructChange[]
  },
): string {
  const renderConstruct = (
    label: string,
    construct: {
      name: string
      definition: string
      description?: string
      indicatorsLow?: string
      indicatorsMid?: string
      indicatorsHigh?: string
    },
  ) => {
    return [
      `## ${label}: ${construct.name}`,
      `Definition: ${construct.definition}`,
      construct.description ? `Description: ${construct.description}` : null,
      construct.indicatorsLow ? `Low indicators: ${construct.indicatorsLow}` : null,
      construct.indicatorsMid ? `Mid indicators: ${construct.indicatorsMid}` : null,
      construct.indicatorsHigh ? `High indicators: ${construct.indicatorsHigh}` : null,
    ].filter(Boolean).join('\n')
  }

  const landscapeSection = context?.otherConstructs?.length
    ? `\n## Construct Landscape\n\nThe full set of constructs in this generation run is listed below. When assessing overlap between Construct A and Construct B, consider whether behavioural territory you might suggest moving toward is already occupied by another construct in the set.\n\n${context.otherConstructs.map((c) => `- **${c.name}**: ${c.definition ?? '(no definition)'}`).join('\n')}\n`
    : ''

  const changesSection = context?.changes?.length
    ? `\n## Changes Since Last Check\n\nThe following constructs were recently refined. Evaluate the current definitions on their own merit — do not re-litigate changes that were intentionally made unless they have created a genuine new problem.\n\n${context.changes.map((c) => `**${c.constructName}** — ${c.field} was updated:\n- Previous: "${c.previousValue}"\n- Current: "${c.currentValue}"`).join('\n\n')}\n`
    : ''

  return `Assess whether these two constructs can produce clearly discriminating self-report items.

${renderConstruct('Construct A', constructA)}

${renderConstruct('Construct B', constructB)}
${landscapeSection}${changesSection}
Focus on the behavioural boundary between the constructs.
- "green" means the constructs are clearly distinct and should support independent item generation.
- "amber" means the constructs are distinguishable, but their current wording is close enough that definitions should be sharpened before generation.
- "red" means the constructs materially overlap and are likely to produce cross-loading or poorly discriminating items unless redefined.

Generate 3 example items that would ONLY belong to Construct A and 3 that would ONLY belong to Construct B.
If there is overlap, explain the shared behavioural territory and how each construct should be tightened.

For each construct, also map it to the Big Five (OCEAN) framework:
- Identify the primary Big Five domain it most closely relates to.
- If the construct closely matches a known facet from established inventories (e.g. NEO-PI-R, IPIP), name it.
- List any additional Big Five domains the construct intersects with.

Respond in JSON:
{
  "canDiscriminate": true | false,
  "status": "green" | "amber" | "red",
  "overlapSummary": "one or two sentences on the overlap boundary",
  "sharedSignals": ["shared theme 1", "shared theme 2"],
  "uniqueSignalsA": ["distinctive signal for A", "distinctive signal for A"],
  "uniqueSignalsB": ["distinctive signal for B", "distinctive signal for B"],
  "itemsForA": ["item1", "item2", "item3"],
  "itemsForB": ["item1", "item2", "item3"],
  "refinementGuidanceA": "how to sharpen construct A so it is less confusable with B",
  "refinementGuidanceB": "how to sharpen construct B so it is less confusable with A",
  "explanation": "brief explanation",
  "bigFiveMappingA": {
    "primaryDomain": "one of: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism",
    "knownFacetMatch": "name of known facet or null if novel",
    "intersectionDomains": ["other Big Five domains this construct touches"],
    "note": "optional clarifying note"
  },
  "bigFiveMappingB": {
    "primaryDomain": "...",
    "knownFacetMatch": "...",
    "intersectionDomains": [],
    "note": "..."
  }
}`
}
