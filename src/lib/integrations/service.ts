import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/auth/support-sessions'
import { enqueueIntegrationEvent } from '@/lib/integrations/events'
import { IntegrationApiError } from '@/lib/integrations/errors'
import type {
  IntegrationAuthContext,
  IntegrationExternalRefInput,
  IntegrationLaunchRecord,
} from '@/lib/integrations/types'
import { buildSurfaceUrl, getConfiguredSurfaceUrl } from '@/lib/hosts'
import { mapCampaignAssessmentRow, mapCampaignParticipantRow, mapCampaignRow, mapReportSnapshotRow } from '@/lib/supabase/mappers'

async function getClientPartnerId(clientId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('clients')
    .select('partner_id')
    .eq('id', clientId)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    throw new IntegrationApiError(404, 'client_not_found', 'The integration client could not be found.')
  }

  return data.partner_id ? String(data.partner_id) : null
}

function assessmentUrlFromToken(token: string) {
  const surfaceUrl = buildSurfaceUrl('assess', `/assess/${token}`)
  if (surfaceUrl) return surfaceUrl.toString()

  const fallbackBase = getConfiguredSurfaceUrl('public') ?? process.env.NEXT_PUBLIC_APP_URL
  if (!fallbackBase) {
    throw new IntegrationApiError(
      500,
      'assess_surface_not_configured',
      'Assessment surface URL is not configured.'
    )
  }

  return new URL(`/assess/${token}`, fallbackBase).toString()
}

function reportViewerUrl(input: {
  audienceType: string
  snapshotId: string
  participantAccessToken: string
  releasedAt?: string
}) {
  if (input.audienceType === 'participant') {
    const participantUrl = buildSurfaceUrl(
      'assess',
      `/assess/${input.participantAccessToken}/report/${input.snapshotId}`
    )
    return participantUrl?.toString() ?? null
  }

  if (input.audienceType === 'hr_manager' && input.releasedAt) {
    const clientUrl = buildSurfaceUrl('client', `/reports/${input.snapshotId}`)
    return clientUrl?.toString() ?? null
  }

  const adminUrl = buildSurfaceUrl('admin', `/reports/${input.snapshotId}`)
  return adminUrl?.toString() ?? null
}

async function ensureCampaignOwnedByCredential(context: IntegrationAuthContext, campaignId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('client_id', context.clientId)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    throw new IntegrationApiError(404, 'campaign_not_found', 'Campaign not found.')
  }

  return mapCampaignRow(data)
}

async function ensureParticipantOwnedByCredential(
  context: IntegrationAuthContext,
  participantId: string
) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('campaign_participants')
    .select(`
      *,
      campaigns!inner(id, client_id, title, slug)
    `)
    .eq('id', participantId)
    .eq('campaigns.client_id', context.clientId)
    .single()

  if (error || !data) {
    throw new IntegrationApiError(404, 'participant_not_found', 'Participant not found.')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any
  return {
    participant: mapCampaignParticipantRow(row),
    campaignId: String(row.campaigns.id),
    campaignTitle: String(row.campaigns.title),
    campaignSlug: String(row.campaigns.slug),
  }
}

