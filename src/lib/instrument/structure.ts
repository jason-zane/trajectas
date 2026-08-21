/**
 * structure.ts — AI-assisted construct set proposal for the STRUCTURE step.
 *
 * The structure step takes a build brief and proposes the entire construct set:
 * for each construct, a name, definition, and explicit exclusions. Alongside,
 * a pairwise discriminability matrix shows overlapping constructs BEFORE any
 * items are written.
 *
 * This module builds the prompt, parses the response, computes pairwise
 * similarity via embeddings, and prepares the UI-editable grid.
 *
 * @module
 */

import type { MeasureType } from './types'
import { extractJson } from './blueprint-draft'

/**
 * AI-proposed construct for the structure step.
 * Carries name, definition, exclusions, and is initially unsaved (no ID).
 */
export interface ProposedConstruct {
  name: string
  definition: string
  exclusions: string[]
}

/**
 * The parsed result of the structure step AI proposal.
 */
export interface StructureProposal {
  constructs: ProposedConstruct[]
  warnings: string[]
}

/**
 * Similarity score between two constructs.
 * A heuristic for human review — does NOT establish distinctness.
 */
export interface ConstructSimilarityPair {
  constructAIndex: number
  constructBIndex: number
  constructAName: string
  constructBName: string
  cosineSimilarity: number
}

/**
 * Pairwise similarity matrix, sorted highest-overlap first.
 * Intended as a prompt for human review, not an automated gate.
 */
export interface SimilarityMatrix {
  pairs: ConstructSimilarityPair[]
  maxSimilarity: number
  minSimilarity: number
}

/**
 * The system prompt for the structure step AI.
 *
 * Instructs the model to return EXACTLY this JSON:
 *   { "constructs": [{ "name": "...", "definition": "...", "exclusions": [...] }] }
 *
 * CRITICAL: This prompt is seeded and active in production. Do not change it.
 * The parser expects this exact shape.
 */
export const DEFAULT_STRUCTURE_SYSTEM_PROMPT = `You are an expert psychometrician designing a complete instrument construct set. Your task is to propose a comprehensive set of constructs (dimensions) that together form a coherent measurement model.

**Key principles:**

1. **Construct clarity:** Each construct should be distinct and measurable. Avoid overlaps where possible, but where related constructs serve the measurement model, name them explicitly and assign exclusions to clarify boundaries.

2. **Construct definition:** Each construct gets a single-paragraph definition (60–100 words) that is behavioural, specific, and unambiguous. Avoid circular definitions or self-reference.

3. **Exclusions:** List what this construct explicitly does NOT measure. Name adjacent territory or closely related constructs that belong to other parts of the model or to different instruments. This prevents scope creep and clarifies construct boundaries.

4. **Coverage:** Propose enough constructs to thoroughly measure the target domain, without redundancy. The number should align with the measurement goal and audience expectations.

5. **Coherence:** The constructs should form a unified model where each one plays a clear role in the overall measurement system.

Return your response as a JSON object with the following structure:

\`\`\`json
{
  "constructs": [
    {
      "name": "Construct Name",
      "definition": "A 60–100 word behavioural definition that is clear and unambiguous.",
      "exclusions": ["What this construct is NOT", "Adjacent territory that belongs elsewhere"]
    }
  ]
}
\`\`\`

**Respond with ONLY the JSON object. No preamble, no explanation, no prose.**`

/**
 * Build a prompt string for AI-assisted structure proposal.
 *
 * The prompt includes:
 * - Build name and brief
 * - Measure type and guidance
 * - Audience level and use context
 * - Target construct count
 * - Audience and use-context hints
 */
