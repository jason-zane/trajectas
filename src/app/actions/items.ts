'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { logActionError } from '@/lib/security/action-errors'
import { mapItemRow, mapResponseFormatRow } from '@/lib/supabase/mappers'
import { itemSchema } from '@/lib/validations/items'
import type { Item, ResponseFormat } from '@/types/database'

export type ItemWithMeta = Item & {
  constructName: string
  constructSlug: string
  responseFormatName: string
  responseFormatType: string
}

export type SelectOption = { id: string; name: string; slug?: string }

export async function getItems(): Promise<ItemWithMeta[]> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('items')
    .select('*, constructs(name, slug), response_formats(name, type)')
    .is('deleted_at', null)
    .order('display_order', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    return {
      ...mapItemRow(row),
      constructName: r.constructs?.name ?? '',
      constructSlug: r.constructs?.slug ?? '',
      responseFormatName: r.response_formats?.name ?? '',
      responseFormatType: r.response_formats?.type ?? '',
    }
  })
}

export async function getItemById(id: string) {
  await requireAdminScope()
  const db = createAdminClient()

  const { data, error } = await db
    .from('items')
    .select('*, constructs(name, slug), response_formats(name, type)')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any
  return {
    ...mapItemRow(data),
    constructName: r.constructs?.name ?? '',
    constructSlug: r.constructs?.slug ?? '',
    responseFormatName: r.response_formats?.name ?? '',
    responseFormatType: r.response_formats?.type ?? '',
  }
}

export async function getConstructsForSelect(): Promise<SelectOption[]> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('constructs')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getResponseFormats(): Promise<ResponseFormat[]> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('response_formats')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapResponseFormatRow)
}

export async function getItemsForConstruct(constructId: string): Promise<ItemWithMeta[]> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('items')
    .select('*, constructs(name, slug), response_formats(name, type)')
    .eq('construct_id', constructId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    return {
      ...mapItemRow(row),
      constructName: r.constructs?.name ?? '',
      constructSlug: r.constructs?.slug ?? '',
      responseFormatName: r.response_formats?.name ?? '',
      responseFormatType: r.response_formats?.type ?? '',
    }
  })
}

export async function createItem(formData: FormData) {
  const scope = await requireAdminScope()
  const purpose = (formData.get('purpose') as string) || 'construct'
  const raw = {
    purpose,
    constructId: purpose === 'construct' ? (formData.get('constructId') as string) : undefined,
    responseFormatId: formData.get('responseFormatId') as string,
    stem: formData.get('stem') as string,
    reverseScored: purpose === 'construct' ? formData.get('reverseScored') === 'true' : false,
    weight: purpose === 'construct' ? Number(formData.get('weight') ?? 1.0) : 1.0,
    status: (formData.get('status') as string) || 'draft',
    displayOrder: Number(formData.get('displayOrder') ?? 0),
    selectionPriority: Number(formData.get('selectionPriority') ?? 0),
    keyedAnswer: purpose === 'attention_check' ? Number(formData.get('keyedAnswer')) : undefined,
  }

  const parsed = itemSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  const { data, error: itemErr } = await db
    .from('items')
    .insert({
      purpose: parsed.data.purpose,
      construct_id: parsed.data.constructId ?? null,
      response_format_id: parsed.data.responseFormatId,
      stem: parsed.data.stem,
      reverse_scored: parsed.data.reverseScored,
      weight: parsed.data.weight,
      status: parsed.data.status,
      display_order: parsed.data.displayOrder,
      selection_priority: parsed.data.selectionPriority,
      keyed_answer: parsed.data.keyedAnswer ?? null,
    })
    .select('id')
    .single()

  if (itemErr) return { error: { _form: [itemErr.message] } }

  // Insert item options if provided
  const optionsJson = formData.get('options') as string
  if (optionsJson) {
    try {
      const options = JSON.parse(optionsJson) as { label: string; value: number }[]
      if (options.length > 0) {
        const optionRows = options.map((opt, i) => ({
          item_id: data.id,
          label: opt.label,
          value: opt.value,
          display_order: i + 1,
        }))
        const { error: insertOptErr } = await db.from('item_options').insert(optionRows)
        if (insertOptErr) logActionError('createItem', insertOptErr)
      }
    } catch {
      // ignore parse errors for options
    }
  }

  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'item.created',
    targetTable: 'items',
    targetId: data.id,
    metadata: {
      purpose: parsed.data.purpose,
      constructId: parsed.data.constructId ?? null,
      responseFormatId: parsed.data.responseFormatId,
    },
  })

  return { success: true, id: data.id }
}

