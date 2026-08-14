/**
 * Fairness assessment for psychometric items.
 *
 * Provides readability analysis (Flesch-Kincaid grade level) via syllable heuristic,
 * and LLM-based fairness checking for cultural load, idiom, sensory assumptions,
 * and protected-class proximity. All functions are pure (no DB, no network).
 *
 * Readability assessment is deterministic and depends only on text content.
 * LLM fairness checking delegates to a language model; this module builds prompts
 * and parses responses with forgiving error handling.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export type FairnessFlag = 'idiom' | 'metaphor' | 'sensory_assumption' | 'protected_class' | 'jargon'

export interface FairnessResult {
  /** Candidate item ID */
  id: string
  /** Set of fairness concerns flagged for this item */
  flags: FairnessFlag[]
  /** Optional explanation of the flagged concern(s) */
  note?: string
}

export const READING_GRADE_CEILING_BY_AUDIENCE: Record<string, number> = {
  entry: 8,
  mid: 10,
  senior: 12,
  executive: 14,
  mixed: 10,
}

export const DEFAULT_FAIRNESS_SYSTEM_PROMPT = `You are an expert in psychometric fairness and assessment design. Your task is to review assessment items for fairness concerns.

**Your job:** flag items that exhibit genuine fairness problems:
1. **Idiom** — Uses colloquialisms, slang, or culturally-specific expressions (e.g., "hit the nail on the head", "raining cats and dogs").
2. **Metaphor** — Contains sports or military metaphors (e.g., "attacking the problem", "winning the battle").
3. **Sensory assumption** — Assumes respondents can see, hear, or perceive in a way that excludes people with sensory disabilities (e.g., "imagine the scene" or "as you can see").
4. **Protected class** — Proximity to age, family status, health, disability, religion, or sexual orientation (e.g., "as a father" or "when you get older").
5. **Jargon** — Domain-specific terminology that may not be universally understood.

**Critical rules:**
- Flag ONLY genuine fairness issues. Benign wording that is merely formal or technical is NOT a fairness problem.
- False positives (flagging items that are actually fair) are a failure of the review. Be strict and accurate.
- If an item is unclear, do not flag it — ask the human reviewer instead.
- A well-written, inclusive item that uses precise language should NOT be flagged.

Return ONLY a JSON array with no preamble or explanation.`

// ---------------------------------------------------------------------------
// Readability Functions
// ---------------------------------------------------------------------------

/**
 * Count syllables in an English word using a simple heuristic.
 *
 * Algorithm:
 * 1. Lowercase and strip non-letters.
 * 2. Count vowel groups (consecutive vowels = 1 group). Vowels: a, e, i, o, u, y.
 * 3. Subtract 1 if the word ends with a silent 'e' AND has > 1 vowel group.
 * 4. Return at least 1.
 *
 * Examples:
 * - 'the' → 1 (one vowel group "e")
 * - 'people' → 2 (groups: "e", "o-e" with silent-e adjustment)
 * - 'make' → 1 (group "a-e" with silent-e → 1 - 1 = 0, clamped to 1)
 * - 'idea' → 3 (groups: "i", "e", "a")
 * - 'strengthen' → 2 (groups: "e", "e")
 * - 'hope' → 1 (group "o-e" with silent-e)
 */
export function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '')
  if (cleaned.length === 0) return 1

  const vowels = 'aeiouy'
  let count = 0
  let inGroup = false

  for (const char of cleaned) {
    if (vowels.includes(char)) {
      if (!inGroup) {
        count++
        inGroup = true
      }
    } else {
      inGroup = false
    }
  }

  // Silent 'e' adjustment: subtract 1 if word ends in 'e' and has > 1 vowel group
  if (cleaned.endsWith('e') && count > 1) {
    count--
  }

  // Minimum 1 syllable
  return Math.max(1, count)
}

/**
 * Compute the Flesch-Kincaid Grade Level for a text.
 *
 * Formula: 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
 *
 * Sentences are defined as segments ending in [.!?]+. A text with no
 * terminal punctuation counts as a single sentence (not zero).
 *
 * Returns 0 for empty or whitespace-only input (rather than NaN or negative).
 *
 * @param text - The text to analyze
 * @returns Grade level (0 for empty, typically 0–18 for normal text)
 */
export function fleschKincaidGrade(text: string): number {
  const trimmed = text.trim()
  if (trimmed.length === 0) return 0

  // Count words (space-separated tokens, after stripping punctuation except internal)
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0)
  const wordCount = words.length
  if (wordCount === 0) return 0

  // Count sentences (split on [.!?]+ ; at least 1)
  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const sentenceCount = Math.max(1, sentences.length)

  // Count syllables (across all words)
  let syllableCount = 0
  for (const word of words) {
    syllableCount += countSyllables(word)
  }
  if (syllableCount === 0) return 0

  // Flesch-Kincaid formula
  const grade =
    0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59
  return Math.max(0, grade)
}

/**
 * Assess the reading grade level of an assessment item stem.
 *
 * Compares the computed grade against an audience-specific ceiling.
 *
 * @param stem - The item stem text
 * @param audienceLevel - Audience level (entry, mid, senior, executive, mixed; default: mixed)
 * @returns Object with grade, ceiling, and exceedsCeiling boolean
 */
