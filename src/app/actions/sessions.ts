'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveAuthorizedScope, AuthorizationError } from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'

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
  startedAt?: string
  completedAt?: string
  durationMinutes?: number
  responseCount: number
  scores: SessionDetailScore[]
  snapshots: SessionDetailSnapshot[]
  attemptNumber: number
  totalAttempts: number
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

  const cp = (data as any).campaign_participants
  const campaign = Array.isArray(cp) ? cp[0]?.campaigns : cp?.campaigns
  const clientId = (Array.isArray(campaign) ? campaign[0]?.client_id : campaign?.client_id) as string | undefined

  if (!clientId || !scope.clientIds.includes(clientId)) {
    throw new AuthorizationError('Session not accessible in current scope.')
  }

  return sessionId
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  await assertSessionAccess(sessionId)
  const db = await createClient()

  const { data: session, error } = await db
    .from('participant_sessions')
    .select(`
      id,
      assessment_id,
      status,
      started_at,
      completed_at,
      campaign_participant_id,
      assessments(title),
      campaign_participants(
        id,
        email,
        first_name,
        last_name,
        campaign_id,
        campaigns(title, client_id, clients(name))
      ),
      participant_scores(
        id,
        factor_id,
        raw_score,
        scaled_score,
        percentile,
        confidence_lower,
        confidence_upper,
        scoring_method,
        items_used,
        factors(name)
      )
    `)
    .eq('id', sessionId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throwActionError('getSessionDetail', 'Unable to load session.', error)
  }
  if (!session) return null

  const cp = (session as any).campaign_participants
  const cpRecord = Array.isArray(cp) ? cp[0] : cp
  const campaignRecord = Array.isArray(cpRecord?.campaigns) ? cpRecord.campaigns[0] : cpRecord?.campaigns
  const clientRecord = Array.isArray(campaignRecord?.clients) ? campaignRecord.clients[0] : campaignRecord?.clients
  const assessmentRecord = Array.isArray((session as any).assessments)
    ? (session as any).assessments[0]
    : (session as any).assessments

  // Count item responses for this session
  const { count: responseCount } = await db
    .from('participant_responses')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  // Attempt ordinal: rank this session among all sessions for same participant + assessment
  const { data: attemptSessions } = await db
    .from('participant_sessions')
    .select('id, started_at')
    .eq('campaign_participant_id', cpRecord?.id)
    .eq('assessment_id', (session as any).assessment_id)
    .order('started_at', { ascending: true, nullsFirst: false })

  const attemptRows = attemptSessions ?? []
  const attemptNumber = attemptRows.findIndex((r: any) => r.id === sessionId) + 1 || 1
  const totalAttempts = attemptRows.length || 1

  // Snapshots for this session
  const { data: snapshotRows } = await db
    .from('report_snapshots')
    .select('id, template_id, audience_type, status, generated_at, released_at, error_message, pdf_url, narrative_mode, report_templates(name)')
    .eq('participant_session_id', sessionId)
    .order('created_at', { ascending: false })

  const scores: SessionDetailScore[] = (((session as any).participant_scores ?? []) as any[]).map((s) => {
    const factor = Array.isArray(s.factors) ? s.factors[0] : s.factors
    return {
      factorId: String(s.factor_id),
      factorName: String(factor?.name ?? 'Unknown'),
      rawScore: Number(s.raw_score ?? 0),
      scaledScore: Number(s.scaled_score ?? 0),
      percentile: s.percentile != null ? Number(s.percentile) : undefined,
      confidenceLower: s.confidence_lower != null ? Number(s.confidence_lower) : undefined,
      confidenceUpper: s.confidence_upper != null ? Number(s.confidence_upper) : undefined,
      scoringMethod: String(s.scoring_method ?? 'ctt'),
      itemsUsed: Number(s.items_used ?? 0),
    }
  })

  const snapshots: SessionDetailSnapshot[] = ((snapshotRows ?? []) as any[]).map((r) => {
    const tpl = Array.isArray(r.report_templates) ? r.report_templates[0] : r.report_templates
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
      narrativeMode: String(r.narrative_mode ?? 'derived'),
    }
  })

  const startedAt = (session as any).started_at ?? undefined
  const completedAt = (session as any).completed_at ?? undefined
  const durationMinutes = (startedAt && completedAt)
    ? Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000))
    : undefined

  const firstName = cpRecord?.first_name ?? ''
  const lastName = cpRecord?.last_name ?? ''
  const participantName = `${firstName} ${lastName}`.trim() || (cpRecord?.email ?? 'Unknown')

  return {
    id: String((session as any).id),
    assessmentId: String((session as any).assessment_id),
    assessmentTitle: String(assessmentRecord?.title ?? 'Unknown'),
    campaignId: String(campaignRecord?.id ?? cpRecord?.campaign_id ?? ''),
    campaignTitle: String(campaignRecord?.title ?? ''),
    clientId: clientRecord?.id ? String(clientRecord.id) : undefined,
    clientName: clientRecord?.name ? String(clientRecord.name) : undefined,
    participantId: String(cpRecord?.id ?? ''),
    participantName,
    participantEmail: String(cpRecord?.email ?? ''),
    status: String((session as any).status),
    startedAt,
    completedAt,
    durationMinutes,
    responseCount: responseCount ?? 0,
    scores,
    snapshots,
    attemptNumber,
    totalAttempts,
  }
}

export async function getSessionSnapshots(sessionId: string): Promise<SessionDetailSnapshot[]> {
  await assertSessionAccess(sessionId)
  const db = await createClient()

  const { data, error } = await db
    .from('report_snapshots')
    .select('id, template_id, audience_type, status, generated_at, released_at, error_message, pdf_url, narrative_mode, report_templates(name)')
    .eq('participant_session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) {
    throwActionError('getSessionSnapshots', 'Unable to load snapshots.', error)
  }

  return ((data ?? []) as any[]).map((r) => {
    const tpl = Array.isArray(r.report_templates) ? r.report_templates[0] : r.report_templates
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
  startedAt?: string
  completedAt?: string
  scoreCount: number
  attemptNumber: number
}

export async function getCampaignSessions(campaignId: string): Promise<CampaignSessionRow[]> {
  const scope = await resolveAuthorizedScope()

  const db = await createClient()
  const { data, error } = await db
    .from('participant_sessions')
    .select(`
      id,
      assessment_id,
      status,
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

  const rows = data ?? []

  // Client scope filter (platform admin sees all)
  const filtered = (scope.isPlatformAdmin || scope.isLocalDevelopmentBypass)
    ? rows
    : rows.filter((row: any) => {
        const cp = Array.isArray(row.campaign_participants) ? row.campaign_participants[0] : row.campaign_participants
        const campaign = Array.isArray(cp?.campaigns) ? cp.campaigns[0] : cp?.campaigns
        const clientId = campaign?.client_id
        return clientId && scope.clientIds.includes(clientId)
      })

  return mapCampaignSessionRows(filtered)
}

function mapCampaignSessionRows(data: any[]): CampaignSessionRow[] {
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
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      scoreCount: Array.isArray(row.participant_scores) ? row.participant_scores.length : 0,
      attemptNumber,
    }
  })
}
