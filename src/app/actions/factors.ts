'use server'

import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAdminScope } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { throwActionError } from '@/lib/security/action-errors'
import { mapFactorRow } from '@/lib/supabase/mappers'
import { factorSchema } from '@/lib/validations/factors'
import { factorReadiness } from '@/lib/library/factor-completeness'
import { runFieldAssist, type AssistField } from '@/lib/ai/library-field-assist'
import type { Factor } from '@/types/database'

/** Parse a JSON-encoded string array from FormData; returns [] on anything unexpected. */
function parseStringArray(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string' || value.length === 0) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export type FactorWithMeta = Factor & {
  dimensionName?: string
  clientName?: string
  constructCount: number
  itemCount: number
  assessmentCount: number
}

export type LinkedAssessment = { id: string; name: string; status: string }

export type SelectOption = { id: string; name: string }

async function getFactorsImpl(): Promise<FactorWithMeta[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('factors')
    .select('*, dimensions(name), clients(name), factor_constructs(count), assessment_factors(count)')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    throwActionError('getFactors', 'Unable to load factors.', error)
  }

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    return {
      ...mapFactorRow(row),
      dimensionName: r.dimensions?.name ?? undefined,
      clientName: r.clients?.name ?? undefined,
      constructCount: r.factor_constructs?.[0]?.count ?? 0,
      itemCount: 0,
      assessmentCount: r.assessment_factors?.[0]?.count ?? 0,
    }
  })
}

const getFactorsCached = unstable_cache(
  getFactorsImpl,
  ['factors'],
  {
    revalidate: 300,
    tags: ['taxonomy'],
  }
)

export async function getFactors(): Promise<FactorWithMeta[]> {
  await requireAdminScope()
  return getFactorsCached()
}

async function getFactorBySlugImpl(slug: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('factors')
    .select('*, dimensions(name), clients(name), factor_constructs(*, constructs(id, name, slug)), assessment_factors(assessment_id, assessments(id, title, status))')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any

  // Active item count across the factor's constructs (for the readiness meter).
  const constructIds = (r.factor_constructs ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((fc: any) => fc.construct_id)
    .filter(Boolean)
  let activeItemCount = 0
  if (constructIds.length > 0) {
    const { count } = await db
      .from('items')
      .select('id', { count: 'exact', head: true })
      .in('construct_id', constructIds)
      .eq('status', 'active')
      .is('deleted_at', null)
    activeItemCount = count ?? 0
  }

  return {
    ...mapFactorRow(data),
    activeItemCount,
    dimensionName: r.dimensions?.name ?? undefined,
    clientName: r.clients?.name ?? undefined,
    linkedConstructs: (r.factor_constructs ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fc: any) => ({
        id: fc.id,
        constructId: fc.construct_id,
        name: fc.constructs?.name ?? '',
        weight: Number(fc.weight),
        displayOrder: fc.display_order,
      })
    ),
    linkedAssessments: (r.assessment_factors ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((ac: any) => ac.assessments)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((ac: any) => ({
        id: ac.assessments.id,
        name: ac.assessments.title,
        status: ac.assessments.status,
      })) as LinkedAssessment[],
  }
}

const getFactorBySlugCached = unstable_cache(
  getFactorBySlugImpl,
  ['factor-by-slug'],
  {
    revalidate: 300,
    tags: ['taxonomy'],
  }
)

export async function getFactorBySlug(slug: string) {
  await requireAdminScope()
  return getFactorBySlugCached(slug)
}

/**
 * Draft one library metadata field for a factor with AI. Returns suggested text
 * (for contrasts_with, a comma-separated slug list) for the admin to review/edit.
 */
export async function draftFactorField(
  factorId: string,
  field: AssistField,
): Promise<{ text: string } | { error: string }> {
  await requireAdminScope()
  const db = await createClient()
  const { data: f } = await db
    .from('factors')
    .select('name, definition, indicators_high, primary_category_id')
    .eq('id', factorId)
    .single()
  if (!f) return { error: 'Factor not found.' }

  let categoryName: string | null = null
  if (f.primary_category_id) {
    const { data: cat } = await db
      .from('library_categories')
      .select('name')
      .eq('id', f.primary_category_id)
      .single()
    categoryName = cat?.name ?? null
  }

  let candidates: { slug: string; name: string }[] | undefined
  if (field === 'contrasts_with') {
    const { data: others } = await db
      .from('factors')
      .select('name, slug')
      .neq('id', factorId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true })
    candidates = (others ?? []).map((o) => ({ slug: o.slug as string, name: o.name as string }))
  }

  try {
    const text = await runFieldAssist({
      field,
      factor: {
        name: f.name as string,
        categoryName,
        definition: f.definition as string | null,
        indicatorsHigh: f.indicators_high as string | null,
      },
      candidates,
    })
    return { text }
  } catch {
    return { error: 'Could not draft that field. Try again in a moment.' }
  }
}

