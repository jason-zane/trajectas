'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { mapClientRow, mapPartnerRow, toPartnerInsert } from '@/lib/supabase/mappers'
import {
  AuthorizationError,
  canManagePartnerDirectory,
  requireAdminScope,
  requirePartnerAccess,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import {
  createStaffInvite,
  revokeInvite,
  type InviteRole,
} from '@/lib/auth/staff-auth'
import { sendStaffInviteEmail } from '@/lib/auth/staff-invite-email'
import { logActionError, throwActionError } from '@/lib/security/action-errors'
import { partnerSchema } from '@/lib/validations/partners'
import type { Partner } from '@/types/database'
import type { BandScheme } from '@/lib/reports/band-scheme'
import { isSchemeValid } from '@/lib/reports/band-scheme-validation'

export type PartnerWithCounts = Partner & {
  clientCount: number
}

function revalidateDirectoryPaths() {
  revalidatePath('/directory')
  revalidatePath('/clients')
  revalidatePath('/partners')
  revalidatePath('/')
}

export async function getPartners(): Promise<PartnerWithCounts[]> {
  const scope = await resolveAuthorizedScope()

  if (!scope.isPlatformAdmin) {
    return []
  }

  const db = await createClient()
  const { data, error } = await db
    .from('partners')
    .select('*, clients(count)')
    .order('name', { ascending: true })

  if (error) {
    throwActionError('getPartners', 'Unable to load partners.', error)
  }

  return (data ?? []).map((row) => ({
    ...mapPartnerRow(row),
    clientCount: row.clients
      ? ((row.clients as { count: number }[])[0]?.count ?? 0)
      : 0,
  }))
}

export async function getAssignablePartners(): Promise<Partner[]> {
  const scope = await resolveAuthorizedScope()

  if (!canManagePartnerDirectory(scope)) {
    return []
  }

  const db = await createClient()
  const { data, error } = await db
    .from('partners')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    throwActionError(
      'getAssignablePartners',
      'Unable to load partners.',
      error
    )
  }

  return (data ?? []).map(mapPartnerRow)
}

export async function getPartnerBySlug(
  slug: string,
  options: { includeArchived?: boolean } = {}
): Promise<Partner | null> {
  await requireAdminScope()

  const db = await createClient()
  let query = db
    .from('partners')
    .select('*')
    .eq('slug', slug)

  if (!options.includeArchived) {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query.single()

  if (error) return null
  return mapPartnerRow(data)
}

export async function createPartner(formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    isActive: formData.get('isActive') !== 'false',
  }

  const parsed = partnerSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const scope = await requireAdminScope()
  const db = createAdminClient()

  const { data: created, error } = await db
    .from('partners')
    .insert(toPartnerInsert(parsed.data))
    .select('id')
    .single()

  if (error) {
    logActionError('createPartner', error)
    return { error: { _form: ['Unable to create partner.'] } }
  }

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'partner.created',
    targetTable: 'partners',
    targetId: created.id,
    partnerId: created.id,
    clientId: null,
    metadata: {
      slug: parsed.data.slug,
      isLocalDevelopmentBypass: scope.isLocalDevelopmentBypass,
    },
  })

  revalidateDirectoryPaths()
  return { success: true as const, id: created.id, slug: parsed.data.slug }
}

