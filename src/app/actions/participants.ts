'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  AuthorizationError,
  canManageCampaign,
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
import {
  getParticipantById,
  getParticipantSessions as dalGetParticipantSessions,
  getParticipantActivity as dalGetParticipantActivity,
  getParticipantResponses as dalGetParticipantResponses,
} from '@/lib/dal/participants'
import { postgresUuid } from '@/lib/validations/uuid'
import {
  getParticipantsFiltersSchema,
  getUniqueParticipantsFiltersSchema,
  bulkParticipantIdsSchema,
  bulkUpdateParticipantStatusSchema,
} from '@/lib/validations/participants'
import type {
  CampaignParticipant,
  CampaignParticipantStatus,
  ParticipantSessionProcessingStatus,
} from '@/types/database'

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

export type UniqueParticipant = {
  /** ID of the most recent campaign_participants record for this email */
  id: string
  email: string
  firstName?: string
  lastName?: string
  /** Total campaign_participants rows for this email */
  sessionCount: number
  /** Status from the most recent record */
  latestStatus: CampaignParticipantStatus
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
  processingStatus: ParticipantSessionProcessingStatus
  processingError?: string
  startedAt?: string
  completedAt?: string
  processedAt?: string
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
    responseValue?: number
    responseTimeMs?: number
    displayOrder: number
  }[]
}

type UniqueParticipantLookupRow = Record<string, unknown> & {
  email: string
  invited_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  created_at?: string | null
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
  const parsed = getParticipantsFiltersSchema.safeParse(filters ?? {})
  if (!parsed.success) return { data: [], total: 0 }
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

  // Build query — inner join + deleted_at filter excludes participants whose
  // campaign has been soft-deleted (those rows would 404 on detail since
  // requireCampaignAccess rejects deleted campaigns).
  let query = db
    .from('campaign_participants')
    .select(`
      *,
      campaigns!inner(title, slug, deleted_at),
      participant_sessions(id, status)
    `, { count: 'exact' })
    .is('deleted_at', null)
    .is('campaigns.deleted_at', null)

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

export async function getUniqueParticipants(filters?: {
  status?: CampaignParticipantStatus
  search?: string
  page?: number
  perPage?: number
}): Promise<{ data: UniqueParticipant[]; total: number }> {
  const parsed = getUniqueParticipantsFiltersSchema.safeParse(filters ?? {})
  if (!parsed.success) return { data: [], total: 0 }
  const scope = await resolveAuthorizedScope()
  const db = await createClient()
  const page = filters?.page ?? 1
  const perPage = filters?.perPage ?? 50
  const offset = (page - 1) * perPage
  let scopedCampaignIds: string[] | null = null

  if (!scope.isPlatformAdmin) {
    scopedCampaignIds = await getAccessibleCampaignIds(scope)
    if (!scopedCampaignIds || scopedCampaignIds.length === 0) {
      return { data: [], total: 0 }
    }
  }

  // Use RPC or raw query to group by email with proper pagination.
  // Supabase JS client doesn't support GROUP BY, so we use two queries:
  // 1) Get all matching rows (scoped)
  // 2) Deduplicate in JS (acceptable because campaign_participants is bounded per-scope)

  // Inner join + deleted_at filter excludes participants whose campaign has
  // been soft-deleted; those rows would 404 on the detail page.
  let query = db
    .from('campaign_participants')
    .select('*, campaigns!inner(deleted_at)', { count: 'exact' })
    .is('deleted_at', null)
    .is('campaigns.deleted_at', null)
    .order('created_at', { ascending: false })

  if (scopedCampaignIds && scopedCampaignIds.length === 1) {
    query = query.eq('campaign_id', scopedCampaignIds[0])
  } else if (scopedCampaignIds && scopedCampaignIds.length > 1) {
    query = query.in('campaign_id', scopedCampaignIds)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.search) {
    query = query.or(
      `email.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`
    )
  }

  const { data: rows, error } = await query

  if (error) {
    throwActionError('getUniqueParticipants', 'Unable to load participants.', error)
  }

  // Group by email — keep the most recent record per email
  const byEmail = new Map<string, { latest: UniqueParticipantLookupRow; count: number }>()
  for (const row of rows ?? []) {
    const participantRow = row as UniqueParticipantLookupRow
    const email = participantRow.email.toLowerCase()
    const existing = byEmail.get(email)
    if (!existing) {
      byEmail.set(email, { latest: participantRow, count: 1 })
    } else {
      existing.count++
      // rows are ordered by created_at desc, so first seen is most recent
    }
  }

  const allUnique = Array.from(byEmail.values())
  const total = allUnique.length
  const pageSlice = allUnique.slice(offset, offset + perPage)

  const data: UniqueParticipant[] = pageSlice.map(({ latest, count }) => {
    const mapped = mapCampaignParticipantRow(latest)
    const timestamps = [
      latest.invited_at,
      latest.started_at,
      latest.completed_at,
    ].filter(Boolean)

    return {
      id: mapped.id,
      email: mapped.email,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      sessionCount: count,
      latestStatus: mapped.status,
      lastActivity: timestamps.length > 0
        ? (timestamps.sort().reverse()[0] ?? undefined)
        : (latest.created_at ?? undefined),
    }
  })

  return { data, total }
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function getParticipant(id: string): Promise<ParticipantDetail | null> {
  if (!postgresUuid().safeParse(id).success) return null
  let access: Awaited<ReturnType<typeof requireParticipantAccess>>
  try {
    access = await requireParticipantAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null
    }
    throw error
  }

  // Access verified above; the DAL read uses the admin client so platform-admin
  // / support sessions aren't blocked by RLS.
  const participant = await getParticipantById(id)
  if (!participant) return null

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
  if (!postgresUuid().safeParse(participantId).success) return []
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
  const sessions = await dalGetParticipantSessions(db, participantId)

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
  if (!postgresUuid().safeParse(participantId).success) return []
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
  const events = await dalGetParticipantActivity(db, participantId)

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
  if (!postgresUuid().safeParse(sessionId).success) return []
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
  const groups = await dalGetParticipantResponses(db, sessionId)

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

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------

async function assertCanManageParticipants(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  const db = createAdminClient()
  const { data: rows, error } = await db
    .from('campaign_participants')
    .select('id, campaigns(id, client_id, partner_id)')
    .in('id', ids)
  if (error) throw new Error(error.message)
  if (!rows || rows.length !== ids.length) {
    throw new Error('One or more participants not found.')
  }

  for (const row of rows) {
    const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns
    if (
      !canManageCampaign(
        scope,
        campaign?.partner_id ?? null,
        campaign?.client_id ?? null,
      )
    ) {
      throw new Error('Not authorized to manage one or more participants.')
    }
  }
}

export async function bulkDeleteParticipants(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const parsed = bulkParticipantIdsSchema.safeParse({ ids })
  if (!parsed.success) throw new Error('Invalid input')
  await assertCanManageParticipants(ids)
  const db = createAdminClient()
  const { error } = await db
    .from('campaign_participants')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/participants')
  revalidatePath('/client/participants')
  revalidatePath('/partner/participants')
}

export async function bulkUpdateParticipantStatus(
  ids: string[],
  status: CampaignParticipantStatus
): Promise<void> {
  if (ids.length === 0) return
  const parsed = bulkUpdateParticipantStatusSchema.safeParse({ ids, status })
  if (!parsed.success) throw new Error('Invalid input')
  await assertCanManageParticipants(ids)
  const db = createAdminClient()
  const { error } = await db
    .from('campaign_participants')
    .update({ status })
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/participants')
  revalidatePath('/client/participants')
  revalidatePath('/partner/participants')
}
