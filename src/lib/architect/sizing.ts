/**
 * Architect assessment sizing — reuses the platform's item-selection rules and
 * canonical duration estimate so the Architect agrees with the rest of the app.
 *
 * Items-per-competency depends on how many competencies are in the assessment
 * (the rule bands), so totals recompute live as competencies are added/removed.
 */

import { estimateAssessmentDurationMinutes } from '@/lib/assessments/duration'

export type ItemRule = {
  minConstructs: number
  maxConstructs: number | null
  itemsPerConstruct: number
}

/** Default when no rule band matches — mirrors the existing capability picker. */
const DEFAULT_ITEMS_PER_COMPETENCY = 6

/** Items each competency contributes, from the rule band for the given count. */
export function itemsPerCompetency(count: number, rules: ItemRule[]): number {
  const rule = rules.find(
    (r) => count >= r.minConstructs && (r.maxConstructs === null || count <= r.maxConstructs),
  )
  return rule?.itemsPerConstruct ?? DEFAULT_ITEMS_PER_COMPETENCY
}

/**
 * Total items + minutes for a selection, given each chosen competency's pool
 * size. The rule sets items-per-competency from the count; each is capped at
 * the competency's available pool.
 */
export function sizeSelection(
  availablePerFactor: number[],
  rules: ItemRule[],
): { count: number; items: number; minutes: number; perCompetency: number } {
  const count = availablePerFactor.length
  const per = itemsPerCompetency(count, rules)
  const items = availablePerFactor.reduce((sum, avail) => sum + Math.min(per, avail), 0)
  return { count, items, minutes: estimateAssessmentDurationMinutes(items), perCompetency: per }
}

/**
 * Largest N (taking the top-ranked competencies) whose estimated duration fits
 * the target. Items-per-competency isn't monotonic in N (more competencies can
 * mean fewer items each), so scan all N and take the largest that fits; if even
 * one competency exceeds the target, return 1.
 */
export function fitCountToTime(
  rankedAvailable: number[],
  targetMinutes: number,
  rules: ItemRule[],
): number {
  let best = 1
  for (let n = 1; n <= rankedAvailable.length; n++) {
    const { minutes } = sizeSelection(rankedAvailable.slice(0, n), rules)
    if (minutes <= targetMinutes) best = n
  }
  return Math.min(best, Math.max(1, rankedAvailable.length))
}
