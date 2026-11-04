import 'server-only'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAuthorizedScope, isUnconfinedPlatformAdmin, getAccessibleCampaignIds, AuthorizationError } from '@/lib/auth/authorization'
import { postgresUuid } from '@/lib/validations/uuid'
import { deletionManifestSchema } from '@/lib/privacy/types'
import { createPrivacyLedger } from '@/lib/privacy/ledger'

export async function requirePrivacyAdmin() {
  const scope = await resolveAuthorizedScope()
  if (!isUnconfinedPlatformAdmin(scope) || !scope.actor?.id || scope.previewContext || scope.supportSession) {
    throw new AuthorizationError('Use the platform workspace with an active administrator account.')
  }
  return scope
}

function fail(error: unknown): never {
  // Provider errors may contain complete records. Keep private diagnostics bounded.
  void error
  throw new PrivacyAdminError('The privacy operation could not be completed.')
}

export async function getPrivacyDashboard() {
  const scope = await requirePrivacyAdmin()
  const db = createAdminClient()
  const results = await Promise.all([
    db.from('privacy_retention_policies').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('privacy_notice_versions').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('privacy_deletion_requests').select('id,participant_id,status,reason,requested_at,active_deleted_at,backup_expires_at,completed_at,last_error_code,summary,provider_tasks,attempts').order('requested_at', { ascending: false }).limit(100),
    db.from('privacy_legal_holds').select('id,campaign_id,participant_id,reason,review_at,released_at').is('released_at', null).limit(100),
  ])
  if (results.some(result => result.error)) fail(results.find(result => result.error)?.error)
  const pendingIds = (results[2].data ?? []).map(row => row.participant_id).filter(Boolean)
  const campaignIds = await getAccessibleCampaignIds(scope)
  let targets = db.from('campaign_participants').select('id,first_name,last_name,campaigns(title)').in('id', pendingIds)
  if (campaignIds !== null) targets = targets.in('campaign_id', campaignIds)
  const targetResult = pendingIds.length ? await targets : { data: [], error: null }
  if (targetResult.error) fail(targetResult.error)
  const labels = new Map((targetResult.data ?? []).map(row => {
    const campaign = (Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns) as unknown as { title: string } | null
    return [String(row.id), { name: [row.first_name,row.last_name].filter(Boolean).join(' '), campaign: campaign?.title ?? '' }]
  }))
  return {
    policies: (results[0].data ?? []).map(row => ({ id: String(row.id), name: String(row.name), version: String(row.version), scope: String(row.scope), recoveryOnly:Boolean(row.recovery_only),status: String(row.status), retentionMonths: row.retention_months as number | null, backupDays: row.backup_days as number | null, diagnosticDays: row.diagnostic_days as number | null, auditDays: row.audit_days as number | null, researchAllowed: Boolean(row.research_allowed) })),
    notices: (results[1].data ?? []).map(row => ({ id: String(row.id), version: String(row.version), title: String(row.title), body: String(row.body), hash: String(row.body_hash), audience: String(row.audience), status: String(row.status), acknowledgementLabel: String(row.acknowledgement_label), researchLabel: String(row.research_label), researchChoiceEnabled: Boolean(row.research_choice_enabled) })),
    requests: (results[2].data ?? []).map(row => ({ id: String(row.id), participantId: row.participant_id as string | null, target: labels.get(String(row.participant_id)) ?? null, status: String(row.status), reason: String(row.reason), requestedAt: String(row.requested_at), activeDeletedAt: row.active_deleted_at as string | null, backupExpiresAt: row.backup_expires_at as string | null, completedAt: row.completed_at as string | null, lastErrorCode: row.last_error_code as string | null, counts: row.summary as Record<string, number>, providerTasks: row.provider_tasks as Array<{ processor: string; status: string }>, attempts: Number(row.attempts) })),
    holds: (results[3].data ?? []).map(row => ({ id: String(row.id), campaignId: String(row.campaign_id), participantId: row.participant_id as string | null, reason: String(row.reason), reviewAt: String(row.review_at) })),
  }
}

