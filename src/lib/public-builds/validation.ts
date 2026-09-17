/**
 * Pure validation for createBuild's picks: a subset of the ranking, deduped,
 * sized 4..8 (the Essentials/Core/Full picture range). Kept separate from
 * src/app/actions/public-builds.ts so it's unit-testable without a DB.
 */
export const PUBLIC_BUILDS_MIN_PICKS = 4
export const PUBLIC_BUILDS_MAX_PICKS = 8

export type PickValidationResult =
  | { ok: true; picks: string[] }
  | { ok: false; error: string }

export function validatePicks(rankedFactorIds: string[], picks: string[]): PickValidationResult {
  const ranked = new Set(rankedFactorIds)
  const unique = [...new Set(picks)]

  if (unique.length < PUBLIC_BUILDS_MIN_PICKS || unique.length > PUBLIC_BUILDS_MAX_PICKS) {
    return { ok: false, error: `Choose between ${PUBLIC_BUILDS_MIN_PICKS} and ${PUBLIC_BUILDS_MAX_PICKS} capabilities.` }
  }
  if (!unique.every((id) => ranked.has(id))) {
    return { ok: false, error: 'One of your selections is no longer available. Refresh and try again.' }
  }
  return { ok: true, picks: unique }
}
