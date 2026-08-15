/**
 * ADVISORY mirror of the sign-off precondition enforced by
 * `items_review_signoff_guard()` (migration 20260814110000).
 *
 * ---------------------------------------------------------------------------
 * Why this exists at all, given the rule "don't duplicate the state machine"
 * ---------------------------------------------------------------------------
 * The LIFECYCLE TRANSITION GRAPH is not duplicated anywhere in TypeScript. It
 * is read at request time from `item_lifecycle_legal_transitions()` via
 * `getItemLifecycleTransitions()`, which is the same function the enforcing
 * trigger consults.
 *
 * The SIGN-OFF PRECONDITION is a different, orthogonal rule, and the database
 * exposes no function that reports it. #347 requires that an item cannot reach
 * `operational` without both sign-offs AND that a reviewer sees this coming
 * rather than discovering it as a failed write. Those two things cannot both
 * be true unless the UI knows the precondition before it attempts the update.
 *
 * So this module holds exactly one fact — the set of target states requiring
 * each sign-off — under three constraints that keep it from drifting into a
 * second source of truth:
 *
 *   1. It is ADVISORY. Nothing here authorises anything. The trigger is the
 *      only enforcer, and `transitionItemLifecycle` surfaces its message
 *      verbatim, so a disagreement between this file and the database shows up
 *      as the database winning, not as an item being wrongly promoted.
 *   2. It is PINNED. `tests/unit/item-bank-signoff-policy.test.ts` parses the
 *      migration's `items_review_signoff_guard()` body and asserts the state
 *      lists below match it exactly. Editing the guard without editing this
 *      file fails CI.
 *   3. It is SMALL and it is here, in the route folder that consumes it —
 *      not in `src/lib`, where it would look like a reusable authority.
 */

export type ReviewKind = 'content' | 'fairness'

/**
 * Target states that require a standing CONTENT sign-off.
 * Mirrors the `NEW.lifecycle_state = 'content_reviewed'` branch plus the
 * combined branch below it.
 */
export const STATES_REQUIRING_CONTENT_SIGNOFF = [
  'content_reviewed',
  'fairness_reviewed',
  'piloting',
  'calibrated',
  'operational',
] as const

/**
 * Target states that require a standing FAIRNESS sign-off.
 * Mirrors the `NEW.lifecycle_state IN (...)` branch of the guard.
 *
 * `content_reviewed` is deliberately absent: content review is the first gate
 * and does not presuppose fairness review.
 */
export const STATES_REQUIRING_FAIRNESS_SIGNOFF = [
  'fairness_reviewed',
  'piloting',
  'calibrated',
  'operational',
] as const

/** Which sign-offs the database will demand before it allows `targetState`. */
export function signOffsRequiredFor(targetState: string): ReviewKind[] {
  const required: ReviewKind[] = []
  if ((STATES_REQUIRING_CONTENT_SIGNOFF as readonly string[]).includes(targetState)) required.push('content')
  if ((STATES_REQUIRING_FAIRNESS_SIGNOFF as readonly string[]).includes(targetState)) required.push('fairness')
  return required
}

/**
 * The standing state of one sign-off, reduced to what the gate actually tests.
 * Mirrors the guard's three rejection branches in order: missing, rejected,
 * stale (signed against different content).
 */
export type SignOffGateState = {
  present: boolean
  approved: boolean
  /** False when the item's content changed after the sign-off was given. */
  matchesCurrentContent: boolean
}

export type BlockedReason = {
  kind: ReviewKind
  reason: 'missing' | 'rejected' | 'stale'
  message: string
}

const KIND_LABEL: Record<ReviewKind, string> = { content: 'Content', fairness: 'Fairness' }

/**
 * Why the database would refuse `targetState` right now, or an empty array if
 * the sign-off gate is satisfied. Messages are written to match the guard's
 * own wording so a reviewer sees the same explanation before and after.
 */
export function signOffBlockers(
  targetState: string,
  gate: Record<ReviewKind, SignOffGateState>,
): BlockedReason[] {
  const blockers: BlockedReason[] = []
  for (const kind of signOffsRequiredFor(targetState)) {
    const state = gate[kind]
    if (!state.present) {
      blockers.push({ kind, reason: 'missing', message: `No ${kind} review has been recorded.` })
    } else if (!state.approved) {
      blockers.push({ kind, reason: 'rejected', message: `The standing ${kind} review is a rejection.` })
    } else if (!state.matchesCurrentContent) {
      blockers.push({
        kind,
        reason: 'stale',
        message: `The standing ${kind} sign-off was given for different content; re-review it.`,
      })
    }
  }
  return blockers
}

export function signOffKindLabel(kind: ReviewKind): string {
  return KIND_LABEL[kind]
}
