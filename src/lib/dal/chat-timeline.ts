// =============================================================================
// src/lib/dal/chat-timeline.ts
//
// A person's sittings over time, and side-by-side comparison between people.
//
// Two psychometric rules are enforced here rather than left to the caller,
// because both are easy to get wrong and expensive to get wrong:
//
//  1. CHANGE IS ONLY CLAIMED WITHIN ONE INSTRUMENT. The same factor measured by
//     two different assessments is not the same measurement, so a delta across
//     them is meaningless. Change is computed per (assessment, factor) pair and
//     nowhere else.
//
//  2. COMPOSITES ARE NOT COMPARED ACROSS METHODS. participant_sessions carries
//     composite_score with a composite_method, and production holds two
//     different methods (mean_of_children, weighted_lr_v1) across only 9 of 21
//     sessions. Comparing one method's composite to another's is not a
//     comparison of anything, so composites are surfaced with their method
//     attached and never differenced across differing methods.
//
// Comparison between people does NOT require norms. Two people who sat the same
// instrument were measured against the same defined standard, so saying one met
// more of it than the other is a criterion-referenced fact. What norms would add
// is a claim about where either sits in a population — which is a different
// claim, and one this module never makes.
//
// Client injected, as with the other chat DAL modules: tenancy comes from RLS.
// =============================================================================

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolveCompetencyScoreDisplay,
  CompetencyClaimsViolation,
  isCompetencyMetric,
} from '@/lib/reports/competency-claims'
import { logActionError } from '@/lib/security/action-errors'
import { toFactorScore, type RawScoreRow, type FactorScore } from './chat-scores-mappers'

export class ChatTimelineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChatTimelineError'
  }
}

export interface TimelineSitting {
  sessionId: string
  campaignParticipantId: string
  campaignId: string | null
  campaignTitle: string | null
  assessmentId: string | null
  assessmentTitle: string | null
  completedAt: string | null
  factors: FactorScore[]
  /** Present only when the session carries one; always paired with its method. */
  compositeScore: number | null
  compositeMethod: string | null
  href: string | null
}

export interface FactorChange {
  assessmentId: string
  assessmentTitle: string | null
  factorId: string
  factorName: string
  fromScore: number
  toScore: number
  fromAt: string | null
  toAt: string | null
  delta: number
}

export interface PersonTimeline {
  sittings: TimelineSitting[]
  /** Only within one instrument — see the module note. */
  changes: FactorChange[]
  /** Sittings that were dropped because no score survived the claims ladder. */
  droppedRows: number
}

interface SessionRow {
  id: string
  status: string | null
  completed_at: string | null
  campaign_id: string | null
  campaign_participant_id: string | null
  assessment_id: string | null
  composite_score: number | null
  composite_method: string | null
  assessments: { id: string; title: string | null } | null
  campaigns: { id: string; title: string | null } | null
}

async function loadScoresBySession(
  db: SupabaseClient,
  sessionIds: string[],
): Promise<{ map: Map<string, FactorScore[]>; dropped: number }> {
  const map = new Map<string, FactorScore[]>()
  let dropped = 0
  if (sessionIds.length === 0) return { map, dropped }

  const { data, error } = await db
    .from('participant_scores')
    .select(
      'session_id, factor_id, metric, scaled_score, raw_score, percentile, confidence_interval_lower, confidence_interval_upper, norm_group_id, norm_version, provisional, scoring_variant, factors(id, name)',
    )
    .in('session_id', sessionIds)

  if (error) throw new ChatTimelineError(error.message)

  for (const raw of (data ?? []) as unknown as Array<RawScoreRow & { session_id: string }>) {
    if (!isCompetencyMetric(raw.metric)) continue
    try {
      const display = resolveCompetencyScoreDisplay(raw)
      const list = map.get(raw.session_id) ?? []
      list.push(toFactorScore(raw, display))
      map.set(raw.session_id, list)
    } catch (error) {
      if (error instanceof CompetencyClaimsViolation) {
        dropped += 1
        logActionError('chat.timeline.claims_violation', error)
        continue
      }
      throw error
    }
  }

  for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name))
  return { map, dropped }
}

