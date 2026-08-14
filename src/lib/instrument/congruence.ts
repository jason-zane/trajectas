/**
 * Congruence panel: blind multi-rater content-validity analysis for psychometric item blueprints.
 *
 * Aggregates rater judgments on item-construct alignment (assignment accuracy, Aiken's V),
 * computes inter-rater reliability (Fleiss' kappa), and produces per-item verdicts (pass/review/fail)
 * and construct-level confusion profiles. Pure functions; no database or network I/O.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CongruenceRating {
  /** Unique item identifier */
  itemId: string
  /** Zero-indexed rater index (for tracking agreement) */
  raterIndex: number
  /** Name or identifier of rater model (e.g., 'gpt-4o', 'claude-opus', 'expert-1') */
  raterModel: string
  /** Construct ID the rater assigned this item to */
  assignedConstructId: string
  /** True construct ID this item is intended to measure */
  intendedConstructId: string
  /** Content relevance rating on 1-4 scale (1=poor, 4=excellent) */
  relevance: 1 | 2 | 3 | 4
  /** Optional facet or dimension name (e.g., 'problem-solving', 'strategic-thinking') */
  namedFacet?: string
}

export interface ItemCongruence {
  /** Item identifier */
  itemId: string
  /** Intended construct ID for this item */
  intendedConstructId: string
  /** Number of unique raters who reviewed this item */
  raterCount: number
  /** Proportion of raters who assigned to the intended construct (0..1) */
  assignmentAccuracy: number
  /** Aiken's V: content validity coefficient for relevance ratings (0..1) */
  aikenV: number
  /** Construct ID most frequently assigned by raters */
  modalConstructId: string
  /** Proportion of raters who assigned to modalConstructId (0..1) */
  modalShare: number
  /** Verdict: pass (high agreement), review (moderate), or fail (low) */
  verdict: 'pass' | 'review' | 'fail'
  /** If set: the construct raters most often confused this item with, and it differs from intended */
  leakedTo?: string
}

export interface ConstructSummary {
  /** Construct ID */
  constructId: string
  /** Number of items intended to measure this construct */
  itemCount: number
  /** Average assignment accuracy across items (0..1) */
  meanAccuracy: number
  /** Average Aiken's V across items (0..1) */
  meanAikenV: number
  /** Proportion of items assigned correctly (pass verdict) */
  passRate: number
  /** Construct this one is most often confused with (biggest off-diagonal in confusion matrix) */
  mostConfusedWith?: string
}

export interface PanelResult {
  /** Per-item congruence analysis */
  items: ItemCongruence[]
  /** Fleiss' kappa: inter-rater reliability on construct assignment (−1..1; 0 = chance) */
  fleissKappa: number
  /** Confusion matrix: count[intendedConstructId][assignedConstructId] */
  confusion: ConfusionMatrix
  /** Summary statistics per construct */
  constructSummaries: ConstructSummary[]
  /** Panel-level aggregates */
  overall: {
    /** Total number of items reviewed */
    itemCount: number
    /** Total number of unique raters */
    raterCount: number
    /** Proportion of items with pass verdict (0..1) */
    passRate: number
    /** Panel average assignment accuracy */
    meanAccuracy: number
    /** Panel average Aiken's V */
    meanAikenV: number
  }
}

/** ConfusionMatrix[intended][assigned] = count */
export type ConfusionMatrix = Record<string, Record<string, number>>