export async function findPrivacyParticipants(email: string) {
  const scope = await requirePrivacyAdmin()
  const parsed = z.email().max(254).parse(email.trim())
  const campaignIds = await getAccessibleCampaignIds(scope)
  if (campaignIds !== null && !campaignIds.length) return []
  let query = createAdminClient().from('campaign_participants')
    .select('id,campaign_id,first_name,last_name,status,deleted_at,privacy_pending_at,campaigns(title,client_id,clients(name))')
    .eq('email', parsed).limit(100)
  if (campaignIds !== null) query = query.in('campaign_id', campaignIds)
  const { data, error } = await query
  if (error) fail(error)
  return (data ?? []).map(row => {
    const campaign = (Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns) as unknown as { title: string; client_id: string | null; clients: { name: string } | null } | null
    return { id: String(row.id), campaignId: String(row.campaign_id), name: [row.first_name, row.last_name].filter(Boolean).join(' '), campaign: campaign?.title ?? 'Campaign', client: campaign?.clients?.name ?? 'Platform', status: String(row.status), deletionPending: Boolean(row.privacy_pending_at) }
  })
}

export async function previewParticipantDeletion(participantId: string) {
  await requirePrivacyAdmin()
  const { data, error } = await createAdminClient().rpc('privacy_plan_deletion', { p_participant: postgresUuid().parse(participantId) })
  if (error) fail(error)
  return deletionManifestSchema.parse(data)
}

export async function requestParticipantDeletion(input: { participantId: string; policyId: string; reason: 'individual_request' | 'retention_expiry' | 'engagement_end' }) {
  const scope = await requirePrivacyAdmin()
  const id = postgresUuid().parse(input.participantId), policyId = postgresUuid().parse(input.policyId)
  const reason = z.enum(['individual_request', 'retention_expiry', 'engagement_end']).parse(input.reason)
  const db = createAdminClient()
  const { data: participant, error: participantError } = await db.from('campaign_participants').select('id,campaign_id,campaigns(client_id)').eq('id', id).single()
  if (participantError || !participant) fail(participantError)
  const { data: policy, error: policyError } = await db.from('privacy_retention_policies').select('id,status').eq('id', policyId).eq('status', 'active').eq('scope', 'assessment').eq('recovery_only',false).single()
  if (policyError || !policy) fail(policyError)
  const campaign = (Array.isArray(participant.campaigns) ? participant.campaigns[0] : participant.campaigns) as unknown as { client_id: string | null }
  const preview=await db.rpc('privacy_plan_deletion',{p_participant:id})
  if(preview.error)fail(preview.error)
  const manifest=deletionManifestSchema.parse(preview.data)
  const { error } = await db.from('privacy_deletion_requests').insert({
    participant_id: id, campaign_id: participant.campaign_id, client_id: campaign.client_id,
    policy_id: policyId, reason, requested_by: scope.actor!.id,
    summary:{...manifest.counts,storageObjects:manifest.objects.length,reviewBlockers:manifest.blockers.length},
    provider_tasks: ['email_and_recipient_copies','migration_source_and_exports','shared_processor_and_support_copies'].map(processor=>({processor,status:'pending'})),
  })
  if (error) fail(error)
}

export async function approveParticipantDeletion(requestId: string, confirmation: string) {
  const scope = await requirePrivacyAdmin()
  z.literal('APPROVE_PERMANENT_DELETION').parse(confirmation)
  const { data, error } = await createAdminClient().from('privacy_deletion_requests')
    .update({ status: 'approved', approved_by: scope.actor!.id, approved_at: new Date().toISOString(), next_attempt_at: new Date().toISOString(), last_error_code: null })
    .eq('id', postgresUuid().parse(requestId)).in('status', ['requested', 'review_required', 'failed']).is('lease_id', null).select('id')
  if (error || !data?.length) fail(error)
}

export async function confirmDeletionProviderTask(input: { requestId: string; processor: string; evidenceRef: string }) {
  const scope = await requirePrivacyAdmin()
  const requestId = postgresUuid().parse(input.requestId)
  const processor = z.string().regex(/^[a-z_]{1,80}$/).parse(input.processor)
  const evidenceRef = z.string().regex(/^[a-zA-Z0-9_.:-]{1,120}$/).parse(input.evidenceRef)
  const { error } = await createAdminClient().rpc('privacy_confirm_provider_task', {
    p_request: requestId, p_processor: processor, p_evidence: evidenceRef, p_actor: scope.actor!.id,
  })
  if (error) fail(error)
}

