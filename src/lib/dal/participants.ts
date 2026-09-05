import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { PARTICIPANT_COLUMNS } from "./participant-columns";
import { mapCampaignParticipantRow } from "@/lib/supabase/mappers";
import { throwActionError } from "@/lib/security/action-errors";
import type { CampaignParticipantStatus } from "@/types/database";
import type {
  ActivityEvent,
  ParticipantDetail,
  ParticipantResponseGroup,
  ParticipantSession,
  ParticipantWithMeta,
  UniqueParticipant,
} from "@/app/actions/participants";
import {
  buildActivityEvents,
  dedupeUniqueParticipants,
  groupResponses,
  mapParticipantWithMetaRows,
  mapSessionRows,
} from "@/lib/dal/participants-mappers";

/**
 * Data Access Layer for participants.
 *
 * Each function owns a query and returns a DTO; the calling Server Action owns
 * authorization (require*Access) and audit (logSupportSessionDataAccess). The
 * Supabase client is injected so the caller decides whether the read runs under
 * RLS (createClient) or with elevated privileges (createAdminClient) — the DAL
 * does not pick the trust boundary. See src/lib/dal/README.md.
 *
 * The pure row → DTO transforms live in ./participants-mappers (I/O-free,
 * unit-tested, coverage-gated).
 */

// The injected client may be RLS-scoped (server) or service-role (admin); both
// are untyped Supabase clients in this codebase, so query rows are mapped from
// `any` exactly as the original inline action code did.
type DbClient = SupabaseClient;

/**
 * Fetch a single participant by id with its campaign + client context, mapped
 * to a ParticipantDetail DTO. Returns null if not found or soft-deleted.
 *
 * Defaults to the admin client because the caller (getParticipant) gates with
 * requireParticipantAccess first and then reads regardless of RLS so that
 * platform-admin / support sessions are not blocked.
 */
