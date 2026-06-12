'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveSessionActor } from '@/lib/auth/actor'
import { revalidatePath } from 'next/cache'
import type {
  SavedComparison,
  SavedComparisonSummary,
  ShareScope,
} from '@/lib/comparison/saved-types'
import type { ColumnLevel, EntryRequest } from '@/lib/comparison/types'

type Row = {
  id: string
  owner_id: string
  name: string
  entries: EntryRequest[]
  assessment_ids: string[]
  visible_levels: string[]
  delta_mode: boolean
  share_scope: ShareScope
  client_id: string | null
  partner_id: string | null
  created_at: string
  updated_at: string
}

function toComparison(row: Row): SavedComparison {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    entries: row.entries,
    assessmentIds: row.assessment_ids,
    visibleLevels: row.visible_levels.filter(
      (l): l is ColumnLevel => l === 'dimension' || l === 'factor',
    ),
    deltaMode: row.delta_mode,
    shareScope: row.share_scope,
    clientId: row.client_id,
    partnerId: row.partner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Derives the scope a new saved comparison should be attached to from the
 * caller's active portal. Returns nulls for admin / platform scope.
 */
async function inferScope() {
  const actor = await resolveSessionActor()
  if (!actor) throw new Error('not authenticated')
  const ctx = actor.activeContext
  if (ctx?.tenantType === 'client' && ctx.tenantId) {
    return { clientId: ctx.tenantId, partnerId: null }
  }
  if (ctx?.tenantType === 'partner' && ctx.tenantId) {
    return { clientId: null, partnerId: ctx.tenantId }
  }
  return { clientId: null, partnerId: null }
}

export async function listSavedComparisons(): Promise<SavedComparisonSummary[]> {
  const supabase = await createClient()
  const actor = await resolveSessionActor()
  if (!actor) return []
  const { data, error } = await supabase
    .from('comparisons')
    .select('id, name, share_scope, owner_id, created_at, updated_at, entries, assessment_ids')
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    shareScope: r.share_scope as ShareScope,
    ownerId: r.owner_id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    entryCount: Array.isArray(r.entries) ? r.entries.length : 0,
    assessmentCount: Array.isArray(r.assessment_ids) ? r.assessment_ids.length : 0,
    isOwn: r.owner_id === actor.id,
  }))
}

export async function getSavedComparison(id: string): Promise<SavedComparison | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('comparisons')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toComparison(data as Row) : null
}

export async function saveComparison(input: {
  name: string
  entries: EntryRequest[]
  assessmentIds: string[]
  visibleLevels: ColumnLevel[]
  deltaMode: boolean
  shareScope?: ShareScope
}): Promise<SavedComparison> {
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')

  const supabase = await createClient()
  const actor = await resolveSessionActor()
  if (!actor) throw new Error('not authenticated')
  const scope = await inferScope()

  const { data, error } = await supabase
    .from('comparisons')
    .insert({
      owner_id: actor.id,
      name,
      entries: input.entries,
      assessment_ids: input.assessmentIds,
      visible_levels: input.visibleLevels,
      delta_mode: input.deltaMode,
      share_scope: input.shareScope ?? 'private',
      client_id: scope.clientId,
      partner_id: scope.partnerId,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/participants/compare')
  revalidatePath('/client/participants/compare')
  return toComparison(data as Row)
}

export async function updateSavedComparison(
  id: string,
  patch: Partial<{
    name: string
    entries: EntryRequest[]
    assessmentIds: string[]
    visibleLevels: ColumnLevel[]
    deltaMode: boolean
    shareScope: ShareScope
  }>,
): Promise<SavedComparison> {
  const supabase = await createClient()
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new Error('Name is required')
    update.name = name
  }
  if (patch.entries !== undefined) update.entries = patch.entries
  if (patch.assessmentIds !== undefined) update.assessment_ids = patch.assessmentIds
  if (patch.visibleLevels !== undefined) update.visible_levels = patch.visibleLevels
  if (patch.deltaMode !== undefined) update.delta_mode = patch.deltaMode
  if (patch.shareScope !== undefined) update.share_scope = patch.shareScope

  const { data, error } = await supabase
    .from('comparisons')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/participants/compare')
  revalidatePath('/client/participants/compare')
  return toComparison(data as Row)
}

export async function deleteSavedComparison(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('comparisons').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/participants/compare')
  revalidatePath('/client/participants/compare')
}
