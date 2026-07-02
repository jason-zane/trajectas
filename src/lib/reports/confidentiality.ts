/**
 * Campaign confidentiality — pure helpers shared by server actions, API
 * routes, and UI. No server-only imports so these stay unit-testable and
 * usable from client components (e.g. the raters manager).
 *
 * A campaign with confidentiality_mode = 'aggregate_only' promises
 * participants that the client receives group-level patterns only — never
 * their individual answers (see getDefaultConsentBody in
 * src/lib/experience/resolve.ts). Enforcement decisions:
 *
 * - Client and partner viewers are blocked from every individual-level
 *   surface: factor scores, composite scores, item responses, report
 *   snapshots (list / detail / PDF / email / manage), and per-participant
 *   score timelines (canvas, comparison, CSV exports).
 * - Platform admins retain individual access for support and scoring QA.
 *   The participant promise is about what the *client* receives; the
 *   platform operates the data pipeline, and its access is audit-logged
 *   like any other support access.
 * - Individual report snapshots are not generated at all for aggregate-only
 *   campaigns (see ensureReportSnapshotsForSession in
 *   src/app/actions/assess.ts) — artefacts that must never reach the client
 *   are never created. The read gates below still apply as defence in depth
 *   for snapshots that predate a standard → aggregate_only mode change.
 * - The same rules are mirrored in RLS
 *   (supabase/migrations/20260703120000_aggregate_only_enforcement.sql) so
 *   direct PostgREST access follows the app.
 */

export type CampaignConfidentialityMode = 'standard' | 'aggregate_only'

/**
 * Minimum number of distinct participants with completed sessions before
 * campaign-level aggregate results are shown. Below this, a group mean gets
 * close enough to an individual answer that the aggregate-only promise
 * would be hollow. Same k-anonymity floor as rater reporting.
 */
export const AGGREGATE_MIN_GROUP_SIZE = 3

/**
 * Minimum raters in a 360 category before that category's scores are shown.
 * Previously a local constant in campaign-raters-manager.tsx.
 */
export const ANON_THRESHOLD = 3

export function isAggregateOnly(
  mode: CampaignConfidentialityMode | null | undefined,
): boolean {
  return mode === 'aggregate_only'
}

/**
 * Whether a viewer may see individual-level results (scores, responses,
 * report snapshots) for a campaign with the given confidentiality mode.
 */
export function canViewIndividualResults(
  mode: CampaignConfidentialityMode | null | undefined,
  viewer: { isPlatformAdmin: boolean },
): boolean {
  return !isAggregateOnly(mode) || viewer.isPlatformAdmin
}

/**
 * Whether individual report snapshots should be generated for sessions in a
 * campaign with the given confidentiality mode.
 */
export function shouldGenerateIndividualReports(
  mode: CampaignConfidentialityMode | null | undefined,
): boolean {
  return !isAggregateOnly(mode)
}
