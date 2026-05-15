'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { mapContentSourceRow } from '@/lib/supabase/mappers'
import { contentSourceSchema } from '@/lib/validations/content-sources'
import type { ContentSource } from '@/types/database'

export async function getContentSources(): Promise<ContentSource[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('content_sources')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapContentSourceRow)
}

export async function getContentSourceById(id: string): Promise<ContentSource | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('content_sources')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  return mapContentSourceRow(data)
}

export async function createContentSource(formData: FormData) {
  const scope = await requireAdminScope()
  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    notes: (formData.get('notes') as string) || undefined,
  }

  const parsed = contentSourceSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const { data, error: insertErr } = await db
    .from('content_sources')
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      notes: parsed.data.notes ?? null,
    })
    .select('id')
    .single()

  if (insertErr) return { error: { _form: [insertErr.message] } }

  revalidatePath('/settings/content-sources')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'content_source.created',
    targetTable: 'content_sources',
    targetId: data.id,
    metadata: { slug: parsed.data.slug },
  })

  return { success: true as const, id: data.id }
}

export async function updateContentSource(id: string, formData: FormData) {
  const scope = await requireAdminScope()
  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    notes: (formData.get('notes') as string) || undefined,
  }

  const parsed = contentSourceSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const { error: updateErr } = await db
    .from('content_sources')
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      notes: parsed.data.notes ?? null,
    })
    .eq('id', id)

  if (updateErr) return { error: { _form: [updateErr.message] } }

  revalidatePath('/settings/content-sources')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'content_source.updated',
    targetTable: 'content_sources',
    targetId: id,
    metadata: { slug: parsed.data.slug },
  })

  return { success: true as const }
}

export async function deleteContentSource(id: string) {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db.from('content_sources').delete().eq('id', id)
  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/settings/content-sources')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'content_source.deleted',
    targetTable: 'content_sources',
    targetId: id,
  })

  return { success: true as const }
}
