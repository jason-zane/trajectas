'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import {
  mapReportTemplateRow,
  mapCampaignReportConfigRow,
  mapReportSnapshotRow,
} from '@/lib/supabase/mappers'
import type {
  ReportTemplate,
  CampaignReportConfig,
  ReportSnapshot,
  ReportType,
  ReportDisplayLevel,
  PersonReferenceType,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Report Templates
// ---------------------------------------------------------------------------

export async function getReportTemplates(): Promise<ReportTemplate[]> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('report_templates')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapReportTemplateRow)
}

export async function getReportTemplate(id: string): Promise<ReportTemplate | null> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('report_templates')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
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
  const db = await createAdminClient()
  const { data, error } = await db
    .from('campaign_report_config')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle()
  if (error) throw new Error(error.message)
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
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapReportSnapshotRow)
}

export async function getReportSnapshot(id: string): Promise<ReportSnapshot | null> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapReportSnapshotRow(data) : null
}

export async function releaseSnapshot(id: string): Promise<void> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { error } = await db
    .from('report_snapshots')
    .update({
      released_at: new Date().toISOString(),
      status: 'released',
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
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

export async function getAllReadySnapshots(): Promise<ReportSnapshot[]> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('*')
    .in('status', ['ready', 'released', 'failed'])
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapReportSnapshotRow)
}

export async function getReportSnapshotsForParticipant(
  participantId: string,
): Promise<ReportSnapshot[]> {
  await requireAdminScope()
  const db = await createAdminClient()
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
  if (error) throw new Error(error.message)
  return (snapshots ?? []).map(mapReportSnapshotRow)
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
  const db = await createAdminClient()

  // Find all campaign_report_config rows that reference this template
  const { data: configs, error } = await db
    .from('campaign_report_config')
    .select('campaign_id, participant_template_id, hr_manager_template_id, consultant_template_id')
    .or(
      `participant_template_id.eq.${templateId},hr_manager_template_id.eq.${templateId},consultant_template_id.eq.${templateId}`,
    )
  if (error) throw new Error(error.message)
  if (!configs?.length) return []

  const campaignIds = configs.map((c) => c.campaign_id)

  // Fetch campaigns + their assessments in parallel
  const [{ data: campaigns }, { data: campaignAssessments }] = await Promise.all([
    db.from('campaigns').select('id, title').in('id', campaignIds),
    db.from('campaign_assessments').select('campaign_id, assessment_id, assessments(id, name)').in('campaign_id', campaignIds),
  ])

  const results: TemplateUsageEntry[] = []
  for (const config of configs) {
    const campaign = campaigns?.find((c) => c.id === config.campaign_id)
    if (!campaign) continue

    const assessments = (campaignAssessments ?? [])
      .filter((ca) => ca.campaign_id === config.campaign_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((ca) => ({ id: (ca.assessments as any)?.id ?? ca.assessment_id, name: (ca.assessments as any)?.name ?? 'Unknown' }))

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
  const db = await createAdminClient()

  const { data, error } = await db
    .from('campaign_report_config')
    .select('participant_template_id, hr_manager_template_id, consultant_template_id')
  if (error) throw new Error(error.message)

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
  const db = await createAdminClient()
  const { data, error } = await db
    .from('campaigns')
    .select('id, title')
    .is('deleted_at', null)
    .order('title')
  if (error) throw new Error(error.message)
  return data ?? []
}

// ---------------------------------------------------------------------------
// AI Prompts (for block builder)
// ---------------------------------------------------------------------------

export async function getReportPrompts(): Promise<{ id: string; name: string; purpose: string }[]> {
  await requireAdminScope()
  const db = await createAdminClient()
  const { data, error } = await db
    .from('ai_system_prompts')
    .select('id, name, purpose')
    .eq('is_active', true)
    .in('purpose', ['report_narrative', 'report_strengths_analysis', 'report_development_advice'])
    .order('name')
  if (error) throw new Error(error.message)
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
  const db = await createAdminClient()
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
