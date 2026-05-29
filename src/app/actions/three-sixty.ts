'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCampaignAccess } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { logActionError } from '@/lib/security/action-errors'
import { scoreSessionCTT } from '@/lib/scoring/ctt-session'
import {
  aggregateThreeSixty,
  type RaterCategory,
  type SessionScore,
} from '@/lib/scoring/three-sixty'

async function require360Admin(campaignId: string) {
  const access = await requireCampaignAccess(campaignId)
  if (!access.scope.isPlatformAdmin) {
    throw new Error('360 results are restricted to platform admins.')
  }
  return access
}

export interface GenerateSnapshotResult {
  success?: true
  raterCount?: number
  factorCount?: number
  error?: string
}

/**
 * Score every completed session in a 360 campaign (subject + raters), aggregate
 * by rater category with N≥3 suppression, and persist the immutable snapshot.
 * Idempotent: re-running re-scores and overwrites the single snapshot.
 */
export async function generateCampaign360Snapshot(
  campaignId: string,
): Promise<GenerateSnapshotResult> {
  const access = await require360Admin(campaignId)
  const db = createAdminClient()

  // Subject = the campaign's single non-rater participant.
  const { data: subjectRows } = await db
    .from('campaign_participants')
    .select('id')
    .eq('campaign_id', campaignId)
    .is('campaign_rater_id', null)
    .order('created_at', { ascending: true })
    .limit(1)
  const subject = subjectRows?.[0]
  if (!subject) return { error: 'Set the subject before generating results.' }

  // All participants in the campaign, with their rater relationship + lifecycle
  // status (so declined/withdrawn raters are excluded — declining propagates
  // 'withdrawn' to the participant row).
  const { data: participantRows } = await db
    .from('campaign_participants')
    .select('id, status, campaign_rater_id, campaign_raters(relationship, status)')
    .eq('campaign_id', campaignId)

  // Completed sessions for those participants.
  const { data: sessionRows } = await db
    .from('participant_sessions')
    .select('id, campaign_participant_id, status')
    .eq('campaign_id', campaignId)
    .eq('status', 'completed')

  if (!sessionRows || sessionRows.length === 0) {
    return { error: 'No completed sessions yet.' }
  }

  // Map participant → category (self for the subject; relationship for raters).
  // Skip withdrawn/declined participants so they don't feed the aggregate even
  // if they had already completed before being removed.
  const categoryByParticipant = new Map<string, RaterCategory>()
  for (const p of participantRows ?? []) {
    if (p.status === 'withdrawn' || p.status === 'expired') continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rater = (p as any).campaign_raters as
      | { relationship?: RaterCategory; status?: string }
      | null
    if (rater && (rater.status === 'declined' || rater.status === 'withdrawn')) {
      continue
    }
    categoryByParticipant.set(
      p.id as string,
      p.campaign_rater_id ? (rater?.relationship ?? 'other') : 'self',
    )
  }

  // Score each completed session and read its factor POMP scores.
  const sessionScores: SessionScore[] = []
  const factorIdSet = new Set<string>()
  for (const s of sessionRows) {
    const category = categoryByParticipant.get(
      s.campaign_participant_id as string,
    )
    if (!category) continue

    const scored = await scoreSessionCTT(s.id as string)
    if ('error' in scored) {
      // Skip sessions that can't be scored (e.g. no responses) rather than abort.
      continue
    }

    const { data: scoreRows } = await db
      .from('participant_scores')
      .select('factor_id, scaled_score')
      .eq('session_id', s.id)

    const factorScores: Record<string, number> = {}
    for (const row of scoreRows ?? []) {
      if (row.factor_id == null || row.scaled_score == null) continue
      factorScores[row.factor_id as string] = Number(row.scaled_score)
      factorIdSet.add(row.factor_id as string)
    }
    sessionScores.push({ category, factorScores })
  }

  if (factorIdSet.size === 0) {
    return { error: 'No scores could be computed from the completed sessions.' }
  }

  const factorIds = Array.from(factorIdSet)
  const aggregate = aggregateThreeSixty(sessionScores, factorIds)

  // Enrich factors with display names for the report.
  const { data: factorRows } = await db
    .from('factors')
    .select('id, name')
    .in('id', factorIds)
  const factorNames = new Map(
    (factorRows ?? []).map((f) => [f.id as string, f.name as string]),
  )

  const data = {
    version: 1,
    factors: aggregate.factors.map((f) => ({
      ...f,
      name: factorNames.get(f.factorId) ?? 'Factor',
    })),
    selfCompleted: sessionScores.some((s) => s.category === 'self'),
  }

  const { error: upsertErr } = await db.from('campaign_360_snapshots').upsert(
    {
      campaign_id: campaignId,
      subject_participant_id: subject.id,
      data,
      rater_count: aggregate.raterCount,
      rater_count_by_category: aggregate.raterCountByCategory,
      generated_at: new Date().toISOString(),
      generated_by: access.scope.actor?.id ?? null,
    },
    { onConflict: 'campaign_id' },
  )

  if (upsertErr) {
    logActionError('generateCampaign360Snapshot', upsertErr)
    return { error: 'Unable to save the 360 results.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.360.snapshot_generated',
    targetTable: 'campaign_360_snapshots',
    targetId: campaignId,
    metadata: { raterCount: aggregate.raterCount, factorCount: factorIds.length },
  })

  revalidatePath(`/campaigns/${campaignId}/raters`)
  revalidatePath(`/campaigns/${campaignId}/results`)
  return {
    success: true,
    raterCount: aggregate.raterCount,
    factorCount: factorIds.length,
  }
}

export interface Campaign360SnapshotView {
  data: Record<string, unknown>
  raterCount: number
  raterCountByCategory: Record<string, number>
  generatedAt: string
}

/** Read the persisted snapshot for display (admin). */
export async function getCampaign360Snapshot(
  campaignId: string,
): Promise<Campaign360SnapshotView | null> {
  await require360Admin(campaignId)
  const db = createAdminClient()
  const { data, error } = await db
    .from('campaign_360_snapshots')
    .select('data, rater_count, rater_count_by_category, generated_at')
    .eq('campaign_id', campaignId)
    .maybeSingle()
  if (error || !data) return null
  return {
    data: (data.data ?? {}) as Record<string, unknown>,
    raterCount: data.rater_count ?? 0,
    raterCountByCategory: (data.rater_count_by_category ?? {}) as Record<
      string,
      number
    >,
    generatedAt: data.generated_at,
  }
}
