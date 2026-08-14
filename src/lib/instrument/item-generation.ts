/**
 * Pure prompt builder and response parser for AI-assisted per-cell item generation.
 *
 * The instrument builder engine designs one batch of items per blueprint cell.
 * A cell is (facetLabel, intensity, targetItemCount). This module constructs a
 * steered prompt that branches intensity guidance by measure type, includes contrast
 * (sibling facets + exclusions), and parses the response into candidates.
 *
 * The server action (`src/app/actions/instrument.ts`) invokes the LLM and passes
 * the response to `parseGeneratedItems()` for normalization.
 *
 * @module
 */

import type { Intensity, MeasureType } from './types'

// ---------------------------------------------------------------------------
// System Prompt & Input Types
// ---------------------------------------------------------------------------

export const DEFAULT_ITEM_GENERATION_SYSTEM_PROMPT = `You are an expert psychometrician writing measurement items for a structured instrument. Your task is to generate items that fit a specific blueprint cell: a facet of a construct at a given intensity level.

**Key principles:**

1. **One behaviour per stem:** Each item describes exactly one observable behaviour, attitude, or judgment. Do not write double-barrelled items that ask two things at once.

2. **No absolutes unless warranted:** Avoid stems with "always" or "never" unless the intensity genuinely calls for such extremes. Most items should admit of nuance and individual variation.

3. **Plain language:** Write for the audience level specified. Avoid jargon, acronyms, and abstract pseudo-psychological claims. The respondent should clearly understand what the item is asking.

4. **Facet specificity:** Each item must belong to the facet you are writing for. It must be distinguishable from the other facets listed (contrast set). Do not write generic "I am a good employee" statements that could apply to any construct.

5. **Exclusion clarity:** Avoid territory that belongs to the exclusions listed. If an item reads like it could be part of a different construct, revise it.

6. **Reverse scoring:** Mark items that are worded negatively or need reverse-scoring explicitly. This helps with later analysis.

7. **Rationale:** Briefly explain why each item works — what behaviour, attitude, or judgment it targets, and why it fits the intensity level.

Return your response as a JSON array of items with the following structure:

\`\`\`json
[
  {
    "stem": "I tend to delegate tasks rather than doing everything myself.",
    "reverseScored": false,
    "rationale": "Captures low-intensity delegation: comfort with letting others handle work, not necessarily strategic skill.",
    "sdRisk": "moderate",
    "facet": "Delegation"
  },
  {
    "stem": "I struggle to trust others with important work.",
    "reverseScored": true,
    "rationale": "Reverse-worded to capture high-intensity trust: only strong trust builders disagree.",
    "sdRisk": "low",
    "facet": "Delegation"
  }
]
\`\`\`

**Respond with ONLY the JSON array. No preamble, no explanation, no prose.**`

export interface CellGenerationInput {
  constructName: string
  constructDefinition?: string
  measureType: MeasureType
  facetLabel: string
  facetDefinition?: string
  intensity: Intensity
  count: number
  responseFormatDescription?: string
  existingStems?: string[]
  siblingFacets?: Array<{ facetLabel: string; facetDefinition?: string }>
  exclusions?: string[]
  audienceLevel?: string
  useContext?: string
}

export interface GeneratedItemDraft {
  stem: string
  reverseScored: boolean
  rationale?: string
  sdRisk?: 'low' | 'moderate' | 'high'
  facet?: string
}

