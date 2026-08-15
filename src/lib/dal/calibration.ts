import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { throwActionError } from "@/lib/security/action-errors";
import { deriveItemBounds } from "@/lib/scoring/ctt-session";
import type { CalibrationResponseRow } from "@/lib/scoring/calibration-prep";
import type { CTTItemStatistics } from "@/types/scoring";

/**
 * Data Access Layer for psychometric calibration.
 *
 * Manages calibration runs (CTT-based item and construct analysis) and
 * persists computed statistics back to the database. Complete-case filtering
 * ensures data integrity: silent listwise deletion of incomplete sessions is
 * the default behavior, and the run record captures the sample size and
 * whether data was dropped.
 *
 * See src/lib/dal/README.md.
 */

type DbClient = SupabaseClient;

/**
 * Calibration response row: a single participant's response to a single item,
 * enriched with item metadata and bounds so the scoring pipeline can use it directly.
 */
/**
 * Re-exported from the pure prep module so there is ONE definition of the row
 * contract. A divergent local copy silently drifted (it omitted `value`, the
 * field the statistics are actually computed from).
 */
export type { CalibrationResponseRow } from "@/lib/scoring/calibration-prep";

// ============================================================================
// calibration_runs queries
// ============================================================================

/**
 * Create a new calibration run with status 'running'.
 * Returns the run id.
 */
