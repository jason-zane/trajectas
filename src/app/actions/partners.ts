'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { mapPartnerRow, toPartnerInsert } from '@/lib/supabase/mappers'
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
import { logActionError, throwActionError } from '@/lib/security/action-errors'
import { partnerSchema } from '@/lib/validations/partners'
import type { Partner } from '@/types/database'

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
  const db = createAdminClient()

  // Clients under this partner
  const { count: clientCount } = await db
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('partner_id', partnerId)
    .is('deleted_at', null)

  // Get all client IDs for aggregate queries
  const { data: clientRows } = await db
    .from('clients')
    .select('id')
    .eq('partner_id', partnerId)
    .is('deleted_at', null)
  const clientIds = (clientRows ?? []).map((c) => c.id)

  // Active campaigns across partner's clients
  let activeCampaignCount = 0
  if (clientIds.length > 0) {
    const { count } = await db
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .in('client_id', clientIds)
      .eq('status', 'active')
      .is('deleted_at', null)
    activeCampaignCount = count ?? 0
  }

  // Partner members
  const { count: partnerMemberCount } = await db
    .from('partner_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('partner_id', partnerId)
    .is('revoked_at', null)

  // Total assessments assigned across all partner's clients
  let totalAssessmentsAssigned = 0
  if (clientIds.length > 0) {
    const { count } = await db
      .from('client_assessment_assignments')
      .select('*', { count: 'exact', head: true })
      .in('client_id', clientIds)
      .eq('is_active', true)
    totalAssessmentsAssigned = count ?? 0
  }

  return {
    clientCount: clientCount ?? 0,
    activeCampaignCount,
    partnerMemberCount: partnerMemberCount ?? 0,
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
    await revokeInvite(inviteId, actorId)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to revoke invite' }
  }

  revalidatePath(`/partners`)
  return { success: true as const }
}
