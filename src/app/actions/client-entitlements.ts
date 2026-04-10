'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireClientAccess } from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'
import { getFactorsForAssessment } from '@/app/actions/factor-selection'
import {
  mapClientAssessmentAssignmentRow,
  mapClientReportTemplateAssignmentRow,
} from '@/lib/supabase/mappers'
import type {
  Assessment,
  AssessmentAssignmentWithUsage,
  ClientReportTemplateAssignment,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getAssessmentAssignments(
  clientId: string,
): Promise<AssessmentAssignmentWithUsage[]> {
  await requireClientAccess(clientId)
  const db = await createClient()

  const [assignmentResult, usageResult] = await Promise.all([
    db
      .from('client_assessment_assignments')
      .select('*, assessments(title)')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    db.rpc('get_client_assessment_quota_usage_bulk', {
      p_client_id: clientId,
    }),
  ])

  if (assignmentResult.error) {
    throwActionError(
      'getAssessmentAssignments',
      'Unable to load assessment assignments.',
      assignmentResult.error
    )
  }
  if (usageResult.error) {
    throwActionError(
      'getAssessmentAssignments.quotaUsage',
      'Unable to load assessment assignments.',
      usageResult.error
    )
  }

  const assignments = assignmentResult.data ?? []
  if (assignments.length === 0) return []

  const usageMap = new Map<string, number>()
  for (const row of Array.isArray(usageResult.data) ? usageResult.data : []) {
    const quotaUsed = Number((row as { quota_used?: number }).quota_used ?? 0)
    usageMap.set(
      String((row as { assessment_id: string }).assessment_id),
      Number.isNaN(quotaUsed) ? 0 : quotaUsed
    )
  }

  return assignments.map((row) => {
    const assessmentRecord = Array.isArray(row.assessments)
      ? row.assessments[0]
      : row.assessments
    const assessmentName =
      (assessmentRecord as Record<string, unknown>)?.title ?? 'Unknown'

    return {
      ...mapClientAssessmentAssignmentRow(row),
      assessmentName: String(assessmentName),
      quotaUsed: usageMap.get(String(row.assessment_id)) ?? 0,
    }
  })
}

export async function getAvailableAssessmentsForClient(
  clientId: string,
): Promise<
  {
    assessmentId: string
    assessmentName: string
    quotaLimit: number | null
    quotaUsed: number
    quotaRemaining: number | null
  }[]
> {
  const assignments = await getAssessmentAssignments(clientId)

  return assignments.map((a) => ({
    assessmentId: a.assessmentId,
    assessmentName: a.assessmentName,
    quotaLimit: a.quotaLimit,
    quotaUsed: a.quotaUsed,
    quotaRemaining:
      a.quotaLimit !== null ? Math.max(0, a.quotaLimit - a.quotaUsed) : null,
  }))
}

function getNestedCount(value: unknown) {
  const record = Array.isArray(value) ? value[0] : value
  if (!record || typeof record !== 'object') {
    return 0
  }

  const count = (record as { count?: number }).count
  return Number.isFinite(count) ? Number(count) : 0
}

function estimateAssessmentDurationMinutes(
  formatMode: Assessment['formatMode'],
  sections: Array<{ itemCount: number; timeLimitSeconds: number | null }>
) {
  const explicitSeconds = sections.reduce(
    (sum, section) => sum + (section.timeLimitSeconds ?? 0),
    0
  )

  if (explicitSeconds > 0) {
    return Math.max(1, Math.ceil(explicitSeconds / 60))
  }

  const totalItems = sections.reduce((sum, section) => sum + section.itemCount, 0)
  if (totalItems === 0) {
    return 0
  }

  const secondsPerItem = formatMode === 'forced_choice' ? 45 : 30
  return Math.max(5, Math.ceil((totalItems * secondsPerItem) / 60))
}

export type ClientAssessmentLibrarySummary = {
  id: string
  title: string
  description?: string
  status: Assessment['status']
  formatMode: Assessment['formatMode']
  quotaLimit: number | null
  quotaUsed: number
  quotaRemaining: number | null
  factorCount: number
  sectionCount: number
  totalItemCount: number
  estimatedDurationMinutes: number
  updatedAt?: string
}

export type ClientAssessmentLibrarySection = {
  id: string
  title: string
  instructions?: string
  displayOrder: number
  formatName: string
  formatType: string
  itemCount: number
  itemsPerPage: number | null
  timeLimitSeconds: number | null
  allowBackNav: boolean
}

export type ClientAssessmentLibraryDetail = ClientAssessmentLibrarySummary & {
  sections: ClientAssessmentLibrarySection[]
  factorsByDimension: Awaited<ReturnType<typeof getFactorsForAssessment>>
  estimatedDurationMinutes: number
}

export async function getClientAssessmentLibrary(
  clientId: string,
): Promise<ClientAssessmentLibrarySummary[]> {
  const assignments = await getAssessmentAssignments(clientId)
  if (assignments.length === 0) {
    return []
  }

  const assessmentIds = assignments.map((assignment) => assignment.assessmentId)
  const assignmentMap = new Map(
    assignments.map((assignment) => [assignment.assessmentId, assignment])
  )

  const db = createAdminClient()
  const [assessmentResult, sectionResult] = await Promise.all([
    db
      .from('assessments')
      .select(
        'id, title, description, status, format_mode, updated_at, assessment_factors(count)'
      )
      .in('id', assessmentIds)
      .is('deleted_at', null)
      .order('title', { ascending: true }),
    db
      .from('assessment_sections')
      .select('assessment_id, assessment_section_items(count)')
      .in('assessment_id', assessmentIds),
  ])

  if (assessmentResult.error) {
    throwActionError(
      'getClientAssessmentLibrary.assessments',
      'Unable to load assessments.',
      assessmentResult.error
    )
  }

  if (sectionResult.error) {
    throwActionError(
      'getClientAssessmentLibrary.sections',
      'Unable to load assessment sections.',
      sectionResult.error
    )
  }

  const sectionStats = new Map<
    string,
    { sectionCount: number; totalItemCount: number }
  >()

  for (const row of sectionResult.data ?? []) {
    const assessmentId = String(row.assessment_id)
    const existing = sectionStats.get(assessmentId) ?? {
      sectionCount: 0,
      totalItemCount: 0,
    }

    existing.sectionCount += 1
    existing.totalItemCount += getNestedCount(row.assessment_section_items)
    sectionStats.set(assessmentId, existing)
  }

  return (assessmentResult.data ?? []).flatMap((row) => {
    const assignment = assignmentMap.get(String(row.id))
    if (!assignment) {
      return []
    }

    const stats = sectionStats.get(String(row.id)) ?? {
      sectionCount: 0,
      totalItemCount: 0,
    }

    return [
      {
        id: String(row.id),
        title: String(row.title),
        description: row.description ? String(row.description) : undefined,
        status: row.status as Assessment['status'],
        formatMode: row.format_mode as Assessment['formatMode'],
        quotaLimit: assignment.quotaLimit,
        quotaUsed: assignment.quotaUsed,
        quotaRemaining:
          assignment.quotaLimit === null
            ? null
            : Math.max(0, assignment.quotaLimit - assignment.quotaUsed),
        factorCount: getNestedCount(row.assessment_factors),
        sectionCount: stats.sectionCount,
        totalItemCount: stats.totalItemCount,
        estimatedDurationMinutes: estimateAssessmentDurationMinutes(
          row.format_mode as Assessment['formatMode'],
          [{ itemCount: stats.totalItemCount, timeLimitSeconds: null }]
        ),
        updatedAt: row.updated_at ? String(row.updated_at) : undefined,
      },
    ]
  })
}

export async function getClientAssessmentLibraryDetail(
  clientId: string,
  assessmentId: string,
): Promise<ClientAssessmentLibraryDetail | null> {
  await requireClientAccess(clientId)

  const assignments = await getAssessmentAssignments(clientId)
  const assignment = assignments.find(
    (currentAssignment) => currentAssignment.assessmentId === assessmentId
  )

  if (!assignment) {
    return null
  }

  const db = createAdminClient()
  const [assessmentResult, sectionResult, factorsByDimension] = await Promise.all([
    db
      .from('assessments')
      .select(
        'id, title, description, status, format_mode, updated_at, assessment_factors(count)'
      )
      .eq('id', assessmentId)
      .is('deleted_at', null)
      .maybeSingle(),
    db
      .from('assessment_sections')
      .select(
        'id, title, instructions, display_order, items_per_page, time_limit_seconds, allow_back_nav, response_formats(name, type), assessment_section_items(count)'
      )
      .eq('assessment_id', assessmentId)
      .order('display_order', { ascending: true }),
    getFactorsForAssessment(assessmentId),
  ])

  if (assessmentResult.error) {
    throwActionError(
      'getClientAssessmentLibraryDetail.assessment',
      'Unable to load assessment.',
      assessmentResult.error
    )
  }

  if (sectionResult.error) {
    throwActionError(
      'getClientAssessmentLibraryDetail.sections',
      'Unable to load assessment sections.',
      sectionResult.error
    )
  }

  if (!assessmentResult.data) {
    return null
  }

  const sections = (sectionResult.data ?? []).map((row) => {
    const responseFormat = Array.isArray(row.response_formats)
      ? row.response_formats[0]
      : row.response_formats

    return {
      id: String(row.id),
      title: row.title ? String(row.title) : '',
      instructions: row.instructions ? String(row.instructions) : undefined,
      displayOrder: Number(row.display_order ?? 0),
      formatName: responseFormat?.name ? String(responseFormat.name) : 'Assessment',
      formatType: responseFormat?.type ? String(responseFormat.type) : 'unknown',
      itemCount: getNestedCount(row.assessment_section_items),
      itemsPerPage:
        row.items_per_page == null ? null : Number(row.items_per_page),
      timeLimitSeconds:
        row.time_limit_seconds == null ? null : Number(row.time_limit_seconds),
      allowBackNav: Boolean(row.allow_back_nav),
    }
  })

  return {
    id: String(assessmentResult.data.id),
    title: String(assessmentResult.data.title),
    description: assessmentResult.data.description
      ? String(assessmentResult.data.description)
      : undefined,
    status: assessmentResult.data.status as Assessment['status'],
    formatMode: assessmentResult.data.format_mode as Assessment['formatMode'],
    quotaLimit: assignment.quotaLimit,
    quotaUsed: assignment.quotaUsed,
    quotaRemaining:
      assignment.quotaLimit === null
        ? null
        : Math.max(0, assignment.quotaLimit - assignment.quotaUsed),
    factorCount: getNestedCount(assessmentResult.data.assessment_factors),
    sectionCount: sections.length,
    totalItemCount: sections.reduce((sum, section) => sum + section.itemCount, 0),
    updatedAt: assessmentResult.data.updated_at
      ? String(assessmentResult.data.updated_at)
      : undefined,
    sections,
    factorsByDimension,
    estimatedDurationMinutes: estimateAssessmentDurationMinutes(
      assessmentResult.data.format_mode as Assessment['formatMode'],
      sections
    ),
  }
}

export async function getReportTemplateAssignments(
  clientId: string,
): Promise<ClientReportTemplateAssignment[]> {
  await requireClientAccess(clientId)
  const db = await createClient()

  const { data, error } = await db
    .from('client_report_template_assignments')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    throwActionError(
      'getReportTemplateAssignments',
      'Unable to load report template assignments.',
      error
    )
  }
  return (data ?? []).map(mapClientReportTemplateAssignmentRow)
}