export async function createRetentionPolicyDraft(input: unknown) {
  await requirePrivacyAdmin()
  const { retentionPolicyInput } = await import('@/lib/privacy/inputs')
  const value = retentionPolicyInput.parse(input)
  const { data,error } = await createAdminClient().from('privacy_retention_policies').insert({
    name: value.name, version: value.version, scope: value.scope, retention_months: value.retentionMonths,
    backup_days: value.backupDays, diagnostic_days: value.diagnosticDays, audit_days: value.auditDays,
    research_allowed: value.researchAllowed, status: 'draft',
  }).select('id').single()
  if (error||!data) fail(error)
  return String(data.id)
}

export async function activateRetentionPolicy(policyId: string, confirmation: string) {
  const scope = await requirePrivacyAdmin()
  z.literal('APPROVE_RETENTION_POLICY').parse(confirmation)
  const {error}=await createAdminClient().rpc('privacy_activate_policy',{p_policy:postgresUuid().parse(policyId),p_actor:scope.actor!.id})
  if(error)fail(error)
}

export async function updateRetentionPolicyDraft(id:string,input:unknown) {
  await requirePrivacyAdmin()
  const {retentionPolicyInput}=await import('@/lib/privacy/inputs')
  const value=retentionPolicyInput.parse(input)
  const {data,error}=await createAdminClient().from('privacy_retention_policies').update({
    name:value.name,version:value.version,scope:value.scope,retention_months:value.retentionMonths,
    backup_days:value.backupDays,diagnostic_days:value.diagnosticDays,audit_days:value.auditDays,research_allowed:value.researchAllowed,
  }).eq('id',postgresUuid().parse(id)).eq('status','draft').select('id')
  if(error||!data?.length)fail(error)
  return String(data[0].id)
}

export async function createPrivacyNoticeDraft(input: unknown) {
  await requirePrivacyAdmin()
  const { privacyNoticeInput } = await import('@/lib/privacy/inputs')
  const value = privacyNoticeInput.parse(input)
  const { data,error } = await createAdminClient().from('privacy_notice_versions').insert({
    version: value.version, audience: value.audience, title: value.title, body: value.body,
    acknowledgement_label: value.acknowledgementLabel, research_label: value.researchLabel,
    research_choice_enabled: value.researchChoiceEnabled, status: 'draft',
  }).select('id').single()
  if (error||!data) fail(error)
  return String(data.id)
}

export async function publishPrivacyNotice(noticeId: string, expectedHash: string, confirmation: string) {
  const scope = await requirePrivacyAdmin()
  z.literal('PUBLISH_REVIEWED_NOTICE').parse(confirmation)
  z.string().regex(/^[a-f0-9]{64}$/).parse(expectedHash)
  const { data, error } = await createAdminClient().from('privacy_notice_versions')
    .update({ status: 'published', published_by: scope.actor!.id, published_at: new Date().toISOString() })
    .eq('id', postgresUuid().parse(noticeId)).eq('body_hash', expectedHash).eq('status', 'draft').select('id')
  if (error || !data?.length) fail(error)
}

export async function getPrivacyCampaigns() {
  const scope = await requirePrivacyAdmin()
  const campaignIds = await getAccessibleCampaignIds(scope)
  if (campaignIds !== null && !campaignIds.length) return []
  let query = createAdminClient().from('campaigns').select('id,title,client_id,status').is('deleted_at', null).order('title').limit(500)
  if (campaignIds !== null) query = query.in('id', campaignIds)
  const { data, error } = await query
  if (error) fail(error)
  return (data ?? []).map(row => ({ id: String(row.id), title: String(row.title), status: String(row.status) }))
}

