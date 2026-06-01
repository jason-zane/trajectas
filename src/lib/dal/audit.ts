import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** A single audit-activity row shaped for display (a DTO, not the raw row). */
export interface UserActivityItem {
  id: string;
  eventType: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

/**
 * Recent audit activity targeting a given user profile, newest first.
 *
 * Data-access lives here (server-only) rather than inline in a component so the
 * query, the row→DTO mapping, and the table choice are centralised and the
 * component stays presentational. See src/lib/dal/README.md.
 */
export async function getUserActivity(
  profileId: string,
  limit = 10,
): Promise<UserActivityItem[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("audit_events")
    .select("id, event_type, created_at, metadata")
    .eq("target_id", profileId)
    .eq("target_table", "profiles")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((event) => ({
    id: event.id,
    eventType: event.event_type,
    createdAt: event.created_at,
    metadata: (event.metadata as Record<string, unknown> | null) ?? null,
  }));
}
