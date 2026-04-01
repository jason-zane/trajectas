'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { mapConstructRow, toConstructInsert } from '@/lib/supabase/mappers'
import { constructSchema } from '@/lib/validations/constructs'
import type { Construct } from '@/types/database'

export type SelectOption = { id: string; name: string }

export async function getFactorsForSelect(): Promise<SelectOption[]> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data } = await db
    .from('factors')
    .select('id, name')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('name', { ascending: true })
  return data ?? []
}

export type ConstructWithCounts = Construct & {
  factorCount: number
  itemCount: number
  dimensionNames: string[]
}

export type ConstructWithRelationships = Construct & {
  linkedItems: { id: string; stem: string; status: string; responseFormatType?: string }[]
  parentFactors: { id: string; name: string; slug: string }[]
}

export async function getConstructs(): Promise<ConstructWithCounts[]> {
  await requireAdminScope()
  const db = createAdminClient()

  // Three queries: count can't mix with nested relations in PostgREST
  const [countResult, itemCountResult, relResult] = await Promise.all([
    db
      .from('constructs')
      .select('id, factor_constructs(count)')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    db
      .from('constructs')
      .select('id, items(count)')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    db
      .from('constructs')
      .select('*, factor_constructs(factors(dimensions(name)))')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  if (relResult.error) throw new Error(relResult.error.message)

  // Build count lookups
  const countMap = new Map<string, number>()
  for (const row of countResult.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    countMap.set(r.id, r.factor_constructs?.[0]?.count ?? 0)
  }

  const itemCountMap = new Map<string, number>()
  for (const row of itemCountResult.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    itemCountMap.set(r.id, r.items?.[0]?.count ?? 0)
  }

  return (relResult.data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    const fcRows = r.factor_constructs ?? []

    // Collect dimension names through the factor chain
    const dimNames = new Set<string>()
    for (const fc of fcRows) {
      const dimName = fc.factors?.dimensions?.name
      if (dimName) dimNames.add(dimName)
    }

    return {
      ...mapConstructRow(row),
      factorCount: countMap.get(r.id) ?? 0,
      itemCount: itemCountMap.get(r.id) ?? 0,
      dimensionNames: Array.from(dimNames).sort(),
    }
  })
}

export async function getConstructBySlug(slug: string): Promise<ConstructWithRelationships | null> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('constructs')
    .select('*, items(id, stem, status, response_formats(type)), factor_constructs(*, factors(id, name, slug))')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any
  return {
    ...mapConstructRow(data),
    linkedItems: (r.items ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any) => ({
        id: item.id,
        stem: item.stem,
        status: item.status,
        responseFormatType: item.response_formats?.type ?? undefined,
      })
    ),
    parentFactors: (r.factor_constructs ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fc: any) => ({
        id: fc.factors?.id ?? fc.factor_id,
        name: fc.factors?.name ?? '',
        slug: fc.factors?.slug ?? '',
      })
    ),
  }
}

export async function createConstruct(formData: FormData) {
  const scope = await requireAdminScope()
  const parentFactorId = (formData.get('parentFactorId') as string) || undefined

  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: (formData.get('description') as string) || undefined,
    definition: (formData.get('definition') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
    indicatorsLow: (formData.get('indicatorsLow') as string) || undefined,
    indicatorsMid: (formData.get('indicatorsMid') as string) || undefined,
    indicatorsHigh: (formData.get('indicatorsHigh') as string) || undefined,
  }

  const parsed = constructSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const insert = toConstructInsert(parsed.data)
  const { data, error } = await db.from('constructs').insert(insert).select('id').single()
  if (error) return { error: { _form: [error.message] } }

  // Link to parent factor if one was selected
  if (parentFactorId) {
    const { data: maxOrder } = await db
      .from('factor_constructs')
      .select('display_order')
      .eq('factor_id', parentFactorId)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { display_order: number } | null }

    await db.from('factor_constructs').insert({
      factor_id: parentFactorId,
      construct_id: data.id,
      weight: 1.0,
      display_order: (maxOrder?.display_order ?? 0) + 1,
    })
    revalidatePath('/factors')
  }

  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'construct.created',
    targetTable: 'constructs',
    targetId: data.id,
    metadata: {
      slug: parsed.data.slug,
      parentFactorId: parentFactorId ?? null,
    },
  })
  return { success: true, id: data.id, slug: parsed.data.slug }
}

