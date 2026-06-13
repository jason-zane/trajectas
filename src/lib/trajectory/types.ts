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
  /** Stored measurement-error band for the score; null for rollups and legacy scores. */
  ciLower: number | null
  ciUpper: number | null

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
  /** Primary parent id (dimension for factor entities, factor for construct entities). Null for orphans. */
  parentId: string | null
  parentName: string | null
  /**
   * Additional parent ids. Populated for constructs that map to multiple
   * factors (factor_constructs is many-to-many). Drill filters should
   * include this series under any factor that appears here, in addition
   * to the primary parentId.
   */
  additionalParentIds: string[]
  points: TrajectoryPoint[]
  /** Consecutive pairwise deltas, plus first-to-latest as the last item. */
  deltas: TrajectoryDelta[]
}

export type TrajectoryAssessmentRef = {
  assessmentId: string
  assessmentName: string
  sessionCount: number
}

export type TrajectoryMover = {
  entityId: string
  entityName: string
  /** Earliest observed scaled score for this entity. */
  firstScaled: number | null
  /** Latest observed scaled score for this entity. */
  latestScaled: number | null
  /** latest - first, when both are present. */
  deltaScaled: number | null
  /** Count of points used (≥2 to qualify as a mover). */
  pointCount: number
}

/**
 * Editorial summary computed from a fully-assembled trajectory at the
 * dimension level. Drives the "what changed" panel above the hero chart
 * and is the source-of-truth for the future personal trajectory report's
 * lede.
 */
export type TrajectorySummary = {
  sessionCount: number
  assessmentCount: number
  earliestCompletedAt: string | null
  latestCompletedAt: string | null
  /** Dimensions with the largest |Δ| from first to latest, sorted desc. */
  topMovers: TrajectoryMover[]
  /** Dimensions whose movement stayed within the noise floor, sorted by name. */
  stable: TrajectoryMover[]
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
  /** Editorial summary at the dimension level. Always present; fields may be empty for snapshot or empty trajectories. */
  summary: TrajectorySummary
}