export async function setCampaignPrivacy(input: unknown) {
  const scope=await requirePrivacyAdmin()
  const { campaignPrivacyInput } = await import('@/lib/privacy/inputs')
  const value = campaignPrivacyInput.parse(input)
  if (value.closedAt && Date.parse(value.closedAt) > Date.now()) throw new PrivacyAdminError('Choose an actual closure date.')
  const db = createAdminClient()
  const [policy, notice, current] = await Promise.all([
    db.from('privacy_retention_policies').select('id').eq('id', value.policyId).eq('status', 'active').eq('scope', 'assessment').eq('recovery_only',false).single(),
    db.from('privacy_notice_versions').select('id').eq('id', value.noticeId).eq('status', 'published').eq('audience', 'participant').single(),
    db.from('campaign_privacy_settings').select('notice_version_id,notice_effective_at,closed_at').eq('campaign_id', value.campaignId).maybeSingle(),
  ])
  if (policy.error || notice.error || current.error) fail(policy.error ?? notice.error ?? current.error)
  const { error } = await db.from('campaign_privacy_settings').upsert({
    campaign_id: value.campaignId, retention_policy_id: value.policyId, notice_version_id: value.noticeId,
    notice_effective_at: current.data?.notice_version_id === value.noticeId ? current.data.notice_effective_at : new Date().toISOString(),
    closed_at: current.data?.closed_at ?? value.closedAt, updated_at: new Date().toISOString(),updated_by:scope.actor!.id,
  }, { onConflict: 'campaign_id' })
  if (error) fail(error)
}

export async function createPrivacyHold(input: unknown) {
  const scope = await requirePrivacyAdmin()
  const { privacyHoldInput } = await import('@/lib/privacy/inputs')
  const { randomUUID } = await import('node:crypto')
  const value = privacyHoldInput.parse(input)
  const db = createAdminClient()
  if (value.participantId) {
    const { data, error } = await db.from('campaign_participants').select('id').eq('id', value.participantId).eq('campaign_id', value.campaignId).single()
    if (error || !data) fail(error)
  }
  const id = randomUUID()
  // Record a hold outside the backup before enabling source-side disposal.
  // An orphaned external hold is conservative and requires reconciliation.
  await createPrivacyLedger().put({ kind: 'hold', id, campaignId: value.campaignId, participantId: value.participantId,
    status: 'active', reviewAt: value.reviewAt, expiresAt: null })
  const { error } = await db.from('privacy_legal_holds').insert({
    id, campaign_id: value.campaignId, participant_id: value.participantId, reason: value.reason,
    review_at: value.reviewAt, created_by: scope.actor!.id,
  })
  if (error) fail(error)
}

export async function releasePrivacyHold(holdId: string, confirmation: string) {
  const scope = await requirePrivacyAdmin()
  z.literal('RELEASE_LEGAL_HOLD').parse(confirmation)
  const db = createAdminClient(), id = postgresUuid().parse(holdId)
  const { data: hold, error } = await db.from('privacy_legal_holds').select('campaign_id,participant_id,review_at').eq('id', id).is('released_at', null).single()
  if (error || !hold) fail(error)
  const policies = await db.from('privacy_retention_policies').select('backup_days').eq('status', 'active').order('backup_days', { ascending: false }).limit(1)
  if (policies.error) fail(policies.error)
  const backupDays = Number(policies.data?.[0]?.backup_days ?? 365)
  const released = await db.from('privacy_legal_holds').update({ released_at: new Date().toISOString(), released_by: scope.actor!.id }).eq('id', id).is('released_at', null).select('id')
  if (released.error || !released.data?.length) fail(released.error)
  await createPrivacyLedger().put({ kind: 'hold', id, campaignId: hold.campaign_id, participantId: hold.participant_id,
    status: 'released', reviewAt: hold.review_at, expiresAt: new Date(Date.now() + (backupDays + 1) * 86400000).toISOString() })
}

export async function getResearchWorkbench() {
  await requirePrivacyAdmin()
  const db = createAdminClient()
  const [cases, releases] = await Promise.all([
    db.from('privacy_research_cases').select('id,source_session_id,assessment_id,form_fingerprint,scoring_version,permission_basis,eligible,expires_at').order('created_at', { ascending: false }).limit(500),
    db.from('privacy_norm_releases').select('id,version,instrument_key,sample_count,form_fingerprint,payload,risk_decision_ref,quality_decision_ref,reviewed_at').order('reviewed_at', { ascending: false }).limit(100),
  ])
  if (cases.error || releases.error) fail(cases.error ?? releases.error)
  return {
    cases: (cases.data ?? []).map(row => ({ id: String(row.id), sessionId: String(row.source_session_id), assessmentId: String(row.assessment_id), formFingerprint: String(row.form_fingerprint), scoringVersion: String(row.scoring_version), permissionBasis: String(row.permission_basis), eligible: Boolean(row.eligible), expiresAt: String(row.expires_at) })),
    releases: (releases.data ?? []).map(row => ({ id: String(row.id), version: String(row.version), instrumentKey: String(row.instrument_key), sampleCount: Number(row.sample_count), formFingerprint: String(row.form_fingerprint), payload: row.payload as unknown, reviewedAt: String(row.reviewed_at) })),
  }
}

