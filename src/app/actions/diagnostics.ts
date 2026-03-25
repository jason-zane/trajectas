'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { diagnosticTemplateSchema, diagnosticSessionSchema } from '@/lib/validations/diagnostics'
import type { DiagnosticTemplate, DiagnosticSession } from '@/types/database'

// =============================================================================
// Types
// =============================================================================

export type DiagnosticTemplateWithCounts = DiagnosticTemplate & {
  dimensionCount: number
  sessionCount: number
}

export type DiagnosticSessionWithMeta = DiagnosticSession & {
  organizationName: string
  templateName: string
  respondentCount: number
}

export type SelectOption = { id: string; name: string }

// =============================================================================
// Templates
// =============================================================================

export async function getDiagnosticTemplates(): Promise<DiagnosticTemplateWithCounts[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('diagnostic_templates')
    .select('*, diagnostic_template_dimensions(count), diagnostic_sessions(count)')
    .order('name')

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    return {
      id: r.id,
      partnerId: r.partner_id ?? undefined,
      name: r.name,
      description: r.description ?? undefined,
      isActive: r.is_active,
      created_at: r.created_at,
      updated_at: r.updated_at ?? undefined,
      dimensionCount: r.diagnostic_template_dimensions?.[0]?.count ?? 0,
      sessionCount: r.diagnostic_sessions?.[0]?.count ?? 0,
    }
  })
}

export async function getDiagnosticTemplateById(id: string): Promise<DiagnosticTemplate | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('diagnostic_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null

  return {
    id: data.id,
    partnerId: data.partner_id ?? undefined,
    name: data.name,
    description: data.description ?? undefined,
    isActive: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at ?? undefined,
  }
}

export async function createDiagnosticTemplate(formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
  }

  const parsed = diagnosticTemplateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const { error } = await db.from('diagnostic_templates').insert({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    is_active: parsed.data.isActive,
  })

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/diagnostics')
  revalidatePath('/diagnostics/templates')
  revalidatePath('/')
  redirect('/diagnostics/templates')
}

export async function updateDiagnosticTemplate(id: string, formData: FormData) {
  const raw = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || undefined,
    isActive: formData.get('isActive') !== 'false',
  }

  const parsed = diagnosticTemplateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('diagnostic_templates')
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      is_active: parsed.data.isActive,
    })
    .eq('id', id)

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/diagnostics')
  revalidatePath('/diagnostics/templates')
  revalidatePath('/')
  redirect('/diagnostics/templates')
}

export async function deleteDiagnosticTemplate(id: string) {
  const db = createAdminClient()
  const { error } = await db.from('diagnostic_templates').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/diagnostics')
  revalidatePath('/diagnostics/templates')
  revalidatePath('/')
  redirect('/diagnostics/templates')
}

// =============================================================================
// Sessions
// =============================================================================

export async function getDiagnosticSessions(): Promise<DiagnosticSessionWithMeta[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('diagnostic_sessions')
    .select('*, organizations(name), diagnostic_templates(name), diagnostic_respondents(count)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    return {
      id: r.id,
      organizationId: r.organization_id,
      templateId: r.template_id,
      subjectProfileId: r.subject_profile_id,
      title: r.title,
      status: r.status,
      expiresAt: r.expires_at ?? undefined,
      created_at: r.created_at,
      updated_at: r.updated_at ?? undefined,
      organizationName: r.organizations?.name ?? 'Unknown',
      templateName: r.diagnostic_templates?.name ?? 'Unknown',
      respondentCount: r.diagnostic_respondents?.[0]?.count ?? 0,
    }
  })
}

export async function getDiagnosticSessionById(id: string): Promise<DiagnosticSession | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('diagnostic_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null

  return {
    id: data.id,
    organizationId: data.organization_id,
    templateId: data.template_id,
    subjectProfileId: data.subject_profile_id,
    title: data.title,
    status: data.status,
    expiresAt: data.expires_at ?? undefined,
    created_at: data.created_at,
    updated_at: data.updated_at ?? undefined,
  }
}

export async function createDiagnosticSession(formData: FormData) {
  const raw = {
    organizationId: formData.get('organizationId') as string,
    templateId: formData.get('templateId') as string,
    title: formData.get('title') as string,
    status: (formData.get('status') as string) || 'draft',
    expiresAt: (formData.get('expiresAt') as string) || undefined,
  }

  const parsed = diagnosticSessionSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = createAdminClient()
  const { error } = await db.from('diagnostic_sessions').insert({
    organization_id: parsed.data.organizationId,
    template_id: parsed.data.templateId,
    subject_profile_id: null,
    title: parsed.data.title,
    status: parsed.data.status,
    expires_at: parsed.data.expiresAt ?? null,
  })

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/diagnostics')
  revalidatePath('/')
  redirect('/diagnostics')
}

export async function deleteDiagnosticSession(id: string) {
  const db = createAdminClient()
  const { error } = await db.from('diagnostic_sessions').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/diagnostics')
  revalidatePath('/')
  redirect('/diagnostics')
}

// =============================================================================
// Select helpers
// =============================================================================

export async function getOrganizationsForDiagnosticSelect(): Promise<SelectOption[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('organizations')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getTemplatesForSelect(): Promise<SelectOption[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('diagnostic_templates')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}
