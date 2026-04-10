'use server'

import { createClient } from '@/lib/supabase/server'
import {
  AuthorizationError,
  requireCampaignAccess,
} from '@/lib/auth/authorization'
import { resolveBand, type BandEntity } from '@/lib/reports/band-resolution'
import { throwActionError } from '@/lib/security/action-errors'

type AudienceType = 'participant' | 'hr_manager' | 'consultant'

type EmbeddedAssessment = {
  title: string | null
}

type EmbeddedCampaignParticipant = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  campaign_id: string | null
}

type EmbeddedFactor = {
  id: string
  name: string | null
  band_label_low: string | null
  band_label_mid: string | null
  band_label_high: string | null
  pomp_threshold_low: number | null
  pomp_threshold_high: number | null
}

type EmbeddedParticipantScore = {
  factor_id: string
  scaled_score: number | null
  percentile: number | null
  factors: EmbeddedFactor | EmbeddedFactor[] | null
}

type EmbeddedSnapshot = {
  id: string
  audience_type: string | null
  status: string | null
  pdf_url: string | null
  created_at: string | null
}

type CampaignFactorScoreLookupRow = {
  id: string
  assessment_id: string | null
  completed_at: string | null
  started_at: string | null
  campaign_participant_id: string | null
  assessments: EmbeddedAssessment | EmbeddedAssessment[] | null
  campaign_participants:
    | EmbeddedCampaignParticipant
    | EmbeddedCampaignParticipant[]
    | null
  participant_scores: EmbeddedParticipantScore[] | null
  report_snapshots: EmbeddedSnapshot[] | null
}

export type CampaignFactorScore = {
  factorId: string
  factorName: string
  scaledScore: number
  percentile?: number
  band: 'low' | 'mid' | 'high'
  bandLabel: string
}

export type CampaignFactorScoreRow = {
  sessionId: string
  participantId: string
  participantName: string
  participantEmail: string
  assessmentId: string
  assessmentTitle: string
  completedAt?: string
  attemptNumber: number
  factors: CampaignFactorScore[]
  reportSnapshotId?: string
  reportStatus?: string
  reportPdfReady: boolean
}

function getEmbeddedRecord<T extends Record<string, unknown>>(
  value: T | T[] | null | undefined
) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function getParticipantName(participant: EmbeddedCampaignParticipant | null) {
  const fullName = `${participant?.first_name ?? ''} ${participant?.last_name ?? ''}`.trim()
  return fullName || participant?.email || 'Unknown participant'
}

export async function getCampaignFactorScores(
  campaignId: string,
  audienceType: AudienceType
): Promise<CampaignFactorScoreRow[]> {
  try {
    await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return []
    }
    throw error
  }

  const db = await createClient()
  const { data, error } = await db
    .from('participant_sessions')
    .select(`
      id,
      assessment_id,
      completed_at,
      started_at,
      campaign_participant_id,
      assessments(title),
      campaign_participants!inner(
        id,
        email,
        first_name,
        last_name,
        campaign_id
      ),
      participant_scores(
        factor_id,
        scaled_score,
        percentile,
        factors(
          id,
          name,
          band_label_low,
          band_label_mid,
          band_label_high,
          pomp_threshold_low,
          pomp_threshold_high
        )
      ),
      report_snapshots(
        id,
        audience_type,
        status,
        pdf_url,
        created_at
      )
    `)
    .eq('campaign_participants.campaign_id', campaignId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false })

  if (error) {
    throwActionError(
      'getCampaignFactorScores',
      'Unable to load campaign factor scores.',
      error
    )
  }

  const rows = (data ?? []) as CampaignFactorScoreLookupRow[]
  const attemptOrdinals = new Map<string, number[]>()

  for (const row of rows) {
    const participant = getEmbeddedRecord(row.campaign_participants)
    if (!participant?.id || !row.assessment_id) {
      continue
    }

    const key = `${participant.id}:${row.assessment_id}`
    const completedAt = new Date(row.completed_at ?? row.started_at ?? 0).getTime()
    const existing = attemptOrdinals.get(key) ?? []
    existing.push(completedAt)
    attemptOrdinals.set(key, existing)
  }

  for (const attempts of attemptOrdinals.values()) {
    attempts.sort((left, right) => left - right)
  }

  return rows.map((row) => {
    const participant = getEmbeddedRecord(row.campaign_participants)
    const assessment = getEmbeddedRecord(row.assessments)
    const completedAt = row.completed_at ?? row.started_at ?? undefined
    const attemptKey =
      participant?.id && row.assessment_id
        ? `${participant.id}:${row.assessment_id}`
        : null
    const completedTs = new Date(completedAt ?? 0).getTime()
    const attemptNumber = attemptKey
      ? (attemptOrdinals.get(attemptKey)?.indexOf(completedTs) ?? 0) + 1
      : 1

    const factors = (row.participant_scores ?? [])
      .map((score) => {
        const factor = getEmbeddedRecord(score.factors)
        const scaledScore = Number(score.scaled_score ?? 0)
        const bandResult = resolveBand(
          scaledScore,
          {
            bandLabelLow: factor?.band_label_low ?? undefined,
            bandLabelMid: factor?.band_label_mid ?? undefined,
            bandLabelHigh: factor?.band_label_high ?? undefined,
            pompThresholdLow: factor?.pomp_threshold_low ?? undefined,
            pompThresholdHigh: factor?.pomp_threshold_high ?? undefined,
          } satisfies BandEntity
        )

        return {
          factorId: String(score.factor_id),
          factorName: factor?.name ? String(factor.name) : String(score.factor_id),
          scaledScore,
          percentile:
            score.percentile != null ? Number(score.percentile) : undefined,
          band: bandResult.band,
          bandLabel: bandResult.bandLabel,
        } satisfies CampaignFactorScore
      })
      .sort((left, right) => right.scaledScore - left.scaledScore)

    const snapshot = [...(row.report_snapshots ?? [])]
      .filter((candidate) => candidate.audience_type === audienceType)
      .sort((left, right) => {
        const leftTs = new Date(left.created_at ?? 0).getTime()
        const rightTs = new Date(right.created_at ?? 0).getTime()
        return rightTs - leftTs
      })[0]

    return {
      sessionId: row.id,
      participantId: participant?.id ?? '',
      participantName: getParticipantName(participant),
      participantEmail: participant?.email ?? '',
      assessmentId: row.assessment_id ?? '',
      assessmentTitle: assessment?.title ?? 'Untitled assessment',
      completedAt,
      attemptNumber,
      factors,
      reportSnapshotId: snapshot?.id ?? undefined,
      reportStatus: snapshot?.status ?? undefined,
      reportPdfReady: Boolean(snapshot?.pdf_url),
    } satisfies CampaignFactorScoreRow
  })
}
