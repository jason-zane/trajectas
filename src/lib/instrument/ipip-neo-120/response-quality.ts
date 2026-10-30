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
/** New administrations use the native accuracy scale, interleaved after these
 * canonical positions. v1 wording/anchors remain available for frozen attempts. */
export const INTEGRATED_QUALITY_MODULE_VERSION = 'trajectas-response-quality-v2' as const
export const INTEGRATED_QUALITY_ANCHORS = ['Very Inaccurate', 'Moderately Inaccurate', 'Neither Inaccurate nor Accurate', 'Moderately Accurate', 'Very Accurate'] as const
export const INTEGRATED_QUALITY_QUESTIONS = QUALITY_QUESTIONS.map((question, index) => ({
  ...question,
  stem: question.id === 'attention_agree' ? 'For this statement, please select Very Accurate.'
    : question.id === 'attention_disagree' ? 'For this statement, please select Very Inaccurate.' : question.stem,
  afterItem: [12, 27, 42, 57, 72, 87, 102, 117][index],
}))
export type QualityModuleVersion = typeof QUALITY_MODULE_VERSION | typeof INTEGRATED_QUALITY_MODULE_VERSION
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
  moduleVersion: QualityModuleVersion | null
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
  version: QualityModuleVersion
  questions: readonly { id: string; stem: string; afterItem?: number }[]
  answers: Record<string, number>
  revision: number
}