export async function getParticipantById(
  id: string,
  db: DbClient = createAdminClient(),
): Promise<ParticipantDetail | null> {
  const { data: row, error } = await db
    .from("campaign_participants")
    .select(
      `
      ${PARTICIPANT_COLUMNS},
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

/** Filters for the participant list queries, with the campaign scope pre-resolved by the caller. */
export type ParticipantListParams = {
  /**
   * Campaign ids the caller is authorized to see: `null` = unrestricted
   * (platform admin); a non-empty array = scoped to those campaigns; an empty
   * array = nothing visible (the list functions fail closed and return []).
   */
  scopedCampaignIds: string[] | null;
  status?: CampaignParticipantStatus;
  search?: string;
  offset: number;
  perPage: number;
};

/** Apply the campaign-scope + status + search filters shared by the two list queries. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyParticipantListFilters(query: any, params: ParticipantListParams) {
  const { scopedCampaignIds, status, search } = params;
  if (status) {
    query = query.eq("status", status);
  }
  if (scopedCampaignIds && scopedCampaignIds.length === 1) {
    query = query.eq("campaign_id", scopedCampaignIds[0]);
  } else if (scopedCampaignIds && scopedCampaignIds.length > 1) {
    query = query.in("campaign_id", scopedCampaignIds);
  }
  if (search) {
    query = query.or(
      `email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`,
    );
  }
  return query;
}

/**
 * List participants (paginated) within the caller's resolved campaign scope,
 * each enriched with session counts + last-activity. The inner join + deleted_at
 * filters exclude participants whose campaign has been soft-deleted.
 */
export async function listParticipants(
  db: DbClient,
  params: ParticipantListParams,
): Promise<{ data: ParticipantWithMeta[]; total: number }> {
  // Fail closed: an empty (non-null) scope means "no campaigns visible".
  if (params.scopedCampaignIds && params.scopedCampaignIds.length === 0) {
    return { data: [], total: 0 };
  }

  let query = db
    .from("campaign_participants")
    .select(
      `
      ${PARTICIPANT_COLUMNS},
      campaigns!inner(title, slug, deleted_at),
      participant_sessions(id, status)
    `,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .is("campaigns.deleted_at", null);

  query = applyParticipantListFilters(query, params)
    .order("created_at", { ascending: false })
    .range(params.offset, params.offset + params.perPage - 1);

  const { data: rows, error, count } = await query;

  if (error) {
    throwActionError("getParticipants", "Unable to load participants.", error);
  }

  return { data: mapParticipantWithMetaRows(rows ?? []), total: count ?? 0 };
}

/**
 * List unique participants by email within the caller's resolved campaign scope.
 * Supabase JS has no GROUP BY, so all scoped rows are fetched (ordered newest
 * first) and deduplicated + paginated in memory; bounded per-scope.
 */
export async function listUniqueParticipants(
  db: DbClient,
  params: ParticipantListParams,
): Promise<{ data: UniqueParticipant[]; total: number }> {
  // Fail closed: an empty (non-null) scope means "no campaigns visible".
  if (params.scopedCampaignIds && params.scopedCampaignIds.length === 0) {
    return { data: [], total: 0 };
  }

  let query = db
    .from("campaign_participants")
    .select(`${PARTICIPANT_COLUMNS}, campaigns!inner(deleted_at)`, { count: "exact" })
    .is("deleted_at", null)
    .is("campaigns.deleted_at", null)
    .order("created_at", { ascending: false });

  query = applyParticipantListFilters(query, params);

  const { data: rows, error } = await query;

  if (error) {
    throwActionError(
      "getUniqueParticipants",
      "Unable to load participants.",
      error,
    );
  }

  return dedupeUniqueParticipants(rows ?? [], {
    offset: params.offset,
    perPage: params.perPage,
  });
}

/** Client portal: list unique participants (by email) for a client with pagination & search. */
export type ClientUniqueParticipantListParams = {
  clientId: string;
  search?: string;
  page: number;
  pageSize: number;
};

export type ClientUniqueParticipantRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  latestStatus: string;
  sessionCount: number;
  lastActivity?: string;
  latestCampaignId: string;
  latestSessionId?: string;
};

/**
 * List unique participants (by email) for a client, paginated.
 *
 * Since Supabase JS has no GROUP BY, we fetch all scoped rows (filtered by search
 * if provided), deduplicate by email in memory, paginate, and return the slice.
 * The dedupe preserves only the most recent participant record per email + the
 * count of total sessions for that email across all campaigns.
 *
 * Returns { rows, totalCount, page, pageSize }.
 */
export async function listUniqueParticipantsForClient(
  db: DbClient,
  params: ClientUniqueParticipantListParams,
): Promise<{
  rows: ClientUniqueParticipantRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}> {
  let query = db
    .from("campaign_participants")
    .select(
      `
      id,
      email,
      first_name,
      last_name,
      status,
      started_at,
      completed_at,
      campaign_id,
      created_at,
      campaigns!inner(client_id, deleted_at),
      participant_sessions(id, status)
    `,
    )
    .eq("campaigns.client_id", params.clientId)
    .is("campaigns.deleted_at", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Apply search filter if provided
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    query = query.or(
      `email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await query as any;

  if (error) {
    throwActionError(
      "listUniqueParticipantsForClient",
      "Unable to load participants.",
      error,
    );
  }

  // Deduplicate by email: collect all rows, group by lowercase email,
  // keep the most recent (first seen) for each email, and aggregate session counts.
  const byEmail = new Map<
    string,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      latest: any;
      participantCount: number;
      totalSessionCount: number;
    }
  >();
  for (const row of rows ?? []) {
    const email = row.email.toLowerCase();
    const sessionCount = (row.participant_sessions ?? []).length;
    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, {
        latest: row,
        participantCount: 1,
        totalSessionCount: sessionCount,
      });
    } else {
      existing.participantCount++;
      existing.totalSessionCount += sessionCount;
    }
  }

  const allUnique = Array.from(byEmail.values());
  const totalCount = allUnique.length;

  // Order by last activity (the table's default sort) BEFORE slicing —
  // otherwise pages are cut on created_at order and per-page client sorting
  // shows the wrong participants on each page.
  const lastActivityOf = (entry: { latest: { started_at?: string | null; completed_at?: string | null; created_at: string } }) => {
    const t = [entry.latest.completed_at, entry.latest.started_at].filter(
      Boolean,
    ) as string[];
    return t.length > 0 ? t.sort()[t.length - 1] : entry.latest.created_at;
  };
  allUnique.sort((a, b) => lastActivityOf(b).localeCompare(lastActivityOf(a)));

  // Paginate after deduplication + ordering
  const offset = params.page * params.pageSize;
  const pageSlice = allUnique.slice(offset, offset + params.pageSize);

  // Map to DTOs
  const rows_result: ClientUniqueParticipantRow[] = pageSlice.map(
    ({ latest, totalSessionCount }) => {
      const timestamps = [
        latest.started_at,
        latest.completed_at,
      ].filter(Boolean) as string[];
      const sessions = latest.participant_sessions ?? [];
      const latestSessionId =
        sessions
          .slice()
          .reverse()
          .find(
            (s: { status: string }) =>
              s.status === "completed" || s.status === "in_progress",
          )?.id ??
        sessions[sessions.length - 1]?.id ??
        undefined;

      return {
        id: latest.id,
        email: latest.email,
        firstName: latest.first_name ?? null,
        lastName: latest.last_name ?? null,
        latestStatus: latest.status,
        sessionCount: totalSessionCount,
        lastActivity:
          timestamps.length > 0
            ? timestamps.sort().reverse()[0]
            : latest.created_at,
        latestCampaignId: latest.campaign_id,
        latestSessionId,
      };
    },
  );

  return {
    rows: rows_result,
    totalCount,
    page: params.page,
    pageSize: params.pageSize,
  };
}

