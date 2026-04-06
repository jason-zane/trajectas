'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  requireAdminScope,
  requireClientAccess,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { throwActionError } from '@/lib/security/action-errors'
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
  clientName: string
  templateName: string
  respondentCount: number
}

export type DiagnosticSessionDetail = DiagnosticSessionWithMeta & {
  description?: string
  department?: string
  startedAt?: string
  completedAt?: string
  snapshotCount: number
}

export type DiagnosticRespondentWithMeta = {
  id: string
  profileId?: string
  email: string
  name: string
  relationship: string
  roleTitle?: string
  department?: string
  seniorityLevel?: string
  completedAt?: string
  created_at: string
  status: 'completed' | 'pending'
  responseCount: number
}

export type SelectOption = { id: string; name: string }

function getDiagnosticSessionTitle(
  row: Record<string, unknown> | null | undefined
) {
  if (!row) {
    return 'Untitled session'
  }

  const title = row.title
  if (typeof title === 'string' && title.trim().length > 0) {
    return title
  }

  const name = row.name
  if (typeof name === 'string' && name.trim().length > 0) {
    return name
  }

  return 'Untitled session'
}

// =============================================================================
// Templates
// =============================================================================

export async function getDiagnosticTemplates(): Promise<DiagnosticTemplateWithCounts[]> {
  await requireAdminScope()
  const db = await createClient()
  const { data, error } = await db
    .from('diagnostic_templates')
    .select('*, diagnostic_template_dimensions(count), diagnostic_sessions(count)')
    .order('name')

  if (error) {
    throwActionError(
      'getDiagnosticTemplates',
      'Unable to load diagnostic templates.',
      error
    )
  }

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
  await requireAdminScope()
  const db = await createClient()
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
  const scope = await requireAdminScope()
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
  const { data, error } = await db
    .from('diagnostic_templates')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      is_active: parsed.data.isActive,
    })
    .select('id')
    .single()

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/diagnostics')
  revalidatePath('/diagnostics/templates')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'diagnostic_template.created',
    targetTable: 'diagnostic_templates',
    targetId: data.id,
    metadata: {
      name: parsed.data.name,
      isActive: parsed.data.isActive,
    },
  })
  redirect('/diagnostics/templates')
}

export async function updateDiagnosticTemplate(id: string, formData: FormData) {
  const scope = await requireAdminScope()
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
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'diagnostic_template.updated',
    targetTable: 'diagnostic_templates',
    targetId: id,
    metadata: {
      name: parsed.data.name,
      isActive: parsed.data.isActive,
    },
  })
  redirect('/diagnostics/templates')
}

export async function deleteDiagnosticTemplate(id: string) {
  const scope = await requireAdminScope()
  const db = createAdminClient()
  const { error } = await db.from('diagnostic_templates').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/diagnostics')
  revalidatePath('/diagnostics/templates')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'diagnostic_template.deleted',
    targetTable: 'diagnostic_templates',
    targetId: id,
  })
  redirect('/diagnostics/templates')
}

// =============================================================================
// Sessions
// =============================================================================

export async function getDiagnosticSessions(): Promise<DiagnosticSessionWithMeta[]> {
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin && scope.clientIds.length === 0) {
    return []
  }

  const db = await createClient()
  let query = db
    .from('diagnostic_sessions')
    .select('*, clients(name), diagnostic_templates(name), diagnostic_respondents(count)')
    .order('created_at', { ascending: false })

  if (!scope.isPlatformAdmin) {
    query = query.in('client_id', scope.clientIds)
  }

  const { data, error } = await query

  if (error) {
    throwActionError(
      'getDiagnosticSessions',
      'Unable to load diagnostic sessions.',
      error
    )
  }

  return (data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any
    return {
      id: r.id,
      clientId: r.client_id,
      templateId: r.template_id,
      subjectProfileId: r.subject_profile_id,
      title: getDiagnosticSessionTitle(r),
      status: r.status,
      expiresAt: r.expires_at ?? undefined,
      created_at: r.created_at,
      updated_at: r.updated_at ?? undefined,
      clientName: r.clients?.name ?? 'Unknown',
      templateName: r.diagnostic_templates?.name ?? 'Unknown',
      respondentCount: r.diagnostic_respondents?.[0]?.count ?? 0,
    }
  })
}

