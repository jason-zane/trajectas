// =============================================================================
// src/lib/reports/cognitive-claims.ts
//
// LR-11 / #341 — the claims-ladder structural guard.
//
// This is the ONLY function in the codebase permitted to read
// percentile / confidence_interval_* / theta off a participant_scores row
// and hand a norm-referenced claim to a report surface. Every report block
// that displays a cognitive/ability score (metric IN ('percent_correct',
// 't_score')) MUST go through resolveCognitiveScoreDisplay() — never read
// those columns directly.
//
// Why this exists: the instrument is not calibrated and has no norm group.
// supabase/migrations/20260813104000_cognitive_scoring.sql already makes it
// structurally impossible to WRITE a percentile, a confidence interval, or
// metric='t_score' without a versioned norm group (norm_group_id +
// norm_version) — the two CHECK constraints
// participant_scores_norm_group_requires_version and
// ..._norm_referenced_requires_group. This module is the READ-side mirror
// of that guarantee, enforced by the type system rather than convention:
//
//   - UncalibratedCognitiveScore has no percentile / tScore / confidence
//     interval / normGroup* property AT ALL. Not optional, not nullable —
//     absent from the type. A caller cannot forward a claim from this
//     branch because there is nothing there to forward; `display.percentile`
//     is a compile error once `display` is narrowed to this variant.
//   - CalibratedCognitiveScore is only constructible when a versioned norm
//     group is present on the row (mirroring the DB constraint exactly).
//   - resolveCognitiveScoreDisplay() builds its return value FIELD BY FIELD
//     rather than spreading the input row, so a stray non-null value sitting
//     in an uncalibrated row's percentile/CI columns (a bug, a hand-edited
//     row, a future migration that loosens the DB constraint) can never
//     leak through — the uncalibrated branch's return object simply does
//     not have a slot for it to land in.
//
// See tests/architecture/cognitive-claims-ladder.test.ts, which pins this
// with both a runtime test (a corrupted row proves the leak is impossible)
// and a compile-time test (`@ts-expect-error` on reading `.percentile` off
// a narrowed uncalibrated value — this only continues to typecheck clean
// while the guard holds, so `npx tsc --noEmit` itself enforces it on every
// future edit).
// =============================================================================

/** The two cognitive-scoring metrics written by src/lib/scoring/ability-session.ts and ability-irt-session.ts. Never 'pomp'. */
export type CognitiveMetric = 'percent_correct' | 't_score'

/** True for any metric that identifies a cognitive/ability score rather than a POMP competency score. */
export function isCognitiveMetric(metric: string | null | undefined): metric is CognitiveMetric {
  return metric === 'percent_correct' || metric === 't_score'
}

/**
 * Raw participant_scores columns relevant to the claims ladder. Snake_case,
 * mirroring the DB row shape callers already have on hand (the runner reads
 * `participant_scores.select('*')` directly, per the codebase's existing
 * convention of working with raw Supabase rows before mapping) — there is
 * no mapper indirection here on purpose, so this module is the single place
 * that translates the raw row into something safe to display.
 */
export interface RawCognitiveScoreRow {
  metric: string
  scaled_score: number
  raw_correct: number | null
  items_used: number | null
  items_attempted: number | null
  theta: number | null
  theta_se: number | null
  norm_group_id: string | null
  norm_version: string | null
  percentile: number | null
  confidence_interval_lower: number | null
  confidence_interval_upper: number | null
  provisional: boolean
  scoring_variant: string | null
}

/**
 * A cognitive score with no norm group. Deliberately has NO percentile,
 * tScore, confidence interval, or norm-group field — see the module doc
 * comment. `provisional` is always literally `true`: a score cannot be
 * uncalibrated and final at the same time (resolveCognitiveScoreDisplay
 * throws if it sees that combination rather than silently overriding it).
 */
export interface UncalibratedCognitiveScore {
  kind: 'uncalibrated'
  provisional: true
  rawCorrect: number
  itemsUsed: number
  itemsAttempted: number
}

