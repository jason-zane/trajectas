import { describe, expect, it } from 'vitest'
import {
  canPromoteParticipantToCompleted,
  canPromoteParticipantToStarted,
} from '@/lib/assess/participant-status'
import type { CampaignParticipantStatus } from '@/types/database'

const statuses: CampaignParticipantStatus[] = [
  'invited',
  'registered',
  'in_progress',
  'completed',
  'withdrawn',
  'expired',
]

describe('participant status transitions', () => {
  it('allows public-link registrations to move into the started state', () => {
    const startable = statuses.filter(canPromoteParticipantToStarted)

    expect(startable).toEqual(['invited', 'registered'])
  })

  it('allows completed sessions to repair or finish active participant rows only', () => {
    const completable = statuses.filter(canPromoteParticipantToCompleted)

    expect(completable).toEqual(['invited', 'registered', 'in_progress'])
  })
})
