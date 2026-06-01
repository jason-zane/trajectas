import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { mapCampaignParticipantRow } from "@/lib/supabase/mappers";
import { throwActionError } from "@/lib/security/action-errors";
import type {
  ActivityEvent,
  ParticipantDetail,
  ParticipantResponseGroup,
  ParticipantSession,
} from "@/app/actions/participants";
import {
  buildActivityEvents,
  groupResponses,
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