export async function getAvailableReportTemplateIds(
  clientId: string,
): Promise<string[]> {
  const assignments = await getReportTemplateAssignments(clientId)
  return assignments.map((a) => a.reportTemplateId)
}

// ---------------------------------------------------------------------------
// Quota check
// ---------------------------------------------------------------------------

export async function checkQuotaAvailability(
  clientId: string,
  assessmentIds: string[],
): Promise<{
  allowed: boolean
  violations: { assessmentId: string; quotaLimit: number; quotaUsed: number }[]
}> {
  await requireClientAccess(clientId)

  if (assessmentIds.length === 0) {
    return { allowed: true, violations: [] }
  }

  const db = await createClient()

  const [assignmentsResult, clientUsageResult, clientPartnerResult] =
    await Promise.all([
      db
        .from('client_assessment_assignments')
        .select('assessment_id, quota_limit')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .in('assessment_id', assessmentIds),
      db.rpc('get_client_assessment_quota_usage_bulk', {
        p_client_id: clientId,
      }),
      db
        .from('clients')
        .select('partner_id')
        .eq('id', clientId)
        .single(),
    ])

  if (assignmentsResult.error) {
    throwActionError(
      'checkQuotaAvailability.assignments',
      'Unable to validate assessment quota.',
      assignmentsResult.error
    )
  }
  if (clientUsageResult.error) {
    throwActionError(
      'checkQuotaAvailability.clientUsage',
      'Unable to validate assessment quota.',
      clientUsageResult.error
    )
  }

  const clientUsageMap = new Map<string, number>()
  for (const row of Array.isArray(clientUsageResult.data) ? clientUsageResult.data : []) {
    const quotaUsed = Number((row as { quota_used?: number }).quota_used ?? 0)
    clientUsageMap.set(
      String((row as { assessment_id: string }).assessment_id),
      Number.isNaN(quotaUsed) ? 0 : quotaUsed
    )
  }

  const violations: { assessmentId: string; quotaLimit: number; quotaUsed: number }[] = []

  for (const row of assignmentsResult.data ?? []) {
    if (row.quota_limit === null) continue

    const quotaUsed = clientUsageMap.get(String(row.assessment_id)) ?? 0
    if (quotaUsed >= row.quota_limit) {
      violations.push({
        assessmentId: row.assessment_id,
        quotaLimit: row.quota_limit,
        quotaUsed,
      })
    }
  }

  // Partner-level quota check (if client belongs to a partner)
  if (clientPartnerResult.error) {
    throwActionError(
      'checkQuotaAvailability.partnerLookup',
      'Unable to validate assessment quota.',
      clientPartnerResult.error
    )
  }

  const partnerId = clientPartnerResult.data?.partner_id
  if (partnerId) {
    const [partnerAssignmentsResult, partnerUsageResult] = await Promise.all([
      db
        .from('partner_assessment_assignments')
        .select('assessment_id, quota_limit')
        .eq('partner_id', partnerId)
        .eq('is_active', true)
        .in('assessment_id', assessmentIds),
      db.rpc('get_partner_assessment_quota_usage_bulk', {
        p_partner_id: partnerId,
      }),
    ])

    if (partnerAssignmentsResult.error) {
      throwActionError(
        'checkQuotaAvailability.partnerAssignments',
        'Unable to validate partner assessment quota.',
        partnerAssignmentsResult.error
      )
    }
    if (partnerUsageResult.error) {
      throwActionError(
        'checkQuotaAvailability.partnerUsage',
        'Unable to validate partner assessment quota.',
        partnerUsageResult.error
      )
    }

    const partnerUsageMap = new Map<string, number>()
    for (const row of Array.isArray(partnerUsageResult.data) ? partnerUsageResult.data : []) {
      const quotaUsed = Number((row as { quota_used?: number }).quota_used ?? 0)
      partnerUsageMap.set(
        String((row as { assessment_id: string }).assessment_id),
        Number.isNaN(quotaUsed) ? 0 : quotaUsed
      )
    }

    for (const partnerAssignment of partnerAssignmentsResult.data ?? []) {
      if (partnerAssignment.quota_limit == null) continue
      const quotaUsed =
        partnerUsageMap.get(String(partnerAssignment.assessment_id)) ?? 0
      if (quotaUsed >= partnerAssignment.quota_limit) {
        violations.push({
          assessmentId: partnerAssignment.assessment_id,
          quotaLimit: partnerAssignment.quota_limit,
          quotaUsed,
        })
      }
    }
  }

  return { allowed: violations.length === 0, violations }
}

