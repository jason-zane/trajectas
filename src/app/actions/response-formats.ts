'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { mapResponseFormatRow } from '@/lib/supabase/mappers'
import { responseFormatSchema } from '@/lib/validations/response-formats'
import type { ResponseFormat } from '@/types/database'

export type ResponseFormatWithMeta = ResponseFormat & { itemCount: number }

export async function getResponseFormats(): Promise<ResponseFormatWithMeta[]> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('response_formats')
    .select('*, items(count)')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    return {
      ...mapResponseFormatRow(row),
      itemCount: r.items?.[0]?.count ?? 0,
    }
  })
}

export async function getResponseFormatById(
  id: string,
): Promise<ResponseFormat | null> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('response_formats')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return mapResponseFormatRow(data)
}

export async function createResponseFormat(formData: FormData) {
  const scope = await requireAdminScope()
  const configRaw = formData.get('config') as string
  let config: Record<string, unknown> = {}
  try {
    config = configRaw ? JSON.parse(configRaw) : {}
  } catch {
    return { error: { _form: ['Invalid configuration JSON'] } }
  }

  const raw = {
    name: formData.get('name') as string,
    type: formData.get('type') as string,
    isActive: formData.get('isActive') as string,
    config,
  }

  const parsed = responseFormatSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  const { data, error: insertErr } = await db
    .from('response_formats')
    .insert({
      name: parsed.data.name,
      type: parsed.data.type,
      is_active: parsed.data.isActive,
      config: parsed.data.config,
    })
    .select('id')
    .single()

  if (insertErr) return { error: { _form: [insertErr.message] } }

  revalidatePath('/response-formats')
  revalidatePath('/items')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'response_format.created',
    targetTable: 'response_formats',
    targetId: data.id,
    metadata: {
      type: parsed.data.type,
      isActive: parsed.data.isActive,
    },
  })

  return { success: true, id: data.id }
}

export async function updateResponseFormat(id: string, formData: FormData) {
  const scope = await requireAdminScope()
  const configRaw = formData.get('config') as string
  let config: Record<string, unknown> = {}
  try {
    config = configRaw ? JSON.parse(configRaw) : {}
  } catch {
    return { error: { _form: ['Invalid configuration JSON'] } }
  }

  const raw = {
    name: formData.get('name') as string,
    type: formData.get('type') as string,
    isActive: formData.get('isActive') as string,
    config,
  }

  const parsed = responseFormatSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  const { error: updateErr } = await db
    .from('response_formats')
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      is_active: parsed.data.isActive,
      config: parsed.data.config,
    })
    .eq('id', id)

  if (updateErr) return { error: { _form: [updateErr.message] } }

  revalidatePath('/response-formats')
  revalidatePath('/items')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'response_format.updated',
    targetTable: 'response_formats',
    targetId: id,
    metadata: {
      type: parsed.data.type,
      isActive: parsed.data.isActive,
    },
  })

  return { success: true, id }
}

export type AnchorPresets = Record<string, Record<number, string[]>>

export async function getAnchorPresets(): Promise<AnchorPresets> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('anchor_presets')
    .select('type, points, anchors')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('points', { ascending: true })

  if (error) throw new Error(error.message)

  const presets: AnchorPresets = {}
  for (const row of data ?? []) {
    if (!presets[row.type]) presets[row.type] = {}
    presets[row.type][row.points] = row.anchors as string[]
  }
  return presets
}

export async function deleteResponseFormat(id: string) {
  const scope = await requireAdminScope()
  const db = createAdminClient()

  // Check for dependent items
  const { count, error: countErr } = await db
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('response_format_id', id)
    .is('deleted_at', null)

  if (countErr) return { error: countErr.message }

  if (count && count > 0) {
    return {
      error: `Cannot delete: ${count} item${count === 1 ? '' : 's'} use this format`,
    }
  }

  // Hard delete (response_formats has no soft-delete)
  const { error } = await db
    .from('response_formats')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/response-formats')
  revalidatePath('/items')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'response_format.deleted',
    targetTable: 'response_formats',
    targetId: id,
  })

  return { success: true }
}
