// =============================================================================
// api.ts — Request / response types for the Talent Fit REST API
// =============================================================================

import type {
  AssessmentStatus,
  ParticipantSessionStatus,
  DiagnosticSessionStatus,
  ItemSelectionStrategy,
  ItemStatus,
  MatchingRunStatus,
  ResponseFormatType,
  ScoringMethod,
  UserRole,
} from './database'

// ---------------------------------------------------------------------------
// Generic wrappers
// ---------------------------------------------------------------------------

/** Pagination metadata returned alongside every list endpoint. */
export interface Pagination {
  /** Current page number (1-based). */
  page: number
  /** Number of records per page. */
  per_page: number
  /** Total number of records matching the query. */
  total: number
  /** Total number of pages. */
  total_pages: number
}

/**
 * Standard envelope for single-resource API responses.
 * If the request fails, `data` may be `null` and `error` will be populated.
 */
export interface ApiResponse<T> {
  data: T
  error?: string
}

/**
 * Standard envelope for list / collection API responses,
 * including pagination metadata.
 */
export interface ApiListResponse<T> {
  data: T[]
  pagination: Pagination
}

/**
 * Common query parameters accepted by every list endpoint.
 */
export interface ListQueryParams {
  /** Page number (1-based, default 1). */
  page?: number
  /** Records per page (default 25, max 100). */
  per_page?: number
  /** Column to sort by. */
  sort_by?: string
  /** Sort direction. */
  sort_order?: 'asc' | 'desc'
}

// ---------------------------------------------------------------------------
// Partner
// ---------------------------------------------------------------------------

/** Request body for creating a new partner. */
export interface CreatePartnerRequest {
  name: string
  slug: string
  isActive?: boolean
}

/** Request body for updating an existing partner. */
export interface UpdatePartnerRequest {
  name?: string
  slug?: string
  isActive?: boolean
}

/** Single partner returned from the API. */
export interface PartnerResponse {
  id: string
  name: string
  slug: string
  isActive: boolean
  created_at: string
  updated_at?: string
  deletedAt?: string
}

/** Paginated list of partners. */
export type PartnerListResponse = ApiListResponse<PartnerResponse>

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

/** Request body for creating a new organisation. */
export interface CreateOrganizationRequest {
  partnerId?: string
  name: string
  slug: string
  industry?: string
  sizeRange?: string
}

/** Request body for updating an existing organisation. */
export interface UpdateOrganizationRequest {
  partnerId?: string
  name?: string
  slug?: string
  industry?: string
  sizeRange?: string
  isActive?: boolean
}

/** Single organisation returned from the API. */
export interface OrganizationResponse {
  id: string
  partnerId?: string
  name: string
  slug: string
  industry?: string
  sizeRange?: string
  isActive: boolean
  created_at: string
  updated_at?: string
  deletedAt?: string
}

/** Paginated list of organisations. */
export type OrganizationListResponse = ApiListResponse<OrganizationResponse>

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/** Request body for creating a new user profile. */
export interface CreateProfileRequest {
  authUserId: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  organizationId?: string
  avatarUrl?: string
}

/** Request body for updating an existing user profile. */
export interface UpdateProfileRequest {
  email?: string
  firstName?: string
  lastName?: string
  role?: UserRole
  organizationId?: string
  avatarUrl?: string
  isActive?: boolean
}

/** Single profile returned from the API. */
export interface ProfileResponse {
  id: string
  authUserId: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  organizationId?: string
  avatarUrl?: string
  isActive: boolean
  created_at: string
  updated_at?: string
}

/** Paginated list of profiles. */
export type ProfileListResponse = ApiListResponse<ProfileResponse>

// ---------------------------------------------------------------------------
// Competency Category
// ---------------------------------------------------------------------------

/** Request body for creating a new competency category. */
export interface CreateCompetencyCategoryRequest {
  partnerId?: string
  name: string
  description?: string
  sortOrder?: number
}

/** Request body for updating an existing competency category. */
export interface UpdateCompetencyCategoryRequest {
  name?: string
  description?: string
  sortOrder?: number
}

/** Single competency category returned from the API. */
export interface CompetencyCategoryResponse {
  id: string
  partnerId?: string
  name: string
  description?: string
  sortOrder: number
  created_at: string
  updated_at?: string
}

/** Paginated list of competency categories. */
export type CompetencyCategoryListResponse = ApiListResponse<CompetencyCategoryResponse>

// ---------------------------------------------------------------------------
// Competency
// ---------------------------------------------------------------------------

/** Request body for creating a new competency. */
export interface CreateCompetencyRequest {
  categoryId?: string
  partnerId?: string
  name: string
  description?: string
}

/** Request body for updating an existing competency. */
export interface UpdateCompetencyRequest {
  categoryId?: string
  name?: string
  description?: string
  isActive?: boolean
}

/** Single competency returned from the API. */
export interface CompetencyResponse {
  id: string
  categoryId?: string
  partnerId?: string
  name: string
  description?: string
  isActive: boolean
  created_at: string
  updated_at?: string
}

/** Paginated list of competencies. */
export type CompetencyListResponse = ApiListResponse<CompetencyResponse>

