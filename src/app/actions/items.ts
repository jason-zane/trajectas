'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapItemRow, mapResponseFormatRow } from '@/lib/supabase/mappers'
import { itemSchema } from '@/lib/validations/items'
import type { Item, ResponseFormat } from '@/types/database'

export type ItemWithMeta = Item & {
  constructName: string
  factorName?: string
  responseFormatName: string
  responseFormatType: string
}

export type SelectOption = { id: string; name: string; slug?: string }

export async function getItems(): Promise<ItemWithMeta[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('items')
    .select('*, traits(name), competencies(name), response_formats(name, type)')
    .order('display_order', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    return {
      ...mapItemRow(row),
      constructName: r.traits?.name ?? '',
      factorName: r.competencies?.name ?? undefined,
      responseFormatName: r.response_formats?.name ?? '',
      responseFormatType: r.response_formats?.type ?? '',
    }
  })
}

export async function getItemById(id: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('items')
    .select('*, traits(name), competencies(name), response_formats(name, type), item_options(*), item_scoring_rubrics(*)')
    .eq('id', id)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any
  return {
    ...mapItemRow(data),
    constructName: r.traits?.name ?? '',
    factorName: r.competencies?.name ?? undefined,
    responseFormatName: r.response_formats?.name ?? '',
    responseFormatType: r.response_formats?.type ?? '',
    options: (r.item_options ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.display_order - b.display_order)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((o: any) => ({
        id: o.id,
        label: o.label,
        value: Number(o.value),
        displayOrder: o.display_order,
      })),
    rubrics: (r.item_scoring_rubrics ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((rb: any) => ({
        id: rb.id,
        optionId: rb.option_id ?? undefined,
        rubricLabel: rb.rubric_label,
        scoreValue: Number(rb.score_value),
        explanation: rb.explanation ?? undefined,
      })),
  }
}

export async function getConstructsForSelect(): Promise<SelectOption[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('traits')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getFactorsForSelect(): Promise<SelectOption[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('competencies')
    .select('id, name')
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

export async function getItemsForConstruct(traitId: string): Promise<ItemWithMeta[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('items')
    .select('*, traits(name), competencies(name), response_formats(name, type)')
    .eq('trait_id', traitId)
    .order('display_order', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    return {
      ...mapItemRow(row),
      constructName: r.traits?.name ?? '',
      factorName: r.competencies?.name ?? undefined,
      responseFormatName: r.response_formats?.name ?? '',
      responseFormatType: r.response_formats?.type ?? '',
    }
  })
}

export async function createItem(formData: FormData) {
  const optionsJson = formData.get('options') as string
  let options: { label: string; value: number; displayOrder: number }[] = []
  try {
    options = optionsJson ? JSON.parse(optionsJson) : []
  } catch {
    // ignore
  }

  const rubricsJson = formData.get('rubrics') as string
  let rubrics: { optionIndex: number; rubricLabel: string; scoreValue: number; explanation?: string }[] = []
  try {
    rubrics = rubricsJson ? JSON.parse(rubricsJson) : []
  } catch {
    // ignore
  }

  const returnTo = formData.get('returnTo') as string | null

  const raw = {
    traitId: formData.get('traitId') as string,
    competencyId: (formData.get('competencyId') as string) || undefined,
    responseFormatId: formData.get('responseFormatId') as string,
    stem: formData.get('stem') as string,
    reverseScored: formData.get('reverseScored') === 'true',
    status: (formData.get('status') as string) || 'draft',
    displayOrder: Number(formData.get('displayOrder') ?? 0),
    options,
    rubrics,
  }

  const parsed = itemSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  const { data: item, error: itemErr } = await db
    .from('items')
    .insert({
      trait_id: parsed.data.traitId,
      competency_id: parsed.data.competencyId || null,
      response_format_id: parsed.data.responseFormatId,
      stem: parsed.data.stem,
      reverse_scored: parsed.data.reverseScored,
      status: parsed.data.status,
      display_order: parsed.data.displayOrder,
    })
    .select('id')
    .single()

  if (itemErr) return { error: { _form: [itemErr.message] } }

  // Insert options
  if (parsed.data.options.length > 0) {
    const opts = parsed.data.options.map((o, i) => ({
      item_id: item.id,
      label: o.label,
      value: o.value,
      display_order: o.displayOrder ?? i + 1,
    }))
    const { data: insertedOptions } = await db.from('item_options').insert(opts).select('id')

    // Insert SJT rubrics linked to options
    if (parsed.data.rubrics.length > 0 && insertedOptions) {
      const rubricRows = parsed.data.rubrics
        .filter((rb) => rb.optionIndex < insertedOptions.length)
        .map((rb) => ({
          item_id: item.id,
          option_id: insertedOptions[rb.optionIndex].id,
          rubric_label: rb.rubricLabel,
          score_value: rb.scoreValue,
          explanation: rb.explanation ?? null,
        }))
      if (rubricRows.length > 0) {
        await db.from('item_scoring_rubrics').insert(rubricRows)
      }
    }
  }

  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')

  if (returnTo) {
    redirect(returnTo)
  }
  redirect('/items')
}

export async function updateItem(id: string, formData: FormData) {
  const optionsJson = formData.get('options') as string
  let options: { label: string; value: number; displayOrder: number }[] = []
  try {
    options = optionsJson ? JSON.parse(optionsJson) : []
  } catch {
    // ignore
  }

  const rubricsJson = formData.get('rubrics') as string
  let rubrics: { optionIndex: number; rubricLabel: string; scoreValue: number; explanation?: string }[] = []
  try {
    rubrics = rubricsJson ? JSON.parse(rubricsJson) : []
  } catch {
    // ignore
  }

  const returnTo = formData.get('returnTo') as string | null

  const raw = {
    traitId: formData.get('traitId') as string,
    competencyId: (formData.get('competencyId') as string) || undefined,
    responseFormatId: formData.get('responseFormatId') as string,
    stem: formData.get('stem') as string,
    reverseScored: formData.get('reverseScored') === 'true',
    status: (formData.get('status') as string) || 'draft',
    displayOrder: Number(formData.get('displayOrder') ?? 0),
    options,
    rubrics,
  }

  const parsed = itemSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  const { error: updateErr } = await db
    .from('items')
    .update({
      trait_id: parsed.data.traitId,
      competency_id: parsed.data.competencyId || null,
      response_format_id: parsed.data.responseFormatId,
      stem: parsed.data.stem,
      reverse_scored: parsed.data.reverseScored,
      status: parsed.data.status,
      display_order: parsed.data.displayOrder,
    })
    .eq('id', id)

  if (updateErr) return { error: { _form: [updateErr.message] } }

  // Replace options: delete old, insert new
  await db.from('item_scoring_rubrics').delete().eq('item_id', id)
  await db.from('item_options').delete().eq('item_id', id)

  if (parsed.data.options.length > 0) {
    const opts = parsed.data.options.map((o, i) => ({
      item_id: id,
      label: o.label,
      value: o.value,
      display_order: o.displayOrder ?? i + 1,
    }))
    const { data: insertedOptions } = await db.from('item_options').insert(opts).select('id')

    // Insert SJT rubrics linked to options
    if (parsed.data.rubrics.length > 0 && insertedOptions) {
      const rubricRows = parsed.data.rubrics
        .filter((rb) => rb.optionIndex < insertedOptions.length)
        .map((rb) => ({
          item_id: id,
          option_id: insertedOptions[rb.optionIndex].id,
          rubric_label: rb.rubricLabel,
          score_value: rb.scoreValue,
          explanation: rb.explanation ?? null,
        }))
      if (rubricRows.length > 0) {
        await db.from('item_scoring_rubrics').insert(rubricRows)
      }
    }
  }

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
  await db.from('item_scoring_rubrics').delete().eq('item_id', id)
  await db.from('item_options').delete().eq('item_id', id)
  const { error } = await db.from('items').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/items')
  revalidatePath('/constructs')
  revalidatePath('/')
  redirect('/items')
}
