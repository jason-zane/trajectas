'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireClientAccess } from '@/lib/auth/authorization'
import { throwActionError } from '@/lib/security/action-errors'
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
