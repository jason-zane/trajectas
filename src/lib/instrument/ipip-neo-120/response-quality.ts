/** Supplemental administration protocol; never part of the IPIP item set or totals. */
export const QUALITY_MODULE_VERSION = 'trajectas-response-quality-v1'
export const QUALITY_POLICY_VERSION = 'trajectas-response-quality-pilot-v1'
export const QUALITY_QUESTIONS = [
  { id: 'attention_agree', stem: 'For this statement, please select Agree.' },
  { id: 'presentation_lie', stem: 'I have never told a lie, even a small one.' },
  { id: 'infrequency_sleep', stem: 'I have never needed sleep at any point in my life.' },
  { id: 'presentation_commitment', stem: 'I always follow through on every commitment I make, no matter how minor.' },
  { id: 'presentation_jealousy', stem: 'I have never felt jealous of a colleague’s success.' },
  { id: 'infrequency_languages', stem: 'I can read and understand every language ever written.' },
  { id: 'presentation_feedback', stem: 'I never find it difficult to accept feedback from others.' },
  { id: 'attention_disagree', stem: 'For this statement, please select Strongly disagree.' },
] as const
export const QUALITY_ANCHORS = ['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree'] as const
export type QualityQuestionId = typeof QUALITY_QUESTIONS[number]['id']
export type QualityStatus = 'no_concerns_detected' | 'review_recommended' | 'insufficient_information'
export const QUALITY_STATUS_LABELS: Record<QualityStatus, string> = {
  no_concerns_detected: 'No concerns detected',
  review_recommended: 'Review recommended',
  insufficient_information: 'Insufficient information',
}
export interface QualityIndicator {
  id: 'attention' | 'infrequency' | 'presentation' | 'repetition' | 'timing'
  label: string
  status: 'clear' | 'flagged' | 'unavailable'
  detail: string
  observed: number | null
  denominator: number
}
export interface ResponseQualityResult {
  policyVersion: typeof QUALITY_POLICY_VERSION
  moduleVersion: typeof QUALITY_MODULE_VERSION | null
  status: QualityStatus
  provisional: true
  indicators: QualityIndicator[]
}
export type QualityReviewDecision = 'accepted' | 'follow_up' | 'reassessment'
export const QUALITY_REVIEW_LABELS: Record<QualityReviewDecision, string> = {
  accepted: 'Reviewed — usable with context',
  follow_up: 'Follow-up needed',
  reassessment: 'Reassessment recommended',
}
export interface QualityReview {
  id: string
  decision: QualityReviewDecision
  notes: string
  reviewerId: string | null
  createdAt: string
}
export interface ResponseQualityDetail {
  id: string
  computedAt: string
  result: ResponseQualityResult
  reviews: QualityReview[]
  canReview: boolean
}
export interface QualityModuleForRunner {
  version: typeof QUALITY_MODULE_VERSION
  questions: readonly { id: string; stem: string }[]
  answers: Record<string, number>
  revision: number
}
