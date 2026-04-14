'use server'

import { cache } from 'react'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  AuthorizationError,
  canAccessClient,
  getAccessibleCampaignIds,
  requireCampaignAccess,
  requireClientAccess,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { logActionError, throwActionError } from '@/lib/security/action-errors'
import {
  mapCampaignRow,
  mapCampaignAssessmentRow,
  mapCampaignParticipantRow,
  mapCampaignAccessLinkRow,
} from '@/lib/supabase/mappers'
import { campaignSchema, inviteParticipantSchema, accessLinkSchema } from '@/lib/validations/campaigns'
import { checkQuotaAvailability } from '@/app/actions/client-entitlements'
import type { Campaign, CampaignAssessment, CampaignParticipant, CampaignAccessLink } from '@/types/database'

// ---------------------------------------------------------------------------
// Meta types
// ---------------------------------------------------------------------------

export type CampaignWithMeta = Campaign & {
  assessmentCount: number
  participantCount: number
  completedCount: number
  clientName?: string
}

export type CampaignDetail = Campaign & {
  assessments: (CampaignAssessment & { assessmentTitle: string; assessmentStatus: string; minCustomFactors: number | null })[]
  participants: CampaignParticipant[]
  accessLinks: CampaignAccessLink[]
  clientName?: string
}

export type BulkInviteRowError = {
  row: number
  email?: string
  message: string
}

export type BulkInvitePendingExisting = {
  row: number
  email: string
  firstName?: string
  lastName?: string
}

export type BulkInviteEmailFailure = {
  participantId: string
  email: string
  error: string
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function getClientPartnerId(clientId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('clients')
    .select('id, partner_id')
    .eq('id', clientId)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    throw new AuthorizationError('Selected client is not available.')
  }

  return data.partner_id ? String(data.partner_id) : null
}

export async function getCampaigns(options?: { clientId?: string }): Promise<CampaignWithMeta[]> {
  const scope = await resolveAuthorizedScope()
  const db = await createClient()

  // Query the campaigns_with_counts view which inlines participant_count,
  // completed_count, and assessment_count via correlated subqueries. This
  // eliminates the previous sequential completed-count round-trip while
  // preserving RLS (view is security_invoker=true).
  let query = db
    .from('campaigns_with_counts')
    .select('*, clients(name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // Determine effective client filter:
  // 1. Explicit clientId takes priority (client portal pages pass this)
  // 2. On client surface without explicit clientId, derive from active context
  //    (defense-in-depth: prevents data leakage if caller forgets to pass clientId)
  // 3. On admin surface as platform admin, no filter (see all)
  // 4. Non-admin users get scoped by accessible campaigns
  const effectiveClientId = options?.clientId ??
    (scope.requestSurface === 'client' ? (scope.activeContext?.tenantId ?? null) : null)

  if (effectiveClientId) {
    query = query.eq('client_id', effectiveClientId)
  } else if (!scope.isPlatformAdmin) {
    const campaignIds = await getAccessibleCampaignIds(scope)
    if (!campaignIds || campaignIds.length === 0) {
      return []
    }
    query = query.in('id', campaignIds)
  }

  const { data, error } = await query

  if (error) {
    throwActionError('getCampaigns', 'Unable to load campaigns.', error)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...mapCampaignRow(row),
    assessmentCount: row.assessment_count ?? 0,
    participantCount: row.participant_count ?? 0,
    completedCount: row.completed_count ?? 0,
    clientName: row.clients?.name ?? undefined,
  }))
}

