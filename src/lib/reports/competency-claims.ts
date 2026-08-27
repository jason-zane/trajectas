// =============================================================================
// src/lib/reports/competency-claims.ts
//
// The claims ladder for COMPETENCY (metric='pomp') scores — the read-side
// mirror of the DB constraints, exactly as cognitive-claims.ts is for
// ability scores. Together they cover every metric participant_scores allows
// (participant_scores_metric_check: 'pomp' | 'percent_correct' | 't_score').
//
// Why this exists separately from cognitive-claims.ts
// ---------------------------------------------------
// The write-side guarantee is already universal: the CHECK constraint
// participant_scores_norm_referenced_requires_group refuses a percentile or a
// confidence interval on ANY row without a versioned norm group, whatever its
// metric. But the READ-side guard was cognitive-only ("Never 'pomp'"), so
// every competency score in the library sat outside it. Any surface reading
// those rows could forward a norm-referenced claim by accident. This closes
// that half.
//
// The psychometric difference that shapes the types
// -------------------------------------------------
// A POMP score is CRITERION-referenced: 0–100 percent-of-maximum-possible,
// meaningful on its own against a band scheme without any comparison group.
// So unlike an uncalibrated cognitive score — which may show only raw counts —
// an uncalibrated competency score MAY display its scaled score, and may
// legitimately be final rather than provisional.
//
// What it may never do without a versioned norm group is make a RANK claim:
// a percentile, a confidence interval around a norm-referenced estimate, or
// any statement positioning the person against other people. Those fields are
// absent from UncalibratedCompetencyScore — not optional, not nullable —
// so forwarding one is a compile error rather than a code-review question.
//
// Pinned by tests/architecture/competency-claims-ladder.test.ts.
// =============================================================================

/** The competency-scoring metric. Cognitive metrics live in cognitive-claims.ts. */
export type CompetencyMetric = 'pomp'

export function isCompetencyMetric(
  metric: string | null | undefined,
): metric is CompetencyMetric {
  return metric === 'pomp'
}

/**
 * Raw participant_scores columns relevant to the competency ladder. Snake_case,
 * mirroring the row shape callers already hold — the same convention
 * cognitive-claims.ts uses, so this module is the single place that turns a
 * raw competency row into something safe to display.
 */
export interface RawCompetencyScoreRow {
  metric: string
  scaled_score: number
  raw_score: number | null
  norm_group_id: string | null
  norm_version: string | null
  percentile: number | null
  confidence_interval_lower: number | null
  confidence_interval_upper: number | null
  provisional: boolean
  scoring_variant: string | null
}

/**
 * A competency score with no norm group. Deliberately has NO percentile,
 * confidence interval, or norm-group field — there is no slot for a rank
 * claim to land in. `scaledScore` is present because POMP is criterion-
 * referenced and means something without a comparison group.
 */
export interface UncalibratedCompetencyScore {
  kind: 'uncalibrated'
  provisional: boolean
  scaledScore: number
  rawScore: number | null
}

/**
 * A competency score backed by a named, versioned norm group. Only ever
 * constructed when the row has both norm_group_id AND norm_version
 * (matching participant_scores_norm_group_requires_version) and carries a
 * non-null percentile (matching participant_scores_norm_referenced_requires_group).
 */
export interface CalibratedCompetencyScore {
  kind: 'calibrated'
  provisional: boolean
  scaledScore: number
  rawScore: number | null
  percentile: number
  confidenceIntervalLower: number | null
  confidenceIntervalUpper: number | null
  normGroupId: string
  normVersion: string
}

export type CompetencyScoreDisplay =
  | UncalibratedCompetencyScore
  | CalibratedCompetencyScore

/**
 * Thrown when a participant_scores row is in a state
 * resolveCompetencyScoreDisplay cannot safely render. Fail-closed, not a
 * fallback: callers must catch it and render nothing rather than guess.
 */
export class CompetencyClaimsViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompetencyClaimsViolation'
  }
}

/**
 * THE structural guard for competency scores. Branches on the same predicate
 * the DB constraints encode — a versioned norm group — not on `metric` alone,
 * so a row inconsistent with its own norm-group state throws rather than
 * guessing which rung of the ladder it belongs on.
 *
 * Builds its return value FIELD BY FIELD rather than spreading the input row,
 * so a stray non-null percentile sitting in an uncalibrated row (a bug, a
 * hand-edited row, a future migration that loosens the constraint) has
 * nowhere to land.
 */
export function resolveCompetencyScoreDisplay(
  row: RawCompetencyScoreRow,
): CompetencyScoreDisplay {
  // Metric first, before anything is exposed. A cognitive row reaching this
  // resolver would otherwise have its scaled_score surfaced as a
  // criterion-referenced competency score — which is precisely the trap
  // runner.ts documents: a percent-correct value rendered against competency
  // bands ("Highly Effective") reads as a norm-referenced rank and is not one.
  // The cognitive ladder deliberately withholds that field; routing around it
  // by passing the row here must fail, not silently succeed.
  if (!isCompetencyMetric(row.metric)) {
    throw new CompetencyClaimsViolation(
      `participant_scores row has metric '${row.metric}', not 'pomp' — refusing to ` +
        'render a cognitive score as a competency score. Use ' +
        'resolveCognitiveScoreDisplay() from cognitive-claims.ts instead.',
    )
  }

  if (!Number.isFinite(row.scaled_score)) {
    throw new CompetencyClaimsViolation(
      'participant_scores row has a non-finite scaled_score — nothing safe to render.',
    )
  }

  const hasVersionedNormGroup =
    row.norm_group_id !== null && row.norm_version !== null

  if (hasVersionedNormGroup) {
    if (row.percentile === null) {
      throw new CompetencyClaimsViolation(
        'participant_scores row is norm-referenced (has a versioned norm group) but ' +
          'has no percentile — refusing to render a partial calibrated score.',
      )
    }
    if (
      (row.confidence_interval_lower === null) !==
      (row.confidence_interval_upper === null)
    ) {
      throw new CompetencyClaimsViolation(
        'participant_scores row has only one half of a confidence interval — ' +
          'refusing to render an interval that has no bound on one side.',
      )
    }
    return {
      kind: 'calibrated',
      provisional: row.provisional,
      scaledScore: row.scaled_score,
      rawScore: row.raw_score,
      percentile: row.percentile,
      confidenceIntervalLower: row.confidence_interval_lower,
      confidenceIntervalUpper: row.confidence_interval_upper,
      normGroupId: row.norm_group_id as string,
      normVersion: row.norm_version as string,
    }
  }

  // No versioned norm group: this score may not carry a percentile or a
  // confidence interval, regardless of what stray values the row holds. Note
  // that — unlike a cognitive score — it MAY be final: a criterion-referenced
  // POMP score does not need calibration to be a settled result.
  return {
    kind: 'uncalibrated',
    provisional: row.provisional,
    scaledScore: row.scaled_score,
    rawScore: row.raw_score,
  }
}