/** Recompute a factor's readiness and demote it if an edit dropped it below its tier. */
async function reconcileFactorReadiness(
  db: ReturnType<typeof createAdminClient>,
  id: string,
): Promise<void> {
  const { data } = await db
    .from('factors')
    .select('*, factor_constructs(construct_id)')
    .eq('id', id)
    .single()
  if (!data) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = data as any
  const current: string = f.readiness ?? 'draft'
  if (current === 'draft') return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const constructIds = (f.factor_constructs ?? []).map((fc: any) => fc.construct_id).filter(Boolean)
  let activeItemCount = 0
  if (constructIds.length > 0) {
    const { count } = await db
      .from('items')
      .select('id', { count: 'exact', head: true })
      .in('construct_id', constructIds)
      .eq('status', 'active')
      .is('deleted_at', null)
    activeItemCount = count ?? 0
  }
  const r = factorReadiness({
    primaryCategoryId: f.primary_category_id,
    definition: f.definition,
    description: f.description,
    indicatorsLow: f.indicators_low,
    indicatorsMid: f.indicators_mid,
    indicatorsHigh: f.indicators_high,
    anchorLow: f.anchor_low,
    anchorHigh: f.anchor_high,
    applicableOutcomes: f.applicable_outcomes ?? [],
    applicableLevels: f.applicable_levels ?? [],
    overuseSignature: f.overuse_signature,
    contrastsWith: f.contrasts_with ?? [],
    theoreticalLineage: f.theoretical_lineage,
    constructCount: constructIds.length,
    activeItemCount,
  })
  const rank = { draft: 0, assessment_ready: 1, match_ready: 2 } as const
  const highest: keyof typeof rank = r.match.met
    ? 'match_ready'
    : r.assessment.met
      ? 'assessment_ready'
      : 'draft'
  if (rank[highest] < rank[current as keyof typeof rank]) {
    const update: Record<string, unknown> = { readiness: highest }
    if (highest !== 'match_ready') update.is_match_eligible = false
    await db.from('factors').update(update).eq('id', id)
  }
}

/**
 * Promote a factor to a readiness tier, enforcing the completeness bar at the
 * server. The only promote path today; DB-level enforcement moves in when
 * Phase 3 adds AI/bulk promotion.
 */
