'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolveAuthorizedScope, AuthorizationError, requireCampaignAccess } from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'
import type {
  ParticipantSessionProcessingStatus,
  ReportPdfStatus,
} from '@/types/database'

export type SessionDetailScore = {
  factorId: string
  factorName: string
  rawScore: number
  scaledScore: number
  percentile?: number
  confidenceLower?: number
  confidenceUpper?: number
  scoringMethod: string
  itemsUsed: number
}

export type SessionDetailSnapshot = {
  id: string
  templateId: string
  templateName?: string
  audienceType: string
  status: string
  generatedAt?: string
  releasedAt?: string
  errorMessage?: string
  pdfUrl?: string
  pdfStatus?: ReportPdfStatus
  pdfErrorMessage?: string
  narrativeMode: string
}

export type SessionDetail = {
  id: string
  assessmentId: string
  assessmentTitle: string
  campaignId: string
  campaignTitle: string
  clientId?: string
  clientName?: string
  participantId: string
  participantName: string
  participantEmail: string
  status: string
  processingStatus: ParticipantSessionProcessingStatus
  processingError?: string
  startedAt?: string
  completedAt?: string
  processedAt?: string
  durationMinutes?: number
  responseCount: number
  scores: SessionDetailScore[]
  snapshots: SessionDetailSnapshot[]
  attemptNumber: number
  totalAttempts: number
}

type EmbeddedClientRecord = {
  id?: string | null
  name?: string | null
}

type EmbeddedCampaignRecord = {
  id?: string | null
  title?: string | null
  client_id?: string | null
  clients?: EmbeddedClientRecord | EmbeddedClientRecord[] | null
}

type EmbeddedParticipantRecord = {
  id?: string | null
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  campaign_id?: string | null
  campaigns?: EmbeddedCampaignRecord | EmbeddedCampaignRecord[] | null
}

type EmbeddedFactorRecord = {
  name?: string | null
}

type SessionScoreLookupRow = {
  factor_id?: string | null
  raw_score?: number | string | null
  scaled_score?: number | string | null
  percentile?: number | string | null
  confidence_interval_lower?: number | string | null
  confidence_interval_upper?: number | string | null
  scoring_method?: string | null
  factors?: EmbeddedFactorRecord | EmbeddedFactorRecord[] | null
}

type SnapshotLookupRow = {
  id?: string | null
  template_id?: string | null
  audience_type?: string | null
  status?: string | null
  generated_at?: string | null
  released_at?: string | null
  error_message?: string | null
  pdf_url?: string | null
  pdf_status?: ReportPdfStatus | null
  pdf_error_message?: string | null
  narrative_mode?: string | null
  report_templates?: { name?: string | null } | { name?: string | null }[] | null
}

type SessionAccessLookupRow = {
  campaign_participants?: {
    campaigns?: { client_id?: string | null } | { client_id?: string | null }[] | null
  } | {
    campaigns?: { client_id?: string | null } | { client_id?: string | null }[] | null
  }[] | null
}

type CampaignSessionLookupRow = {
  id?: string | null
  assessment_id?: string | null
  status?: string | null
  processing_status?: ParticipantSessionProcessingStatus | null
  processing_error?: string | null
  started_at?: string | null
  completed_at?: string | null
  campaign_participants?: EmbeddedParticipantRecord | EmbeddedParticipantRecord[] | null
  assessments?: { title?: string | null } | { title?: string | null }[] | null
  participant_scores?: Array<{ id?: string | null }> | null
}

function getEmbeddedRecord<T extends Record<string, unknown>>(
  value: T | T[] | null | undefined
) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function logSessionDetailError(scope: string, error: unknown) {
  console.error(`[getSessionDetail] ${scope} failed:`, error)
}

