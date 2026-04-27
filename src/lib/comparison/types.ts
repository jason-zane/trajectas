export type ColumnLevel = 'dimension' | 'factor' | 'construct'

export const ALL_LEVELS: readonly ColumnLevel[] = ['dimension', 'factor', 'construct'] as const

export type EntryRequest = {
  campaignParticipantId: string
  sessionIdsByAssessment?: Record<string, string>
}

export type ComparisonRequest = {
  entries: EntryRequest[]
  assessmentIds: string[]
  /** Which column levels are visible. Defaults to all three when not provided. */
  visibleLevels?: ColumnLevel[]
}

export type Column = {
  id: string
  name: string
  level: ColumnLevel
  parentId: string | null
}

export type ColumnGroup = {
  assessmentId: string
  assessmentName: string
  rollup: Column
  children: Column[]
}

export type RowAssessment = {
  assessmentId: string
  sessionId: string | null
  sessionStartedAt: string | null
  sessionStatus: string | null
  attemptNumber: number | null
  cells: Record<string, number | null>
}

export type ComparisonRow = {
  entryId: string
  campaignParticipantId: string
  participantName: string
  participantEmail: string
  perAssessment: RowAssessment[]
}

export type ComparisonResult = {
  columns: ColumnGroup[]
  rows: ComparisonRow[]
}

export type ChildScore = { childId: string; score: number | null; weight: number }
