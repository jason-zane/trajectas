/**
 * Pure prompt builder and response parser for AI-assisted blueprint drafting.
 *
 * Psychometricians use AI to decompose constructs into mutually exclusive behavioural
 * facets, assign target item counts per facet × intensity, and identify exclusions
 * (adjacent territory belonging to other constructs). This module builds the prompt,
 * parses the response, and validates the result — all without DB access or LLM calls.
 *
 * The server action (`src/app/actions/instrument.ts`) invokes the LLM and passes the
 * response to `parseBlueprintDraft()` for normalization.
 *
 * @module
 */

import type { BlueprintCell, Intensity, MeasureType } from './types'

// ---------------------------------------------------------------------------
// System Prompt & Input Types
// ---------------------------------------------------------------------------

export const DEFAULT_BLUEPRINT_SYSTEM_PROMPT = `You are an expert psychometrician designing a table of specifications (blueprint) for a new measurement instrument. Your task is to take a construct definition and decompose it into 3–6 mutually exclusive behavioural facets.

**Key principles:**

1. **Facet decomposition:** Each facet is a distinct dimension or mode of the construct. They must be clearly distinguishable by an independent expert — paraphrasing facets creates redundancy (the "attenuation paradox"). Breadth matters more than tidiness.

2. **Facet definition:** Each facet gets a single-sentence definition that is self-contained and unambiguous.

3. **Intensity allocation:** Each facet is tested at three intensity levels (low, mid, high). You must assign target item counts across intensity levels, and the sum must roughly match the target total item count. Allocate more items to higher-difficulty intensities if the construct benefits from precision at the top end.

4. **Exclusions:** List adjacent territory or closely related constructs that explicitly do NOT belong in this instrument. This prevents scope creep and reminds developers what this scale is *not* measuring.

5. **Constraint respect:** You are designing a table of specifications, not a real item pool. Focus on structural clarity and coverage logic, not item cleverness.

Return your response as a JSON object with the following structure:

\`\`\`json
{
  "facets": [
    {
      "facetLabel": "Label (e.g., 'Communication')",
      "facetDefinition": "One clear sentence defining this facet.",
      "cells": [
        { "intensity": "low", "targetItemCount": 3 },
        { "intensity": "mid", "targetItemCount": 4 },
        { "intensity": "high", "targetItemCount": 5 }
      ]
    }
  ],
  "exclusions": [
    "What this scale does NOT measure",
    "A related construct that belongs to a different instrument"
  ]
}
\`\`\`

**Respond with ONLY the JSON object. No preamble, no explanation, no prose.**`

export interface BlueprintDraftInput {
  constructName: string
  constructDefinition?: string
  constructDescription?: string
  indicatorsLow?: string[]
  indicatorsMid?: string[]
  indicatorsHigh?: string[]
  measureType: MeasureType
  targetItemCount: number
  contrastConstructs?: Array<{
    name: string
    definition?: string
  }>
  audienceLevel?: string
  useContext?: string
  intensityLevels?: Intensity[]
}

export interface ParsedFacet {
  facetLabel: string
  facetDefinition: string
  cells: Array<{
    intensity: Intensity
    targetItemCount: number
  }>
}

