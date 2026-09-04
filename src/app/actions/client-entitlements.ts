'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  canManageClientEntitlements,
  requireClientAccess,
  resolveAuthorizedScope,
  resolveTenantClientFilter,
} from '@/lib/auth/authorization'
import { logAuditEventSafe } from '@/lib/auth/support-sessions'
import { throwActionError } from '@/lib/security/action-errors'
import { estimateAssessmentDurationMinutes } from '@/lib/assessments/duration'
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
import {
  clientIdSchema,
  clientAssessmentDetailSchema,
  checkQuotaAvailabilitySchema,
  assignAssessmentSchema,
  updateAssessmentAssignmentSchema,
  removeAssessmentAssignmentSchema,
  toggleReportTemplateAssignmentSchema,
  toggleClientBrandingSchema,
} from '@/lib/validations/client-entitlements'

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getAssessmentAssignments(
  clientId: string,
): Promise<AssessmentAssignmentWithUsage[]> {
  const parsed = clientIdSchema.safeParse({ clientId })
  if (!parsed.success) return []
  await requireClientAccess(clientId)
  const db = await createClient()

  const [assignmentResult, usageResult] = await Promise.all([
    db
      .from('client_assessment_assignments')
      .select('*, assessments!inner(title, deleted_at)')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .is('assessments.deleted_at', null)
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
  const parsed = clientIdSchema.safeParse({ clientId })
  if (!parsed.success) return []
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
  constructCount: number
  sectionCount: number
  totalItemCount: number
  estimatedDurationMinutes: number
  campaignCount: number
  updatedAt?: string
  minCustomFactors: number | null
}

export type ClientAssessmentLibrarySection = {
  id: string
  title: string
  instructions?: string
  displayOrder: number
  formatName: string
  formatType: string
  itemCount: number
  timeLimitSeconds: number | null
}

export type ClientAssessmentLibraryDetail = ClientAssessmentLibrarySummary & {
  sections: ClientAssessmentLibrarySection[]
  factorsByDimension: Awaited<ReturnType<typeof getFactorsForAssessment>>
  estimatedDurationMinutes: number
}

export async function getClientAssessmentLibrary(
  clientId: string,
): Promise<ClientAssessmentLibrarySummary[]> {
  const parsed = clientIdSchema.safeParse({ clientId })
  if (!parsed.success) return []
  await requireClientAccess(clientId)
  const assignments = await getAssessmentAssignments(clientId)
  if (assignments.length === 0) {
    return []
  }

  const assessmentIds = assignments.map((assignment) => assignment.assessmentId)
  const assignmentMap = new Map(
    assignments.map((assignment) => [assignment.assessmentId, assignment])
  )

  const db = createAdminClient()
  const [
    assessmentResult,
    sectionResult,
    factorLinkResult,
    campaignLinkResult,
  ] = await Promise.all([
    db
      .from('assessments')
      .select(
        'id, title, description, status, format_mode, min_custom_factors, updated_at, assessment_factors(count)'
      )
      .in('id', assessmentIds)
      .is('deleted_at', null)
      .order('title', { ascending: true }),
    db
      .from('assessment_sections')
      .select('assessment_id, assessment_section_items(count)')
      .in('assessment_id', assessmentIds),
    db
      .from('assessment_factors')
      .select('assessment_id, factor_id')
      .in('assessment_id', assessmentIds),
    db
      .from('campaign_assessments')
      .select('assessment_id, campaigns!inner(client_id, deleted_at)')
      .in('assessment_id', assessmentIds)
      .eq('campaigns.client_id', clientId)
      .is('campaigns.deleted_at', null),
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

  if (factorLinkResult.error) {
    throwActionError(
      'getClientAssessmentLibrary.factors',
      'Unable to load assessment factors.',
      factorLinkResult.error
    )
  }

  if (campaignLinkResult.error) {
    throwActionError(
      'getClientAssessmentLibrary.campaigns',
      'Unable to count assessment campaigns.',
      campaignLinkResult.error
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

  // Map each assessment to its factor IDs, then count distinct constructs
  // across those factors via factor_constructs.
  const factorIdsByAssessment = new Map<string, string[]>()
  const allFactorIds = new Set<string>()
  for (const row of factorLinkResult.data ?? []) {
    const assessmentId = String(row.assessment_id)
    const factorId = String(row.factor_id)
    const list = factorIdsByAssessment.get(assessmentId) ?? []
    list.push(factorId)
    factorIdsByAssessment.set(assessmentId, list)
    allFactorIds.add(factorId)
  }

  const constructIdsByFactor = new Map<string, string[]>()
  if (allFactorIds.size > 0) {
    const { data: fcRows, error: fcError } = await db
      .from('factor_constructs')
      .select('factor_id, construct_id')
      .in('factor_id', Array.from(allFactorIds))

    if (fcError) {
      throwActionError(
        'getClientAssessmentLibrary.factorConstructs',
        'Unable to load factor constructs.',
        fcError
      )
    }

    for (const fc of fcRows ?? []) {
      const factorId = String(fc.factor_id)
      const list = constructIdsByFactor.get(factorId) ?? []
      list.push(String(fc.construct_id))
      constructIdsByFactor.set(factorId, list)
    }
  }

  const constructSetByAssessment = new Map<string, Set<string>>()
  for (const assessmentId of assessmentIds) {
    constructSetByAssessment.set(assessmentId, new Set<string>())
  }
  for (const [assessmentId, factorIds] of factorIdsByAssessment) {
    const set = constructSetByAssessment.get(assessmentId)!
    for (const factorId of factorIds) {
      for (const constructId of constructIdsByFactor.get(factorId) ?? []) {
        set.add(constructId)
      }
    }
  }
  const constructCountByAssessment = new Map<string, number>()
  for (const [assessmentId, set] of constructSetByAssessment) {
    constructCountByAssessment.set(assessmentId, set.size)
  }

  const campaignCountByAssessment = new Map<string, number>()
  for (const row of campaignLinkResult.data ?? []) {
    const assessmentId = String(row.assessment_id)
    campaignCountByAssessment.set(
      assessmentId,
      (campaignCountByAssessment.get(assessmentId) ?? 0) + 1
    )
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
        constructCount: constructCountByAssessment.get(String(row.id)) ?? 0,
        sectionCount: stats.sectionCount,
        totalItemCount: stats.totalItemCount,
        estimatedDurationMinutes: estimateAssessmentDurationMinutes(
          stats.totalItemCount,
        ),
        campaignCount: campaignCountByAssessment.get(String(row.id)) ?? 0,
        updatedAt: row.updated_at ? String(row.updated_at) : undefined,
        minCustomFactors:
          (row as { min_custom_factors?: number | null }).min_custom_factors ?? null,
      },
    ]
  })
}

export async function getClientAssessmentLibraryDetail(
  clientId: string,
  assessmentId: string,
): Promise<ClientAssessmentLibraryDetail | null> {
  const parsed = clientAssessmentDetailSchema.safeParse({ clientId, assessmentId })
  if (!parsed.success) return null
  await requireClientAccess(clientId)

  const assignments = await getAssessmentAssignments(clientId)
  const assignment = assignments.find(
    (currentAssignment) => currentAssignment.assessmentId === assessmentId
  )

  if (!assignment) {
    return null
  }

  const db = createAdminClient()
  const [
    assessmentResult,
    sectionResult,
    factorsByDimension,
    campaignLinkResult,
  ] = await Promise.all([
    db
      .from('assessments')
      .select(
        'id, title, description, status, format_mode, min_custom_factors, updated_at, assessment_factors(count)'
      )
      .eq('id', assessmentId)
      .is('deleted_at', null)
      .maybeSingle(),
    db
      .from('assessment_sections')
      .select(
        'id, title, instructions, display_order, time_limit_seconds, response_formats(name, type), assessment_section_items(count)'
      )
      .eq('assessment_id', assessmentId)
      .order('display_order', { ascending: true }),
    getFactorsForAssessment(assessmentId),
    db
      .from('campaign_assessments')
      .select('campaign_id, campaigns!inner(client_id, deleted_at)', {
        count: 'exact',
        head: true,
      })
      .eq('assessment_id', assessmentId)
      .eq('campaigns.client_id', clientId)
      .is('campaigns.deleted_at', null),
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

  if (campaignLinkResult.error) {
    throwActionError(
      'getClientAssessmentLibraryDetail.campaigns',
      'Unable to count assessment campaigns.',
      campaignLinkResult.error
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
      timeLimitSeconds:
        row.time_limit_seconds == null ? null : Number(row.time_limit_seconds),
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
    constructCount: factorsByDimension.reduce(
      (sum, dim) =>
        sum + dim.factors.reduce((f, factor) => f + factor.constructCount, 0),
      0
    ),
    sectionCount: sections.length,
    totalItemCount: sections.reduce((sum, section) => sum + section.itemCount, 0),
    campaignCount: campaignLinkResult.count ?? 0,
    updatedAt: assessmentResult.data.updated_at
      ? String(assessmentResult.data.updated_at)
      : undefined,
    sections,
    factorsByDimension,
    estimatedDurationMinutes: estimateAssessmentDurationMinutes(
      sections.reduce((sum, s) => sum + s.itemCount, 0),
      sections.map((s) => s.timeLimitSeconds),
    ),
    minCustomFactors:
      (assessmentResult.data as { min_custom_factors?: number | null })
        .min_custom_factors ?? null,
  }
}

export async function getReportTemplateAssignments(
  clientId: string,
): Promise<ClientReportTemplateAssignment[]> {
  const parsed = clientIdSchema.safeParse({ clientId })
  if (!parsed.success) return []
  await requireClientAccess(clientId)
  const db = await createClient()

  const { data, error } = await db
    .from('client_report_template_assignments')
    .select('*, report_templates!inner(deleted_at)')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .is('report_templates.deleted_at', null)
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
  const parsed = clientIdSchema.safeParse({ clientId })
  if (!parsed.success) return []
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
  const parsed = checkQuotaAvailabilitySchema.safeParse({ clientId, assessmentIds })
  if (!parsed.success) return { allowed: false, violations: [] }
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
// Mutations — platform admins, or admins of the partner that owns the client
// (canManageClientEntitlements). Client admins never set their own
// entitlements. Partner writes flow through here so the pool, cap and audit
// rules apply; RLS keeps direct writes platform-only.
// ---------------------------------------------------------------------------

const ENTITLEMENT_PERMISSION_ERROR =
  "Only platform administrators or the client's partner can manage entitlements."

/**
 * Partner pool + cap rule (D3/D4). Returns an error string, or null when the
 * assignment is allowed. Platform-owned clients (no partner) always pass.
 *
 * - The assessment must be in the partner's active allocation, or be owned by
 *   that partner, or be owned by this client.
 * - When the allocation carries a quota cap, the client quota is required and
 *   may not exceed it. (Use-time enforcement in checkQuotaAvailability remains
 *   the hard stop; this is the assignment-time guard.)
 */
async function checkPartnerPoolAndCap(
  db: ReturnType<typeof createAdminClient>,
  clientId: string,
  assessmentId: string,
  quotaLimit: number | null | undefined,
): Promise<string | null> {
  const { data: clientRow, error: clientError } = await db
    .from('clients')
    .select('partner_id')
    .eq('id', clientId)
    .single()
  if (clientError) return clientError.message
  const partnerId = clientRow?.partner_id ? String(clientRow.partner_id) : null
  if (!partnerId) return null

  const [
    { data: pool, error: poolError },
    { data: assessment, error: assessmentError },
  ] = await Promise.all([
    db
      .from('partner_assessment_assignments')
      .select('quota_limit')
      .eq('partner_id', partnerId)
      .eq('assessment_id', assessmentId)
      .eq('is_active', true)
      .maybeSingle(),
    db.from('assessments').select('partner_id, client_id').eq('id', assessmentId).single(),
  ])
  if (poolError) return poolError.message
  if (assessmentError) return assessmentError.message

  // D4: owned assessments never need a pool row.
  const partnerOwned =
    assessment?.partner_id != null && String(assessment.partner_id) === partnerId
  const clientOwned =
    assessment?.client_id != null && String(assessment.client_id) === clientId
  if (!pool && !partnerOwned && !clientOwned) {
    return "This assessment is not available through the partner's allocation."
  }

  const cap = pool?.quota_limit ?? null
  if (cap != null) {
    if (quotaLimit == null) {
      return `Set a quota of at most ${cap}: this assessment is capped for your partner.`
    }
    if (quotaLimit > cap) {
      return `Quota cannot exceed the partner allocation of ${cap}.`
    }
  }
  return null
}

export async function assignAssessment(
  clientId: string,
  input: { assessmentId: string; quotaLimit?: number | null },
): Promise<{ success: true; id: string } | { error: string }> {
  const parsed = assignAssessmentSchema.safeParse({ clientId, ...input })
  if (!parsed.success) return { error: 'Invalid input' }
  const { scope, partnerId } = await requireClientAccess(clientId)
  if (!canManageClientEntitlements(scope, clientId, partnerId)) {
    return { error: ENTITLEMENT_PERMISSION_ERROR }
  }
  if (!scope.actor?.id) {
    return { error: "Unable to determine the acting user" };
  }

  const db = createAdminClient()

  // Pool + cap rule (D3/D4). The database trigger
  // enforce_client_assignment_in_partner_pool re-checks the pool rule for every
  // actor; this gives the caller a readable message first.
  const poolError = await checkPartnerPoolAndCap(
    db,
    clientId,
    input.assessmentId,
    input.quotaLimit ?? null,
  )
  if (poolError) return { error: poolError }

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

  await logAuditEventSafe({
    actorProfileId: scope.actor.id,
    eventType: 'entitlement.client.assigned',
    targetTable: 'client_assessment_assignments',
    targetId: data.id,
    clientId: clientId,
    metadata: {
      assessmentId: input.assessmentId,
      quotaLimit: input.quotaLimit ?? null,
    },
  })

  revalidatePath('/clients')

  revalidatePath('/partner/clients', 'layout')
  return { success: true, id: data.id }
}

export async function updateAssessmentAssignment(
  assignmentId: string,
  clientId: string,
  updates: { quotaLimit?: number | null; isActive?: boolean },
): Promise<{ success: true; id: string } | { error: string }> {
  const parsed = updateAssessmentAssignmentSchema.safeParse({ assignmentId, clientId, ...updates })
  if (!parsed.success) return { error: 'Invalid input' }
  const { scope, partnerId } = await requireClientAccess(clientId)
  if (!canManageClientEntitlements(scope, clientId, partnerId)) {
    return { error: ENTITLEMENT_PERMISSION_ERROR }
  }

  const db = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {}
  if (updates.quotaLimit !== undefined) patch.quota_limit = updates.quotaLimit
  if (updates.isActive !== undefined) patch.is_active = updates.isActive

  if (Object.keys(patch).length === 0) {
    return { success: true, id: assignmentId }
  }

  // Fetch previous state for audit logging
  const { data: previous, error: fetchError } = await db
    .from('client_assessment_assignments')
    .select('assessment_id, quota_limit, is_active')
    .eq('id', assignmentId)
    .eq('client_id', clientId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (!previous) return { error: 'Assignment not found.' }

  if (updates.quotaLimit !== undefined) {
    const poolError = await checkPartnerPoolAndCap(
      db,
      clientId,
      String(previous.assessment_id),
      updates.quotaLimit,
    )
    if (poolError) return { error: poolError }
  }

  const { error } = await db
    .from('client_assessment_assignments')
    .update(patch)
    .eq('id', assignmentId)
    .eq('client_id', clientId)

  if (error) return { error: error.message }

  const eventType = updates.isActive !== undefined
    ? (updates.isActive ? 'entitlement.client.reactivated' : 'entitlement.client.deactivated')
    : 'entitlement.client.quota_updated'

  await logAuditEventSafe({
    actorProfileId: scope.actor?.id ?? null,
    eventType: eventType,
    targetTable: 'client_assessment_assignments',
    targetId: assignmentId,
    clientId: clientId,
    metadata: {
      assessmentId: previous.assessment_id,
      previousQuotaLimit: previous.quota_limit,
      newQuotaLimit: updates.quotaLimit !== undefined ? updates.quotaLimit : previous.quota_limit,
      previousIsActive: previous.is_active,
      newIsActive: updates.isActive !== undefined ? updates.isActive : previous.is_active,
    },
  })

  revalidatePath('/clients')

  revalidatePath('/partner/clients', 'layout')
  return { success: true, id: assignmentId }
}

export async function removeAssessmentAssignment(
  assignmentId: string,
  clientId: string,
): Promise<{ success: true; id: string } | { error: string }> {
  const parsed = removeAssessmentAssignmentSchema.safeParse({ assignmentId, clientId })
  if (!parsed.success) return { error: 'Invalid input' }
  return updateAssessmentAssignment(assignmentId, clientId, {
    isActive: false,
  })
}

export async function toggleReportTemplateAssignment(
  clientId: string,
  reportTemplateId: string,
  assigned: boolean,
): Promise<{ success: true; id: string } | { error: string }> {
  const parsed = toggleReportTemplateAssignmentSchema.safeParse({ clientId, reportTemplateId, assigned })
  if (!parsed.success) return { error: 'Invalid input' }
  const { scope, partnerId } = await requireClientAccess(clientId)
  if (!canManageClientEntitlements(scope, clientId, partnerId)) {
    return { error: ENTITLEMENT_PERMISSION_ERROR }
  }
  if (!scope.actor?.id) {
    return { error: "Unable to determine the acting user" };
  }

  const db = createAdminClient()

  // D8: a partner may assign platform-global templates or templates owned by
  // the client's partner. Platform admins are unrestricted.
  if (assigned && !scope.isPlatformAdmin) {
    const [
      { data: template, error: templateError },
      { data: clientRow, error: clientRowError },
    ] = await Promise.all([
      db.from('report_templates').select('partner_id').eq('id', reportTemplateId).single(),
      db.from('clients').select('partner_id').eq('id', clientId).single(),
    ])
    if (templateError) return { error: templateError.message }
    if (clientRowError) return { error: clientRowError.message }
    const templatePartnerId = template?.partner_id ? String(template.partner_id) : null
    const clientPartnerId = clientRow?.partner_id ? String(clientRow.partner_id) : null
    if (templatePartnerId && templatePartnerId !== clientPartnerId) {
      return { error: 'This report template is not available to your partner.' }
    }
  }

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

    await logAuditEventSafe({
      actorProfileId: scope.actor.id,
      eventType: 'entitlement.client.report_template_assigned',
      targetTable: 'client_report_template_assignments',
      targetId: data.id,
      clientId: clientId,
      metadata: {
        reportTemplateId: reportTemplateId,
      },
    })

    revalidatePath('/clients')

    revalidatePath('/partner/clients', 'layout')
    return { success: true, id: data.id }
  } else {
    // Deactivate
    // Fetch previous state for audit logging
    const { data: previous } = await db
      .from('client_report_template_assignments')
      .select('id')
      .eq('client_id', clientId)
      .eq('report_template_id', reportTemplateId)
      .single()

    const { data, error } = await db
      .from('client_report_template_assignments')
      .update({ is_active: false })
      .eq('client_id', clientId)
      .eq('report_template_id', reportTemplateId)
      .select('id')
      .single()

    if (error) return { error: error.message }

    await logAuditEventSafe({
      actorProfileId: scope.actor.id,
      eventType: 'entitlement.client.report_template_removed',
      targetTable: 'client_report_template_assignments',
      targetId: previous?.id ?? data.id,
      clientId: clientId,
      metadata: {
        reportTemplateId: reportTemplateId,
      },
    })

    revalidatePath('/clients')

    revalidatePath('/partner/clients', 'layout')
    return { success: true, id: data.id }
  }
}

/**
 * Check if branding is enabled for a client, respecting partner cascade.
 * Returns false if the client's own flag is off OR if the client's partner has branding disabled.
 */
export async function isClientBrandingEnabled(clientId: string): Promise<boolean> {
  const parsed = clientIdSchema.safeParse({ clientId })
  if (!parsed.success) return false
  const db = await createClient()

  const clientFilter = resolveTenantClientFilter(await resolveAuthorizedScope())
  if (clientFilter !== null && !clientFilter.includes(clientId)) return false

  const { data: client, error: clientError } = await db
    .from('clients')
    .select('can_customize_branding, partner_id')
    .eq('id', clientId)
    .single()

  if (clientError) {
    throwActionError('isClientBrandingEnabled', 'Unable to load client branding settings.', clientError)
  }

  if (!client?.can_customize_branding) return false

  // If client has a partner, check partner's flag too
  if (client.partner_id) {
    const { data: partner, error: partnerError } = await db
      .from('partners')
      .select('can_customize_branding')
      .eq('id', client.partner_id)
      .single()

    if (partnerError) {
      throwActionError('isClientBrandingEnabled', 'Unable to load partner branding settings.', partnerError)
    }

    if (!partner?.can_customize_branding) return false
  }

  return true
}

export async function toggleClientBranding(
  clientId: string,
  canCustomize: boolean,
): Promise<{ success: true; id: string } | { error: string }> {
  const parsed = toggleClientBrandingSchema.safeParse({ clientId, canCustomize })
  if (!parsed.success) return { error: 'Invalid input' }
  const { scope, partnerId } = await requireClientAccess(clientId)
  if (!canManageClientEntitlements(scope, clientId, partnerId)) {
    return { error: ENTITLEMENT_PERMISSION_ERROR }
  }

  const db = createAdminClient()

  // Fetch previous state for audit logging (and the partner, for the D5 gate)
  const { data: previous } = await db
    .from('clients')
    .select('can_customize_branding, partner_id')
    .eq('id', clientId)
    .single()

  // D5: a partner admin may switch a client's branding on only while the
  // partner's own flag is on. Platform admins keep their veto either way.
  if (canCustomize && !scope.isPlatformAdmin && previous?.partner_id) {
    const { data: partner, error: partnerError } = await db
      .from('partners')
      .select('can_customize_branding')
      .eq('id', previous.partner_id)
      .single()
    if (partnerError) return { error: partnerError.message }
    if (!partner?.can_customize_branding) {
      return {
        error:
          'Brand customisation is not enabled for your partner. Contact Trajectas to enable it.',
      }
    }
  }

  const { error } = await db
    .from('clients')
    .update({ can_customize_branding: canCustomize })
    .eq('id', clientId)

  if (error) return { error: error.message }

  await logAuditEventSafe({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'entitlement.client.branding_toggled',
    targetTable: 'clients',
    targetId: clientId,
    clientId: clientId,
    metadata: {
      previousCanCustomizeBranding: previous?.can_customize_branding ?? null,
      newCanCustomizeBranding: canCustomize,
    },
  })

  // Layout-scoped revalidation so every cached page under the admin /clients
  // tree AND the entire client portal re-renders with the new flag value.
  // Without this, a client user sitting on /client/settings/brand continues to
  // see "Brand customisation is not enabled" after the admin enables it.
  revalidatePath('/clients', 'layout')
  revalidatePath('/client', 'layout')
  revalidatePath('/partner/clients', 'layout')
  return { success: true, id: clientId }
}
