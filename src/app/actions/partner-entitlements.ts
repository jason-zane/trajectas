'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requirePartnerAccess } from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'
import {
  mapPartnerAssessmentAssignmentRow,
  mapPartnerReportTemplateAssignmentRow,
} from '@/lib/supabase/mappers'
import type {
  PartnerAssessmentAssignmentWithUsage,
  PartnerReportTemplateAssignment,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getPartnerAssessmentAssignments(
  partnerId: string,
): Promise<PartnerAssessmentAssignmentWithUsage[]> {
  await requirePartnerAccess(partnerId)
  const db = await createClient()

  const { data, error } = await db
    .from('partner_assessment_assignments')
    .select('*, assessments(title)')
    .eq('partner_id', partnerId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    throwActionError(
      'getPartnerAssessmentAssignments',
      'Unable to load assessment assignments.',
      error
    )
  }
  if (!data || data.length === 0) return []

  // Compute usage for each assignment via the DB function
  const results: PartnerAssessmentAssignmentWithUsage[] = []
  for (const row of data) {
    const { data: usageData, error: usageError } = await db.rpc(
      'get_partner_assessment_quota_usage',
      {
        p_partner_id: partnerId,
        p_assessment_id: row.assessment_id,
      }
    )

    if (usageError) {
      throwActionError(
        'getPartnerAssessmentAssignments.quotaUsage',
        'Unable to load assessment assignments.',
        usageError
      )
    }

    const assessmentRecord = Array.isArray(row.assessments)
      ? row.assessments[0]
      : row.assessments
    const assessmentName =
      (assessmentRecord as Record<string, unknown>)?.title ?? 'Unknown'

    results.push({
      ...mapPartnerAssessmentAssignmentRow(row),
      assessmentName: String(assessmentName),
      quotaUsed: typeof usageData === 'number' ? usageData : 0,
    })
  }

  return results
}

export async function getPartnerReportTemplateAssignments(
  partnerId: string,
): Promise<PartnerReportTemplateAssignment[]> {
  await requirePartnerAccess(partnerId)
  const db = await createClient()

  const { data, error } = await db
    .from('partner_report_template_assignments')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    throwActionError(
      'getPartnerReportTemplateAssignments',
      'Unable to load report template assignments.',
      error
    )
  }
  return (data ?? []).map(mapPartnerReportTemplateAssignmentRow)
}

// ---------------------------------------------------------------------------
// Mutations (admin-only)
// ---------------------------------------------------------------------------

export async function assignAssessmentToPartner(
  partnerId: string,
  input: { assessmentId: string; quotaLimit?: number | null },
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requirePartnerAccess(partnerId)
  if (!scope.isPlatformAdmin) {
    return { error: 'Only platform administrators can assign assessments.' }
  }
  if (!scope.actor?.id) {
    return { error: 'Unable to determine the acting user' }
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('partner_assessment_assignments')
    .insert({
      partner_id: partnerId,
      assessment_id: input.assessmentId,
      quota_limit: input.quotaLimit ?? null,
      assigned_by: scope.actor.id,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'This assessment is already assigned to this partner.' }
    }
    return { error: error.message }
  }

  revalidatePath('/partners')
  return { success: true, id: data.id }
}

export async function updatePartnerAssessmentAssignment(
  assignmentId: string,
  partnerId: string,
  updates: { quotaLimit?: number | null; isActive?: boolean },
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requirePartnerAccess(partnerId)
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
    .from('partner_assessment_assignments')
    .update(patch)
    .eq('id', assignmentId)
    .eq('partner_id', partnerId)

  if (error) return { error: error.message }

  revalidatePath('/partners')
  return { success: true, id: assignmentId }
}

export async function removePartnerAssessmentAssignment(
  assignmentId: string,
  partnerId: string,
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requirePartnerAccess(partnerId)
  if (!scope.isPlatformAdmin) {
    return { error: 'Only platform administrators can update assessment assignments.' }
  }

  // Fetch the assignment to get the assessment_id before removing
  const adminDb = createAdminClient()
  const { data: assignment, error: fetchError } = await adminDb
    .from('partner_assessment_assignments')
    .select('assessment_id')
    .eq('id', assignmentId)
    .eq('partner_id', partnerId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (!assignment) return { error: 'Assignment not found.' }

  // Guard: check if any clients under this partner still have this assessment assigned
  const { data: clientIds, error: clientFetchError } = await adminDb
    .from('clients')
    .select('id')
    .eq('partner_id', partnerId)

  if (clientFetchError) return { error: clientFetchError.message }

  if (clientIds && clientIds.length > 0) {
    const ids = clientIds.map((c) => c.id)
    const { count, error: countError } = await adminDb
      .from('client_assessment_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('assessment_id', assignment.assessment_id)
      .eq('is_active', true)
      .in('client_id', ids)

    if (countError) return { error: countError.message }
    if (count && count > 0) {
      return { error: 'Remove this assessment from all clients first.' }
    }
  }

  return updatePartnerAssessmentAssignment(assignmentId, partnerId, {
    isActive: false,
  })
}

export async function togglePartnerReportTemplateAssignment(
  partnerId: string,
  reportTemplateId: string,
  assigned: boolean,
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requirePartnerAccess(partnerId)
  if (!scope.isPlatformAdmin) {
    return { error: 'Only platform administrators can manage report template assignments.' }
  }
  if (!scope.actor?.id) {
    return { error: 'Unable to determine the acting user' }
  }

  const db = createAdminClient()

  if (assigned) {
    // Upsert: insert or re-activate
    const { data, error } = await db
      .from('partner_report_template_assignments')
      .upsert(
        {
          partner_id: partnerId,
          report_template_id: reportTemplateId,
          is_active: true,
          assigned_by: scope.actor.id,
        },
        { onConflict: 'partner_id,report_template_id' },
      )
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/partners')
    return { success: true, id: data.id }
  } else {
    // Deactivate
    const { data, error } = await db
      .from('partner_report_template_assignments')
      .update({ is_active: false })
      .eq('partner_id', partnerId)
      .eq('report_template_id', reportTemplateId)
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/partners')
    return { success: true, id: data.id }
  }
}

export async function togglePartnerBranding(
  partnerId: string,
  canCustomize: boolean,
): Promise<{ success: true; id: string } | { error: string }> {
  const { scope } = await requirePartnerAccess(partnerId)
  if (!scope.isPlatformAdmin) {
    return { error: 'Only platform administrators can manage branding settings.' }
  }

  const db = createAdminClient()
  const { error } = await db
    .from('partners')
    .update({ can_customize_branding: canCustomize })
    .eq('id', partnerId)

  if (error) return { error: error.message }

  revalidatePath('/partners')
  return { success: true, id: partnerId }
}
