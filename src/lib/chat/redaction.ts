// =============================================================================
// src/lib/chat/redaction.ts
//
// What the model is allowed to know about a measurement.
//
// The rule the whole feature rests on: numbers reach the browser as a rendered
// card, and reach the model not at all. What the model gets instead is
// identity (whose score, which assessment) plus ORDINAL facts computed here in
// code — "Judgement is the highest of nine" — which are derived from the real
// values and are therefore correct by construction.
//
// This is the difference between a model that is discouraged from misstating a
// score and one that cannot: it never held the number.
// =============================================================================

import 'server-only'

export interface OrdinalFacts {
  factorCount: number
  factorNames: string[]
  highestFactor: string | null
  lowestFactor: string | null
  anyProvisional: boolean
  normReferenced: boolean
}

/**
 * Derive the comparative facts a reader would reasonably ask for, without
 * exposing any value. Ties resolve to the first factor by name so the answer
 * is stable across calls.
 */
export function ordinalFactsFrom(
  factors: Array<{ name: string; scaledScore: number; provisional: boolean; percentile?: number }>,
): OrdinalFacts {
  if (factors.length === 0) {
    return {
      factorCount: 0,
      factorNames: [],
      highestFactor: null,
      lowestFactor: null,
      anyProvisional: false,
      normReferenced: false,
    }
  }

  let highest = factors[0]
  let lowest = factors[0]
  for (const factor of factors) {
    if (factor.scaledScore > highest.scaledScore) highest = factor
    if (factor.scaledScore < lowest.scaledScore) lowest = factor
  }

  return {
    factorCount: factors.length,
    factorNames: factors.map((f) => f.name),
    // Only meaningful with something to compare against.
    highestFactor: factors.length > 1 ? highest.name : null,
    lowestFactor: factors.length > 1 ? lowest.name : null,
    anyProvisional: factors.some((f) => f.provisional),
    normReferenced: factors.every((f) => f.percentile !== undefined),
  }
}

/** Coarse completion state, so progress can be described without a count. */
export function completionBucket(completed: number, invited: number): string {
  if (invited === 0) return 'no_participants'
  if (completed === 0) return 'none_completed'
  if (completed === invited) return 'all_completed'
  if (completed / invited >= 0.5) return 'most_completed'
  return 'some_completed'
}
