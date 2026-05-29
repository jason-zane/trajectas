/**
 * Shared Architect types + constants.
 *
 * Kept out of the `'use server'` actions module, which may only export async
 * functions — value/type exports live here so both server and client import.
 */

/** Default seconds per item used for the wizard's time estimate. */
export const ARCHITECT_SECONDS_PER_ITEM = 20

export type ArchitectPick = {
  factorId: string
  factorName: string
  rank: number
  /** 0–100 relevance from the matcher. */
  relevanceScore: number
  reasoning: string
  /** Items available in this factor's pool (upper bound for itemCount). */
  availableItems: number
}

/** A factor in the eligible pool — for the "add factor" control in the picks UI. */
export type ArchitectEligibleFactor = {
  factorId: string
  factorName: string
  availableItems: number
}

export type ArchitectMatchResult = {
  picks: ArchitectPick[]
  summary: string
  recommendedCount: { minimum: number; optimal: number; maximum: number }
  /** Count of eligible factors considered (after outcome/level filtering). */
  consideredCount: number
  /** Full eligible pool (incl. unranked) so the user can add a factor the matcher missed. */
  eligibleFactors: ArchitectEligibleFactor[]
}
