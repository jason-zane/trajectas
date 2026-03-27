'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapAssessmentRow } from '@/lib/supabase/mappers'
import { assessmentSchema } from '@/lib/validations/assessments'
import type { Assessment, ItemOrdering } from '@/types/database'

export type AssessmentWithMeta = Assessment & {
  factorCount: number
}

export type BuilderFactor = {
  id: string
  name: string
  description?: string
  dimensionId?: string
  dimensionName?: string
  constructCount: number
  itemCount: number
  isActive: boolean
}

export type AssessmentFactorLink = {
  factorId: string
  weight: number
  itemCount: number
}

/** Format group for section auto-generation in the builder. */
export type FormatGroup = {
  responseFormatId: string
  formatName: string
  formatType: string
  itemCount: number
}

/** Section draft state used in the builder before persisting. */
export type SectionDraft = {
  id?: string
  responseFormatId: string
  formatName: string
  formatType: string
  title: string
  instructions: string
  displayOrder: number
  itemOrdering: ItemOrdering
  itemsPerPage: number | null
  timeLimitSeconds: number | null
  allowBackNav: boolean
  itemCount: number
}

/** Existing section loaded from DB for editing. */
export type ExistingSection = {
  id: string
  responseFormatId: string
  formatName: string
  formatType: string
  title: string
  instructions: string
  displayOrder: number
  itemOrdering: ItemOrdering
  itemsPerPage: number | null
  timeLimitSeconds: number | null
  allowBackNav: boolean
  itemCount: number
}

export async function getAssessments(): Promise<AssessmentWithMeta[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('assessments')
    .select('*, assessment_competencies(count)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    ...mapAssessmentRow(row),
    factorCount:
      (row as Record<string, unknown>).assessment_competencies
        ? ((row as Record<string, unknown>).assessment_competencies as { count: number }[])[0]?.count ?? 0
        : 0,
  }))
}

export async function getAssessmentById(id: string): Promise<Assessment | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('assessments')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null
  return mapAssessmentRow(data)
}

export async function getAssessmentWithFactors(id: string): Promise<{
  assessment: Assessment
  factors: AssessmentFactorLink[]
  sections: ExistingSection[]
} | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('assessments')
    .select('*, assessment_competencies(competency_id, weight, item_count)')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any

  // Load existing sections with item counts and format info
  const { data: sectionRows } = await db
    .from('assessment_sections')
    .select('*, response_formats(name, type), assessment_section_items(count)')
    .eq('assessment_id', id)
    .order('display_order', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections: ExistingSection[] = (sectionRows ?? []).map((s: any) => ({
    id: s.id,
    responseFormatId: s.response_format_id,
    formatName: s.response_formats?.name ?? '',
    formatType: s.response_formats?.type ?? '',
    title: s.title,
    instructions: s.instructions ?? '',
    displayOrder: s.display_order,
    itemOrdering: s.item_ordering,
    itemsPerPage: s.items_per_page ?? null,
    timeLimitSeconds: s.time_limit_seconds ?? null,
    allowBackNav: s.allow_back_nav,
    itemCount: s.assessment_section_items?.[0]?.count ?? 0,
  }))

  return {
    assessment: mapAssessmentRow(data),
    factors: (r.assessment_competencies ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ac: any) => ({
        factorId: ac.competency_id,
        weight: Number(ac.weight),
        itemCount: ac.item_count ?? 0,
      })
    ),
    sections,
  }
}

/**
 * Get item format breakdown for selected factors.
 * Returns how many active items exist per response format
 * across the given factors' constructs.
 */
export async function getFormatBreakdown(factorIds: string[]): Promise<FormatGroup[]> {
  if (factorIds.length === 0) return []

  const db = createAdminClient()

  // Get construct IDs for these factors
  const { data: links } = await db
    .from('factor_constructs')
    .select('construct_id')
    .in('factor_id', factorIds)

  const constructIds = [...new Set((links ?? []).map((l) => l.construct_id))]
  if (constructIds.length === 0) return []

  // Get active items for these constructs with their format info
  const { data: items } = await db
    .from('items')
    .select('response_format_id, response_formats(id, name, type)')
    .in('construct_id', constructIds)
    .eq('status', 'active')

  if (!items || items.length === 0) return []

  // Group by format
  const groups = new Map<string, { formatName: string; formatType: string; count: number }>()

  for (const item of items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rf = (item as any).response_formats
    const fmtId = item.response_format_id
    const existing = groups.get(fmtId)
    if (existing) {
      existing.count++
    } else {
      groups.set(fmtId, {
        formatName: rf?.name ?? 'Unknown',
        formatType: rf?.type ?? 'unknown',
        count: 1,
      })
    }
  }

  return [...groups.entries()]
    .map(([responseFormatId, g]) => ({
      responseFormatId,
      formatName: g.formatName,
      formatType: g.formatType,
      itemCount: g.count,
    }))
    .sort((a, b) => b.itemCount - a.itemCount)
}

export async function getFactorsForBuilder(): Promise<BuilderFactor[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('factors')
    .select('*, dimensions(name), factor_constructs(count), items(count)')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      dimensionId: r.dimension_id ?? undefined,
      dimensionName: r.dimensions?.name ?? undefined,
      constructCount: r.factor_constructs?.[0]?.count ?? 0,
      itemCount: r.items?.[0]?.count ?? 0,
      isActive: r.is_active,
    }
  })
}