export async function promoteFactor(
  id: string,
  tier: 'assessment_ready' | 'match_ready',
): Promise<{ success: true; readiness: string } | { error: string }> {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('factors')
    .select('*, factor_constructs(construct_id)')
    .eq('id', id)
    .single()
  if (error || !data) return { error: 'Factor not found.' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = data as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const constructIds = (f.factor_constructs ?? []).map((fc: any) => fc.construct_id).filter(Boolean)
  let activeItemCount = 0
  if (constructIds.length > 0) {
    const { count } = await db
      .from('items')
      .select('id', { count: 'exact', head: true })
      .in('construct_id', constructIds)
      .eq('status', 'active')
      .is('deleted_at', null)
    activeItemCount = count ?? 0
  }

  const status = factorReadiness({
    primaryCategoryId: f.primary_category_id,
    definition: f.definition,
    description: f.description,
    indicatorsLow: f.indicators_low,
    indicatorsMid: f.indicators_mid,
    indicatorsHigh: f.indicators_high,
    anchorLow: f.anchor_low,
    anchorHigh: f.anchor_high,
    applicableOutcomes: f.applicable_outcomes ?? [],
    applicableLevels: f.applicable_levels ?? [],
    overuseSignature: f.overuse_signature,
    contrastsWith: f.contrasts_with ?? [],
    theoreticalLineage: f.theoretical_lineage,
    constructCount: constructIds.length,
    activeItemCount,
  })[tier === 'match_ready' ? 'match' : 'assessment']

  if (!status.met) {
    const tierLabel = tier === 'match_ready' ? 'match-ready' : 'assessment-ready'
    return { error: `Not ${tierLabel} yet. Missing: ${status.missing.join(', ')}.` }
  }

  const update: Record<string, unknown> = { readiness: tier }
  if (tier === 'match_ready') {
    update.is_match_eligible = true
    update.reviewed_by = scope.actor?.id ?? null
    update.reviewed_at = new Date().toISOString()
  }
  const { error: upErr } = await db.from('factors').update(update).eq('id', id)
  if (upErr) return { error: upErr.message }

  revalidatePath('/factors')
  return { success: true, readiness: tier }
}

async function getDimensionsForSelectImpl(): Promise<SelectOption[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('dimensions')
    .select('id, name')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) {
    throwActionError(
      'getDimensionsForSelect',
      'Unable to load dimensions.',
      error
    )
  }
  return data ?? []
}

const getDimensionsForSelectCached = unstable_cache(
  getDimensionsForSelectImpl,
  ['dimensions-select'],
  {
    revalidate: 300,
    tags: ['taxonomy'],
  }
)

export async function getDimensionsForSelect(): Promise<SelectOption[]> {
  await requireAdminScope()
  return getDimensionsForSelectCached()
}

async function getConstructsForSelectImpl(): Promise<SelectOption[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('constructs')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    throwActionError(
      'getConstructsForSelect',
      'Unable to load constructs.',
      error
    )
  }
  return data ?? []
}

const getConstructsForSelectCached = unstable_cache(
  getConstructsForSelectImpl,
  ['constructs-select'],
  {
    revalidate: 300,
    tags: ['taxonomy'],
  }
)

export async function getConstructsForSelect(): Promise<SelectOption[]> {
  await requireAdminScope()
  return getConstructsForSelectCached()
}

export async function getClientsForFactorSelect(): Promise<SelectOption[]> {
  await requireAdminScope()
  const db = await createClient()
  const { data, error } = await db
    .from('clients')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')

  if (error) {
    throwActionError(
      'getClientsForFactorSelect',
      'Unable to load clients.',
      error
    )
  }
  return data ?? []
}

