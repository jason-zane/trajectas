'use server'

import { cache } from 'react'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getVerifiedUserId } from '@/lib/auth/claims'
import {
  listCampaigns,
  listActiveAssessments,
  getCampaignHeader as dalGetCampaignHeader,
  getCampaignDetailParts as dalGetCampaignDetailParts,
  getCampaignSessions as dalGetCampaignSessions,
  getCampaignConsultantSettings as dalGetCampaignConsultantSettings,
} from '@/lib/dal/campaigns'
import { assembleCampaignDetail } from '@/lib/dal/campaigns-mappers'
import {
  getAssessmentContentSummaries,
  listEmptyAssessments,
} from '@/lib/dal/assessment-content'
import { autoBuildSectionsFromFactors } from '@/lib/dal/assessment-sections'

/**
 * Auto-building sections mutates the assessment library asset, so it needs
 * the same write gate the assessment editor uses — campaign access alone
 * (e.g. a client attaching a shared assessment) must not be enough.
 */
async function canWriteAssessment(assessmentId: string): Promise<boolean> {
  try {
    await requireAssessmentAccess(assessmentId, { forWrite: true })
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}
import {
  AuthorizationError,
  canAccessClient,
  canManageCampaign,
  getAccessibleCampaignIds,
  requireAssessmentAccess,
  requireCampaignAccess,
  requireClientAccess,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { logActionError, throwActionError } from '@/lib/security/action-errors'
import { requireAppUrl } from '@/lib/hosts'
import { mapCampaignAccessLinkRow } from '@/lib/supabase/mappers'
import { getPrimaryActiveAccessLink } from '@/lib/campaign-access-links'
import { campaignSchema, inviteParticipantSchema, accessLinkSchema } from '@/lib/validations/campaigns'
import { checkQuotaAvailability } from '@/app/actions/client-entitlements'
import type { Campaign, CampaignAssessment, CampaignParticipant, CampaignAccessLink } from '@/types/database'

// ---------------------------------------------------------------------------
// Meta types
// ---------------------------------------------------------------------------

export type CampaignWithMeta = Campaign & {
  assessmentCount: number
  participantCount: number
  completedCount: number
  clientName?: string
}

export type CampaignDetail = Campaign & {
  assessments: (CampaignAssessment & {
    assessmentTitle: string
    assessmentStatus: string
    minCustomFactors: number | null
  })[]
  participants: CampaignParticipant[]
  accessLinks: CampaignAccessLink[]
  clientName?: string
}

// Lightweight header used by campaign shells and tabs that don't need the
// nested participants/assessments/accessLinks arrays.
export type CampaignHeader = Campaign & {
  clientName?: string
  // null when the campaign has no client (platform-owned); otherwise the raw
  // flag from clients.can_customize_branding. Callers apply their own default.
  clientCanCustomizeBranding: boolean | null
  assessmentCount: number
}

export type OperationalClientCampaign = CampaignWithMeta & {
  accessLinks: CampaignAccessLink[]
  primaryAccessLink?: CampaignAccessLink
}

export type ClientRecentResult = {
  participantId: string
  participantName: string
  participantEmail: string
  campaignId: string
  campaignTitle: string
  latestSessionId?: string
  status: string
  lastActivity: string
}

export type BulkInviteRowError = {
  row: number
  email?: string
  message: string
}

export type BulkInvitePendingExisting = {
  row: number
  email: string
  firstName?: string
  lastName?: string
}

export type BulkInviteEmailFailure = {
  participantId: string
  email: string
  error: string
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function getClientPartnerId(clientId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('clients')
    .select('id, partner_id')
    .eq('id', clientId)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    throw new AuthorizationError('Selected client is not available.')
  }

  return data.partner_id ? String(data.partner_id) : null
}

export async function getCampaigns(options?: { clientId?: string }): Promise<CampaignWithMeta[]> {
  const scope = await resolveAuthorizedScope()

  // Determine effective client filter:
  // 1. Explicit clientId takes priority (client portal pages pass this)
  // 2. On client surface without explicit clientId, derive from active context
  //    (defense-in-depth: prevents data leakage if caller forgets to pass clientId)
  // 3. On admin surface as platform admin, no filter (see all)
  // 4. Non-admin users get scoped by accessible campaigns (empty → nothing visible)
  const effectiveClientId = options?.clientId ??
    (scope.requestSurface === 'client' ? (scope.activeContext?.tenantId ?? null) : null)

  let scopedCampaignIds: string[] | null = null
  if (!effectiveClientId && !scope.isPlatformAdmin) {
    scopedCampaignIds = (await getAccessibleCampaignIds(scope)) ?? []
  }

  const db = await createClient()
  return listCampaigns(db, { effectiveClientId, scopedCampaignIds })
}

async function getCampaignHeaderImpl(id: string): Promise<CampaignHeader | null> {
  try {
    await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null
    }
    throw error
  }

  return dalGetCampaignHeader(await createClient(), id)
}

export const getCampaignHeader = cache(getCampaignHeaderImpl)

async function getCampaignByIdImpl(id: string): Promise<CampaignDetail | null> {
  const db = await createClient()

  // Kick off the header + the three detail queries in a single parallel batch.
  // getCampaignHeader is cache()-wrapped (so a preceding layout call is a free
  // hit) and carries the authorization; the detail queries only need the id.
  const [header, parts] = await Promise.all([
    getCampaignHeader(id),
    dalGetCampaignDetailParts(db, id),
  ])

  if (!header || !parts) return null
  return assembleCampaignDetail(header, parts)
}

export const getCampaignById = cache(getCampaignByIdImpl)

// ---------------------------------------------------------------------------
// Create / Update (Zone 2 — explicit save)
// ---------------------------------------------------------------------------

export async function createCampaign(payload: Record<string, unknown>) {
  const parsed = campaignSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const scope = await resolveAuthorizedScope()
  const clientId = parsed.data.clientId || null

  // 360 is an admin-only test-bed feature for now. Enforce server-side — the
  // UI only offers the type to admins, but the action uses the admin client
  // (RLS won't reject), so a non-admin could otherwise POST kind directly.
  if (parsed.data.kind === 'leadership_360' && !scope.isPlatformAdmin) {
    return { error: { kind: ['360 campaigns are not available for your account'] } }
  }

  if (!scope.isPlatformAdmin) {
    if (!clientId) {
      return { error: { clientId: ['Campaigns must belong to a client context'] } }
    }

    if (!canAccessClient(scope, clientId)) {
      return { error: { clientId: ['You do not have access to this client'] } }
    }
  }

  const partnerId =
    clientId
      ? await getClientPartnerId(clientId)
      : (parsed.data.partnerId || null)

  const db = createAdminClient()
  const { data: campaign, error } = await db
    .from('campaigns')
    .insert({
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      kind: parsed.data.kind,
      client_id: clientId,
      partner_id: partnerId,
      opens_at: parsed.data.opensAt || null,
      closes_at: parsed.data.closesAt || null,
      allow_resume: parsed.data.allowResume,
      show_progress: parsed.data.showProgress,
      randomize_assessment_order: parsed.data.randomizeAssessmentOrder,
      confidentiality_mode: parsed.data.confidentialityMode || 'standard',
      inviter_name: parsed.data.inviterName || null,
      inviter_role: parsed.data.inviterRole || null,
      consultant_emails: scope.actor?.email ? [scope.actor.email] : [],
    })
    .select('id')
    .single()

  if (error) {
    logActionError('createCampaign', error)
    return { error: { _form: ['Unable to create campaign.'] } }
  }

  // Report templates are no longer auto-copied at campaign creation. The
  // session-completion resolver in src/app/actions/assess.ts unions the
  // campaign-level attachments with the assessment-level defaults at runtime,
  // and falls back to report_templates.is_default = true only when both
  // layers are empty. This keeps campaign_report_templates as a record of
  // explicit overrides rather than a pre-populated soup.

  await logAuditEvent({
    actorProfileId: scope.actor?.id ?? null,
    eventType: 'campaign.created',
    targetTable: 'campaigns',
    targetId: campaign.id,
    partnerId,
    clientId: clientId,
    metadata: {
      slug: parsed.data.slug,
      isLocalDevelopmentBypass: scope.isLocalDevelopmentBypass,
    },
  })

  revalidatePath('/campaigns')
  revalidatePath('/')
  return { success: true as const, id: campaign.id }
}

function buildCampaignSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)

  const suffix = Math.random().toString(36).slice(2, 8)
  return base ? `${base}-${suffix}` : `campaign-${suffix}`
}

