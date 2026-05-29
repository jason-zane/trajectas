/**
 * 360 aggregation — turns per-session factor scores into a subject's aggregate
 * profile: per-category means with N≥3 anonymity suppression, self-vs-others
 * gap, and Johari-style quadrants.
 *
 * Pure functions only (no DB) so the psychometric logic is unit-testable; the
 * server action feeds it scored sessions and persists the result.
 *
 * See docs/superpowers/specs/2026-05-29-leadership-360-campaigns-design.md §6.
 */

export type RaterCategory =
  | 'self'
  | 'manager'
  | 'peer'
  | 'direct_report'
  | 'other'

/** One scored, completed session: which category, and POMP per factor. */
export interface SessionScore {
  category: RaterCategory
  /** factorId → POMP score (0–100). */
  factorScores: Record<string, number>
}

export interface ThreeSixtyOptions {
  /** Min raters in an anonymous category before its scores are shown. */
  anonymityThreshold: number
  /** POMP at/above which a score is "high" for quadrant assignment. */
  highThreshold: number
  /** POMP at/below which a score is "low" for quadrant assignment. */
  lowThreshold: number
}

export const DEFAULT_THREE_SIXTY_OPTIONS: ThreeSixtyOptions = {
  anonymityThreshold: 3,
  highThreshold: 60,
  lowThreshold: 40,
}

/** Categories whose individual raters must be protected by the N≥3 rule. */
const ANON_CATEGORIES: RaterCategory[] = ['peer', 'direct_report', 'other']

export type JohariQuadrant =
  | 'confirmed_strength' // self high, others high
  | 'blind_spot' // self high, others low (over-rates self)
  | 'hidden_strength' // self low, others high (under-rates self)
  | 'shared_development' // self low, others low
  | 'aligned' // self and others close, mid-range
  | 'insufficient_data' // no self or no observers

export interface CategoryAggregate {
  category: RaterCategory
  /** Number of completed raters in this category. */
  n: number
  /** Mean POMP, or null when suppressed for anonymity / no data. */
  mean: number | null
  /** True when withheld because n < anonymity threshold (anon categories only). */
  suppressed: boolean
}

export interface FactorAggregate {
  factorId: string
  /** Subject's own (self) score for this factor, if they completed. */
  self: number | null
  /** Per-category observer aggregates (manager/peer/direct_report/other). */
  categories: CategoryAggregate[]
  /** Mean across ALL individual non-self raters (not mean-of-means). */
  othersMean: number | null
  /** self − othersMean (positive = self rates higher than observers). */
  gap: number | null
  quadrant: JohariQuadrant
}

export interface ThreeSixtyAggregate {
  factors: FactorAggregate[]
  raterCount: number
  raterCountByCategory: Record<string, number>
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function assignQuadrant(
  self: number | null,
  othersMean: number | null,
  opts: ThreeSixtyOptions,
): JohariQuadrant {
  if (self === null || othersMean === null) return 'insufficient_data'
  const selfHigh = self >= opts.highThreshold
  const selfLow = self <= opts.lowThreshold
  const otherHigh = othersMean >= opts.highThreshold
  const otherLow = othersMean <= opts.lowThreshold
  if (selfHigh && otherHigh) return 'confirmed_strength'
  if (selfLow && otherLow) return 'shared_development'
  if (self > othersMean && otherLow) return 'blind_spot'
  if (self < othersMean && otherHigh) return 'hidden_strength'
  // Fall back on the gap direction when not clearly in a corner.
  if (self - othersMean >= opts.highThreshold - opts.lowThreshold) return 'blind_spot'
  if (othersMean - self >= opts.highThreshold - opts.lowThreshold) return 'hidden_strength'
  return 'aligned'
}

/**
 * Aggregate scored sessions into a subject's 360 profile.
 *
 * @param sessions  Scored, completed sessions (self + observers).
 * @param factorIds The factors to report (union across the assessment).
 */
export function aggregateThreeSixty(
  sessions: SessionScore[],
  factorIds: string[],
  options: Partial<ThreeSixtyOptions> = {},
): ThreeSixtyAggregate {
  const opts = { ...DEFAULT_THREE_SIXTY_OPTIONS, ...options }

  const selfSessions = sessions.filter((s) => s.category === 'self')
  const observerSessions = sessions.filter((s) => s.category !== 'self')

  const raterCountByCategory: Record<string, number> = {}
  for (const s of observerSessions) {
    raterCountByCategory[s.category] = (raterCountByCategory[s.category] ?? 0) + 1
  }

  const observerCategories: RaterCategory[] = [
    'manager',
    'peer',
    'direct_report',
    'other',
  ]

  const factors: FactorAggregate[] = factorIds.map((factorId) => {
    const selfScores = selfSessions
      .map((s) => s.factorScores[factorId])
      .filter((v): v is number => typeof v === 'number')
    const self = mean(selfScores)

    // Per-factor scored responses for a category — anonymity is judged on the
    // people who actually answered THIS factor, not the category's headcount.
    // (A category with 3 raters but only 1 response for this factor would
    // otherwise expose that individual.)
    const scoresForCategory = (category: RaterCategory) =>
      observerSessions
        .filter((s) => s.category === category)
        .map((s) => s.factorScores[factorId])
        .filter((v): v is number => typeof v === 'number')

    const categories: CategoryAggregate[] = observerCategories.map((category) => {
      const scores = scoresForCategory(category)
      const n = scores.length
      const mustProtect = ANON_CATEGORIES.includes(category)
      const suppressed = mustProtect && n < opts.anonymityThreshold
      return {
        category,
        n,
        mean: suppressed ? null : mean(scores),
        suppressed,
      }
    })

    // Anonymity-safe "others" pool: the named manager plus any anonymous
    // category whose per-factor responses MEET the threshold. Below-threshold
    // anonymous responses are excluded entirely — otherwise, since the manager
    // mean is emitted, a lone peer's score would be recoverable as
    // (2*othersMean - manager).
    const allObserverScores: number[] = []
    for (const category of observerCategories) {
      const scores = scoresForCategory(category)
      const mustProtect = ANON_CATEGORIES.includes(category)
      if (mustProtect && scores.length < opts.anonymityThreshold) continue
      allObserverScores.push(...scores)
    }
    const othersMean = mean(allObserverScores)

    const gap = self !== null && othersMean !== null ? self - othersMean : null

    return {
      factorId,
      self,
      categories,
      othersMean,
      gap,
      quadrant: assignQuadrant(self, othersMean, opts),
    }
  })

  return {
    factors,
    raterCount: observerSessions.length,
    raterCountByCategory,
  }
}
