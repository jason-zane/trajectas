'use server'

import { createClient } from '@/lib/supabase/server'
import { requireParticipantAccess } from '@/lib/auth/authorization'

export type EligibleAssessment = {
  assessmentId: string
  assessmentName: string
  completedSessionCount: number
}

type EmbeddedAssessment = { id: string; title: string }
type EligibleSessionRow = {
  assessment_id: string
  status: string
  assessments: EmbeddedAssessment | EmbeddedAssessment[] | null
}

function unwrapEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function getEligibleAssessmentsForParticipants(
  campaignParticipantIds: string[],
): Promise<EligibleAssessment[]> {
  if (campaignParticipantIds.length === 0) return []

  // Throws AuthorizationError on the first unauthorized id; we let it propagate.
  await Promise.all(campaignParticipantIds.map((id) => requireParticipantAccess(id)))

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('participant_sessions')
    .select('assessment_id, status, assessments(id, title)')
    .in('campaign_participant_id', campaignParticipantIds)
  if (error) throw error

  const counts = new Map<string, EligibleAssessment>()
  for (const row of ((data ?? []) as unknown as EligibleSessionRow[])) {
    const a = unwrapEmbedded(row.assessments)
    if (!a) continue
    const existing = counts.get(a.id) ?? {
      assessmentId: a.id,
      assessmentName: a.title,
      completedSessionCount: 0,
    }
    if (row.status === 'completed') existing.completedSessionCount += 1
    counts.set(a.id, existing)
  }
  return [...counts.values()].sort((a, b) =>
    a.assessmentName.localeCompare(b.assessmentName),
  )
}

// ---------------------------------------------------------------------------
// getSessionOptionsForRow
// ---------------------------------------------------------------------------

export type SessionOption = {
  sessionId: string
  assessmentId: string
  assessmentName: string
  attemptNumber: number
  startedAt: string
  status: string
}

type SessionOptionRow = {
  id: string
  assessment_id: string
  started_at: string | null
  status: string
  assessments: { title: string } | { title: string }[] | null
}

export async function getSessionOptionsForRow(
  campaignParticipantId: string,
  assessmentIds: string[],
): Promise<SessionOption[]> {
  if (assessmentIds.length === 0) return []
  await requireParticipantAccess(campaignParticipantId)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('participant_sessions')
    .select('id, assessment_id, started_at, status, assessments(title)')
    .eq('campaign_participant_id', campaignParticipantId)
    .in('assessment_id', assessmentIds)
    .order('started_at', { ascending: true })
  if (error) throw error

  const perAssessmentCounter = new Map<string, number>()
  return ((data ?? []) as unknown as SessionOptionRow[]).map((row) => {
    const next = (perAssessmentCounter.get(row.assessment_id) ?? 0) + 1
    perAssessmentCounter.set(row.assessment_id, next)
    return {
      sessionId: row.id,
      assessmentId: row.assessment_id,
      assessmentName: unwrapEmbedded(row.assessments)?.title ?? '',
      attemptNumber: next,
      startedAt: row.started_at ?? '',
      status: row.status,
    }
  })
}
