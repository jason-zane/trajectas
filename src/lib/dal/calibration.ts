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
  input: { sampleSize: number; notes?: string | null },
): Promise<void> {
  const { error } = await db
    .from("calibration_runs")
    .update({
      status: "completed",
      sample_size: input.sampleSize,
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
 * by date range.
 *
 * Joins:
 *   participant_responses
 *   -> participant_sessions (status='completed' only)
 *   -> items (construct_id NOT NULL, deleted_at IS NULL)
 *   -> response_formats (config, type)
 *   -> item_options (value)
 *
 * Each row carries itemId, constructId, reverseScored, responseValue, and
 * computed minValue/maxValue bounds using deriveItemBounds.
 *
 * Throws via throwActionError on query failure.
 */
export async function fetchCalibrationResponses(
  db: DbClient,
  options?: { since?: string; until?: string },
): Promise<CalibrationResponseRow[]> {
  let query = db
    .from("participant_responses")
    .select(
      // response_formats and item_options hang off ITEMS, not off
      // participant_responses — selecting them at the top level makes PostgREST
      // reject the whole query.
      `id, session_id, item_id, response_value, created_at,
       participant_sessions!inner(status),
       items!inner(id, construct_id, reverse_scored, deleted_at,
         response_formats!inner(config, type),
         item_options(value, score_value, exclude_from_scoring))`,
    )
    .eq("participant_sessions.status", "completed")
    .is("items.deleted_at", null)
    .not("items.construct_id", "is", null);

  // Base-table columns are filtered unqualified.
  if (options?.since) {
    query = query.gte("created_at", options.since);
  }
  if (options?.until) {
    query = query.lte("created_at", options.until);
  }

  // PostgREST caps a single response at 1000 rows. The production set is
  // already larger than that, so an unpaged read silently calibrates on a
  // truncated sample — which looks exactly like full coverage. Page until a
  // short page comes back.
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