/**
 * Every completed sitting for a person, oldest first, with the scores that can
 * be rendered — plus the within-instrument changes those sittings support.
 */
export async function getPersonTimeline(
  db: SupabaseClient,
  participantIds: string[],
): Promise<PersonTimeline> {
  if (participantIds.length === 0) {
    return { sittings: [], changes: [], droppedRows: 0 }
  }

  const { data, error } = await db
    .from('participant_sessions')
    .select(
      'id, status, completed_at, campaign_id, campaign_participant_id, assessment_id, composite_score, composite_method, assessments(id, title), campaigns(id, title)',
    )
    .in('campaign_participant_id', participantIds)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true, nullsFirst: false })

  if (error) throw new ChatTimelineError(error.message)

  const rows = (data ?? []) as unknown as SessionRow[]
  const { map, dropped } = await loadScoresBySession(
    db,
    rows.map((r) => r.id),
  )

  const sittings: TimelineSitting[] = rows.map((row) => ({
    sessionId: row.id,
    campaignParticipantId: row.campaign_participant_id ?? '',
    campaignId: row.campaign_id,
    campaignTitle: row.campaigns?.title ?? null,
    assessmentId: row.assessment_id,
    assessmentTitle: row.assessments?.title ?? null,
    completedAt: row.completed_at,
    factors: map.get(row.id) ?? [],
    compositeScore: row.composite_score,
    compositeMethod: row.composite_method,
    href:
      row.campaign_id && row.campaign_participant_id
        ? `/campaigns/${row.campaign_id}/participants/${row.campaign_participant_id}/sessions/${row.id}`
        : null,
  }))

  return { sittings, changes: deriveChanges(sittings), droppedRows: dropped }
}

/**
 * First-to-latest change per (assessment, factor). Restricted to one instrument
 * on purpose: the same factor name measured by a different assessment is a
 * different measurement, and differencing the two would manufacture a trend.
 */
export function deriveChanges(sittings: TimelineSitting[]): FactorChange[] {
  const byKey = new Map<
    string,
    { first: { s: TimelineSitting; f: FactorScore }; last: { s: TimelineSitting; f: FactorScore } }
  >()

  for (const sitting of sittings) {
    if (!sitting.assessmentId) continue
    for (const factor of sitting.factors) {
      const key = `${sitting.assessmentId}::${factor.factorId}`
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, { first: { s: sitting, f: factor }, last: { s: sitting, f: factor } })
      } else {
        existing.last = { s: sitting, f: factor }
      }
    }
  }

  const changes: FactorChange[] = []
  for (const { first, last } of byKey.values()) {
    if (first.s.sessionId === last.s.sessionId) continue
    changes.push({
      assessmentId: first.s.assessmentId as string,
      assessmentTitle: first.s.assessmentTitle,
      factorId: first.f.factorId,
      factorName: first.f.name,
      fromScore: first.f.scaledScore,
      toScore: last.f.scaledScore,
      fromAt: first.s.completedAt,
      toAt: last.s.completedAt,
      delta: Number((last.f.scaledScore - first.f.scaledScore).toFixed(1)),
    })
  }

  return changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

// ---------------------------------------------------------------------------
// Comparison between people
// ---------------------------------------------------------------------------

export interface ComparisonPerson {
  name: string
  campaignParticipantIds: string[]
  /**
   * The participation row the SELECTED sitting belongs to. The compare page
   * treats each `ids` value as the exact entry and only loads sessions attached
   * to it, so a link built from "the newest participation" can open a matrix
   * with empty cells when the shared assessment was sat under an older one.
   */
  selectedParticipantId: string
  sessionId: string
  campaignId: string | null
  campaignTitle: string | null
  completedAt: string | null
  factors: FactorScore[]
}

