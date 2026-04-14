'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveBrand } from '@/app/actions/brand'
import {
  canManageCampaign,
  canManageReportTemplateLibrary,
  getAccessibleCampaignIds,
  getAccessiblePartnerIds,
  getPreferredPartnerIdForReportTemplateCreation,
  requireAdminScope,
  requireCampaignAccess,
  requireParticipantAccess,
  requireReportTemplateAccess,
  requireReportSnapshotAccess,
  requireSessionAccess,
  resolveAuthorizedScope,
  AuthorizationError,
} from '@/lib/auth/authorization'
import {
  logReportViewed,
  logSupportSessionDataAccess,
} from '@/lib/auth/support-sessions'
import {
  logActionError,
  throwActionError,
} from '@/lib/security/action-errors'
import { sendHtmlEmail } from '@/lib/email/provider'
import { buildSurfaceUrl, getConfiguredSurfaceUrl } from '@/lib/hosts'
import {
  mapReportTemplateRow,
  mapReportSnapshotRow,
} from '@/lib/supabase/mappers'
import { enqueueReportSnapshotEvent } from '@/lib/integrations/events'
import { createReportAccessToken } from '@/lib/reports/report-access-token'
import type {
  ReportTemplate,
  ReportSnapshot,
  ReportType,
  ReportDisplayLevel,
  PersonReferenceType,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Signed PDF URL helper
// ---------------------------------------------------------------------------

/**
 * pdf_url now stores a private storage path (e.g. "reports/<id>.pdf").
 * This helper generates a short-lived signed URL for download.
 * Returns undefined if no PDF has been generated yet.
 */
export async function getSignedReportPdfUrl(
  storagePath: string | undefined | null,
  expiresInSeconds = 3600,
): Promise<string | undefined> {
  if (!storagePath) return undefined

  // If it's a legacy full URL (starts with http), return as-is for backwards compat
  if (storagePath.startsWith('http')) return storagePath

  const db = createAdminClient()
  const { data, error } = await db.storage
    .from('reports')
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data?.signedUrl) {
    console.warn('[reports] Failed to create signed URL for', storagePath, error?.message)
    return undefined
  }

  return data.signedUrl
}

async function filterTemplatesForScope<T extends { partnerId?: string }>(
  scope: Awaited<ReturnType<typeof resolveAuthorizedScope>>,
  templates: T[],
) {
  if (scope.isPlatformAdmin) {
    return templates
  }

  const accessiblePartnerIds = await getAccessiblePartnerIds(scope)
  return templates.filter(
    (template) =>
      !template.partnerId || accessiblePartnerIds.includes(template.partnerId),
  )
}

function ensureReportTemplateLibraryAccess(
  scope: Awaited<ReturnType<typeof resolveAuthorizedScope>>,
) {
  if (!canManageReportTemplateLibrary(scope)) {
    throw new AuthorizationError(
      'Only platform or partner administrators can manage report templates.',
    )
  }
}

// ---------------------------------------------------------------------------
// Report Templates
// ---------------------------------------------------------------------------

export async function getReportTemplates(): Promise<ReportTemplate[]> {
  const scope = await resolveAuthorizedScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('report_templates')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) {
    throwActionError(
      'getReportTemplates',
      'Unable to load report templates.',
      error
    )
  }
  return filterTemplatesForScope(scope, (data ?? []).map(mapReportTemplateRow))
}

function getRelatedRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }

  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

type CampaignSessionReportRow = {
  templateId: string
  templateName: string
  snapshotId?: string
  status: string
  generatedAt?: string
  errorMessage?: string
}

function getReportLinkBaseUrl() {
  const adminUrl =
    getConfiguredSurfaceUrl('admin') ?? process.env.NEXT_PUBLIC_APP_URL

  if (!adminUrl) {
    throw new Error('An admin app URL is required to build report links.')
  }

  return adminUrl
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function textToHtml(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('\n')
}

export async function getReportTemplate(id: string): Promise<ReportTemplate | null> {
  try {
    await requireReportTemplateAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null
    }
    throw error
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('report_templates')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) {
    throwActionError(
      'getReportTemplate',
      'Unable to load report template.',
      error
    )
  }
  return data ? mapReportTemplateRow(data) : null
}

