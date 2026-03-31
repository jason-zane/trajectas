import { createAdminClient } from '@/lib/supabase/admin'
import {
  getCampaignAccessError,
  getParticipantAccessError,
} from '@/lib/assess/access'

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

  if (campaignError || !campaign) {
    throw new ParticipantRuntimeAccessError('Campaign not found or unavailable.')
  }

  const campaignAccessError = getCampaignAccessError({
    status: campaign.status,
    opensAt: campaign.opens_at,
    closesAt: campaign.closes_at,
    deletedAt: campaign.deleted_at,
  })
  if (campaignAccessError) {
    throw new ParticipantRuntimeAccessError(campaignAccessError)
  }

  const participantAccessError = getParticipantAccessError(participant.status)
  if (participantAccessError) {
    throw new ParticipantRuntimeAccessError(participantAccessError)
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
