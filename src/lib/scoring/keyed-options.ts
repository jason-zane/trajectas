/**
 * Option-level keyed scoring.
 *
 * An item is "keyed" when any of its options carries a score_value — expert
 * keying for SJT options, correct/incorrect for binary knowledge items,
 * scored categorical single-select. For keyed items the participant's score
 * is the key of the option they chose, POMP-scaled against the item's best
 * and worst non-excluded keys. Keys encode direction themselves, so
 * reverse_scored must NOT be applied on top of keyed scoring.
 *
 * Options flagged exclude_from_scoring ("Don't know" / "Not applicable")
 * remove the response from quantitative aggregates entirely — an explicit
 * outcome, distinct from scoring 0.
 *
 * @module
 */

import { toPomp } from '@/lib/scoring/transforms'

export interface ScorableOption {
  /** The response_value recorded when this option is selected. */
  value: number
  /** Keyed score contribution; null = option not keyed. */
  scoreValue: number | null
  /** Selecting this option drops the response from scoring. */
  excludeFromScoring: boolean
}

export type KeyedOutcome =
  /** Response scored against the item's key range. */
  | { kind: 'scored'; pomp: number }
  /** Participant chose an excluded option — drop from aggregates. */
  | { kind: 'excluded' }
  /** Item or response cannot be key-scored — fall back to value scoring. */
  | { kind: 'unkeyable' }

/**
 * Whether the item should take the keyed-scoring path.
 */
export function isKeyedItem(options: ScorableOption[]): boolean {
  return options.some((o) => o.scoreValue != null)
}

/**
 * Score one response against an item's option keys.
 *
 * Unmatched response values and degenerate keys (fewer than two distinct
 * scoreable key values) report 'unkeyable' so the caller can fall back to
 * raw-value scoring rather than fabricate a number.
 */
export function scoreKeyedResponse(
  responseValue: number,
  options: ScorableOption[],
): KeyedOutcome {
  const selected = options.find((o) => o.value === responseValue)
  if (!selected) return { kind: 'unkeyable' }
  if (selected.excludeFromScoring) return { kind: 'excluded' }
  if (selected.scoreValue == null) return { kind: 'unkeyable' }

  const keyValues = options
    .filter((o) => !o.excludeFromScoring && o.scoreValue != null)
    .map((o) => o.scoreValue as number)
  const minKey = Math.min(...keyValues)
  const maxKey = Math.max(...keyValues)
  if (!(maxKey > minKey)) return { kind: 'unkeyable' }

  return { kind: 'scored', pomp: toPomp(selected.scoreValue, minKey, maxKey) }
}
