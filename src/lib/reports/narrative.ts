// =============================================================================
// src/lib/reports/narrative.ts
// Assembles derived narrative text from taxonomy indicators + definitions.
// All text is deterministic — no AI involved here.
// =============================================================================

import type { Band } from './types'
import type { PersonReferenceType } from '@/types/database'

export interface NarrativeEntity {
  name: string
  definition?: string
  indicatorsLow?: string
  indicatorsMid?: string
  indicatorsHigh?: string
  developmentSuggestion?: string
}

/**
 * Resolve the {{person}} token to the appropriate reference string.
 * firstName is only used when personReference === 'first_name'.
 *
 * neutral: removes the token entirely and collapses any resulting double spaces.
 * participant: no article ("participant demonstrates...")
 * the_participant: with article ("the participant demonstrates...")
 */
export function resolvePersonToken(
  text: string,
  personReference: PersonReferenceType,
  firstName?: string,
): string {
  if (personReference === 'neutral') {
    return text
      .replace(/\{\{person\}\}\s*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }
  const ref =
    personReference === 'you'
      ? 'you'
      : personReference === 'first_name'
        ? (firstName ?? 'the participant')
        : personReference === 'participant'
          ? 'participant'
          : 'the participant'
  return text.replace(/\{\{person\}\}/g, ref)
}

/**
 * Build a narrative paragraph for a scored entity.
 *
 * Format:
 *   [Definition sentence.] [Indicator text for resolved band.]
 *
 * Falls back gracefully when indicators are missing.
 */
export function buildDerivedNarrative(
  entity: NarrativeEntity,
  band: Band,
  personReference: PersonReferenceType,
  firstName?: string,
): string {
  const parts: string[] = []

  if (entity.definition) {
    parts.push(entity.definition.trim().replace(/\.?$/, '.'))
  }

  const indicators =
    band === 'low'
      ? entity.indicatorsLow
      : band === 'high'
        ? entity.indicatorsHigh
        : entity.indicatorsMid

  if (indicators) {
    parts.push(indicators.trim())
  }

  const raw = parts.join(' ').trim()
  return resolvePersonToken(raw, personReference, firstName)
}

/**
 * Build a development suggestion for the lowest-scoring entities.
 * Returns null if no suggestion text exists.
 */
export function buildDevelopmentSuggestion(
  entity: NarrativeEntity,
  personReference: PersonReferenceType,
  firstName?: string,
): string | null {
  if (!entity.developmentSuggestion) return null
  return resolvePersonToken(entity.developmentSuggestion.trim(), personReference, firstName)
}
