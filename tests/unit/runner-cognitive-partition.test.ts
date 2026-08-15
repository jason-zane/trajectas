import { describe, expect, it, vi } from 'vitest'
import { partitionScoreRows } from '@/lib/reports/runner'

// -----------------------------------------------------------------------------
// LR-11 / #341 regression + fix proof.
//
// Before this change, runner.ts's scoreMap-building loop read
// `row.scaled_score` for EVERY participant_scores row regardless of
// `metric`, so a cognitive/ability row (metric IN ('percent_correct',
// 't_score')) would land in the same scoreMap as POMP factor scores and get
// rendered through the generic band-scheme pipeline (score_overview,
// score_detail, dimension_chapter, strengths_highlights, development_plan,
// score_interpretation*) as though it were a 0-100 competency score — the
// exact trap 05-scoring-and-interpretation.md §5.2 warns about.
//
// partitionScoreRows is the fix: it is the single choke point the runner
// now uses to build scoreMap, and it is exported specifically so this "no
// regression" claim is provable rather than asserted.
// -----------------------------------------------------------------------------

function pompRow(overrides: Record<string, unknown> = {}) {
  return {
    factor_id: 'factor-pomp',
    scaled_score: 82,
    metric: 'pomp',
    provisional: false,
    ...overrides,
  }
}

function legacyPompRow(overrides: Record<string, unknown> = {}) {
  // Rows written before the metric column existed, or any row where the
  // column's own DB DEFAULT 'pomp' applied — metric is present as 'pomp'
  // once read back, but callers building fixtures by hand sometimes omit
  // it. isCognitiveMetric(undefined) must be false either way.
  const row: Record<string, unknown> = {
    factor_id: 'factor-legacy',
    scaled_score: 55,
    provisional: false,
    ...overrides,
  }
  delete row.metric
  return row
}

function uncalibratedCognitiveRow(overrides: Record<string, unknown> = {}) {
  return {
    factor_id: 'factor-lrm',
    scaled_score: 67.9,
    metric: 'percent_correct',
    raw_correct: 19,
    items_used: 28,
    items_attempted: 26,
    theta: null,
    theta_se: null,
    norm_group_id: null,
    norm_version: null,
    percentile: null,
    confidence_interval_lower: null,
    confidence_interval_upper: null,
    provisional: true,
    scoring_variant: 'sum_correct',
    ...overrides,
  }
}

describe('partitionScoreRows', () => {
  it('routes an unmodified pomp_factor row into scoreMap exactly as before this change (the regression gate)', () => {
    const { scoreMap, cognitiveScores } = partitionScoreRows([pompRow()])
    expect(scoreMap).toEqual({ 'factor-pomp': 82 })
    expect(cognitiveScores).toEqual([])
  })

  it('treats a row with metric absent (legacy/hand-built fixture) as pomp, not cognitive', () => {
    const { scoreMap, cognitiveScores } = partitionScoreRows([legacyPompRow()])
    expect(scoreMap).toEqual({ 'factor-legacy': 55 })
    expect(cognitiveScores).toEqual([])
  })

  it('excludes a cognitive/ability row from scoreMap entirely and resolves it via resolveCognitiveScoreDisplay instead', () => {
    const { scoreMap, cognitiveScores } = partitionScoreRows([uncalibratedCognitiveRow()])
    expect(scoreMap).toEqual({})
    expect(cognitiveScores).toHaveLength(1)
    expect(cognitiveScores[0]).toEqual({
      factorId: 'factor-lrm',
      display: {
        kind: 'uncalibrated',
        provisional: true,
        rawCorrect: 19,
        itemsUsed: 28,
        itemsAttempted: 26,
      },
    })
  })

  it('mixed session: the pomp entry in scoreMap is byte-identical to the pomp-only case, and the cognitive row never appears in scoreMap under any key', () => {
    const { scoreMap, cognitiveScores } = partitionScoreRows([
      pompRow(),
      uncalibratedCognitiveRow(),
    ])
    // Exactly the pomp entry — no 'factor-lrm' key, no leaked scaled_score
    // for the cognitive row, nothing extra.
    expect(scoreMap).toEqual({ 'factor-pomp': 82 })
    expect(Object.keys(scoreMap)).toHaveLength(1)
    expect(cognitiveScores).toHaveLength(1)
    expect(cognitiveScores[0].factorId).toBe('factor-lrm')
  })

  it('a corrupted cognitive row (claims-ladder violation) is dropped, logged, and does not take the report down', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // provisional=false with no norm group is impossible per the claims
    // ladder — resolveCognitiveScoreDisplay throws CognitiveClaimsViolation.
    const corrupted = uncalibratedCognitiveRow({ provisional: false })

    const { scoreMap, cognitiveScores } = partitionScoreRows([pompRow(), corrupted])

    expect(scoreMap).toEqual({ 'factor-pomp': 82 })
    expect(cognitiveScores).toEqual([])
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls[0][0]).toMatch(/cognitive claims violation/i)
    errorSpy.mockRestore()
  })

  it('skips rows with no factor_id', () => {
    const { scoreMap, cognitiveScores } = partitionScoreRows([
      { ...pompRow(), factor_id: null },
      { ...uncalibratedCognitiveRow(), factor_id: undefined },
    ])
    expect(scoreMap).toEqual({})
    expect(cognitiveScores).toEqual([])
  })

  it('handles an empty row set', () => {
    expect(partitionScoreRows([])).toEqual({ scoreMap: {}, cognitiveScores: [] })
  })
})
