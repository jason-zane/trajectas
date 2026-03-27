'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const db = createAdminClient()
  const { data, error } = await db
    .from('items')
    .select('*, constructs(name, slug), response_formats(name, type)')
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
  const db = createAdminClient()

  const { data, error } = await db
    .from('items')
    .select('*, constructs(name, slug), response_formats(name, type)')
    .eq('id', id)
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
  const db = createAdminClient()
  const { data, error } = await db
    .from('items')
    .select('*, constructs(name, slug), response_formats(name, type)')
    .eq('construct_id', constructId)
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
  const returnTo = formData.get('returnTo') as string | null

  const raw = {
    constructId: formData.get('constructId') as string,
    responseFormatId: formData.get('responseFormatId') as string,
    stem: formData.get('stem') as string,
    reverseScored: formData.get('reverseScored') === 'true',
    status: (formData.get('status') as string) || 'draft',
    displayOrder: Number(formData.get('displayOrder') ?? 0),
  }

  const parsed = itemSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  const { error: itemErr } = await db
    .from('items')
    .insert({
      construct_id: parsed.data.constructId,
      response_format_id: parsed.data.responseFormatId,
      stem: parsed.data.stem,
      reverse_scored: parsed.data.reverseScored,
      status: parsed.data.status,
      display_order: parsed.data.displayOrder,
    })
    .select('id')
    .single()

  if (itemErr) return { error: { _form: [itemErr.message] } }

  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')

  if (returnTo) {
    redirect(returnTo)
  }
  redirect('/items')
}

export async function updateItem(id: string, formData: FormData) {
  const returnTo = formData.get('returnTo') as string | null

  const raw = {
    constructId: formData.get('constructId') as string,
    responseFormatId: formData.get('responseFormatId') as string,
    stem: formData.get('stem') as string,
    reverseScored: formData.get('reverseScored') === 'true',
    status: (formData.get('status') as string) || 'draft',
    displayOrder: Number(formData.get('displayOrder') ?? 0),
  }

  const parsed = itemSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  const { error: updateErr } = await db
    .from('items')
    .update({
      construct_id: parsed.data.constructId,
      response_format_id: parsed.data.responseFormatId,
      stem: parsed.data.stem,
      reverse_scored: parsed.data.reverseScored,
      status: parsed.data.status,
      display_order: parsed.data.displayOrder,
    })
    .eq('id', id)

  if (updateErr) return { error: { _form: [updateErr.message] } }

  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')

  if (returnTo) {
    redirect(returnTo)
  }
  redirect('/items')
}

export async function deleteItem(id: string) {
  const db = createAdminClient()
  const { error } = await db.from('items').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')
  redirect('/items')
}
