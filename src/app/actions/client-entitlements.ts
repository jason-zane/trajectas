'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrganizationAccess } from '@/lib/auth/authorization'
import {
  mapClientAssessmentAssignmentRow,
  mapClientReportTemplateAssignmentRow,
} from '@/lib/supabase/mappers'
import type {
  AssessmentAssignmentWithUsage,
  ClientReportTemplateAssignment,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getAssessmentAssignments(
  organizationId: string,
): Promise<AssessmentAssignmentWithUsage[]> {
  await requireOrganizationAccess(organizationId)
  const db = createAdminClient()

  const { data, error } = await db
    .from('client_assessment_assignments')
    .select('*, assessments(name)')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return []

  // Compute usage for each assignment via the DB function
  const results: AssessmentAssignmentWithUsage[] = []
  for (const row of data) {
    const { data: usageData } = await db.rpc('get_assessment_quota_usage', {
      p_org_id: organizationId,
      p_assessment_id: row.assessment_id,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assessmentRecord = Array.isArray(row.assessments)
      ? row.assessments[0]
      : row.assessments
    const assessmentName =
      (assessmentRecord as Record<string, unknown>)?.name ?? 'Unknown'

    results.push({
      ...mapClientAssessmentAssignmentRow(row),
      assessmentName: String(assessmentName),
      quotaUsed: typeof usageData === 'number' ? usageData : 0,
    })
  }

  return results
}

export async function getAvailableAssessmentsForClient(
  organizationId: string,
): Promise<
  {
    assessmentId: string
    assessmentName: string
    quotaLimit: number | null
    quotaUsed: number
    quotaRemaining: number | null
  }[]
> {
  const assignments = await getAssessmentAssignments(organizationId)

  return assignments.map((a) => ({
    assessmentId: a.assessmentId,
    assessmentName: a.assessmentName,
    quotaLimit: a.quotaLimit,
    quotaUsed: a.quotaUsed,
    quotaRemaining:
      a.quotaLimit !== null ? Math.max(0, a.quotaLimit - a.quotaUsed) : null,
  }))
}

export async function getReportTemplateAssignments(
  organizationId: string,
): Promise<ClientReportTemplateAssignment[]> {
  await requireOrganizationAccess(organizationId)
  const db = createAdminClient()

  const { data, error } = await db
    .from('client_report_template_assignments')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapClientReportTemplateAssignmentRow)
}

export async function getAvailableReportTemplateIds(
  organizationId: string,
): Promise<string[]> {
  const assignments = await getReportTemplateAssignments(organizationId)
  return assignments.map((a) => a.reportTemplateId)
}

// ---------------------------------------------------------------------------
// Quota check
// ---------------------------------------------------------------------------

export async function checkQuotaAvailability(
  organizationId: string,
  assessmentIds: string[],
): Promise<{
  allowed: boolean
  violations: { assessmentId: string; quotaLimit: number; quotaUsed: number }[]
}> {
  await requireOrganizationAccess(organizationId)

  if (assessmentIds.length === 0) {
    return { allowed: true, violations: [] };
  }

  const db = createAdminClient()

  // Get assignments that have quota limits for the requested assessments
  const { data: assignments, error } = await db
    .from('client_assessment_assignments')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .in('assessment_id', assessmentIds)

  if (error) throw new Error(error.message)

  const violations: { assessmentId: string; quotaLimit: number; quotaUsed: number }[] = []

  for (const row of assignments ?? []) {
    if (row.quota_limit === null) continue

    const { data: usageData } = await db.rpc('get_assessment_quota_usage', {
      p_org_id: organizationId,
      p_assessment_id: row.assessment_id,
    })

    const quotaUsed = typeof usageData === 'number' ? usageData : 0
    if (quotaUsed >= row.quota_limit) {
      violations.push({
        assessmentId: row.assessment_id,
        quotaLimit: row.quota_limit,
        quotaUsed,
      })
    }
  }

  return { allowed: violations.length === 0, violations }
}

// ---------------------------------------------------------------------------
// Mutations (admin-only)
// ---------------------------------------------------------------------------

export async function assignAssessment(
  organizationId: string,
  input: { assessmentId: string; quotaLimit?: number | null },
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requireOrganizationAccess(organizationId)
  if (!scope.isPlatformAdmin) {
    return { error: 'Only platform administrators can assign assessments.' }
  }
  if (!scope.actor?.id) {
    return { error: "Unable to determine the acting user" };
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('client_assessment_assignments')
    .insert({
      organization_id: organizationId,
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

  revalidatePath('/organizations')
  return { success: true, id: data.id }
}

export async function updateAssessmentAssignment(
  assignmentId: string,
  organizationId: string,
  updates: { quotaLimit?: number | null; isActive?: boolean },
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requireOrganizationAccess(organizationId)
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
    .eq('organization_id', organizationId)

  if (error) return { error: error.message }

  revalidatePath('/organizations')
  return { success: true, id: assignmentId }
}

export async function removeAssessmentAssignment(
  assignmentId: string,
  organizationId: string,
): Promise<{ success: true; id: string } | { error: string }> {
  return updateAssessmentAssignment(assignmentId, organizationId, {
    isActive: false,
  })
}

export async function toggleReportTemplateAssignment(
  organizationId: string,
  reportTemplateId: string,
  assigned: boolean,
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requireOrganizationAccess(organizationId)
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
          organization_id: organizationId,
          report_template_id: reportTemplateId,
          is_active: true,
          assigned_by: scope.actor.id,
        },
        { onConflict: 'organization_id,report_template_id' },
      )
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/organizations')
    return { success: true, id: data.id }
  } else {
    // Deactivate
    const { data, error } = await db
      .from('client_report_template_assignments')
      .update({ is_active: false })
      .eq('organization_id', organizationId)
      .eq('report_template_id', reportTemplateId)
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/organizations')
    return { success: true, id: data.id }
  }
}

export async function toggleClientBranding(
  organizationId: string,
  canCustomize: boolean,
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requireOrganizationAccess(organizationId)
  if (!scope.isPlatformAdmin) {
    return { error: 'Only platform administrators can manage branding settings.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('organizations')
    .update({ can_customize_branding: canCustomize })
    .eq('id', organizationId)

  if (error) return { error: error.message }

  revalidatePath('/organizations')
  return { success: true, id: organizationId }
}
