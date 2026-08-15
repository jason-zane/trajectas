/**
 * Data Access Layer for session quality flags (careless responding detection).
 *
 * Pure insert/query functions for careless responding indices.
 * All functions take a db client and perform RLS-protected operations.
 *
 * @module
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LongStringResult,
  EvenOddConsistencyResult,
  PsychometricAntonymsResult,
  ResponseTimeFloorResult,
} from "@/lib/scoring/careless";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Careless responding indices computed for a single session.
 */
export interface SessionQualityFlagsInput {
  sessionId: string;
  longString: LongStringResult | null;
  evenOdd: EvenOddConsistencyResult | null;
  antonyms: PsychometricAntonymsResult | null;
  responseTime: ResponseTimeFloorResult | null;
  /** Thresholds for determining detected flags. */
  thresholds?: {
    longStringMinRun?: number;
    evenOddMaxSpearmanBrown?: number;
    antonymsMinConsistency?: number;
  };
}

// ---------------------------------------------------------------------------
// Insert
// ---------------------------------------------------------------------------

/**
 * Insert careless responding indices for a session.
 *
 * Computes boolean flags from indices and synthesizes overall_careless_verdict.
 * If a row already exists for this session_id, soft-deletes the old one and inserts new.
 *
 * @param db - Supabase admin client
 * @param input - Computed indices and session ID
 * @returns Inserted row ID
 */
export async function insertSessionQualityFlags(
  db: SupabaseClient,
  input: SessionQualityFlagsInput
): Promise<{ id: string; overallCarelessVerdict: boolean }> {
  const {
    sessionId,
    longString,
    evenOdd,
    antonyms,
    responseTime,
    thresholds = {},
  } = input;

  // Apply default thresholds
  const longStringMinRun = thresholds.longStringMinRun ?? 6;
  const evenOddMaxSpearmanBrown = thresholds.evenOddMaxSpearmanBrown ?? 0.5;
  // Careless responding shows up as LOW consistency between a forward and a
  // reverse-keyed item once the reverse item is scored in the same direction.
  // Flagging HIGH consistency would flag exactly the careful respondents.
  const antonymsMinConsistency = thresholds.antonymsMinConsistency ?? 0.35;

  // Compute boolean flags
  const longStringDetected =
    longString !== null ? longString.maxRunLength >= longStringMinRun : null;
  const evenOddDetected =
    evenOdd !== null
      ? evenOdd.spearmanBrown < evenOddMaxSpearmanBrown
      : null;
  const antonymsDetected =
    antonyms !== null
      ? antonyms.meanConsistencyRate < antonymsMinConsistency
      : null;
  const timeFloorDetected = responseTime?.floorDetected ?? null;

  // Overall verdict: true if any index is detected
  const overallCarelessVerdict = [
    longStringDetected,
    evenOddDetected,
    antonymsDetected,
    timeFloorDetected,
  ].some((v) => v === true);

  // Prepare insert row
  const row = {
    session_id: sessionId,
    long_string_max_run_length: longString?.maxRunLength ?? null,
    long_string_start_index: longString?.itemIndices[0] ?? null,
    long_string_value: longString?.value ?? null,
    long_string_detected: longStringDetected,
    even_odd_correlation: evenOdd?.correlation ?? null,
    even_odd_spearman_brown: evenOdd?.spearmanBrown ?? null,
    even_odd_detected: evenOddDetected,
    psychometric_antonyms_mean_agreement:
      antonyms?.meanConsistencyRate ?? null,
    psychometric_antonyms_pair_count: antonyms?.pairsFound ?? null,
    psychometric_antonyms_detected: antonymsDetected,
    response_time_floor_detected: timeFloorDetected,
    response_time_median_ms: responseTime?.medianMs ?? null,
    response_time_min_ms: responseTime?.minMs ?? null,
    response_time_max_ms: responseTime?.maxMs ?? null,
    response_time_fast_proportion: responseTime?.fastResponseProportion ?? null,
    response_time_has_data: responseTime?.hasTimingData ?? false,
    overall_careless_verdict: overallCarelessVerdict,
    computed_at: new Date().toISOString(),
  };

  // Soft-delete any existing row for this session
  await db
    .from("session_quality_flags")
    .update({ deleted_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .is("deleted_at", null);

  // Insert new row
  const { data, error } = await db
    .from("session_quality_flags")
    .insert([row])
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Failed to insert session_quality_flags: ${error.message}`
    );
  }

  return { id: data.id, overallCarelessVerdict };
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Get careless responding flags for a session.
 *
 * @param db - Supabase client
 * @param sessionId - Session ID
 * @returns Flags row, or null if not found
 */
export async function getSessionQualityFlags(
  db: SupabaseClient,
  sessionId: string
) {
  const { data, error } = await db
    .from("session_quality_flags")
    .select("*")
    .eq("session_id", sessionId)
    .is("deleted_at", null)
    .single();

  if (error && error.code === "PGRST116") {
    return null; // Not found
  }

  if (error) {
    throw new Error(`Failed to fetch session_quality_flags: ${error.message}`);
  }

  return data;
}

/**
 * List all flagged sessions (where overall_careless_verdict = true).
 *
 * @param db - Supabase client
 * @param limit - Maximum rows to return (default: 100)
 * @returns Array of flagged sessions
 */
export async function listFlaggedSessions(
  db: SupabaseClient,
  limit = 100
) {
  const { data, error } = await db
    .from("session_quality_flags")
    .select("*")
    .eq("overall_careless_verdict", true)
    .is("deleted_at", null)
    .order("computed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to list flagged sessions: ${error.message}`
    );
  }

  return data ?? [];
}

/**
 * Count sessions flagged for each index type.
 *
 * @param db - Supabase client
 * @returns Object with counts per index
 */
export async function countFlaggedByIndex(db: SupabaseClient) {
  const [longString, evenOdd, antonyms, timeFloor, overall] = await Promise.all(
    [
      db
        .from("session_quality_flags")
        .select("id", { count: "exact" })
        .eq("long_string_detected", true)
        .is("deleted_at", null),
      db
        .from("session_quality_flags")
        .select("id", { count: "exact" })
        .eq("even_odd_detected", true)
        .is("deleted_at", null),
      db
        .from("session_quality_flags")
        .select("id", { count: "exact" })
        .eq("psychometric_antonyms_detected", true)
        .is("deleted_at", null),
      db
        .from("session_quality_flags")
        .select("id", { count: "exact" })
        .eq("response_time_floor_detected", true)
        .is("deleted_at", null),
      db
        .from("session_quality_flags")
        .select("id", { count: "exact" })
        .eq("overall_careless_verdict", true)
        .is("deleted_at", null),
    ]
  );

  return {
    longStringCount: longString.count ?? 0,
    evenOddCount: evenOdd.count ?? 0,
    antonymsCount: antonyms.count ?? 0,
    timeFloorCount: timeFloor.count ?? 0,
    overallCount: overall.count ?? 0,
  };
}
