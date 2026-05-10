import type { CampaignParticipantStatus } from '@/types/database'

export const PARTICIPANT_STARTABLE_STATUSES = [
  'invited',
  'registered',
] as const satisfies readonly CampaignParticipantStatus[]

export const PARTICIPANT_COMPLETABLE_STATUSES = [
  'invited',
  'registered',
  'in_progress',
] as const satisfies readonly CampaignParticipantStatus[]

export function canPromoteParticipantToStarted(
  status: CampaignParticipantStatus,
) {
  return PARTICIPANT_STARTABLE_STATUSES.includes(
    status as (typeof PARTICIPANT_STARTABLE_STATUSES)[number],
  )
}

export function canPromoteParticipantToCompleted(
  status: CampaignParticipantStatus,
) {
  return PARTICIPANT_COMPLETABLE_STATUSES.includes(
    status as (typeof PARTICIPANT_COMPLETABLE_STATUSES)[number],
  )
}