function buildReusedCampaignTitle(title: string): string {
  const trimmed = title.trim()
  return trimmed.endsWith('(copy)') ? trimmed : `${trimmed} (copy)`
}

export async function duplicateCampaignForReuse(sourceCampaignId: string) {
  let access
  try {
    access = await requireCampaignAccess(sourceCampaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()

  const [{ data: sourceCampaign, error: sourceCampaignError }, { data: sourceAssessments, error: sourceAssessmentsError }, { data: sourceReportTemplates, error: sourceReportTemplatesError }] =
    await Promise.all([
      db
        .from('campaigns')
        .select(
          'id, title, description, client_id, partner_id, opens_at, closes_at, branding, allow_resume, show_progress, randomize_assessment_order, confidentiality_mode, inviter_name, inviter_role',
        )
        .eq('id', sourceCampaignId)
        .is('deleted_at', null)
        .single(),
      db
        .from('campaign_assessments')
        .select('id, assessment_id, display_order, is_required, intro_override')
        .eq('campaign_id', sourceCampaignId)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
      db
        .from('campaign_report_templates')
        .select('template_id, sort_order')
        .eq('campaign_id', sourceCampaignId)
        .order('sort_order', { ascending: true }),
    ])

  if (sourceCampaignError || !sourceCampaign) {
    logActionError('duplicateCampaignForReuse', sourceCampaignError)
    return { error: 'Unable to load the source campaign.' }
  }

  if (sourceAssessmentsError) {
    logActionError('duplicateCampaignForReuse', sourceAssessmentsError)
    return { error: 'Unable to load campaign assessments.' }
  }

  if (sourceReportTemplatesError) {
    logActionError('duplicateCampaignForReuse', sourceReportTemplatesError)
    return { error: 'Unable to load campaign report templates.' }
  }

  const nextTitle = buildReusedCampaignTitle(String(sourceCampaign.title ?? 'Campaign'))

  const { data: duplicatedCampaign, error: duplicatedCampaignError } = await db
    .from('campaigns')
    .insert({
      title: nextTitle,
      slug: buildCampaignSlug(nextTitle),
      description: sourceCampaign.description ?? null,
      status: 'draft',
      client_id: sourceCampaign.client_id ?? null,
      partner_id: sourceCampaign.partner_id ?? null,
      opens_at: sourceCampaign.opens_at ?? null,
      closes_at: sourceCampaign.closes_at ?? null,
      branding: sourceCampaign.branding ?? {},
      allow_resume: sourceCampaign.allow_resume ?? true,
      show_progress: sourceCampaign.show_progress ?? true,
      randomize_assessment_order: sourceCampaign.randomize_assessment_order ?? false,
      confidentiality_mode: sourceCampaign.confidentiality_mode ?? 'standard',
      inviter_name: sourceCampaign.inviter_name ?? null,
      inviter_role: sourceCampaign.inviter_role ?? null,
    })
    .select('id')
    .single()

  if (duplicatedCampaignError || !duplicatedCampaign) {
    logActionError('duplicateCampaignForReuse', duplicatedCampaignError)
    return { error: 'Unable to create the reused campaign.' }
  }

  try {
    const sourceAssessmentRows = sourceAssessments ?? []

    if (sourceAssessmentRows.length > 0) {
      const { data: duplicatedAssessments, error: duplicatedAssessmentsError } = await db
        .from('campaign_assessments')
        .insert(
          sourceAssessmentRows.map((assessment) => ({
            campaign_id: duplicatedCampaign.id,
            assessment_id: assessment.assessment_id,
            display_order: assessment.display_order,
            is_required: assessment.is_required ?? true,
            intro_override: assessment.intro_override ?? null,
          })),
        )
        .select('id, assessment_id, display_order')

      if (duplicatedAssessmentsError || !duplicatedAssessments) {
        throw duplicatedAssessmentsError ?? new Error('Failed to copy assessments.')
      }

      const duplicatedAssessmentIdBySourceId = new Map<string, string>()
      const duplicatedAssessmentIdByKey = new Map<string, string>()

      for (const assessment of duplicatedAssessments) {
        duplicatedAssessmentIdByKey.set(
          `${assessment.assessment_id}:${assessment.display_order}`,
          assessment.id,
        )
      }

      for (const assessment of sourceAssessmentRows) {
        const duplicatedAssessmentId = duplicatedAssessmentIdByKey.get(
          `${assessment.assessment_id}:${assessment.display_order}`,
        )
        if (duplicatedAssessmentId) {
          duplicatedAssessmentIdBySourceId.set(assessment.id, duplicatedAssessmentId)
        }
      }

      const sourceAssessmentIds = sourceAssessmentRows.map((assessment) => assessment.id)
      const { data: factorSelections, error: factorSelectionsError } = await db
        .from('campaign_assessment_factors')
        .select('campaign_assessment_id, factor_id')
        .in('campaign_assessment_id', sourceAssessmentIds)

      if (factorSelectionsError) {
        throw factorSelectionsError
      }

      const factorInserts =
        factorSelections
          ?.map((selection) => {
            const duplicatedAssessmentId = duplicatedAssessmentIdBySourceId.get(
              selection.campaign_assessment_id,
            )
            if (!duplicatedAssessmentId) {
              return null
            }

            return {
              campaign_assessment_id: duplicatedAssessmentId,
              factor_id: selection.factor_id,
            }
          })
          .filter((selection): selection is { campaign_assessment_id: string; factor_id: string } => selection != null) ?? []

      if (factorInserts.length > 0) {
        const { error: factorInsertError } = await db
          .from('campaign_assessment_factors')
          .insert(factorInserts)

        if (factorInsertError) {
          throw factorInsertError
        }
      }
    }

    const sourceReportTemplateRows = sourceReportTemplates ?? []
    if (sourceReportTemplateRows.length > 0) {
      const { error: reportTemplateInsertError } = await db
        .from('campaign_report_templates')
        .insert(
          sourceReportTemplateRows.map((template) => ({
            campaign_id: duplicatedCampaign.id,
            template_id: template.template_id,
            sort_order: template.sort_order,
          })),
        )

      if (reportTemplateInsertError) {
        throw reportTemplateInsertError
      }
    }
  } catch (error) {
    await db
      .from('campaigns')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', duplicatedCampaign.id)

    logActionError('duplicateCampaignForReuse', error)
    return {
      error:
        'Unable to copy the full campaign setup. No participants or links were duplicated, and the new draft was rolled back.',
    }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.duplicated',
    targetTable: 'campaigns',
    targetId: duplicatedCampaign.id,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { sourceCampaignId },
  })

  revalidatePath('/campaigns')
  revalidatePath('/client/campaigns')
  revalidatePath('/partner/campaigns')
  revalidatePath('/')

  return { success: true as const, id: duplicatedCampaign.id }
}

export async function updateCampaign(id: string, payload: Record<string, unknown>) {
  const parsed = campaignSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: { _form: [error.message] } }
    }
    throw error
  }

  const clientId = parsed.data.clientId || access.clientId || null

  if (!access.scope.isPlatformAdmin) {
    if (!clientId || !canAccessClient(access.scope, clientId)) {
      return { error: { clientId: ['You do not have access to this client'] } }
    }
  }

  const partnerId =
    clientId
      ? await getClientPartnerId(clientId)
      : (parsed.data.partnerId || access.partnerId || null)

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      client_id: clientId,
      partner_id: partnerId,
      opens_at: parsed.data.opensAt || null,
      closes_at: parsed.data.closesAt || null,
      allow_resume: parsed.data.allowResume,
      show_progress: parsed.data.showProgress,
      randomize_assessment_order: parsed.data.randomizeAssessmentOrder,
      confidentiality_mode: parsed.data.confidentialityMode || 'standard',
      inviter_name: parsed.data.inviterName || null,
      inviter_role: parsed.data.inviterRole || null,
    })
    .eq('id', id)

  if (error) {
    logActionError('updateCampaign', error)
    return { error: { _form: ['Unable to update campaign.'] } }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.updated',
    targetTable: 'campaigns',
    targetId: id,
    partnerId,
    clientId: clientId,
    metadata: {
      slug: parsed.data.slug,
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
  revalidatePath(`/campaigns/${id}/settings`)
  revalidatePath(`/client/campaigns/${id}/settings`)
  revalidatePath('/')
  return { success: true as const, id }
}

// ---------------------------------------------------------------------------
// Auto-save (Zone 3 — description only)
// ---------------------------------------------------------------------------

export async function updateCampaignField(id: string, field: string, value: string) {
  if (field !== 'description') {
    return { error: 'Only description can be auto-saved' }
  }

  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ [field]: value || null })
    .eq('id', id)

  if (error) {
    logActionError('updateCampaignField', error)
    return { error: 'Unable to save field.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.description.updated',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: {
      field,
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
  revalidatePath(`/campaigns/${id}/settings`)
  revalidatePath(`/client/campaigns/${id}/settings`)
  return { success: true as const }
}

// ---------------------------------------------------------------------------
// Soft delete / restore
// ---------------------------------------------------------------------------

export async function deleteCampaign(id: string) {
  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    logActionError('deleteCampaign', error)
    return { error: 'Unable to delete campaign.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.deleted',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: {
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidatePath('/campaigns')
  revalidatePath('/')
}

export async function restoreCampaign(id: string) {
  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) {
    logActionError('restoreCampaign', error)
    return { error: 'Unable to restore campaign.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.restored',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: {
      isLocalDevelopmentBypass: access.scope.isLocalDevelopmentBypass,
    },
  })

  revalidatePath('/campaigns')
  revalidatePath('/')
}

// ---------------------------------------------------------------------------
// Status transitions (Zone 1 — immediate)
// ---------------------------------------------------------------------------

export async function activateCampaign(id: string) {
  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()

  // Pre-launch readiness gate: verify campaign has linked assessments with
  // questions to serve, and either participants or access links
  const { data: linkedAssessments, error: linkedAssessmentsError } = await db
    .from('campaign_assessments')
    .select('assessment_id')
    .eq('campaign_id', id)
    .is('deleted_at', null)

  if (linkedAssessmentsError) {
    logActionError('activateCampaign', linkedAssessmentsError)
    return { error: 'Unable to check campaign readiness.' }
  }

  if (!linkedAssessments || linkedAssessments.length === 0) {
    return { error: 'Campaign must have at least one assessment before activation.' }
  }

  // Every linked assessment must be active — a draft attached before this
  // guard existed (or unpublished since) must not go live with the campaign.
  const { data: linkedStatuses, error: linkedStatusesError } = await db
    .from('assessments')
    .select('id, title, status')
    .in(
      'id',
      linkedAssessments.map((row) => String(row.assessment_id)),
    )

  if (linkedStatusesError) {
    logActionError('activateCampaign', linkedStatusesError)
    return { error: 'Unable to check campaign readiness.' }
  }

  const inactiveAssessments = (linkedStatuses ?? []).filter(
    (a) => a.status !== 'active',
  )
  if (inactiveAssessments.length > 0) {
    const titles = inactiveAssessments.map((a) => `"${a.title}"`).join(', ')
    return {
      error: `${titles} ${
        inactiveAssessments.length === 1 ? 'is' : 'are'
      } not active. Publish the assessment in the builder before activating this campaign.`,
    }
  }

  // Every linked assessment must have materialised questions — an empty one
  // has nothing for the runner to show and its session auto-completes on open.
  // Auto-build missing layouts from each assessment's factors first; only
  // block on assessments whose factors resolve to nothing.
  try {
    const empties = await listEmptyAssessments(
      db,
      linkedAssessments.map((row) => String(row.assessment_id)),
    )
    const stillEmpty = []
    for (const empty of empties) {
      if (!(await canWriteAssessment(empty.assessmentId))) {
        stillEmpty.push(empty)
        continue
      }
      const built = await autoBuildSectionsFromFactors(db, empty.assessmentId)
      if (built.built) {
        await logAuditEvent({
          actorProfileId: access.scope.actor?.id ?? null,
          eventType: 'assessment.sections.autobuilt',
          targetTable: 'assessments',
          targetId: empty.assessmentId,
          metadata: { itemCount: built.itemCount, trigger: 'campaign-activation' },
        })
      } else {
        stillEmpty.push(empty)
      }
    }
    if (stillEmpty.length > 0) {
      const titles = stillEmpty.map((a) => `"${a.title}"`).join(', ')
      return {
        error: `${titles} ${stillEmpty.length === 1 ? 'has' : 'have'} no questions: the selected factors don't resolve to any active items. Fix the assessment in the builder before activating this campaign.`,
      }
    }
  } catch {
    return { error: 'Unable to check campaign readiness.' }
  }

  const { count: participantCount, error: participantCountError } = await db
    .from('campaign_participants')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', id)
    .is('deleted_at', null)

  if (participantCountError) {
    logActionError('activateCampaign', participantCountError)
    return { error: 'Unable to check campaign readiness.' }
  }

  const { count: linkCount, error: linkCountError } = await db
    .from('campaign_access_links')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', id)
    .eq('is_active', true)

  if (linkCountError) {
    logActionError('activateCampaign', linkCountError)
    return { error: 'Unable to check campaign readiness.' }
  }

  if ((!participantCount || participantCount === 0) && (!linkCount || linkCount === 0)) {
    return { error: 'Campaign must have at least one participant or active access link before activation.' }
  }

  const { error } = await db
    .from('campaigns')
    .update({ status: 'active' })
    .eq('id', id)

  if (error) {
    logActionError('activateCampaign', error)
    return { error: 'Unable to activate campaign.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.activated',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
}

export async function pauseCampaign(id: string) {
  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ status: 'paused' })
    .eq('id', id)

  if (error) {
    logActionError('pauseCampaign', error)
    return { error: 'Unable to pause campaign.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.paused',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
}

export async function closeCampaign(id: string) {
  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ status: 'closed' })
    .eq('id', id)

  if (error) {
    logActionError('closeCampaign', error)
    return { error: 'Unable to close campaign.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.closed',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
  })

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
}

// ---------------------------------------------------------------------------
// Toggle switches (Zone 1 — immediate)
// ---------------------------------------------------------------------------

export async function toggleCampaignSetting(id: string, field: string, value: boolean) {
  const allowed = ['allow_resume', 'show_progress', 'randomize_assessment_order']
  if (!allowed.includes(field)) {
    return { error: `Cannot toggle ${field}` }
  }

  let access
  try {
    access = await requireCampaignAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ [field]: value })
    .eq('id', id)

  if (error) {
    logActionError('toggleCampaignSetting', error)
    return { error: 'Unable to update setting.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.setting.updated',
    targetTable: 'campaigns',
    targetId: id,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { field, value },
  })

  revalidatePath(`/campaigns/${id}`)
  revalidatePath(`/campaigns/${id}/settings`)
  revalidatePath(`/client/campaigns/${id}/settings`)
}

// ---------------------------------------------------------------------------
// Campaign Assessments
// ---------------------------------------------------------------------------

export async function addAssessmentToCampaign(campaignId: string, assessmentId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  if (!access.scope.isPlatformAdmin && access.clientId) {
    const supabase = createAdminClient()
    const { data: assignment, error: assignmentError } = await supabase
      .from('client_assessment_assignments')
      .select('id')
      .eq('client_id', access.clientId)
      .eq('assessment_id', assessmentId)
      .eq('is_active', true)
      .maybeSingle()

    if (assignmentError) {
      logActionError('addAssessmentToCampaign', assignmentError)
      return { error: 'Unable to verify assessment availability.' }
    }

    if (!assignment) {
      return { error: 'This assessment is not available for your client' }
    }
  }

  const db = createAdminClient()

  // Only active assessments can reach participants — a draft is unfinished
  // by definition. Applies to every caller, platform admins included.
  const { data: assessmentRow, error: assessmentStatusError } = await db
    .from('assessments')
    .select('status')
    .eq('id', assessmentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (assessmentStatusError) {
    logActionError('addAssessmentToCampaign', assessmentStatusError)
    return { error: 'Unable to verify assessment availability.' }
  }
  if (!assessmentRow) {
    return { error: 'Assessment not found.' }
  }
  if (assessmentRow.status !== 'active') {
    return {
      error:
        'This assessment is not active. Publish it in the builder before adding it to a campaign.',
    }
  }

  // The runner serves questions from the assessment's sections, not its
  // factors — an assessment with none renders empty and auto-completes. Build
  // the default layout from the factors on the spot; only refuse when they
  // genuinely resolve to nothing.
  try {
    const [content] = await getAssessmentContentSummaries(db, [assessmentId])
    let deliverable = Boolean(content?.hasDeliverableContent)
    if (content && !deliverable && (await canWriteAssessment(assessmentId))) {
      const built = await autoBuildSectionsFromFactors(db, assessmentId)
      if (built.built) {
        deliverable = true
        await logAuditEvent({
          actorProfileId: access.scope.actor?.id ?? null,
          eventType: 'assessment.sections.autobuilt',
          targetTable: 'assessments',
          targetId: assessmentId,
          metadata: { itemCount: built.itemCount, trigger: 'campaign-attach' },
        })
      }
    }
    if (!deliverable) {
      return {
        error:
          'This assessment has no questions: its factors don’t resolve to any active items. Fix its factor selection (or sections) in the assessment builder before adding it to a campaign.',
      }
    }
  } catch {
    return { error: 'Unable to verify that this assessment has questions. Try again.' }
  }

  // Get max display order among live rows — soft-deleted assessments must
  // not inflate the next position.
  const { data: existing, error: existingOrderError } = await db
    .from('campaign_assessments')
    .select('display_order')
    .eq('campaign_id', campaignId)
    .is('deleted_at', null)
    .order('display_order', { ascending: false })
    .limit(1)

  if (existingOrderError) {
    logActionError('addAssessmentToCampaign', existingOrderError)
    return { error: 'Unable to add assessment.' }
  }

  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1

  const { error } = await db
    .from('campaign_assessments')
    .insert({
      campaign_id: campaignId,
      assessment_id: assessmentId,
      display_order: nextOrder,
    })

  if (error) {
    logActionError('addAssessmentToCampaign', error)
    return { error: 'Unable to add assessment.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.assessment.added',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { assessmentId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
  // Assessment count feeds into the effective experience (review step default),
  // so invalidate the experience cache alongside the campaign pages.
  revalidateTag('experience', 'max')
}

export async function removeAssessmentFromCampaign(campaignId: string, assessmentId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_assessments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('campaign_id', campaignId)
    .eq('assessment_id', assessmentId)
    .is('deleted_at', null)

  if (error) {
    logActionError('removeAssessmentFromCampaign', error)
    return { error: 'Unable to remove assessment.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.assessment.removed',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { assessmentId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
  revalidateTag('experience', 'max')
}

export async function reorderCampaignAssessments(campaignId: string, orderedIds: string[]) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await db
      .from('campaign_assessments')
      .update({ display_order: i })
      .eq('id', orderedIds[i])
      .eq('campaign_id', campaignId)

    if (error) {
      logActionError('reorderCampaignAssessments', error)
      return { error: 'Unable to reorder assessments.' }
    }
  }

  revalidatePath(`/campaigns/${campaignId}`)

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.assessments.reordered',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { orderedIds },
  })
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export async function inviteParticipant(
  campaignId: string,
  payload: Record<string, unknown>,
  options?: { deferEmail?: boolean },
) {
  const parsed = inviteParticipantSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: { _form: [error.message] } }
    }
    throw error
  }

  // Quota check: only applies when campaign belongs to a client
  if (access.clientId) {
    const db = createAdminClient()
    const { data: campaignAssessments, error: campaignAssessmentsError } = await db
      .from('campaign_assessments')
      .select('assessment_id')
      .eq('campaign_id', campaignId)
      .is('deleted_at', null)

    if (campaignAssessmentsError) {
      logActionError('inviteParticipant', campaignAssessmentsError)
      return { error: { _form: ['Unable to verify quota.'] } }
    }

    const assessmentIds = (campaignAssessments ?? []).map((ca) => ca.assessment_id)

    if (assessmentIds.length > 0) {
      const quota = await checkQuotaAvailability(access.clientId, assessmentIds)
      if (!quota.allowed) {
        return {
          error: { _form: ['Assessment quota reached. Cannot invite more participants.'] },
        }
      }
    }
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('campaign_participants')
    .insert({
      campaign_id: campaignId,
      email: parsed.data.email,
      first_name: parsed.data.firstName ?? null,
      last_name: parsed.data.lastName ?? null,
    })
    .select('id, access_token')
    .single()

  if (error) {
    logActionError('inviteParticipant', error)
    return { error: { _form: ['Unable to invite participant.'] } }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.participant.invited',
    targetTable: 'campaign_participants',
    targetId: data.id,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId, email: parsed.data.email },
  })

  // Auto-send invite email — surface failures to the caller so the UI can
  // show a retry button. The participant row is still created even if email
  // fails, so the admin can retry without re-creating. deferEmail skips the
  // send entirely: quick launch creates participants first, activates the
  // campaign, and only then emails — so a failed activation never leaves
  // delivered invitations pointing at a rolled-back campaign.
  let emailSent = false
  let emailError: string | undefined
  if (!options?.deferEmail) {
    try {
      const emailResult = await sendParticipantInviteEmail(campaignId, data.id)
      if (emailResult.success) {
        emailSent = true
      } else {
        emailError = emailResult.error
      }
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Email delivery failed'
      console.warn('[inviteParticipant] Email send failed, participant created:', err)
    }
  }

  revalidatePath(`/campaigns/${campaignId}`)
  return {
    success: true as const,
    id: data.id,
    accessToken: data.access_token,
    emailSent,
    emailError,
  }
}

/**
 * Send invite emails for a set of participants with bounded concurrency.
 * Companion to the deferEmail option on inviteParticipant /
 * bulkInviteParticipants: quick launch creates rows silently, activates the
 * campaign, and then calls this — so invitations only ever go out for a
 * campaign that is confirmed live.
 */
export async function sendParticipantInviteEmails(
  campaignId: string,
  participantIds: string[],
): Promise<
  | { error: string }
  | {
      success: true
      emailsSent: number
      emailFailures: BulkInviteEmailFailure[]
    }
> {
  try {
    await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const emailFailures: BulkInviteEmailFailure[] = []
  let emailsSent = 0
  const EMAIL_CONCURRENCY = 5
  for (let i = 0; i < participantIds.length; i += EMAIL_CONCURRENCY) {
    const chunk = participantIds.slice(i, i + EMAIL_CONCURRENCY)
    await Promise.all(
      chunk.map(async (participantId) => {
        try {
          const result = await sendParticipantInviteEmail(campaignId, participantId)
          if (result.success) {
            emailsSent += 1
          } else {
            emailFailures.push({
              participantId,
              email: '',
              error: result.error ?? 'Email delivery failed',
            })
          }
        } catch (emailErr) {
          emailFailures.push({
            participantId,
            email: '',
            error:
              emailErr instanceof Error ? emailErr.message : 'Email delivery failed',
          })
        }
      }),
    )
  }

  return { success: true, emailsSent, emailFailures }
}

/**
 * Send (or re-send) the invite email for a participant.
 * Separate from inviteParticipant so we can resend without re-creating the row.
 */
export async function sendParticipantInviteEmail(
  campaignId: string,
  participantId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: error.message }
    }
    throw error
  }

  const db = createAdminClient()

  const [participantResult, campaignResult] = await Promise.all([
    db
      .from('campaign_participants')
      .select('email, first_name, access_token')
      .eq('id', participantId)
      .eq('campaign_id', campaignId)
      .is('deleted_at', null)
      .single(),
    db
      .from('campaigns')
      .select('title, description, client_id, partner_id')
      .eq('id', campaignId)
      .single(),
  ])

  if (participantResult.error || !participantResult.data) {
    return { success: false, error: 'Participant not found' }
  }
  if (campaignResult.error || !campaignResult.data) {
    return { success: false, error: 'Campaign not found' }
  }

  const participant = participantResult.data
  const campaign = campaignResult.data

  const assessBaseUrl = requireAppUrl('public')

  try {
    const { sendEmail } = await import('@/lib/email/send')

    await sendEmail({
      type: 'assessment_invite',
      to: participant.email,
      variables: {
        participantFirstName: participant.first_name ?? '',
        campaignTitle: campaign.title,
        campaignDescription: campaign.description ?? '',
        assessmentUrl: `${assessBaseUrl}/assess/${participant.access_token}`,
        brandName: 'Trajectas',
      },
      scopeCampaignId: campaignId,
      scopeClientId: campaign.client_id,
      scopePartnerId: campaign.partner_id ?? undefined,
    })

    // Update invited_at to track last send time
    const { error: invitedAtError } = await db
      .from('campaign_participants')
      .update({ invited_at: new Date().toISOString() })
      .eq('id', participantId)
    if (invitedAtError) {
      logActionError('sendParticipantInviteEmail', invitedAtError)
    }

    revalidatePath(`/campaigns/${campaignId}`)
    return { success: true }
  } catch (error) {
    console.error('[email] Failed to send invite:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email delivery failed',
    }
  }
}