export async function extractRestrictedResearchCase(input: { sessionId: string; permissionBasis: string; permissionRef: string }) {
  const scope = await requirePrivacyAdmin()
  const { buildRestrictedResearchCase,ResearchEligibilityError } = await import('@/lib/privacy/research')
  const sessionId = postgresUuid().parse(input.sessionId)
  const basis = z.enum(['participant_consent','customer_permission','related_expected_purpose']).parse(input.permissionBasis)
  const reference = z.string().regex(/^[a-zA-Z0-9_.:-]{1,120}$/).parse(input.permissionRef)
  const db = createAdminClient()
  const session = await db.from('participant_sessions').select('id,status,is_internal,assessment_id,campaign_id,campaign_participant_id,campaigns(is_internal)').eq('id', sessionId).single()
  if (session.error || !session.data || session.data.status !== 'completed' || session.data.is_internal) throw new PrivacyAdminError('Choose a completed non-internal session.')
  const campaign = (Array.isArray(session.data.campaigns) ? session.data.campaigns[0] : session.data.campaigns) as unknown as { is_internal: boolean }
  if (campaign?.is_internal || !session.data.campaign_participant_id) throw new PrivacyAdminError('This session is not eligible for research.')
  const participantId = String(session.data.campaign_participant_id), campaignId = String(session.data.campaign_id)
  const [participant, setting, receipt, forms, responses, flags, quality] = await Promise.all([
    db.from('campaign_participants').select('id,person_key').eq('id', participantId).eq('campaign_id', campaignId).is('deleted_at', null).is('privacy_pending_at', null).single(),
    db.from('campaign_privacy_settings').select('retention_policy_id,closed_at,privacy_retention_policies(status,research_allowed,retention_months)').eq('campaign_id', campaignId).single(),
    db.from('participant_privacy_receipts').select('accepted').eq('participant_id', participantId).eq('purpose', 'norm_research').order('recorded_at', { ascending: false }).limit(1),
    db.from('participant_section_forms').select('entries').eq('session_id', sessionId),
    db.from('participant_responses').select('item_id,response_value').eq('session_id', sessionId),
    db.from('participant_session_flags').select('id').eq('session_id', sessionId).limit(1),
    db.from('session_quality_flags').select('id').eq('session_id', sessionId).limit(1),
  ])
  const results = [participant,setting,receipt,forms,responses,flags,quality]
  if (results.some(result => result.error)) fail(results.find(result => result.error)?.error)
  const policy = (Array.isArray(setting.data?.privacy_retention_policies) ? setting.data.privacy_retention_policies[0] : setting.data?.privacy_retention_policies) as unknown as { status: string; research_allowed: boolean; retention_months: number } | undefined
  if (!participant.data || !policy || policy.status !== 'active' || !policy.research_allowed) throw new PrivacyAdminError('An approved research purpose and retention policy are required.')
  if (receipt.data?.[0]?.accepted === false || basis === 'participant_consent' && receipt.data?.[0]?.accepted !== true) throw new PrivacyAdminError('Research permission is absent or withdrawn.')
  if (flags.data?.length || quality.data?.length) throw new PrivacyAdminError('Quality-flagged sessions need independent review.')
  const holds = await db.from('privacy_legal_holds').select('participant_id').eq('campaign_id', campaignId).is('released_at', null)
  if (holds.error) fail(holds.error)
  if (holds.data?.some(hold => hold.participant_id === null || hold.participant_id === participantId)) throw new PrivacyAdminError('The session is on hold.')
  let prepared:ReturnType<typeof buildRestrictedResearchCase>
  try{prepared=buildRestrictedResearchCase((forms.data ?? []).flatMap(form => form.entries as unknown[]), (responses.data ?? []).map(row => ({ item_id: String(row.item_id), response_value: Number(row.response_value) })))}
  catch(error){if(error instanceof ResearchEligibilityError)throw new PrivacyAdminError(error.message);fail(error)}
  let expiry = new Date(Date.now() + 90 * 86400000)
  if (setting.data?.closed_at) {
    const sourceExpiry = new Date(setting.data.closed_at); sourceExpiry.setUTCMonth(sourceExpiry.getUTCMonth() + policy.retention_months)
    if (sourceExpiry < expiry) expiry = sourceExpiry
  }
  if (expiry.getTime() <= Date.now()) throw new PrivacyAdminError('The source retention period has expired.')
  const inserted = await db.from('privacy_research_cases').insert({
    source_participant_id: participantId, source_session_id: sessionId, source_person_key: participant.data.person_key,
    assessment_id: session.data.assessment_id, form_fingerprint: prepared.formFingerprint, scoring_version: prepared.scoringVersion,
    permission_basis: basis, permission_ref: reference, decided_by: scope.actor!.id,
    responses: prepared.responses, scores: prepared.scores, eligible: true, expires_at: expiry.toISOString(),
  })
  if (inserted.error) fail(inserted.error)
}