export async function createFactor(formData: FormData) {
  const scope = await requireAdminScope()
  const constructsJson = formData.get('constructs') as string
  let constructs: { constructId: string; weight: number }[] = []
  try {
    constructs = constructsJson ? JSON.parse(constructsJson) : []
  } catch {
    // ignore parse errors
  }

  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: (formData.get('description') as string) || undefined,
    definition: (formData.get('definition') as string) || undefined,
    dimensionId: (formData.get('dimensionId') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
    isMatchEligible: formData.get('isMatchEligible') !== 'false',
    clientId: (formData.get('clientId') as string) || undefined,
    constructs,
    indicatorsLow: (formData.get('indicatorsLow') as string) || undefined,
    indicatorsMid: (formData.get('indicatorsMid') as string) || undefined,
    indicatorsHigh: (formData.get('indicatorsHigh') as string) || undefined,
    anchorLow: (formData.get('anchorLow') as string) || undefined,
    anchorHigh: (formData.get('anchorHigh') as string) || undefined,
    developmentSuggestion: (formData.get('developmentSuggestion') as string) || undefined,
    strengthCommentary: (formData.get('strengthCommentary') as string) || undefined,
    sourceId: (formData.get('sourceId') as string) || undefined,
    applicableOutcomes: parseStringArray(formData.get('applicableOutcomes')),
    applicableLevels: parseStringArray(formData.get('applicableLevels')),
    applicableFunctions: parseStringArray(formData.get('applicableFunctions')),
    primaryCategoryId: (formData.get('primaryCategoryId') as string) || undefined,
    secondaryCategoryId: (formData.get('secondaryCategoryId') as string) || undefined,
    overuseSignature: (formData.get('overuseSignature') as string) || undefined,
    contrastsWith: parseStringArray(formData.get('contrastsWith')),
    theoreticalLineage: (formData.get('theoreticalLineage') as string) || undefined,
  }

  const parsed = factorSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const newId = crypto.randomUUID()

  // Atomic upsert via RPC
  const { data: factorId, error: rpcErr } = await db.rpc('upsert_factor_with_constructs', {
    p_factor_id: newId,
    p_factor: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      definition: parsed.data.definition ?? null,
      dimension_id: parsed.data.dimensionId || null,
      is_active: parsed.data.isActive,
      is_match_eligible: parsed.data.isMatchEligible,
      client_id: parsed.data.clientId || null,
      indicators_low: parsed.data.indicatorsLow ?? null,
      indicators_mid: parsed.data.indicatorsMid ?? null,
      indicators_high: parsed.data.indicatorsHigh ?? null,
    },
    p_construct_links: parsed.data.constructs.map((c, i) => ({
      construct_id: c.constructId,
      weight: c.weight,
      display_order: i + 1,
    })),
  })

  if (rpcErr) return { error: { _form: [rpcErr.message] } }

  // RPC body predates these columns — write them in a follow-up update.
  const { error: extrasErr } = await db
    .from('factors')
    .update({
      anchor_low: parsed.data.anchorLow ?? null,
      anchor_high: parsed.data.anchorHigh ?? null,
      development_suggestion: parsed.data.developmentSuggestion ?? null,
      strength_commentary: parsed.data.strengthCommentary ?? null,
      source_id: parsed.data.sourceId || null,
      applicable_outcomes: parsed.data.applicableOutcomes,
      applicable_levels: parsed.data.applicableLevels,
      applicable_functions: parsed.data.applicableFunctions,
      primary_category_id: parsed.data.primaryCategoryId || null,
      secondary_category_id: parsed.data.secondaryCategoryId || null,
      overuse_signature: parsed.data.overuseSignature ?? null,
      contrasts_with: parsed.data.contrastsWith,
      theoretical_lineage: parsed.data.theoreticalLineage ?? null,
    })
    .eq('id', (factorId ?? newId) as string)
  if (extrasErr) return { error: { _form: [extrasErr.message] } }

  revalidatePath('/factors')
  revalidatePath('/')
  revalidateTag('taxonomy', 'max')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'factor.created',
    targetTable: 'factors',
    targetId: (factorId ?? newId) as string,
    clientId: parsed.data.clientId ?? null,
    metadata: {
      slug: parsed.data.slug,
      constructCount: parsed.data.constructs.length,
      dimensionId: parsed.data.dimensionId ?? null,
    },
  })
  return { success: true, id: factorId ?? newId, slug: parsed.data.slug }
}

