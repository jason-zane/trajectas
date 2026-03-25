'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapAssessmentRow } from '@/lib/supabase/mappers'
import { assessmentSchema } from '@/lib/validations/assessments'
import type { Assessment } from '@/types/database'

export type AssessmentWithMeta = Assessment & {
  organizationName: string
  competencyCount: number
}

export async function getAssessments(): Promise<AssessmentWithMeta[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('assessments')
    .select('*, organizations(name), assessment_competencies(count)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    ...mapAssessmentRow(row),
    organizationName:
      (row as Record<string, unknown>).organizations
        ? ((row as Record<string, unknown>).organizations as { name: string }).name
        : 'Unknown',
    competencyCount:
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

export async function getOrganizationsForSelect(): Promise<{ id: string; name: string }[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('organizations')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({ id: row.id, name: row.name }))
}

export async function createAssessment(formData: FormData) {
  const raw = {
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || undefined,
    status: (formData.get('status') as string) || 'draft',
    itemSelectionStrategy: (formData.get('itemSelectionStrategy') as string) || 'fixed',
    scoringMethod: (formData.get('scoringMethod') as string) || 'ctt',
    timeLimitMinutes: formData.get('timeLimitMinutes')
      ? Number(formData.get('timeLimitMinutes'))
      : undefined,
    organizationId: formData.get('organizationId') as string,
    creationMode: (formData.get('creationMode') as string) || 'manual',
  }

  const parsed = assessmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const { error } = await db.from('assessments').insert({
    organization_id: parsed.data.organizationId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    status: parsed.data.status,
    item_selection_strategy: parsed.data.itemSelectionStrategy,
    scoring_method: parsed.data.scoringMethod,
    time_limit_minutes: parsed.data.timeLimitMinutes ?? null,
    creation_mode: parsed.data.creationMode,
  })

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/assessments')
  revalidatePath('/')
  redirect('/assessments')
}

export async function updateAssessment(id: string, formData: FormData) {
  const raw = {
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || undefined,
    status: (formData.get('status') as string) || 'draft',
    itemSelectionStrategy: (formData.get('itemSelectionStrategy') as string) || 'fixed',
    scoringMethod: (formData.get('scoringMethod') as string) || 'ctt',
    timeLimitMinutes: formData.get('timeLimitMinutes')
      ? Number(formData.get('timeLimitMinutes'))
      : undefined,
    organizationId: formData.get('organizationId') as string,
    creationMode: (formData.get('creationMode') as string) || 'manual',
  }

  const parsed = assessmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('assessments')
    .update({
      organization_id: parsed.data.organizationId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      item_selection_strategy: parsed.data.itemSelectionStrategy,
      scoring_method: parsed.data.scoringMethod,
      time_limit_minutes: parsed.data.timeLimitMinutes ?? null,
      creation_mode: parsed.data.creationMode,
    })
    .eq('id', id)

  if (error) return { error: { _form: [error.message] } }

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