export interface BlueprintDraftResult {
  facets: ParsedFacet[]
  exclusions: string[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build a prompt string for AI-assisted blueprint drafting.
 *
 * The prompt includes:
 * - Construct name, definition, and description
 * - Indicator examples at each intensity level
 * - Measure type and guidance
 * - Contrast constructs (to prevent scope creep)
 * - Target item count
 * - Audience and use-context hints
 */
export function buildBlueprintDraftPrompt(input: BlueprintDraftInput): string {
  const lines: string[] = []

  lines.push(`Construct Name: ${input.constructName}`)
  lines.push('')

  if (input.constructDefinition) {
    lines.push(`Definition: ${input.constructDefinition}`)
    lines.push('')
  }

  if (input.constructDescription) {
    lines.push(`Description: ${input.constructDescription}`)
    lines.push('')
  }

  // Intensity-level indicators
  if (input.indicatorsLow && input.indicatorsLow.length > 0) {
    lines.push(`Low-intensity indicators:`)
    input.indicatorsLow.forEach(ind => lines.push(`  • ${ind}`))
    lines.push('')
  }

  if (input.indicatorsMid && input.indicatorsMid.length > 0) {
    lines.push(`Mid-intensity indicators:`)
    input.indicatorsMid.forEach(ind => lines.push(`  • ${ind}`))
    lines.push('')
  }

  if (input.indicatorsHigh && input.indicatorsHigh.length > 0) {
    lines.push(`High-intensity indicators:`)
    input.indicatorsHigh.forEach(ind => lines.push(`  • ${ind}`))
    lines.push('')
  }

  // Measure type guidance
  const measureTypeGuidance: Record<string, string> = {
    trait: 'This is a personality or dispositional trait. Facets should capture distinct behavioural expressions.',
    competency_behavioural: 'This is a workplace competency. Facets should reflect distinct on-the-job behaviours or domains of skill.',
    capability: 'This is a capability or aptitude. Facets should represent distinct modes or aspects of performance.',
    sjt: 'This is a situation judgment test. Facets should reflect distinct judgement domains or decision-making contexts.',
    forced_choice: 'This is a forced-choice instrument. Facets should be distinguishable preference or ranking dimensions.',
    preference: 'This is a preference or interest scale. Facets should capture distinct preference domains.',
    climate: 'This is an organisational climate scale. Facets should represent distinct environmental dimensions.',
    validity_scale: 'This is a validity or faking scale. Facets should represent distinct warning signs or response patterns.',
  }

  const guidance = measureTypeGuidance[input.measureType]
  if (guidance) {
    lines.push(`Measure type: ${input.measureType}. ${guidance}`)
    lines.push('')
  }

  // Contrast constructs
  if (input.contrastConstructs && input.contrastConstructs.length > 0) {
    lines.push('Contrast constructs (DO NOT include these in your blueprint):')
    input.contrastConstructs.forEach(cc => {
      const label = cc.definition ? `${cc.name}: ${cc.definition}` : cc.name
      lines.push(`  • ${label}`)
    })
    lines.push('')
  }

  // Target item count
  lines.push(`Target total item count: ${input.targetItemCount}`)
  lines.push('')

  // Audience and context
  if (input.audienceLevel) {
    lines.push(`Audience level: ${input.audienceLevel}`)
  }
  if (input.useContext) {
    lines.push(`Use context: ${input.useContext}`)
  }
  if (input.audienceLevel || input.useContext) {
    lines.push('')
  }

  lines.push('Please decompose this construct into 3–6 mutually exclusive facets and assign target item counts.')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Response Parser
// ---------------------------------------------------------------------------

/**
 * Normalize an intensity string to canonical form (e.g., 'Medium' → 'mid').
 * Returns null if the intensity is not recognised.
 */
function normalizeIntensity(raw: string): Intensity | null {
  const lower = raw.trim().toLowerCase()
  if (lower === 'low') return 'low'
  if (lower === 'mid' || lower === 'medium') return 'mid'
  if (lower === 'high') return 'high'
  return null
}

/**
 * Strip markdown code fences from a response string.
 * Handles both "```json\n...\n```" and "```\n...\n```" formats.
 */
function stripCodeFence(raw: string): string {
  let trimmed = raw.trim()

  // Match ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/)
  if (fenceMatch) {
    trimmed = fenceMatch[1].trim()
  }

  return trimmed
}

/**
 * Attempt to extract a JSON object from a string.
 * First tries direct JSON parse; if that fails, searches for the outermost {...} block.
 * Returns null if no valid JSON is found.
 */
function extractJson(raw: string): unknown {
  const cleaned = stripCodeFence(raw)

  try {
    return JSON.parse(cleaned)
  } catch {
    // Fallback: find outermost {...}
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
 * Parse an AI response string into a structured blueprint draft.
 *
 * Handles multiple input formats:
 * - Fenced JSON (```json\n{...}\n```)
 * - Wrapped object ({ facets: [...], ... })
 * - Bare array ([{...}, ...])
 *
 * Forgiving parsing: malformed facets are skipped with a warning rather than
 * causing the entire parse to fail. Intensity values are normalized (case-insensitive,
 * 'medium' → 'mid'). Unknown intensities are dropped with a warning. Duplicate facet
 * labels are deduped with a warning. Target item counts are clamped to >= 1.
 *
 * Never throws on invalid input; always returns a result with warnings populated.
 */
export function parseBlueprintDraft(raw: string): BlueprintDraftResult {
  const warnings: string[] = []
  const facets: ParsedFacet[] = []
  const exclusions: string[] = []

  // Extract JSON
  const jsonData = extractJson(raw)
  if (!jsonData || typeof jsonData !== 'object') {
    warnings.push('Response is not valid JSON; returning empty blueprint.')
    return { facets, exclusions, warnings }
  }

  // Handle case where response is a bare array
  let facetsArray: unknown[] = []
  let exclusionsArray: string[] = []

  if (Array.isArray(jsonData)) {
    facetsArray = jsonData
    exclusionsArray = []
  } else {
    const obj = jsonData as Record<string, unknown>
    facetsArray = Array.isArray(obj.facets) ? obj.facets : []
    exclusionsArray = Array.isArray(obj.exclusions) ? obj.exclusions : []
  }

  // Track seen facet labels (case-insensitive) for deduplication
  const seenLabels = new Set<string>()

  // Parse facets
  for (const facetData of facetsArray) {
    if (!facetData || typeof facetData !== 'object') {
      warnings.push('Skipped malformed facet: not an object.')
      continue
    }

    const f = facetData as Record<string, unknown>

    // Extract facet label
    const facetLabel = String(f.facetLabel ?? f.label ?? '').trim()
    if (!facetLabel) {
      warnings.push('Skipped facet: missing or empty facetLabel.')
      continue
    }

    // Check for duplicates (case-insensitive)
    const labelLower = facetLabel.toLowerCase()
    if (seenLabels.has(labelLower)) {
      warnings.push(`Deduped facet label: "${facetLabel}" appears multiple times.`)
      continue
    }
    seenLabels.add(labelLower)

    // Extract facet definition
    const facetDefinition = String(f.facetDefinition ?? f.definition ?? '').trim()
    if (!facetDefinition) {
      warnings.push(`Skipped facet "${facetLabel}": missing or empty definition.`)
      continue
    }

    // Parse cells (intensity × target count)
    const cellsArray = Array.isArray(f.cells) ? f.cells : []
    const cells: Array<{ intensity: Intensity; targetItemCount: number }> = []

    for (const cellData of cellsArray) {
      if (!cellData || typeof cellData !== 'object') {
        warnings.push(`Facet "${facetLabel}": skipped malformed cell.`)
        continue
      }

      const c = cellData as Record<string, unknown>

      // Parse intensity
      const rawIntensity = String(c.intensity ?? c.level ?? '')
      const intensity = normalizeIntensity(rawIntensity)

      if (!intensity) {
        warnings.push(
          `Facet "${facetLabel}": skipped cell with unknown intensity "${rawIntensity}".`,
        )
        continue
      }

      // Parse target count
      let targetCount = Number(c.targetItemCount ?? c.target ?? c.count ?? 0)
      if (!Number.isInteger(targetCount) || targetCount < 1) {
        targetCount = 1
        warnings.push(`Facet "${facetLabel}" (${intensity}): clamped targetItemCount to 1.`)
      }

      cells.push({ intensity, targetItemCount: targetCount })
    }

    if (cells.length === 0) {
      warnings.push(`Facet "${facetLabel}": has no valid cells; skipping.`)
      continue
    }

    facets.push({
      facetLabel,
      facetDefinition,
      cells,
    })
  }

  // Parse exclusions (any strings in the exclusions array)
  for (const ex of exclusionsArray) {
    const exclusion = String(ex).trim()
    if (exclusion) {
      exclusions.push(exclusion)
    }
  }

  return { facets, exclusions, warnings }
}

// ---------------------------------------------------------------------------
// Draft-to-Cells Conversion
// ---------------------------------------------------------------------------

/**
 * Convert a parsed blueprint draft into BlueprintCell objects.
 *
 * Assigns sequential displayOrder and generates a unique ID for each cell.
 * Blueprint cells are the atomic units of a blueprint table (facet × intensity).
 */
export function draftToCells(
  draft: BlueprintDraftResult,
  blueprintId: string,
): BlueprintCell[] {
  const cells: BlueprintCell[] = []
  let displayOrder = 0

  for (const facet of draft.facets) {
    for (const cell of facet.cells) {
      cells.push({
        id: `${blueprintId}-${displayOrder}`,
        facetLabel: facet.facetLabel,
        intensity: cell.intensity,
        targetItemCount: cell.targetItemCount,
        displayOrder,
      })
      displayOrder++
    }
  }

  return cells
}
