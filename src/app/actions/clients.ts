'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { mapClientRow, toClientInsert } from '@/lib/supabase/mappers'
import {
  AuthorizationError,
  canManageClient,
  canManageClientAssignment,
  canManageClientDirectory,
  getPreferredPartnerIdForClientCreation,
  requireClientAccess,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import {
  createStaffInvite,
  revokeInvite,
  type InviteRole,
} from '@/lib/auth/staff-auth'
import { throwActionError } from '@/lib/security/action-errors'
import { clientSchema } from '@/lib/validations/clients'
import type { Client } from '@/types/database'

export type ClientWithCounts = Client & {
  assessmentCount: number
  sessionCount: number
  partnerName?: string
  canCustomizeBranding?: boolean
}

function getRelatedRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0]
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null
  }
  return typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function mapClientWithCounts(row: Record<string, unknown>): ClientWithCounts {
  const partnerRow = getRelatedRecord(row.partners)

  return {
    ...mapClientRow(row),
    partnerName: typeof partnerRow?.name === 'string' ? partnerRow.name : undefined,
    assessmentCount: row.assessments
      ? ((row.assessments as { count: number }[])[0]?.count ?? 0)
      : 0,
    sessionCount: row.diagnostic_sessions
      ? ((row.diagnostic_sessions as { count: number }[])[0]?.count ?? 0)
      : 0,
  }
}

function revalidateDirectoryPaths() {
  revalidatePath('/directory')
  revalidatePath('/clients')
  revalidatePath('/partners')
  revalidatePath('/')
}

async function validateAssignablePartner(partnerId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('partners')
    .select('id')
    .eq('id', partnerId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    throw new AuthorizationError('Select an active partner before saving this client.')
  }

  return String(data.id)
}

export async function getClients(): Promise<ClientWithCounts[]> {
  const scope = await resolveAuthorizedScope()
  const db = await createSupabaseClient()
  let query = db
    .from('clients')
    .select('*, partners(name), assessments(count), diagnostic_sessions(count)')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (!scope.isPlatformAdmin) {
    if (scope.clientIds.length === 0) {
      return []
    }
    query = query.in('id', scope.clientIds)
  }

  const { data, error } = await query

  if (error) {
    throwActionError('getClients', 'Unable to load clients.', error)
  }

  return (data ?? []).map((row) => mapClientWithCounts(row as Record<string, unknown>))
}

export async function getClientDirectoryEntries(): Promise<ClientWithCounts[]> {
  const scope = await resolveAuthorizedScope()
  const db = await createSupabaseClient()
  let query = db
    .from('clients')
    .select('*, partners(name), assessments(count), diagnostic_sessions(count)')
    .order('name', { ascending: true })

  if (!scope.isPlatformAdmin) {
    if (scope.clientIds.length === 0) {
      return []
    }
    query = query.in('id', scope.clientIds)
  }

  const { data, error } = await query

  if (error) {
    throwActionError(
      'getClientDirectoryEntries',
      'Unable to load clients.',
      error
    )
  }

  return (data ?? []).map((row) => mapClientWithCounts(row as Record<string, unknown>))
}

export async function getClientBySlug(
  slug: string,
  options: { includeArchived?: boolean } = {}
): Promise<Client | null> {
  const db = await createSupabaseClient()
  let query = db
    .from('clients')
    .select('*')
    .eq('slug', slug)

  if (!options.includeArchived) {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query.single()

  if (error) return null
  const scope = await resolveAuthorizedScope()
  const client = mapClientRow(data)

  const hasAccess =
    scope.isPlatformAdmin ||
    scope.clientIds.includes(client.id) ||
    (client.partnerId ? scope.partnerIds.includes(client.partnerId) : false)

  if (!hasAccess) return null
  return client
}

export async function createClient(formData: FormData) {
  const raw = {
    partnerId: (formData.get('partnerId') as string) || undefined,
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    industry: (formData.get('industry') as string) || undefined,
    sizeRange: (formData.get('sizeRange') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
  }

  const parsed = clientSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const scope = await resolveAuthorizedScope()
  if (!canManageClientDirectory(scope)) {
    return { error: { _form: ['You do not have permission to create clients'] } }
  }

  let partnerId: string | null = null
  try {
    if (scope.isPlatformAdmin) {
      partnerId = parsed.data.partnerId ? await validateAssignablePartner(parsed.data.partnerId) : null
    } else {
      partnerId = await validateAssignablePartner(getPreferredPartnerIdForClientCreation(scope) ?? '')
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: { _form: [error.message] } }
    }
    throw error
  }

  const db = createAdminClient()
  const insert = toClientInsert({
    partnerId: partnerId ?? undefined,
    name: parsed.data.name,
    slug: parsed.data.slug,
    industry: parsed.data.industry,
    sizeRange: parsed.data.sizeRange,
    isActive: parsed.data.isActive,
  })

  const { data: created, error } = await db
    .from('clients')
    .insert(insert)
    .select('id')
    .single()

  if (error) return { error: { _form: [error.message] } }

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'client.created',
    targetTable: 'clients',
    targetId: created.id,
    partnerId,
    clientId: created.id,
    metadata: {
      slug: parsed.data.slug,
      isLocalDevelopmentBypass: scope.isLocalDevelopmentBypass,
      ownership: partnerId ? 'partner' : 'platform',
    },
  })

  revalidateDirectoryPaths()
  return { success: true as const, id: created.id, slug: parsed.data.slug }
}

