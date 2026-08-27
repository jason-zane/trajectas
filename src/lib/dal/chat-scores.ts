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
  invited: number
  started: number
  completed: number
  scoredSessions: number
}

/** Counts of where a campaign's participants have got to. */
export async function getCampaignProgress(
  db: SupabaseClient,
  campaignId: string,
): Promise<CampaignProgress> {
  const { data: participantRows, error: pErr } = await db
    .from('campaign_participants')
    .select('id, status')
    .eq('campaign_id', campaignId)
    .is('deleted_at', null)

  if (pErr) throw new ChatScoresError(pErr.message)

  const { data: sessionRows, error: sErr } = await db
    .from('participant_sessions')
    .select('id, status')
    .eq('campaign_id', campaignId)

  if (sErr) throw new ChatScoresError(sErr.message)

  const sessions = (sessionRows ?? []) as Array<{ id: string; status: string | null }>

  return {
    invited: (participantRows ?? []).length,
    started: sessions.length,
    completed: sessions.filter((s) => s.status === 'completed').length,
    scoredSessions: sessions.filter((s) => s.status === 'completed').length,
  }
}

/** The session a participant most recently completed, if any is visible. */
export async function getLatestSessionForParticipant(
  db: SupabaseClient,
  participantId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from('participant_sessions')
    .select('id, completed_at, created_at')
    .eq('campaign_participant_id', participantId)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new ChatScoresError(error.message)
  return (data as { id: string } | null)?.id ?? null
}