// ---------------------------------------------------------------------------
// Mutations (admin-only)
// ---------------------------------------------------------------------------

export async function assignAssessment(
  clientId: string,
  input: { assessmentId: string; quotaLimit?: number | null },
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requireClientAccess(clientId)
  if (!scope.isPlatformAdmin) {
    return { error: 'Only platform administrators can assign assessments.' }
  }
  if (!scope.actor?.id) {
    return { error: "Unable to determine the acting user" };
  }

  const db = createAdminClient()

  // If client belongs to a partner, verify assessment is in partner's pool
  const { data: clientRow } = await db.from('clients')
    .select('partner_id')
    .eq('id', clientId)
    .single()

  if (clientRow?.partner_id) {
    const { data: partnerAssignment } = await db
      .from('partner_assessment_assignments')
      .select('id')
      .eq('partner_id', clientRow.partner_id)
      .eq('assessment_id', input.assessmentId)
      .eq('is_active', true)
      .maybeSingle()

    if (!partnerAssignment) {
      return { error: "This assessment is not available through the partner's allocation." }
    }
  }

  const { data, error } = await db
    .from('client_assessment_assignments')
    .insert({
      client_id: clientId,
      assessment_id: input.assessmentId,
      quota_limit: input.quotaLimit ?? null,
      assigned_by: scope.actor.id,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'This assessment is already assigned to this client.' }
    }
    return { error: error.message }
  }

  revalidatePath('/clients')
  return { success: true, id: data.id }
}