export async function publishReviewedNorm(input: { caseIds: string[]; version: string; instrumentKey: string; riskRef: string; qualityRef: string; confirmation: string }) {
  const scope = await requirePrivacyAdmin()
  z.literal('APPROVE_AGGREGATE_RELEASE').parse(input.confirmation)
  const ids = z.array(postgresUuid()).min(20).max(5000).parse(input.caseIds)
  if (new Set(ids).size !== ids.length) throw new PrivacyAdminError('Choose distinct research cases.')
  const { error } = await createAdminClient().rpc('privacy_publish_norm', {
    p_cases: ids, p_version: z.string().min(1).max(80).parse(input.version),
    p_instrument: z.string().regex(/^[a-zA-Z0-9_.-]{1,80}$/).parse(input.instrumentKey),
    p_risk_ref: z.string().regex(/^[a-zA-Z0-9_.:-]{1,120}$/).parse(input.riskRef),
    p_quality_ref: z.string().regex(/^[a-zA-Z0-9_.:-]{1,120}$/).parse(input.qualityRef), p_actor: scope.actor!.id,
  })
  if (error) fail(error)
}

export async function updatePrivacyNoticeDraft(noticeId: string, input: unknown) {
  await requirePrivacyAdmin()
  const { privacyNoticeInput } = await import('@/lib/privacy/inputs')
  const value = privacyNoticeInput.parse(input)
  const { data, error } = await createAdminClient().from('privacy_notice_versions').update({
    version: value.version, audience: value.audience, title: value.title, body: value.body,
    acknowledgement_label: value.acknowledgementLabel, research_label: value.researchLabel,
    research_choice_enabled: value.researchChoiceEnabled,
  }).eq('id', postgresUuid().parse(noticeId)).eq('status', 'draft').select('id')
  if (error || !data?.length) fail(error)
  return String(data[0].id)
}

export class PrivacyAdminError extends Error {}

export async function getParticipantResearchSessions(participantId: string) {
  const scope = await requirePrivacyAdmin()
  const campaignIds = await getAccessibleCampaignIds(scope)
  if (campaignIds !== null && !campaignIds.length) return []
  let query = createAdminClient().from('participant_sessions')
    .select('id,completed_at,assessments(title)').eq('campaign_participant_id', postgresUuid().parse(participantId))
    .eq('status','completed').eq('is_internal',false).order('completed_at',{ascending:false}).limit(100)
  if (campaignIds !== null) query = query.in('campaign_id',campaignIds)
  const {data,error} = await query
  if (error) fail(error)
  return (data??[]).map(row=>{
    const assessment=(Array.isArray(row.assessments)?row.assessments[0]:row.assessments) as unknown as {title:string}|null
    return {id:String(row.id),title:assessment?.title??'Assessment',completedAt:String(row.completed_at)}
  })
}

export async function restrictParticipantResearch(participantId:string) {
  await requirePrivacyAdmin()
  const {error}=await createAdminClient().rpc('privacy_restrict_research',{p_participant:postgresUuid().parse(participantId)})
  if(error)fail(error)
}
