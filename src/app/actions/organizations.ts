'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapOrganizationRow, toOrganizationInsert } from '@/lib/supabase/mappers'
import {
  AuthorizationError,
  canManageClient,
  canManageClientAssignment,
  canManageClientDirectory,
  getPreferredPartnerIdForClientCreation,
  requireOrganizationAccess,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { organizationSchema } from '@/lib/validations/organizations'
import type { Organization } from '@/types/database'

export type OrganizationWithCounts = Organization & {
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

function mapOrganizationWithCounts(row: Record<string, unknown>): OrganizationWithCounts {
  const partnerRow = getRelatedRecord(row.partners)

  return {
    ...mapOrganizationRow(row),
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
  revalidatePath('/organizations')
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

export async function getOrganizations(): Promise<OrganizationWithCounts[]> {
  const scope = await resolveAuthorizedScope()
  const db = createAdminClient()
  let query = db
    .from('organizations')
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

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => mapOrganizationWithCounts(row as Record<string, unknown>))
}

export async function getOrganizationDirectoryEntries(): Promise<OrganizationWithCounts[]> {
  const scope = await resolveAuthorizedScope()
  const db = createAdminClient()
  let query = db
    .from('organizations')
    .select('*, partners(name), assessments(count), diagnostic_sessions(count)')
    .order('name', { ascending: true })

  if (!scope.isPlatformAdmin) {
    if (scope.clientIds.length === 0) {
      return []
    }
    query = query.in('id', scope.clientIds)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => mapOrganizationWithCounts(row as Record<string, unknown>))
}

export async function getOrganizationBySlug(
  slug: string,
  options: { includeArchived?: boolean } = {}
): Promise<Organization | null> {
  const db = createAdminClient()
  let query = db
    .from('organizations')
    .select('*')
    .eq('slug', slug)

  if (!options.includeArchived) {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query.single()

  if (error) return null
  const scope = await resolveAuthorizedScope()
  const organization = mapOrganizationRow(data)

  const hasAccess =
    scope.isPlatformAdmin ||
    scope.clientIds.includes(organization.id) ||
    (organization.partnerId ? scope.partnerIds.includes(organization.partnerId) : false)

  if (!hasAccess) return null
  return organization
}

export async function createOrganization(formData: FormData) {
  const raw = {
    partnerId: (formData.get('partnerId') as string) || undefined,
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    industry: (formData.get('industry') as string) || undefined,
    sizeRange: (formData.get('sizeRange') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
  }

  const parsed = organizationSchema.safeParse(raw)
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
  const insert = toOrganizationInsert({
    partnerId: partnerId ?? undefined,
    name: parsed.data.name,
    slug: parsed.data.slug,
    industry: parsed.data.industry,
    sizeRange: parsed.data.sizeRange,
    isActive: parsed.data.isActive,
  })

  const { data: created, error } = await db
    .from('organizations')
    .insert(insert)
    .select('id')
    .single()

  if (error) return { error: { _form: [error.message] } }

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'client.created',
    targetTable: 'organizations',
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

export async function updateOrganization(id: string, formData: FormData) {
  const raw = {
    partnerId: (formData.get('partnerId') as string) || undefined,
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    industry: (formData.get('industry') as string) || undefined,
    sizeRange: (formData.get('sizeRange') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
  }

  const parsed = organizationSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  let access
  try {
    access = await requireOrganizationAccess(id, { includeArchived: true })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: { _form: [error.message] } }
    }
    throw error
  }

  if (!canManageClient(access.scope, id)) {
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
    .from('organizations')
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
    targetTable: 'organizations',
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

export async function deleteOrganization(id: string) {
  let access
  try {
    access = await requireOrganizationAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!canManageClient(access.scope, id)) {
    return { error: 'You do not have permission to delete this client' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('organizations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'client.deleted',
    targetTable: 'organizations',
    targetId: id,
    partnerId: access.partnerId ?? null,
    clientId: id,
    metadata: {
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidateDirectoryPaths()
}

export async function restoreOrganization(id: string) {
  let access
  try {
    access = await requireOrganizationAccess(id, { includeArchived: true })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!canManageClient(access.scope, id)) {
    return { error: 'You do not have permission to restore this client' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('organizations')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: error.message }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'client.restored',
    targetTable: 'organizations',
    targetId: id,
    partnerId: access.partnerId ?? null,
    clientId: id,
    metadata: {
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidateDirectoryPaths()
}