export async function createCalibrationRun(
  db: DbClient,
  input: {
    runType: "initial" | "monitoring" | "recalibration" | "on_demand";
    method: "ctt_only" | "irt_2pl" | "irt_3pl" | "concurrent";
    notes?: string | null;
    dateRangeStart?: string | null;
    dateRangeEnd?: string | null;
    campaignIds?: string[] | null;
    assessmentId?: string | null;
    includeInternal?: boolean;
    label?: string | null;
  },
): Promise<{ id: string }> {
  const { data, error } = await db
    .from("calibration_runs")
    .insert({
      run_type: input.runType,
      method: input.method,
      status: "running",
      notes: input.notes ?? null,
      date_range_start: input.dateRangeStart ?? null,
      date_range_end: input.dateRangeEnd ?? null,
      campaign_ids: input.campaignIds ?? null,
      assessment_id: input.assessmentId ?? null,
      include_internal: input.includeInternal ?? false,
      label: input.label ?? null,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throwActionError(
      "createCalibrationRun",
      "Unable to create calibration run.",
      error,
    );
  }

  return data as { id: string };
}

/**
 * Mark a calibration run as completed with sample size and optional notes.
 */
export async function completeCalibrationRun(
  db: DbClient,
  runId: string,
  input: { sampleSize: number; sessionCount?: number; notes?: string | null },
): Promise<void> {
  const { error } = await db
    .from("calibration_runs")
    .update({
      status: "completed",
      sample_size: input.sampleSize,
      session_count: input.sessionCount ?? null,
      notes: input.notes ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    throwActionError(
      "completeCalibrationRun",
      "Unable to complete calibration run.",
      error,
    );
  }
}

/**
 * Mark a calibration run as failed with an error message.
 */
export async function failCalibrationRun(
  db: DbClient,
  runId: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await db
    .from("calibration_runs")
    .update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    throwActionError(
      "failCalibrationRun",
      "Unable to fail calibration run.",
      error,
    );
  }
}

// ============================================================================
// calibration_responses fetch
// ============================================================================

/**
 * Fetch all calibration responses from completed sessions, optionally filtered
 * by date range, campaigns, assessment, and internal-data flags.
 *
 * Joins:
 *   participant_responses
 *   -> participant_sessions (status='completed' only)
 *   -> campaigns (for is_internal filtering)
 *   -> items (construct_id NOT NULL, deleted_at IS NULL)
 *   -> response_formats (config, type)
 *   -> item_options (value)
 *
 * Each row carries itemId, constructId, reverseScored, responseValue, and
 * computed minValue/maxValue bounds using deriveItemBounds.
 *
 * Filters:
 *   - includeInternal=false (default): exclude sessions with is_internal=true AND
 *     campaigns with is_internal=true (belt-and-braces, as a session may be created
 *     before its campaign is flagged).
 *   - campaignIds: when non-empty, include only sessions from these campaign IDs.
 *   - assessmentId: when set, include only sessions from this assessment.
 *
 * Throws via throwActionError on query failure.
 */
export async function fetchCalibrationResponses(
  db: DbClient,
  options?: {
    since?: string;
    until?: string;
    campaignIds?: string[];
    assessmentId?: string;
    includeInternal?: boolean;
  },
): Promise<CalibrationResponseRow[]> {
  let query = db
    .from("participant_responses")
    .select(
      // response_formats and item_options hang off ITEMS, not off
      // participant_responses — selecting them at the top level makes PostgREST
      // reject the whole query.
      `id, session_id, item_id, response_value, created_at,
       participant_sessions!inner(status, is_internal, campaign_id, assessment_id,
         campaigns!inner(is_internal)),
       items!inner(id, construct_id, reverse_scored, deleted_at,
         response_formats!inner(config, type),
         item_options(value, score_value, exclude_from_scoring))`,
    )
    .eq("participant_sessions.status", "completed")
    .is("items.deleted_at", null)
    .not("items.construct_id", "is", null)
    // purpose='construct' only. construct_id is NOT a sufficient filter on its
    // own: items_purpose_construct_check (20260813100500) REQUIRES 'practice'
    // and 'seed' items to carry a construct_id too, so without this line a
    // practice section's responses would be calibrated as if they were real
    // measurements. Harmless until a practice section exists — items.purpose is
    // NOT NULL DEFAULT 'construct' (00016_validity_items.sql:11) — and LR-6
    // (#336) introduces the first one. Same filter, same reason, as the one in
    // scoreSessionCTT.
    .eq("items.purpose", "construct");

  // Exclude internal data by default (belt-and-braces: filter both session and campaign).
  if (!options?.includeInternal) {
    query = query.eq("participant_sessions.is_internal", false);
    query = query.eq("participant_sessions.campaigns.is_internal", false);
  }

  // Filter by specific campaigns if provided.
  if (options?.campaignIds && options.campaignIds.length > 0) {
    query = query.in("participant_sessions.campaign_id", options.campaignIds);
  }

  // Filter by specific assessment if provided.
  if (options?.assessmentId) {
    query = query.eq("participant_sessions.assessment_id", options.assessmentId);
  }

  // The window scopes whole SESSIONS, not individual responses. Filtering on
  // participant_responses.created_at would admit part of a session whose
  // responses straddle the boundary, and a partially-present session silently
  // corrupts the complete-case partitioning that alpha is computed from.
  if (options?.since) {
    query = query.gte("participant_sessions.completed_at", options.since);
  }
  if (options?.until) {
    query = query.lte("participant_sessions.completed_at", options.until);
  }

  // PostgREST caps a single response at 1000 rows. The production set is
  // already larger than that, so an unpaged read silently calibrates on a
  // truncated sample — which looks exactly like full coverage. Page until a
  // short page comes back.
  // Paging without a total order is not stable: Postgres may return rows in a
  // different order between the two range requests, which duplicates some rows
  // and drops others. Order by the primary key so the pages tile exactly.
  query = query.order("id", { ascending: true });

  const PAGE_SIZE = 1000;
  const data: unknown[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: page, error } = await query.range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throwActionError(
        "fetchCalibrationResponses",
        "Unable to fetch calibration responses.",
        error,
      );
    }

    const rowsInPage = page ?? [];
    data.push(...rowsInPage);
    if (rowsInPage.length < PAGE_SIZE) break;
  }

  const rows: CalibrationResponseRow[] = [];

  for (const raw of data) {
    const dbRow = raw as DbRow;
    const session = Array.isArray(dbRow.participant_sessions)
      ? dbRow.participant_sessions[0]
      : dbRow.participant_sessions;
    const item = Array.isArray(dbRow.items)
      ? dbRow.items[0]
      : dbRow.items;
    // Both are nested under items.
    const itemRow = (item ?? {}) as DbRow;
    const format = Array.isArray(itemRow.response_formats)
      ? itemRow.response_formats[0]
      : itemRow.response_formats;
    const options = Array.isArray(itemRow.item_options)
      ? itemRow.item_options
      : itemRow.item_options
        ? [itemRow.item_options]
        : [];

    if (!session || !item || !format) continue;
    const itemId = String(item.id);
    const constructId = String(item.construct_id);
    const reverseScored = Boolean(item.reverse_scored);
    const responseValue = Number(dbRow.response_value);
    const sessionId = String(dbRow.session_id);

    // Extract option values
    const optionRows: unknown[] = Array.isArray(options) ? options : [];
    const optionValues: number[] = [];
    if (Array.isArray(options)) {
      for (const opt of options) {
        const optRow = opt as DbRow;
        if (optRow && typeof optRow.value === "number") {
          optionValues.push(optRow.value);
        }
      }
    }

    // Derive bounds
    const config = (format.config as Record<string, unknown>) ?? {};
    const formatType = String(format.type ?? "");
    const bounds = deriveItemBounds(config, optionValues, formatType);

    // response_value is the raw captured value. It is NOT the score for items
    // that are expert-keyed (SJT), that have options excluded from scoring
    // ("don't know"), or that are free text. Treating the raw value as a score
    // on those would silently feed wrong numbers into difficulty and alpha, so
    // they are excluded from CTT calibration rather than mis-scored. Revisit
    // when keyed scoring is wired through here properly.
    const isKeyed = optionRows.some(
      (o) => (o as DbRow).score_value !== null && (o as DbRow).score_value !== undefined,
    );
    const hasExcludedOption = optionRows.some(
      (o) => (o as DbRow).exclude_from_scoring === true,
    );
    if (formatType === "free_text" || isKeyed || hasExcludedOption) {
      continue;
    }

    rows.push({
      sessionId,
      itemId,
      constructId,
      value: responseValue,
      maxValue: bounds.maxValue,
      reverseScored,
    });
  }

  return rows;
}