export interface ItemGenerationResult {
  items: GeneratedItemDraft[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build a prompt string for AI-assisted item generation for a specific blueprint cell.
 *
 * The prompt includes:
 * - Construct name, definition, and the facet being measured
 * - Intensity guidance (branched by measure type)
 * - Contrast (sibling facets + exclusions)
 * - Response format guidance
 * - Existing stems to avoid duplication
 * - Audience and use-context hints
 * - Target item count
 */
export function buildCellGenerationPrompt(input: CellGenerationInput): string {
  const lines: string[] = []

  lines.push(`Construct: ${input.constructName}`)
  lines.push('')

  if (input.constructDefinition) {
    lines.push(`Construct definition: ${input.constructDefinition}`)
    lines.push('')
  }

  lines.push(`Facet: ${input.facetLabel}`)
  lines.push('')

  if (input.facetDefinition) {
    lines.push(`Facet definition: ${input.facetDefinition}`)
    lines.push('')
  }

  // Intensity guidance, branched by measure type
  const intensityGuidance = renderIntensityGuidance(input.measureType, input.intensity)
  if (intensityGuidance) {
    lines.push(intensityGuidance)
    lines.push('')
  }

  // Contrast: sibling facets
  if (input.siblingFacets && input.siblingFacets.length > 0) {
    lines.push('Distinguish this facet from the other facets of the same construct:')
    input.siblingFacets.forEach(sf => {
      const label = sf.facetDefinition ? `${sf.facetLabel}: ${sf.facetDefinition}` : sf.facetLabel
      lines.push(`  • ${label}`)
    })
    lines.push('')
  }

  // Contrast: exclusions
  if (input.exclusions && input.exclusions.length > 0) {
    lines.push('Avoid territory belonging to these exclusions:')
    input.exclusions.forEach(ex => {
      lines.push(`  • ${ex}`)
    })
    lines.push('')
  }

  // Response format
  if (input.responseFormatDescription) {
    lines.push(`Response format: ${input.responseFormatDescription}`)
    lines.push('')
  }

  // Existing stems to avoid
  if (input.existingStems && input.existingStems.length > 0) {
    lines.push('Do not repeat or closely paraphrase these existing stems:')
    input.existingStems.slice(0, 10).forEach(stem => {
      lines.push(`  • ${stem}`)
    })
    if (input.existingStems.length > 10) {
      lines.push(`  (${input.existingStems.length - 10} more existing stems omitted)`)
    }
    lines.push('')
  }

  // Audience and use-context
  if (input.audienceLevel) {
    lines.push(`Audience: ${input.audienceLevel}`)
  }
  if (input.useContext) {
    lines.push(`Use context: ${input.useContext}`)
  }
  if (input.audienceLevel || input.useContext) {
    lines.push('')
  }

  lines.push(`Generate exactly ${input.count} items for this cell.`)

  return lines.join('\n')
}

/**
 * Render intensity guidance branched by measure type.
 * Decision 2: intensity has different meanings depending on measure type.
 */
function renderIntensityGuidance(measureType: MeasureType, intensity: Intensity): string {
  // Measure types where intensity is endorsement threshold
  const endorsementThresholdTypes: MeasureType[] = [
    'trait',
    'competency_behavioural',
    'preference',
    'climate',
  ]

  // Measure types where intensity is item difficulty
  const difficultyTypes: MeasureType[] = ['capability', 'sjt']

  if (endorsementThresholdTypes.includes(measureType)) {
    if (intensity === 'low') {
      return `Intensity: Low (endorsement threshold).
Items at low intensity should describe a baseline expression of the facet — most people in the target population would endorse these statements. They are the accessible entry point, not discriminating, but true to the construct.`
    }
    if (intensity === 'mid') {
      return `Intensity: Mid (endorsement threshold).
Items at mid intensity should discriminate around the middle of the range. They are neither too easy nor too hard to endorse — they distinguish typical performers from both low and high performers.`
    }
    if (intensity === 'high') {
      return `Intensity: High (endorsement threshold).
Items at high intensity should describe behaviour or attitudes that only someone genuinely strong on this facet would endorse. They are highly discriminating and aspirational — few respondents will score high here.`
    }
  }

  if (difficultyTypes.includes(measureType)) {
    if (intensity === 'low') {
      return `Intensity: Low (item difficulty).
Items at low intensity should be foundational — easy to answer correctly for someone with basic competence or knowledge. They set a clear, achievable baseline.`
    }
    if (intensity === 'mid') {
      return `Intensity: Mid (item difficulty).
Items at mid intensity should be applied — requiring moderately deep competence or judgment. They are neither gimmes nor trick questions.`
    }
    if (intensity === 'high') {
      return `Intensity: High (item difficulty).
Items at high intensity should be demanding — requiring advanced competence, deep judgment, or handling edge cases. They are the ceiling items that only strong performers can confidently handle.`
    }
  }

  if (measureType === 'validity_scale') {
    return `Note: Intensity is not meaningful for validity scales. Focus on writing items that reliably detect the response pattern you are validating against.`
  }

  return ''
}

// ---------------------------------------------------------------------------
// Response Parser
// ---------------------------------------------------------------------------

/**
 * Strip markdown code fences from a response string.
 * Handles both "```json\n...\n```" and "```\n...\n```" formats.
 */
function stripCodeFence(raw: string): string {
  let trimmed = raw.trim()

  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/)
  if (fenceMatch) {
    trimmed = fenceMatch[1].trim()
  }

  return trimmed
}

/**
 * Attempt to extract JSON from a string.
 * First tries direct JSON parse; if that fails, searches for the outermost [...] block.
 * Returns null if no valid JSON is found.
 */
function extractJson(raw: string): unknown {
  const cleaned = stripCodeFence(raw)

  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('[')
    const end = cleaned.lastIndexOf(']')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

/**
 * Coerce reverseScored from various input formats.
 * Accepts: boolean, string "true"/"false" (case-insensitive), null/undefined.
 * Returns boolean or undefined on unknown input.
 */
function coerceReverseScored(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    if (lower === 'true') return true
    if (lower === 'false') return false
  }
  return undefined
}

/**
 * Parse an AI response string into a structured list of generated item drafts.
 *
 * Handles multiple input formats:
 * - Fenced JSON array (```json\n[...]\n```)
 * - Wrapped object ({ items: [...], ... })
 * - Bare array ([{...}, ...])
 *
 * Forgiving parsing: malformed items are skipped with a warning. Reverse-scored is
 * coerced from boolean or string. Unknown sdRisk values are dropped with a warning.
 * Empty/whitespace stems are dropped with a warning. Facet field is optional.
 *
 * Never throws on invalid input; always returns a result with warnings populated.
 */
export function parseGeneratedItems(raw: string): ItemGenerationResult {
  const warnings: string[] = []
  const items: GeneratedItemDraft[] = []

  // Handle null/undefined/empty input
  if (!raw || typeof raw !== 'string') {
    warnings.push('Input is not a string; returning empty items.')
    return { items, warnings }
  }

  if (raw.trim().length === 0) {
    warnings.push('Input is empty; returning empty items.')
    return { items, warnings }
  }

  // Extract JSON
  const jsonData = extractJson(raw)
  if (!jsonData) {
    warnings.push('Response does not contain valid JSON; returning empty items.')
    return { items, warnings }
  }

  // Handle case where response is a bare array
  let itemsArray: unknown[] = []

  if (Array.isArray(jsonData)) {
    itemsArray = jsonData
  } else if (typeof jsonData === 'object') {
    const obj = jsonData as Record<string, unknown>
    if (Array.isArray(obj.items)) {
      itemsArray = obj.items
    } else {
      warnings.push('Response is an object but has no "items" array; returning empty items.')
      return { items, warnings }
    }
  } else {
    warnings.push('Response is neither an array nor an object; returning empty items.')
    return { items, warnings }
  }

  // Parse items
  for (let idx = 0; idx < itemsArray.length; idx++) {
    const itemData = itemsArray[idx]

    if (!itemData || typeof itemData !== 'object') {
      warnings.push(`Item ${idx}: skipped malformed item (not an object).`)
      continue
    }

    const i = itemData as Record<string, unknown>

    // Extract and validate stem
    const rawStem = String(i.stem ?? '').trim()
    if (!rawStem) {
      warnings.push(`Item ${idx}: skipped item with empty stem.`)
      continue
    }

    // Extract reverseScored
    let reverseScored = false
    const rawReverse = i.reverseScored
    const coercedReverse = coerceReverseScored(rawReverse)
    if (coercedReverse !== undefined) {
      reverseScored = coercedReverse
    } else if (rawReverse !== null && rawReverse !== undefined) {
      warnings.push(
        `Item ${idx}: reverseScored value ${JSON.stringify(rawReverse)} is not a boolean or "true"/"false"; defaulting to false.`,
      )
    }

    // Extract sdRisk (optional, with validation)
    let sdRisk: 'low' | 'moderate' | 'high' | undefined
    const rawSdRisk = i.sdRisk
    if (typeof rawSdRisk === 'string') {
      const lower = rawSdRisk.toLowerCase().trim()
      if (lower === 'low' || lower === 'moderate' || lower === 'high') {
        sdRisk = lower as 'low' | 'moderate' | 'high'
      } else {
        warnings.push(
          `Item ${idx}: unknown sdRisk "${rawSdRisk}"; dropping it. Valid values are "low", "moderate", "high".`,
        )
      }
    }

    // Extract optional fields
    const rationale = typeof i.rationale === 'string' ? i.rationale : undefined
    const facet = typeof i.facet === 'string' ? i.facet : undefined

    items.push({
      stem: rawStem,
      reverseScored,
      ...(rationale && { rationale }),
      ...(sdRisk && { sdRisk }),
      ...(facet && { facet }),
    })
  }

  if (items.length === 0 && itemsArray.length > 0) {
    warnings.push('All items were malformed; returning empty items.')
  }

  return { items, warnings }
}

// ---------------------------------------------------------------------------
// Stem Normalization & Deduplication
// ---------------------------------------------------------------------------

/**
 * Normalize a stem string for deduplication.
 * Lowercase, strip non-alphanumeric characters (collapse to space), collapse whitespace, trim.
 */
export function normaliseStem(stem: string): string {
  return stem
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface DedupResult {
  kept: GeneratedItemDraft[]
  duplicates: string[]
}

/**
 * Deduplicate a batch of generated items against existing stems and within the batch.
 * Returns kept items and a list of duplicate stems (for logging).
 *
 * Uses normalised stem comparison: normalised existing stems are compared against
 * normalised draft stems. Within-batch duplicates are caught as well.
 */
export function dedupeAgainst(
  drafts: GeneratedItemDraft[],
  existingStems?: string[],
): DedupResult {
  const kept: GeneratedItemDraft[] = []
  const duplicates: string[] = []

  const normalizedExisting = new Set<string>(
    (existingStems ?? []).map(stem => normaliseStem(stem)),
  )
  const seenNormalized = new Set<string>()

  for (const draft of drafts) {
    const normalized = normaliseStem(draft.stem)

    // Check against existing stems
    if (normalizedExisting.has(normalized)) {
      duplicates.push(draft.stem)
      continue
    }

    // Check against earlier drafts in this batch
    if (seenNormalized.has(normalized)) {
      duplicates.push(draft.stem)
      continue
    }

    seenNormalized.add(normalized)
    kept.push(draft)
  }

  return { kept, duplicates }
}