export async function createAssessment(payload: Record<string, unknown>) {
  const parsed = assessmentSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const { data: assessment, error } = await db.from('assessments').insert({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    status: parsed.data.status,
    item_selection_strategy: parsed.data.itemSelectionStrategy,
    scoring_method: parsed.data.scoringMethod,
    creation_mode: parsed.data.creationMode,
  }).select('id').single()

  if (error) return { error: { _form: [error.message] } }

  // Insert factor junction records
  if (parsed.data.factors.length > 0) {
    const links = parsed.data.factors.map((f) => ({
      assessment_id: assessment.id,
      competency_id: f.factorId,
      weight: f.weight,
      item_count: f.itemCount,
    }))
    const { error: linkError } = await db.from('assessment_competencies').insert(links)
    if (linkError) return { error: { _form: [linkError.message] } }
  }

  // Insert sections
  const sections = (payload.sections ?? []) as SectionDraft[]
  if (sections.length > 0) {
    const factorIds = parsed.data.factors.map((f) => f.factorId)
    const sectionErr = await persistSections(db, assessment.id, sections, factorIds)
    if (sectionErr) return { error: { _form: [sectionErr] } }
  }

  revalidatePath('/assessments')
  revalidatePath('/')
  return { success: true as const, id: assessment.id }
}

export async function updateAssessment(id: string, payload: Record<string, unknown>) {
  const parsed = assessmentSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()

  const { error: updateErr } = await db
    .from('assessments')
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      item_selection_strategy: parsed.data.itemSelectionStrategy,
      scoring_method: parsed.data.scoringMethod,
      creation_mode: parsed.data.creationMode,
    })
    .eq('id', id)

  if (updateErr) return { error: { _form: [updateErr.message] } }

  // Replace factor junction records
  await db.from('assessment_competencies').delete().eq('assessment_id', id)

  if (parsed.data.factors.length > 0) {
    const links = parsed.data.factors.map((f) => ({
      assessment_id: id,
      competency_id: f.factorId,
      weight: f.weight,
      item_count: f.itemCount,
    }))
    const { error: linkError } = await db.from('assessment_competencies').insert(links)
    if (linkError) return { error: { _form: [linkError.message] } }
  }

  // Replace sections (cascade deletes section_items)
  await db.from('assessment_sections').delete().eq('assessment_id', id)

  const sections = (payload.sections ?? []) as SectionDraft[]
  if (sections.length > 0) {
    const factorIds = parsed.data.factors.map((f) => f.factorId)
    const sectionErr = await persistSections(db, id, sections, factorIds)
    if (sectionErr) return { error: { _form: [sectionErr] } }
  }

  revalidatePath('/assessments')
  revalidatePath('/')
  return { success: true as const, id }
}

export async function deleteAssessment(id: string) {
  const db = createAdminClient()
  const { error } = await db
    .from('assessments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/assessments')
  revalidatePath('/')
}

export async function restoreAssessment(id: string) {
  const db = createAdminClient()
  const { error } = await db
    .from('assessments')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/assessments')
  revalidatePath('/')
}

export async function updateAssessmentField(id: string, field: string, value: string) {
  if (field !== 'description') {
    return { error: 'Only description can be auto-saved' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('assessments')
    .update({ [field]: value || null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/assessments')
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Persist sections for an assessment and auto-assign matching items.
 * Items are matched to sections by response_format_id.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function persistSections(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  assessmentId: string,
  sections: SectionDraft[],
  factorIds: string[],
): Promise<string | null> {
  // Insert sections
  const sectionInserts = sections.map((s) => ({
    assessment_id: assessmentId,
    response_format_id: s.responseFormatId,
    title: s.title,
    instructions: s.instructions || null,
    display_order: s.displayOrder,
    item_ordering: s.itemOrdering,
    items_per_page: s.itemsPerPage ?? null,
    time_limit_seconds: s.timeLimitSeconds ?? null,
    allow_back_nav: s.allowBackNav,
  }))

  const { data: insertedSections, error: secErr } = await db
    .from('assessment_sections')
    .insert(sectionInserts)
    .select('id, response_format_id')

  if (secErr) return secErr.message

  // Get construct IDs for these factors
  const { data: links } = await db
    .from('factor_constructs')
    .select('construct_id')
    .in('factor_id', factorIds)

  const constructIds = [...new Set((links ?? []).map((l: { construct_id: string }) => l.construct_id))]
  if (constructIds.length === 0) return null

  // Get all active items for these constructs
  const { data: items } = await db
    .from('items')
    .select('id, response_format_id')
    .in('construct_id', constructIds)
    .eq('status', 'active')

  if (!items || items.length === 0) return null

  // Build section ID lookup by format
  const sectionByFormat = new Map<string, string>()
  for (const s of insertedSections) {
    sectionByFormat.set(s.response_format_id, s.id)
  }

  // Assign items to matching sections
  const sectionItems: { section_id: string; item_id: string; display_order: number }[] = []
  const orderBySection = new Map<string, number>()

  for (const item of items) {
    const sectionId = sectionByFormat.get(item.response_format_id)
    if (!sectionId) continue

    const order = orderBySection.get(sectionId) ?? 0
    sectionItems.push({
      section_id: sectionId,
      item_id: item.id,
      display_order: order,
    })
    orderBySection.set(sectionId, order + 1)
  }

  if (sectionItems.length > 0) {
    const { error: itemErr } = await db
      .from('assessment_section_items')
      .insert(sectionItems)
    if (itemErr) return itemErr.message
  }

  return null
}
