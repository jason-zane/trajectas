'use server'
import { PERSONALITY_REFERENCE_REPORT_SLUGS, requiresPersonalityReference } from '@/lib/reports/personality-reference-templates'

import { getReferenceStatusesForAuthorizedSnapshots } from '@/lib/reports/reference-status'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWorkspaceFeature, isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { requireAdminScope, requireClientAccess, requireAssessmentAccess, requireCampaignManage, requireSessionAccess, requireReportSnapshotAccess, assertIndividualResultsAccess, canManageCampaign, resolveTenantClientFilter } from '@/lib/auth/authorization'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { listNormReferences, getCampaignReferenceSettings, createNormReferenceVersion } from '@/lib/dal/norm-references'
import { processSnapshot } from '@/lib/reports/runner'
import { IPIP_DATABASE } from '@/lib/instrument/ipip-neo-120/database-form'
import { isAggregateOnly } from '@/lib/reports/confidentiality'

const uuid = z.string().uuid()
const selection = z.object({ assessmentId: uuid, referenceId: uuid.nullable() })
export async function refreshNormReference(input: unknown) {
  const parsed = z.object({ priorId: uuid, id: uuid, version: z.string().trim().min(1).max(100), artifact: z.string().max(200_000),
    sourceUrl: z.url().refine(value => value.startsWith('https://')), attribution: z.string().trim().min(10).max(1500), collectionPeriod: z.string().trim().min(4).max(100), notes: z.string().trim().min(20).max(3000) }).parse(input)
  const scope = await requireAdminScope()
  const id = await createNormReferenceVersion(parsed)
  await logAuditEvent({ actorProfileId: scope.actor?.id, eventType: 'reference.version.created', targetTable: 'norm_reference_versions', targetId: id, metadata: { priorId: parsed.priorId, version: parsed.version } })
  revalidatePath('/psychometrics/norms')
  return { id }
}
function refreshCampaign(id: string) {
  for (const prefix of ['', '/partner', '/client']) revalidatePath(`${prefix}/campaigns/${id}`, 'layout')
}

/** Approved choices for setup before a campaign exists. Both asset and client scope apply. */
export async function getCampaignSetupReferenceChoices(assessmentId: string, clientId: string | null) {
  uuid.parse(assessmentId)
  await requireWorkspaceFeature('campaignManagement')
  if (clientId) { uuid.parse(clientId); await requireClientAccess(clientId) }
  const references = (await listNormReferences(assessmentId)).filter(r => r.status === 'active' && (!r.scopeClientId || r.scopeClientId === clientId))
  return { references, defaultId: references.find(r => r.isDefault)?.id ?? null }
}

export async function setAssessmentReferenceDefault(input: unknown) {
  await requireWorkspaceFeature('assessmentAuthoring')
  const { assessmentId, referenceId } = selection.parse(input)
  const access = await requireAssessmentAccess(assessmentId, { forWrite: true })
  const { error } = await createAdminClient().rpc('set_assessment_reference_default', { p_assessment_id: assessmentId, p_reference_id: referenceId })
  if (error) throw new Error(error.message)
  await logAuditEvent({ actorProfileId: access.scope.actor?.id, eventType: 'assessment.reference.default_changed', targetTable: 'assessments', targetId: assessmentId, metadata: { referenceId } })
  revalidatePath(`/assessments/${assessmentId}/edit/references`)
  revalidatePath(`/partner/assessments/${assessmentId}/edit/references`)
}

export async function setCampaignAssessmentReference(input: unknown) {
  await requireWorkspaceFeature('campaignManagement')
  const { campaignId, campaignAssessmentId, referenceId } = z.object({ campaignId: uuid, campaignAssessmentId: uuid, referenceId: uuid.nullable() }).parse(input)
  const access = await requireCampaignManage(campaignId)
  const { data, error } = await createAdminClient().from('campaign_assessments').update({ reference_version_id: referenceId }).eq('id', campaignAssessmentId).eq('campaign_id', campaignId).is('deleted_at', null).select('id').single()
  if (error || !data) throw new Error(error?.message ?? 'Unable to save the campaign reference')
  await logAuditEvent({ actorProfileId: access.scope.actor?.id, eventType: 'campaign.reference.changed', targetTable: 'campaigns', targetId: campaignId, clientId: access.clientId, partnerId: access.partnerId, metadata: { campaignAssessmentId, referenceId } })
  refreshCampaign(campaignId)
}

