'use server'

import { createClient } from '@/lib/supabase/server'
import {
  AuthorizationError,
  getAccessibleCampaignIds,
  requireCampaignAccess,
  requireParticipantAccess,
  requireSessionAccess,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import {
  logSupportSessionDataAccess,
} from '@/lib/auth/support-sessions'
import { logActionError, throwActionError } from '@/lib/security/action-errors'
import { mapCampaignParticipantRow } from '@/lib/supabase/mappers'
import type { CampaignParticipant, CampaignParticipantStatus } from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParticipantWithMeta = CampaignParticipant & {
  campaignTitle: string
  campaignSlug: string
  sessionCount: number
  completedSessionCount: number
  lastActivity?: string
}

export type ParticipantDetail = CampaignParticipant & {
  campaignTitle: string
  campaignSlug: string
  clientName?: string
}

export type ParticipantSession = {
  id: string
  assessmentId: string
  assessmentTitle: string
  status: string
  startedAt?: string
  completedAt?: string
  scores: ParticipantSessionScore[]
}

export type ParticipantSessionScore = {
  factorId: string
  factorName: string
  rawScore: number
  scaledScore: number
  percentile?: number
  scoringMethod: string
  itemsUsed: number
}

export type ActivityEvent = {
  type: 'invited' | 'registered' | 'started' | 'session_started' | 'session_completed' | 'completed'
  timestamp: string
  label: string
  detail?: string
}

export type ParticipantResponseGroup = {
  sectionId: string
  sectionTitle: string
  displayOrder: number
  items: {
    itemId: string
    stem: string
    responseValue: number
    responseTimeMs?: number
    displayOrder: number
  }[]
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function getParticipants(filters?: {
  status?: CampaignParticipantStatus
  campaignId?: string
  search?: string
  page?: number
  perPage?: number
}): Promise<{ data: ParticipantWithMeta[]; total: number }> {
  const scope = await resolveAuthorizedScope()
  const db = await createClient()
  const page = filters?.page ?? 1
  const perPage = filters?.perPage ?? 50
  const offset = (page - 1) * perPage
  let scopedCampaignIds: string[] | null = null

  if (filters?.campaignId) {
    try {
      await requireCampaignAccess(filters.campaignId)
      scopedCampaignIds = [filters.campaignId]
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return { data: [], total: 0 }
      }
      throw error
    }
  } else if (!scope.isPlatformAdmin) {
    scopedCampaignIds = await getAccessibleCampaignIds(scope)
    if (!scopedCampaignIds || scopedCampaignIds.length === 0) {
      return { data: [], total: 0 }
    }
  }

  // Build query
  let query = db
    .from('campaign_participants')
    .select(`
      *,
      campaigns!inner(title, slug),
      participant_sessions(id, status)
    `, { count: 'exact' })
    .is('deleted_at', null)

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (scopedCampaignIds?.length === 1) {
    query = query.eq('campaign_id', scopedCampaignIds[0])
  } else if (scopedCampaignIds && scopedCampaignIds.length > 1) {
    query = query.in('campaign_id', scopedCampaignIds)
  }
  if (filters?.search) {
    query = query.or(`email.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`)
  }

  query = query.order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  const { data: rows, error, count } = await query

  if (error) {
    throwActionError('getParticipants', 'Unable to load participants.', error)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const participants: ParticipantWithMeta[] = (rows ?? []).map((row: any) => {
    const sessions = row.participant_sessions ?? []
    const completedSessions = sessions.filter((s: { status: string }) => s.status === 'completed')

    // Determine last activity from participant timestamps
    const timestamps = [
      row.invited_at,
      row.started_at,
      row.completed_at,
    ].filter(Boolean)

    return {
      ...mapCampaignParticipantRow(row),
      campaignTitle: row.campaigns?.title ?? 'Unknown',
      campaignSlug: row.campaigns?.slug ?? '',
      sessionCount: sessions.length,
      completedSessionCount: completedSessions.length,
      lastActivity: timestamps.length > 0
        ? timestamps.sort().reverse()[0]
        : row.created_at,
    }
  })

  return { data: participants, total: count ?? 0 }
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getParticipant(id: string): Promise<ParticipantDetail | null> {
  let access: Awaited<ReturnType<typeof requireParticipantAccess>>
  try {
    access = await requireParticipantAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null
    }
    throw error
  }

  const db = await createClient()

  const { data: row, error } = await db
    .from('campaign_participants')
    .select(`
      *,
      campaigns(title, slug, client_id, clients(name))
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !row) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = row as any
  const participant = {
    ...mapCampaignParticipantRow(r),
    campaignTitle: r.campaigns?.title ?? 'Unknown',
    campaignSlug: r.campaigns?.slug ?? '',
    clientName: r.campaigns?.clients?.name ?? undefined,
  }

  try {
    await logSupportSessionDataAccess({
      scope: access.scope,
      resourceType: 'campaign_participants',
      resourceId: id,
      partnerId: access.partnerId,
      clientId: access.clientId,
      metadata: { action: 'detail' },
    })
  } catch (error) {
    logActionError('getParticipant.audit', error)
  }

  return participant
}

// ---------------------------------------------------------------------------
// Sessions with scores
// ---------------------------------------------------------------------------

export async function getParticipantSessions(participantId: string): Promise<ParticipantSession[]> {
  let access: Awaited<ReturnType<typeof requireParticipantAccess>>
  try {
    access = await requireParticipantAccess(participantId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return []
    }
    throw error
  }

  const db = await createClient()

  const { data: sessionRows, error } = await db
    .from('participant_sessions')
    .select(`
      id,
      assessment_id,
      status,
      started_at,
      completed_at,
      assessments(title),
      participant_scores(
        factor_id,
        raw_score,
        scaled_score,
        percentile,
        scoring_method,
        factors(name)
      )
    `)
    .eq('campaign_participant_id', participantId)
    .order('created_at', { ascending: true })

  if (error) {
    throwActionError(
      'getParticipantSessions',
      'Unable to load participant sessions.',
      error
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions = (sessionRows ?? []).map((s: any) => ({
    id: s.id,
    assessmentId: s.assessment_id,
    assessmentTitle: s.assessments?.title ?? 'Untitled',
    status: s.status,
    startedAt: s.started_at ?? undefined,
    completedAt: s.completed_at ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scores: (s.participant_scores ?? []).map((sc: any) => ({
      factorId: sc.factor_id,
      factorName: sc.factors?.name ?? sc.factor_id,
      rawScore: Number(sc.raw_score),
      scaledScore: Number(sc.scaled_score),
      percentile: sc.percentile != null ? Number(sc.percentile) : undefined,
      scoringMethod: sc.scoring_method,
      itemsUsed: 0,
    })),
  }))

  try {
    await logSupportSessionDataAccess({
      scope: access.scope,
      resourceType: 'participant_sessions',
      resourceId: participantId,
      partnerId: access.partnerId,
      clientId: access.clientId,
      metadata: { action: 'list_for_participant' },
    })
  } catch (error) {
    logActionError('getParticipantSessions.audit', error)
  }

  return sessions
}

// ---------------------------------------------------------------------------
// Activity timeline
// ---------------------------------------------------------------------------

export async function getParticipantActivity(participantId: string): Promise<ActivityEvent[]> {
  let access: Awaited<ReturnType<typeof requireParticipantAccess>>
  try {
    access = await requireParticipantAccess(participantId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return []
    }
    throw error
  }

  const db = await createClient()

  // Get participant record
  const { data: participant } = await db
    .from('campaign_participants')
    .select('invited_at, started_at, completed_at, campaigns(title)')
    .eq('id', participantId)
    .single()

  if (!participant) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = participant as any
  const events: ActivityEvent[] = []

  if (p.invited_at) {
    events.push({
      type: 'invited',
      timestamp: p.invited_at,
      label: 'Invited to campaign',
      detail: p.campaigns?.title,
    })
  }

  if (p.started_at) {
    events.push({
      type: 'started',
      timestamp: p.started_at,
      label: 'Started assessment',
    })
  }

  // Get session-level events
  const { data: sessions } = await db
    .from('participant_sessions')
    .select('id, started_at, completed_at, assessments(title)')
    .eq('campaign_participant_id', participantId)
    .order('started_at', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (sessions ?? []) as any[]) {
    if (s.started_at) {
      events.push({
        type: 'session_started',
        timestamp: s.started_at,
        label: `Started ${s.assessments?.title ?? 'assessment'}`,
      })
    }
    if (s.completed_at) {
      events.push({
        type: 'session_completed',
        timestamp: s.completed_at,
        label: `Completed ${s.assessments?.title ?? 'assessment'}`,
      })
    }
  }

  if (p.completed_at) {
    events.push({
      type: 'completed',
      timestamp: p.completed_at,
      label: 'Completed all assessments',
    })
  }

  // Sort by timestamp ascending
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  try {
    await logSupportSessionDataAccess({
      scope: access.scope,
      resourceType: 'campaign_participants',
      resourceId: participantId,
      partnerId: access.partnerId,
      clientId: access.clientId,
      metadata: { action: 'activity' },
    })
  } catch (error) {
    logActionError('getParticipantActivity.audit', error)
  }

  return events
}

// ---------------------------------------------------------------------------
// Item-level responses
// ---------------------------------------------------------------------------

export async function getParticipantResponses(sessionId: string): Promise<ParticipantResponseGroup[]> {
  let access: Awaited<ReturnType<typeof requireSessionAccess>>
  try {
    access = await requireSessionAccess(sessionId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return []
    }
    throw error
  }

  const db = await createClient()

  // Get session's assessment
  const { data: session } = await db
    .from('participant_sessions')
    .select('assessment_id')
    .eq('id', sessionId)
    .single()

  if (!session) return []

  // Get sections with items
  const { data: sections } = await db
    .from('assessment_sections')
    .select(`
      id, title, display_order,
      assessment_section_items(
        item_id,
        display_order,
        items(id, stem)
      )
    `)
    .eq('assessment_id', session.assessment_id)
    .order('display_order', { ascending: true })

  // Get all responses for this session
  const { data: responses } = await db
    .from('participant_responses')
    .select('item_id, response_value, response_time_ms')
    .eq('session_id', sessionId)

  const responseMap = new Map<string, { value: number; timeMs?: number }>()
  for (const r of responses ?? []) {
    responseMap.set(r.item_id, {
      value: Number(r.response_value),
      timeMs: r.response_time_ms ?? undefined,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups = (sections ?? []).map((s: any) => ({
    sectionId: s.id,
    sectionTitle: s.title,
    displayOrder: s.display_order,
    items: (s.assessment_section_items ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.display_order - b.display_order)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((si: any) => {
        const resp = responseMap.get(si.item_id ?? si.items?.id)
        return {
          itemId: si.items?.id ?? si.item_id,
          stem: si.items?.stem ?? '',
          responseValue: resp?.value ?? 0,
          responseTimeMs: resp?.timeMs,
          displayOrder: si.display_order,
        }
      }),
  }))

  try {
    await logSupportSessionDataAccess({
      scope: access.scope,
      resourceType: 'participant_responses',
      resourceId: sessionId,
      partnerId: access.partnerId,
      clientId: access.clientId,
      metadata: { action: 'responses' },
    })
  } catch (error) {
    logActionError('getParticipantResponses.audit', error)
  }

  return groups
}
