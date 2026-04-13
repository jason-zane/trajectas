import type { ParticipantSessionProcessingStatus } from '@/types/database'

export type SubmitSessionSuccessOutcome =
  | 'ready'
  | 'report_pending'
  | 'completed_no_report'

export type SubmitSessionErrorCode =
  | 'invalid_access'
  | 'submit_failed'
  | 'scoring_failed'
  | 'report_failed'

export type SubmitSessionResult =
  | {
      ok: true
      sessionId: string
      outcome: SubmitSessionSuccessOutcome
      processingStatus: ParticipantSessionProcessingStatus
    }
  | {
      ok: false
      error: SubmitSessionErrorCode
      message: string
    }

export function isSessionProcessingActive(
  status: ParticipantSessionProcessingStatus | null | undefined,
): boolean {
  return status === 'scoring' || status === 'reporting'
}

export function getSessionProcessingStatusLabel(
  status: ParticipantSessionProcessingStatus | null | undefined,
): string {
  switch (status) {
    case 'scoring':
      return 'Scoring answers'
    case 'scored':
      return 'Scores calculated'
    case 'reporting':
      return 'Preparing report'
    case 'ready':
      return 'Ready'
    case 'failed':
      return 'Needs attention'
    case 'idle':
    default:
      return 'Waiting'
  }
}