async function assertSessionAccess(sessionId: string): Promise<string> {
  const scope = await resolveAuthorizedScope()
  if (scope.isPlatformAdmin || scope.isLocalDevelopmentBypass) return sessionId

  const db = await createClient()
  const { data, error } = await db
    .from('participant_sessions')
    .select('id, campaign_participants(campaigns(client_id))')
    .eq('id', sessionId)
    .single()

  if (error || !data) {
    throw new AuthorizationError('Session not found or not accessible.')
  }

  const accessRow = data as SessionAccessLookupRow
  const cp = getEmbeddedRecord(accessRow.campaign_participants)
  const campaign = getEmbeddedRecord(cp?.campaigns)
  const clientId = campaign?.client_id ? String(campaign.client_id) : undefined

  if (!clientId || !scope.clientIds.includes(clientId)) {
    throw new AuthorizationError('Session not accessible in current scope.')
  }

  return sessionId
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  try {
    await assertSessionAccess(sessionId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null
    }
    throw error
  }
  const db = createAdminClient()

  const { data: session, error } = await db
    .from('participant_sessions')
    .select(
      'id, assessment_id, status, processing_status, processing_error, processed_at, started_at, completed_at, campaign_participant_id',
    )
    .eq('id', sessionId)
    .maybeSingle()

  if (error) {
    throwActionError('getSessionDetail', 'Unable to load session.', error)
  }
  if (!session) return null

  const [
    assessmentResult,
    participantResult,
    responseCountResult,
    attemptResult,
    snapshotResult,
    scoresResult,
  ] = await Promise.allSettled([
    db
      .from('assessments')
      .select('id, title')
      .eq('id', session.assessment_id)
      .maybeSingle(),
    db
      .from('campaign_participants')
      .select(`
        id,
        email,
        first_name,
        last_name,
        campaign_id,
        campaigns(
          id,
          title,
          client_id,
          clients(id, name)
        )
      `)
      .eq('id', session.campaign_participant_id)
      .maybeSingle(),
    db
      .from('participant_responses')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId),
    db
      .from('participant_sessions')
      .select('id, started_at')
      .eq('campaign_participant_id', session.campaign_participant_id)
      .eq('assessment_id', session.assessment_id)
      .order('started_at', { ascending: true, nullsFirst: false }),
    db
      .from('report_snapshots')
      .select('id, template_id, audience_type, status, generated_at, released_at, error_message, pdf_url, pdf_status, pdf_error_message, narrative_mode, report_templates(name)')
      .eq('participant_session_id', sessionId)
      .order('created_at', { ascending: false }),
    db
      .from('participant_scores')
      .select(`
        factor_id,
        raw_score,
        scaled_score,
        percentile,
        confidence_interval_lower,
        confidence_interval_upper,
        scoring_method,
        factors(name)
      `)
      .eq('session_id', sessionId),
  ])

  const assessmentRecord =
    assessmentResult.status === 'fulfilled'
      ? (() => {
          if (assessmentResult.value.error) {
            logSessionDetailError('assessment lookup', assessmentResult.value.error)
            return null
          }
          return assessmentResult.value.data
        })()
      : (logSessionDetailError('assessment lookup', assessmentResult.reason), null)

  const cpRecord =
    participantResult.status === 'fulfilled'
      ? (() => {
          if (participantResult.value.error) {
            logSessionDetailError('participant lookup', participantResult.value.error)
            return null
          }
          return (participantResult.value.data ?? null) as EmbeddedParticipantRecord | null
        })()
      : (logSessionDetailError('participant lookup', participantResult.reason), null)

  const campaignRecord = getEmbeddedRecord(cpRecord?.campaigns)
  const clientRecord = getEmbeddedRecord(campaignRecord?.clients)

  const responseCount =
    responseCountResult.status === 'fulfilled'
      ? (() => {
          if (responseCountResult.value.error) {
            logSessionDetailError('response count lookup', responseCountResult.value.error)
            return 0
          }
          return responseCountResult.value.count ?? 0
        })()
      : (logSessionDetailError('response count lookup', responseCountResult.reason), 0)

  const attemptRows =
    attemptResult.status === 'fulfilled'
      ? (() => {
          if (attemptResult.value.error) {
            logSessionDetailError('attempt lookup', attemptResult.value.error)
            return []
          }
          return attemptResult.value.data ?? []
        })()
      : (logSessionDetailError('attempt lookup', attemptResult.reason), [])

  const attemptNumber = attemptRows.findIndex((r) => r.id === sessionId) + 1 || 1
  const totalAttempts = attemptRows.length || 1

  const snapshotRows =
    snapshotResult.status === 'fulfilled'
      ? (() => {
          if (snapshotResult.value.error) {
            logSessionDetailError('snapshot lookup', snapshotResult.value.error)
            return [] as SnapshotLookupRow[]
          }
          return (snapshotResult.value.data ?? []) as SnapshotLookupRow[]
        })()
      : (logSessionDetailError('snapshot lookup', snapshotResult.reason), [])

  const scoreRows =
    scoresResult.status === 'fulfilled'
      ? (() => {
          if (scoresResult.value.error) {
            logSessionDetailError('score lookup', scoresResult.value.error)
            return [] as SessionScoreLookupRow[]
          }
          return (scoresResult.value.data ?? []) as SessionScoreLookupRow[]
        })()
      : (logSessionDetailError('score lookup', scoresResult.reason), [])

  const scores: SessionDetailScore[] = scoreRows.map((s) => {
    const factor = getEmbeddedRecord(s.factors)
    return {
      factorId: String(s.factor_id),
      factorName: String(factor?.name ?? 'Unknown'),
      rawScore: Number(s.raw_score ?? 0),
      scaledScore: Number(s.scaled_score ?? 0),
      percentile: s.percentile != null ? Number(s.percentile) : undefined,
      confidenceLower: s.confidence_interval_lower != null ? Number(s.confidence_interval_lower) : undefined,
      confidenceUpper: s.confidence_interval_upper != null ? Number(s.confidence_interval_upper) : undefined,
      scoringMethod: String(s.scoring_method ?? 'ctt'),
      itemsUsed: 0,
    }
  })

  const snapshots: SessionDetailSnapshot[] = snapshotRows.map((r) => {
    const tpl = getEmbeddedRecord(r.report_templates)
    return {
      id: String(r.id),
      templateId: String(r.template_id),
      templateName: tpl?.name ? String(tpl.name) : undefined,
      audienceType: String(r.audience_type),
      status: String(r.status),
      generatedAt: r.generated_at ?? undefined,
      releasedAt: r.released_at ?? undefined,
      errorMessage: r.error_message ?? undefined,
      pdfUrl: r.pdf_url ?? undefined,
      pdfStatus: r.pdf_status ?? undefined,
      pdfErrorMessage: r.pdf_error_message ?? undefined,
      narrativeMode: String(r.narrative_mode ?? 'derived'),
    }
  })

  const startedAt = session.started_at ?? undefined
  const completedAt = session.completed_at ?? undefined
  const durationMinutes = (startedAt && completedAt)
    ? Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000))
    : undefined

  const firstName = cpRecord?.first_name ?? ''
  const lastName = cpRecord?.last_name ?? ''
  const participantName = `${firstName} ${lastName}`.trim() || (cpRecord?.email ?? 'Unknown')

  return {
    id: String(session.id),
    assessmentId: String(session.assessment_id),
    assessmentTitle: String(assessmentRecord?.title ?? 'Unknown'),
    campaignId: String(campaignRecord?.id ?? cpRecord?.campaign_id ?? ''),
    campaignTitle: String(campaignRecord?.title ?? ''),
    clientId: campaignRecord?.client_id ? String(campaignRecord.client_id) : undefined,
    clientName: clientRecord?.name ? String(clientRecord.name) : undefined,
    participantId: String(session.campaign_participant_id),
    participantName,
    participantEmail: String(cpRecord?.email ?? ''),
    status: String(session.status),
    processingStatus: (session.processing_status ?? 'idle') as ParticipantSessionProcessingStatus,
    processingError: session.processing_error ?? undefined,
    startedAt,
    completedAt,
    processedAt: session.processed_at ?? undefined,
    durationMinutes,
    responseCount: responseCount ?? 0,
    scores,
    snapshots,
    attemptNumber,
    totalAttempts,
  }
}

