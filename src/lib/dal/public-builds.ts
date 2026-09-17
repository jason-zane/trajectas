import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brief } from "@/types/ai";
import type { ArchitectMatchResult } from "@/types/architect";
import type { PublicBuildTier } from "@/lib/public-builds/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

export type PublicBuildStatus =
  | "ranked"
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
  input: { email: string; codeHash: string; expiresAt: string; ipHash: string | null },
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
 * Read-then-write increment. Not atomic, but the attempt counter is bounded
 * at 5 and driven by one visitor typing a code — a lost increment under
 * concurrency only costs one extra guess, never an unbounded loop.
 */
export async function incrementPublicBuildCodeAttempts(db: DB, id: string): Promise<number> {
  const { data } = await db.from("public_build_codes").select("attempts").eq("id", id).single();
  const next = (data?.attempts ?? 0) + 1;
  await db.from("public_build_codes").update({ attempts: next }).eq("id", id);
  return next;
}

export async function consumePublicBuildCode(db: DB, id: string): Promise<void> {
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
  if (error) throw new Error(`countRecentCodeRequestsByEmail: ${error.message}`);
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

export async function getPublicBuildById(db: DB, id: string): Promise<PublicBuildDTO | null> {
  const { data, error } = await db.from("public_builds").select("*").eq("id", id).maybeSingle();
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
  input: { ranking: ArchitectMatchResult; usage: Record<string, PublicBuildUsage> },
): Promise<void> {
  const { error } = await db
    .from("public_builds")
    .update({ ranking: input.ranking, usage: input.usage, status: "ranked" })
    .eq("id", id);
  if (error) throw new Error(`updatePublicBuildRanking: ${error.message}`);
}

export async function markPublicBuildCreated(
  db: DB,
  id: string,
  input: { picks: string[]; assessmentId: string; campaignId: string; participantId: string },
): Promise<void> {
  const { error } = await db
    .from("public_builds")
    .update({
      picks: input.picks,
      assessment_id: input.assessmentId,
      campaign_id: input.campaignId,
      participant_id: input.participantId,
      status: "created",
      created_assessment_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`markPublicBuildCreated: ${error.message}`);
}

export async function markPublicBuildFailed(db: DB, id: string, error: string): Promise<void> {
  await db.from("public_builds").update({ status: "failed", error }).eq("id", id);
}

export async function markPublicBuildStarted(db: DB, participantId: string): Promise<void> {
  await db
    .from("public_builds")
    .update({ status: "started", started_at: new Date().toISOString() })
    .eq("participant_id", participantId)
    .eq("status", "created");
}

export async function markPublicBuildCompleted(db: DB, participantId: string): Promise<void> {
  await db
    .from("public_builds")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("participant_id", participantId)
    .in("status", ["created", "started"]);
}

export async function markPublicBuildReportSent(db: DB, participantId: string): Promise<void> {
  await db
    .from("public_builds")
    .update({ status: "report_sent", report_sent_at: new Date().toISOString() })
    .eq("participant_id", participantId)
    .is("report_sent_at", null);
}

/** Builds counted for the per-UTC-day global cap. */
export async function countPublicBuildsSince(db: DB, sinceISO: string): Promise<number> {
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

/**
 * True when this email has an uncompleted build in flight (one live build
 * per email) — "created" or "started" only. A merely "ranked" build (not
 * yet turned into a real assessment) doesn't count as live: the visitor is
 * still on the result screen deciding, and createBuild itself is what a
 * ranked build is for. Pass `excludeId` when checking from within the flow
 * for the build being acted on.
 */
export async function hasLiveBuildForEmail(
  db: DB,
  email: string,
  excludeId?: string,
): Promise<boolean> {
  let query = db
    .from("public_builds")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .in("status", ["created", "started"]);
  if (excludeId) query = query.neq("id", excludeId);
  const { count, error } = await query;
  if (error) throw new Error(`hasLiveBuildForEmail: ${error.message}`);
  return (count ?? 0) > 0;
}

export interface ListPublicBuildsOptions {
  limit?: number;
  offset?: number;
}

export async function listPublicBuilds(
  db: DB,
  options: ListPublicBuildsOptions = {},
): Promise<PublicBuildDTO[]> {
  const { data, error } = await db
    .from("public_builds")
    .select("*")
    .order("created_at", { ascending: false })
    .range(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 50) - 1);
  if (error) throw new Error(`listPublicBuilds: ${error.message}`);
  return (data ?? []).map(mapPublicBuildRow);
}