// ============================================================================
// item_statistics inserts
// ============================================================================

/**
 * Bulk-insert item statistics for a calibration run.
 *
 * Maps CTTItemStatistics directly onto item_statistics columns:
 *   - itemId -> item_id
 *   - difficulty, discrimination, alphaIfDeleted, responseCount, responseDistribution, flagged, flagReasons
 *   - All irt_* columns left null (CTT only, no IRT here)
 *
 * Returns the count of rows inserted. Returns 0 without a database call if
 * stats array is empty.
 * Throws via throwActionError on query failure.
 */
export async function insertItemStatistics(
  db: DbClient,
  runId: string,
  stats: CTTItemStatistics[],
): Promise<number> {
  if (stats.length === 0) {
    return 0;
  }

  const rowsToInsert = stats.map((s) => ({
    item_id: s.itemId,
    calibration_run_id: runId,
    difficulty: s.difficulty,
    discrimination: s.discrimination,
    alpha_if_deleted: s.alphaIfDeleted,
    response_count: s.responseCount,
    response_distribution: s.responseDistribution,
    flagged: s.flagged,
    flag_reasons: s.flagReasons,
    // The irt_* columns on this table are irt_information_at_0 / irt_infit /
    // irt_outfit / irt_param_se_*, not irt_difficulty. A ctt_only run leaves
    // them at their defaults rather than naming columns that do not exist.
  }));

  const { data, error } = await db
    .from("item_statistics")
    .insert(rowsToInsert)
    .select("id");

  if (error) {
    throwActionError(
      "insertItemStatistics",
      "Unable to insert item statistics.",
      error,
    );
  }

  return (data ?? []).length;
}

// ============================================================================
// construct_reliability inserts
// ============================================================================

/**
 * Bulk-insert construct reliability metrics for a calibration run.
 *
 * Each row contains reliability coefficients for a single construct, as well
 * as distributional and item-contribution data.
 *
 * Returns the count of rows inserted. Returns 0 without a database call if
 * rows array is empty.
 * Throws via throwActionError on query failure.
 */
