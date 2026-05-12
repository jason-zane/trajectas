export type TrajectoryLevel = 'dimension' | 'factor' | 'construct'

export const TRAJECTORY_LEVELS: readonly TrajectoryLevel[] = [
  'dimension',
  'factor',
  'construct',
] as const

export type TrajectoryPoint = {
  sessionId: string
  campaignId: string
  campaignTitle: string
  assessmentId: string
  assessmentName: string
  completedAt: string
  attemptNumber: number
  scaledScore: number | null
  rawScore: number | null
  percentile: number | null

  // Reserved for the future norms / reliability layer (see spec out-of-scope).
  // Populated as null today; UI must tolerate.
  reliability: number | null
  normGroupId: string | null
  normGroupName: string | null
}

export type TrajectoryDelta = {
  fromSessionId: string
  toSessionId: string
  fromCompletedAt: string
  toCompletedAt: string
  daysBetween: number
  deltaScaled: number | null
  /** Absolute Δ as a fraction of the from-score, or null when not computable. */
  deltaScaledFraction: number | null
}

export type TrajectorySeries = {
  entityId: string
  entityName: string
  level: TrajectoryLevel
  /** Parent dimension/factor id, when known. Null for orphans. */
  parentId: string | null
  parentName: string | null
  points: TrajectoryPoint[]
  /** Consecutive pairwise deltas, plus first-to-latest as the last item. */
  deltas: TrajectoryDelta[]
}

export type TrajectoryAssessmentRef = {
  assessmentId: string
  assessmentName: string
  sessionCount: number
}

export type TrajectoryLinkedParticipant = {
  campaignParticipantId: string
  campaignId: string
  campaignTitle: string
  email: string
  firstName: string | null
  lastName: string | null
  status: string
  completedSessionCount: number
  createdAt: string
}

export type TrajectoryResult = {
  personKey: string
  clientId: string
  displayName: string
  primaryEmail: string
  level: TrajectoryLevel
  linkedParticipants: TrajectoryLinkedParticipant[]
  assessmentsTouched: TrajectoryAssessmentRef[]
  series: TrajectorySeries[]
}
