'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  requireAdminScope,
  requireCampaignAccess,
  requireParticipantAccess,
  resolveAuthorizedScope,
} from '@/lib/auth/authorization'
import {
  logReportViewed,
  logSupportSessionDataAccess,
} from '@/lib/auth/support-sessions'
import {
  logActionError,
  throwActionError,
} from '@/lib/security/action-errors'
import {
  mapReportTemplateRow,
  mapCampaignReportConfigRow,
  mapReportSnapshotRow,
} from '@/lib/supabase/mappers'
import { enqueueReportSnapshotEvent } from '@/lib/integrations/events'
import type {
  ReportTemplate,
  CampaignReportConfig,
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

// ---------------------------------------------------------------------------
// Report Templates
// ---------------------------------------------------------------------------

export async function getReportTemplates(): Promise<ReportTemplate[]> {
  await requireAdminScope()
  const db = await createClient()
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
  return (data ?? []).map(mapReportTemplateRow)
}

function getRelatedRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }

  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export async function getReportTemplate(id: string): Promise<ReportTemplate | null> {
  await requireAdminScope()
  const db = await createClient()
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
  await requireAdminScope()
  const db = await createAdminClient()
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
      partner_id: input.partnerId ?? null,
      blocks: [],
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/report-templates')
  return mapReportTemplateRow(data)
}

export async function cloneReportTemplate(id: string): Promise<ReportTemplate> {
  await requireAdminScope()
  const db = await createAdminClient()
  const source = await getReportTemplate(id)
  if (!source) throw new Error('Template not found')
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
      partner_id: source.partnerId ?? null,
      blocks: source.blocks,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/report-templates')
  return mapReportTemplateRow(data)
}