export interface PeopleComparison {
  assessmentId: string
  assessmentTitle: string | null
  people: ComparisonPerson[]
  /** Factors every person in the comparison has a score for. */
  sharedFactorIds: string[]
  /** People who had no sitting on the common instrument. */
  excluded: Array<{ name: string; reason: string }>
  sameCampaign: boolean
}

/**
 * Compare people on ONE common instrument.
 *
 * No norms are required, and none are implied. Two people who sat the same
 * assessment were measured against the same defined standard, so "she met more
 * of it than he did" is a criterion-referenced fact about this instrument. It is
 * not a statement about where either sits among people generally — that would
 * need a norm group, and this function never produces it.
 *
 * The comparison is refused rather than approximated when there is no shared
 * instrument, because comparing scores from different instruments is the
 * failure this is designed to prevent.
 */
export async function comparePeopleOnCommonAssessment(
  db: SupabaseClient,
  people: Array<{ name: string; participantIds: string[] }>,
  preferredAssessmentId?: string,
): Promise<PeopleComparison | null> {
  const timelines = await Promise.all(
    people.map(async (person) => ({
      person,
      timeline: await getPersonTimeline(db, person.participantIds),
    })),
  )

  // Only sittings that actually carry renderable scores can take part.
  const scored = timelines.map(({ person, timeline }) => ({
    person,
    sittings: timeline.sittings.filter((s) => s.factors.length > 0),
  }))

  const withAny = scored.filter((s) => s.sittings.length > 0)
  const excluded = scored
    .filter((s) => s.sittings.length === 0)
    .map((s) => ({
      name: s.person.name,
      reason: 'no completed sitting with competency scores visible to you',
    }))

  if (withAny.length < 2) return null

  // Assessments every remaining person has sat.
  const sets = withAny.map(
    (s) => new Set(s.sittings.map((x) => x.assessmentId).filter(Boolean) as string[]),
  )
  let common = [...sets[0]].filter((id) => sets.every((set) => set.has(id)))
  if (common.length === 0) return null
  if (preferredAssessmentId && common.includes(preferredAssessmentId)) {
    common = [preferredAssessmentId]
  }

  // Prefer the instrument the group most recently sat.
  const assessmentId = common
    .map((id) => ({
      id,
      latest: Math.max(
        ...withAny.map((s) =>
          Math.max(
            ...s.sittings
              .filter((x) => x.assessmentId === id)
              .map((x) => (x.completedAt ? Date.parse(x.completedAt) : 0)),
          ),
        ),
      ),
    }))
    .sort((a, b) => b.latest - a.latest)[0].id

  const comparisonPeople: ComparisonPerson[] = withAny.map((s) => {
    const onAssessment = s.sittings
      .filter((x) => x.assessmentId === assessmentId)
      .sort(
        (a, b) =>
          (b.completedAt ? Date.parse(b.completedAt) : 0) -
          (a.completedAt ? Date.parse(a.completedAt) : 0),
      )
    const latest = onAssessment[0]
    return {
      name: s.person.name,
      campaignParticipantIds: s.person.participantIds,
      selectedParticipantId: latest.campaignParticipantId || s.person.participantIds[0],
      sessionId: latest.sessionId,
      campaignId: latest.campaignId,
      campaignTitle: latest.campaignTitle,
      completedAt: latest.completedAt,
      factors: latest.factors,
    }
  })

  const factorSets = comparisonPeople.map((p) => new Set(p.factors.map((f) => f.factorId)))
  const sharedFactorIds = [...factorSets[0]].filter((id) =>
    factorSets.every((set) => set.has(id)),
  )

  const campaignIds = new Set(comparisonPeople.map((p) => p.campaignId))

  return {
    assessmentId,
    assessmentTitle:
      withAny[0].sittings.find((x) => x.assessmentId === assessmentId)?.assessmentTitle ?? null,
    people: comparisonPeople,
    sharedFactorIds,
    excluded,
    sameCampaign: campaignIds.size === 1,
  }
}
