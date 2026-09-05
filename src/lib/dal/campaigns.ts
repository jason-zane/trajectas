import "server-only";
import { PARTICIPANT_COLUMNS } from "./participant-columns";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logActionError, throwActionError } from "@/lib/security/action-errors";
import type {
  CampaignAssessmentOption,
  CampaignConsultantSettings,
  CampaignHeader,
  CampaignSessionRow,
  CampaignWithMeta,
} from "@/app/actions/campaigns";
import {
  mapActiveAssessmentRows,
  mapCampaignHeader,
  mapCampaignSessionRows,
  mapCampaignWithCountsRows,
  mapConsultantSettings,
  type CampaignDetailParts,
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
 * List active assessments as campaign-builder options (with factor/section/
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
    .eq("status", "active")
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

/**
 * Fetch a campaign's consultant-notification settings, mapped to a
 * CampaignConsultantSettings DTO. Returns null if the campaign is missing or the
 * query errors.
 */
export async function getCampaignConsultantSettings(
  db: DbClient,
  campaignId: string,
): Promise<CampaignConsultantSettings | null> {
  const { data, error } = await db
    .from("campaigns")
    .select(
      "consultant_emails, consultant_notification_enabled, consultant_notification_include_summary, consultant_notification_attach_pdf",
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (error || !data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mapConsultantSettings(data as any);
}

/**
 * Fetch a campaign's header (campaign row + embedded client + assessment count),
 * mapped to a CampaignHeader DTO. Returns null if the campaign is missing or
 * soft-deleted. Two indexed parallel queries (primary-key lookup + head-only
 * count) — deliberately not the campaigns_with_counts view, whose correlated
 * subqueries + RLS rewrites dominate the plan for single-row reads.
 */
export async function getCampaignHeader(
  db: DbClient,
  id: string,
): Promise<CampaignHeader | null> {
  const [campaignResult, assessmentCountResult] = await Promise.all([
    db
      .from("campaigns")
      .select("*, clients(name, can_customize_branding)")
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    db
      .from("campaign_assessments")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id)
      .is("deleted_at", null),
  ]);

  if (campaignResult.error || !campaignResult.data) return null;

  if (assessmentCountResult.error) {
    logActionError("getCampaignHeader", assessmentCountResult.error);
  }

  return mapCampaignHeader(
    campaignResult.data,
    assessmentCountResult.count ?? 0,
  );
}

/**
 * Fetch the three detail-row sets for a campaign in parallel: ordered
 * assessments (with embedded assessment metadata), non-deleted non-rater
 * participants (with session id/status), and access links. Returns null if any
 * query errors (each logged); the caller pairs this with getCampaignHeader and
 * assembles via assembleCampaignDetail.
 */
export async function getCampaignDetailParts(
  db: DbClient,
  id: string,
  includeParticipantTokens = false,
): Promise<CampaignDetailParts | null> {
  const [assessmentResult, participantResult, linkResult] = await Promise.all([
    db
      .from("campaign_assessments")
      .select("*, assessments(title, status, min_custom_factors)")
      .eq("campaign_id", id)
      .is("deleted_at", null)
      .order("display_order", { ascending: true }),
    db
      .from("campaign_participants")
      // Exclude 360 rater taking-rows — they are managed in the Raters tab,
      // not shown as normal participants.
      .select(`${PARTICIPANT_COLUMNS}${includeParticipantTokens ? ',access_token' : ''}, participant_sessions(id, status)`)
      .eq("campaign_id", id)
      .is("campaign_rater_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    db
      .from("campaign_access_links")
      .select("*")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (assessmentResult.error)
    logActionError("getCampaignDetailParts", assessmentResult.error);
  if (participantResult.error)
    logActionError("getCampaignDetailParts", participantResult.error);
  if (linkResult.error)
    logActionError("getCampaignDetailParts", linkResult.error);
  if (assessmentResult.error || participantResult.error || linkResult.error) {
    return null;
  }

  return {
    assessmentRows: assessmentResult.data,
    participantRows: participantResult.data,
    linkRows: linkResult.data,
  };
}

/**
 * The subset of the given campaign ids whose confidentiality_mode is
 * 'aggregate_only'. Used by score-timeline surfaces (canvas, comparison) to
 * exclude individual results from those campaigns for client/partner
 * viewers. Empty input short-circuits without a query.
 */
export async function getAggregateOnlyCampaignIdSet(
  db: DbClient,
  campaignIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(campaignIds.filter(Boolean))];
  if (ids.length === 0) return new Set();

  const { data, error } = await db
    .from("campaigns")
    .select("id")
    .in("id", ids)
    .eq("confidentiality_mode", "aggregate_only");

  if (error) {
    throwActionError(
      "getAggregateOnlyCampaignIdSet",
      "Unable to load campaign confidentiality.",
      error,
    );
  }

  return new Set((data ?? []).map((row: { id: string }) => String(row.id)));
}
