'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapPartnerRow, toPartnerInsert } from '@/lib/supabase/mappers'
import {
  AuthorizationError,
  canManagePartnerDirectory,
  requireAdminScope,
  requirePartnerAccess,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { partnerSchema } from '@/lib/validations/partners'
import type { Partner } from '@/types/database'

export type PartnerWithCounts = Partner & {
  clientCount: number
}

function revalidateDirectoryPaths() {
  revalidatePath('/directory')
  revalidatePath('/organizations')
  revalidatePath('/partners')
  revalidatePath('/')
}

export async function getPartners(): Promise<PartnerWithCounts[]> {
  const scope = await resolveAuthorizedScope()

  if (!scope.isPlatformAdmin) {
    return []
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('partners')
    .select('*, organizations(count)')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    ...mapPartnerRow(row),
    clientCount: row.organizations
      ? ((row.organizations as { count: number }[])[0]?.count ?? 0)
      : 0,
  }))
}

export async function getAssignablePartners(): Promise<Partner[]> {
  const scope = await resolveAuthorizedScope()

  if (!canManagePartnerDirectory(scope)) {
    return []
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('partners')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map(mapPartnerRow)
}

export async function getPartnerBySlug(
  slug: string,
  options: { includeArchived?: boolean } = {}
): Promise<Partner | null> {
  await requireAdminScope()

  const db = createAdminClient()
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

  if (error) return { error: { _form: [error.message] } }

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

  if (error) return { error: { _form: [error.message] } }

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

  if (error) return { error: error.message }

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

  if (error) return { error: error.message }

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