export async function insertConstructReliability(
  db: DbClient,
  runId: string,
  // Nullable to match the columns: sem is undefined when alpha falls outside
  // [0,1], and a construct can legitimately yield no mean/sd. Forcing non-null
  // here would push callers into inventing zeros, which read as real values.
  rows: Array<{
    constructId: string;
    cronbachAlpha: number | null;
    splitHalf: number | null;
    sem: number | null;
    itemCount: number;
    responseCount: number;
    mean: number | null;
    standardDeviation: number | null;
    skewness?: number | null;
    kurtosis?: number | null;
    itemContributions: Record<string, { discrimination: number; alphaIfDeleted: number }>;
  }>,
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const rowsToInsert = rows.map((r) => ({
    construct_id: r.constructId,
    calibration_run_id: runId,
    cronbach_alpha: r.cronbachAlpha,
    omega_total: null,
    omega_hierarchical: null,
    composite_reliability: null,
    split_half: r.splitHalf,
    sem: r.sem,
    csem_by_score: null,
    item_count: r.itemCount,
    response_count: r.responseCount,
    mean: r.mean,
    standard_deviation: r.standardDeviation,
    skewness: r.skewness ?? null,
    kurtosis: r.kurtosis ?? null,
    item_contributions: r.itemContributions,
  }));

  const { data, error } = await db
    .from("construct_reliability")
    .insert(rowsToInsert)
    .select("id");

  if (error) {
    throwActionError(
      "insertConstructReliability",
      "Unable to insert construct reliability.",
      error,
    );
  }

  return (data ?? []).length;
}

// ============================================================================
// calibration_runs queries - continued
// ============================================================================

/**
 * Calibration run summary for listing and management.
 * Includes statistics on the data included in this run.
 */
export interface CalibrationRunSummary {
  id: string;
  label: string | null;
  runType: string;
  method: string;
  status: string;
  sampleSize: number | null;
  sessionCount: number | null;
  includeInternal: boolean;
  campaignIds: string[] | null;
  assessmentId: string | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  itemStatisticsCount: number;
  constructReliabilityCount: number;
}

/**
 * Count the number of distinct completed sessions that would be included in a
 * calibration run with the given options. This is used to preview sample size
 * before running calibration.
 */
export async function countEligibleSessions(
  db: DbClient,
  options?: {
    since?: string;
    until?: string;
    campaignIds?: string[];
    assessmentId?: string;
    includeInternal?: boolean;
  },
): Promise<number> {
  // `campaigns` must be embedded for `campaigns.is_internal` to be a legal
  // filter target — PostgREST rejects a filter on a resource that is not in
  // the select. `!inner` also makes the join filtering rather than nullable,
  // which is what the exclusion needs.
  let query = db
    .from("participant_sessions")
    .select("id, campaigns!inner(is_internal)", {
      count: "exact",
      head: true,
    })
    .eq("status", "completed");

  // Exclude internal data by default.
  if (!options?.includeInternal) {
    query = query.eq("is_internal", false);
    // Also exclude sessions whose campaign is internal.
    query = query.eq("campaigns.is_internal", false);
  }

  // Same window semantics as fetchCalibrationResponses, so the previewed count
  // matches the sample the run actually draws.
  if (options?.since) {
    query = query.gte("completed_at", options.since);
  }
  if (options?.until) {
    query = query.lte("completed_at", options.until);
  }

  // Filter by specific campaigns if provided.
  if (options?.campaignIds && options.campaignIds.length > 0) {
    query = query.in("campaign_id", options.campaignIds);
  }

  // Filter by specific assessment if provided.
  if (options?.assessmentId) {
    query = query.eq("assessment_id", options.assessmentId);
  }

  const { count, error } = await query;

  if (error) {
    throwActionError(
      "countEligibleSessions",
      "Unable to count eligible sessions.",
      error,
    );
  }

  return count ?? 0;
}

/**
 * List calibration runs (non-deleted, newest first) with summary statistics.
 */
