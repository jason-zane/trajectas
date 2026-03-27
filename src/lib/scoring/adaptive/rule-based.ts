/**
 * Rule-based item selection for non-adaptive (fixed or semi-adaptive)
 * assessment delivery.
 *
 * When an assessment uses the `rule_based` item selection strategy,
 * the number of items per competency is determined by simple threshold
 * rules based on how many competencies are included in the assessment.
 * Items are then drawn from the pool according to one of three
 * strategies: random, ordered, or stratified by difficulty.
 *
 * @module
 */

import type { ItemSelectionRule, Item } from '@/types/database'

// ---------------------------------------------------------------------------
// Competency-count rule type
// ---------------------------------------------------------------------------

/**
 * A simplified rule used specifically for determining how many items
 * to select per competency, based on the total number of competencies
 * in an assessment.
 *
 * This is extracted from the generic {@link ItemSelectionRule} shape
 * in the database, where the `ruleType` is `"competency_count"` and
 * the `config` object contains the threshold fields.
 */
export interface FactorCountRule {
  /** Minimum total competencies for this rule to apply (inclusive). */
  totalFactorMin: number
  /** Maximum total competencies for this rule to apply (inclusive). */
  totalFactorMax: number
  /** Number of items to administer per competency when this rule matches. */
  itemsPerFactor: number
}

// ---------------------------------------------------------------------------
// Default rules
// ---------------------------------------------------------------------------

/**
 * Built-in item-count rules applied when no custom rules are provided.
 *
 * | Total competencies | Items per competency |
 * |--------------------|----------------------|
 * | 1 - 3              | 10                   |
 * | 4 - 7              | 7                    |
 * | 8 - 12             | 5                    |
 * | 13 +               | 4                    |
 */
const DEFAULT_RULES: FactorCountRule[] = [
  { totalFactorMin: 1, totalFactorMax: 3, itemsPerFactor: 10 },
  { totalFactorMin: 4, totalFactorMax: 7, itemsPerFactor: 7 },
  { totalFactorMin: 8, totalFactorMax: 12, itemsPerFactor: 5 },
  { totalFactorMin: 13, totalFactorMax: Infinity, itemsPerFactor: 4 },
]

// ---------------------------------------------------------------------------
// Helpers: convert DB rule to FactorCountRule
// ---------------------------------------------------------------------------

/**
 * Extract a {@link FactorCountRule} from a generic
 * {@link ItemSelectionRule} whose `ruleType` is `"competency_count"`.
 *
 * The `config` object is expected to contain `totalFactorMin`,
 * `totalFactorMax`, and `itemsPerFactor` as numeric fields.
 *
 * @param rule - A database-backed item selection rule.
 * @returns The extracted competency-count rule, or `undefined` if the
 *          rule is not of type `"competency_count"` or is malformed.
 */
export function parseFactorCountRule(
  rule: ItemSelectionRule,
): FactorCountRule | undefined {
  if (rule.ruleType !== 'competency_count') return undefined

  const min = rule.config.totalFactorMin
  const max = rule.config.totalFactorMax
  const count = rule.config.itemsPerFactor

  if (typeof min !== 'number' || typeof max !== 'number' || typeof count !== 'number') {
    return undefined
  }

  return {
    totalFactorMin: min,
    totalFactorMax: max,
    itemsPerFactor: count,
  }
}

// ---------------------------------------------------------------------------
// Items per competency
// ---------------------------------------------------------------------------

/**
 * Determine how many items to administer per competency.
 *
 * Searches the provided rules (or the defaults) for one whose
 * `[totalFactorMin, totalFactorMax]` range contains the
 * given `totalFactors` count.  Returns the matching rule's
 * `itemsPerFactor` value.
 *
 * If database-backed {@link ItemSelectionRule} objects are passed,
 * they are first converted via {@link parseFactorCountRule}.
 * Any rules that are not of type `"competency_count"` are silently
 * skipped.
 *
 * If no rule matches (which should not happen with the defaults),
 * the function falls back to **4 items per competency** as a
 * conservative default.
 *
 * @param totalFactors - Number of competencies in the assessment.
 * @param rules             - Optional custom rules.  Accepts either
 *                            {@link FactorCountRule} or raw
 *                            {@link ItemSelectionRule} objects from the DB.
 * @returns Number of items to select for each competency.
 */
export function calculateItemsPerFactor(
  totalFactors: number,
  rules?: (FactorCountRule | ItemSelectionRule)[],
): number {
  // Normalise to FactorCountRule[].
  let effectiveRules: FactorCountRule[]

  if (!rules || rules.length === 0) {
    effectiveRules = DEFAULT_RULES
  } else {
    effectiveRules = rules
      .map((r) => {
        // Already a FactorCountRule?
        if ('totalFactorMin' in r) return r as FactorCountRule
        // Try to parse from a DB rule.
        return parseFactorCountRule(r as ItemSelectionRule)
      })
      .filter((r): r is FactorCountRule => r !== undefined)

    // If nothing parsed successfully, fall back to defaults.
    if (effectiveRules.length === 0) {
      effectiveRules = DEFAULT_RULES
    }
  }

  for (const rule of effectiveRules) {
    if (
      totalFactors >= rule.totalFactorMin &&
      totalFactors <= rule.totalFactorMax
    ) {
      return rule.itemsPerFactor
    }
  }

  // Fallback — should never be reached with the default rule set.
  return 4
}