export async function bulkInviteParticipants(
  campaignId: string,
  participants: { email: string; firstName?: string; lastName?: string }[],
  options?: { allowExisting?: boolean; deferEmail?: boolean },
) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const rowErrors: BulkInviteRowError[] = []
  const validatedParticipants: Array<{
    row: number
    email: string
    firstName?: string
    lastName?: string
  }> = []
  const seenEmails = new Set<string>()

  for (const [index, participant] of participants.entries()) {
    const email = participant.email.trim()
    const firstName = participant.firstName?.trim() || undefined
    const lastName = participant.lastName?.trim() || undefined
    const parsed = inviteParticipantSchema.safeParse({
      email,
      firstName,
      lastName,
    })

    if (!parsed.success) {
      rowErrors.push({
        row: index + 1,
        email: email || undefined,
        message:
          Object.values(parsed.error.flatten().fieldErrors)
            .flat()
            .join(', ') || 'Invalid row',
      })
      continue
    }

    const normalizedEmail = parsed.data.email.toLowerCase()
    if (seenEmails.has(normalizedEmail)) {
      rowErrors.push({
        row: index + 1,
        email: parsed.data.email,
        message: 'Duplicate email in upload',
      })
      continue
    }

    seenEmails.add(normalizedEmail)
    validatedParticipants.push({
      row: index + 1,
      email: parsed.data.email,
      firstName: parsed.data.firstName || undefined,
      lastName: parsed.data.lastName || undefined,
    })
  }

  const existingEmailSet = new Set<string>()
  if (validatedParticipants.length > 0) {
    const { data: existingParticipants, error: existingError } = await db
      .from('campaign_participants')
      .select('email')
      .eq('campaign_id', campaignId)
      .is('deleted_at', null)

    if (existingError) {
      logActionError('bulkInviteParticipants.existingLookup', existingError)
      return { error: 'Unable to validate existing participants.' }
    }

    for (const row of existingParticipants ?? []) {
      if (row.email) {
        existingEmailSet.add(String(row.email).toLowerCase())
      }
    }
  }

  const pendingExisting = validatedParticipants.filter((participant) =>
    existingEmailSet.has(participant.email.toLowerCase())
  )
  const rowsToInsert = validatedParticipants.filter((participant) =>
    options?.allowExisting ? true : !existingEmailSet.has(participant.email.toLowerCase())
  )

  let data: Array<{ id: string; email: string | null }> | null = null
  let error: { message?: string } | null = null

  if (rowsToInsert.length > 0) {
    const insertResult = await db
      .from('campaign_participants')
      .insert(
        rowsToInsert.map((participant) => ({
          campaign_id: campaignId,
          email: participant.email,
          first_name: participant.firstName ?? null,
          last_name: participant.lastName ?? null,
        }))
      )
      .select('id, email')

    data = insertResult.data
    error = insertResult.error
  }

  if (error) {
    logActionError('bulkInviteParticipants', error)
    return { error: 'Unable to invite participants.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.participants.bulk_invited',
    targetTable: 'campaigns',
    targetId: campaignId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: {
      inserted: data?.length ?? 0,
      existingCount: pendingExisting.length,
      errorCount: rowErrors.length,
      allowExisting: options?.allowExisting ?? false,
    },
  })

  const emailFailures: BulkInviteEmailFailure[] = []

  // Best-effort: send invite emails for all newly created participants with
  // bounded concurrency. Previously this ran sequentially (one SMTP call at
  // a time), which made bulk imports of 50-100 participants feel frozen for
  // 10-20 seconds. Chunked Promise.all keeps the SMTP provider from being
  // overwhelmed while dropping wall-clock time ~5x. deferEmail skips sending
  // — quick launch emails only after the campaign is confirmed active (via
  // sendParticipantInviteEmails).
  if (!options?.deferEmail && data && data.length > 0) {
    const EMAIL_CONCURRENCY = 5
    for (let i = 0; i < data.length; i += EMAIL_CONCURRENCY) {
      const chunk = data.slice(i, i + EMAIL_CONCURRENCY)
      const chunkFailures = await Promise.all(
        chunk.map(async (row) => {
          try {
            const result = await sendParticipantInviteEmail(campaignId, row.id)
            if (!result.success) {
              return {
                participantId: row.id,
                email: row.email ?? '',
                error: result.error ?? 'Email delivery failed',
              } satisfies BulkInviteEmailFailure
            }
          } catch (emailErr) {
            console.warn(
              '[bulkInviteParticipants] Email send failed for',
              row.id,
              emailErr
            )
            return {
              participantId: row.id,
              email: row.email ?? '',
              error:
                emailErr instanceof Error
                  ? emailErr.message
                  : 'Email delivery failed',
            } satisfies BulkInviteEmailFailure
          }
          return null
        })
      )
      emailFailures.push(
        ...chunkFailures.filter(
          (failure): failure is BulkInviteEmailFailure => failure !== null
        )
      )
    }
  }

  revalidatePath(`/campaigns/${campaignId}`)
  return {
    success: true as const,
    inserted: data?.length ?? 0,
    participantIds: (data ?? []).map((row) => row.id),
    existingCount: pendingExisting.length,
    errors: rowErrors,
    emailFailures,
    requiresConfirmation: pendingExisting.length > 0 && !(options?.allowExisting ?? false),
    pendingExisting: pendingExisting.map((participant) => ({
      row: participant.row,
      email: participant.email,
      firstName: participant.firstName,
      lastName: participant.lastName,
    })),
  }
}

