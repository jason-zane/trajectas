import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { throwActionError } from "@/lib/security/action-errors";
import type { CampaignWithMeta } from "@/app/actions/campaigns";
import { mapCampaignWithCountsRows } from "@/lib/dal/campaigns-mappers";

/**
 * Data Access Layer for campaigns.
 *
 * Each function owns a query and returns a DTO; the calling Server Action owns
 * authorization (resolveAuthorizedScope / require*Access) and passes the
 * resolved scope down. The Supabase client is injected so the caller decides
 * the trust boundary (RLS vs admin). See src/lib/dal/README.md.
 */

// Untyped client (RLS-scoped server or service-role admin); rows mapped from
// `any` exactly as the original inline action code did.
type DbClient = SupabaseClient;

export type CampaignListScope = {
  /**
   * If set, restrict to this single client's campaigns (client portal / explicit
   * filter). Takes priority over scopedCampaignIds.
   */
  effectiveClientId: string | null;
  /**
   * Campaign ids the caller may see when there is no client filter: `null` =
   * unrestricted (platform admin); a non-empty array = scoped to those ids; an
   * empty array = nothing visible (fails closed).
   */
  scopedCampaignIds: string[] | null;
};

/**
 * List non-deleted campaigns (newest first) with inlined assessment/participant/
 * completed counts, scoped per the caller's resolved authorization. Reads the
 * `campaigns_with_counts` view (security_invoker, so RLS still applies under the
 * server client).
 */
export async function listCampaigns(
  db: DbClient,
  scope: CampaignListScope,
): Promise<CampaignWithMeta[]> {
  // Fail closed: an empty (non-null) campaign scope means nothing is visible.
  if (
    !scope.effectiveClientId &&
    scope.scopedCampaignIds &&
    scope.scopedCampaignIds.length === 0
  ) {
    return [];
  }

  let query = db
    .from("campaigns_with_counts")
    .select("*, clients(name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (scope.effectiveClientId) {
    query = query.eq("client_id", scope.effectiveClientId);
  } else if (scope.scopedCampaignIds) {
    query = query.in("id", scope.scopedCampaignIds);
  }

  const { data, error } = await query;

  if (error) {
    throwActionError("getCampaigns", "Unable to load campaigns.", error);
  }

  return mapCampaignWithCountsRows(data ?? []);
}