async function getCampaignByIdImpl(id: string): Promise<CampaignDetail | null> {
  try {
    await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null
    }
    throw error
  }

  const db = await createClient()
  const { data, error } = await db
    .from('campaigns')
    .select('*, clients(name)')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any

  // Load assessments, participants, and access links in parallel —
  // they are independent and previously ran sequentially.
  const [assessmentResult, participantResult, linkResult] = await Promise.all([
    db
      .from('campaign_assessments')
      .select('*, assessments(title, status, min_custom_factors)')
      .eq('campaign_id', id)
      .is('deleted_at', null)
      .order('display_order', { ascending: true }),
    db
      .from('campaign_participants')
      .select('*, participant_sessions(id, status)')
      .eq('campaign_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    db
      .from('campaign_access_links')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false }),
  ])

  const assessmentRows = assessmentResult.data
  const participantRows = participantResult.data
  const linkRows = linkResult.data

  return {
    ...mapCampaignRow(row),
    clientName: row.clients?.name ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assessments: (assessmentRows ?? []).map((r: any) => ({
      ...mapCampaignAssessmentRow(r),
      assessmentTitle: r.assessments?.title ?? 'Untitled',
      assessmentStatus: r.assessments?.status ?? 'draft',
      minCustomFactors: r.assessments?.min_custom_factors ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participants: (participantRows ?? []).map((r: any) => ({
      ...mapCampaignParticipantRow(r),
      participantSessions: (r.participant_sessions ?? []).map((s: any) => ({
        id: s.id as string,
        status: s.status as string,
      })),
    })),
    accessLinks: (linkRows ?? []).map(mapCampaignAccessLinkRow),
  }
}

export const getCampaignById = cache(getCampaignByIdImpl)

// ---------------------------------------------------------------------------
// Create / Update (Zone 2 — explicit save)
// ---------------------------------------------------------------------------

export async function createCampaign(payload: Record<string, unknown>) {
  const parsed = campaignSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const scope = await resolveAuthorizedScope()
  const clientId = parsed.data.clientId || null

  if (!scope.isPlatformAdmin) {
    if (!clientId) {
      return { error: { clientId: ['Campaigns must belong to a client context'] } }
    }

    if (!canAccessClient(scope, clientId)) {
      return { error: { clientId: ['You do not have access to this client'] } }
    }
  }

  const partnerId =
    clientId
      ? await getClientPartnerId(clientId)
      : (parsed.data.partnerId || null)

  const db = createAdminClient()
  const { data: campaign, error } = await db
    .from('campaigns')
    .insert({
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      client_id: clientId,
      partner_id: partnerId,
      opens_at: parsed.data.opensAt || null,
      closes_at: parsed.data.closesAt || null,
      allow_resume: parsed.data.allowResume,
      show_progress: parsed.data.showProgress,
      randomize_assessment_order: parsed.data.randomizeAssessmentOrder,
    })
    .select('id')
    .single()

  if (error) {
    logActionError('createCampaign', error)
    return { error: { _form: ['Unable to create campaign.'] } }
  }

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'campaign.created',
    targetTable: 'campaigns',
    targetId: campaign.id,
    partnerId,
    clientId: clientId,
    metadata: {
      slug: parsed.data.slug,
      isLocalDevelopmentBypass: scope.isLocalDevelopmentBypass,
    },
  })

  revalidatePath('/campaigns')
  revalidatePath('/')
  return { success: true as const, id: campaign.id }
}