export async function updateFactor(id: string, formData: FormData) {
  const scope = await requireAdminScope()
  const constructsJson = formData.get('constructs') as string
  let constructs: { constructId: string; weight: number }[] = []
  try {
    constructs = constructsJson ? JSON.parse(constructsJson) : []
  } catch {
    // ignore parse errors
  }

  const raw = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: (formData.get('description') as string) || undefined,
    definition: (formData.get('definition') as string) || undefined,
    dimensionId: (formData.get('dimensionId') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
    isMatchEligible: formData.get('isMatchEligible') !== 'false',
    clientId: (formData.get('clientId') as string) || undefined,
    constructs,
    indicatorsLow: (formData.get('indicatorsLow') as string) || undefined,
    indicatorsMid: (formData.get('indicatorsMid') as string) || undefined,
    indicatorsHigh: (formData.get('indicatorsHigh') as string) || undefined,
    anchorLow: (formData.get('anchorLow') as string) || undefined,
    anchorHigh: (formData.get('anchorHigh') as string) || undefined,
    developmentSuggestion: (formData.get('developmentSuggestion') as string) || undefined,
    strengthCommentary: (formData.get('strengthCommentary') as string) || undefined,
    sourceId: (formData.get('sourceId') as string) || undefined,
    applicableOutcomes: parseStringArray(formData.get('applicableOutcomes')),
    applicableLevels: parseStringArray(formData.get('applicableLevels')),
    applicableFunctions: parseStringArray(formData.get('applicableFunctions')),
    primaryCategoryId: (formData.get('primaryCategoryId') as string) || undefined,
    secondaryCategoryId: (formData.get('secondaryCategoryId') as string) || undefined,
    overuseSignature: (formData.get('overuseSignature') as string) || undefined,
    contrastsWith: parseStringArray(formData.get('contrastsWith')),
    theoreticalLineage: (formData.get('theoreticalLineage') as string) || undefined,
  }

  const parsed = factorSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  // Composition lock enforcement: if the factor is locked, refuse changes that
  // alter the construct set (add/remove/reweight). Non-composition edits to
  // the same construct list still pass.
  const { data: existing, error: existingErr } = await db
    .from('factors')
    .select('composition_locked, factor_constructs(construct_id, weight)')
    .eq('id', id)
    .single()
  if (existingErr) return { error: { _form: [existingErr.message] } }
  if (existing?.composition_locked) {
    const incoming = parsed.data.constructs
      .map((c) => `${c.constructId}:${Number(c.weight)}`)
      .sort()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = ((existing.factor_constructs ?? []) as any[])
      .map((fc) => `${fc.construct_id}:${Number(fc.weight)}`)
      .sort()
    const differs =
      incoming.length !== current.length ||
      incoming.some((v, i) => v !== current[i])
    if (differs) {
      return {
        error: {
          _form: [
            'This factor is composition-locked. Unlock it in Settings before changing its constructs or weights.',
          ],
        },
      }
    }
  }

  // Atomic upsert via RPC
  const { error: rpcErr } = await db.rpc('upsert_factor_with_constructs', {
    p_factor_id: id,
    p_factor: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      definition: parsed.data.definition ?? null,
      dimension_id: parsed.data.dimensionId || null,
      is_active: parsed.data.isActive,
      is_match_eligible: parsed.data.isMatchEligible,
      client_id: parsed.data.clientId || null,
      indicators_low: parsed.data.indicatorsLow ?? null,
      indicators_mid: parsed.data.indicatorsMid ?? null,
      indicators_high: parsed.data.indicatorsHigh ?? null,
    },
    p_construct_links: parsed.data.constructs.map((c, i) => ({
      construct_id: c.constructId,
      weight: c.weight,
      display_order: i + 1,
    })),
  })

  if (rpcErr) return { error: { _form: [rpcErr.message] } }

  // RPC body predates these columns — write them in a follow-up update.
  const { error: extrasErr } = await db
    .from('factors')
    .update({
      anchor_low: parsed.data.anchorLow ?? null,
      anchor_high: parsed.data.anchorHigh ?? null,
      development_suggestion: parsed.data.developmentSuggestion ?? null,
      strength_commentary: parsed.data.strengthCommentary ?? null,
      source_id: parsed.data.sourceId || null,
      applicable_outcomes: parsed.data.applicableOutcomes,
      applicable_levels: parsed.data.applicableLevels,
      applicable_functions: parsed.data.applicableFunctions,
      primary_category_id: parsed.data.primaryCategoryId || null,
      secondary_category_id: parsed.data.secondaryCategoryId || null,
      overuse_signature: parsed.data.overuseSignature ?? null,
      contrasts_with: parsed.data.contrastsWith,
      theoretical_lineage: parsed.data.theoreticalLineage ?? null,
    })
    .eq('id', id)
  if (extrasErr) return { error: { _form: [extrasErr.message] } }

  // Demote if an edit dropped the factor below its current readiness tier
  // (e.g. clearing overuse_signature on a match-ready factor).
  await reconcileFactorReadiness(db, id)

  revalidatePath('/factors')
  revalidatePath('/')
  revalidateTag('taxonomy', 'max')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'factor.updated',
    targetTable: 'factors',
    targetId: id,
    clientId: parsed.data.clientId ?? null,
    metadata: {
      slug: parsed.data.slug,
      constructCount: parsed.data.constructs.length,
      dimensionId: parsed.data.dimensionId ?? null,
    },
  })
  return { success: true, id, slug: parsed.data.slug }
}

