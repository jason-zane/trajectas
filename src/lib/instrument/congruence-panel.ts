/**
 * Pure prompt builder and response parser for congruence panel: blind multi-rater
 * content-validity sort for instrument items.
 *
 * A rater is shown one item stem plus the definitions of every construct (blueprint)
 * in the build, and assigns the item to exactly one construct. This implements
 * discriminant validity — forcing a real choice among alternatives, not a binary
 * "does this fit?" judgment. The prompt deliberately hides the intended construct.
 *
 * The server action (`src/app/actions/instrument.ts`) invokes the LLM once per rater
 * and passes each response to `parseCongruenceResponse()` for normalization. After all
 * raters have judged, `toCongruenceRatings()` prepares the input to the EXISTING
 * `runCongruencePanel()` aggregation function.
 *
 * @module
 */

import type { MeasureType } from './types'
import type { CongruenceRating } from './congruence'

// ---------------------------------------------------------------------------
// System Prompt & Input Types
// ---------------------------------------------------------------------------

export const DEFAULT_CONGRUENCE_SYSTEM_PROMPT = `You are an independent subject-matter expert performing a content-validity sort.

**Your task:** You will be shown a single item (question or statement) and a list of construct definitions. You must assign the item to exactly one construct — the single best fitting option — and rate how relevant the item is to the construct you chose.

**Key instructions:**

1. **You are not told which construct this item was written for.** Make your own judgment based on the item AS WRITTEN, not what it might have been intended to mean. Do not overthink it — first instinct is often right.

2. **Assign to exactly one construct.** If the item fits none well, still choose the closest and rate relevance low. Do not hedge or assign to multiple constructs.

3. **Rate relevance on a 1–4 scale where:**
   - 1 = Not relevant (item does not fit the construct at all)
   - 2 = Somewhat relevant (item touches on the construct but feels like a poor fit)
   - 3 = Quite relevant (item fits the construct, clear connection)
   - 4 = Highly relevant (item is a textbook example of the construct)

4. **Provide a facet label.** If the item captures a specific sub-dimension or facet of the construct you chose, name it in 2–4 words (e.g., "strategic planning", "interpersonal trust", "attention to detail"). If no specific facet jumps out, use a generic label like "general".

5. **Provide a one-sentence rationale.** Briefly state why you assigned the item to the construct you chose and what aspect it addresses.

Return your response as STRICT JSON — no preamble, no markdown, no explanation:

\`\`\`json
{
  "constructId": "construct-id-string",
  "relevance": 3,
  "facet": "short facet label",
  "rationale": "One sentence explaining why this item fits the construct you chose."
}
\`\`\`

**Respond with ONLY the JSON object. No other text.**`

export interface CongruencePromptInput {
  /** The item stem (question or statement) to be judged */
  stem: string
  /** List of all constructs in the build (the rater must choose one) */
  candidates: Array<{
    /** Unique identifier for this construct (blueprint ID) */
    id: string
    /** Name or short label of the construct */
    name: string
    /** Optional detailed definition of the construct */
    definition?: string
  }>
  /** Type of measurement (optional; used only for context hints) */
  measureType?: MeasureType
}

