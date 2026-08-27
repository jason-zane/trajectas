// =============================================================================
// src/lib/dal/chat-scores.ts
//
// Score and progress reads for grounded chat. As with chat-search.ts the
// Supabase client is INJECTED: callers pass the requester's RLS-scoped
// connection, so tenancy — and campaign confidentiality — come from the
// policies rather than from predicates here.
//
// That second point is worth stating plainly, because it is doing real work.
// The participant_scores SELECT policy already excludes aggregate-only
// campaigns:
//
//     ps.client_id = ANY (auth_user_client_ids())
//       AND (ps.campaign_id IS NULL OR NOT campaign_is_aggregate_only(ps.campaign_id))
//
// so a confidential campaign's individual scores are invisible to this query
// without chat knowing anything about confidentiality modes.
//
// Every score row leaves here already resolved through a claims ladder. The
// raw percentile / confidence-interval / norm columns are read in exactly one
// place — the resolvers — and callers receive the narrowed union, so no chat
// surface can forward a rank claim the data does not support.
// =============================================================================

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolveCompetencyScoreDisplay,
  CompetencyClaimsViolation,
  isCompetencyMetric,
} from '@/lib/reports/competency-claims'
import { logActionError } from '@/lib/security/action-errors'
import {
  toSessionIdentity,
  toFactorScore,
  type SessionIdentityRow,
  type RawScoreRow,
  type SessionIdentity,
  type FactorScore,
} from './chat-scores-mappers'

export class ChatScoresError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChatScoresError'
  }
}

export interface SessionScores {
  session: SessionIdentity
  factors: FactorScore[]
  /** Rows dropped because they failed the claims ladder's fail-closed checks. */
  droppedRows: number
  /** Rows on a cognitive metric, which this card does not render. */
  cognitiveRows: number
}

/**
 * Every scored factor for one session, resolved for display.
 *
 * Returns null when the session itself is not visible to the caller — RLS
 * decides that, not this function.
 */
export async function getSessionScores(
  db: SupabaseClient,
  sessionId: string,
): Promise<SessionScores | null> {
  const { data: sessionRow, error: sessionError } = await db
    .from('participant_sessions')
    .select(
      'id, status, completed_at, campaign_id, assessments(id, title), campaign_participants(id, first_name, last_name, email)',
    )
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionError) throw new ChatScoresError(sessionError.message)
  if (!sessionRow) return null

  const { data: scoreRows, error: scoreError } = await db
    .from('participant_scores')
    .select(
      'factor_id, metric, scaled_score, raw_score, percentile, confidence_interval_lower, confidence_interval_upper, norm_group_id, norm_version, provisional, scoring_variant, factors(id, name)',
    )
    .eq('session_id', sessionId)

  if (scoreError) throw new ChatScoresError(scoreError.message)

  const rows = (scoreRows ?? []) as unknown as RawScoreRow[]
  const factors: FactorScore[] = []
  let droppedRows = 0
  let cognitiveRows = 0

  for (const row of rows) {
    if (!isCompetencyMetric(row.metric)) {
      // Cognitive scores have their own ladder and their own presentation;
      // rendering percent-correct against competency bands is the exact
      // misreading the ladders exist to prevent.
      cognitiveRows += 1
      continue
    }
    try {
      const display = resolveCompetencyScoreDisplay(row)
      factors.push(toFactorScore(row, display))
    } catch (error) {
      // Fail closed per row: a corrupted score must not take the answer down,
      // but it must never be rendered either.
      if (error instanceof CompetencyClaimsViolation) {
        droppedRows += 1
        logActionError('chat.scores.claims_violation', error)
        continue
      }
      throw error
    }
  }

  factors.sort((a, b) => a.name.localeCompare(b.name))

  return {
    session: toSessionIdentity(sessionRow as unknown as SessionIdentityRow),
    factors,
    droppedRows,
    cognitiveRows,
  }
}

export interface CampaignProgress {
  campaignId: string
  title: string | null
  status: string | null
  invited: number
  started: number
  completed: number
  assessmentCount: number
}