export async function deleteFactor(id: string) {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db
    .from('factors')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/factors')
  revalidatePath('/')
  revalidateTag('taxonomy', 'max')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'factor.deleted',
    targetTable: 'factors',
    targetId: id,
  })
  return { success: true }
}

export async function deleteFactors(ids: string[]) {
  const scope = await requireAdminScope()
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return { error: 'Select at least one factor.' }
  }

  const db = createAdminClient()
  const timestamp = new Date().toISOString()
  const { error } = await db
    .from('factors')
    .update({ deleted_at: timestamp })
    .in('id', uniqueIds)

  if (error) return { error: error.message }

  revalidatePath('/factors')
  revalidatePath('/')
  revalidateTag('taxonomy', 'max')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'factor.bulk_deleted',
    targetTable: 'factors',
    metadata: {
      ids: uniqueIds,
      count: uniqueIds.length,
    },
  })
  return { success: true as const, count: uniqueIds.length }
}

export async function restoreFactor(id: string) {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db
    .from('factors')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/factors')
  revalidatePath('/')
  revalidateTag('taxonomy', 'max')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'factor.restored',
    targetTable: 'factors',
    targetId: id,
  })
  return { success: true }
}

export async function restoreFactors(ids: string[]) {
  const scope = await requireAdminScope()
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return { error: 'Select at least one factor.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('factors')
    .update({ deleted_at: null })
    .in('id', uniqueIds)

  if (error) return { error: error.message }

  revalidatePath('/factors')
  revalidatePath('/')
  revalidateTag('taxonomy', 'max')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'factor.bulk_restored',
    targetTable: 'factors',
    metadata: {
      ids: uniqueIds,
      count: uniqueIds.length,
    },
  })
  return { success: true, count: uniqueIds.length }
}

export async function toggleFactorActive(id: string, isActive: boolean) {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db
    .from('factors')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/factors')
  revalidatePath('/')
  revalidateTag('taxonomy', 'max')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'factor.active_toggled',
    targetTable: 'factors',
    targetId: id,
    metadata: { isActive },
  })
  return { success: true }
}

/**
 * Set the composition lock on a factor. When locked, server actions that add,
 * remove, or reweight the factor's constructs reject the operation. Unlocking
 * a factor that already has participant scores against it can break score
 * comparability over time — the UI warns the admin before unlocking.
 */
export async function setFactorCompositionLocked(id: string, locked: boolean) {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db
    .from('factors')
    .update({ composition_locked: locked })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/factors')
  revalidatePath(`/factors`)
  revalidateTag('taxonomy', 'max')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'factor.composition_lock_toggled',
    targetTable: 'factors',
    targetId: id,
    metadata: { locked },
  })
  return { success: true }
}

const ALLOWED_FACTOR_FIELDS = ['description', 'definition', 'indicators_low', 'indicators_mid', 'indicators_high', 'development_suggestion', 'strength_commentary', 'anchor_low', 'anchor_high', 'source_id'] as const
type AllowedFactorField = typeof ALLOWED_FACTOR_FIELDS[number]

const camelToSnakeMap: Record<string, AllowedFactorField> = {
  description: 'description',
  definition: 'definition',
  indicatorsLow: 'indicators_low',
  indicatorsMid: 'indicators_mid',
  indicatorsHigh: 'indicators_high',
  developmentSuggestion: 'development_suggestion',
  strengthCommentary: 'strength_commentary',
  anchorLow: 'anchor_low',
  anchorHigh: 'anchor_high',
  sourceId: 'source_id',
}

export async function updateFactorField(id: string, field: string, value: string) {
  const scope = await requireAdminScope()
  const dbField = camelToSnakeMap[field] ?? field
  if (!ALLOWED_FACTOR_FIELDS.includes(dbField as AllowedFactorField)) {
    return { error: `Field "${field}" is not allowed` }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('factors')
    .update({ [dbField]: value || null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/factors')
  revalidateTag('taxonomy', 'max')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'factor.field_updated',
    targetTable: 'factors',
    targetId: id,
    metadata: { field },
  })
  return { success: true }
}