export interface CongruenceParseResult {
  /** The construct ID the rater assigned this item to (undefined if invalid/missing) */
  assignedConstructId?: string
  /** Relevance rating on 1-4 scale (undefined if invalid/missing) */
  relevance?: 1 | 2 | 3 | 4
  /** Facet label recovered by the rater (optional) */
  namedFacet?: string
  /** Rationale provided by the rater (optional) */
  rationale?: string
  /** Non-fatal warnings encountered during parsing */
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build a prompt string for blind multi-rater content-validity assignment.
 *
 * The prompt includes:
 * - The item stem to be judged
 * - All construct candidates with names and definitions (blind to intended construct)
 * - Instructions for assigning to exactly one construct
 * - Relevance scale (1-4) with interpretation
 * - Request for facet label and rationale
 * - JSON format specification
 */
export function buildCongruencePrompt(input: CongruencePromptInput): string {
  const lines: string[] = []

  lines.push('Item to classify:')
  lines.push('')
  lines.push(`"${input.stem}"`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('Choose the best fitting construct from the list below:')
  lines.push('')

  // Render candidates with ID, name, and definition (in a stable, non-obvious order)
  input.candidates.forEach((candidate) => {
    const label = candidate.definition
      ? `${candidate.name}: ${candidate.definition}`
      : candidate.name
    lines.push(`[${candidate.id}] ${label}`)
  })

  return lines.join('\n')
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
 * First tries direct JSON parse; if that fails, searches for the outermost {...} block.
 * Returns null if no valid JSON is found.
 */
function extractJson(raw: string): unknown {
  const cleaned = stripCodeFence(raw)

  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
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
 * Coerce relevance from various input formats.
 * Accepts: number in range 1-4, string "1"-"4", null/undefined.
 * Returns a number in 1..4 with a warning if clamped, or undefined on invalid input.
 */
function coerceRelevance(value: unknown): { relevance?: 1 | 2 | 3 | 4; warning?: string } {
  // Handle numeric input
  if (typeof value === 'number') {
    if (value >= 1 && value <= 4 && Number.isInteger(value)) {
      return { relevance: value as 1 | 2 | 3 | 4 }
    }
    // Out of range: clamp and warn
    const clamped = Math.max(1, Math.min(4, Math.round(value)))
    return {
      relevance: clamped as 1 | 2 | 3 | 4,
      warning: `Relevance ${value} is out of range [1, 4]; clamped to ${clamped}.`,
    }
  }

  // Handle string input (numeric strings like "3")
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const num = parseInt(trimmed, 10)
    if (!Number.isNaN(num)) {
      if (num >= 1 && num <= 4) {
        return { relevance: num as 1 | 2 | 3 | 4 }
      }
      // Out of range: clamp and warn
      const clamped = Math.max(1, Math.min(4, num))
      return {
        relevance: clamped as 1 | 2 | 3 | 4,
        warning: `Relevance "${trimmed}" parses to ${num}, which is out of range [1, 4]; clamped to ${clamped}.`,
      }
    }
  }

  // Null or undefined is acceptable (optional field)
  if (value === null || value === undefined) {
    return {}
  }

  // Unrecognizable type
  return {
    warning: `Relevance value ${JSON.stringify(value)} is not a number or numeric string; dropping it.`,
  }
}

/**
 * Parse an AI response string into a structured congruence judgment.
 *
 * Handles multiple input formats:
 * - Fenced JSON object (```json\n{...}\n```)
 * - Bare object ({...})
 * - Single-element array ([{...}])
 *
 * Forgiving parsing: unknown constructId values are rejected with a warning.
 * Relevance is coerced from number or numeric string and clamped into 1..4.
 * Empty/null input never throws. All validation results are returned via warnings
 * and optional fields; the caller decides whether to use the partial result.
 *
 * Never throws on any input; always returns a result with warnings populated.
 */
export function parseCongruenceResponse(raw: string, validIds: string[]): CongruenceParseResult {
  const warnings: string[] = []
  const result: CongruenceParseResult = { warnings }

  // Handle null/undefined/empty input
  if (!raw || typeof raw !== 'string') {
    warnings.push('Input is not a string; returning empty result.')
    return result
  }

  if (raw.trim().length === 0) {
    warnings.push('Input is empty; returning empty result.')
    return result
  }

  // Extract JSON
  const jsonData = extractJson(raw)
  if (!jsonData) {
    warnings.push('Response does not contain valid JSON; returning empty result.')
    return result
  }

  // Handle case where response is a single-element array wrapping an object
  let objData: unknown = jsonData
  if (Array.isArray(jsonData)) {
    if (jsonData.length === 1 && typeof jsonData[0] === 'object' && jsonData[0] !== null) {
      objData = jsonData[0]
    } else {
      // Multi-element array or array with non-object element
      warnings.push('Response is an array but not a single-element object array; returning empty result.')
      return result
    }
  }

  // Ensure we have an object (not an array)
  if (typeof objData !== 'object' || objData === null || Array.isArray(objData)) {
    warnings.push('Response is not an object or single-element array; returning empty result.')
    return result
  }

  const obj = objData as Record<string, unknown>

  // Extract and validate constructId
  const rawConstructId = obj.constructId
  if (typeof rawConstructId === 'string') {
    const trimmedId = rawConstructId.trim()
    if (validIds.includes(trimmedId)) {
      result.assignedConstructId = trimmedId
    } else {
      warnings.push(
        `constructId "${trimmedId}" is not in the valid set; leaving assignedConstructId undefined.`,
      )
    }
  } else if (rawConstructId !== null && rawConstructId !== undefined) {
    warnings.push(
      `constructId value ${JSON.stringify(rawConstructId)} is not a string; leaving assignedConstructId undefined.`,
    )
  }

  // Extract and coerce relevance
  const relevanceResult = coerceRelevance(obj.relevance)
  if (relevanceResult.relevance !== undefined) {
    result.relevance = relevanceResult.relevance
  }
  if (relevanceResult.warning) {
    warnings.push(relevanceResult.warning)
  }

  // Extract optional facet (string, non-empty)
  if (typeof obj.facet === 'string') {
    const trimmedFacet = obj.facet.trim()
    if (trimmedFacet) {
      result.namedFacet = trimmedFacet
    }
  }

  // Extract optional rationale (string, non-empty)
  if (typeof obj.rationale === 'string') {
    const trimmedRationale = obj.rationale.trim()
    if (trimmedRationale) {
      result.rationale = trimmedRationale
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Rating Construction
// ---------------------------------------------------------------------------

/**
 * Converts per-rater parse results for one item into CongruenceRating[] shape
 * that the EXISTING runCongruencePanel() function consumes.
 *
 * Rater results missing an assignedConstructId are DROPPED (they cannot be scored)
 * and reported via a returned warning. All other results are converted to the
 * CongruenceRating shape, using the rater's model and index as provided.
 *
 * @param itemId - Unique item identifier
 * @param intendedConstructId - The true construct this item was written for
 * @param results - Per-rater results from parseCongruenceResponse() calls
 * @returns Object with ratings array and any warnings from dropped raters
 */
export function toCongruenceRatings(
  itemId: string,
  intendedConstructId: string,
  results: Array<{
    raterIndex: number
    raterModel: string
    parsed: CongruenceParseResult
  }>,
): { ratings: CongruenceRating[]; warnings: string[] } {
  const ratings: CongruenceRating[] = []
  const warnings: string[] = []

  for (const result of results) {
    // Skip raters without an assignedConstructId
    if (!result.parsed.assignedConstructId) {
      warnings.push(
        `Rater ${result.raterIndex} (${result.raterModel}): no valid assignedConstructId; dropping this rater's response.`,
      )
      continue
    }

    // Use default relevance of 3 if not provided (generous default for missing data)
    const relevance = result.parsed.relevance ?? (3 as const)

    ratings.push({
      itemId,
      raterIndex: result.raterIndex,
      raterModel: result.raterModel,
      assignedConstructId: result.parsed.assignedConstructId,
      intendedConstructId,
      relevance,
      ...(result.parsed.namedFacet && { namedFacet: result.parsed.namedFacet }),
    })
  }

  return { ratings, warnings }
}
