/**
 * URL search-param encoding for the Trajectory workspace state.
 *
 * Encoded:
 *   drill        csv of entity ids from outermost to innermost frame
 *   mode         "change" if non-default; absent otherwise
 *   matrix       "1" if matrix view is shown; absent otherwise
 *   assessments  csv of selected assessment ids when not all-selected
 *
 * The full drill chain is captured (not just the leaf) so we can
 * reconstruct the breadcrumb after a page reload without an extra
 * server round-trip.
 *
 * Decoded values are intentionally loose (best-effort) — invalid
 * entries fall back to defaults instead of throwing.
 */

import type { TimelineMode } from '@/components/trajectory/trajectory-timeline'

export type TrajectoryUrlState = {
  drillEntityIds: string[]
  mode: TimelineMode
  matrix: boolean
  assessmentIds: string[] | null
}

export function defaultUrlState(): TrajectoryUrlState {
  return { drillEntityIds: [], mode: 'absolute', matrix: false, assessmentIds: null }
}

export function decodeTrajectoryParams(
  params: URLSearchParams | ReadonlyURLSearchParams,
): TrajectoryUrlState {
  const drillRaw = params.get('drill') ?? ''
  const drillEntityIds = drillRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const mode: TimelineMode = params.get('mode') === 'change' ? 'change' : 'absolute'
  const matrix = params.get('matrix') === '1'

  const assessmentsRaw = params.get('assessments')
  const assessmentIds =
    assessmentsRaw && assessmentsRaw.length > 0
      ? assessmentsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null

  return { drillEntityIds, mode, matrix, assessmentIds }
}

export function encodeTrajectoryParams(state: TrajectoryUrlState): URLSearchParams {
  const out = new URLSearchParams()
  if (state.drillEntityIds.length > 0) out.set('drill', state.drillEntityIds.join(','))
  if (state.mode === 'change') out.set('mode', 'change')
  if (state.matrix) out.set('matrix', '1')
  if (state.assessmentIds && state.assessmentIds.length > 0) {
    out.set('assessments', state.assessmentIds.join(','))
  }
  return out
}

/** Convenience: produce a "?…" query string or empty string for clean URLs. */
export function encodeTrajectoryParamsAsQuery(state: TrajectoryUrlState): string {
  const params = encodeTrajectoryParams(state)
  const s = params.toString()
  return s.length > 0 ? `?${s}` : ''
}

// Re-declare the type from next/navigation here as a structural-compatible
// shape so this module doesn't import next/navigation (keeps it pure-testable).
type ReadonlyURLSearchParams = {
  get(name: string): string | null
}