export async function removeParticipant(campaignId: string, participantId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_participants')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', participantId)
    .eq('campaign_id', campaignId)
    .is('deleted_at', null)

  if (error) {
    logActionError('removeParticipant', error)
    return { error: 'Unable to remove participant.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.participant.removed',
    targetTable: 'campaign_participants',
    targetId: participantId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
  revalidatePath(`/campaigns/${campaignId}/participants`)
  revalidatePath('/participants')
  return { success: true as const }
}

export async function restoreParticipant(campaignId: string, participantId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_participants')
    .update({ deleted_at: null })
    .eq('id', participantId)
    .eq('campaign_id', campaignId)

  if (error) {
    logActionError('restoreParticipant', error)
    return { error: 'Unable to restore participant.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.participant.restored',
    targetTable: 'campaign_participants',
    targetId: participantId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
  revalidatePath(`/campaigns/${campaignId}/participants`)
  revalidatePath('/participants')
  return { success: true as const }
}

// ---------------------------------------------------------------------------
// Access Links
// ---------------------------------------------------------------------------

export async function createAccessLink(campaignId: string, payload: Record<string, unknown>) {
  const parsed = accessLinkSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: { _form: [error.message] } }
    }
    throw error
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('campaign_access_links')
    .insert({
      campaign_id: campaignId,
      label: parsed.data.label ?? null,
      max_uses: parsed.data.maxUses ?? null,
      expires_at: parsed.data.expiresAt || null,
    })
    .select('id, token')
    .single()

  if (error) {
    logActionError('createAccessLink', error)
    return { error: { _form: ['Unable to create access link.'] } }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.access_link.created',
    targetTable: 'campaign_access_links',
    targetId: data.id,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: {
      campaignId,
      expiresAt: parsed.data.expiresAt || null,
      maxUses: parsed.data.maxUses ?? null,
    },
  })

  revalidatePath(`/campaigns/${campaignId}`)
  return { success: true as const, id: data.id, token: data.token }
}