export async function getSessionSnapshots(sessionId: string): Promise<SessionDetailSnapshot[]> {
  try {
    await assertSessionAccess(sessionId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return []
    }
    throw error
  }
  const db = await createClient()

  const { data, error } = await db
    .from('report_snapshots')
    .select('id, template_id, audience_type, status, generated_at, released_at, error_message, pdf_url, pdf_status, pdf_error_message, narrative_mode, report_templates(name)')
    .eq('participant_session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) {
    throwActionError('getSessionSnapshots', 'Unable to load snapshots.', error)
  }

  const snapshotRows = (data ?? []) as SnapshotLookupRow[]

  return snapshotRows.map((r) => {
    const tpl = getEmbeddedRecord(r.report_templates)
    return {
      id: String(r.id),
      templateId: String(r.template_id),
      templateName: tpl?.name ? String(tpl.name) : undefined,
      audienceType: String(r.audience_type),
      status: String(r.status),
      generatedAt: r.generated_at ?? undefined,
      releasedAt: r.released_at ?? undefined,
      errorMessage: r.error_message ?? undefined,
      pdfUrl: r.pdf_url ?? undefined,
      pdfStatus: r.pdf_status ?? undefined,
      pdfErrorMessage: r.pdf_error_message ?? undefined,
      narrativeMode: String(r.narrative_mode ?? 'derived'),
    }
  })
}