export async function updateReferenceReview(input: unknown) {
  const scope = await requireAdminScope()
  if (!scope.actor?.id || resolveTenantClientFilter(scope) !== null) throw new Error('Reference review requires a signed-in administrator in the platform workspace')
  const { id, status, evidence, checks } = z.object({
    id: uuid, status: z.enum(['review', 'active', 'superseded', 'withdrawn']), evidence: z.string().trim().min(20).max(5000),
    checks: z.object({ datasetReuse: z.boolean(), formEquivalence: z.boolean(), methodology: z.boolean(), stability: z.boolean(), intendedUse: z.boolean() }),
  }).parse(input)
  // A platform admin standing in a client workspace is still confined there.
  const visible = await listNormReferences(undefined, true)
  const prior = visible.find(v => v.id === id)
  if (!prior) throw new Error('Reference not found in this workspace')
  if (status === 'active' && !Object.values(checks).every(Boolean)) throw new Error('All reference reviews must be approved before activation')
  const reviewEvidence = ['active', 'superseded', 'withdrawn'].includes(prior.status) ? prior.reviewEvidence : {
    ...Object.fromEntries(Object.entries(checks).map(([key, value]) => [key, value ? 'approved' : 'pending'])),
    evidence, reviewedBy: scope.actor.id, reviewedAt: new Date().toISOString(),
  }
  const { data: updated, error } = await createAdminClient().from('norm_reference_versions').update({ status, review_evidence: reviewEvidence }).eq('id', id).eq('status', prior.status).select('id').single()
  if (!updated || error) throw new Error(error?.message ?? 'The reference changed. Refresh and try again.')
  await logAuditEvent({ actorProfileId: scope.actor?.id, eventType: 'reference.review.recorded', targetTable: 'norm_reference_versions', targetId: id, metadata: { from: prior.status, to: status, evidence } })
  revalidatePath('/psychometrics/norms')
}

export async function getSessionReferenceWorkspace(sessionId: string) {
  uuid.parse(sessionId)
  await requireWorkspaceFeature('reportViewing')
  const access = await requireSessionAccess(sessionId)
  assertIndividualResultsAccess(access.scope, access.confidentialityMode)
  const db = createAdminClient()
  const session = await db.from('participant_sessions').select('assessment_id,status').eq('id', sessionId).eq('campaign_id', access.campaignId).single()
  if (session.error || !session.data) throw new Error('Assessment attempt not found')
  const manager = canManageCampaign(access.scope, access.partnerId, access.clientId)
  const reportDb = manager ? db : await createClient()
  const settings = await getCampaignReferenceSettings(access.campaignId)
  const assessment = settings.assessments.find(a => a.assessmentId === session.data.assessment_id)
  const [history, campaignTemplates, defaults, capability] = await Promise.all([
    reportDb.from('report_snapshots').select('id,template_id,status,edition_number,generation_manifest,reference_version_id,reference_interpretation,participant_selected,created_at,error_message,report_templates(name)').eq('participant_session_id', sessionId).eq('campaign_id', access.campaignId).order('created_at', { ascending: false }),
    db.from('campaign_report_templates').select('template_id').eq('campaign_id', access.campaignId),
    db.from('assessment_report_templates').select('template_id').eq('assessment_id', session.data.assessment_id).eq('is_default', true),
    db.from('norm_reporting_capabilities').select('editions_enabled').eq('singleton', true).single(),
  ])
  if (history.error || campaignTemplates.error || defaults.error || capability.error) throw new Error('Unable to load report editions')
  const referenceStatuses = await getReferenceStatusesForAuthorizedSnapshots((history.data ?? []).map(row => ({ referenceVersionId: row.reference_version_id })))
  const ids = [...new Set([...(campaignTemplates.data ?? []), ...(defaults.data ?? [])].map(r => r.template_id))]
  const templateResult = ids.length ? await db.from('report_templates').select('id,name,custom_report_slug').in('id', ids).in('custom_report_slug', [...PERSONALITY_REFERENCE_REPORT_SLUGS]).eq('is_active', true).is('deleted_at', null) : { data: [], error: null }
  if (templateResult.error) throw new Error('Unable to load compatible report templates')
  return {
    canCreate: session.data.status === 'completed' && session.data.assessment_id === IPIP_DATABASE.assessmentId && !isAggregateOnly(access.confidentialityMode) && manager && await isWorkspaceFeatureEnabled('reportGeneration') && Boolean(capability.data.editions_enabled),
    campaignReferenceId: assessment?.referenceVersionId ?? null,
    references: (assessment?.references ?? []).filter(r => r.status === 'active' || r.id === assessment?.referenceVersionId),
    templates: (templateResult.data ?? []).map(t => ({ ...t, requiresReference: requiresPersonalityReference(t.custom_report_slug) })),
    history: (history.data ?? []).map(row => ({
      id: row.id as string, templateName: String(row.generation_manifest?.template?.name ?? (Array.isArray(row.report_templates) ? row.report_templates[0] : row.report_templates)?.name ?? 'Report'),
      status: row.status as string, edition: row.edition_number as number, createdAt: row.created_at as string,
      referenceStatus: referenceStatuses[row.reference_version_id] ?? null,
      referenceName: row.reference_interpretation?.reference?.name as string | undefined,
      referenceVersion: row.reference_interpretation?.reference?.version as string | undefined,
      participantSelected: row.participant_selected as boolean, errorMessage: row.error_message as string | null,
    })),
  }
}

