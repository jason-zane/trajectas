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