export function assessReadingGrade(
  stem: string,
  audienceLevel = 'mixed',
): {
  grade: number
  ceiling: number
  exceedsCeiling: boolean
} {
  const grade = fleschKincaidGrade(stem)
  const ceiling = READING_GRADE_CEILING_BY_AUDIENCE[audienceLevel] ?? 10
  return {
    grade,
    ceiling,
    exceedsCeiling: grade > ceiling,
  }
}

// ---------------------------------------------------------------------------
// LLM-Based Fairness Checking
// ---------------------------------------------------------------------------

/**
 * Build a fairness prompt for a batch of candidate items.
 *
 * The prompt asks the model to review items for idiom, metaphor, sensory assumption,
 * protected-class proximity, and jargon. It requests strict JSON array output with
 * flagged concerns and brief explanations.
 *
 * @param items - Array of items, each with id and stem text
 * @returns Prompt string ready for the LLM
 */
export function buildFairnessPrompt(
  items: Array<{
    id: string
    stem: string
  }>,
): string {
  const lines: string[] = []

  lines.push('Review the following assessment items for fairness concerns:')
  lines.push('')

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    lines.push(`Item ${i + 1} (ID: ${item.id}):`)
    lines.push(`"${item.stem}"`)
    lines.push('')
  }

  lines.push('For each item, respond with:')
  lines.push('- "id": the item ID')
  lines.push('- "flags": array of fairness concerns (idiom, metaphor, sensory_assumption, protected_class, jargon)')
  lines.push('- "note": one-sentence explanation of the flagged concern(s) — only if flags is non-empty')
  lines.push('')
  lines.push('Return ONLY a JSON array. Example:')
  lines.push('[')
  lines.push('  { "id": "item-1", "flags": [] },')
  lines.push('  { "id": "item-2", "flags": ["idiom"], "note": "Uses colloquial expression." }')
  lines.push(']')

  return lines.join('\n')
}

/**
 * Parse an LLM response for fairness assessment results.
 *
 * Forgiving parsing: handles fenced JSON, object-wrapped arrays, bare arrays,
 * unknown flag values (dropped with warning), unknown IDs (dropped with warning),
 * and null/garbage input (never throws).
 *
 * @param raw - The raw response string from the LLM
 * @param validIds - Set of item IDs that should appear in the response
 * @returns Object with results array and warnings array
 */
export function parseFairnessResponse(
  raw: string | null | undefined,
  validIds: Set<string>,
): {
  results: FairnessResult[]
  warnings: string[]
} {
  const warnings: string[] = []
  const results: FairnessResult[] = []

  // Guard null/empty input
  if (!raw || typeof raw !== 'string') {
    warnings.push('Response is null or not a string.')
    return { results, warnings }
  }

  // Strip code fence if present
  let cleaned = raw.trim()
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }

  // Try to parse JSON
  let data: unknown
  try {
    data = JSON.parse(cleaned)
  } catch {
    // Fallback: try to extract array-like structure
    const arrayMatch = cleaned.match(/^\s*\[([\s\S]*)\]\s*$/)
    if (arrayMatch) {
      try {
        data = JSON.parse(`[${arrayMatch[1]}]`)
      } catch {
        warnings.push('Response is not valid JSON.')
        return { results, warnings }
      }
    } else {
      warnings.push('Response is not valid JSON.')
      return { results, warnings }
    }
  }

  // Ensure we have an array
  if (!Array.isArray(data)) {
    warnings.push('Response root is not an array.')
    return { results, warnings }
  }

  // Parse each result
  const seenIds = new Set<string>()

  for (let i = 0; i < data.length; i++) {
    const item = data[i]

    if (!item || typeof item !== 'object') {
      warnings.push(`Item ${i}: not an object.`)
      continue
    }

    const obj = item as Record<string, unknown>
    const id = String(obj.id ?? '').trim()

    if (!id) {
      warnings.push(`Item ${i}: missing or empty id.`)
      continue
    }

    if (!validIds.has(id)) {
      warnings.push(`Item ${i}: unknown id "${id}"; dropping.`)
      continue
    }

    if (seenIds.has(id)) {
      warnings.push(`Item ${i}: duplicate id "${id}"; dropping.`)
      continue
    }

    seenIds.add(id)

    // Parse flags array
    let flagsArray: unknown[] = []
    if (Array.isArray(obj.flags)) {
      flagsArray = obj.flags
    }

    const flags: FairnessFlag[] = []
    const validFlagValues: Set<FairnessFlag> = new Set([
      'idiom',
      'metaphor',
      'sensory_assumption',
      'protected_class',
      'jargon',
    ])

    for (const flag of flagsArray) {
      const flagStr = String(flag).trim().toLowerCase()
      if (validFlagValues.has(flagStr as FairnessFlag)) {
        flags.push(flagStr as FairnessFlag)
      } else {
        warnings.push(`Item ${id}: unknown flag "${flagStr}"; dropping.`)
      }
    }

    // Parse note (optional)
    const note = obj.note ? String(obj.note).trim() : undefined

    results.push({
      id,
      flags,
      note,
    })
  }

  return { results, warnings }
}
