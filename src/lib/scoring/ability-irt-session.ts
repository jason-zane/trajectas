/**
 * Extension point for `scoring_profile = 'ability_irt'` (LR-5 / #335 scope
 * item 7: "leave the seam and document the N-floor gate. Do not implement
 * theta scoring itself.").
 *
 * The dormant IRT maths this will use already exists and is complete:
 * src/lib/scoring/irt/models.ts (probability/information functions) and
 * src/lib/scoring/irt/estimation.ts (`estimateEAP`, `estimateMLE`). Nothing
 * here duplicates it — this module is only the dispatch seam plus the gate.
 *
 * @module
 */

import { scoreSessionAbility } from '@/lib/scoring/ability-session'

/**
 * Per-item calibration sample-size floor before a 2PL parameter set may be
 * trusted for operational theta scoring. Sourced from
 * docs/superpowers/specs/2026-08-12-cognitive-assessments/
 * 06-battery-and-psychometric-programme.md §4.3/§8.3 ("2PL ~500
 * responses/item for stable a and b … no item is promoted to operational
 * scoring below its model's N floor"; also §8.3's "no percentile or band is
 * reported against any norm group with N < 500"). That document is cross-
 * referenced for this constant's justification; it was not part of this
 * issue's mandated reading (02-…-architecture.md §4/§1.4,
 * 05-…-interpretation.md §1/§2), which only says "fall back to sum-correct"
 * without naming a number.
 */
export const IRT_2PL_N_FLOOR = 500

/**
 * Not implemented. Always falls back to `scoreSessionAbility` and records
 * `scoring_variant = 'sum_correct_fallback'`, per
 * 02-…-architecture.md §4.3 step 2 ("If any counts_toward_score item lacks
 * current parameters → fall back to scoreSessionAbility … Never partially
 * theta-score.") — since NOTHING in this programme yet writes a
 * `item_parameters` row with `is_current = true` and `n_responses >=
 * IRT_2PL_N_FLOOR` (the table is empty in every environment, confirmed
 * against the live schema while building 20260813104000_cognitive_scoring
 * .sql), every counts_toward_score item always "lacks current parameters"
 * today, so the fallback fires unconditionally. That makes it safe for the
 * dispatcher (src/lib/scoring/dispatch.ts) to route
 * `scoring_profile = 'ability_irt'` here right now, even though no
 * assessment sets that profile yet.
 *
 * When this is implemented for real, the wiring is (02-…-architecture.md
 * §4.3):
 *
 *   1. Read participant_item_outcomes for the session — already persisted
 *      as dichotomous correct/incorrect by scoreSessionAbility for every
 *      scoring_profile, which is why that scorer always writes them even
 *      when its own profile is 'ability_dichotomous'.
 *   2. Load item_parameters WHERE is_current AND scale_code = <the factor's
 *      scale code>. If ANY counts_toward_score item's parameters are
 *      missing, not current, or have n_responses < IRT_2PL_N_FLOOR, do NOT
 *      partially theta-score — call scoreSessionAbility with
 *      `{ scoringVariant: 'sum_correct_fallback' }` (as this stub already
 *      does) and log the specific missing/under-N item ids.
 *   3. Build a `Map<itemId, IRTParameters>` and call
 *      `estimateEAP(responses, itemParams)` from
 *      src/lib/scoring/irt/estimation.ts — EAP, not MLE: MLE is undefined
 *      at perfect/zero raw scores, and 06-…-programme.md §4.3 specifies EAP
 *      with a standard-normal prior on the calibration population.
 *   4. T-score and percentile against a NAMED, VERSIONED norm group only
 *      (never write percentile without norm_group_id + norm_version — the
 *      participant_scores_norm_referenced_requires_group /
 *      ..._norm_group_requires_version CHECK constraints added in
 *      20260813104000_cognitive_scoring.sql make this structurally
 *      impossible even if this function's future implementation forgets).
 *      No percentile against any norm group with N < 500
 *      (06-…-programme.md §8.3).
 *   5. Write participant_scores with metric='t_score',
 *      scoring_variant='eap_2pl', theta, theta_se, parameter_scale_code,
 *      norm_group_id, norm_version, scaled_score = T-score, percentile,
 *      confidence_interval_lower/upper = T +/- 1.96 * (10 * theta_se).
 *
 * The GATE that must be true before `scoring_profile` is ever flipped to
 * `ability_irt` for a real assessment: every counts_toward_score item for
 * that factor's scale_code has an `item_parameters` row with
 * `is_current = true` and `n_responses >= IRT_2PL_N_FLOOR`. That flip is a
 * DATA change (promoting the assessment's scoring_profile via an admin
 * action or migration), not a deploy — per 02-…-architecture.md §4.3's
 * closing line, "the flip is a data change, not a deploy."
 */
export async function scoreSessionAbilityIRT(
  sessionId: string,
): Promise<{ success: true; scoreCount: number } | { error: string }> {
  console.warn(
    `[scoring] scoreSessionAbilityIRT is an unimplemented extension point (LR-5/#335 scope item 7); ` +
      `falling back to sum-correct scoring for session ${sessionId}.`,
  )
  return scoreSessionAbility(sessionId, { scoringVariant: 'sum_correct_fallback' })
}