/**
 * A cognitive score backed by a named, versioned norm group. Only ever
 * constructed when the underlying row has both norm_group_id AND
 * norm_version set (matching participant_scores_norm_group_requires_version)
 * and carries a non-null percentile and confidence interval (matching
 * participant_scores_norm_referenced_requires_group).
 */
export interface CalibratedCognitiveScore {
  kind: 'calibrated'
  provisional: boolean
  tScore: number
  percentile: number
  confidenceIntervalLower: number
  confidenceIntervalUpper: number
  normGroupId: string
  normVersion: string
}

export type CognitiveScoreDisplay = UncalibratedCognitiveScore | CalibratedCognitiveScore

/**
 * Thrown when a participant_scores row is in a state resolveCognitiveScoreDisplay
 * cannot safely render. This is a fail-closed error, not a fallback: callers
 * must catch it and render nothing (or an internal-only diagnostic) rather
 * than guess at a display. See runner.ts's cognitive_profile resolution for
 * the calling convention.
 */
export class CognitiveClaimsViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CognitiveClaimsViolation'
  }
}

/**
 * THE structural guard. Turns a raw participant_scores row into the ONLY
 * shape a cognitive report block may render.
 *
 * Branches on the same predicate the DB constraints encode — a versioned
 * norm group (norm_group_id AND norm_version both present) — not on
 * `metric` alone, so a row that is inconsistent with its own norm-group
 * state throws instead of guessing which side of the claims ladder it
 * belongs on.
 */
export function resolveCognitiveScoreDisplay(row: RawCognitiveScoreRow): CognitiveScoreDisplay {
  const hasVersionedNormGroup = row.norm_group_id !== null && row.norm_version !== null

  if (hasVersionedNormGroup) {
    if (row.metric !== 't_score') {
      throw new CognitiveClaimsViolation(
        `participant_scores row has a norm group (${row.norm_group_id}) but metric is ` +
          `'${row.metric}', not 't_score' — refusing to render a calibrated claim from a ` +
          `row that isn't on the calibrated metric.`,
      )
    }
    if (
      row.percentile === null ||
      row.confidence_interval_lower === null ||
      row.confidence_interval_upper === null
    ) {
      throw new CognitiveClaimsViolation(
        'participant_scores row is norm-referenced (has a versioned norm group) but is ' +
          'missing percentile or confidence interval — refusing to render a partial ' +
          'calibrated score.',
      )
    }
    return {
      kind: 'calibrated',
      provisional: row.provisional,
      tScore: row.scaled_score,
      percentile: row.percentile,
      confidenceIntervalLower: row.confidence_interval_lower,
      confidenceIntervalUpper: row.confidence_interval_upper,
      normGroupId: row.norm_group_id as string,
      normVersion: row.norm_version as string,
    }
  }

  // No versioned norm group: this score may not carry a percentile, a
  // T-score-shaped claim, or a confidence interval — regardless of what the
  // row's metric or stray column values happen to be. A score with no norm
  // group can also never be non-provisional: there is no such thing as a
  // "final" cognitive score below calibration under this instrument's
  // claims ladder, so a row claiming otherwise is corrupted data, not a
  // valid state to render.
  if (!row.provisional) {
    throw new CognitiveClaimsViolation(
      'participant_scores row has no versioned norm group but provisional=false — a ' +
        'cognitive score cannot be final without calibration.',
    )
  }
  if (row.raw_correct === null || row.items_used === null || row.items_attempted === null) {
    throw new CognitiveClaimsViolation(
      'participant_scores row has no norm group and is missing raw_correct/items_used/' +
        'items_attempted — nothing safe to render.',
    )
  }
  return {
    kind: 'uncalibrated',
    provisional: true,
    rawCorrect: row.raw_correct,
    itemsUsed: row.items_used,
    itemsAttempted: row.items_attempted,
  }
}
