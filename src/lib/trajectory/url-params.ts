/**
 * URL search-param encoding for the Trajectory workspace state.
 *
 * Encoded:
 *   level        "factor" when the user is in the Capabilities view; absent for the default dimension view
 *   parent       parent dimension id when Capabilities is filtered to one brain; absent otherwise
 *   selected     csv of entity ids ticked in the list (chart only renders these); absent when all-selected
 *   drill        csv of entity ids from outermost to innermost drill frame (deep-drill into a single entity)
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

/** Top-level view selector. "factor" = the Capabilities flat view. */
export type TrajectoryViewLevel = 'dimension' | 'factor'

export type TrajectoryUrlState = {
  viewLevel: TrajectoryViewLevel
  parentFilter: string | null
  selectedEntityIds: string[] | null
  drillEntityIds: string[]
  mode: TimelineMode
  matrix: boolean
  assessmentIds: string[] | null
}

export function defaultUrlState(): TrajectoryUrlState {
  return {
    viewLevel: 'dimension',
    parentFilter: null,
    selectedEntityIds: null,
    drillEntityIds: [],
    mode: 'absolute',
    matrix: false,
    assessmentIds: null,
  }
}

function parseCsv(raw: string | null): string[] | null {
  if (!raw) return null
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ids.length > 0 ? ids : null
}

export function decodeTrajectoryParams(
  params: URLSearchParams | ReadonlyURLSearchParams,
): TrajectoryUrlState {
  const viewLevel: TrajectoryViewLevel =
    params.get('level') === 'factor' ? 'factor' : 'dimension'
  const parentFilter = params.get('parent')?.trim() || null
  const selectedEntityIds = parseCsv(params.get('selected'))

  const drillEntityIds = parseCsv(params.get('drill')) ?? []
  const mode: TimelineMode = params.get('mode') === 'change' ? 'change' : 'absolute'
  const matrix = params.get('matrix') === '1'
  const assessmentIds = parseCsv(params.get('assessments'))

  return {
    viewLevel,
    parentFilter,
    selectedEntityIds,
    drillEntityIds,
    mode,
    matrix,
    assessmentIds,
  }
}

export function encodeTrajectoryParams(state: TrajectoryUrlState): URLSearchParams {
  const out = new URLSearchParams()
  if (state.viewLevel === 'factor') out.set('level', 'factor')
  if (state.parentFilter) out.set('parent', state.parentFilter)
  if (state.selectedEntityIds && state.selectedEntityIds.length > 0) {
    out.set('selected', state.selectedEntityIds.join(','))
  }
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
