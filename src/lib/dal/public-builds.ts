import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brief } from "@/types/ai";
import type { ArchitectMatchResult } from "@/types/architect";
import type { PublicBuildTier } from "@/lib/public-builds/constants";
import { sumPublicBuildTokens } from "@/lib/public-builds/shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

export type PublicBuildStatus =
  | "ranked"
  | "creating"
  | "created"
  | "started"
  | "completed"
  | "report_sent"
  | "failed";

export interface PublicBuildUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
}

export interface PublicBuildDTO {
  id: string;
  email: string;
  roleTitle: string | null;
  pdHash: string | null;
  brief: Brief | null;
  ranking: ArchitectMatchResult | null;
  tier: PublicBuildTier | null;
  picks: string[] | null;
  usage: Record<string, PublicBuildUsage> | null;
  status: PublicBuildStatus;
  assessmentId: string | null;
  campaignId: string | null;
  participantId: string | null;
  error: string | null;
  createdAt: string;
  createdAssessmentAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  reportSentAt: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPublicBuildRow(row: Record<string, any>): PublicBuildDTO {
  return {
    id: row.id,
    email: row.email,
    roleTitle: row.role_title ?? null,
    pdHash: row.pd_hash ?? null,
    brief: row.brief ?? null,
    ranking: row.ranking ?? null,
    tier: row.tier ?? null,
    picks: row.picks ?? null,
    usage: row.usage ?? null,
    status: row.status,
    assessmentId: row.assessment_id ?? null,
    campaignId: row.campaign_id ?? null,
    participantId: row.participant_id ?? null,
    error: row.error ?? null,
    createdAt: row.created_at,
    createdAssessmentAt: row.created_assessment_at ?? null,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    reportSentAt: row.report_sent_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// public_build_codes
// ---------------------------------------------------------------------------

export async function insertPublicBuildCode(
  db: DB,
  input: {
    email: string;
    codeHash: string;
    expiresAt: string;
    ipHash: string | null;
  },
): Promise<{ id: string }> {
  const { data, error } = await db
    .from("public_build_codes")
    .insert({
      email: input.email,
      code_hash: input.codeHash,
      expires_at: input.expiresAt,
      ip_hash: input.ipHash,
    })
    .select("id")
    .single();
  if (error) throw new Error(`insertPublicBuildCode: ${error.message}`);
  return { id: data.id as string };
}

export interface PublicBuildCodeRow {
  id: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  consumedAt: string | null;
}

/** Most recent unconsumed code for this email — the one verifyCode checks against. */
export async function getLatestPublicBuildCode(
  db: DB,
  email: string,
): Promise<PublicBuildCodeRow | null> {
  const { data, error } = await db
    .from("public_build_codes")
    .select("id, code_hash, expires_at, attempts, consumed_at")
    .eq("email", email)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestPublicBuildCode: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    codeHash: data.code_hash,
    expiresAt: data.expires_at,
    attempts: data.attempts,
    consumedAt: data.consumed_at,
  };
}

/**
 * Atomically reserves the next verification attempt, capped at maxAttempts.
 * Returns null once the cap is reached (caller must reject before checking
 * the code — reserving AFTER the check would let concurrent requests race
 * past the cap, each burning the oracle on a stale attempts read).
 *
 * There is no `attempts + 1` SQL expression available through PostgREST, so
 * this is a compare-and-swap retry loop instead of a single UPDATE: read the
 * current committed value, then update conditioned on that exact value still
 * holding. Postgres serializes concurrent writers on the row, so at most one
 * racing request can win a given (current -> current + 1) transition; every
 * loser re-reads the now-advanced value and retries. That bounds the total
 * number of successful reservations to exactly maxAttempts regardless of how
 * many requests race, closing the read-then-write brute-force window a plain
 * increment would leave open.
 */
export async function reserveNextPublicBuildCodeAttempt(
  db: DB,
  id: string,
  maxAttempts: number,
): Promise<number | null> {
  for (;;) {
    const { data } = await db
      .from("public_build_codes")
      .select("attempts")
      .eq("id", id)
      .single();
    const current = data?.attempts ?? 0;
    if (current >= maxAttempts) return null;
    const { data: updated } = await db
      .from("public_build_codes")
      .update({ attempts: current + 1 })
      .eq("id", id)
      .eq("attempts", current)
      .select("attempts")
      .single();
    if (updated) return updated.attempts;
    // Lost the race to a concurrent reservation — retry with a fresh read.
  }
}

export async function consumePublicBuildCode(
  db: DB,
  id: string,
): Promise<void> {
  const { error } = await db
    .from("public_build_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`consumePublicBuildCode: ${error.message}`);
}

export async function countRecentCodeRequestsByEmail(
  db: DB,
  email: string,
  sinceISO: string,
): Promise<number> {
  const { count, error } = await db
    .from("public_build_codes")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", sinceISO);
  if (error)
    throw new Error(`countRecentCodeRequestsByEmail: ${error.message}`);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// public_builds
// ---------------------------------------------------------------------------

export async function insertPublicBuild(
  db: DB,
  input: {
    email: string;
    ipHash: string | null;
    roleTitle: string;
    pdHash: string;
    pdText: string;
    brief: Brief;
    tier: PublicBuildTier;
    ranking?: ArchitectMatchResult;
    usage?: Record<string, PublicBuildUsage>;
  },
): Promise<{ id: string }> {
  const { data, error } = await db
    .from("public_builds")
    .insert({
      email: input.email,
      ip_hash: input.ipHash,
      role_title: input.roleTitle,
      pd_hash: input.pdHash,
      pd_text: input.pdText,
      brief: input.brief,
      tier: input.tier,
      ranking: input.ranking ?? null,
      usage: input.usage ?? null,
      status: "ranked",
    })
    .select("id")
    .single();
  if (error) throw new Error(`insertPublicBuild: ${error.message}`);
  return { id: data.id as string };
}

export async function getPublicBuildById(
  db: DB,
  id: string,
): Promise<PublicBuildDTO | null> {
  const { data, error } = await db
    .from("public_builds")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getPublicBuildById: ${error.message}`);
  return data ? mapPublicBuildRow(data) : null;
}

export async function getPublicBuildByParticipantId(
  db: DB,
  participantId: string,
): Promise<PublicBuildDTO | null> {
  const { data, error } = await db
    .from("public_builds")
    .select("*")
    .eq("participant_id", participantId)
    .maybeSingle();
  if (error) throw new Error(`getPublicBuildByParticipantId: ${error.message}`);
  return data ? mapPublicBuildRow(data) : null;
}

/** pd_hash cache hit: same email, same normalised PD text, already ranked. */
export async function findCachedRankedBuild(
  db: DB,
  email: string,
  pdHash: string,
): Promise<PublicBuildDTO | null> {
  const { data, error } = await db
    .from("public_builds")
    .select("*")
    .eq("email", email)
    .eq("pd_hash", pdHash)
    .not("ranking", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findCachedRankedBuild: ${error.message}`);
  return data ? mapPublicBuildRow(data) : null;
}

export async function updatePublicBuildRanking(
  db: DB,
  id: string,
  input: { ranking: ArchitectMatchResult; usage: Record<string, PublicBuildUsage>; pdHash: string | null },
): Promise<boolean> {
  const { data, error } = await db.from("public_builds")
    .update({ ranking: input.ranking, usage: input.usage, status: "ranked" })
    .eq("id", id).in("status", ["ranked", "failed"]).filter("pd_hash", input.pdHash === null ? "is" : "eq", input.pdHash).select("id");
  if (error) throw new Error(`updatePublicBuildRanking: ${error.message}`);
  return data?.length === 1;
}

/**
 * Atomic ranked → creating transition. False when the build was not in
 * "ranked" (already claimed, created, or failed) — that is how createBuild
 * refuses a double-submit without a read-then-write window.
 */
export async function claimPublicBuildForCreation(
  db: DB,
  id: string,
): Promise<boolean> {
  const { data, error } = await db
    .from("public_builds")
    .update({ status: "creating" })
    .eq("id", id)
    .eq("status", "ranked")
    .select("id");
  if (error) throw new Error(`claimPublicBuildForCreation: ${error.message}`);
  return (data ?? []).length === 1;
}

export async function markPublicBuildCreated(
  db: DB,
  id: string,
  input: {
    picks: string[];
    assessmentId: string;
    campaignId: string;
    participantId: string;
  },
): Promise<void> {
  const { data, error } = await db
    .from("public_builds")
    .update({
      picks: input.picks,
      assessment_id: input.assessmentId,
      campaign_id: input.campaignId,
      participant_id: input.participantId,
      status: "created",
      created_assessment_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "creating")
    .select("id");
  if (error) throw new Error(`markPublicBuildCreated: ${error.message}`);
  if ((data ?? []).length !== 1) {
    throw new Error(
      "markPublicBuildCreated: build was not claimed (status is not 'creating')",
    );
  }
}

export async function markPublicBuildFailed(
  db: DB,
  id: string,
  error: string,
): Promise<void> {
  await db
    .from("public_builds")
    .update({ status: "failed", error })
    .eq("id", id);
}

export async function markPublicBuildStarted(
  db: DB,
  participantId: string,
): Promise<void> {
  await db
    .from("public_builds")
    .update({ status: "started", started_at: new Date().toISOString() })
    .eq("participant_id", participantId)
    .eq("status", "created");
}

export async function markPublicBuildCompleted(
  db: DB,
  participantId: string,
): Promise<void> {
  await db
    .from("public_builds")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("participant_id", participantId)
    .eq("status", "creating");
}

/**
 * Atomically claims the one report email for this participant's build: stamps
 * report_sent_at and returns the build, or null when it was already stamped
 * (another PDF generation got there first) or the build never reached a
 * state that has a report. Send only on a non-null return, and call
 * releasePublicBuildReportSend if the send then fails.
 */
export async function claimPublicBuildReportSend(
  db: DB,
  participantId: string,
): Promise<PublicBuildDTO | null> {
  const { data, error } = await db
    .from("public_builds")
    .update({ status: "report_sent", report_sent_at: new Date().toISOString() })
    .eq("participant_id", participantId)
    .is("report_sent_at", null)
    .in("status", ["created", "started", "completed"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`claimPublicBuildReportSend: ${error.message}`);
  return data ? mapPublicBuildRow(data) : null;
}

/** Undo a claim whose email failed to send, so the next PDF generation retries it. */
export async function releasePublicBuildReportSend(
  db: DB,
  participantId: string,
): Promise<void> {
  const { error } = await db
    .from("public_builds")
    .update({ status: "completed", report_sent_at: null })
    .eq("participant_id", participantId)
    .eq("status", "report_sent");
  if (error) throw new Error(`releasePublicBuildReportSend: ${error.message}`);
}

/** The admin meter for one UTC day: builds and tokens since `sinceISO`, without loading whole rows. */
export async function getPublicBuildsMeterSince(
  db: DB,
  sinceISO: string,
): Promise<{ builds: number; tokens: number }> {
  const { data, error } = await db
    .from("public_builds")
    .select("usage")
    .gte("created_at", sinceISO);
  if (error) throw new Error(`getPublicBuildsMeterSince: ${error.message}`);
  const rows = data ?? [];
  return {
    builds: rows.length,
    tokens: rows.reduce(
      (sum, row) => sum + sumPublicBuildTokens(row.usage ?? null),
      0,
    ),
  };
}

/** Builds counted for the per-UTC-day global cap. */
export async function countPublicBuildsSince(
  db: DB,
  sinceISO: string,
): Promise<number> {
  const { count, error } = await db
    .from("public_builds")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sinceISO);
  if (error) throw new Error(`countPublicBuildsSince: ${error.message}`);
  return count ?? 0;
}

export async function countBuildsForEmailSince(
  db: DB,
  email: string,
  sinceISO: string,
): Promise<number> {
  const { count, error } = await db
    .from("public_builds")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", sinceISO);
  if (error) throw new Error(`countBuildsForEmailSince: ${error.message}`);
  return count ?? 0;
}

/** Only active creation blocks a new trial; unfinished assessments remain usable. */
export async function hasCreatingBuildForEmail(
  db: DB,
  email: string,
  excludeId?: string,
): Promise<boolean> {
  let query = db
    .from("public_builds")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("status", "creating");
  if (excludeId) query = query.neq("id", excludeId);
  const { count, error } = await query;
  if (error) throw new Error(`hasCreatingBuildForEmail: ${error.message}`);
  return (count ?? 0) > 0;
}

export interface ListPublicBuildsOptions {
  limit?: number;
  offset?: number;
}

/** Everything the admin list renders; the PD text, brief and ranking JSON stay on the detail read. */
const LIST_COLUMNS =
  "id, email, role_title, pd_hash, tier, picks, usage, status, assessment_id, campaign_id, participant_id, error, created_at, created_assessment_at, started_at, completed_at, report_sent_at";

export async function listPublicBuilds(
  db: DB,
  options: ListPublicBuildsOptions = {},
): Promise<PublicBuildDTO[]> {
  const { data, error } = await db
    .from("public_builds")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .range(
      options.offset ?? 0,
      (options.offset ?? 0) + (options.limit ?? 50) - 1,
    );
  if (error) throw new Error(`listPublicBuilds: ${error.message}`);
  return (data ?? []).map(mapPublicBuildRow);
}

/** Recover the latest work for the verified email, including a newer repeat-trial draft. */
export async function getResumablePublicBuild(db: DB, email: string) {
  const [liveResult, draftResult] = await Promise.all([
    db.from("public_builds").select("*").eq("email", email)
      .in("status", ["creating", "created", "started"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("public_builds").select("*").eq("email", email).eq("status", "ranked")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (liveResult.error) throw liveResult.error;
  if (draftResult.error) throw draftResult.error;
  const live = liveResult.data;
  const draft = draftResult.data;
  // An uncertain creation must be recovered before offering any new creation.
  const row = live?.status === "creating" ? live
    : draft && (!live || Date.parse(draft.created_at) > Date.parse(live.created_at)) ? draft : live;
  if (!row) return null;
  const build = mapPublicBuildRow(row);
  let token: string | null = null;
  if (build.participantId && build.campaignId && ["created", "started"].includes(build.status)) {
    // Participant lookup is constrained by the owned build, its campaign and the verified email.
    const { data, error } = await db.from("campaign_participants")
      .select("access_token").eq("id", build.participantId)
      .eq("campaign_id", build.campaignId).eq("email", email).maybeSingle();
    if (error) throw error;
    token = data?.access_token ?? null;
  }
  return {
    id: build.id, roleTitle: build.roleTitle || build.brief?.roleTitle || "Your role",
    pdText: typeof row.pd_text === "string" ? row.pd_text : "",
    brief: build.brief, ranking: build.ranking, picks: build.picks,
    status: build.status as "ranked" | "creating" | "created" | "started", token,
  };
}

/** Revisions keep the same quota record, and may never overwrite a claimed build. */
export async function revisePublicBuild(db: DB, id: string, email: string, previousPdHash: string | null, input: {
  roleTitle: string; pdText: string; pdHash: string; tier: PublicBuildTier;
  brief: Brief; ranking: ArchitectMatchResult | null; usage?: Record<string, PublicBuildUsage>;
}): Promise<boolean> {
  const { data, error } = await db.from('public_builds').update({
    role_title: input.roleTitle, pd_text: input.pdText, pd_hash: input.pdHash,
    tier: input.tier, brief: input.brief, ranking: input.ranking, usage: input.usage,
    picks: null, error: null,
  }).eq('id', id).eq('email', email).eq('status', 'ranked').filter('pd_hash', previousPdHash === null ? 'is' : 'eq', previousPdHash).select('id');
  if (error) throw new Error('Unable to save the revised role. Please try again.');
  return data?.length === 1;
}
