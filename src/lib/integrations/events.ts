import { createAdminClient } from '@/lib/supabase/admin'

export const INTEGRATION_EVENT_TYPES = [
  'integration.launch.created',
  'integration.assessment.completed',
  'integration.report.ready',
  'integration.report.released',
] as const

export type IntegrationEventType = (typeof INTEGRATION_EVENT_TYPES)[number]

export async function enqueueIntegrationEvent(input: {
  clientId: string
  eventType: IntegrationEventType
  aggregateType: string
  aggregateId: string
  payload: Record<string, unknown>
}) {
  const db = createAdminClient()
  const { error } = await db.from('integration_events_outbox').insert({
    client_id: input.clientId,
    event_type: input.eventType,
    aggregate_type: input.aggregateType,
    aggregate_id: input.aggregateId,
    payload: input.payload,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function enqueueAssessmentCompletedEvent(input: {
  sessionId: string
  campaignId: string
  participantId: string
  assessmentId: string
  allRequiredAssessmentsCompleted: boolean
  completedAt: string
}) {
  const db = createAdminClient()
  const { data: campaign, error } = await db
    .from('campaigns')
    .select('client_id')
    .eq('id', input.campaignId)
    .single()

  if (error || !campaign?.client_id) {
    throw new Error(error?.message ?? 'Campaign client could not be resolved.')
  }

  await enqueueIntegrationEvent({
    clientId: String(campaign.client_id),
    eventType: 'integration.assessment.completed',
    aggregateType: 'participant_session',
    aggregateId: input.sessionId,
    payload: {
      sessionId: input.sessionId,
      campaignId: input.campaignId,
      participantId: input.participantId,
      assessmentId: input.assessmentId,
      allRequiredAssessmentsCompleted: input.allRequiredAssessmentsCompleted,
      completedAt: input.completedAt,
    },
  })
}

export async function enqueueReportSnapshotEvent(input: {
  snapshotId: string
  campaignId: string
  participantSessionId: string
  audienceType: string
  status: 'ready' | 'released'
  generatedAt: string
  releasedAt?: string | null
}) {
  const db = createAdminClient()
  const [{ data: campaign, error: campaignError }, { data: session, error: sessionError }] =
    await Promise.all([
      db.from('campaigns').select('client_id').eq('id', input.campaignId).single(),
      db
        .from('participant_sessions')
        .select('campaign_participant_id, assessment_id')
        .eq('id', input.participantSessionId)
        .single(),
    ])

  if (campaignError || !campaign?.client_id) {
    throw new Error(campaignError?.message ?? 'Campaign client could not be resolved.')
  }

  if (sessionError || !session?.campaign_participant_id) {
    throw new Error(sessionError?.message ?? 'Participant session could not be resolved.')
  }

  await enqueueIntegrationEvent({
    clientId: String(campaign.client_id),
    eventType:
      input.status === 'released'
        ? 'integration.report.released'
        : 'integration.report.ready',
    aggregateType: 'report_snapshot',
    aggregateId: input.snapshotId,
    payload: {
      snapshotId: input.snapshotId,
      campaignId: input.campaignId,
      participantId: String(session.campaign_participant_id),
      participantSessionId: input.participantSessionId,
      assessmentId: String(session.assessment_id),
      audienceType: input.audienceType,
      status: input.status,
      generatedAt: input.generatedAt,
      releasedAt: input.releasedAt ?? null,
    },
  })
}