export async function createReferenceReportEdition(input: unknown): Promise<{ id: string }> {
  await requireWorkspaceFeature('reportGeneration')
  const request = z.object({ sessionId: uuid, templateId: uuid, referenceId: uuid.nullable(), requestId: uuid, parentSnapshotId: uuid.nullable() }).parse(input)
  const access = await requireSessionAccess(request.sessionId)
  await requireCampaignManage(access.campaignId)
  assertIndividualResultsAccess(access.scope, access.confidentialityMode)
  const options = await getSessionReferenceWorkspace(request.sessionId)
  if (!options.canCreate || !options.templates.some(t => t.id === request.templateId)) throw new Error('This report template is not available for this assessment')
  if (!request.referenceId && options.templates.find(t => t.id === request.templateId)?.requiresReference) throw new Error('Choose a norm reference for the standard percentile report')
  if (request.referenceId && !options.references.some(r => r.id === request.referenceId)) throw new Error('This reference is unavailable or incompatible')
  const { data, error } = await createAdminClient().rpc('enqueue_reference_report', {
    p_session_id: request.sessionId, p_template_id: request.templateId, p_reference_id: request.referenceId,
    p_request_id: request.requestId, p_parent_snapshot_id: request.parentSnapshotId, p_automatic: false,
  })
  if (error || !data) throw new Error(error?.message ?? 'Unable to create report')
  const id = String(data)
  await logAuditEvent({ actorProfileId: access.scope.actor?.id, eventType: 'report.edition.requested', targetTable: 'report_snapshots', targetId: id, clientId: access.clientId, partnerId: access.partnerId, metadata: { sessionId: request.sessionId, referenceId: request.referenceId, requestId: request.requestId } })
  after(async () => { await processSnapshot(id) })
  refreshCampaign(access.campaignId)
  return { id }
}

export async function selectParticipantReportEdition(snapshotId: string) {
  uuid.parse(snapshotId)
  await requireWorkspaceFeature('reportGeneration')
  const access = await requireReportSnapshotAccess(snapshotId)
  if (!access.campaignId) throw new Error('Report campaign not found')
  await requireCampaignManage(access.campaignId)
  assertIndividualResultsAccess(access.scope, access.confidentialityMode)
  const { error } = await createAdminClient().rpc('select_participant_report_edition', { p_snapshot_id: snapshotId })
  if (error) throw new Error(error.message)
  await logAuditEvent({ actorProfileId: access.scope.actor?.id, eventType: 'report.participant_edition.selected', targetTable: 'report_snapshots', targetId: snapshotId, clientId: access.clientId, partnerId: access.partnerId })
  refreshCampaign(access.campaignId)
}