export async function getDiagnosticSessionById(id: string): Promise<DiagnosticSession | null> {
  const db = await createClient()
  const { data, error } = await db
    .from('diagnostic_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null

  return {
    id: data.id,
    clientId: data.client_id,
    templateId: data.template_id,
    subjectProfileId: data.subject_profile_id,
    title: getDiagnosticSessionTitle(data),
    status: data.status,
    expiresAt: data.expires_at ?? undefined,
    created_at: data.created_at,
    updated_at: data.updated_at ?? undefined,
  }
}

export async function getDiagnosticSessionDetail(
  id: string
): Promise<DiagnosticSessionDetail | null> {
  const db = await createClient()
  const { data, error } = await db
    .from('diagnostic_sessions')
    .select('*, clients(name), diagnostic_templates(name), diagnostic_respondents(count), diagnostic_snapshots(count)')
    .eq('id', id)
    .single()

  if (error || !data) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any
  return {
    id: row.id,
    clientId: row.client_id,
    templateId: row.template_id,
    subjectProfileId: row.subject_profile_id ?? '',
    title: getDiagnosticSessionTitle(row),
    status: row.status,
    expiresAt: row.expires_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
    clientName: row.clients?.name ?? 'Unknown',
    templateName: row.diagnostic_templates?.name ?? 'Unknown',
    respondentCount: row.diagnostic_respondents?.[0]?.count ?? 0,
    description: row.description ?? undefined,
    department: row.department ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    snapshotCount: row.diagnostic_snapshots?.[0]?.count ?? 0,
  }
}

export async function getDiagnosticRespondents(
  sessionId: string
): Promise<DiagnosticRespondentWithMeta[]> {
  const db = await createClient()
  const { data: session, error: sessionError } = await db
    .from('diagnostic_sessions')
    .select('client_id')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return []
  }

  const { data, error } = await db
    .from('diagnostic_respondents')
    .select('*, diagnostic_responses(count)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    throwActionError(
      'getDiagnosticRespondents',
      'Unable to load diagnostic respondents.',
      error
    )
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const completedAt =
      typeof row.completed_at === 'string' ? row.completed_at : undefined
    const legacyCompleted =
      typeof row.has_completed === 'boolean' ? row.has_completed : undefined
    const status =
      completedAt || legacyCompleted ? 'completed' : 'pending'
    const responseCount = Array.isArray(row.diagnostic_responses)
      ? Number((row.diagnostic_responses[0] as { count?: number } | undefined)?.count ?? 0)
      : 0

    return {
      id: String(row.id),
      profileId: row.profile_id ? String(row.profile_id) : undefined,
      email: typeof row.email === 'string' ? row.email : 'Unknown',
      name:
        typeof row.name === 'string' && row.name.trim().length > 0
          ? row.name
          : typeof row.email === 'string'
            ? row.email
            : 'Respondent',
      relationship:
        typeof row.relationship === 'string' && row.relationship.trim().length > 0
          ? row.relationship
          : typeof row.role_title === 'string' && row.role_title.trim().length > 0
            ? row.role_title
            : 'Respondent',
      roleTitle:
        typeof row.role_title === 'string' && row.role_title.trim().length > 0
          ? row.role_title
          : undefined,
      department:
        typeof row.department === 'string' && row.department.trim().length > 0
          ? row.department
          : undefined,
      seniorityLevel:
        typeof row.seniority_level === 'string' && row.seniority_level.trim().length > 0
          ? row.seniority_level
          : undefined,
      completedAt,
      created_at:
        typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
      status,
      responseCount,
    }
  })
}

export async function createDiagnosticSession(formData: FormData) {
  const raw = {
    clientId: formData.get('clientId') as string,
    templateId: formData.get('templateId') as string,
    title: formData.get('title') as string,
    status: (formData.get('status') as string) || 'draft',
    expiresAt: (formData.get('expiresAt') as string) || undefined,
  }

  const parsed = diagnosticSessionSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { scope, clientId } = await requireClientAccess(parsed.data.clientId)
  const db = createAdminClient()
  const { data, error } = await db
    .from('diagnostic_sessions')
    .insert({
      client_id: clientId,
      template_id: parsed.data.templateId,
      subject_profile_id: null,
      title: parsed.data.title,
      status: parsed.data.status,
      expires_at: parsed.data.expiresAt ?? null,
    })
    .select('id')
    .single()

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/diagnostics')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'diagnostic_session.created',
    targetTable: 'diagnostic_sessions',
    targetId: data.id,
    clientId: clientId,
    metadata: {
      templateId: parsed.data.templateId,
      title: parsed.data.title,
      status: parsed.data.status,
    },
  })
  redirect('/diagnostics')
}

export async function deleteDiagnosticSession(id: string) {
  const db = createAdminClient()
  const { data: session, error: fetchError } = await db
    .from('diagnostic_sessions')
    .select('id, client_id')
    .eq('id', id)
    .single()

  if (fetchError || !session) return { error: fetchError?.message ?? 'Diagnostic session not found' }

  const { scope, clientId } = await requireClientAccess(session.client_id)
  const { error } = await db.from('diagnostic_sessions').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/diagnostics')
  revalidatePath('/')
  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'diagnostic_session.deleted',
    targetTable: 'diagnostic_sessions',
    targetId: id,
    clientId: clientId,
  })
  redirect('/diagnostics')
}

// =============================================================================
// Select helpers
// =============================================================================

export async function getClientsForDiagnosticSelect(): Promise<SelectOption[]> {
  const scope = await resolveAuthorizedScope()
  const db = createAdminClient()
  let query = db
    .from('clients')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (!scope.isPlatformAdmin) {
    if (scope.clientIds.length === 0) {
      return []
    }
    query = query.in('id', scope.clientIds)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getTemplatesForSelect(): Promise<SelectOption[]> {
  await resolveAuthorizedScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('diagnostic_templates')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}