export async function updateClient(id: string, formData: FormData) {
  const raw = {
    partnerId: (formData.get('partnerId') as string) || undefined,
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    industry: (formData.get('industry') as string) || undefined,
    sizeRange: (formData.get('sizeRange') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
  }

  const parsed = clientSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  let access
  try {
    access = await requireClientAccess(id, { includeArchived: true })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: { _form: [error.message] } }
    }
    throw error
  }

  if (!canManageClient(access.scope, id, access.partnerId)) {
    return { error: { _form: ['You do not have permission to update this client'] } }
  }

  let nextPartnerId = access.partnerId
  try {
    if (canManageClientAssignment(access.scope)) {
      nextPartnerId = parsed.data.partnerId
        ? await validateAssignablePartner(parsed.data.partnerId)
        : null
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: { _form: [error.message] } }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('clients')
    .update({
      partner_id: nextPartnerId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      industry: parsed.data.industry ?? null,
      size_range: parsed.data.sizeRange ?? null,
      is_active: parsed.data.isActive,
    })
    .eq('id', id)

  if (error) return { error: { _form: [error.message] } }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'client.updated',
    targetTable: 'clients',
    targetId: id,
    partnerId: nextPartnerId,
    clientId: id,
    metadata: {
      slug: parsed.data.slug,
      previousPartnerId: access.partnerId,
      nextPartnerId,
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidateDirectoryPaths()
  return { success: true as const, id, slug: parsed.data.slug }
}

export async function deleteClient(id: string) {
  let access
  try {
    access = await requireClientAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!canManageClient(access.scope, id, access.partnerId)) {
    return { error: 'You do not have permission to delete this client' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'client.deleted',
    targetTable: 'clients',
    targetId: id,
    partnerId: access.partnerId ?? null,
    clientId: id,
    metadata: {
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidateDirectoryPaths()
}

export async function getClientStats(clientId: string): Promise<{
  activeCampaignCount: number
  totalParticipants: number
  assignedAssessmentCount: number
  reportsGenerated: number
}> {
  await requireClientAccess(clientId)
  const db = await createSupabaseClient()

  // Group A: four independent queries scoped by client_id.
  // campaigns list (for ids) also returns the count for active campaigns
  // via a single query to avoid a duplicate round-trip.
  const [
    activeCampaignsResult,
    campaignIdsResult,
    assignedAssessmentsResult,
    reportsGeneratedResult,
  ] = await Promise.all([
    db
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'active')
      .is('deleted_at', null),
    db
      .from('campaigns')
      .select('id')
      .eq('client_id', clientId)
      .is('deleted_at', null),
    db
      .from('client_assessment_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('is_active', true),
    db
      .from('diagnostic_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId),
  ])

  const ids = (campaignIdsResult.data ?? []).map((c) => c.id)

  // Group B: participant count needs the campaign ids from Group A.
  let totalParticipants = 0
  if (ids.length > 0) {
    const { count } = await db
      .from('campaign_participants')
      .select('*', { count: 'exact', head: true })
      .in('campaign_id', ids)
    totalParticipants = count ?? 0
  }

  return {
    activeCampaignCount: activeCampaignsResult.count ?? 0,
    totalParticipants,
    assignedAssessmentCount: assignedAssessmentsResult.count ?? 0,
    reportsGenerated: reportsGeneratedResult.count ?? 0,
  }
}

export async function getRecentClientCampaigns(clientId: string): Promise<
  Array<{
    id: string
    title: string
    status: string
    participantCount: number
    completedCount: number
  }>
> {
  await requireClientAccess(clientId)
  const db = await createSupabaseClient()

  const { data, error } = await db
    .from('campaigns')
    .select('id, title, status, campaign_participants(count)')
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) return []

  return (data ?? []).map((row) => {
    const participantCount = row.campaign_participants
      ? ((row.campaign_participants as { count: number }[])[0]?.count ?? 0)
      : 0
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      participantCount,
      completedCount: 0,
    }
  })
}

export async function restoreClient(id: string) {
  let access
  try {
    access = await requireClientAccess(id, { includeArchived: true })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!canManageClient(access.scope, id, access.partnerId)) {
    return { error: 'You do not have permission to restore this client' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('clients')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'client.restored',
    targetTable: 'clients',
    targetId: id,
    partnerId: access.partnerId ?? null,
    clientId: id,
    metadata: {
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidateDirectoryPaths()
}

// ---------------------------------------------------------------------------
// Client Members
// ---------------------------------------------------------------------------

export interface ClientMember {
  membershipId: string
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  role: 'admin' | 'member'
  addedAt: string
}

export interface ClientPendingInvite {
  id: string
  email: string
  role: string
  createdAt: string
  expiresAt: string
}

export async function getClientMembers(clientId: string): Promise<ClientMember[]> {
  const access = await requireClientAccess(clientId)
  // Allow: platform admins, direct client admins, and partner admins of the parent partner
  const isPartnerAdminOfClient = access.partnerId
    ? access.scope.partnerAdminIds.includes(access.partnerId)
    : false
  if (
    !access.scope.isPlatformAdmin &&
    !access.scope.clientAdminIds.includes(clientId) &&
    !isPartnerAdminOfClient
  ) {
    return []
  }

  // Use admin client to bypass RLS — access is already verified above
  const db = createAdminClient()
  const { data, error } = await db
    .from('client_memberships')
    .select('id, profile_id, role, created_at, profiles!profile_id(id, email, first_name, last_name)')
    .eq('client_id', clientId)
    .is('revoked_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    throwActionError('getClientMembers', 'Unable to load client users.', error)
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

export async function getClientPendingInvites(clientId: string): Promise<ClientPendingInvite[]> {
  const access = await requireClientAccess(clientId)
  if (!access.scope.isPlatformAdmin && !access.scope.clientAdminIds.includes(clientId)) {
    return []
  }

  const db = await createSupabaseClient()
  const { data, error } = await db
    .from('user_invites')
    .select('id, email, role, created_at, expires_at')
    .eq('tenant_type', 'client')
    .eq('tenant_id', clientId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    throwActionError(
      'getClientPendingInvites',
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

export async function inviteUserToClient(
  clientId: string,
  input: { email: string; role: 'admin' | 'member' }
) {
  let access
  try {
    access = await requireClientAccess(clientId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!access.scope.isPlatformAdmin && !access.scope.clientAdminIds.includes(clientId)) {
    return { error: 'You do not have permission to invite users to this client' }
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
    .eq('tenant_type', 'client')
    .eq('tenant_id', clientId)
    .eq('email', input.email.trim().toLowerCase())
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (existing) {
    return { error: 'An invite is already pending for this email address' }
  }

  const inviteRole: InviteRole = input.role === 'admin' ? 'client_admin' : 'client_member'
  const invitedByProfileId = actorId ?? '00000000-0000-0000-0000-000000000000'

  const result = await createStaffInvite({
    email: input.email.trim().toLowerCase(),
    tenantType: 'client',
    tenantId: clientId,
    role: inviteRole,
    invitedByProfileId,
  })

  if ('error' in result) {
    const formErrors = result.error._form
    return { error: formErrors?.[0] ?? 'Failed to create invite' }
  }

  revalidatePath(`/clients`)
  return { success: true as const }
}

export async function changeClientMemberRole(
  clientId: string,
  membershipId: string,
  role: 'admin' | 'member'
) {
  let access
  try {
    access = await requireClientAccess(clientId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!access.scope.isPlatformAdmin && !access.scope.clientAdminIds.includes(clientId)) {
    return { error: 'You do not have permission to change member roles' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('client_memberships')
    .update({ role })
    .eq('id', membershipId)
    .eq('client_id', clientId)
    .is('revoked_at', null)

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'client_membership.role_changed',
    targetTable: 'client_memberships',
    targetId: membershipId,
    clientId,
    metadata: { newRole: role },
  })

  revalidatePath(`/clients`)
  return { success: true as const }
}

export async function removeClientMember(
  clientId: string,
  membershipId: string
) {
  let access
  try {
    access = await requireClientAccess(clientId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!access.scope.isPlatformAdmin && !access.scope.clientAdminIds.includes(clientId)) {
    return { error: 'You do not have permission to remove members' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('client_memberships')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by_profile_id: access.scope.actor?.id ?? null,
    })
    .eq('id', membershipId)
    .eq('client_id', clientId)
    .is('revoked_at', null)

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'client_membership.revoked',
    targetTable: 'client_memberships',
    targetId: membershipId,
    clientId,
    metadata: {},
  })

  revalidatePath(`/clients`)
  return { success: true as const }
}

export async function revokeClientInvite(
  clientId: string,
  inviteId: string
) {
  let access
  try {
    access = await requireClientAccess(clientId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!access.scope.isPlatformAdmin && !access.scope.clientAdminIds.includes(clientId)) {
    return { error: 'You do not have permission to revoke invites' }
  }

  const actorId = access.scope.actor?.id ?? '00000000-0000-0000-0000-000000000000'

  try {
    await revokeInvite(inviteId, actorId, { tenantType: 'client', tenantId: clientId })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to revoke invite' }
  }

  revalidatePath(`/clients`)
  return { success: true as const }
}
