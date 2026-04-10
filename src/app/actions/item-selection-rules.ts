'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope, canManageAssessmentLibrary, resolveAuthorizedScope, AuthorizationError } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { itemSelectionRulesArraySchema } from '@/lib/validations/item-selection-rules'
import type { ItemSelectionRule } from '@/types/database'

function mapRuleRow(row: Record<string, unknown>): ItemSelectionRule {
  return {
    id: String(row.id),
    minConstructs: Number(row.min_constructs),
    maxConstructs: row.max_constructs != null ? Number(row.max_constructs) : null,
    itemsPerConstruct: Number(row.items_per_construct),
    displayOrder: Number(row.display_order),
    created_at: String(row.created_at),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  }
}

export async function getItemSelectionRules(): Promise<ItemSelectionRule[]> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('item_selection_rules')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRuleRow(row as Record<string, unknown>))
}

/**
 * Read-only rules for client-side estimate calculations (no admin scope required).
 * Returns only the fields needed for the factor picker summary bar.
 */
export async function getItemSelectionRulesForEstimate(): Promise<
  Array<{ minConstructs: number; maxConstructs: number | null; itemsPerConstruct: number }>
> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('item_selection_rules')
    .select('min_constructs, max_constructs, items_per_construct')
    .order('display_order', { ascending: true })

  if (error) return []
  return (data ?? []).map((row) => ({
    minConstructs: Number(row.min_constructs),
    maxConstructs: row.max_constructs != null ? Number(row.max_constructs) : null,
    itemsPerConstruct: Number(row.items_per_construct),
  }))
}

export async function upsertItemSelectionRules(
  rules: { minConstructs: number; maxConstructs: number | null; itemsPerConstruct: number; displayOrder: number }[]
) {
  const scope = await requireAdminScope()

  const parsed = itemSelectionRulesArraySchema.safeParse(rules)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  // Atomic replace: delete all then insert
  const { error: deleteErr } = await db
    .from('item_selection_rules')
    .delete()
    .gte('id', '00000000-0000-0000-0000-000000000000')

  if (deleteErr) return { error: { _form: [deleteErr.message] } }

  const inserts = parsed.data.map((rule, i) => ({
    min_constructs: rule.minConstructs,
    max_constructs: rule.maxConstructs,
    items_per_construct: rule.itemsPerConstruct,
    display_order: i,
  }))

  const { error: insertErr } = await db
    .from('item_selection_rules')
    .insert(inserts)

  if (insertErr) return { error: { _form: [insertErr.message] } }

  revalidatePath('/assessments')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'item_selection_rules.updated',
    targetTable: 'item_selection_rules',
    metadata: { ruleCount: inserts.length },
  })

  return { success: true as const }
}

/**
 * Look up the items_per_construct limit for a given construct count.
 * Returns null if no rules are configured (fall back to no limit).
 */
export async function getItemsPerConstructForCount(
  constructCount: number
): Promise<number | null> {
  if (constructCount <= 0) return null

  const db = createAdminClient()
  const { data, error } = await db
    .from('item_selection_rules')
    .select('items_per_construct')
    .lte('min_constructs', constructCount)
    .or(`max_constructs.gte.${constructCount},max_constructs.is.null`)
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return Number(data.items_per_construct)
}

export type ConstructShortfall = {
  constructId: string
  constructName: string
  available: number
  target: number
}

/**
 * Compute the per-construct item limit for a set of factor IDs.
 * Returns construct count, items per construct, and any shortfalls.
 */
export async function getItemsPerConstructLimit(factorIds: string[]): Promise<{
  constructCount: number
  itemsPerConstruct: number | null
  shortfalls: ConstructShortfall[]
}> {
  const scope = await resolveAuthorizedScope()
  if (!canManageAssessmentLibrary(scope)) {
    throw new AuthorizationError('You do not have permission to manage assessments.')
  }
  if (factorIds.length === 0) {
    return { constructCount: 0, itemsPerConstruct: null, shortfalls: [] }
  }

  const db = createAdminClient()

  // Get unique construct IDs for these factors
  const { data: links } = await db
    .from('factor_constructs')
    .select('construct_id')
    .in('factor_id', factorIds)

  const constructIds = [...new Set((links ?? []).map((l) => l.construct_id))]
  if (constructIds.length === 0) {
    return { constructCount: 0, itemsPerConstruct: null, shortfalls: [] }
  }

  const constructCount = constructIds.length
  const itemsPerConstruct = await getItemsPerConstructForCount(constructCount)

  if (itemsPerConstruct === null) {
    return { constructCount, itemsPerConstruct: null, shortfalls: [] }
  }

  // Count available active items per construct
  const { data: items } = await db
    .from('items')
    .select('construct_id, constructs(name)')
    .in('construct_id', constructIds)
    .eq('status', 'active')
    .is('deleted_at', null)

  const countByConstruct = new Map<string, { count: number; name: string }>()
  for (const item of items ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = (item as any).constructs?.name ?? ''
    const existing = countByConstruct.get(item.construct_id)
    if (existing) {
      existing.count++
    } else {
      countByConstruct.set(item.construct_id, { count: 1, name })
    }
  }

  const shortfalls: ConstructShortfall[] = []
  for (const cId of constructIds) {
    const info = countByConstruct.get(cId)
    const available = info?.count ?? 0
    if (available < itemsPerConstruct) {
      shortfalls.push({
        constructId: cId,
        constructName: info?.name ?? 'Unknown',
        available,
        target: itemsPerConstruct,
      })
    }
  }

  return { constructCount, itemsPerConstruct, shortfalls }
}
