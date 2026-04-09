'use server'

import { cache } from 'react'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  assertAdminOnly,
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
  let query = db
    .from('campaigns')
    .select('*, clients(name), campaign_participants(count), campaign_assessments(count)')
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

  // Get completed counts per campaign
  const campaignIds = (data ?? []).map((r) => r.id)
  let completedMap: Record<string, number> = {}
  if (campaignIds.length > 0) {
    const { data: completed, error: completedError } = await db
      .from('campaign_participants')
      .select('campaign_id')
      .in('campaign_id', campaignIds)
      .eq('status', 'completed')

    if (completedError) {
      throwActionError(
        'getCampaigns.completedCounts',
        'Unable to load campaigns.',
        completedError
      )
    }

    completedMap = (completed ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.campaign_id] = (acc[r.campaign_id] ?? 0) + 1
      return acc
    }, {})
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...mapCampaignRow(row),
    assessmentCount: row.campaign_assessments?.[0]?.count ?? 0,
    participantCount: row.campaign_participants?.[0]?.count ?? 0,
    completedCount: completedMap[row.id] ?? 0,
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

  // Load assessments with titles
  const { data: assessmentRows } = await db
    .from('campaign_assessments')
    .select('*, assessments(title, status, min_custom_factors)')
    .eq('campaign_id', id)
    .order('display_order', { ascending: true })

  // Load participants
  const { data: participantRows } = await db
    .from('campaign_participants')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })

  // Load access links
  const { data: linkRows } = await db
    .from('campaign_access_links')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })

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
    participants: (participantRows ?? []).map(mapCampaignParticipantRow),
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
    if (error.code === '23505') {
      return { error: { email: ['This email is already invited to this campaign'] } }
    }
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

  // Auto-send invite email (best-effort — don't fail the invite on email error)
  try {
    await sendParticipantInviteEmail(campaignId, data.id)
  } catch (emailErr) {
    console.warn('[inviteParticipant] Email send failed, participant created:', emailErr)
  }

  revalidatePath(`/campaigns/${campaignId}`)
  return { success: true as const, id: data.id, accessToken: data.access_token }
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
  const rows = participants.map((c) => ({
    campaign_id: campaignId,
    email: c.email,
    first_name: c.firstName ?? null,
    last_name: c.lastName ?? null,
  }))

  const { data, error } = await db
    .from('campaign_participants')
    .upsert(rows, { onConflict: 'campaign_id,email', ignoreDuplicates: true })
    .select('id')

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
      count: data?.length ?? 0,
    },
  })

  // Best-effort: send invite emails for all newly created participants
  if (data && data.length > 0) {
    for (const row of data) {
      try {
        await sendParticipantInviteEmail(campaignId, row.id)
      } catch (emailErr) {
        console.warn('[bulkInviteParticipants] Email send failed for', row.id, emailErr)
      }
    }
  }

  revalidatePath(`/campaigns/${campaignId}`)
  return { success: true as const, count: data?.length ?? 0 }
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
// Helpers for assessment picker
// ---------------------------------------------------------------------------

export async function getActiveAssessments() {
  const scope = await resolveAuthorizedScope()
  assertAdminOnly(scope)
  const db = await createClient()
  const { data, error } = await db
    .from('assessments')
    .select('id, title, status')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('title', { ascending: true })

  if (error) {
    throwActionError(
      'getActiveAssessments',
      'Unable to load active assessments.',
      error
    )
  }
  return data ?? []
}