export async function updateAssessmentAssignment(
  assignmentId: string,
  clientId: string,
  updates: { quotaLimit?: number | null; isActive?: boolean },
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requireClientAccess(clientId)
  if (!scope.isPlatformAdmin) {
    return { error: 'Only platform administrators can update assessment assignments.' }
  }

  const db = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {}
  if (updates.quotaLimit !== undefined) patch.quota_limit = updates.quotaLimit
  if (updates.isActive !== undefined) patch.is_active = updates.isActive

  if (Object.keys(patch).length === 0) {
    return { success: true, id: assignmentId }
  }

  const { error } = await db
    .from('client_assessment_assignments')
    .update(patch)
    .eq('id', assignmentId)
    .eq('client_id', clientId)

  if (error) return { error: error.message }

  revalidatePath('/clients')
  return { success: true, id: assignmentId }
}

export async function removeAssessmentAssignment(
  assignmentId: string,
  clientId: string,
): Promise<{ success: true; id: string } | { error: string }> {
  return updateAssessmentAssignment(assignmentId, clientId, {
    isActive: false,
  })
}

export async function toggleReportTemplateAssignment(
  clientId: string,
  reportTemplateId: string,
  assigned: boolean,
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requireClientAccess(clientId)
  if (!scope.isPlatformAdmin) {
    return { error: 'Only platform administrators can manage report template assignments.' }
  }
  if (!scope.actor?.id) {
    return { error: "Unable to determine the acting user" };
  }

  const db = createAdminClient()

  if (assigned) {
    // Upsert: insert or re-activate
    const { data, error } = await db
      .from('client_report_template_assignments')
      .upsert(
        {
          client_id: clientId,
          report_template_id: reportTemplateId,
          is_active: true,
          assigned_by: scope.actor.id,
        },
        { onConflict: 'client_id,report_template_id' },
      )
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/clients')
    return { success: true, id: data.id }
  } else {
    // Deactivate
    const { data, error } = await db
      .from('client_report_template_assignments')
      .update({ is_active: false })
      .eq('client_id', clientId)
      .eq('report_template_id', reportTemplateId)
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/clients')
    return { success: true, id: data.id }
  }
}

/**
 * Check if branding is enabled for a client, respecting partner cascade.
 * Returns false if the client's own flag is off OR if the client's partner has branding disabled.
 */
export async function isClientBrandingEnabled(clientId: string): Promise<boolean> {
  const db = await createClient()

  const { data: client } = await db
    .from('clients')
    .select('can_customize_branding, partner_id')
    .eq('id', clientId)
    .single()

  if (!client?.can_customize_branding) return false

  // If client has a partner, check partner's flag too
  if (client.partner_id) {
    const { data: partner } = await db
      .from('partners')
      .select('can_customize_branding')
      .eq('id', client.partner_id)
      .single()

    if (!partner?.can_customize_branding) return false
  }

  return true
}

export async function toggleClientBranding(
  clientId: string,
  canCustomize: boolean,
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requireClientAccess(clientId)
  if (!scope.isPlatformAdmin) {
    return { error: 'Only platform administrators can manage branding settings.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('clients')
    .update({ can_customize_branding: canCustomize })
    .eq('id', clientId)

  if (error) return { error: error.message }

  revalidatePath('/clients')
  return { success: true, id: clientId }
}