export function buildStructurePrompt(input: {
  buildName: string
  brief?: string | null
  measureType: MeasureType
  audience?: Record<string, unknown> | null
  useContext?: string | null
  targetConstructCount?: number | null
  knownConstructs?: Array<{ name: string; definition: string }> | null
}): string {
  const lines: string[] = []

  // Computed up front because it changes what the whole prompt is asking for:
  // a fresh set, or the remainder of one the author has started.
  const known = (input.knownConstructs ?? []).filter((c) => c.name.trim().length > 0)

  lines.push(`Instrument: ${input.buildName}`)
  lines.push('')

  if (input.brief) {
    lines.push(`Brief: ${input.brief}`)
    lines.push('')
  }

  // Measure type guidance
  const measureTypeGuidance: Record<string, string> = {
    trait: 'This is a personality or dispositional trait instrument. Constructs should capture distinct behavioural or dispositional dimensions.',
    competency_behavioural:
      'This is a workplace competency instrument. Constructs should reflect distinct on-the-job competency domains.',
    capability: 'This is a capability or aptitude instrument. Constructs should represent distinct modes or aspects of capability.',
    sjt: 'This is a situational judgment test. Constructs should reflect distinct judgment domains or decision-making contexts.',
    forced_choice: 'This is a forced-choice instrument. Constructs should be distinguishable preference or ranking dimensions.',
    preference: 'This is a preference or interest instrument. Constructs should capture distinct preference or interest domains.',
    climate: 'This is an organisational climate instrument. Constructs should represent distinct environmental dimensions.',
    validity_scale: 'This is a validity or response-pattern scale. Constructs should represent distinct warning signs or response patterns.',
  }

  const guidance = measureTypeGuidance[input.measureType]
  if (guidance) {
    lines.push(`Measure type: ${input.measureType}. ${guidance}`)
    lines.push('')
  }

  // Audience
  if (input.audience && typeof input.audience === 'object') {
    const aud = input.audience as Record<string, unknown>
    const level = aud.level || aud.description
    if (level) {
      lines.push(`Audience: ${level}`)
    }
  }

  // Use context
  if (input.useContext) {
    lines.push(`Use context: ${input.useContext}`)
  }

  if (input.audience || input.useContext) {
    lines.push('')
  }

  // Target construct count. Suppressed during gap-fill, where the count is
  // restated below as a remainder — saying "target 8" and "propose 3 more" in the
  // same prompt reliably produces 8 new constructs on top of the 5 that exist.
  if (known.length === 0 && input.targetConstructCount && input.targetConstructCount > 0) {
    lines.push(`Target number of constructs: ${input.targetConstructCount}`)
    lines.push('')
  }

  // Gap-fill. When the author already has part of the model, the request changes
  // from "propose a set" to "complete this set" — and the constructs they brought
  // are fixed points, not suggestions to be rewritten. Without this the only
  // available move was Regenerate, which replaced every construct the author had
  // written.
  if (known.length > 0) {
    lines.push('The author has already defined these constructs. Treat them as fixed:')
    lines.push('')
    for (const construct of known) {
      const definition = construct.definition.trim()
      lines.push(`- ${construct.name.trim()}${definition ? `: ${definition}` : ' (no definition yet)'}`)
    }
    lines.push('')
    lines.push(
      'Do NOT restate, rename, redefine or drop any construct listed above. Propose ONLY the additional constructs needed to complete the model, and make each one discriminable from those already defined. Return only your new constructs.',
    )

    if (input.targetConstructCount && input.targetConstructCount > known.length) {
      lines.push('')
      lines.push(
        `The finished model should hold about ${input.targetConstructCount} constructs, so propose roughly ${input.targetConstructCount - known.length} more.`,
      )
    }

    lines.push('')
    lines.push('Be explicit about what each new construct is NOT, to prevent scope creep.')

    return lines.join('\n')
  }

  lines.push(
    'Please propose a complete construct set that measures this domain. Be explicit about what each construct is NOT, to prevent scope creep.',
  )

  return lines.join('\n')
}

/**
 * Parse the AI structure proposal response into ProposedConstructs.
 *
 * Handles multiple input formats:
 * - Fenced JSON (```json\n{...}\n```)
 * - Wrapped object ({ constructs: [...] })
 * - Bare constructs array
 *
 * Forgiving parsing: malformed constructs are skipped with warnings.
 * Never throws on invalid input; always returns a result with warnings populated.
 */
