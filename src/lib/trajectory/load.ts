import { getPersonTrajectory } from '@/app/actions/trajectory-data'
import type { TrajectoryResult } from './types'

/**
 * Default-level trajectory loader used by the participant detail pages
 * across all three tenant trees. Returns an empty result on error so
 * the detail page renders even if trajectory loading fails — the
 * Trajectory tab itself shows an empty state in that case.
 */
export async function loadTrajectoryForParticipant(
  participantId: string,
  context: string,
): Promise<TrajectoryResult> {
  try {
    return await getPersonTrajectory(participantId, { level: 'dimension' })
  } catch (error) {
    console.error(`[${context}] Failed to load trajectory:`, error)
    return emptyTrajectoryResult()
  }
}

export function emptyTrajectoryResult(): TrajectoryResult {
  return {
    personKey: '',
    clientId: '',
    displayName: '',
    primaryEmail: '',
    level: 'dimension',
    linkedParticipants: [],
    assessmentsTouched: [],
    series: [],
  }
}
