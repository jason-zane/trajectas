/**
 * Factor completeness — the two-tier readiness bar, computed from a factor's
 * fields. Shared by the authoring meters (client) and the promote gate (server)
 * so they never disagree.
 *
 *   assessment_ready — well-defined + categorised + measurable.
 *   match_ready      — adds applicability tags, overuse signature, contrasts,
 *                      lineage (distinctness is verified separately in Phase 2).
 */

export type FactorCompletenessInput = {
  primaryCategoryId?: string | null
  definition?: string | null
  description?: string | null
  indicatorsLow?: string | null
  indicatorsMid?: string | null
  indicatorsHigh?: string | null
  anchorLow?: string | null
  anchorHigh?: string | null
  applicableOutcomes?: string[]
  applicableLevels?: string[]
  overuseSignature?: string | null
  contrastsWith?: string[]
  theoreticalLineage?: string | null
  constructCount: number
  activeItemCount: number
}

export type ReadinessCheck = { label: string; ok: boolean }
export type TierStatus = { met: boolean; missing: string[]; complete: number; total: number }

const has = (v?: string | null) => !!(v && v.trim().length > 0)
const hasArr = (v?: string[]) => !!(v && v.length > 0)

export function assessmentReadyChecks(f: FactorCompletenessInput): ReadinessCheck[] {
  return [
    { label: 'Category', ok: has(f.primaryCategoryId) },
    { label: 'Definition', ok: has(f.definition) },
    { label: 'Description', ok: has(f.description) },
    {
      label: 'Indicators (low/mid/high)',
      ok: has(f.indicatorsLow) && has(f.indicatorsMid) && has(f.indicatorsHigh),
    },
    { label: 'Anchors (low/high)', ok: has(f.anchorLow) && has(f.anchorHigh) },
    { label: 'Linked construct', ok: f.constructCount > 0 },
    { label: 'Active item', ok: f.activeItemCount > 0 },
  ]
}

export function matchReadyChecks(f: FactorCompletenessInput): ReadinessCheck[] {
  return [
    ...assessmentReadyChecks(f),
    { label: 'Applicable outcomes', ok: hasArr(f.applicableOutcomes) },
    { label: 'Applicable levels', ok: hasArr(f.applicableLevels) },
    { label: 'Overuse signature', ok: has(f.overuseSignature) },
    { label: 'Contrasts with', ok: hasArr(f.contrastsWith) },
    { label: 'Theoretical lineage', ok: has(f.theoreticalLineage) },
  ]
}

function summarise(checks: ReadinessCheck[]): TierStatus {
  const complete = checks.filter((c) => c.ok).length
  return {
    met: complete === checks.length,
    missing: checks.filter((c) => !c.ok).map((c) => c.label),
    complete,
    total: checks.length,
  }
}

/** Per-tier status (met / missing / score) for a factor. */
export function factorReadiness(f: FactorCompletenessInput): {
  assessment: TierStatus
  match: TierStatus
} {
  return {
    assessment: summarise(assessmentReadyChecks(f)),
    match: summarise(matchReadyChecks(f)),
  }
}