export async function updateReportTemplateBlocks(
  id: string,
  blocks: Record<string, unknown>[],
): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { error } = await db
    .from('report_templates')
    .update({ blocks })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/report-templates/${id}/builder`)
}

export async function updateReportTemplateSettings(
  id: string,
  updates: Partial<CreateReportTemplateInput>,
): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
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
}

export async function deleteReportTemplate(id: string): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { error } = await db
    .from('report_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/report-templates')
}

export async function toggleReportTemplateActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { error } = await db
    .from('report_templates')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/report-templates')
}

// ---------------------------------------------------------------------------
// Campaign Report Config
// ---------------------------------------------------------------------------

export async function getCampaignReportConfig(
  campaignId: string,
): Promise<CampaignReportConfig | null> {
  await requireAdminScope()
  const db = await createClient()
  const { data, error } = await db
    .from('campaign_report_config')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle()
  if (error) {
    throwActionError(
      'getCampaignReportConfig',
      'Unable to load report configuration.',
      error
    )
  }
  return data ? mapCampaignReportConfigRow(data) : null
}

export interface UpsertCampaignReportConfigInput {
  participantTemplateId?: string | null
  hrManagerTemplateId?: string | null
  consultantTemplateId?: string | null
  brandMode?: string
}

export async function upsertCampaignReportConfig(
  campaignId: string,
  input: UpsertCampaignReportConfigInput,
): Promise<CampaignReportConfig> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('campaign_report_config')
    .upsert(
      {
        campaign_id: campaignId,
        participant_template_id: input.participantTemplateId ?? null,
        hr_manager_template_id: input.hrManagerTemplateId ?? null,
        consultant_template_id: input.consultantTemplateId ?? null,
        brand_mode: input.brandMode ?? 'platform',
      },
      { onConflict: 'campaign_id' },
    )
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath(`/campaigns/${campaignId}`)
  return mapCampaignReportConfigRow(data)
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

  const snapshots = (data ?? []).map(mapReportSnapshotRow)
  // Resolve signed URLs for private storage paths
  return Promise.all(
    snapshots.map(async (s) =>
      s.pdfUrl ? { ...s, pdfUrl: await getSignedReportPdfUrl(s.pdfUrl) } : s
    )
  )
}

export async function getReportSnapshot(id: string): Promise<ReportSnapshot | null> {
  const scope = await resolveAuthorizedScope()
  const db = await createClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('*, participant_sessions(campaign_participant_id), campaigns(client_id, partner_id)')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    throwActionError('getReportSnapshot', 'Unable to load report.', error)
  }
  if (!data) return null

  const snapshot = mapReportSnapshotRow(data)
  const campaign = Array.isArray(data.campaigns) ? data.campaigns[0] : data.campaigns
  const participantSession = Array.isArray(data.participant_sessions)
    ? data.participant_sessions[0]
    : data.participant_sessions
  const clientId =
    campaign && typeof campaign === 'object' && campaign.client_id
      ? String(campaign.client_id)
      : null
  const partnerId =
    campaign && typeof campaign === 'object' && campaign.partner_id
      ? String(campaign.partner_id)
      : null
  const participantId =
    participantSession &&
    typeof participantSession === 'object' &&
    participantSession.campaign_participant_id
      ? String(participantSession.campaign_participant_id)
      : null

  try {
    await logReportViewed({
      actorProfileId: scope.actor?.id ?? null,
      snapshotId: snapshot.id,
      participantId,
      audienceType: snapshot.audienceType,
      partnerId,
      clientId,
      supportSessionId: scope.supportSession?.id ?? null,
    })
    await logSupportSessionDataAccess({
      scope,
      resourceType: 'report_snapshots',
      resourceId: snapshot.id,
      partnerId,
      clientId,
      metadata: { action: 'detail', audienceType: snapshot.audienceType },
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

export async function releaseSnapshot(id: string): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
  const releasedAt = new Date().toISOString()
  const { data: snapshot, error: snapshotError } = await db
    .from('report_snapshots')
    .select('id, campaign_id, participant_session_id, audience_type')
    .eq('id', id)
    .single()

  if (snapshotError || !snapshot) throw new Error(snapshotError?.message ?? 'Snapshot not found')

  const { error } = await db
    .from('report_snapshots')
    .update({
      released_at: releasedAt,
      status: 'released',
    })
    .eq('id', id)
  if (error) throw new Error(error.message)

  try {
    await enqueueReportSnapshotEvent({
      snapshotId: String(snapshot.id),
      campaignId: String(snapshot.campaign_id),
      participantSessionId: String(snapshot.participant_session_id),
      audienceType: String(snapshot.audience_type),
      status: 'released',
      generatedAt: releasedAt,
      releasedAt,
    })
  } catch (eventError) {
    console.error(`[integrations] Failed to enqueue report.released event for ${id}:`, eventError)
  }

  revalidatePath('/reports')
}

export async function retrySnapshot(id: string): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { error } = await db
    .from('report_snapshots')
    .update({ status: 'pending', error_message: null })
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

/** Manually create and queue snapshots for a session (admin/testing use). */
export async function queueSnapshotsForSession(sessionId: string): Promise<void> {
  await requireAdminScope()
  // Trigger the runner — it will call processSnapshot for each pending row
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': process.env.INTERNAL_API_KEY ?? '',
    },
    body: JSON.stringify({ sessionId }),
  })
}

export type ReportSnapshotListItem = ReportSnapshot & {
  participantName?: string
  participantEmail?: string
}

export async function getAllReadySnapshots(): Promise<ReportSnapshotListItem[]> {
  await requireAdminScope()
  const db = await createClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select(
      '*, participant_sessions(campaign_participant_id, campaign_participants(first_name, last_name, email))'
    )
    .in('status', ['ready', 'released', 'failed'])
    .order('created_at', { ascending: false })
    .limit(200)
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

export type AudienceType = 'participant' | 'hr_manager' | 'consultant'

export interface TemplateUsageEntry {
  campaignId: string
  campaignTitle: string
  audienceType: AudienceType
  assessments: { id: string; name: string }[]
}

const AUDIENCE_FK_COLUMNS: Record<AudienceType, string> = {
  participant: 'participant_template_id',
  hr_manager: 'hr_manager_template_id',
  consultant: 'consultant_template_id',
}

/** Returns campaigns linked to a template, with their assessments. */
export async function getTemplateUsage(templateId: string): Promise<TemplateUsageEntry[]> {
  await requireAdminScope()
  const db = await createClient()

  // Find all campaign_report_config rows that reference this template
  const { data: configs, error } = await db
    .from('campaign_report_config')
    .select('campaign_id, participant_template_id, hr_manager_template_id, consultant_template_id')
    .or(
      `participant_template_id.eq.${templateId},hr_manager_template_id.eq.${templateId},consultant_template_id.eq.${templateId}`,
    )
  if (error) {
    throwActionError(
      'getTemplateUsage',
      'Unable to load template usage.',
      error
    )
  }
  if (!configs?.length) return []

  const campaignIds = configs.map((c) => c.campaign_id)

  // Fetch campaigns + their assessments in parallel
  const [{ data: campaigns }, { data: campaignAssessments }] = await Promise.all([
    db.from('campaigns').select('id, title').in('id', campaignIds),
    db.from('campaign_assessments').select('campaign_id, assessment_id, assessments(id, title)').in('campaign_id', campaignIds),
  ])

  const results: TemplateUsageEntry[] = []
  for (const config of configs) {
    const campaign = campaigns?.find((c) => c.id === config.campaign_id)
    if (!campaign) continue

    const assessments = (campaignAssessments ?? [])
      .filter((ca) => ca.campaign_id === config.campaign_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((ca) => ({ id: (ca.assessments as any)?.id ?? ca.assessment_id, name: (ca.assessments as any)?.title ?? 'Unknown' }))

    // Determine which audience types use this template
    const audiences: AudienceType[] = []
    if (config.participant_template_id === templateId) audiences.push('participant')
    if (config.hr_manager_template_id === templateId) audiences.push('hr_manager')
    if (config.consultant_template_id === templateId) audiences.push('consultant')

    for (const audienceType of audiences) {
      results.push({
        campaignId: config.campaign_id,
        campaignTitle: campaign.title,
        audienceType,
        assessments,
      })
    }
  }

  return results
}

/** Link a template to a campaign for a specific audience type. */
export async function linkTemplateToCampaign(
  templateId: string,
  campaignId: string,
  audienceType: AudienceType,
): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
  const column = AUDIENCE_FK_COLUMNS[audienceType]

  const { error } = await db
    .from('campaign_report_config')
    .upsert(
      { campaign_id: campaignId, [column]: templateId },
      { onConflict: 'campaign_id' },
    )
  if (error) throw new Error(error.message)
  revalidatePath('/report-templates')
  revalidatePath(`/campaigns/${campaignId}`)
}

/** Unlink a template from a campaign for a specific audience type. */
export async function unlinkTemplateFromCampaign(
  templateId: string,
  campaignId: string,
  audienceType: AudienceType,
): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
  const column = AUDIENCE_FK_COLUMNS[audienceType]

  const { error } = await db
    .from('campaign_report_config')
    .update({ [column]: null })
    .eq('campaign_id', campaignId)
    .eq(column, templateId)
  if (error) throw new Error(error.message)
  revalidatePath('/report-templates')
  revalidatePath(`/campaigns/${campaignId}`)
}

/** Returns template usage counts for the template list page. */
export async function getTemplateUsageCounts(): Promise<Record<string, number>> {
  await requireAdminScope()
  const db = await createClient()

  const { data, error } = await db
    .from('campaign_report_config')
    .select('participant_template_id, hr_manager_template_id, consultant_template_id')
  if (error) {
    throwActionError(
      'getTemplateUsageCounts',
      'Unable to load template usage.',
      error
    )
  }

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    for (const col of ['participant_template_id', 'hr_manager_template_id', 'consultant_template_id'] as const) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (row as any)[col]
      if (id) counts[id] = (counts[id] ?? 0) + 1
    }
  }
  return counts
}

/** Returns all campaigns (for linking UI). */
export async function getAllCampaigns(): Promise<{ id: string; title: string }[]> {
  await requireAdminScope()
  const db = await createClient()
  const { data, error } = await db
    .from('campaigns')
    .select('id, title')
    .is('deleted_at', null)
    .order('title')
  if (error) {
    throwActionError('getAllCampaigns', 'Unable to load campaigns.', error)
  }
  return data ?? []
}

// ---------------------------------------------------------------------------
// AI Prompts (for block builder)
// ---------------------------------------------------------------------------

export async function getReportPrompts(): Promise<{ id: string; name: string; purpose: string }[]> {
  await requireAdminScope()
  const db = await createClient()
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
}

export async function getEntityOptions(): Promise<EntityOption[]> {
  await requireAdminScope()
  const db = await createClient()
  const [{ data: dimensions }, { data: factors }, { data: constructs }] = await Promise.all([
    db.from('dimensions').select('id, name').is('deleted_at', null).eq('is_active', true),
    db.from('factors').select('id, name').is('deleted_at', null).eq('is_active', true),
    db.from('constructs').select('id, name').is('deleted_at', null).eq('is_active', true),
  ])
  const options: EntityOption[] = [
    ...(dimensions ?? []).map((d) => ({ id: d.id, label: d.name, type: 'dimension' as const })),
    ...(factors ?? []).map((f) => ({ id: f.id, label: f.name, type: 'factor' as const })),
    ...(constructs ?? []).map((c) => ({ id: c.id, label: c.name, type: 'construct' as const })),
  ]
  return options.sort((a, b) => a.label.localeCompare(b.label))
}

// ---------------------------------------------------------------------------
// On-Demand Report Generation
// ---------------------------------------------------------------------------

export type ReportTemplateOption = {
  id: string
  name: string
  description?: string
}

export async function getActiveReportTemplates(): Promise<ReportTemplateOption[]> {
  const db = await createClient()
  const { data, error } = await db
    .from('report_templates')
    .select('id, name, description')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    throwActionError('getActiveReportTemplates', 'Unable to load templates.', error)
  }

  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    description: r.description ? String(r.description) : undefined,
  }))
}

export async function generateReportSnapshot(input: {
  sessionId: string
  templateId: string
  audienceType: 'participant' | 'hr_manager' | 'consultant'
  narrativeMode?: 'ai_enhanced' | 'derived'
}): Promise<{ success: true; snapshotId: string } | { error: string }> {
  const { sessionId, templateId, audienceType, narrativeMode = 'derived' } = input

  try {
    const scope = await resolveAuthorizedScope()
    if (!scope.isPlatformAdmin && !scope.isLocalDevelopmentBypass) {
      const db = await createClient()
      const { data: sessionRow } = await db
        .from('participant_sessions')
        .select('id, campaign_participants(campaigns(client_id))')
        .eq('id', sessionId)
        .single()

      const cp = (sessionRow as any)?.campaign_participants
      const campaign = Array.isArray(cp) ? cp[0]?.campaigns : cp?.campaigns
      const clientId = (Array.isArray(campaign) ? campaign[0]?.client_id : campaign?.client_id) as string | undefined

      if (!clientId || !scope.clientIds.includes(clientId)) {
        return { error: 'Not authorized to generate reports for this session.' }
      }
    }
  } catch (err) {
    logActionError('generateReportSnapshot.auth', err)
    return { error: 'Authorization check failed.' }
  }

  const adminDb = createAdminClient()

  const { data: sessionData, error: sessionErr } = await adminDb
    .from('participant_sessions')
    .select('id, campaign_participants(campaign_id)')
    .eq('id', sessionId)
    .single()

  if (sessionErr || !sessionData) {
    logActionError('generateReportSnapshot.session', sessionErr)
    return { error: 'Session not found.' }
  }

  const cp = (sessionData as any).campaign_participants
  const campaignId = (Array.isArray(cp) ? cp[0]?.campaign_id : cp?.campaign_id) as string | undefined

  if (!campaignId) {
    return { error: 'Session is not linked to a campaign.' }
  }

  const { data: snapshotRow, error: insertErr } = await adminDb
    .from('report_snapshots')
    .insert({
      campaign_id: campaignId,
      participant_session_id: sessionId,
      template_id: templateId,
      audience_type: audienceType,
      narrative_mode: narrativeMode,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr || !snapshotRow) {
    logActionError('generateReportSnapshot.insert', insertErr)
    return { error: 'Failed to create snapshot.' }
  }

  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.INTERNAL_API_KEY ?? '',
      },
      body: JSON.stringify({ snapshotId: snapshotRow.id }),
    })
  } catch (fetchErr) {
    logActionError('generateReportSnapshot.fetch', fetchErr)
  }

  revalidatePath('/participants')

  return { success: true, snapshotId: String(snapshotRow.id) }
}