async function ensureAssessmentsAssignedToClient(clientId: string, assessmentIds: string[]) {
  if (assessmentIds.length === 0) {
    return
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('client_assessment_assignments')
    .select('assessment_id')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .in('assessment_id', assessmentIds)

  if (error) {
    throw new Error(error.message)
  }

  const allowed = new Set((data ?? []).map((row) => row.assessment_id))
  const missing = assessmentIds.filter((id) => !allowed.has(id))
  if (missing.length > 0) {
    throw new IntegrationApiError(
      422,
      'assessment_not_available',
      'One or more assessments are not assigned to this client.'
    )
  }
}

async function upsertExternalRefs(input: {
  context: IntegrationAuthContext
  campaignId?: string
  localTable: string
  localId: string
  refs?: IntegrationExternalRefInput[]
}) {
  if (!input.refs?.length) {
    return
  }

  const db = createAdminClient()
  for (const ref of input.refs) {
    let query = db
      .from('integration_external_refs')
      .select('id')
      .eq('integration_connection_id', input.context.connectionId)
      .eq('source_system', ref.sourceSystem)
      .eq('remote_object_type', ref.remoteObjectType)
      .eq('remote_id', ref.remoteId)
      .eq('local_table', input.localTable)
      .eq('local_id', input.localId)

    query =
      input.campaignId == null
        ? query.is('campaign_id', null)
        : query.eq('campaign_id', input.campaignId)

    const { data: existing, error: existingError } = await query.maybeSingle()
    if (existingError) {
      throw new Error(existingError.message)
    }

    const payload = {
      integration_connection_id: input.context.connectionId,
      client_id: input.context.clientId,
      campaign_id: input.campaignId ?? null,
      local_table: input.localTable,
      local_id: input.localId,
      source_system: ref.sourceSystem,
      remote_object_type: ref.remoteObjectType,
      remote_id: ref.remoteId,
      secondary_remote_id: ref.secondaryRemoteId ?? null,
      metadata: ref.metadata ?? {},
    }

    if (existing?.id) {
      const { error: updateError } = await db
        .from('integration_external_refs')
        .update({
          secondary_remote_id: payload.secondary_remote_id,
          metadata: payload.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      continue
    }

    const { error: insertError } = await db.from('integration_external_refs').insert(payload)
    if (insertError) {
      throw new Error(insertError.message)
    }
  }
}

async function findParticipantByExternalRefs(input: {
  context: IntegrationAuthContext
  campaignId: string
  refs?: IntegrationExternalRefInput[]
}) {
  if (!input.refs?.length) {
    return null
  }

  const db = createAdminClient()

  for (const ref of input.refs) {
    const { data, error } = await db
      .from('integration_external_refs')
      .select('local_id, local_table')
      .eq('integration_connection_id', input.context.connectionId)
      .eq('campaign_id', input.campaignId)
      .eq('source_system', ref.sourceSystem)
      .eq('remote_object_type', ref.remoteObjectType)
      .eq('remote_id', ref.remoteId)
      .eq('local_table', 'campaign_participants')
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    if (data?.local_id) {
      return String(data.local_id)
    }
  }

  return null
}

async function sendIntegrationInviteEmail(input: {
  participantId: string
  campaignId: string
  email: string
  firstName?: string
  campaignTitle: string
  campaignDescription?: string
  clientId: string
  partnerId?: string
  assessmentUrl: string
}) {
  const { sendEmail } = await import('@/lib/email/send')

  await sendEmail({
    type: 'assessment_invite',
    to: input.email,
    variables: {
      participantFirstName: input.firstName ?? '',
      campaignTitle: input.campaignTitle,
      campaignDescription: input.campaignDescription ?? '',
      assessmentUrl: input.assessmentUrl,
      brandName: 'Trajectas',
    },
    scopeCampaignId: input.campaignId,
    scopeClientId: input.clientId,
    scopePartnerId: input.partnerId,
  })

  const db = createAdminClient()
  await db
    .from('campaign_participants')
    .update({ invited_at: new Date().toISOString() })
    .eq('id', input.participantId)
}

export async function createIntegrationCampaign(
  context: IntegrationAuthContext,
  input: {
    title: string
    slug: string
    description?: string
    status: 'draft' | 'active' | 'paused' | 'closed' | 'archived'
    opensAt?: string
    closesAt?: string
    allowResume: boolean
    showProgress: boolean
    randomizeAssessmentOrder: boolean
    assessmentIds?: string[]
    reportConfig?: {
      participantTemplateId?: string | null
      hrManagerTemplateId?: string | null
      consultantTemplateId?: string | null
      brandMode?: 'platform' | 'client' | 'custom'
    }
    externalRefs?: IntegrationExternalRefInput[]
  }
) {
  const db = createAdminClient()
  const partnerId = await getClientPartnerId(context.clientId)
  const assessmentIds = input.assessmentIds ?? []

  await ensureAssessmentsAssignedToClient(context.clientId, assessmentIds)

  const { data: createdCampaign, error } = await db
    .from('campaigns')
    .insert({
      title: input.title,
      slug: input.slug,
      description: input.description ?? null,
      status: input.status,
      client_id: context.clientId,
      partner_id: partnerId,
      opens_at: input.opensAt || null,
      closes_at: input.closesAt || null,
      allow_resume: input.allowResume,
      show_progress: input.showProgress,
      randomize_assessment_order: input.randomizeAssessmentOrder,
    })
    .select('*')
    .single()

  if (error || !createdCampaign) {
    throw new IntegrationApiError(
      422,
      'campaign_create_failed',
      'Campaign could not be created.'
    )
  }

  const campaign = mapCampaignRow(createdCampaign)

  try {
    if (assessmentIds.length > 0) {
      const rows = assessmentIds.map((assessmentId, index) => ({
        campaign_id: campaign.id,
        assessment_id: assessmentId,
        display_order: index,
        is_required: true,
      }))
      const { error: assessmentsError } = await db.from('campaign_assessments').insert(rows)
      if (assessmentsError) {
        throw new Error(assessmentsError.message)
      }
    }

    if (input.reportConfig) {
      const { error: reportConfigError } = await db.from('campaign_report_config').upsert(
        {
          campaign_id: campaign.id,
          participant_template_id: input.reportConfig.participantTemplateId ?? null,
          hr_manager_template_id: input.reportConfig.hrManagerTemplateId ?? null,
          consultant_template_id: input.reportConfig.consultantTemplateId ?? null,
          brand_mode: input.reportConfig.brandMode ?? 'platform',
        },
        { onConflict: 'campaign_id' }
      )
      if (reportConfigError) {
        throw new Error(reportConfigError.message)
      }
    }

    await upsertExternalRefs({
      context,
      campaignId: campaign.id,
      localTable: 'campaigns',
      localId: campaign.id,
      refs: input.externalRefs,
    })
  } catch (err) {
    // Compensating delete — remove the orphaned campaign
    await db.from('campaigns').delete().eq('id', campaign.id)
    throw err
  }

  await logAuditEvent({
    actorProfileId: null,
    eventType: 'integration.campaign.created',
    targetTable: 'campaigns',
    targetId: campaign.id,
    clientId: context.clientId,
    metadata: {
      credentialId: context.credentialId,
      requestId: context.requestId,
    },
  })

  return getIntegrationCampaign(context, campaign.id)
}

export async function getIntegrationCampaign(
  context: IntegrationAuthContext,
  campaignId: string
) {
  const campaign = await ensureCampaignOwnedByCredential(context, campaignId)
  const db = createAdminClient()

  const [{ data: assessmentRows, error: assessmentsError }, { data: reportConfig, error: reportConfigError }] =
    await Promise.all([
      db
        .from('campaign_assessments')
        .select('*, assessments(title, status)')
        .eq('campaign_id', campaignId)
        .order('display_order', { ascending: true }),
      db
        .from('campaign_report_config')
        .select('*')
        .eq('campaign_id', campaignId)
        .maybeSingle(),
    ])

  if (assessmentsError) throw new Error(assessmentsError.message)
  if (reportConfigError) throw new Error(reportConfigError.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assessments = (assessmentRows ?? []).map((row: any) => ({
    ...mapCampaignAssessmentRow(row),
    assessmentTitle: row.assessments?.title ?? 'Untitled',
    assessmentStatus: row.assessments?.status ?? 'draft',
  }))

  return {
    campaign,
    assessments,
    reportConfig: reportConfig
      ? {
          participantTemplateId: reportConfig.participant_template_id ?? null,
          hrManagerTemplateId: reportConfig.hr_manager_template_id ?? null,
          consultantTemplateId: reportConfig.consultant_template_id ?? null,
          brandMode: reportConfig.brand_mode ?? 'platform',
        }
      : null,
  }
}

export async function upsertIntegrationParticipant(
  context: IntegrationAuthContext,
  campaignId: string,
  input: {
    email: string
    firstName?: string
    lastName?: string
    status?: 'invited' | 'registered' | 'in_progress' | 'completed' | 'withdrawn' | 'expired'
    externalRefs?: IntegrationExternalRefInput[]
  }
) {
  const campaign = await ensureCampaignOwnedByCredential(context, campaignId)
  const db = createAdminClient()

  const participantIdFromRefs = await findParticipantByExternalRefs({
    context,
    campaignId,
    refs: input.externalRefs,
  })

  let participantId = participantIdFromRefs

  if (!participantId) {
    const { data: existingByEmail, error: existingError } = await db
      .from('campaign_participants')
      .select(`
        id,
        campaigns!inner(client_id)
      `)
      .eq('campaign_id', campaignId)
      .eq('email', input.email.toLowerCase())
      .eq('campaigns.client_id', context.clientId)
      .maybeSingle()

    if (existingError) {
      throw new Error(existingError.message)
    }

    participantId = existingByEmail?.id ? String(existingByEmail.id) : null
  }

  if (participantId) {
    const { data: updated, error: updateError } = await db
      .from('campaign_participants')
      .update({
        email: input.email.toLowerCase(),
        first_name: input.firstName ?? null,
        last_name: input.lastName ?? null,
        ...(input.status ? { status: input.status } : {}),
      })
      .eq('id', participantId)
      .eq('campaign_id', campaignId)
      .select('*')
      .single()

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? 'Failed to update participant.')
    }

    await upsertExternalRefs({
      context,
      campaignId,
      localTable: 'campaign_participants',
      localId: participantId,
      refs: input.externalRefs,
    })

    return {
      participant: mapCampaignParticipantRow(updated),
      campaign,
      assessmentUrl: assessmentUrlFromToken(String(updated.access_token)),
      created: false,
    }
  }

  const { data: inserted, error: insertError } = await db
    .from('campaign_participants')
    .insert({
      campaign_id: campaignId,
      email: input.email.toLowerCase(),
      first_name: input.firstName ?? null,
      last_name: input.lastName ?? null,
      status: input.status ?? 'invited',
    })
    .select('*')
    .single()

  if (insertError || !inserted) {
    throw new IntegrationApiError(
      422,
      'participant_upsert_failed',
      'Participant could not be created.'
    )
  }

  await upsertExternalRefs({
    context,
    campaignId,
    localTable: 'campaign_participants',
    localId: String(inserted.id),
    refs: input.externalRefs,
  })

  await logAuditEvent({
    actorProfileId: null,
    eventType: 'integration.participant.upserted',
    targetTable: 'campaign_participants',
    targetId: String(inserted.id),
    clientId: context.clientId,
    metadata: {
      created: true,
      credentialId: context.credentialId,
      requestId: context.requestId,
      campaignId,
    },
  })

  return {
    participant: mapCampaignParticipantRow(inserted),
    campaign,
    assessmentUrl: assessmentUrlFromToken(String(inserted.access_token)),
    created: true,
  }
}

export async function createIntegrationLaunch(
  context: IntegrationAuthContext,
  campaignId: string,
  input: {
    participantId: string
    deliveryMethod: 'link' | 'email'
  }
) {
  const campaign = await ensureCampaignOwnedByCredential(context, campaignId)
  const db = createAdminClient()
  const { participant } = await ensureParticipantOwnedByCredential(context, input.participantId)

  if (participant.campaignId !== campaign.id) {
    throw new IntegrationApiError(
      422,
      'participant_campaign_mismatch',
      'Participant does not belong to the requested campaign.'
    )
  }

  const assessmentUrl = assessmentUrlFromToken(participant.accessToken)
  const { data, error } = await db
    .from('integration_launches')
    .insert({
      integration_connection_id: context.connectionId,
      integration_credential_id: context.credentialId,
      client_id: context.clientId,
      campaign_id: campaignId,
      campaign_participant_id: participant.id,
      delivery_method: input.deliveryMethod,
      status: 'created',
      assessment_url: assessmentUrl,
      metadata: {
        requestId: context.requestId,
      },
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new IntegrationApiError(422, 'launch_create_failed', 'Assessment launch could not be created.')
  }

  if (input.deliveryMethod === 'email') {
    try {
      await sendIntegrationInviteEmail({
        participantId: participant.id,
        campaignId: campaign.id,
        email: participant.email,
        firstName: participant.firstName,
        campaignTitle: campaign.title,
        campaignDescription: campaign.description,
        clientId: context.clientId,
        partnerId: campaign.partnerId,
        assessmentUrl,
      })

      await db
        .from('integration_launches')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', data.id)
    } catch (deliveryError) {
      await db
        .from('integration_launches')
        .update({
          status: 'delivery_failed',
          error_message:
            deliveryError instanceof Error
              ? deliveryError.message.slice(0, 500)
              : 'Email delivery failed',
        })
        .eq('id', data.id)
    }
  }

  const launch = await getIntegrationLaunch(context, String(data.id))

  await enqueueIntegrationEvent({
    clientId: context.clientId,
    eventType: 'integration.launch.created',
    aggregateType: 'launch',
    aggregateId: launch.id,
    payload: {
      launchId: launch.id,
      campaignId,
      participantId: participant.id,
      deliveryMethod: launch.deliveryMethod,
      status: launch.status,
      assessmentUrl: launch.assessmentUrl,
    },
  })

  await logAuditEvent({
    actorProfileId: null,
    eventType: 'integration.launch.created',
    targetTable: 'integration_launches',
    targetId: launch.id,
    clientId: context.clientId,
    metadata: {
      credentialId: context.credentialId,
      requestId: context.requestId,
      participantId: participant.id,
      campaignId,
      deliveryMethod: launch.deliveryMethod,
    },
  })

  return launch
}

export async function getIntegrationLaunch(
  context: IntegrationAuthContext,
  launchId: string
): Promise<IntegrationLaunchRecord> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('integration_launches')
    .select('*')
    .eq('id', launchId)
    .eq('client_id', context.clientId)
    .single()

  if (error || !data) {
    throw new IntegrationApiError(404, 'launch_not_found', 'Launch not found.')
  }

  return {
    id: String(data.id),
    clientId: String(data.client_id),
    campaignId: String(data.campaign_id),
    participantId: String(data.campaign_participant_id),
    deliveryMethod: data.delivery_method,
    status: data.status,
    assessmentUrl: String(data.assessment_url),
    launchedAt: String(data.launched_at),
    deliveredAt: data.delivered_at ?? undefined,
    errorMessage: data.error_message ?? undefined,
  }
}

export async function getIntegrationParticipantResultSummary(
  context: IntegrationAuthContext,
  participantId: string
) {
  const db = createAdminClient()
  const { participant, campaignId } = await ensureParticipantOwnedByCredential(context, participantId)

  const [{ data: sessionRows, error: sessionsError }, { count: assessmentCount, error: assessmentCountError }] =
    await Promise.all([
      db
        .from('participant_sessions')
        .select(`
          id,
          assessment_id,
          status,
          started_at,
          completed_at,
          assessments(title),
          participant_scores(
            factor_id,
            raw_score,
            scaled_score,
            percentile,
            scoring_method,
            factors(name)
          )
        `)
        .eq('campaign_participant_id', participantId)
        .order('created_at', { ascending: true }),
      db
        .from('campaign_assessments')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId),
    ])

  if (sessionsError) throw new Error(sessionsError.message)
  if (assessmentCountError) throw new Error(assessmentCountError.message)

  type ParticipantScoreRow = {
    factor_id: string
    raw_score: number
    scaled_score: number
    percentile?: number | null
    scoring_method: string
    factors?: {
      name?: string | null
    } | null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions = (sessionRows ?? []).map((row: any) => ({
    id: String(row.id),
    assessmentId: String(row.assessment_id),
    assessmentTitle: row.assessments?.title ?? 'Untitled',
    status: String(row.status),
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    scores: ((row.participant_scores ?? []) as ParticipantScoreRow[]).map((score) => ({
      factorId: String(score.factor_id),
      factorName: score.factors?.name ?? 'Unknown',
      rawScore: Number(score.raw_score),
      scaledScore: Number(score.scaled_score),
      percentile: score.percentile != null ? Number(score.percentile) : undefined,
      scoringMethod: String(score.scoring_method),
    })),
  }))

  const allScores = sessions.flatMap((session) => session.scores)
  const sortedScores = [...allScores].sort((a, b) => b.scaledScore - a.scaledScore)
  const highestFactors = sortedScores.slice(0, 3)
  const lowestFactors = [...sortedScores].reverse().slice(0, 3).reverse()

  const sessionIds = sessions.map((session) => session.id)
  const { data: latestReleasedSnapshot } =
    sessionIds.length === 0
      ? { data: null }
      : await db
          .from('report_snapshots')
          .select('id, audience_type, released_at')
          .in('participant_session_id', sessionIds)
          .eq('audience_type', 'hr_manager')
          .eq('status', 'released')
          .order('released_at', { ascending: false })
          .limit(1)
          .maybeSingle()

  await logAuditEvent({
    actorProfileId: null,
    eventType: 'integration.result_summary.read',
    targetTable: 'campaign_participants',
    targetId: participant.id,
    clientId: context.clientId,
    metadata: {
      credentialId: context.credentialId,
      requestId: context.requestId,
    },
  })

  return {
    participant,
    summary: {
      totalAssessments: assessmentCount ?? 0,
      completedAssessments: sessions.filter((session) => session.status === 'completed').length,
      highestFactors,
      lowestFactors,
      latestReleasedReportSnapshotId: latestReleasedSnapshot?.id ?? null,
    },
    sessions,
  }
}

export async function getIntegrationParticipantReports(
  context: IntegrationAuthContext,
  participantId: string
) {
  const db = createAdminClient()
  const { participant } = await ensureParticipantOwnedByCredential(context, participantId)

  const { data: sessions, error: sessionsError } = await db
    .from('participant_sessions')
    .select('id')
    .eq('campaign_participant_id', participantId)

  if (sessionsError) {
    throw new Error(sessionsError.message)
  }

  const sessionIds = (sessions ?? []).map((row) => row.id)
  if (sessionIds.length === 0) {
    return []
  }

  const { data: snapshotRows, error: snapshotError } = await db
    .from('report_snapshots')
    .select('*')
    .in('participant_session_id', sessionIds)
    .order('created_at', { ascending: false })
    .limit(50)

  if (snapshotError) {
    throw new Error(snapshotError.message)
  }

  const reports = (snapshotRows ?? []).map((row) => {
    const snapshot = mapReportSnapshotRow(row)
    return {
      ...snapshot,
      viewerUrl: reportViewerUrl({
        audienceType: snapshot.audienceType,
        snapshotId: snapshot.id,
        participantAccessToken: participant.accessToken,
        releasedAt: snapshot.releasedAt,
      }),
    }
  })

  await logAuditEvent({
    actorProfileId: null,
    eventType: 'integration.report.read',
    targetTable: 'campaign_participants',
    targetId: participant.id,
    clientId: context.clientId,
    metadata: {
      credentialId: context.credentialId,
      requestId: context.requestId,
      snapshotCount: reports.length,
    },
  })

  return reports
}