export async function updateCampaign(id: string, payload: Record<string, unknown>) {
  const parsed = campaignSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: { _form: [error.message] } }
    }
    throw error
  }

  const clientId = parsed.data.clientId || access.clientId || null

  if (!access.scope.isPlatformAdmin) {
    if (!clientId || !canAccessClient(access.scope, clientId)) {
      return { error: { clientId: ['You do not have access to this client'] } }
    }
  }

  const partnerId =
    clientId
      ? await getClientPartnerId(clientId)
      : (parsed.data.partnerId || access.partnerId || null)

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      client_id: clientId,
      partner_id: partnerId,
      opens_at: parsed.data.opensAt || null,
      closes_at: parsed.data.closesAt || null,
      allow_resume: parsed.data.allowResume,
      show_progress: parsed.data.showProgress,
      randomize_assessment_order: parsed.data.randomizeAssessmentOrder,
    })
    .eq('id', id)

  if (error) {
    logActionError('updateCampaign', error)
    return { error: { _form: ['Unable to update campaign.'] } }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.updated',
    targetTable: 'campaigns',
    targetId: id,
    partnerId,
    clientId: clientId,
    metadata: {
      slug: parsed.data.slug,
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
  revalidatePath(`/campaigns/${id}/settings`)
  revalidatePath(`/client/campaigns/${id}/settings`)
  revalidatePath('/')
  return { success: true as const, id }
}

// ---------------------------------------------------------------------------
// Auto-save (Zone 3 — description only)
// ---------------------------------------------------------------------------

export async function updateCampaignField(id: string, field: string, value: string) {
  if (field !== 'description') {
    return { error: 'Only description can be auto-saved' }
  }

  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ [field]: value || null })
    .eq('id', id)

  if (error) {
    logActionError('updateCampaignField', error)
    return { error: 'Unable to save field.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.description.updated',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: {
      field,
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
  revalidatePath(`/campaigns/${id}/settings`)
  revalidatePath(`/client/campaigns/${id}/settings`)
  return { success: true as const }
}

// ---------------------------------------------------------------------------
// Soft delete / restore
// ---------------------------------------------------------------------------

export async function deleteCampaign(id: string) {
  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    logActionError('deleteCampaign', error)
    return { error: 'Unable to delete campaign.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.deleted',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: {
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidatePath('/campaigns')
  revalidatePath('/')
}

export async function restoreCampaign(id: string) {
  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) {
    logActionError('restoreCampaign', error)
    return { error: 'Unable to restore campaign.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.restored',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: {
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidatePath('/campaigns')
  revalidatePath('/')
}

// ---------------------------------------------------------------------------
// Status transitions (Zone 1 — immediate)
// ---------------------------------------------------------------------------

export async function activateCampaign(id: string) {
  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()

  // Pre-launch readiness gate: verify campaign has linked assessments and
  // either participants or access links
  const { data: linkedAssessments } = await db
    .from('campaign_assessments')
    .select('id')
    .eq('campaign_id', id)
    .is('deleted_at', null)
    .limit(1)

  if (!linkedAssessments || linkedAssessments.length === 0) {
    return { error: 'Campaign must have at least one assessment before activation.' }
  }

  const { count: participantCount } = await db
    .from('campaign_participants')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', id)
    .is('deleted_at', null)

  const { count: linkCount } = await db
    .from('campaign_access_links')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', id)
    .eq('is_active', true)

  if ((!participantCount || participantCount === 0) && (!linkCount || linkCount === 0)) {
    return { error: 'Campaign must have at least one participant or active access link before activation.' }
  }

  const { error } = await db
    .from('campaigns')
    .update({ status: 'active' })
    .eq('id', id)

  if (error) {
    logActionError('activateCampaign', error)
    return { error: 'Unable to activate campaign.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.activated',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
}

export async function pauseCampaign(id: string) {
  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ status: 'paused' })
    .eq('id', id)

  if (error) {
    logActionError('pauseCampaign', error)
    return { error: 'Unable to pause campaign.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.paused',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
}

export async function closeCampaign(id: string) {
  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ status: 'closed' })
    .eq('id', id)

  if (error) {
    logActionError('closeCampaign', error)
    return { error: 'Unable to close campaign.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.closed',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
}

// ---------------------------------------------------------------------------
// Toggle switches (Zone 1 — immediate)
// ---------------------------------------------------------------------------

export async function toggleCampaignSetting(id: string, field: string, value: boolean) {
  const allowed = ['allow_resume', 'show_progress', 'randomize_assessment_order']
  if (!allowed.includes(field)) {
    return { error: `Cannot toggle ${field}` }
  }

  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ [field]: value })
    .eq('id', id)

  if (error) {
    logActionError('toggleCampaignSetting', error)
    return { error: 'Unable to update setting.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.setting.updated',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { field, value },
  })

  revalidatePath(`/campaigns/${id}`)
  revalidatePath(`/campaigns/${id}/settings`)
  revalidatePath(`/client/campaigns/${id}/settings`)
}

// ---------------------------------------------------------------------------
// Campaign Assessments
// ---------------------------------------------------------------------------

export async function addAssessmentToCampaign(campaignId: string, assessmentId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!access.scope.isPlatformAdmin && access.clientId) {
    const supabase = createAdminClient()
    const { data: assignment } = await supabase
      .from('client_assessment_assignments')
      .select('id')
      .eq('client_id', access.clientId)
      .eq('assessment_id', assessmentId)
      .eq('is_active', true)
      .maybeSingle()

    if (!assignment) {
      return { error: 'This assessment is not available for your client' }
    }
  }

  const db = createAdminClient()

  // Get max display order
  const { data: existing } = await db
    .from('campaign_assessments')
    .select('display_order')
    .eq('campaign_id', campaignId)
    .order('display_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1

  const { error } = await db
    .from('campaign_assessments')
    .insert({
      campaign_id: campaignId,
      assessment_id: assessmentId,
      display_order: nextOrder,
    })

  if (error) {
    logActionError('addAssessmentToCampaign', error)
    return { error: 'Unable to add assessment.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.assessment.added',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { assessmentId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
}

export async function removeAssessmentFromCampaign(campaignId: string, assessmentId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_assessments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('campaign_id', campaignId)
    .eq('assessment_id', assessmentId)
    .is('deleted_at', null)

  if (error) {
    logActionError('removeAssessmentFromCampaign', error)
    return { error: 'Unable to remove assessment.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.assessment.removed',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { assessmentId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
}

export async function reorderCampaignAssessments(campaignId: string, orderedIds: string[]) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await db
      .from('campaign_assessments')
      .update({ display_order: i })
      .eq('id', orderedIds[i])
      .eq('campaign_id', campaignId)

    if (error) {
      logActionError('reorderCampaignAssessments', error)
      return { error: 'Unable to reorder assessments.' }
    }
  }

  revalidatePath(`/campaigns/${campaignId}`)

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.assessments.reordered',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { orderedIds },
  })
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export async function inviteParticipant(campaignId: string, payload: Record<string, unknown>) {
  const parsed = inviteParticipantSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: { _form: [error.message] } }
    }
    throw error
  }

  // Quota check: only applies when campaign belongs to a client
  if (access.clientId) {
    const db = createAdminClient()
    const { data: campaignAssessments } = await db
      .from('campaign_assessments')
      .select('assessment_id')
      .eq('campaign_id', campaignId)

    const assessmentIds = (campaignAssessments ?? []).map((ca) => ca.assessment_id)

    if (assessmentIds.length > 0) {
      const quota = await checkQuotaAvailability(access.clientId, assessmentIds)
      if (!quota.allowed) {
        return {
          error: { _form: ['Assessment quota reached. Cannot invite more participants.'] },
        }
      }
    }
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('campaign_participants')
    .insert({
      campaign_id: campaignId,
      email: parsed.data.email,
      first_name: parsed.data.firstName ?? null,
      last_name: parsed.data.lastName ?? null,
    })
    .select('id, access_token')
    .single()

  if (error) {
    logActionError('inviteParticipant', error)
    return { error: { _form: ['Unable to invite participant.'] } }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.participant.invited',
    targetTable: 'campaign_participants',
    targetId: data.id,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId, email: parsed.data.email },
  })

  // Auto-send invite email — surface failures to the caller so the UI can
  // show a retry button. The participant row is still created even if email
  // fails, so the admin can retry without re-creating.
  let emailSent = false
  let emailError: string | undefined
  try {
    const emailResult = await sendParticipantInviteEmail(campaignId, data.id)
    if (emailResult.success) {
      emailSent = true
    } else {
      emailError = emailResult.error
    }
  } catch (err) {
    emailError = err instanceof Error ? err.message : 'Email delivery failed'
    console.warn('[inviteParticipant] Email send failed, participant created:', err)
  }

  revalidatePath(`/campaigns/${campaignId}`)
  return {
    success: true as const,
    id: data.id,
    accessToken: data.access_token,
    emailSent,
    emailError,
  }
}

/**
 * Send (or re-send) the invite email for a participant.
 * Separate from inviteParticipant so we can resend without re-creating the row.
 */
export async function sendParticipantInviteEmail(
  campaignId: string,
  participantId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message }
    }
    throw error
  }

  const db = createAdminClient()

  const [participantResult, campaignResult] = await Promise.all([
    db
      .from('campaign_participants')
      .select('email, first_name, access_token')
      .eq('id', participantId)
      .eq('campaign_id', campaignId)
      .is('deleted_at', null)
      .single(),
    db
      .from('campaigns')
      .select('title, description, client_id, partner_id')
      .eq('id', campaignId)
      .single(),
  ])

  if (participantResult.error || !participantResult.data) {
    return { success: false, error: 'Participant not found' }
  }
  if (campaignResult.error || !campaignResult.data) {
    return { success: false, error: 'Campaign not found' }
  }

  const participant = participantResult.data
  const campaign = campaignResult.data

  const assessBaseUrl = process.env.NEXT_PUBLIC_APP_URL

  try {
    const { sendEmail } = await import('@/lib/email/send')

    await sendEmail({
      type: 'assessment_invite',
      to: participant.email,
      variables: {
        participantFirstName: participant.first_name ?? '',
        campaignTitle: campaign.title,
        campaignDescription: campaign.description ?? '',
        assessmentUrl: `${assessBaseUrl}/assess/${participant.access_token}`,
        brandName: 'Trajectas',
      },
      scopeCampaignId: campaignId,
      scopeClientId: campaign.client_id,
      scopePartnerId: campaign.partner_id ?? undefined,
    })

    // Update invited_at to track last send time
    await db
      .from('campaign_participants')
      .update({ invited_at: new Date().toISOString() })
      .eq('id', participantId)

    revalidatePath(`/campaigns/${campaignId}`)
    return { success: true }
  } catch (error) {
    console.error('[email] Failed to send invite:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email delivery failed',
    }
  }
}

export async function bulkInviteParticipants(
  campaignId: string,
  participants: { email: string; firstName?: string; lastName?: string }[],
  options?: { allowExisting?: boolean },
) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const rowErrors: BulkInviteRowError[] = []
  const validatedParticipants: Array<{
    row: number
    email: string
    firstName?: string
    lastName?: string
  }> = []
  const seenEmails = new Set<string>()

  for (const [index, participant] of participants.entries()) {
    const email = participant.email.trim()
    const firstName = participant.firstName?.trim() || undefined
    const lastName = participant.lastName?.trim() || undefined
    const parsed = inviteParticipantSchema.safeParse({
      email,
      firstName,
      lastName,
    })

    if (!parsed.success) {
      rowErrors.push({
        row: index + 1,
        email: email || undefined,
        message:
          Object.values(parsed.error.flatten().fieldErrors)
            .flat()
            .join(', ') || 'Invalid row',
      })
      continue
    }

    const normalizedEmail = parsed.data.email.toLowerCase()
    if (seenEmails.has(normalizedEmail)) {
      rowErrors.push({
        row: index + 1,
        email: parsed.data.email,
        message: 'Duplicate email in upload',
      })
      continue
    }

    seenEmails.add(normalizedEmail)
    validatedParticipants.push({
      row: index + 1,
      email: parsed.data.email,
      firstName: parsed.data.firstName || undefined,
      lastName: parsed.data.lastName || undefined,
    })
  }

  const existingEmailSet = new Set<string>()
  if (validatedParticipants.length > 0) {
    const { data: existingParticipants, error: existingError } = await db
      .from('campaign_participants')
      .select('email')
      .eq('campaign_id', campaignId)
      .is('deleted_at', null)

    if (existingError) {
      logActionError('bulkInviteParticipants.existingLookup', existingError)
      return { error: 'Unable to validate existing participants.' }
    }

    for (const row of existingParticipants ?? []) {
      if (row.email) {
        existingEmailSet.add(String(row.email).toLowerCase())
      }
    }
  }

  const pendingExisting = validatedParticipants.filter((participant) =>
    existingEmailSet.has(participant.email.toLowerCase())
  )
  const rowsToInsert = validatedParticipants.filter((participant) =>
    options?.allowExisting ? true : !existingEmailSet.has(participant.email.toLowerCase())
  )

  let data: Array<{ id: string; email: string | null }> | null = null
  let error: { message?: string } | null = null

  if (rowsToInsert.length > 0) {
    const insertResult = await db
      .from('campaign_participants')
      .insert(
        rowsToInsert.map((participant) => ({
          campaign_id: campaignId,
          email: participant.email,
          first_name: participant.firstName ?? null,
          last_name: participant.lastName ?? null,
        }))
      )
      .select('id, email')

    data = insertResult.data
    error = insertResult.error
  }

  if (error) {
    logActionError('bulkInviteParticipants', error)
    return { error: 'Unable to invite participants.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.participants.bulk_invited',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: {
      inserted: data?.length ?? 0,
      existingCount: pendingExisting.length,
      errorCount: rowErrors.length,
      allowExisting: options?.allowExisting ?? false,
    },
  })

  const emailFailures: BulkInviteEmailFailure[] = []

  // Best-effort: send invite emails for all newly created participants with
  // bounded concurrency. Previously this ran sequentially (one SMTP call at
  // a time), which made bulk imports of 50-100 participants feel frozen for
  // 10-20 seconds. Chunked Promise.all keeps the SMTP provider from being
  // overwhelmed while dropping wall-clock time ~5x.
  if (data && data.length > 0) {
    const EMAIL_CONCURRENCY = 5
    for (let i = 0; i < data.length; i += EMAIL_CONCURRENCY) {
      const chunk = data.slice(i, i + EMAIL_CONCURRENCY)
      const chunkFailures = await Promise.all(
        chunk.map(async (row) => {
          try {
            const result = await sendParticipantInviteEmail(campaignId, row.id)
            if (!result.success) {
              return {
                participantId: row.id,
                email: row.email ?? '',
                error: result.error ?? 'Email delivery failed',
              } satisfies BulkInviteEmailFailure
            }
          } catch (emailErr) {
            console.warn(
              '[bulkInviteParticipants] Email send failed for',
              row.id,
              emailErr
            )
            return {
              participantId: row.id,
              email: row.email ?? '',
              error:
                emailErr instanceof Error
                  ? emailErr.message
                  : 'Email delivery failed',
            } satisfies BulkInviteEmailFailure
          }
          return null
        })
      )
      emailFailures.push(
        ...chunkFailures.filter(
          (failure): failure is BulkInviteEmailFailure => failure !== null
        )
      )
    }
  }

  revalidatePath(`/campaigns/${campaignId}`)
  return {
    success: true as const,
    inserted: data?.length ?? 0,
    existingCount: pendingExisting.length,
    errors: rowErrors,
    emailFailures,
    requiresConfirmation: pendingExisting.length > 0 && !(options?.allowExisting ?? false),
    pendingExisting: pendingExisting.map((participant) => ({
      row: participant.row,
      email: participant.email,
      firstName: participant.firstName,
      lastName: participant.lastName,
    })),
  }
}

export async function removeParticipant(campaignId: string, participantId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_participants')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', participantId)
    .eq('campaign_id', campaignId)
    .is('deleted_at', null)

  if (error) {
    logActionError('removeParticipant', error)
    return { error: 'Unable to remove participant.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.participant.removed',
    targetTable: 'campaign_participants',
    targetId: participantId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
  revalidatePath(`/campaigns/${campaignId}/participants`)
  revalidatePath('/participants')
  return { success: true as const }
}

export async function restoreParticipant(campaignId: string, participantId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_participants')
    .update({ deleted_at: null })
    .eq('id', participantId)
    .eq('campaign_id', campaignId)

  if (error) {
    logActionError('restoreParticipant', error)
    return { error: 'Unable to restore participant.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.participant.restored',
    targetTable: 'campaign_participants',
    targetId: participantId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
  revalidatePath(`/campaigns/${campaignId}/participants`)
  revalidatePath('/participants')
  return { success: true as const }
}

// ---------------------------------------------------------------------------
// Access Links
// ---------------------------------------------------------------------------

export async function createAccessLink(campaignId: string, payload: Record<string, unknown>) {
  const parsed = accessLinkSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: { _form: [error.message] } }
    }
    throw error
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('campaign_access_links')
    .insert({
      campaign_id: campaignId,
      label: parsed.data.label ?? null,
      max_uses: parsed.data.maxUses ?? null,
      expires_at: parsed.data.expiresAt || null,
    })
    .select('id, token')
    .single()

  if (error) {
    logActionError('createAccessLink', error)
    return { error: { _form: ['Unable to create access link.'] } }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.access_link.created',
    targetTable: 'campaign_access_links',
    targetId: data.id,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: {
      campaignId,
      expiresAt: parsed.data.expiresAt || null,
      maxUses: parsed.data.maxUses ?? null,
    },
  })

  revalidatePath(`/campaigns/${campaignId}`)
  return { success: true as const, id: data.id, token: data.token }
}

export async function deactivateAccessLink(campaignId: string, linkId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_access_links')
    .update({ is_active: false })
    .eq('id', linkId)
    .eq('campaign_id', campaignId)

  if (error) {
    logActionError('deactivateAccessLink', error)
    return { error: 'Unable to deactivate access link.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.access_link.deactivated',
    targetTable: 'campaign_access_links',
    targetId: linkId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
}

export async function reactivateAccessLink(campaignId: string, linkId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_access_links')
    .update({ is_active: true })
    .eq('id', linkId)
    .eq('campaign_id', campaignId)

  if (error) {
    logActionError('reactivateAccessLink', error)
    return { error: 'Unable to reactivate access link.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.access_link.reactivated',
    targetTable: 'campaign_access_links',
    targetId: linkId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
}

export async function deleteAccessLink(campaignId: string, linkId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_access_links')
    .delete()
    .eq('id', linkId)
    .eq('campaign_id', campaignId)

  if (error) {
    logActionError('deleteAccessLink', error)
    return { error: 'Unable to delete access link.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.access_link.deleted',
    targetTable: 'campaign_access_links',
    targetId: linkId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
}

// ---------------------------------------------------------------------------
// Cross-campaign participant view (client portal)
// ---------------------------------------------------------------------------

export type ClientParticipant = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  status: string
  startedAt: string | null
  completedAt: string | null
  campaignId: string
  campaignTitle: string
  created_at: string
}

export type CampaignAssessmentOption = {
  id: string
  title: string
  description?: string
  status: 'draft' | 'active' | 'archived'
  factorCount: number
  sectionCount: number
  totalItemCount: number
  formatLabel?: string
  estimatedDurationMinutes: number
}

function getNestedCount(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0]
    if (first && typeof first === 'object' && 'count' in first) {
      const count = (first as { count?: number }).count
      return Number.isFinite(count) ? Number(count) : 0
    }
    return value.length
  }

  if (value && typeof value === 'object' && 'count' in value) {
    const count = (value as { count?: number }).count
    return Number.isFinite(count) ? Number(count) : 0
  }

  return 0
}

function getFormatLabel(formatTypes: string[], formatMode?: string | null) {
  const uniqueTypes = [...new Set(formatTypes.filter(Boolean))]
  if (formatMode === 'forced_choice') return 'Forced-choice'
  if (uniqueTypes.length === 0) return 'Traditional'
  if (uniqueTypes.length > 1) return 'Mixed'

  switch (uniqueTypes[0]) {
    case 'likert':
      return 'Likert'
    case 'binary':
      return 'Binary'
    case 'sjt':
      return 'SJT'
    case 'forced_choice':
      return 'Forced-choice'
    case 'free_text':
      return 'Free text'
    default:
      return uniqueTypes[0]
  }
}

function getSecondsPerItem(formatType: string) {
  switch (formatType) {
    case 'likert':
    case 'binary':
      return 15
    case 'sjt':
    case 'forced_choice':
      return 30
    case 'free_text':
      return 60
    default:
      return 20
  }
}

export async function getParticipantsForClient(
  clientId: string,
): Promise<ClientParticipant[]> {
  await requireClientAccess(clientId)
  const db = await createClient()

  // First get all non-deleted campaigns for this client
  const { data: campaigns, error: campaignsError } = await db
    .from('campaigns')
    .select('id, title')
    .eq('client_id', clientId)
    .is('deleted_at', null)

  if (campaignsError) {
    throwActionError(
      'getParticipantsForClient.campaigns',
      'Unable to load participants.',
      campaignsError
    )
  }
  if (!campaigns || campaigns.length === 0) return []

  const campaignIds = campaigns.map((c) => c.id)
  const campaignMap = new Map(campaigns.map((c) => [c.id, c.title]))

  // Then get all participants for those campaigns
  const { data: participants, error: participantsError } = await db
    .from('campaign_participants')
    .select('id, email, first_name, last_name, status, started_at, completed_at, campaign_id, created_at')
    .in('campaign_id', campaignIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (participantsError) {
    throwActionError(
      'getParticipantsForClient.participants',
      'Unable to load participants.',
      participantsError
    )
  }

  return (participants ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    campaignId: row.campaign_id,
    campaignTitle: campaignMap.get(row.campaign_id) ?? 'Unknown',
    created_at: row.created_at,
  }))
}

// ---------------------------------------------------------------------------
// Unique participants for client portal
// ---------------------------------------------------------------------------

export type UniqueClientParticipant = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  latestStatus: string
  sessionCount: number
  lastActivity?: string
}

export async function getUniqueParticipantsForClient(
  clientId: string,
): Promise<UniqueClientParticipant[]> {
  await requireClientAccess(clientId)
  const db = await createClient()

  const { data: campaigns, error: campaignsError } = await db
    .from('campaigns')
    .select('id')
    .eq('client_id', clientId)
    .is('deleted_at', null)

  if (campaignsError) {
    throwActionError(
      'getUniqueParticipantsForClient.campaigns',
      'Unable to load participants.',
      campaignsError
    )
  }
  if (!campaigns || campaigns.length === 0) return []

  const campaignIds = campaigns.map((c) => c.id)

  const { data: participants, error: participantsError } = await db
    .from('campaign_participants')
    .select('id, email, first_name, last_name, status, started_at, completed_at, created_at')
    .in('campaign_id', campaignIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (participantsError) {
    throwActionError(
      'getUniqueParticipantsForClient.participants',
      'Unable to load participants.',
      participantsError
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byEmail = new Map<string, { latest: any; count: number }>()
  for (const row of participants ?? []) {
    const email = row.email.toLowerCase()
    const existing = byEmail.get(email)
    if (!existing) {
      byEmail.set(email, { latest: row, count: 1 })
    } else {
      existing.count++
    }
  }

  return Array.from(byEmail.values()).map(({ latest, count }) => {
    const timestamps = [latest.started_at, latest.completed_at].filter(Boolean) as string[]
    return {
      id: latest.id,
      email: latest.email,
      firstName: latest.first_name ?? null,
      lastName: latest.last_name ?? null,
      latestStatus: latest.status,
      sessionCount: count,
      lastActivity: timestamps.length > 0
        ? timestamps.sort().reverse()[0]
        : latest.created_at,
    }
  })
}

// ---------------------------------------------------------------------------
// Helpers for assessment picker
// ---------------------------------------------------------------------------

export async function getActiveAssessments(): Promise<CampaignAssessmentOption[]> {
  const scope = await resolveAuthorizedScope()
  const db = await createClient()

  let query = db
    .from('assessments')
    .select(`
      id,
      title,
      description,
      status,
      format_mode,
      assessment_factors(count),
      assessment_sections(
        id,
        response_formats(type),
        assessment_section_items(count)
      )
    `)
    .in('status', ['active', 'draft'])
    .is('deleted_at', null)
    .order('title', { ascending: true })

  // Scope-aware: partners see their own + platform-owned assessments.
  // Clients should use getClientAssessmentLibrary instead — this
  // function serves admin + partner portals only.
  if (!scope.isPlatformAdmin && !scope.isLocalDevelopmentBypass) {
    if (scope.partnerIds.length > 0) {
      query = query.or(
        `partner_id.in.(${scope.partnerIds.join(',')}),partner_id.is.null`
      )
    } else {
      // Non-admin, non-partner — shouldn't be calling this function
      return []
    }
  }

  const { data, error } = await query

  if (error) {
    throwActionError(
      'getActiveAssessments',
      'Unable to load active assessments.',
      error
    )
  }
  return (data ?? []).map((row) => {
    const sections = Array.isArray(row.assessment_sections) ? row.assessment_sections : []
    const totalItemCount = sections.reduce(
      (sum, section) => sum + getNestedCount(section.assessment_section_items),
      0
    )
    const formatTypes = sections.map((section) => {
      const responseFormat = Array.isArray(section.response_formats)
        ? section.response_formats[0]
        : section.response_formats
      return String(responseFormat?.type ?? '')
    })
    const estimatedDurationSeconds = sections.reduce((sum, section) => {
      const responseFormat = Array.isArray(section.response_formats)
        ? section.response_formats[0]
        : section.response_formats
      const formatType = String(responseFormat?.type ?? '')
      return sum + getNestedCount(section.assessment_section_items) * getSecondsPerItem(formatType)
    }, 0)

    return {
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      status: row.status,
      factorCount: getNestedCount(row.assessment_factors),
      sectionCount: sections.length,
      totalItemCount,
      formatLabel: getFormatLabel(formatTypes, row.format_mode),
      estimatedDurationMinutes:
        estimatedDurationSeconds > 0 ? Math.max(1, Math.ceil(estimatedDurationSeconds / 60)) : 0,
    }
  })
}

export async function bulkDeleteCampaigns(ids: string[]) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/campaigns')
  revalidatePath('/')
}

export async function bulkUpdateCampaignStatus(ids: string[], status: string) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ status })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/campaigns')
  revalidatePath('/')
}