export type CampaignSessionRow = {
  id: string
  assessmentId: string
  assessmentTitle: string
  participantId: string
  participantName: string
  participantEmail: string
  status: string
  processingStatus: ParticipantSessionProcessingStatus
  processingError?: string
  startedAt?: string
  completedAt?: string
  scoreCount: number
  attemptNumber: number
}

export async function getCampaignSessions(campaignId: string): Promise<CampaignSessionRow[]> {
  // Fail closed: verify the caller can access this specific campaign before
  // returning any session data. This replaces the previous post-filter which
  // only checked clientIds (not partnerIds) and was not fail-closed.
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
      status,
      processing_status,
      processing_error,
      started_at,
      completed_at,
      campaign_participant_id,
      assessments(title),
      campaign_participants!inner(
        id,
        email,
        first_name,
        last_name,
        campaign_id,
        campaigns!inner(client_id)
      ),
      participant_scores(id)
    `)
    .eq('campaign_participants.campaign_id', campaignId)
    .order('started_at', { ascending: false, nullsFirst: false })

  if (error) {
    throwActionError('getCampaignSessions', 'Unable to load sessions.', error)
  }

  return mapCampaignSessionRows(data ?? [])
}

function mapCampaignSessionRows(data: CampaignSessionLookupRow[]): CampaignSessionRow[] {
  // Group by (participantId, assessmentId) to compute attempt ordinal
  const ordinalMap = new Map<string, number[]>()
  for (const row of data) {
    const cp = Array.isArray(row.campaign_participants) ? row.campaign_participants[0] : row.campaign_participants
    const key = `${cp?.id}:${row.assessment_id}`
    const list = ordinalMap.get(key) ?? []
    list.push(new Date(row.started_at ?? 0).getTime())
    ordinalMap.set(key, list)
  }
  for (const list of ordinalMap.values()) list.sort((a, b) => a - b)

  return data.map((row) => {
    const cp = Array.isArray(row.campaign_participants) ? row.campaign_participants[0] : row.campaign_participants
    const assessment = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments
    const participantName =
      `${cp?.first_name ?? ""} ${cp?.last_name ?? ""}`.trim() || String(cp?.email ?? "")
    const key = `${cp?.id}:${row.assessment_id}`
    const list = ordinalMap.get(key) ?? []
    const ts = new Date(row.started_at ?? 0).getTime()
    const attemptNumber = list.indexOf(ts) + 1 || 1

    return {
      id: String(row.id),
      assessmentId: String(row.assessment_id),
      assessmentTitle: String(assessment?.title ?? "Unknown"),
      participantId: String(cp?.id ?? ""),
      participantName,
      participantEmail: String(cp?.email ?? ""),
      status: String(row.status),
      processingStatus: (row.processing_status ?? 'idle') as ParticipantSessionProcessingStatus,
      processingError: row.processing_error ?? undefined,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      scoreCount: Array.isArray(row.participant_scores) ? row.participant_scores.length : 0,
      attemptNumber,
    }
  })
}
