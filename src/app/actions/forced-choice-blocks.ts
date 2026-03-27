'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapForcedChoiceBlockRow } from '@/lib/supabase/mappers'
import { forcedChoiceBlockSchema } from '@/lib/validations/items'
import type { ForcedChoiceBlock } from '@/types/database'

export type BlockWithMeta = ForcedChoiceBlock & {
  itemCount: number
  itemPreviews: string[]
}

export type BlockItemOption = {
  id: string
  stem: string
  constructName: string
}

export type BlockWithItems = ForcedChoiceBlock & {
  items: {
    id: string
    stem: string
    constructName: string
    position: number
  }[]
}

export async function getForcedChoiceBlocks(): Promise<BlockWithMeta[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('forced_choice_blocks')
    .select('*, forced_choice_block_items(count)')
    .is('deleted_at', null)
    .order('display_order', { ascending: true })

  if (error) throw new Error(error.message)

  // For each block, fetch first 2 item stems for preview
  const blocks: BlockWithMeta[] = []
  for (const row of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    const itemCount =
      Array.isArray(r.forced_choice_block_items) && r.forced_choice_block_items.length > 0
        ? r.forced_choice_block_items[0].count
        : 0

    // Fetch preview stems
    const { data: previewData } = await db
      .from('forced_choice_block_items')
      .select('items(stem)')
      .eq('block_id', row.id)
      .order('position', { ascending: true })
      .limit(2)

    const itemPreviews: string[] = (previewData ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pi: any) => pi.items?.stem ?? ''
    ).filter(Boolean)

    blocks.push({
      ...mapForcedChoiceBlockRow(row),
      itemCount,
      itemPreviews,
    })
  }

  return blocks
}

export async function getBlockById(id: string): Promise<BlockWithItems | null> {
  const db = createAdminClient()

  const { data, error } = await db
    .from('forced_choice_blocks')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null

  // Fetch linked items with construct names
  const { data: blockItems, error: biError } = await db
    .from('forced_choice_block_items')
    .select('*, items(stem, constructs(name))')
    .eq('block_id', id)
    .order('position', { ascending: true })

  if (biError) throw new Error(biError.message)

  const items = (blockItems ?? []).map((bi) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = bi as any
    return {
      id: r.item_id as string,
      stem: r.items?.stem ?? '',
      constructName: r.items?.constructs?.name ?? '',
      position: r.position as number,
    }
  })

  return {
    ...mapForcedChoiceBlockRow(data),
    items,
  }
}

export async function getItemsForBlockSelect(): Promise<BlockItemOption[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('items')
    .select('id, stem, constructs(name)')
    .eq('status', 'active')
    .eq('purpose', 'construct')
    .is('deleted_at', null)
    .order('stem', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    return {
      id: r.id,
      stem: r.stem,
      constructName: r.constructs?.name ?? '',
    }
  })
}

export async function createBlock(formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || undefined,
    itemIds: JSON.parse((formData.get('itemIds') as string) || '[]'),
  }

  const parsed = forcedChoiceBlockSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  // Get next display order
  const { data: maxRow } = await db
    .from('forced_choice_blocks')
    .select('display_order')
    .is('deleted_at', null)
    .order('display_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (maxRow?.display_order ?? 0) + 1

  const { data, error: blockErr } = await db
    .from('forced_choice_blocks')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      display_order: nextOrder,
    })
    .select('id')
    .single()

  if (blockErr) return { error: { _form: [blockErr.message] } }

  // Insert block items
  const blockItems = parsed.data.itemIds.map((itemId, index) => ({
    block_id: data.id,
    item_id: itemId,
    position: index,
  }))

  const { error: itemsErr } = await db
    .from('forced_choice_block_items')
    .insert(blockItems)

  if (itemsErr) return { error: { _form: [itemsErr.message] } }

  revalidatePath('/forced-choice-blocks')
  revalidatePath('/')

  return { success: true, id: data.id }
}

export async function updateBlock(id: string, formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || undefined,
    itemIds: JSON.parse((formData.get('itemIds') as string) || '[]'),
  }

  const parsed = forcedChoiceBlockSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  const { error: updateErr } = await db
    .from('forced_choice_blocks')
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .eq('id', id)

  if (updateErr) return { error: { _form: [updateErr.message] } }

  // Delete old item links
  const { error: deleteErr } = await db
    .from('forced_choice_block_items')
    .delete()
    .eq('block_id', id)

  if (deleteErr) return { error: { _form: [deleteErr.message] } }

  // Insert new item links
  const blockItems = parsed.data.itemIds.map((itemId, index) => ({
    block_id: id,
    item_id: itemId,
    position: index,
  }))

  const { error: itemsErr } = await db
    .from('forced_choice_block_items')
    .insert(blockItems)

  if (itemsErr) return { error: { _form: [itemsErr.message] } }

  revalidatePath('/forced-choice-blocks')
  revalidatePath('/')

  return { success: true, id }
}

export async function deleteBlock(id: string) {
  const db = createAdminClient()
  const { error } = await db
    .from('forced_choice_blocks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/forced-choice-blocks')
  revalidatePath('/')

  return { success: true }
}
