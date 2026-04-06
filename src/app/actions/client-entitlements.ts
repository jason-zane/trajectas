'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireClientAccess } from '@/lib/auth/authorization'
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
  clientId: string,
): Promise<AssessmentAssignmentWithUsage[]> {
  await requireClientAccess(clientId)
  const db = createAdminClient()

  const { data, error } = await db
    .from('client_assessment_assignments')
    .select('*, assessments(name)')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return []

  // Compute usage for each assignment via the DB function
  const results: AssessmentAssignmentWithUsage[] = []
  for (const row of data) {
    const { data: usageData } = await db.rpc('get_assessment_quota_usage', {
      p_org_id: clientId,
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

export async function getReportTemplateAssignments(
  clientId: string,
): Promise<ClientReportTemplateAssignment[]> {
  await requireClientAccess(clientId)
  const db = createAdminClient()

  const { data, error } = await db
    .from('client_report_template_assignments')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
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
    return { allowed: true, violations: [] };
  }

  const db = createAdminClient()

  // Get assignments that have quota limits for the requested assessments
  const { data: assignments, error } = await db
    .from('client_assessment_assignments')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .in('assessment_id', assessmentIds)

  if (error) throw new Error(error.message)

  const violations: { assessmentId: string; quotaLimit: number; quotaUsed: number }[] = []

  for (const row of assignments ?? []) {
    if (row.quota_limit === null) continue

    const { data: usageData } = await db.rpc('get_assessment_quota_usage', {
      p_org_id: clientId,
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