// ---------------------------------------------------------------------------
// Response Format
// ---------------------------------------------------------------------------

/** Request body for creating a new response format. */
export interface CreateResponseFormatRequest {
  type: ResponseFormatType
  label: string
  config: Record<string, unknown>
}

/** Request body for updating an existing response format. */
export interface UpdateResponseFormatRequest {
  type?: ResponseFormatType
  label?: string
  config?: Record<string, unknown>
}

/** Single response format returned from the API. */
export interface ResponseFormatResponse {
  id: string
  type: ResponseFormatType
  label: string
  config: Record<string, unknown>
  created_at: string
  updated_at?: string
}

/** Paginated list of response formats. */
export type ResponseFormatListResponse = ApiListResponse<ResponseFormatResponse>

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

/** Request body for creating a new assessment item. */
export interface CreateItemRequest {
  competencyId: string
  responseFormatId: string
  stem: string
  status?: ItemStatus
  language?: string
  sortOrder?: number
  /** Inline options to create alongside the item. */
  options?: CreateItemOptionRequest[]
}

/** Request body for updating an existing assessment item. */
export interface UpdateItemRequest {
  competencyId?: string
  responseFormatId?: string
  stem?: string
  status?: ItemStatus
  language?: string
  sortOrder?: number
}

/** Single item returned from the API, optionally including nested options. */
export interface ItemResponse {
  id: string
  competencyId: string
  responseFormatId: string
  stem: string
  status: ItemStatus
  language: string
  sortOrder: number
  options?: ItemOptionResponse[]
  created_at: string
  updated_at?: string
}

/** Paginated list of items. */
export type ItemListResponse = ApiListResponse<ItemResponse>

// ---------------------------------------------------------------------------
// Item Option
// ---------------------------------------------------------------------------

/** Request body for creating a new item option. */
export interface CreateItemOptionRequest {
  itemId?: string
  label: string
  value: number
  sortOrder?: number
}

/** Request body for updating an existing item option. */
export interface UpdateItemOptionRequest {
  label?: string
  value?: number
  sortOrder?: number
}