export async function listCalibrationRuns(
  db: DbClient,
  limit?: number,
): Promise<CalibrationRunSummary[]> {
  const { data: runs, error: runsError } = await db
    .from("calibration_runs")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit ?? 50);

  if (runsError) {
    throwActionError(
      "listCalibrationRuns",
      "Unable to fetch calibration runs.",
      runsError,
    );
  }

  if (!runs || runs.length === 0) {
    return [];
  }

  // Fetch statistics counts for each run in parallel.
  const runIds = runs.map((r) => (r as DbRow).id) as string[];
  const [itemStats, constructStats] = await Promise.all([
    db
      .from("item_statistics")
      .select("calibration_run_id", { count: "exact", head: false })
      .in("calibration_run_id", runIds),
    db
      .from("construct_reliability")
      .select("calibration_run_id", { count: "exact", head: false })
      .in("calibration_run_id", runIds),
  ]);

  const itemStatsByRunId = new Map<string, number>();
  const constructStatsByRunId = new Map<string, number>();

  if (itemStats.data) {
    // Count rows per run_id.
    const grouped: Record<string, number> = {};
    for (const row of itemStats.data as DbRow[]) {
      const id = String(row.calibration_run_id);
      grouped[id] = (grouped[id] ?? 0) + 1;
    }
    Object.entries(grouped).forEach(([id, count]) => {
      itemStatsByRunId.set(id, count);
    });
  }

  if (constructStats.data) {
    const grouped: Record<string, number> = {};
    for (const row of constructStats.data as DbRow[]) {
      const id = String(row.calibration_run_id);
      grouped[id] = (grouped[id] ?? 0) + 1;
    }
    Object.entries(grouped).forEach(([id, count]) => {
      constructStatsByRunId.set(id, count);
    });
  }

  return runs.map((raw) => {
    const run = raw as DbRow;
    const id = String(run.id);
    return {
      id,
      label: run.label ? String(run.label) : null,
      runType: String(run.run_type),
      method: String(run.method),
      status: String(run.status),
      sampleSize: run.sample_size ? Number(run.sample_size) : null,
      sessionCount: run.session_count ? Number(run.session_count) : null,
      includeInternal: Boolean(run.include_internal),
      campaignIds: Array.isArray(run.campaign_ids) ? run.campaign_ids : null,
      assessmentId: run.assessment_id ? String(run.assessment_id) : null,
      createdAt: String(run.created_at),
      completedAt: run.completed_at ? String(run.completed_at) : null,
      errorMessage: run.error_message ? String(run.error_message) : null,
      itemStatisticsCount: itemStatsByRunId.get(id) ?? 0,
      constructReliabilityCount: constructStatsByRunId.get(id) ?? 0,
    };
  });
}

/**
 * Soft-delete a calibration run by setting deleted_at.
 * Runs are never hard-deleted to preserve audit trail and reproducibility.
 */
export async function softDeleteCalibrationRun(
  db: DbClient,
  runId: string,
): Promise<void> {
  const { error } = await db
    .from("calibration_runs")
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    throwActionError(
      "softDeleteCalibrationRun",
      "Unable to delete calibration run.",
      error,
    );
  }
}

/**
 * Update the human-readable label of a calibration run.
 */
export async function updateCalibrationRunLabel(
  db: DbClient,
  runId: string,
  label: string,
): Promise<void> {
  const { error } = await db
    .from("calibration_runs")
    .update({
      label,
    })
    .eq("id", runId);

  if (error) {
    throwActionError(
      "updateCalibrationRunLabel",
      "Unable to update calibration run label.",
      error,
    );
  }
}

// ============================================================================
// Query helpers
// ============================================================================

/**
 * Get the most recently completed calibration run.
 * Returns { id, createdAt, sampleSize } or null if none exist.
 */
export async function getLatestCompletedRun(
  db: DbClient,
): Promise<{ id: string; createdAt: string; sampleSize: number | null } | null> {
  const { data, error } = await db
    .from("calibration_runs")
    .select("id, created_at, sample_size")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throwActionError(
      "getLatestCompletedRun",
      "Unable to fetch latest calibration run.",
      error,
    );
  }

  if (!data) return null;

  const dbRow = data as DbRow;
  return {
    id: String(dbRow.id),
    createdAt: String(dbRow.created_at),
    sampleSize: dbRow.sample_size ? Number(dbRow.sample_size) : null,
  };
}

// ============================================================================
// Type helpers
// ============================================================================

/** Helper for untyped DB rows. */
type DbRow = Record<string, unknown>;
