import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { throwActionError } from "@/lib/security/action-errors";
import type { CompletionTimelinePoint } from "@/app/actions/campaigns";
import {
  mapCompletionTimelineRows,
  mapRecentResultRows,
  zeroFilledTimeline,
  type PartnerRecentResult,
} from "@/lib/dal/partner-dashboard-mappers";

/**
 * Data Access Layer for the partner dashboard. Each function owns a query and
 * returns a DTO; the calling Server Action owns authorization and injects the
 * Supabase client. See src/lib/dal/README.md.
 *
 * The two portfolio-wide panels read from SQL projections rather than raw
 * tables. A plain PostgREST select is capped at `max_rows` (1000) before any
 * client-side grouping or sorting happens, which made both panels quietly
 * wrong for a large portfolio; grouping and ordering in the database is also
 * what keeps the payload proportional to what is rendered.
 */

type DbClient = SupabaseClient;

/** The partner's live clients. An empty result short-circuits the rest. */
export async function listPartnerClientIds(
  db: DbClient,
  partnerId: string,
): Promise<string[]> {
  const { data, error } = await db
    .from("clients")
    .select("id")
    .eq("partner_id", partnerId)
    .is("deleted_at", null);

  if (error) {
    throwActionError("listPartnerClientIds", "Unable to load partner clients.", error);
  }
  return (data ?? []).map((row) => String(row.id));
}

/** Completions per day across the partner's active campaigns. */
export async function getPartnerCompletionTimeline(
  db: DbClient,
  clientIds: string[],
  days = 14,
): Promise<CompletionTimelinePoint[]> {
  if (clientIds.length === 0) return zeroFilledTimeline(days);

  const { data, error } = await db.rpc("partner_dashboard_completion_timeline", {
    p_client_ids: clientIds,
    p_days: days,
  });

  if (error) {
    throwActionError(
      "getPartnerCompletionTimeline",
      "Unable to load the completion timeline.",
      error,
    );
  }

  return zeroFilledTimeline(days, mapCompletionTimelineRows(data ?? []));
}

/** The most recent participant movement across the portfolio. */
export async function getRecentPartnerResults(
  db: DbClient,
  clientIds: string[],
  limit = 5,
): Promise<PartnerRecentResult[]> {
  if (clientIds.length === 0) return [];

  const { data, error } = await db.rpc("partner_dashboard_recent_results", {
    p_client_ids: clientIds,
    p_limit: limit,
  });

  if (error) {
    throwActionError(
      "getRecentPartnerResults",
      "Unable to load recent results.",
      error,
    );
  }

  return mapRecentResultRows(data ?? []);
}