export interface CreateReportTemplateInput {
  name: string
  description?: string
  reportType: ReportType
  displayLevel: ReportDisplayLevel
  groupByDimension?: boolean
  personReference?: PersonReferenceType
  pageHeaderLogo?: 'primary' | 'secondary' | 'none'
  partnerId?: string
}

export async function createReportTemplate(
  input: CreateReportTemplateInput,
): Promise<ReportTemplate> {
  const scope = await resolveAuthorizedScope()
  ensureReportTemplateLibraryAccess(scope)

  const db = createAdminClient()
  const partnerId = scope.isPlatformAdmin
    ? input.partnerId ?? null
    : getPreferredPartnerIdForReportTemplateCreation(scope)
  const { data, error } = await db
    .from('report_templates')
    .insert({
      name: input.name,
      description: input.description ?? null,
      report_type: input.reportType,
      display_level: input.displayLevel,
      group_by_dimension: input.groupByDimension ?? false,
      person_reference: input.personReference ?? 'the_participant',
      page_header_logo: input.pageHeaderLogo ?? 'none',
      partner_id: partnerId,
      blocks: [],
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/report-templates')
  revalidatePath('/partner/report-templates')
  return mapReportTemplateRow(data)
}

export async function cloneReportTemplate(id: string): Promise<ReportTemplate> {
  const access = await requireReportTemplateAccess(id)
  const db = createAdminClient()
  const source = await getReportTemplate(id)
  if (!source) throw new Error('Template not found')
  const partnerId = access.scope.isPlatformAdmin
    ? source.partnerId ?? null
    : getPreferredPartnerIdForReportTemplateCreation(access.scope)
  const { data, error } = await db
    .from('report_templates')
    .insert({
      name: `${source.name} (copy)`,
      description: source.description ?? null,
      report_type: source.reportType,
      display_level: source.displayLevel,
      group_by_dimension: source.groupByDimension,
      person_reference: source.personReference,
      auto_release: false,  // never auto-release a clone by default
      page_header_logo: source.pageHeaderLogo ?? 'none',
      partner_id: partnerId,
      blocks: source.blocks,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/report-templates')
  revalidatePath('/partner/report-templates')
  return mapReportTemplateRow(data)
}

export async function updateReportTemplateBlocks(
  id: string,
  blocks: Record<string, unknown>[],
): Promise<void> {
  await requireReportTemplateAccess(id, { forWrite: true })
  const db = createAdminClient()
  const { error } = await db
    .from('report_templates')
    .update({ blocks })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/report-templates/${id}/builder`)
  revalidatePath(`/partner/report-templates/${id}/builder`)
}

export async function updateReportTemplateSettings(
  id: string,
  updates: Partial<CreateReportTemplateInput>,
): Promise<void> {
  await requireReportTemplateAccess(id, { forWrite: true })
  const db = createAdminClient()
  const row: Record<string, unknown> = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.description !== undefined) row.description = updates.description
  if (updates.reportType !== undefined) row.report_type = updates.reportType
  if (updates.displayLevel !== undefined) row.display_level = updates.displayLevel
  if (updates.groupByDimension !== undefined) row.group_by_dimension = updates.groupByDimension
  if (updates.personReference !== undefined) row.person_reference = updates.personReference
  if (updates.pageHeaderLogo !== undefined) row.page_header_logo = updates.pageHeaderLogo
  const { error } = await db.from('report_templates').update(row).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/report-templates')
  revalidatePath(`/report-templates/${id}/builder`)
  revalidatePath('/partner/report-templates')
  revalidatePath(`/partner/report-templates/${id}/builder`)
}

export async function deleteReportTemplate(id: string): Promise<void> {
  await requireReportTemplateAccess(id, { forWrite: true })
  const db = createAdminClient()
  const { error } = await db
    .from('report_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/report-templates')
  revalidatePath('/partner/report-templates')
}

export async function toggleReportTemplateActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  await requireReportTemplateAccess(id, { forWrite: true })
  const db = createAdminClient()
  const { error } = await db
    .from('report_templates')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/report-templates')
  revalidatePath('/partner/report-templates')
}

// ---------------------------------------------------------------------------
// Campaign Report Templates
// ---------------------------------------------------------------------------

export async function getCampaignTemplates(
  campaignId: string,
): Promise<Array<{ id: string; templateId: string; templateName: string; sortOrder: number }>> {
  await requireAdminScope()
  const db = createAdminClient()
  const { data, error } = await db
    .from('campaign_report_templates')
    .select('id, template_id, sort_order, report_templates(name)')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true })

  if (error) {
    throwActionError('getCampaignTemplates', 'Unable to load campaign templates.', error)
  }

  return (data ?? []).map((row) => {
    const tpl = getRelatedRecord(row.report_templates)
    return {
      id: String(row.id),
      templateId: String(row.template_id),
      templateName: tpl?.name ? String(tpl.name) : 'Unnamed template',
      sortOrder: Number(row.sort_order ?? 0),
    }
  })
}

export async function addCampaignTemplate(
  campaignId: string,
  templateId: string,
): Promise<void> {
  await requireReportTemplateAccess(templateId)
  const campaignAccess = await requireCampaignAccess(campaignId)
  if (!canManageCampaign(campaignAccess.scope, campaignAccess.partnerId, campaignAccess.clientId)) {
    throw new Error('You do not have permission to modify this campaign')
  }

  const db = createAdminClient()
  const { data: maxOrder } = await db
    .from('campaign_report_templates')
    .select('sort_order')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = ((maxOrder?.sort_order as number | null) ?? -1) + 1

  const { error } = await db
    .from('campaign_report_templates')
    .upsert(
      { campaign_id: campaignId, template_id: templateId, sort_order: nextOrder },
      { onConflict: 'campaign_id,template_id' }
    )

  if (error) {
    throwActionError('addCampaignTemplate', 'Unable to link template.', error)
  }

  revalidatePath(`/campaigns/${campaignId}/settings`)
}

export async function removeCampaignTemplate(
  campaignId: string,
  templateId: string,
): Promise<void> {
  await requireReportTemplateAccess(templateId)
  const campaignAccess = await requireCampaignAccess(campaignId)
  if (!canManageCampaign(campaignAccess.scope, campaignAccess.partnerId, campaignAccess.clientId)) {
    throw new Error('You do not have permission to modify this campaign')
  }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_report_templates')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('template_id', templateId)

  if (error) {
    throwActionError('removeCampaignTemplate', 'Unable to unlink template.', error)
  }

  revalidatePath(`/campaigns/${campaignId}/settings`)
}

// ---------------------------------------------------------------------------
// Report Snapshots
// ---------------------------------------------------------------------------

export async function getReportSnapshotsForCampaign(
  campaignId: string,
): Promise<ReportSnapshot[]> {
  const access = await requireCampaignAccess(campaignId)
  const db = await createClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })

  if (error) {
    throwActionError(
      'getReportSnapshotsForCampaign',
      'Unable to load report snapshots.',
      error
    )
  }

  try {
    await logSupportSessionDataAccess({
      scope: access.scope,
      resourceType: 'report_snapshots',
      resourceId: campaignId,
      partnerId: access.partnerId,
      clientId: access.clientId,
      metadata: { action: 'list_for_campaign' },
    })
  } catch (auditError) {
    logActionError('getReportSnapshotsForCampaign.audit', auditError)
  }

  // Return the raw snapshots WITHOUT eagerly signing PDF storage paths.
  // Previously this action signed every snapshot's pdfUrl, one Supabase
  // Storage call per row, even though the user rarely downloads more than
  // one. Consumers should route downloads through /api/reports/{id}/pdf
  // which signs on demand and enforces scope on every request.
  return (data ?? []).map(mapReportSnapshotRow)
}

export async function getReportSnapshot(id: string): Promise<ReportSnapshot | null> {
  let access: Awaited<ReturnType<typeof requireReportSnapshotAccess>>
  try {
    access = await requireReportSnapshotAccess(id)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null
    }
    throw error
  }

  const db = await createClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    throwActionError('getReportSnapshot', 'Unable to load report.', error)
  }
  if (!data) return null

  const snapshot = mapReportSnapshotRow(data)

  try {
    await logReportViewed({
      actorProfileId: access.scope.actor?.id ?? null,
      snapshotId: snapshot.id,
      participantId: access.participantId,
      partnerId: access.partnerId,
      clientId: access.clientId,
      supportSessionId: access.scope.supportSession?.id ?? null,
    })
    await logSupportSessionDataAccess({
      scope: access.scope,
      resourceType: 'report_snapshots',
      resourceId: snapshot.id,
      partnerId: access.partnerId,
      clientId: access.clientId,
      metadata: { action: 'detail' },
    })
  } catch (auditError) {
    logActionError('getReportSnapshot.audit', auditError)
  }

  // Resolve signed URL for private storage path
  if (snapshot.pdfUrl) {
    return { ...snapshot, pdfUrl: await getSignedReportPdfUrl(snapshot.pdfUrl) }
  }

  return snapshot
}

async function requireReportSnapshotManageAccess(snapshotId: string) {
  const access = await requireReportSnapshotAccess(snapshotId)

  if (!canManageCampaign(access.scope, access.partnerId, access.clientId)) {
    throw new AuthorizationError('You do not have permission to manage this report.')
  }

  return access
}

async function markSnapshotReleased(snapshotId: string) {
  const db = createAdminClient()
  const { data: snapshot, error: snapshotError } = await db
    .from('report_snapshots')
    .select('id, status, released_at, campaign_id, participant_session_id')
    .eq('id', snapshotId)
    .single()

  if (snapshotError || !snapshot) {
    throw new Error(snapshotError?.message ?? 'Snapshot not found')
  }

  const releasedAt = snapshot.released_at ?? new Date().toISOString()

  if (snapshot.status !== 'released' || !snapshot.released_at) {
    const { error } = await db
      .from('report_snapshots')
      .update({
        released_at: releasedAt,
        status: 'released',
      })
      .eq('id', snapshotId)

    if (error) {
      throw new Error(error.message)
    }

    try {
      await enqueueReportSnapshotEvent({
        snapshotId: String(snapshot.id),
        campaignId: String(snapshot.campaign_id),
        participantSessionId: String(snapshot.participant_session_id),
        status: 'released',
        generatedAt: releasedAt,
        releasedAt,
      })
    } catch (eventError) {
      console.error(
        `[integrations] Failed to enqueue report.released event for ${snapshotId}:`,
        eventError
      )
    }
  }

  const campaignId = String(snapshot.campaign_id)
  const sessionId = String(snapshot.participant_session_id)

  revalidatePath('/reports')
  revalidatePath(`/reports/${snapshotId}`)
  revalidatePath(`/client/reports/${snapshotId}`)
  revalidatePath(`/partner/reports/${snapshotId}`)
  revalidatePath(`/campaigns/${campaignId}/sessions/${sessionId}`)
  revalidatePath(`/client/campaigns/${campaignId}/sessions/${sessionId}`)
  revalidatePath(`/partner/campaigns/${campaignId}/sessions/${sessionId}`)

  return {
    releasedAt,
    campaignId,
    participantSessionId: sessionId,
  }
}

export async function getCampaignSessionReportRows(
  sessionId: string,
): Promise<CampaignSessionReportRow[]> {
  const access = await requireSessionAccess(sessionId)
  const db = createAdminClient()

  const [{ data: configuredTemplates, error: configError }, { data: snapshots, error: snapshotError }] =
    await Promise.all([
      db
        .from('campaign_report_templates')
        .select('template_id, sort_order, report_templates(name)')
        .eq('campaign_id', access.campaignId)
        .order('sort_order', { ascending: true }),
      db
        .from('report_snapshots')
        .select(
          'id, template_id, status, generated_at, error_message, report_templates(name)'
        )
        .eq('participant_session_id', sessionId)
        .order('created_at', { ascending: false }),
    ])

  if (configError) {
    throwActionError(
      'getCampaignSessionReportRows',
      'Unable to load campaign templates.',
      configError
    )
  }

  if (snapshotError) {
    throwActionError(
      'getCampaignSessionReportRows',
      'Unable to load campaign session reports.',
      snapshotError
    )
  }

  // Index snapshots by template_id (latest first, so first wins)
  const snapshotByTemplate = new Map<string, {
    id: string | null
    template_id: string | null
    status: string | null
    generated_at: string | null
    error_message: string | null
    report_templates: { name?: string | null } | { name?: string | null }[] | null
  }>()

  for (const snap of (snapshots ?? [])) {
    const tid = String((snap as Record<string, unknown>).template_id ?? '')
    if (tid && !snapshotByTemplate.has(tid)) {
      snapshotByTemplate.set(tid, snap as typeof snapshotByTemplate extends Map<string, infer V> ? V : never)
    }
  }

  return (configuredTemplates ?? []).map((ct) => {
    const templateId = String(ct.template_id)
    const tpl = getRelatedRecord(ct.report_templates)
    const snap = snapshotByTemplate.get(templateId)

    return {
      templateId,
      templateName: tpl?.name ? String(tpl.name) : 'Unnamed template',
      snapshotId: snap?.id ? String(snap.id) : undefined,
      status: snap ? String(snap.status ?? 'pending') : 'pending',
      generatedAt: snap?.generated_at ?? undefined,
      errorMessage: snap?.error_message ?? undefined,
    }
  })
}

type SnapshotRecipientContext = {
  snapshotId: string
  status: string
  releasedAt?: string
  participantSessionId: string
  participantId: string
  participantEmail: string
  participantFirstName?: string
  participantAccessToken?: string
  campaignId: string
  campaignTitle: string
  clientId?: string
  partnerId?: string
}

async function getSnapshotRecipientContext(
  snapshotId: string,
): Promise<SnapshotRecipientContext> {
  const db = createAdminClient()
  const { data: snapshot, error: snapshotError } = await db
    .from('report_snapshots')
    .select(
      'id, status, released_at, campaign_id, participant_session_id, campaigns(title, client_id, partner_id), participant_sessions(campaign_participant_id)'
    )
    .eq('id', snapshotId)
    .maybeSingle()

  if (snapshotError || !snapshot) {
    throw new Error(snapshotError?.message ?? 'Snapshot not found')
  }



  if (!['ready', 'released'].includes(String(snapshot.status))) {
    throw new Error('Only ready or sent reports can be emailed to participants.')
  }

  const session = getRelatedRecord(snapshot.participant_sessions)
  const participantId =
    typeof session?.campaign_participant_id === 'string'
      ? session.campaign_participant_id
      : null

  if (!participantId) {
    throw new Error('The report participant could not be resolved.')
  }

  const { data: participant, error: participantError } = await db
    .from('campaign_participants')
    .select('id, email, first_name, access_token')
    .eq('id', participantId)
    .maybeSingle()

  if (participantError || !participant?.email) {
    throw new Error(participantError?.message ?? 'The participant email could not be resolved.')
  }

  const campaign = getRelatedRecord(snapshot.campaigns)

  return {
    snapshotId: String(snapshot.id),
    status: String(snapshot.status),
    releasedAt: snapshot.released_at ?? undefined,
    participantSessionId: String(snapshot.participant_session_id),
    participantId,
    participantEmail: String(participant.email),
    participantFirstName:
      participant.first_name != null ? String(participant.first_name) : undefined,
    participantAccessToken:
      typeof participant.access_token === 'string' ? participant.access_token : undefined,
    campaignId: String(snapshot.campaign_id),
    campaignTitle: String(campaign?.title ?? 'Assessment'),
    clientId: typeof campaign?.client_id === 'string' ? campaign.client_id : undefined,
    partnerId: typeof campaign?.partner_id === 'string' ? campaign.partner_id : undefined,
  }
}

export interface ReportSnapshotSendDraft {
  recipientEmail: string
  recipientName: string
  subject: string
  body: string
  reportUrl: string
}

export async function prepareReportSnapshotSendDraft(
  snapshotId: string,
): Promise<ReportSnapshotSendDraft | null> {
  try {
    await requireReportSnapshotManageAccess(snapshotId)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return null
    }
    throw error
  }

  const context = await getSnapshotRecipientContext(snapshotId)
  const brand = await getEffectiveBrand(context.clientId, context.campaignId)
  const recipientName = context.participantFirstName?.trim() || 'there'

  // Build a participant-facing URL using the assess surface and the participant's access token.
  // Falls back to admin URL with reportToken if no access token is available.
  let reportUrl: string
  if (context.participantAccessToken) {
    reportUrl =
      buildSurfaceUrl(
        'assess',
        `/assess/${context.participantAccessToken}/report/${snapshotId}`,
      )?.toString() ??
      new URL(
        `/assess/${context.participantAccessToken}/report/${snapshotId}`,
        getReportLinkBaseUrl(),
      ).toString()
  } else {
    const reportToken = createReportAccessToken(snapshotId, context.participantId)
    reportUrl =
      buildSurfaceUrl(
        'admin',
        `/reports/${snapshotId}`,
        `reportToken=${encodeURIComponent(reportToken)}`,
      )?.toString() ??
      new URL(
        `/reports/${snapshotId}?reportToken=${encodeURIComponent(reportToken)}`,
        getReportLinkBaseUrl(),
      ).toString()
  }

  return {
    recipientEmail: context.participantEmail,
    recipientName,
    subject: `${context.campaignTitle} report ready`,
    body: `Hi ${recipientName},\n\nYour report for ${context.campaignTitle} is ready to review.\n\nYou can also download a PDF from the report page.\n\nRegards,\n${brand.name}`,
    reportUrl,
  }
}

export async function sendReportSnapshotEmail(input: {
  snapshotId: string
  body: string
}): Promise<void> {
  const { snapshotId, body } = input
  await requireReportSnapshotManageAccess(snapshotId)

  const trimmedBody = body.trim()
  if (!trimmedBody) {
    throw new Error('Email body cannot be empty.')
  }

  const draft = await prepareReportSnapshotSendDraft(snapshotId)
  if (!draft) {
    throw new Error('Unable to prepare the report email.')
  }

  const context = await getSnapshotRecipientContext(snapshotId)
  const brand = await getEffectiveBrand(context.clientId, context.campaignId)
  const rawFrom = process.env.EMAIL_FROM ?? 'noreply@mail.trajectas.com'
  const emailMatch = rawFrom.match(/<([^>]+)>/)
  const emailAddress = emailMatch ? emailMatch[1] : rawFrom

  const bodyHtml = textToHtml(trimmedBody)
  const buttonHtml = `<p style="margin:24px 0;"><a href="${escapeHtml(draft.reportUrl)}" style="display:inline-block;padding:12px 28px;background:#2d6a5a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">View Report</a></p>`
  const html = bodyHtml.replace(
    /(<p>[^<]*Regards)/,
    `${buttonHtml}$1`,
  ) || `${bodyHtml}${buttonHtml}`

  await sendHtmlEmail({
    to: draft.recipientEmail,
    subject: draft.subject,
    html,
    text: `${trimmedBody}\n\nView your report: ${draft.reportUrl}`,
    from: `${brand.name} <${emailAddress}>`,
  })

  await markSnapshotReleased(snapshotId)
}

export async function retrySnapshot(id: string): Promise<void> {
  await requireReportSnapshotManageAccess(id)
  const db = await createAdminClient()
  const { error } = await db
    .from('report_snapshots')
    .update({
      status: 'pending',
      error_message: null,
      pdf_url: null,
      pdf_status: null,
      pdf_error_message: null,
    })
    .eq('id', id)
    .eq('status', 'failed')
  if (error) throw new Error(error.message)
  // Kick the runner
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': process.env.INTERNAL_API_KEY ?? '',
    },
    body: JSON.stringify({ snapshotId: id }),
  })
}

export type ReportSnapshotListItem = ReportSnapshot & {
  participantName?: string
  participantEmail?: string
}

export interface GetAllReadySnapshotsOptions {
  /**
   * Maximum rows to return. Defaults to 1000. This is a soft upper bound
   * to prevent pathological queries; the admin UI uses client-side pagination
   * (DataTable) so the entire result set is rendered in-browser.
   */
  limit?: number
}

export async function getAllReadySnapshots(
  options: GetAllReadySnapshotsOptions = {},
): Promise<ReportSnapshotListItem[]> {
  await requireAdminScope()
  const db = await createClient()

  const limit = Math.min(Math.max(options.limit ?? 1000, 1), 5000)

  const { data, error } = await db
    .from('report_snapshots')
    .select(
      '*, participant_sessions(campaign_participant_id, campaign_participants(first_name, last_name, email))'
    )
    .in('status', ['ready', 'released', 'failed'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throwActionError(
      'getAllReadySnapshots',
      'Unable to load report snapshots.',
      error
    )
  }

  return (data ?? []).map((row) => {
    const snapshot = mapReportSnapshotRow(row)
    const session = getRelatedRecord((row as Record<string, unknown>).participant_sessions)
    const participant = getRelatedRecord(session?.campaign_participants)
    const name = [participant?.first_name, participant?.last_name]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ")
      .trim()

    return {
      ...snapshot,
      participantName: name || undefined,
      participantEmail:
        typeof participant?.email === "string" ? participant.email : undefined,
    }
  })
}

export async function getReportSnapshotsForParticipant(
  participantId: string,
): Promise<ReportSnapshot[]> {
  const access = await requireParticipantAccess(participantId)
  const db = await createClient()
  const { data: sessions } = await db
    .from('participant_sessions')
    .select('id')
    .eq('campaign_participant_id', participantId)
  const sessionIds = (sessions ?? []).map((s) => s.id)
  if (sessionIds.length === 0) return []
  const { data: snapshots, error } = await db
    .from('report_snapshots')
    .select('*')
    .in('participant_session_id', sessionIds)
    .order('created_at', { ascending: false })
  if (error) {
    throwActionError(
      'getReportSnapshotsForParticipant',
      'Unable to load report snapshots.',
      error
    )
  }

  try {
    await logSupportSessionDataAccess({
      scope: access.scope,
      resourceType: 'report_snapshots',
      resourceId: participantId,
      partnerId: access.partnerId,
      clientId: access.clientId,
      metadata: { action: 'list_for_participant' },
    })
  } catch (auditError) {
    logActionError('getReportSnapshotsForParticipant.audit', auditError)
  }

  const mapped = (snapshots ?? []).map(mapReportSnapshotRow)
  return Promise.all(
    mapped.map(async (s) =>
      s.pdfUrl ? { ...s, pdfUrl: await getSignedReportPdfUrl(s.pdfUrl) } : s
    )
  )
}

// ---------------------------------------------------------------------------
// Template Usage / Campaign Linkage
// ---------------------------------------------------------------------------

export interface TemplateUsageEntry {
  campaignId: string
  campaignTitle: string
}

/** Returns campaigns linked to a template. */
export async function getTemplateUsage(templateId: string): Promise<TemplateUsageEntry[]> {
  const access = await requireReportTemplateAccess(templateId)
  const db = createAdminClient()
  const accessibleCampaignIds = await getAccessibleCampaignIds(access.scope)
  if (!access.scope.isPlatformAdmin && (!accessibleCampaignIds || accessibleCampaignIds.length === 0)) {
    return []
  }

  let query = db
    .from('campaign_report_templates')
    .select('campaign_id, campaigns(title)')
    .eq('template_id', templateId)
    .order('created_at', { ascending: false })

  if (!access.scope.isPlatformAdmin && accessibleCampaignIds) {
    query = query.in('campaign_id', accessibleCampaignIds)
  }

  const { data, error } = await query
  if (error) {
    throwActionError('getTemplateUsage', 'Unable to load template usage.', error)
  }

  return (data ?? []).map((row) => {
    const campaign = getRelatedRecord(row.campaigns)
    return {
      campaignId: String(row.campaign_id),
      campaignTitle: campaign?.title ? String(campaign.title) : 'Unknown campaign',
    }
  })
}

/** Returns template usage counts for the template list page. */
export async function getTemplateUsageCounts(): Promise<Record<string, number>> {
  const scope = await resolveAuthorizedScope()
  const db = createAdminClient()
  const accessibleCampaignIds = await getAccessibleCampaignIds(scope)
  if (!scope.isPlatformAdmin && (!accessibleCampaignIds || accessibleCampaignIds.length === 0)) {
    return {}
  }

  let query = db
    .from('campaign_report_templates')
    .select('template_id')

  if (!scope.isPlatformAdmin && accessibleCampaignIds) {
    query = query.in('campaign_id', accessibleCampaignIds)
  }

  const { data, error } = await query
  if (error) {
    throwActionError(
      'getTemplateUsageCounts',
      'Unable to load template usage.',
      error
    )
  }

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const id = String(row.template_id)
    if (id) counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

/** Returns all campaigns (for linking UI). */
export async function getAllCampaigns(): Promise<{ id: string; title: string }[]> {
  const scope = await resolveAuthorizedScope()
  const db = createAdminClient()
  const accessibleCampaignIds = await getAccessibleCampaignIds(scope)
  if (!scope.isPlatformAdmin && (!accessibleCampaignIds || accessibleCampaignIds.length === 0)) {
    return []
  }

  let query = db
    .from('campaigns')
    .select('id, title')
    .is('deleted_at', null)
    .order('title')

  if (!scope.isPlatformAdmin && accessibleCampaignIds) {
    query = query.in('id', accessibleCampaignIds)
  }

  const { data, error } = await query
  if (error) {
    throwActionError('getAllCampaigns', 'Unable to load campaigns.', error)
  }
  return data ?? []
}

// ---------------------------------------------------------------------------
// AI Prompts (for block builder)
// ---------------------------------------------------------------------------

export async function getReportPrompts(): Promise<{ id: string; name: string; purpose: string }[]> {
  const scope = await resolveAuthorizedScope()
  ensureReportTemplateLibraryAccess(scope)

  const db = createAdminClient()
  const { data, error } = await db
    .from('ai_system_prompts')
    .select('id, name, purpose')
    .eq('is_active', true)
    .in('purpose', ['report_narrative', 'report_strengths_analysis', 'report_development_advice'])
    .order('name')
  if (error) {
    throwActionError('getReportPrompts', 'Unable to load prompts.', error)
  }
  return data ?? []
}

// ---------------------------------------------------------------------------
// Entity Options (for block builder)
// ---------------------------------------------------------------------------

export interface EntityOption {
  id: string
  label: string
  type: 'dimension' | 'factor' | 'construct'
  parentId?: string
}

export async function getEntityOptions(): Promise<EntityOption[]> {
  const scope = await resolveAuthorizedScope()
  ensureReportTemplateLibraryAccess(scope)

  const db = createAdminClient()
  const [{ data: dimensions }, { data: factors }, { data: constructs }] = await Promise.all([
    db.from('dimensions').select('id, name').is('deleted_at', null).eq('is_active', true),
    db.from('factors').select('id, name, dimension_id').is('deleted_at', null).eq('is_active', true),
    db.from('constructs').select('id, name, factor_constructs(factor_id)').is('deleted_at', null).eq('is_active', true),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: EntityOption[] = [
    ...(dimensions ?? []).map((d) => ({ id: d.id, label: d.name, type: 'dimension' as const })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(factors ?? []).map((f: any) => ({ id: f.id, label: f.name, type: 'factor' as const, parentId: f.dimension_id ?? undefined })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(constructs ?? []).map((c: any) => ({ id: c.id, label: c.name, type: 'construct' as const, parentId: c.factor_constructs?.[0]?.factor_id ?? undefined })),
  ]
  return options.sort((a, b) => a.label.localeCompare(b.label))
}

// ---------------------------------------------------------------------------
// Bulk actions — report templates
// ---------------------------------------------------------------------------

export async function bulkDeleteReportTemplates(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) throw new Error('Unauthorized')
  const db = createAdminClient()
  const { error } = await db
    .from('report_templates')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/report-templates')
  revalidatePath('/partner/report-templates')
}

export async function bulkSetReportTemplateActive(ids: string[], active: boolean): Promise<void> {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) throw new Error('Unauthorized')
  const db = createAdminClient()
  const { error } = await db
    .from('report_templates')
    .update({ is_active: active })
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/report-templates')
  revalidatePath('/partner/report-templates')
}

// ---------------------------------------------------------------------------
// Bulk actions — reports
// ---------------------------------------------------------------------------

export async function bulkDeleteReports(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) throw new Error('Unauthorized')
  const db = createAdminClient()
  const { error } = await db
    .from('report_snapshots')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/reports')
  revalidatePath('/participants')
}

export async function bulkUpdateReportStatus(ids: string[], status: string): Promise<void> {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) throw new Error('Unauthorized')
  const db = createAdminClient()
  const { error } = await db
    .from('report_snapshots')
    .update({ status })
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/reports')
  revalidatePath('/participants')
}
