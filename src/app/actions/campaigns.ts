'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assertAdminOnly,
  AuthorizationError,
  canAccessClient,
  getAccessibleCampaignIds,
  requireCampaignAccess,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import {
  mapCampaignRow,
  mapCampaignAssessmentRow,
  mapCampaignParticipantRow,
  mapCampaignAccessLinkRow,
} from '@/lib/supabase/mappers'
import { campaignSchema, inviteParticipantSchema, accessLinkSchema } from '@/lib/validations/campaigns'
import type { Campaign, CampaignAssessment, CampaignParticipant, CampaignAccessLink } from '@/types/database'

// ---------------------------------------------------------------------------
// Meta types
// ---------------------------------------------------------------------------

export type CampaignWithMeta = Campaign & {
  assessmentCount: number
  participantCount: number
  completedCount: number
  organizationName?: string
}

export type CampaignDetail = Campaign & {
  assessments: (CampaignAssessment & { assessmentTitle: string; assessmentStatus: string })[]
  participants: CampaignParticipant[]
  accessLinks: CampaignAccessLink[]
  organizationName?: string
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function getOrganizationPartnerId(organizationId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('organizations')
    .select('id, partner_id')
    .eq('id', organizationId)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    throw new AuthorizationError('Selected client is not available.')
  }

  return data.partner_id ? String(data.partner_id) : null
}

export async function getCampaigns(): Promise<CampaignWithMeta[]> {
  const scope = await resolveAuthorizedScope()
  const db = createAdminClient()
  let query = db
    .from('campaigns')
    .select('*, organizations(name), campaign_participants(count), campaign_assessments(count)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (!scope.isPlatformAdmin) {
    const campaignIds = await getAccessibleCampaignIds(scope)
    if (!campaignIds || campaignIds.length === 0) {
      return []
    }
    query = query.in('id', campaignIds)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  // Get completed counts per campaign
  const campaignIds = (data ?? []).map((r) => r.id)
  let completedMap: Record<string, number> = {}
  if (campaignIds.length > 0) {
    const { data: completed } = await db
      .from('campaign_participants')
      .select('campaign_id')
      .in('campaign_id', campaignIds)
      .eq('status', 'completed')

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
    organizationName: row.organizations?.name ?? undefined,
  }))
}

export async function getCampaignById(id: string): Promise<CampaignDetail | null> {
  try {
    await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null
    }
    throw error
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('campaigns')
    .select('*, organizations(name)')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any

  // Load assessments with titles
  const { data: assessmentRows } = await db
    .from('campaign_assessments')
    .select('*, assessments(title, status)')
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
    organizationName: row.organizations?.name ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assessments: (assessmentRows ?? []).map((r: any) => ({
      ...mapCampaignAssessmentRow(r),
      assessmentTitle: r.assessments?.title ?? 'Untitled',
      assessmentStatus: r.assessments?.status ?? 'draft',
    })),
    participants: (participantRows ?? []).map(mapCampaignParticipantRow),
    accessLinks: (linkRows ?? []).map(mapCampaignAccessLinkRow),
  }
}

// ---------------------------------------------------------------------------
// Create / Update (Zone 2 — explicit save)
// ---------------------------------------------------------------------------

export async function createCampaign(payload: Record<string, unknown>) {
  const parsed = campaignSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const scope = await resolveAuthorizedScope()
  const organizationId = parsed.data.organizationId || null

  if (!scope.isPlatformAdmin) {
    if (!organizationId) {
      return { error: { organizationId: ['Campaigns must belong to a client context'] } }
    }

    if (!canAccessClient(scope, organizationId)) {
      return { error: { organizationId: ['You do not have access to this client'] } }
    }
  }

  const partnerId =
    organizationId
      ? await getOrganizationPartnerId(organizationId)
      : (parsed.data.partnerId || null)

  const db = createAdminClient()
  const { data: campaign, error } = await db
    .from('campaigns')
    .insert({
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      organization_id: organizationId,
      partner_id: partnerId,
      opens_at: parsed.data.opensAt || null,
      closes_at: parsed.data.closesAt || null,
      allow_resume: parsed.data.allowResume,
      show_progress: parsed.data.showProgress,
      randomize_assessment_order: parsed.data.randomizeAssessmentOrder,
    })
    .select('id')
    .single()

  if (error) return { error: { _form: [error.message] } }

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'campaign.created',
    targetTable: 'campaigns',
    targetId: campaign.id,
    partnerId,
    clientId: organizationId,
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

  const organizationId = parsed.data.organizationId || access.organizationId || null

  if (!access.scope.isPlatformAdmin) {
    if (!organizationId || !canAccessClient(access.scope, organizationId)) {
      return { error: { organizationId: ['You do not have access to this client'] } }
    }
  }

  const partnerId =
    organizationId
      ? await getOrganizationPartnerId(organizationId)
      : (parsed.data.partnerId || access.partnerId || null)

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      organization_id: organizationId,
      partner_id: partnerId,
      opens_at: parsed.data.opensAt || null,
      closes_at: parsed.data.closesAt || null,
      allow_resume: parsed.data.allowResume,
      show_progress: parsed.data.showProgress,
      randomize_assessment_order: parsed.data.randomizeAssessmentOrder,
    })
    .eq('id', id)

  if (error) return { error: { _form: [error.message] } }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.updated',
    targetTable: 'campaigns',
    targetId: id,
    partnerId,
    clientId: organizationId,
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

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.description.updated',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.organizationId,
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

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.deleted',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.organizationId,
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

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.restored',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.organizationId,
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
  const { error } = await db
    .from('campaigns')
    .update({ status: 'active' })
    .eq('id', id)

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.activated',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.organizationId,
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

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.paused',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.organizationId,
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

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.closed',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.organizationId,
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

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.setting.updated',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.organizationId,
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

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.assessment.added',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.organizationId,
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
    .delete()
    .eq('campaign_id', campaignId)
    .eq('assessment_id', assessmentId)

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.assessment.removed',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.organizationId,
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

    if (error) return { error: error.message }
  }

  revalidatePath(`/campaigns/${campaignId}`)

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.assessments.reordered',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.organizationId,
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
    return { error: { _form: [error.message] } }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.participant.invited',
    targetTable: 'campaign_participants',
    targetId: data.id,
    partnerId: access.partnerId,
    clientId: access.organizationId,
    metadata: { campaignId, email: parsed.data.email },
  })

  revalidatePath(`/campaigns/${campaignId}`)
  return { success: true as const, id: data.id, accessToken: data.access_token }
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

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.participants.bulk_invited',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.organizationId,
    metadata: {
      count: data?.length ?? 0,
    },
  })

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
    .delete()
    .eq('id', participantId)
    .eq('campaign_id', campaignId)

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.participant.removed',
    targetTable: 'campaign_participants',
    targetId: participantId,
    partnerId: access.partnerId,
    clientId: access.organizationId,
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

  if (error) return { error: { _form: [error.message] } }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.access_link.created',
    targetTable: 'campaign_access_links',
    targetId: data.id,
    partnerId: access.partnerId,
    clientId: access.organizationId,
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

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.access_link.deactivated',
    targetTable: 'campaign_access_links',
    targetId: linkId,
    partnerId: access.partnerId,
    clientId: access.organizationId,
    metadata: { campaignId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
}

// ---------------------------------------------------------------------------
// Helpers for assessment picker
// ---------------------------------------------------------------------------

export async function getActiveAssessments() {
  const scope = await resolveAuthorizedScope()
  assertAdminOnly(scope)
  const db = createAdminClient()
  const { data, error } = await db
    .from('assessments')
    .select('id, name, status')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}
