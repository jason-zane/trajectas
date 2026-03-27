'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapAssessmentRow } from '@/lib/supabase/mappers'
import { assessmentSchema } from '@/lib/validations/assessments'
import type { Assessment } from '@/types/database'

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

export type AssessmentCompetencyLink = {
  competencyId: string
  weight: number
  itemCount: number
}

export async function getAssessments(): Promise<AssessmentWithMeta[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('assessments')
    .select('*, assessment_competencies(count)')
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
    .single()

  if (error) return null
  return mapAssessmentRow(data)
}

export async function getAssessmentWithCompetencies(id: string): Promise<{
  assessment: Assessment
  competencies: AssessmentCompetencyLink[]
} | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('assessments')
    .select('*, assessment_competencies(competency_id, weight, item_count)')
    .eq('id', id)
    .single()

  if (error) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any
  return {
    assessment: mapAssessmentRow(data),
    competencies: (r.assessment_competencies ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ac: any) => ({
        competencyId: ac.competency_id,
        weight: Number(ac.weight),
        itemCount: ac.item_count ?? 0,
      })
    ),
  }
}

export async function getCompetenciesForBuilder(): Promise<BuilderFactor[]> {
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

  // Insert junction records
  if (parsed.data.competencies.length > 0) {
    const links = parsed.data.competencies.map((c) => ({
      assessment_id: assessment.id,
      competency_id: c.competencyId,
      weight: c.weight,
      item_count: c.itemCount,
    }))
    const { error: linkError } = await db.from('assessment_competencies').insert(links)
    if (linkError) return { error: { _form: [linkError.message] } }
  }

  revalidatePath('/assessments')
  revalidatePath('/')
  redirect('/assessments')
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

  // Replace junction records: delete old, insert new
  await db.from('assessment_competencies').delete().eq('assessment_id', id)

  if (parsed.data.competencies.length > 0) {
    const links = parsed.data.competencies.map((c) => ({
      assessment_id: id,
      competency_id: c.competencyId,
      weight: c.weight,
      item_count: c.itemCount,
    }))
    const { error: linkError } = await db.from('assessment_competencies').insert(links)
    if (linkError) return { error: { _form: [linkError.message] } }
  }

  revalidatePath('/assessments')
  revalidatePath('/')
  redirect('/assessments')
}

export async function deleteAssessment(id: string) {
  const db = createAdminClient()
  const { error } = await db.from('assessments').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/assessments')
  revalidatePath('/')
  redirect('/assessments')
}