/**
 * Where a campaign's PEOPLE have got to.
 *
 * Counted from campaign_participants, not from participant_sessions. A
 * campaign can carry several assessments and a participant gets a session per
 * assessment, so session totals are not headcounts — ten people taking three
 * assessments would otherwise report thirty started, which is both wrong and
 * larger than the invited population.
 *
 * `campaigns_with_counts` is the platform's own definition of these figures
 * (it excludes soft-deleted rows and 360 raters via campaign_rater_id IS NULL)
 * and is security_invoker, so it respects the caller's RLS exactly as a direct
 * table read would. Reusing it means a chat card and the campaign overview
 * cannot disagree about how many people are in a campaign.
 *
 * Returns null when the campaign is not visible to the caller.
 */
export async function getCampaignProgress(
  db: SupabaseClient,
  campaignId: string,
): Promise<CampaignProgress | null> {
  const { data: row, error } = await db
    .from('campaigns_with_counts')
    .select('id, title, status, participant_count, completed_count, assessment_count')
    .eq('id', campaignId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new ChatScoresError(error.message)
  if (!row) return null

  const view = row as unknown as {
    id: string
    title: string | null
    status: string | null
    participant_count: number | null
    completed_count: number | null
    assessment_count: number | null
  }

  // "Started" is not in the view; count the same population it does — real
  // participants, raters excluded — that have moved beyond being invited.
  const { data: startedRows, error: startedError } = await db
    .from('campaign_participants')
    .select('id, status')
    .eq('campaign_id', campaignId)
    .is('deleted_at', null)
    .is('campaign_rater_id', null)
    .in('status', ['in_progress', 'completed'])

  if (startedError) throw new ChatScoresError(startedError.message)

  return {
    campaignId: view.id,
    title: view.title,
    status: view.status,
    invited: view.participant_count ?? 0,
    started: (startedRows ?? []).length,
    completed: view.completed_count ?? 0,
    assessmentCount: view.assessment_count ?? 0,
  }
}

export interface LatestSessionResolution {
  sessionId: string | null
  /** A more recent sitting existed but had nothing this view can render. */
  skippedMoreRecent: boolean
}

/**
 * The most recent sitting WITH RENDERABLE COMPETENCY SCORES across every one of
 * a person's participations.
 *
 * Two things make this less obvious than "order by completed_at desc":
 *
 *  1. A person is not a participant row. campaign_participants holds one row
 *     per campaign, so "their latest result" has to look across all of them —
 *     asking one row gives you the latest result *in that campaign*, which is
 *     rarely what was meant.
 *  2. The latest sitting is not always the latest *result*. A cognitive sitting
 *     carries percent_correct rows and no POMP rows, so this view has nothing
 *     to draw. Silently returning it would answer "your latest result" with an
 *     empty card, so we skip to the newest sitting that can actually be shown
 *     and report that we did.
 *
 * The inner join on participant_scores filtered to metric='pomp' does the
 * "has renderable scores" test in the database rather than by fetching each
 * session's scores in turn.
 */
export async function getLatestScoredSession(
  db: SupabaseClient,
  participantIds: string[],
): Promise<LatestSessionResolution> {
  if (participantIds.length === 0) {
    return { sessionId: null, skippedMoreRecent: false }
  }

  const { data: newest, error: newestError } = await db
    .from('participant_sessions')
    .select('id, completed_at')
    .in('campaign_participant_id', participantIds)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (newestError) throw new ChatScoresError(newestError.message)

  const { data: scored, error: scoredError } = await db
    .from('participant_sessions')
    .select('id, completed_at, participant_scores!inner(metric)')
    .in('campaign_participant_id', participantIds)
    .eq('status', 'completed')
    .eq('participant_scores.metric', 'pomp')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (scoredError) throw new ChatScoresError(scoredError.message)

  const scoredRow = scored as { id: string } | null
  const newestRow = newest as { id: string } | null

  return {
    sessionId: scoredRow?.id ?? null,
    skippedMoreRecent: Boolean(
      scoredRow && newestRow && scoredRow.id !== newestRow.id,
    ),
  }
}