export async function updatePartner(id: string, formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    isActive: formData.get('isActive') !== 'false',
    description: (formData.get('description') as string | null) || null,
    website: (formData.get('website') as string | null) || null,
    contactEmail: (formData.get('contactEmail') as string | null) || null,
    notes: (formData.get('notes') as string | null) || null,
  }

  const parsed = partnerSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  let access
  try {
    access = await requirePartnerAccess(id, { includeArchived: true })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: { _form: [error.message] } }
    }
    throw error
  }

  if (!canManagePartnerDirectory(access.scope)) {
    return { error: { _form: ['You do not have permission to update this partner'] } }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('partners')
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      is_active: parsed.data.isActive,
      description: parsed.data.description,
      website: parsed.data.website,
      contact_email: parsed.data.contactEmail,
      notes: parsed.data.notes,
    })
    .eq('id', id)

  if (error) {
    logActionError('updatePartner', error)
    return { error: { _form: ['Unable to update partner.'] } }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'partner.updated',
    targetTable: 'partners',
    targetId: id,
    partnerId: id,
    clientId: null,
    metadata: {
      slug: parsed.data.slug,
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidateDirectoryPaths()
  return { success: true as const, id, slug: parsed.data.slug }
}

export async function getPartnerBandScheme(partnerId: string): Promise<BandScheme | null> {
  await requirePartnerAccess(partnerId)
  const db = createAdminClient()
  const { data, error } = await db
    .from('partners')
    .select('band_scheme')
    .eq('id', partnerId)
    .maybeSingle()
  if (error || !data) return null
  return ((data as { band_scheme: BandScheme | null }).band_scheme) ?? null
}

export async function updatePartnerBandScheme(
  partnerId: string,
  scheme: BandScheme | null,
): Promise<{ success?: true; error?: string }> {
  const access = await requirePartnerAccess(partnerId)
  if (!canManagePartnerDirectory(access.scope)) {
    return { error: 'You do not have permission to update this partner' }
  }
  if (scheme && !isSchemeValid(scheme)) return { error: 'Invalid band scheme' }
  const db = createAdminClient()
  const { error } = await db.from('partners').update({ band_scheme: scheme }).eq('id', partnerId)
  if (error) return { error: error.message }
  revalidatePath(`/partners/${partnerId}/settings`)
  return { success: true }
}

export async function deletePartner(id: string) {
  let access
  try {
    access = await requirePartnerAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!canManagePartnerDirectory(access.scope)) {
    return { error: 'You do not have permission to archive this partner' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('partners')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    logActionError('deletePartner', error)
    return { error: 'Unable to archive partner.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'partner.deleted',
    targetTable: 'partners',
    targetId: id,
    partnerId: id,
    clientId: null,
    metadata: {
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidateDirectoryPaths()
}

export async function restorePartner(id: string) {
  let access
  try {
    access = await requirePartnerAccess(id, { includeArchived: true })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!canManagePartnerDirectory(access.scope)) {
    return { error: 'You do not have permission to restore this partner' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('partners')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) {
    logActionError('restorePartner', error)
    return { error: 'Unable to restore partner.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'partner.restored',
    targetTable: 'partners',
    targetId: id,
    partnerId: id,
    clientId: null,
    metadata: {
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidateDirectoryPaths()
}

// ---------------------------------------------------------------------------
// Partner Stats
// ---------------------------------------------------------------------------

export async function getPartnerStats(partnerId: string): Promise<{
  clientCount: number
  activeCampaignCount: number
  partnerMemberCount: number
  totalAssessmentsAssigned: number
}> {
  await requirePartnerAccess(partnerId)
  const db = await createClient()

  // Group A: clients list (with count) + partner members — independent.
  // Combining clients list + count into a single query eliminates a prior
  // duplicate round-trip.
  const [clientsResult, partnerMembersResult] = await Promise.all([
    db
      .from('clients')
      .select('id', { count: 'exact' })
      .eq('partner_id', partnerId)
      .is('deleted_at', null),
    db
      .from('partner_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', partnerId)
      .is('revoked_at', null),
  ])

  const clientIds = (clientsResult.data ?? []).map((c) => c.id)
  const clientCount = clientsResult.count ?? 0
  const partnerMemberCount = partnerMembersResult.count ?? 0

  // Group B: campaigns + assessments — both need clientIds but are
  // independent of each other.
  let activeCampaignCount = 0
  let totalAssessmentsAssigned = 0

  if (clientIds.length > 0) {
    const [campaignsResult, assessmentsResult] = await Promise.all([
      db
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .in('client_id', clientIds)
        .eq('status', 'active')
        .is('deleted_at', null),
      db
        .from('client_assessment_assignments')
        .select('*', { count: 'exact', head: true })
        .in('client_id', clientIds)
        .eq('is_active', true),
    ])

    activeCampaignCount = campaignsResult.count ?? 0
    totalAssessmentsAssigned = assessmentsResult.count ?? 0
  }

  return {
    clientCount,
    activeCampaignCount,
    partnerMemberCount,
    totalAssessmentsAssigned,
  }
}

// ---------------------------------------------------------------------------
// Partner Members
// ---------------------------------------------------------------------------

export interface PartnerMember {
  membershipId: string
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  role: 'admin' | 'member'
  addedAt: string
}

export interface PartnerPendingInvite {
  id: string
  email: string
  role: string
  createdAt: string
  expiresAt: string
}

export async function getPartnerMembers(partnerId: string): Promise<PartnerMember[]> {
  const access = await requirePartnerAccess(partnerId)
  if (!access.scope.isPlatformAdmin && !access.scope.partnerAdminIds.includes(partnerId)) {
    return []
  }

  const db = await createClient()
  const { data, error } = await db
    .from('partner_memberships')
    .select('id, profile_id, role, created_at, profiles!profile_id(id, email, first_name, last_name)')
    .eq('partner_id', partnerId)
    .is('revoked_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    throwActionError(
      'getPartnerMembers',
      'Unable to load partner users.',
      error
    )
  }

  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      membershipId: String(row.id),
      userId: String(row.profile_id),
      email: profile?.email ?? '',
      firstName: profile?.first_name ?? null,
      lastName: profile?.last_name ?? null,
      role: row.role as 'admin' | 'member',
      addedAt: String(row.created_at),
    }
  })
}

export async function getPartnerPendingInvites(partnerId: string): Promise<PartnerPendingInvite[]> {
  const access = await requirePartnerAccess(partnerId)
  if (!access.scope.isPlatformAdmin && !access.scope.partnerAdminIds.includes(partnerId)) {
    return []
  }

  const db = await createClient()
  const { data, error } = await db
    .from('user_invites')
    .select('id, email, role, created_at, expires_at')
    .eq('tenant_type', 'partner')
    .eq('tenant_id', partnerId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    throwActionError(
      'getPartnerPendingInvites',
      'Unable to load pending invites.',
      error
    )
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    role: String(row.role),
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
  }))
}

export async function inviteUserToPartner(
  partnerId: string,
  input: { email: string; role: 'admin' | 'member' }
) {
  let access
  try {
    access = await requirePartnerAccess(partnerId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!access.scope.isPlatformAdmin && !access.scope.partnerAdminIds.includes(partnerId)) {
    return { error: 'You do not have permission to invite users to this partner' }
  }

  const actorId = access.scope.actor?.id
  if (!actorId && !access.scope.isLocalDevelopmentBypass) {
    return { error: 'Authentication required' }
  }

  // Check for existing pending invite
  const db = createAdminClient()
  const { data: existing } = await db
    .from('user_invites')
    .select('id')
    .eq('tenant_type', 'partner')
    .eq('tenant_id', partnerId)
    .eq('email', input.email.trim().toLowerCase())
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (existing) {
    return { error: 'An invite is already pending for this email address' }
  }

  const inviteRole: InviteRole = input.role === 'admin' ? 'partner_admin' : 'partner_member'
  const invitedByProfileId = actorId ?? '00000000-0000-0000-0000-000000000000'

  const result = await createStaffInvite({
    email: input.email.trim().toLowerCase(),
    tenantType: 'partner',
    tenantId: partnerId,
    role: inviteRole,
    invitedByProfileId,
  })

  if ('error' in result) {
    const formErrors = result.error._form
    return { error: formErrors?.[0] ?? 'Failed to create invite' }
  }

  await sendStaffInviteEmail({
    email: result.data.email,
    inviteToken: result.inviteToken,
    tenantType: result.data.tenantType,
    tenantId: result.data.tenantId,
  })

  revalidatePath(`/partners`)
  return { success: true as const }
}

export async function changePartnerMemberRole(
  partnerId: string,
  membershipId: string,
  role: 'admin' | 'member'
) {
  let access
  try {
    access = await requirePartnerAccess(partnerId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!access.scope.isPlatformAdmin && !access.scope.partnerAdminIds.includes(partnerId)) {
    return { error: 'You do not have permission to change member roles' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('partner_memberships')
    .update({ role })
    .eq('id', membershipId)
    .eq('partner_id', partnerId)
    .is('revoked_at', null)

  if (error) {
    logActionError('changePartnerMemberRole', error)
    return { error: 'Unable to change member role.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'partner_membership.role_changed',
    targetTable: 'partner_memberships',
    targetId: membershipId,
    partnerId,
    clientId: null,
    metadata: { newRole: role },
  })

  revalidatePath(`/partners`)
  return { success: true as const }
}

export async function removePartnerMember(
  partnerId: string,
  membershipId: string
) {
  let access
  try {
    access = await requirePartnerAccess(partnerId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!access.scope.isPlatformAdmin && !access.scope.partnerAdminIds.includes(partnerId)) {
    return { error: 'You do not have permission to remove members' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('partner_memberships')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by_profile_id: access.scope.actor?.id ?? null,
    })
    .eq('id', membershipId)
    .eq('partner_id', partnerId)
    .is('revoked_at', null)

  if (error) {
    logActionError('removePartnerMember', error)
    return { error: 'Unable to remove member.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'partner_membership.revoked',
    targetTable: 'partner_memberships',
    targetId: membershipId,
    partnerId,
    clientId: null,
    metadata: {},
  })

  revalidatePath(`/partners`)
  return { success: true as const }
}

export async function revokePartnerInvite(
  partnerId: string,
  inviteId: string
) {
  let access
  try {
    access = await requirePartnerAccess(partnerId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!access.scope.isPlatformAdmin && !access.scope.partnerAdminIds.includes(partnerId)) {
    return { error: 'You do not have permission to revoke invites' }
  }

  const actorId = access.scope.actor?.id ?? '00000000-0000-0000-0000-000000000000'

  try {
    await revokeInvite(inviteId, actorId, { tenantType: 'partner', tenantId: partnerId })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to revoke invite' }
  }

  revalidatePath(`/partners`)
  return { success: true as const }
}

// ---------------------------------------------------------------------------
// Recent Partner Campaigns
// ---------------------------------------------------------------------------

export async function getRecentPartnerCampaigns(partnerId: string): Promise<
  Array<{
    id: string
    title: string
    clientName: string
    status: string
    participantCount: number
    completedCount: number
  }>
> {
  await requirePartnerAccess(partnerId)
  const db = await createClient()

  // Get client IDs for this partner
  const { data: clientRows } = await db
    .from('clients')
    .select('id')
    .eq('partner_id', partnerId)
    .is('deleted_at', null)

  const clientIds = (clientRows ?? []).map((c) => c.id)
  if (clientIds.length === 0) return []

  // Note: participant_count and completed_count are NOT columns on campaigns.
  // They must be derived from campaign_participants. Use a count join.
  const { data, error } = await db
    .from('campaigns')
    .select('id, title, status, clients(name), campaign_participants(count)')
    .in('client_id', clientIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) return []

  return (data ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients
    const participantCount = row.campaign_participants
      ? ((row.campaign_participants as { count: number }[])[0]?.count ?? 0)
      : 0
    return {
      id: row.id,
      title: row.title,
      clientName: (client as { name: string })?.name ?? 'Unknown',
      status: row.status,
      participantCount,
      completedCount: 0, // TODO: derive from campaign_participants with status='completed' if needed
    }
  })
}

// ---------------------------------------------------------------------------
// Partner Clients
// ---------------------------------------------------------------------------

export type PartnerClientRow = ReturnType<typeof mapClientRow> & {
  campaignCount: number
  assessmentCount: number
}

export async function getPartnerClients(partnerId: string): Promise<PartnerClientRow[]> {
  await requirePartnerAccess(partnerId)
  const db = await createClient()

  const { data, error } = await db
    .from('clients')
    .select('*, campaigns(count), client_assessment_assignments(count)')
    .eq('partner_id', partnerId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    throwActionError('getPartnerClients', 'Unable to load partner clients.', error)
  }

  return (data ?? []).map((row) => ({
    ...mapClientRow(row),
    campaignCount: row.campaigns ? ((row.campaigns as { count: number }[])[0]?.count ?? 0) : 0,
    assessmentCount: row.client_assessment_assignments
      ? ((row.client_assessment_assignments as { count: number }[])[0]?.count ?? 0) : 0,
  }))
}

export async function getUnassignedClients() {
  await requireAdminScope()
  const db = await createClient()

  const { data, error } = await db
    .from('clients')
    .select('id, name, slug, industry')
    .is('partner_id', null)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    throwActionError('getUnassignedClients', 'Unable to load unassigned clients.', error)
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    industry: row.industry ? String(row.industry) : null,
  }))
}

export async function assignClientToPartner(clientId: string, partnerId: string) {
  const scope = await requireAdminScope()
  if (!canManagePartnerDirectory(scope)) {
    return { error: 'You do not have permission to assign clients.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('clients')
    .update({ partner_id: partnerId })
    .eq('id', clientId)
    .is('partner_id', null) // only assign unassigned clients

  if (error) {
    logActionError('assignClientToPartner', error)
    return { error: 'Unable to assign client.' }
  }

  revalidateDirectoryPaths()
  return { success: true as const }
}

export async function unassignClientFromPartner(clientId: string) {
  const scope = await requireAdminScope()
  if (!canManagePartnerDirectory(scope)) {
    return { error: 'You do not have permission to unassign clients.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('clients')
    .update({ partner_id: null })
    .eq('id', clientId)

  if (error) {
    logActionError('unassignClientFromPartner', error)
    return { error: 'Unable to unassign client.' }
  }

  revalidateDirectoryPaths()
  return { success: true as const }
}

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------

export async function bulkDeletePartners(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) throw new Error('Unauthorized')
  const db = createAdminClient()
  const { error } = await db
    .from('partners')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidateDirectoryPaths()
}

export async function bulkArchivePartners(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) throw new Error('Unauthorized')
  const db = createAdminClient()
  const { error } = await db
    .from('partners')
    .update({ status: 'archived' })
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidateDirectoryPaths()
}