export interface CongruenceOptions {
  /** Assignment accuracy threshold for 'pass' verdict (default: 0.80) */
  passAccuracy?: number
  /** Aiken's V threshold for 'pass' verdict (default: 0.75) */
  passAikenV?: number
  /** Assignment accuracy threshold for 'review' verdict (default: 0.60) */
  reviewAccuracy?: number
  /** Aiken's V threshold for 'review' verdict (default: 0.60) */
  reviewAikenV?: number
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

export const CONGRUENCE_THRESHOLDS: Required<CongruenceOptions> = {
  passAccuracy: 0.80,
  passAikenV: 0.75,
  reviewAccuracy: 0.60,
  reviewAikenV: 0.60,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute Aiken's V (content validity coefficient) from relevance ratings.
 * V = sum(r_i - lo) / (N * (hi - lo))
 *
 * @param ratings - Array of relevance ratings (typically 1-4)
 * @param loRating - Lowest possible rating (default: 1)
 * @param hiRating - Highest possible rating (default: 4)
 * @returns V coefficient in range [0, 1]
 */
export function aikenV(
  ratings: number[],
  loRating = 1,
  hiRating = 4,
): number {
  if (ratings.length === 0) return 0
  const sum = ratings.reduce((acc, r) => acc + (r - loRating), 0)
  return sum / (ratings.length * (hiRating - loRating))
}

/**
 * Compute Fleiss' kappa (inter-rater reliability for categorical judgments).
 * Requires equal number of raters per item.
 *
 * rows = items, cols = categories (typically construct IDs)
 * Each cell is the count of raters assigning that item to that category.
 *
 * @param itemCategoryCounts - 2D array where [i][j] = count of raters assigning item i to category j
 * @returns Kappa in range [−1, 1]; 0 = chance agreement, 1 = perfect agreement
 * @throws If rows have inconsistent sums (unequal rater counts) or insufficient data
 */
export function fleissKappa(itemCategoryCounts: number[][]): number {
  if (itemCategoryCounts.length === 0) return 0
  const k = itemCategoryCounts[0].length // number of categories

  // Variable raters per item are the NORMAL case here: a rater's provider call
  // can fail, leaving that item with fewer ratings. The generalised Fleiss
  // formula uses each item's own n_i, and reduces exactly to the classic
  // equal-n formula when every n_i is the same. Items with n_i < 2 carry no
  // pairwise-agreement information and are excluded rather than treated as 0.
  const usable = itemCategoryCounts.filter(
    (row) => row.reduce((a, b) => a + b, 0) >= 2,
  )
  if (usable.length === 0) return 0

  const perItemAgreement: number[] = []
  let grandTotal = 0
  const categoryTotals = new Array<number>(k).fill(0)

  for (const row of usable) {
    const n = row.reduce((a, b) => a + b, 0)
    let sumSquares = 0
    for (let j = 0; j < k; j++) {
      const count = row[j] ?? 0
      sumSquares += count * count
      categoryTotals[j] += count
    }
    grandTotal += n
    perItemAgreement.push((sumSquares - n) / (n * (n - 1)))
  }

  const Pbar =
    perItemAgreement.reduce((a, b) => a + b, 0) / perItemAgreement.length

  // Marginals are over ALL ratings, so items rated by more raters contribute
  // proportionally — the standard treatment for unbalanced designs.
  let Pe = 0
  for (let j = 0; j < k; j++) {
    const pj = grandTotal > 0 ? categoryTotals[j] / grandTotal : 0
    Pe += pj * pj
  }

  // Pe === 1 means every rating fell in one category; agreement is total but
  // chance-expected, so kappa is undefined. Report 0 rather than dividing by 0.
  if (Math.abs(1 - Pe) < 1e-10) return 0

  return (Pbar - Pe) / (1 - Pe)
}

/**
 * Build a confusion matrix from congruence ratings.
 * Result[intended][assigned] = count of ratings
 *
 * @param ratings - Array of congruence ratings
 * @returns ConfusionMatrix indexed by intended then assigned construct ID
 */
export function buildConfusionMatrix(ratings: CongruenceRating[]): ConfusionMatrix {
  const confusion: ConfusionMatrix = {}

  for (const rating of ratings) {
    const intended = rating.intendedConstructId
    const assigned = rating.assignedConstructId

    if (!confusion[intended]) {
      confusion[intended] = {}
    }
    if (!confusion[assigned]) {
      confusion[assigned] = {}
    }

    confusion[intended][assigned] = (confusion[intended][assigned] ?? 0) + 1
  }

  return confusion
}

/**
 * Score congruence for a single item reviewed by multiple raters.
 * Computes assignment accuracy, Aiken's V, modal construct, and verdict.
 *
 * @param ratings - All ratings for one item (must share same intendedConstructId)
 * @param options - Override default thresholds
 * @returns ItemCongruence with computed metrics and verdict
 * @throws If ratings are empty or have inconsistent intendedConstructId
 */
export function scoreItemCongruence(
  ratings: CongruenceRating[],
  options?: CongruenceOptions,
): ItemCongruence {
  if (ratings.length === 0) {
    throw new Error('scoreItemCongruence: ratings array is empty')
  }

  const opts = { ...CONGRUENCE_THRESHOLDS, ...options }
  const itemId = ratings[0].itemId
  const intendedConstructId = ratings[0].intendedConstructId

  // Validate all ratings have the same intendedConstructId
  for (const rating of ratings) {
    if (rating.intendedConstructId !== intendedConstructId) {
      throw new Error(
        `scoreItemCongruence: item ${itemId} has mixed intendedConstructId values: ${intendedConstructId} vs ${rating.intendedConstructId}`,
      )
    }
  }

  // Assignment accuracy: count matches with intended construct
  const matches = ratings.filter(
    (r) => r.assignedConstructId === intendedConstructId,
  ).length
  const assignmentAccuracy = matches / ratings.length

  // Aiken's V from relevance ratings
  const relevanceRatings = ratings.map((r) => r.relevance)
  const v = aikenV(relevanceRatings)

  // Modal construct: most frequently assigned
  const constructCounts: Record<string, number> = {}
  for (const rating of ratings) {
    constructCounts[rating.assignedConstructId] =
      (constructCounts[rating.assignedConstructId] ?? 0) + 1
  }
  const modalConstructId = Object.entries(constructCounts).sort(
    (a, b) => b[1] - a[1],
  )[0][0]
  const modalShare = constructCounts[modalConstructId] / ratings.length

  // Determine if leaked (modal !== intended and modal share > accuracy)
  const leakedTo =
    modalConstructId !== intendedConstructId && modalShare > assignmentAccuracy
      ? modalConstructId
      : undefined

  // Verdict logic
  let verdict: 'pass' | 'review' | 'fail'
  if (assignmentAccuracy >= opts.passAccuracy && v >= opts.passAikenV) {
    verdict = 'pass'
  } else if (
    assignmentAccuracy >= opts.reviewAccuracy &&
    v >= opts.reviewAikenV
  ) {
    verdict = 'review'
  } else {
    verdict = 'fail'
  }

  return {
    itemId,
    intendedConstructId,
    raterCount: ratings.length,
    assignmentAccuracy,
    aikenV: v,
    modalConstructId,
    modalShare,
    verdict,
    leakedTo,
  }
}

/**
 * Run full congruence panel aggregation.
 * Groups ratings by item, validates consistency, computes all metrics.
 *
 * @param allRatings - All ratings from all raters for all items
 * @param options - Override default thresholds
 * @returns PanelResult with item-level and panel-level analysis
 */
export function runCongruencePanel(
  allRatings: CongruenceRating[],
  options?: CongruenceOptions,
): PanelResult {
  if (allRatings.length === 0) {
    return {
      items: [],
      fleissKappa: 0,
      confusion: {},
      constructSummaries: [],
      overall: {
        itemCount: 0,
        raterCount: 0,
        passRate: 0,
        meanAccuracy: 0,
        meanAikenV: 0,
      },
    }
  }

  // Group ratings by item
  const ratingsByItem: Record<string, CongruenceRating[]> = {}
  const uniqueRaterModels = new Set<string>()

  for (const rating of allRatings) {
    if (!ratingsByItem[rating.itemId]) {
      ratingsByItem[rating.itemId] = []
    }
    ratingsByItem[rating.itemId].push(rating)
    uniqueRaterModels.add(rating.raterModel)
  }

  // Score each item
  const items = Object.values(ratingsByItem)
    .map((ratings) => scoreItemCongruence(ratings, options))
    .sort((a, b) => a.itemId.localeCompare(b.itemId))

  // Build confusion matrix
  const confusion = buildConfusionMatrix(allRatings)

  // Compute Fleiss' kappa: build category index from both intended and assigned
  const constructSet = new Set<string>()
  for (const rating of allRatings) {
    constructSet.add(rating.intendedConstructId)
    constructSet.add(rating.assignedConstructId)
  }
  const constructs = Array.from(constructSet).sort()
  const constructIndex: Record<string, number> = {}
  for (let i = 0; i < constructs.length; i++) {
    constructIndex[constructs[i]] = i
  }

  // Build item-category matrix for Fleiss' kappa
  const itemCategoryCounts: number[][] = []
  for (const itemId of Object.keys(ratingsByItem).sort()) {
    const ratings = ratingsByItem[itemId]
    const row = Array(constructs.length).fill(0)
    for (const rating of ratings) {
      const idx = constructIndex[rating.assignedConstructId]
      row[idx]++
    }
    itemCategoryCounts.push(row)
  }

  // No try/catch: fleissKappa now handles unbalanced rater counts natively.
  // Swallowing an error here reported 0.00 as though it were a measured value.
  const kappa =
    itemCategoryCounts.length > 0 && constructs.length > 0
      ? fleissKappa(itemCategoryCounts)
      : 0

  // Build construct summaries
  const constructSummaryMap: Record<string, ConstructSummary> = {}
  for (const constructId of constructs) {
    constructSummaryMap[constructId] = {
      constructId,
      itemCount: 0,
      meanAccuracy: 0,
      meanAikenV: 0,
      passRate: 0,
    }
  }

  // Populate construct summaries
  for (const item of items) {
    const summary = constructSummaryMap[item.intendedConstructId]
    summary.itemCount++
    summary.meanAccuracy += item.assignmentAccuracy
    summary.meanAikenV += item.aikenV
    if (item.verdict === 'pass') summary.passRate++
  }

  for (const summary of Object.values(constructSummaryMap)) {
    if (summary.itemCount > 0) {
      summary.meanAccuracy /= summary.itemCount
      summary.meanAikenV /= summary.itemCount
      summary.passRate /= summary.itemCount
    }
  }

  // Identify most confused pairs (biggest off-diagonals)
  for (const intended of constructs) {
    if (!constructSummaryMap[intended]) continue
    const row = confusion[intended] || {}
    let maxConfusedWith: string | undefined
    let maxCount = 0

    for (const assigned of Object.keys(row)) {
      if (assigned !== intended && (row[assigned] ?? 0) > maxCount) {
        maxConfusedWith = assigned
        maxCount = row[assigned]
      }
    }

    if (maxConfusedWith) {
      constructSummaryMap[intended].mostConfusedWith = maxConfusedWith
    }
  }

  const constructSummaries = Object.values(constructSummaryMap).filter(
    (s) => s.itemCount > 0,
  )

  // Panel-level aggregates
  const passCount = items.filter((i) => i.verdict === 'pass').length
  const meanAccuracy =
    items.length > 0 ? items.reduce((sum, i) => sum + i.assignmentAccuracy, 0) / items.length : 0
  const meanAikenV =
    items.length > 0 ? items.reduce((sum, i) => sum + i.aikenV, 0) / items.length : 0

  return {
    items,
    fleissKappa: kappa,
    confusion,
    constructSummaries,
    overall: {
      itemCount: items.length,
      raterCount: uniqueRaterModels.size,
      passRate: items.length > 0 ? passCount / items.length : 0,
      meanAccuracy,
      meanAikenV,
    },
  }
}