export async function deactivateAccessLink(campaignId: string, linkId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_access_links')
    .update({ is_active: false })
    .eq('id', linkId)
    .eq('campaign_id', campaignId)

  if (error) {
    logActionError('deactivateAccessLink', error)
    return { error: 'Unable to deactivate access link.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.access_link.deactivated',
    targetTable: 'campaign_access_links',
    targetId: linkId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
}

export async function reactivateAccessLink(campaignId: string, linkId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_access_links')
    .update({ is_active: true })
    .eq('id', linkId)
    .eq('campaign_id', campaignId)

  if (error) {
    logActionError('reactivateAccessLink', error)
    return { error: 'Unable to reactivate access link.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.access_link.reactivated',
    targetTable: 'campaign_access_links',
    targetId: linkId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
}

export async function deleteAccessLink(campaignId: string, linkId: string) {
  let access
  try {
    access = await requireCampaignAccess(campaignId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: error.message }
    }
    throw error
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_access_links')
    .delete()
    .eq('id', linkId)
    .eq('campaign_id', campaignId)

  if (error) {
    logActionError('deleteAccessLink', error)
    return { error: 'Unable to delete access link.' }
  }

  await logAuditEvent({
    actorProfileId: access.scope.actor?.id ?? null,
    eventType: 'campaign.access_link.deleted',
    targetTable: 'campaign_access_links',
    targetId: linkId,
    partnerId: access.partnerId,
    clientId: access.clientId,
    metadata: { campaignId },
  })

  revalidatePath(`/campaigns/${campaignId}`)
}

// ---------------------------------------------------------------------------
// Cross-campaign participant view (client portal)
// ---------------------------------------------------------------------------

export type ClientParticipant = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  status: string
  startedAt: string | null
  completedAt: string | null
  campaignId: string
  campaignTitle: string
  latestSessionId?: string
  sessionCount: number
  completedSessionCount: number
  created_at: string
}

export type CampaignAssessmentOption = {
  id: string
  title: string
  description?: string
  status: 'draft' | 'active' | 'archived'
  factorCount: number
  constructCount: number
  sectionCount: number
  totalItemCount: number
  formatLabel?: string
  estimatedDurationMinutes: number
  minCustomFactors: number | null
}

export async function getParticipantsForClient(
  clientId: string,
): Promise<ClientParticipant[]> {
  await requireClientAccess(clientId)
  const db = await createClient()

  // Single round trip: scope to the client through the campaigns inner
  // join (and pull the title from it) instead of fetching campaign ids
  // first.
  const { data: participants, error: participantsError } = await db
    .from('campaign_participants')
    .select('id, email, first_name, last_name, status, started_at, completed_at, campaign_id, created_at, campaigns!inner(title, client_id, deleted_at), participant_sessions(id, status)')
    .eq('campaigns.client_id', clientId)
    .is('campaigns.deleted_at', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (participantsError) {
    throwActionError(
      'getParticipantsForClient.participants',
      'Unable to load participants.',
      participantsError
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (participants ?? []).map((row: any) => {
    const sessions = row.participant_sessions ?? []
    const completedSessions = sessions.filter((s: { status: string }) => s.status === 'completed')
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      campaignId: row.campaign_id,
      campaignTitle: row.campaigns?.title ?? 'Unknown',
      latestSessionId:
        sessions
          .slice()
          .reverse()
          .find((s: { status: string }) => s.status === 'completed' || s.status === 'in_progress')?.id
        ?? sessions[sessions.length - 1]?.id
        ?? undefined,
      sessionCount: sessions.length,
      completedSessionCount: completedSessions.length,
      created_at: row.created_at,
    }
  })
}

function getParticipantDisplayName(row: {
  first_name?: string | null
  last_name?: string | null
  email: string
}) {
  const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()
  return name || row.email
}

export async function getOperationalCampaignsForClient(
  clientId: string,
  options?: { limit?: number }
): Promise<OperationalClientCampaign[]> {
  await requireClientAccess(clientId)

  // Campaigns and their access links are independent fetches — the links
  // query scopes itself to the client via an inner join instead of waiting
  // for the campaign ids.
  const [campaigns, linkRows] = await Promise.all([
    getCampaigns({ clientId }),
    (async () => {
      const db = createAdminClient()
      const { data, error } = await db
        .from('campaign_access_links')
        .select('*, campaigns!inner(client_id, deleted_at)')
        .eq('campaigns.client_id', clientId)
        .is('campaigns.deleted_at', null)
        .order('created_at', { ascending: false })

      if (error) {
        throwActionError(
          'getOperationalCampaignsForClient.links',
          'Unable to load campaign links.',
          error
        )
      }
      return data ?? []
    })(),
  ])

  if (campaigns.length === 0) {
    return []
  }

  const linksByCampaign = new Map<string, CampaignAccessLink[]>()
  for (const row of linkRows ?? []) {
    const mapped = mapCampaignAccessLinkRow(row)
    const existing = linksByCampaign.get(mapped.campaignId) ?? []
    existing.push(mapped)
    linksByCampaign.set(mapped.campaignId, existing)
  }

  const sorted = [...campaigns].sort((a, b) => {
    const statusWeight = (status: string) => {
      if (status === 'active') return 0
      if (status === 'paused') return 1
      if (status === 'draft') return 2
      return 3
    }

    const statusDelta = statusWeight(a.status) - statusWeight(b.status)
    if (statusDelta !== 0) return statusDelta
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const limited = typeof options?.limit === 'number'
    ? sorted.slice(0, options.limit)
    : sorted

  return limited.map((campaign) => {
    const accessLinks = linksByCampaign.get(campaign.id) ?? []
    return {
      ...campaign,
      accessLinks,
      primaryAccessLink: getPrimaryActiveAccessLink(accessLinks),
    }
  })
}

export async function getRecentClientResults(
  clientId: string,
  options?: { limit?: number }
): Promise<ClientRecentResult[]> {
  await requireClientAccess(clientId)
  const db = await createClient()

  // Single round trip: scope to the client through the campaigns inner
  // join (and pull the title from it) instead of fetching campaign ids
  // first.
  const { data: participants, error: participantsError } = await db
    .from('campaign_participants')
    .select(
      'id, email, first_name, last_name, status, started_at, completed_at, campaign_id, created_at, campaigns!inner(title, client_id, deleted_at), participant_sessions(id, status, started_at, completed_at)'
    )
    .eq('campaigns.client_id', clientId)
    .is('campaigns.deleted_at', null)
    .in('status', ['in_progress', 'completed'])
    .is('deleted_at', null)

  if (participantsError) {
    throwActionError(
      'getRecentClientResults.participants',
      'Unable to load recent results.',
      participantsError
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (participants ?? []).map((row: any) => {
    const sessions = Array.isArray(row.participant_sessions)
      ? [...row.participant_sessions]
      : []

    sessions.sort((a: { started_at?: string | null; completed_at?: string | null }, b: { started_at?: string | null; completed_at?: string | null }) => {
      const aTime = new Date(a.completed_at ?? a.started_at ?? 0).getTime()
      const bTime = new Date(b.completed_at ?? b.started_at ?? 0).getTime()
      return bTime - aTime
    })

    const latestSession = sessions[0]
    const lastActivity =
      latestSession?.completed_at ??
      latestSession?.started_at ??
      row.completed_at ??
      row.started_at ??
      row.created_at

    return {
      participantId: row.id,
      participantName: getParticipantDisplayName(row),
      participantEmail: row.email,
      campaignId: row.campaign_id,
      campaignTitle: row.campaigns?.title ?? 'Unknown',
      latestSessionId: latestSession?.id ?? undefined,
      status: row.status,
      lastActivity,
    } satisfies ClientRecentResult
  })

  results.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())

  return results.slice(0, options?.limit ?? 6)
}

// ---------------------------------------------------------------------------
// Completion timeline (dashboard sparkline)
// ---------------------------------------------------------------------------

export type CompletionTimelinePoint = {
  /** ISO date (UTC day, YYYY-MM-DD). */
  day: string
  count: number
}

export async function getCompletionTimeline(
  clientId: string,
  options?: { days?: number },
): Promise<CompletionTimelinePoint[]> {
  await requireClientAccess(clientId)
  const days = options?.days ?? 14
  const db = await createClient()

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Single round trip: filter sessions to the client's active campaigns
  // through the inner join instead of resolving campaign ids first.
  const { data: sessions, error: sessionsError } = await db
    .from('participant_sessions')
    .select('completed_at, campaigns!inner(client_id, status, deleted_at)')
    .eq('campaigns.client_id', clientId)
    .eq('campaigns.status', 'active')
    .is('campaigns.deleted_at', null)
    .eq('status', 'completed')
    .gte('completed_at', since)
    .not('completed_at', 'is', null)

  if (sessionsError) {
    throwActionError(
      'getCompletionTimeline.sessions',
      'Unable to load completion timeline.',
      sessionsError,
    )
  }

  const counts = new Map<string, number>()
  for (const row of sessions ?? []) {
    const ts = (row as { completed_at: string }).completed_at
    if (!ts) continue
    const day = ts.slice(0, 10) // UTC YYYY-MM-DD
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }

  return zeroFilledTimeline(days, counts)
}

function zeroFilledTimeline(
  days: number,
  counts?: Map<string, number>,
): CompletionTimelinePoint[] {
  const out: CompletionTimelinePoint[] = []
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    out.push({ day: key, count: counts?.get(key) ?? 0 })
  }
  return out
}

// ---------------------------------------------------------------------------
// Unique participants for client portal
// ---------------------------------------------------------------------------

export type UniqueClientParticipant = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  latestStatus: string
  sessionCount: number
  lastActivity?: string
  latestCampaignId: string
  latestSessionId?: string
}

export async function getUniqueParticipantsForClient(
  clientId: string,
): Promise<UniqueClientParticipant[]> {
  await requireClientAccess(clientId)
  const db = await createClient()

  // Single round trip: scope to the client through the campaigns inner
  // join instead of resolving campaign ids first.
  const { data: participants, error: participantsError } = await db
    .from('campaign_participants')
    .select('id, email, first_name, last_name, status, started_at, completed_at, campaign_id, created_at, campaigns!inner(client_id, deleted_at), participant_sessions(id, status)')
    .eq('campaigns.client_id', clientId)
    .is('campaigns.deleted_at', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (participantsError) {
    throwActionError(
      'getUniqueParticipantsForClient.participants',
      'Unable to load participants.',
      participantsError
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byEmail = new Map<string, { latest: any; count: number }>()
  for (const row of participants ?? []) {
    const email = row.email.toLowerCase()
    const existing = byEmail.get(email)
    if (!existing) {
      byEmail.set(email, { latest: row, count: 1 })
    } else {
      existing.count++
    }
  }

  return Array.from(byEmail.values()).map(({ latest, count }) => {
    const timestamps = [latest.started_at, latest.completed_at].filter(Boolean) as string[]
    const sessions = latest.participant_sessions ?? []
    const latestSessionId =
      sessions
        .slice()
        .reverse()
        .find((s: { status: string }) => s.status === 'completed' || s.status === 'in_progress')?.id
      ?? sessions[sessions.length - 1]?.id
      ?? undefined
    return {
      id: latest.id,
      email: latest.email,
      firstName: latest.first_name ?? null,
      lastName: latest.last_name ?? null,
      latestStatus: latest.status,
      sessionCount: count,
      lastActivity: timestamps.length > 0
        ? timestamps.sort().reverse()[0]
        : latest.created_at,
      latestCampaignId: latest.campaign_id,
      latestSessionId,
    }
  })
}

// ---------------------------------------------------------------------------
// Helpers for assessment picker
// ---------------------------------------------------------------------------

export async function getActiveAssessments(): Promise<CampaignAssessmentOption[]> {
  const scope = await resolveAuthorizedScope()

  // Scope-aware: partners see their own + platform-owned assessments; admins and
  // the local-dev bypass see all. Clients use getClientAssessmentLibrary instead,
  // so a non-admin non-partner caller gets nothing.
  let partnerScope: string[] | null = null
  if (!scope.isPlatformAdmin && !scope.isLocalDevelopmentBypass) {
    if (scope.partnerIds.length === 0) return []
    partnerScope = scope.partnerIds
  }

  const db = await createClient()
  return listActiveAssessments(db, { partnerIds: partnerScope })
}

async function assertCanManageCampaigns(
  ids: string[],
): Promise<{ error: string } | null> {
  if (ids.length === 0) return null
  const scope = await resolveAuthorizedScope()
  const db = createAdminClient()
  const { data: rows, error } = await db
    .from('campaigns')
    .select('id, client_id, partner_id')
    .in('id', ids)

  if (error) return { error: error.message }
  if (!rows || rows.length !== ids.length) {
    return { error: 'One or more campaigns not found.' }
  }

  for (const row of rows) {
    if (!canManageCampaign(scope, row.partner_id, row.client_id)) {
      return { error: 'Not authorized to manage one or more campaigns.' }
    }
  }
  return null
}

export async function bulkDeleteCampaigns(ids: string[]) {
  if (ids.length === 0) return
  const authErr = await assertCanManageCampaigns(ids)
  if (authErr) return authErr

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/campaigns')
  revalidatePath('/client/campaigns')
  revalidatePath('/partner/campaigns')
  revalidatePath('/')
}

export async function bulkUpdateCampaignStatus(ids: string[], status: string) {
  if (ids.length === 0) return
  const authErr = await assertCanManageCampaigns(ids)
  if (authErr) return authErr

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ status })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/campaigns')
  revalidatePath('/client/campaigns')
  revalidatePath('/partner/campaigns')
  revalidatePath('/')
}

// ---------------------------------------------------------------------------
// Campaign Assessment ID lookup
// ---------------------------------------------------------------------------

export async function getCampaignAssessmentId(
  campaignId: string,
  assessmentId: string,
): Promise<string | null> {
  await requireCampaignAccess(campaignId)
  const db = createAdminClient()
  const { data, error } = await db
    .from('campaign_assessments')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('assessment_id', assessmentId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) {
    logActionError('getCampaignAssessmentId', error)
    return null
  }
  return data?.id ?? null
}

// ---------------------------------------------------------------------------
// Campaign Favorites
// ---------------------------------------------------------------------------

export async function getFavoriteCampaignIds(): Promise<string[]> {
  const db = await createClient()
  const { data, error } = await db
    .from('campaign_favorites')
    .select('campaign_id')
  if (error) {
    logActionError('getFavoriteCampaignIds', error)
    return []
  }
  return (data ?? []).map((row) => row.campaign_id)
}

export async function favoriteCampaign(campaignId: string) {
  const db = await createClient()
  const userId = await getVerifiedUserId(db)
  if (!userId) return { error: 'Not authenticated' }

  const { error } = await db
    .from('campaign_favorites')
    .upsert(
      { profile_id: userId, campaign_id: campaignId },
      { onConflict: 'profile_id,campaign_id' },
    )

  if (error) return { error: error.message }
  revalidatePath('/client/dashboard')
  revalidatePath('/client/campaigns')
}

export async function unfavoriteCampaign(campaignId: string) {
  const db = await createClient()
  const userId = await getVerifiedUserId(db)
  if (!userId) return { error: 'Not authenticated' }

  const { error } = await db
    .from('campaign_favorites')
    .delete()
    .eq('profile_id', userId)
    .eq('campaign_id', campaignId)

  if (error) return { error: error.message }
  revalidatePath('/client/dashboard')
  revalidatePath('/client/campaigns')
}


// ---------------------------------------------------------------------------
// Consultant notification settings (per-campaign)
// ---------------------------------------------------------------------------

export interface CampaignConsultantSettings {
  emails: string[]
  enabled: boolean
  includeSummary: boolean
  attachPdf: boolean
}

export async function getCampaignConsultantSettings(
  campaignId: string,
): Promise<CampaignConsultantSettings | null> {
  await requireCampaignAccess(campaignId)
  return dalGetCampaignConsultantSettings(createAdminClient(), campaignId)
}

const CONSULTANT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function updateCampaignConsultantSettings(
  campaignId: string,
  input: Partial<CampaignConsultantSettings>,
): Promise<{ success: true } | { error: string }> {
  const access = await requireCampaignAccess(campaignId)
  if (!canManageCampaign(access.scope, access.partnerId, access.clientId)) {
    return { error: 'You do not have permission to modify this campaign.' }
  }
  const patch: Record<string, unknown> = {}
  if (input.emails !== undefined) {
    const cleaned = Array.from(
      new Set(
        input.emails.map((e) => String(e ?? '').trim().toLowerCase()).filter(Boolean),
      ),
    )
    const invalid = cleaned.filter((e) => !CONSULTANT_EMAIL_RE.test(e))
    if (invalid.length > 0) return { error: `Invalid email address: ${invalid[0]}` }
    patch.consultant_emails = cleaned
  }
  if (input.enabled !== undefined) patch.consultant_notification_enabled = input.enabled
  if (input.includeSummary !== undefined)
    patch.consultant_notification_include_summary = input.includeSummary
  if (input.attachPdf !== undefined) patch.consultant_notification_attach_pdf = input.attachPdf
  if (Object.keys(patch).length === 0) return { success: true }
  const db = createAdminClient()
  const { error } = await db.from('campaigns').update(patch).eq('id', campaignId)
  if (error) {
    logActionError('updateCampaignConsultantSettings', error)
    return { error: 'Unable to update consultant settings.' }
  }
  revalidatePath(`/campaigns/${campaignId}/settings`)
  return { success: true }
}


// ---------------------------------------------------------------------------
// Sessions view for the campaign Participants page
// ---------------------------------------------------------------------------

export type CampaignSessionRow = {
  /** participant_session.id — selection unit for Compare + Delete bulk actions */
  id: string
  campaignParticipantId: string
  participantName: string
  participantEmail: string
  assessmentId: string
  assessmentTitle: string
  status: string
  startedAt: string | null
  completedAt: string | null
  /** 1-based attempt number for this participant + assessment combination */
  attemptNumber: number
}

/**
 * Flat list of participant_sessions for a campaign, joined with the
 * campaign_participant they belong to. Powers the Sessions tab in
 * the campaign Participants page. Sorted newest first; attempt numbers
 * computed per (participant, assessment) pair.
 */
export async function getCampaignSessions(
  campaignId: string,
): Promise<CampaignSessionRow[]> {
  await requireCampaignAccess(campaignId)

  // Access verified above; the DAL read uses the admin client (RLS would block
  // the cross-participant join for some support sessions).
  return dalGetCampaignSessions(createAdminClient(), campaignId)
}

// ---------------------------------------------------------------------------
// Client portal: paginated unique participants
// ---------------------------------------------------------------------------

export async function getUniqueParticipantsForClientPaginated(
  clientId: string,
  page: number,
  pageSize: number,
  search?: string,
): Promise<{
  participants: UniqueClientParticipant[]
  totalCount: number
  page: number
  pageSize: number
}> {
  await requireClientAccess(clientId)

  const { listUniqueParticipantsForClient } = await import('@/lib/dal/participants')
  const db = await createClient()

  const result = await listUniqueParticipantsForClient(db, {
    clientId,
    page,
    pageSize,
    search,
  })

  // Map DAL result to UniqueClientParticipant type used by the component
  const participants: UniqueClientParticipant[] = result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    latestStatus: row.latestStatus,
    sessionCount: row.sessionCount,
    lastActivity: row.lastActivity,
    latestCampaignId: row.latestCampaignId,
    latestSessionId: row.latestSessionId,
  }))

  return {
    participants,
    totalCount: result.totalCount,
    page: result.page,
    pageSize: result.pageSize,
  }
}