// ---------------------------------------------------------------------------
// Item selection
// ---------------------------------------------------------------------------

/** Supported item selection strategies. */
export type SelectionStrategy = 'random' | 'ordered' | 'stratified'

/**
 * Select a specified number of items from a pool for a single competency.
 *
 * Three strategies are supported:
 *
 * - **`random`** (default) — items are shuffled using Fisher-Yates and the
 *   first `count` items are returned.  Ensures a different draw each session.
 *
 * - **`ordered`** — items are sorted by `displayOrder` (ascending) and the
 *   first `count` items are taken.  Useful for piloting or when item
 *   ordering is pedagogically meaningful.
 *
 * - **`stratified`** — items are grouped by difficulty using a simple
 *   heuristic based on `displayOrder` tertiles (lower third = easy, middle
 *   third = medium, upper third = hard) and an approximately equal number
 *   are drawn from each group.  When `count` is not evenly divisible by 3,
 *   remaining slots are filled from the middle tier first, then easy.
 *   Stratification promotes content balance and improves measurement
 *   precision across the ability range.
 *
 * Only **active** construct items belonging to the specified construct IDs
 * are considered.  If the pool contains fewer eligible items than `count`,
 * all eligible items are returned (no error).
 *
 * @param constructIds - Set of construct IDs that belong to the target factor.
 * @param itemPool     - Full item pool (may contain items for other constructs).
 * @param count        - Target number of items to select.
 * @param strategy     - Selection strategy (default `'random'`).
 * @returns Array of selected item IDs.
 */
export function selectItems(
  constructIds: Set<string>,
  itemPool: Item[],
  count: number,
  strategy: SelectionStrategy = 'random',
): string[] {
  // Filter to active construct items for the target constructs.
  const eligible = itemPool.filter(
    (item) => item.constructId != null && constructIds.has(item.constructId) && item.status === 'active' && item.purpose === 'construct',
  )

  if (eligible.length === 0 || count <= 0) {
    return []
  }

  const effectiveCount = Math.min(count, eligible.length)

  switch (strategy) {
    case 'random':
      return selectRandom(eligible, effectiveCount)

    case 'ordered':
      return selectOrdered(eligible, effectiveCount)

    case 'stratified':
      return selectStratified(eligible, effectiveCount)

    default: {
      const _exhaustive: never = strategy
      throw new Error(`Unknown selection strategy: ${_exhaustive}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Strategy implementations
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates (Knuth) shuffle — in-place on a copy.
 */
function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function selectRandom(items: Item[], count: number): string[] {
  return shuffled(items)
    .slice(0, count)
    .map((item) => item.id)
}

function selectOrdered(items: Item[], count: number): string[] {
  return [...items]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, count)
    .map((item) => item.id)
}

/**
 * Stratified selection that divides items into difficulty tertiles based
 * on `displayOrder` (a proxy when explicit difficulty tiers are not available
 * on the `Item` type).  Items in the bottom third of sort order are
 * treated as "easy", middle third as "medium", and upper third as "hard".
 */
function selectStratified(items: Item[], count: number): string[] {
  // Sort by displayOrder to establish difficulty proxy.
  const sorted = [...items].sort((a, b) => a.displayOrder - b.displayOrder)
  const n = sorted.length

  // Split into tertiles.
  const cutEasy = Math.ceil(n / 3)
  const cutMedium = Math.ceil((2 * n) / 3)

  const tiers = {
    easy: shuffled(sorted.slice(0, cutEasy)),
    medium: shuffled(sorted.slice(cutEasy, cutMedium)),
    hard: shuffled(sorted.slice(cutMedium)),
  }

  // Base allocation: equal split across tiers.
  const perTier = Math.floor(count / 3)
  let remainder = count - perTier * 3

  const allocations: Record<string, number> = {
    easy: perTier,
    medium: perTier,
    hard: perTier,
  }

  // Distribute remainder to medium first, then easy.
  if (remainder > 0) {
    allocations.medium++
    remainder--
  }
  if (remainder > 0) {
    allocations.easy++
    remainder--
  }

  const selected: string[] = []

  // Draw from each tier, spilling shortfall to the next tier.
  let overflow = 0
  for (const tier of ['easy', 'medium', 'hard'] as const) {
    const target = allocations[tier] + overflow
    const drawn = tiers[tier].slice(0, target)
    selected.push(...drawn.map((item) => item.id))
    overflow = target - drawn.length
  }

  // If we still have unfilled slots (all tiers exhausted), take from any remaining.
  if (selected.length < count) {
    const selectedSet = new Set(selected)
    const remaining = shuffled(items).filter((item) => !selectedSet.has(item.id))
    for (const item of remaining) {
      if (selected.length >= count) break
      selected.push(item.id)
    }
  }

  return selected.slice(0, count)
}
