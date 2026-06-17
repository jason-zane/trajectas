import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { throwActionError } from "@/lib/security/action-errors";
import { aggregateClientUsage } from "@/lib/dal/usage-mappers";
import type { ClientUsageRow } from "@/types/database";

/**
 * Per-client usage roll-up for the Business → Usage view. Reads the
 * `campaigns_with_counts` view (raters + soft-deleted already excluded) and
 * aggregates with the pure `aggregateClientUsage` helper. Platform-admin only —
 * called from a page already behind `requireAdminScope`.
 */
export async function getClientUsageSummary(): Promise<ClientUsageRow[]> {
  const db = createAdminClient();

  const [clientsRes, campaignsRes] = await Promise.all([
    db.from("clients").select("id, name, is_active").is("deleted_at", null),
    db
      .from("campaigns_with_counts")
      .select(
        "client_id, status, participant_count, completed_count, updated_at, created_at",
      )
      .is("deleted_at", null),
  ]);

  if (clientsRes.error) {
    throwActionError(
      "getClientUsageSummary",
      "Unable to load clients.",
      clientsRes.error,
    );
  }
  if (campaignsRes.error) {
    throwActionError(
      "getClientUsageSummary",
      "Unable to load usage.",
      campaignsRes.error,
    );
  }

  const clients = (clientsRes.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    isActive: Boolean(row.is_active),
  }));

  const campaigns = (campaignsRes.data ?? []).map((row) => ({
    clientId: (row.client_id as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    participantCount: Number(row.participant_count ?? 0),
    completedCount: Number(row.completed_count ?? 0),
    activityAt:
      (row.updated_at as string | null) ??
      (row.created_at as string | null) ??
      null,
  }));

  return aggregateClientUsage(clients, campaigns);
}
