import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { throwActionError } from "@/lib/security/action-errors";
import type { CompletionTimelinePoint } from "@/app/actions/campaigns";
import {
  bucketCompletionsByDay,
  mapRecentResultRows,
  zeroFilledTimeline,
  type PartnerRecentResult,
} from "@/lib/dal/partner-dashboard-mappers";

/**
 * Data Access Layer for the partner dashboard. Each function owns a query and
 * returns a DTO; the calling Server Action owns authorization and injects the
 * Supabase client. See src/lib/dal/README.md.
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

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("participant_sessions")
    .select("completed_at, campaigns!inner(client_id, status, deleted_at)")
    .in("campaigns.client_id", clientIds)
    .eq("campaigns.status", "active")
    .is("campaigns.deleted_at", null)
    .eq("status", "completed")
    .gte("completed_at", since)
    .not("completed_at", "is", null);

  if (error) {
    throwActionError(
      "getPartnerCompletionTimeline",
      "Unable to load the completion timeline.",
      error,
    );
  }

  return zeroFilledTimeline(
    days,
    bucketCompletionsByDay((data ?? []) as Array<{ completed_at?: string | null }>),
  );
}

/** The most recent participant movement across the portfolio. */
export async function getRecentPartnerResults(
  db: DbClient,
  clientIds: string[],
  limit = 5,
): Promise<PartnerRecentResult[]> {
  if (clientIds.length === 0) return [];

  const { data, error } = await db
    .from("campaign_participants")
    .select(
      "id, email, first_name, last_name, status, started_at, completed_at, campaign_id, created_at, campaigns!inner(title, client_id, deleted_at, clients(name)), participant_sessions(id, status, started_at, completed_at)",
    )
    .in("campaigns.client_id", clientIds)
    .is("campaigns.deleted_at", null)
    .in("status", ["in_progress", "completed"])
    .is("deleted_at", null);

  if (error) {
    throwActionError(
      "getRecentPartnerResults",
      "Unable to load recent results.",
      error,
    );
  }

  return mapRecentResultRows(data ?? []).slice(0, limit);
}