/**
 * Fetch a participant's assessment sessions (with scores), mapped to
 * ParticipantSession DTOs. Throws via throwActionError on a query failure.
 */
export async function getParticipantSessions(
  db: DbClient,
  participantId: string,
): Promise<ParticipantSession[]> {
  const { data: sessionRows, error } = await db
    .from("participant_sessions")
    .select(
      `
      id,
      assessment_id,
      status,
      processing_status,
      processing_error,
      started_at,
      completed_at,
      processed_at,
      assessments(title),
      participant_scores(
        factor_id,
        raw_score,
        scaled_score,
        percentile,
        scoring_method,
        factors(name)
      )
    `,
    )
    .eq("campaign_participant_id", participantId)
    .order("created_at", { ascending: true });

  if (error) {
    throwActionError(
      "getParticipantSessions",
      "Unable to load participant sessions.",
      error,
    );
  }

  return mapSessionRows(sessionRows ?? []);
}

/**
 * Build a participant's activity timeline from their record + sessions. Issues
 * two queries (participant, then sessions); returns [] if the participant row
 * is missing. Throws via throwActionError on a sessions-query failure.
 */
export async function getParticipantActivity(
  db: DbClient,
  participantId: string,
): Promise<ActivityEvent[]> {
  const { data: participant, error: participantError } = await db
    .from("campaign_participants")
    .select("invited_at, started_at, completed_at, campaigns(title)")
    .eq("id", participantId)
    .single();

  if (participantError || !participant) return [];

  const { data: sessions, error: sessionsError } = await db
    .from("participant_sessions")
    .select("id, started_at, completed_at, assessments(title)")
    .eq("campaign_participant_id", participantId)
    .order("started_at", { ascending: true });

  if (sessionsError) {
    throwActionError(
      "getParticipantActivity",
      "Unable to load participant sessions.",
      sessionsError,
    );
  }

  return buildActivityEvents(participant, sessions ?? []);
}

/**
 * Fetch item-level responses for a session, grouped by assessment section.
 * Issues three queries (session, sections+items, responses); returns [] if the
 * session is missing. Throws via throwActionError on a query failure.
 */
export async function getParticipantResponses(
  db: DbClient,
  sessionId: string,
): Promise<ParticipantResponseGroup[]> {
  const { data: session, error: sessionError } = await db
    .from("participant_sessions")
    .select("assessment_id")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) return [];

  const { data: sections, error: sectionsError } = await db
    .from("assessment_sections")
    .select(
      `
      id, title, display_order,
      assessment_section_items(
        item_id,
        display_order,
        items(id, stem)
      )
    `,
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq("assessment_id", (session as any).assessment_id)
    .order("display_order", { ascending: true });

  if (sectionsError) {
    throwActionError(
      "getParticipantResponses",
      "Unable to load assessment sections.",
      sectionsError,
    );
  }

  const { data: responses, error: responsesError } = await db
    .from("participant_responses")
    .select("item_id, response_value, response_time_ms")
    .eq("session_id", sessionId);

  if (responsesError) {
    throwActionError(
      "getParticipantResponses",
      "Unable to load participant responses.",
      responsesError,
    );
  }

  return groupResponses(sections ?? [], responses ?? []);
}