export async function updateItem(id: string, formData: FormData) {
  const scope = await requireAdminScope()
  const purpose = (formData.get('purpose') as string) || 'construct'
  const raw = {
    purpose,
    constructId: purpose === 'construct' ? (formData.get('constructId') as string) : undefined,
    responseFormatId: formData.get('responseFormatId') as string,
    stem: formData.get('stem') as string,
    reverseScored: purpose === 'construct' ? formData.get('reverseScored') === 'true' : false,
    weight: purpose === 'construct' ? Number(formData.get('weight') ?? 1.0) : 1.0,
    status: (formData.get('status') as string) || 'draft',
    displayOrder: Number(formData.get('displayOrder') ?? 0),
    selectionPriority: Number(formData.get('selectionPriority') ?? 0),
    keyedAnswer: purpose === 'attention_check' ? Number(formData.get('keyedAnswer')) : undefined,
  }

  const parsed = itemSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  const { error: updateErr } = await db
    .from('items')
    .update({
      purpose: parsed.data.purpose,
      construct_id: parsed.data.constructId ?? null,
      response_format_id: parsed.data.responseFormatId,
      stem: parsed.data.stem,
      reverse_scored: parsed.data.reverseScored,
      weight: parsed.data.weight,
      status: parsed.data.status,
      display_order: parsed.data.displayOrder,
      selection_priority: parsed.data.selectionPriority,
      keyed_answer: parsed.data.keyedAnswer ?? null,
    })
    .eq('id', id)

  if (updateErr) return { error: { _form: [updateErr.message] } }

  // Replace item options if provided
  const optionsJson = formData.get('options') as string
  if (optionsJson) {
    try {
      const options = JSON.parse(optionsJson) as { label: string; value: number }[]
      // Delete existing options
      const { error: deleteOptErr } = await db.from('item_options').delete().eq('item_id', id)
      if (deleteOptErr) logActionError('updateItem', deleteOptErr)
      // Insert new options
      if (options.length > 0) {
        const optionRows = options.map((opt, i) => ({
          item_id: id,
          label: opt.label,
          value: opt.value,
          display_order: i + 1,
        }))
        const { error: insertOptErr } = await db.from('item_options').insert(optionRows)
        if (insertOptErr) logActionError('updateItem', insertOptErr)
      }
    } catch {
      // ignore parse errors for options
    }
  }

  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'item.updated',
    targetTable: 'items',
    targetId: id,
    metadata: {
      purpose: parsed.data.purpose,
      constructId: parsed.data.constructId ?? null,
      responseFormatId: parsed.data.responseFormatId,
    },
  })

  return { success: true, id }
}

export async function deleteItem(id: string) {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db
    .from('items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'item.deleted',
    targetTable: 'items',
    targetId: id,
  })

  return { success: true }
}

export async function deleteItems(ids: string[]) {
  const scope = await requireAdminScope()
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return { error: 'Select at least one item.' }
  }

  const db = createAdminClient()
  const timestamp = new Date().toISOString()
  const { error } = await db
    .from('items')
    .update({ deleted_at: timestamp })
    .in('id', uniqueIds)

  if (error) return { error: error.message }

  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'item.bulk_deleted',
    targetTable: 'items',
    metadata: {
      ids: uniqueIds,
      count: uniqueIds.length,
    },
  })

  return { success: true as const, count: uniqueIds.length }
}

export async function restoreItem(id: string) {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db
    .from('items')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'item.restored',
    targetTable: 'items',
    targetId: id,
  })

  return { success: true }
}

export async function bulkUpdateItemStatus(
  ids: string[],
  status: 'draft' | 'active' | 'archived',
) {
  const scope = await requireAdminScope()
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return { error: 'Select at least one item.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('items')
    .update({ status })
    .in('id', uniqueIds)

  if (error) return { error: error.message }

  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'item.bulk_status_updated',
    targetTable: 'items',
    metadata: {
      ids: uniqueIds,
      count: uniqueIds.length,
      status,
    },
  })

  return { success: true as const, count: uniqueIds.length }
}

export async function restoreItems(ids: string[]) {
  const scope = await requireAdminScope()
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return { error: 'Select at least one item.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('items')
    .update({ deleted_at: null })
    .in('id', uniqueIds)

  if (error) return { error: error.message }

  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'item.bulk_restored',
    targetTable: 'items',
    metadata: {
      ids: uniqueIds,
      count: uniqueIds.length,
    },
  })

  return { success: true, count: uniqueIds.length }
}

export async function getItemOptions(itemId: string): Promise<{ label: string; value: number }[]> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('item_options')
    .select('label, value, display_order')
    .eq('item_id', itemId)
    .order('display_order', { ascending: true })

  if (error || !data) return []
  return data.map((row) => ({ label: row.label, value: Number(row.value) }))
}

export async function getItemParameters(itemId: string) {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('item_parameters')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return {
    id: data.id,
    modelType: data.model_type as string,
    discrimination: Number(data.discrimination),
    difficulty: Number(data.difficulty),
    guessing: Number(data.guessing),
    calibrationDate: data.calibration_date,
    sampleSize: data.sample_size,
  }
}

const ALLOWED_ITEM_FIELDS = ['stem'] as const
type AllowedItemField = (typeof ALLOWED_ITEM_FIELDS)[number]

export async function updateItemField(id: string, field: string, value: string) {
  const scope = await requireAdminScope()
  if (!ALLOWED_ITEM_FIELDS.includes(field as AllowedItemField)) {
    return { error: `Field "${field}" is not allowed` }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('items')
    .update({ [field]: value })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/items')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'item.field_updated',
    targetTable: 'items',
    targetId: id,
    metadata: { field },
  })

  return { success: true }
}