/** Single item option returned from the API. */
export interface ItemOptionResponse {
  id: string
  itemId: string
  label: string
  value: number
  sortOrder: number
  created_at: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Item Parameter
// ---------------------------------------------------------------------------

/** Request body for creating / calibrating item parameters. */
export interface CreateItemParameterRequest {
  itemId: string
  modelType: string
  discrimination: number
  difficulty: number
  guessing: number
  calibrationDate?: string
  sampleSize: number
}

/** Request body for updating item parameters after recalibration. */
export interface UpdateItemParameterRequest {
  modelType?: string
  discrimination?: number
  difficulty?: number
  guessing?: number
  calibrationDate?: string
  sampleSize?: number
}

/** Single item parameter set returned from the API. */
export interface ItemParameterResponse {
  id: string
  itemId: string
  modelType: string
  discrimination: number
  difficulty: number
  guessing: number
  calibrationDate: string
  sampleSize: number
  created_at: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Assessment builder
// ---------------------------------------------------------------------------

/**
 * Factor-level configuration supplied when creating or updating
 * an assessment through the assessment builder.
 */
export interface AssessmentFactorInput {
  /** Factor UUID. */
  factorId: string
  /** Relative weight of this factor within the assessment. */
  weight: number
  /** Target number of items to administer for this factor. */
  itemCount: number
}

/** Request body for creating a new assessment via the builder. */
export interface CreateAssessmentRequest {
  organizationId: string
  title: string
  description?: string
  itemSelectionStrategy: ItemSelectionStrategy
  scoringMethod: ScoringMethod
  timeLimitMinutes?: number
  /** Factors to include with per-factor weights and item counts. */
  factors: AssessmentFactorInput[]
}

/** Request body for updating an existing assessment. */
export interface UpdateAssessmentRequest {
  title?: string
  description?: string
  status?: AssessmentStatus
  itemSelectionStrategy?: ItemSelectionStrategy
  scoringMethod?: ScoringMethod
  timeLimitMinutes?: number | null
  /** Replace the full factor list; omit to leave unchanged. */
  factors?: AssessmentFactorInput[]
}

/** Factor detail embedded in an assessment response. */
export interface AssessmentFactorDetail {
  id: string
  assessmentId: string
  factorId: string
  factorName: string
  weight: number
  itemCount: number
}

/** Single assessment returned from the API with nested factors. */
export interface AssessmentResponse {
  id: string
  organizationId: string
  title: string
  description?: string
  status: AssessmentStatus
  itemSelectionStrategy: ItemSelectionStrategy
  scoringMethod: ScoringMethod
  timeLimitMinutes?: number
  factors: AssessmentFactorDetail[]
  created_at: string
  updated_at?: string
}

/** Paginated list of assessments. */
export type AssessmentListResponse = ApiListResponse<AssessmentResponse>

// ---------------------------------------------------------------------------
// Diagnostic session
// ---------------------------------------------------------------------------

/** Request body for creating a new diagnostic session. */
export interface CreateDiagnosticSessionRequest {
  organizationId: string
  templateId: string
  subjectProfileId: string
  title: string
  /** Optional expiration date (ISO-8601). */
  expiresAt?: string
  /** Respondents to invite immediately. */
  respondents?: CreateDiagnosticRespondentInput[]
  /** Per-dimension weight overrides. */
  dimensionWeights?: DiagnosticDimensionWeightInput[]
}

/** Inline respondent input used when creating a diagnostic session. */
export interface CreateDiagnosticRespondentInput {
  profileId?: string
  email: string
  relationship: string
}

/** Inline dimension weight input used when creating a diagnostic session. */
export interface DiagnosticDimensionWeightInput {
  dimensionId: string
  weight: number
}

/** Request body for updating a diagnostic session. */
export interface UpdateDiagnosticSessionRequest {
  title?: string
  status?: DiagnosticSessionStatus
  expiresAt?: string | null
}

/** Single diagnostic session returned from the API. */
export interface DiagnosticSessionResponse {
  id: string
  organizationId: string
  templateId: string
  subjectProfileId: string
  title: string
  status: DiagnosticSessionStatus
  expiresAt?: string
  respondentCount: number
  completedRespondentCount: number
  created_at: string
  updated_at?: string
}

/** Paginated list of diagnostic sessions. */
export type DiagnosticSessionListResponse = ApiListResponse<DiagnosticSessionResponse>

// ---------------------------------------------------------------------------
// Diagnostic response submission
// ---------------------------------------------------------------------------

/** A single dimension rating within a diagnostic response submission. */
export interface DiagnosticRatingInput {
  dimensionId: string
  value: number
  comment?: string
}

/** Request body for a respondent submitting their diagnostic ratings. */
export interface SubmitDiagnosticResponseRequest {
  respondentId: string
  ratings: DiagnosticRatingInput[]
}

/** Confirmation returned after a successful diagnostic submission. */
export interface SubmitDiagnosticResponseResponse {
  respondentId: string
  ratingsSubmitted: number
  completedAt: string
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Request body for triggering an AI competency-matching run
 * based on diagnostic session data.
 */
export interface RunMatchingRequest {
  organizationId: string
  diagnosticSessionId: string
  /** Optional override for the AI model config to use. */
  modelConfigId?: string
  /** Optional override for the system prompt to use. */
  systemPromptId?: string
}

/** A single ranked factor within a matching result response. */
export interface MatchingResultFactor {
  factorId: string
  factorName: string
  rank: number
  relevanceScore: number
  reasoning: string
}

/** Recommended competency count guidance produced by the matching engine. */
export interface MatchingRecommendedCount {
  minimum: number
  optimal: number
  maximum: number
}

/** Full matching result returned from the API. */
export interface MatchingResultResponse {
  matchingRunId: string
  status: MatchingRunStatus
  rankings: MatchingResultFactor[]
  summary: string
  recommendedCount: MatchingRecommendedCount
  modelUsed: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Participant session
// ---------------------------------------------------------------------------

/** Request body for starting a new participant assessment session. */
export interface CreateParticipantSessionRequest {
  assessmentId: string
  participantProfileId: string
}

/** A single item presented to the participant during an adaptive session. */
export interface ParticipantItemPresentation {
  itemId: string
  stem: string
  responseFormat: ResponseFormatType
  options?: Array<{
    id: string
    label: string
    value: number
    sortOrder: number
  }>
  presentationOrder: number
}

/** Request body for submitting a participant's response to a single item. */
export interface SubmitParticipantResponseRequest {
  sessionId: string
  itemId: string
  responseValue: number
  responseTimeMs?: number
}

/** Response confirming a participant answer was recorded, with optional next item. */
export interface SubmitParticipantResponseResponse {
  recorded: boolean
  /** Next item to present; null if the session is complete. */
  nextItem?: ParticipantItemPresentation
  /** Updated session status. */
  sessionStatus: ParticipantSessionStatus
  /** Number of items completed so far. */
  itemsCompleted: number
  /** Estimated total items (may change during adaptive testing). */
  estimatedTotalItems: number
}

/** Factor-level score included in a participant session result. */
export interface ParticipantFactorScoreResponse {
  factorId: string
  factorName: string
  rawScore: number
  scaledScore: number
  percentile?: number
  confidence?: {
    lower: number
    upper: number
  }
  scoringMethod: ScoringMethod
  itemsUsed: number
}

/** Full participant session result returned from the API. */
export interface ParticipantSessionResultResponse {
  sessionId: string
  assessmentId: string
  participantProfileId: string
  status: ParticipantSessionStatus
  startedAt?: string
  completedAt?: string
  scores: ParticipantFactorScoreResponse[]
  created_at: string
}

/** Single participant session returned from the API. */
export interface ParticipantSessionResponse {
  id: string
  assessmentId: string
  participantProfileId: string
  status: ParticipantSessionStatus
  startedAt?: string
  completedAt?: string
  itemsCompleted: number
  totalItems: number
  created_at: string
  updated_at?: string
}

/** Paginated list of participant sessions. */
export type ParticipantSessionListResponse = ApiListResponse<ParticipantSessionResponse>