export function parseStructureProposal(raw: string): StructureProposal {
  const warnings: string[] = []
  const constructs: ProposedConstruct[] = []

  // Extract JSON
  const jsonData = extractJson(raw)
  if (!jsonData || typeof jsonData !== 'object') {
    warnings.push('Response is not valid JSON; returning empty proposal.')
    return { constructs, warnings }
  }

  // Handle case where response is a bare array
  let constructsArray: unknown[] = []

  if (Array.isArray(jsonData)) {
    constructsArray = jsonData
  } else {
    const obj = jsonData as Record<string, unknown>
    constructsArray = Array.isArray(obj.constructs) ? obj.constructs : []
  }

  if (constructsArray.length === 0) {
    warnings.push('No constructs found in response.')
    return { constructs, warnings }
  }

  // Track seen names for deduplication
  const seenNames = new Set<string>()

  // Parse constructs
  for (const constructData of constructsArray) {
    if (!constructData || typeof constructData !== 'object') {
      warnings.push('Skipped malformed construct: not an object.')
      continue
    }

    const c = constructData as Record<string, unknown>

    // Extract name
    const name = String(c.name ?? '').trim()
    if (!name) {
      warnings.push('Skipped construct: missing or empty name.')
      continue
    }

    // Check for duplicates (case-insensitive)
    const nameLower = name.toLowerCase()
    if (seenNames.has(nameLower)) {
      warnings.push(`Deduplicated construct name: "${name}" appears multiple times.`)
      continue
    }
    seenNames.add(nameLower)

    // Extract definition
    const definition = String(c.definition ?? '').trim()
    if (!definition) {
      warnings.push(`Skipped construct "${name}": missing or empty definition.`)
      continue
    }

    // Extract exclusions (any strings in the exclusions array)
    const exclusionsArray = Array.isArray(c.exclusions) ? c.exclusions : []
    const exclusions: string[] = []
    for (const ex of exclusionsArray) {
      const exclusion = String(ex).trim()
      if (exclusion) {
        exclusions.push(exclusion)
      }
    }

    constructs.push({ name, definition, exclusions })
  }

  if (constructs.length === 0) {
    warnings.push('No valid constructs could be parsed.')
  }

  return { constructs, warnings }
}

/**
 * Compute cosine similarity between two embedding vectors.
 * Returns a value in [0, 1], where 1 = identical direction.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0
  }
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) {
    return 0
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Compute pairwise similarity matrix for proposed constructs.
 *
 * Takes embeddings (one per construct) and produces a similarity matrix
 * sorted by highest overlap first. The matrix is a HEURISTIC FOR HUMAN REVIEW
 * and does NOT establish distinctness — it is purely a prompt to check whether
 * overlapping constructs are genuinely distinct.
 *
 * As documented in AGENTS.md: "this platform has measured that embedding
 * separation between its own constructs is only Cohen's d ~= 0.63–1.03.
 * So this number is a HEURISTIC PROMPT FOR HUMAN REVIEW, not a verdict."
 *
 * @param embeddings — one embedding vector per construct (in order)
 * @param constructs — parallel array of construct objects with `name` property
 * @returns SimilarityMatrix sorted by highest similarity first (highest overlap first)
 */
export function computeSimilarityMatrix(
  embeddings: number[][],
  constructs: Array<{ name: string }>,
): SimilarityMatrix {
  if (embeddings.length !== constructs.length) {
    throw new Error('embeddings and constructs must have the same length')
  }

  if (embeddings.length < 2) {
    return {
      pairs: [],
      maxSimilarity: 0,
      minSimilarity: 0,
    }
  }

  const pairs: ConstructSimilarityPair[] = []

  // Compute all pairwise similarities
  for (let i = 0; i < constructs.length; i++) {
    for (let j = i + 1; j < constructs.length; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j])
      pairs.push({
        constructAIndex: i,
        constructBIndex: j,
        constructAName: constructs[i].name,
        constructBName: constructs[j].name,
        cosineSimilarity: similarity,
      })
    }
  }

  // Sort by highest similarity first (highest overlap first)
  pairs.sort((a, b) => b.cosineSimilarity - a.cosineSimilarity)

  const maxSimilarity = pairs.length > 0 ? pairs[0].cosineSimilarity : 0
  const minSimilarity = pairs.length > 0 ? pairs[pairs.length - 1].cosineSimilarity : 0

  return {
    pairs,
    maxSimilarity,
    minSimilarity,
  }
}