export async function updateConstruct(id: string, formData: FormData) {
  const scope = await requireAdminScope()
  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: (formData.get('description') as string) || undefined,
    definition: (formData.get('definition') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
    indicatorsLow: (formData.get('indicatorsLow') as string) || undefined,
    indicatorsMid: (formData.get('indicatorsMid') as string) || undefined,
    indicatorsHigh: (formData.get('indicatorsHigh') as string) || undefined,
  }

  const parsed = constructSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('constructs')
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      definition: parsed.data.definition ?? null,
      is_active: parsed.data.isActive,
      indicators_low: parsed.data.indicatorsLow ?? null,
      indicators_mid: parsed.data.indicatorsMid ?? null,
      indicators_high: parsed.data.indicatorsHigh ?? null,
    })
    .eq('id', id)

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'construct.updated',
    targetTable: 'constructs',
    targetId: id,
    metadata: { slug: parsed.data.slug },
  })
  return { success: true, id, slug: parsed.data.slug }
}

export async function deleteConstruct(id: string) {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db
    .from('constructs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'construct.deleted',
    targetTable: 'constructs',
    targetId: id,
  })
  return { success: true as const }
}

export async function deleteConstructs(ids: string[]) {
  const scope = await requireAdminScope()
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return { error: 'Select at least one construct.' }
  }

  const db = createAdminClient()
  const timestamp = new Date().toISOString()
  const { error } = await db
    .from('constructs')
    .update({ deleted_at: timestamp })
    .in('id', uniqueIds)
  if (error) return { error: error.message }

  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'construct.bulk_deleted',
    targetTable: 'constructs',
    metadata: {
      ids: uniqueIds,
      count: uniqueIds.length,
    },
  })
  return { success: true as const, count: uniqueIds.length }
}

export async function restoreConstruct(id: string) {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db
    .from('constructs')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'construct.restored',
    targetTable: 'constructs',
    targetId: id,
  })
  return { success: true as const }
}

export async function restoreConstructs(ids: string[]) {
  const scope = await requireAdminScope()
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return { error: 'Select at least one construct.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('constructs')
    .update({ deleted_at: null })
    .in('id', uniqueIds)
  if (error) return { error: error.message }

  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'construct.bulk_restored',
    targetTable: 'constructs',
    metadata: {
      ids: uniqueIds,
      count: uniqueIds.length,
    },
  })
  return { success: true as const, count: uniqueIds.length }
}

export async function toggleConstructActive(id: string, isActive: boolean) {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db
    .from('constructs')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/constructs')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'construct.active_toggled',
    targetTable: 'constructs',
    targetId: id,
    metadata: { isActive },
  })
}

const ALLOWED_FIELDS: Record<string, string> = {
  description: 'description',
  definition: 'definition',
  indicatorsLow: 'indicators_low',
  indicators_low: 'indicators_low',
  indicatorsMid: 'indicators_mid',
  indicators_mid: 'indicators_mid',
  indicatorsHigh: 'indicators_high',
  indicators_high: 'indicators_high',
  developmentSuggestion: 'development_suggestion',
  strengthCommentary: 'strength_commentary',
}

export async function updateConstructField(id: string, field: string, value: string) {
  const scope = await requireAdminScope()
  const dbField = ALLOWED_FIELDS[field]
  if (!dbField) {
    return { error: `Field "${field}" is not allowed` }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('constructs')
    .update({ [dbField]: value || null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/constructs')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'construct.field_updated',
    targetTable: 'constructs',
    targetId: id,
    metadata: { field },
  })
  return { success: true }
}

// ---------------------------------------------------------------------------
// Bulk field save from generation wizard refinement
// ---------------------------------------------------------------------------

export async function saveConstructDraftToLibrary(
  constructId: string,
  fields: Partial<Record<string, string>>,
): Promise<
  | { success: true; updatedFields: string[]; savedValues: Record<string, string> }
  | { success: false; error: string }
> {
  const scope = await requireAdminScope()

  // Validate and map field names
  const updatePayload: Record<string, string | null> = {}
  const updatedFields: string[] = []
  const savedValues: Record<string, string> = {}

  for (const [field, value] of Object.entries(fields)) {
    const dbField = ALLOWED_FIELDS[field]
    if (!dbField) continue
    updatePayload[dbField] = value || null
    updatedFields.push(field)
    savedValues[field] = value ?? ''
  }

  if (updatedFields.length === 0) {
    return { success: false, error: 'No valid fields to update' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('constructs')
    .update(updatePayload)
    .eq('id', constructId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/constructs')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'construct.draft_saved_to_library',
    targetTable: 'constructs',
    targetId: constructId,
    metadata: { updatedFields },
  })

  return { success: true, updatedFields, savedValues }
}
