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
import { logActionError } from '@/lib/security/action-errors'
import {
  getParticipantById,
  listParticipants as dalListParticipants,
  listUniqueParticipants as dalListUniqueParticipants,
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

  return dalListParticipants(db, {
    scopedCampaignIds,
    status: filters?.status,
    search: filters?.search,
    offset,
    perPage,
  })
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

  return dalListUniqueParticipants(db, {
    scopedCampaignIds,
    status: filters?.status,
    search: filters?.search,
    offset,
    perPage,
  })
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
