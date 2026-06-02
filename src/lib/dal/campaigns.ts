import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logActionError, throwActionError } from "@/lib/security/action-errors";
import type {
  CampaignAssessmentOption,
  CampaignSessionRow,
  CampaignWithMeta,
} from "@/app/actions/campaigns";
import {
  mapActiveAssessmentRows,
  mapCampaignSessionRows,
  mapCampaignWithCountsRows,
} from "@/lib/dal/campaigns-mappers";

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

/**
 * Flat list of a campaign's participant_sessions (joined to their participant +
 * assessment), newest first, with per-(participant, assessment) attempt numbers.
 * On a query error this logs and returns [] (matching the original action).
 */
export async function getCampaignSessions(
  db: DbClient,
  campaignId: string,
): Promise<CampaignSessionRow[]> {
  const { data, error } = await db
    .from("participant_sessions")
    .select(
      "id, status, started_at, completed_at, assessment_id, campaign_participant_id, " +
        "assessments(id, title), " +
        "campaign_participants!inner(id, email, first_name, last_name, campaign_id)",
    )
    .eq("campaign_participants.campaign_id", campaignId)
    // nullsFirst=false matches attempt-numbering elsewhere (actions/sessions.ts):
    // unstarted sessions get the highest attempt numbers, not 1, so labels stay stable.
    .order("started_at", { ascending: true, nullsFirst: false });

  if (error) {
    logActionError("getCampaignSessions", error);
    return [];
  }

  return mapCampaignSessionRows(data ?? []);
}

/**
 * List active/draft assessments as campaign-builder options (with factor/section/
 * item counts + a format label + estimated duration). Serves admin + partner
 * portals; clients use the client assessment library instead.
 *
 * `partnerIds`: `null` = unrestricted (platform admin / local-dev bypass); a
 * non-empty array = partner-owned + platform-owned (partner_id null) assessments.
 * The caller handles the non-partner empty case before calling.
 */
export async function listActiveAssessments(
  db: DbClient,
  { partnerIds }: { partnerIds: string[] | null },
): Promise<CampaignAssessmentOption[]> {
  let query = db
    .from("assessments")
    .select(
      `
      id,
      title,
      description,
      status,
      format_mode,
      min_custom_factors,
      assessment_factors(count),
      assessment_sections(
        id,
        response_formats(type),
        assessment_section_items(count)
      )
    `,
    )
    .in("status", ["active", "draft"])
    .is("deleted_at", null)
    .order("title", { ascending: true });

  if (partnerIds) {
    query = query.or(
      `partner_id.in.(${partnerIds.join(",")}),partner_id.is.null`,
    );
  }

  const { data, error } = await query;

  if (error) {
    throwActionError(
      "getActiveAssessments",
      "Unable to load active assessments.",
      error,
    );
  }

  return mapActiveAssessmentRows(data ?? []);
}
