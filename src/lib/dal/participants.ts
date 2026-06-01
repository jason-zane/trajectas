import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { mapCampaignParticipantRow } from "@/lib/supabase/mappers";
import type { ParticipantDetail } from "@/app/actions/participants";

/**
 * Fetch a single participant by id with its campaign + client context, mapped
 * to a ParticipantDetail DTO. Returns null if not found or soft-deleted.
 *
 * Authorization is the caller's responsibility — the participants action gates
 * via requireParticipantAccess() before calling this. The admin client is used
 * deliberately so platform-admin / support sessions are not blocked by RLS.
 * See src/lib/dal/README.md.
 */
export async function getParticipantById(
  id: string,
): Promise<ParticipantDetail | null> {
  const db = createAdminClient();
  const { data: row, error } = await db
    .from("campaign_participants")
    .select(
      `
      *,
      campaigns(title, slug, client_id, clients(name))
    `,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !row) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = row as any;
  return {
    ...mapCampaignParticipantRow(r),
    campaignTitle: r.campaigns?.title ?? "Unknown",
    campaignSlug: r.campaigns?.slug ?? "",
    clientName: r.campaigns?.clients?.name ?? undefined,
  };
}
