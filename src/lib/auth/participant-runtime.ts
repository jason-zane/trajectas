import { createAdminClient } from '@/lib/supabase/admin'

export class ParticipantRuntimeAccessError extends Error {
  constructor(message = 'You do not have access to this assessment session.') {
    super(message)
    this.name = 'ParticipantRuntimeAccessError'
  }
}

export type ParticipantRuntimeAccess = {
  participantId: string
  campaignId: string
}

export type ParticipantRuntimeSessionAccess = ParticipantRuntimeAccess & {
  sessionId: string
  assessmentId: string
}

export async function requireParticipantRuntimeAccess(
  token: string
): Promise<ParticipantRuntimeAccess> {
  if (!token.trim()) {
    throw new ParticipantRuntimeAccessError('An assessment access token is required.')
  }

  const db = createAdminClient()
  const { data: participant, error: participantError } = await db
    .from('campaign_participants')
    .select('id, campaign_id, status')
    .eq('access_token', token)
    .single()

  if (participantError || !participant) {
    throw new ParticipantRuntimeAccessError('Invalid or expired access link.')
  }

  const { data: campaign, error: campaignError } = await db
    .from('campaigns')
    .select('id, status, opens_at, closes_at, deleted_at')
    .eq('id', participant.campaign_id)
    .single()

  if (campaignError || !campaign || campaign.deleted_at) {
    throw new ParticipantRuntimeAccessError('Campaign not found or unavailable.')
  }

  if (!['active', 'paused'].includes(campaign.status)) {
    throw new ParticipantRuntimeAccessError(
      'This campaign is not currently accepting responses.'
    )
  }

  const now = new Date()
  if (campaign.opens_at && new Date(campaign.opens_at) > now) {
    throw new ParticipantRuntimeAccessError('This campaign has not opened yet.')
  }

  if (campaign.closes_at && new Date(campaign.closes_at) < now) {
    throw new ParticipantRuntimeAccessError('This campaign has closed.')
  }

  if (['withdrawn', 'expired'].includes(participant.status)) {
    throw new ParticipantRuntimeAccessError(
      'Your access to this campaign has been revoked.'
    )
  }

  return {
    participantId: String(participant.id),
    campaignId: String(participant.campaign_id),
  }
}

export async function requireParticipantRuntimeParticipantAccess(
  token: string,
  participantId: string
) {
  const access = await requireParticipantRuntimeAccess(token)

  if (access.participantId !== participantId) {
    throw new ParticipantRuntimeAccessError(
      'This participant record does not match the active access token.'
    )
  }

  return access
}

export async function requireParticipantRuntimeCampaignAssessmentAccess(input: {
  token: string
  participantId: string
  campaignId: string
  assessmentId: string
}) {
  const access = await requireParticipantRuntimeParticipantAccess(
    input.token,
    input.participantId
  )

  if (access.campaignId !== input.campaignId) {
    throw new ParticipantRuntimeAccessError(
      'This assessment does not belong to the active campaign.'
    )
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('campaign_assessments')
    .select('id')
    .eq('campaign_id', input.campaignId)
    .eq('assessment_id', input.assessmentId)
    .single()

  if (error || !data) {
    throw new ParticipantRuntimeAccessError(
      'This assessment is not available in the active campaign.'
    )
  }

  return access
}

export async function requireParticipantRuntimeSessionAccess(
  token: string,
  sessionId: string
): Promise<ParticipantRuntimeSessionAccess> {
  const access = await requireParticipantRuntimeAccess(token)
  const db = createAdminClient()
  const { data: session, error } = await db
    .from('participant_sessions')
    .select('id, campaign_id, campaign_participant_id, assessment_id')
    .eq('id', sessionId)
    .single()

  if (error || !session) {
    throw new ParticipantRuntimeAccessError('Assessment session not found.')
  }

  if (
    String(session.campaign_participant_id) !== access.participantId ||
    String(session.campaign_id) !== access.campaignId
  ) {
    throw new ParticipantRuntimeAccessError(
      'This assessment session does not belong to the active access token.'
    )
  }

  return {
    ...access,
    sessionId: String(session.id),
    assessmentId: String(session.assessment_id),
  }
}
