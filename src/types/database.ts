// =============================================================================
// database.ts — Row types mirroring the PostgreSQL schema for Talent Fit
// =============================================================================

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Platform-wide role assigned to every user account. */
export type UserRole =
  | 'platform_admin'
  | 'partner_admin'
  | 'org_admin'
  | 'consultant'
  | 'assessor'
  | 'candidate'

/** Lifecycle status of an assessment item (question). */
export type ItemStatus = 'draft' | 'active' | 'archived'

/** The UI/data format used to capture a candidate's answer. */
export type ResponseFormatType =
  | 'likert'
  | 'forced_choice'
  | 'binary'
  | 'ranking'
  | 'free_text'
  | 'sjt'

/** Response format types currently active in the UI. */
export type ActiveResponseFormatType =
  | 'likert'
  | 'forced_choice'
  | 'binary'
  | 'free_text'
  | 'sjt'

/** Algorithm family used to convert raw responses into competency scores. */
export type ScoringMethod = 'irt' | 'ctt' | 'hybrid'

/**
 * Strategy that governs which items are presented to a candidate.
 * - `fixed`      – a predetermined, static item list
 * - `rule_based` – items chosen by configurable business rules
 * - `cat`        – computerised adaptive testing driven by IRT
 */
export type ItemSelectionStrategy = 'fixed' | 'rule_based' | 'cat'

/**
 * IRT model complexity.
 * - 1PL (Rasch) — difficulty only
 * - 2PL         — difficulty + discrimination
 * - 3PL         — difficulty + discrimination + guessing
 */
export type IRTModelType = '1PL' | '2PL' | '3PL'

/** Lifecycle status of an assessment definition. */
export type AssessmentStatus = 'draft' | 'active' | 'archived'

/** How the assessment was created. */
export type AssessmentCreationMode = 'manual' | 'ai_generated' | 'org_choice'

/** Lifecycle status of a 360-style diagnostic session. */
export type DiagnosticSessionStatus = 'draft' | 'active' | 'completed' | 'archived'

/** Progress status of an individual candidate's assessment attempt. */
export type CandidateSessionStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'expired'

/** Execution status for an AI-driven competency-matching run. */
export type MatchingRunStatus = 'pending' | 'running' | 'completed' | 'failed'

/**
 * Strategy that governs how items are ordered within an assessment section.
 * - `fixed`                    – exact order set by admin
 * - `randomised`               – full shuffle per candidate
 * - `interleaved_by_construct` – round-robin across constructs (default)
 */
export type ItemOrdering = 'fixed' | 'randomised' | 'interleaved_by_construct'

/** Type of calibration analysis run. */
export type CalibrationType = 'initial' | 'monitoring' | 'recalibration' | 'on_demand'

/** Statistical method used in a calibration run. */
export type CalibrationMethod = 'ctt_only' | 'irt_2pl' | 'irt_3pl' | 'concurrent'

/** Lifecycle status of a calibration run. */
export type CalibrationStatus = 'pending' | 'running' | 'completed' | 'failed'

/** Statistical method for Differential Item Functioning analysis. */
export type DIFMethod = 'mantel_haenszel' | 'logistic_regression' | 'lord_chi_square'

/** Effect-size classification for DIF (Mantel-Haenszel convention). */
export type DIFClassification = 'A' | 'B' | 'C'

/** The intended purpose of a stored AI system prompt. */
export type AIPromptPurpose =
  | 'competency_matching'
  | 'ranking_explanation'
  | 'diagnostic_analysis'

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

/**
 * A reseller or consulting firm that owns one or more organisations.
 * Partners are the top-level tenancy boundary in the platform.
 */
export interface Partner {
  /** UUID primary key. */
  id: string
  /** Human-readable partner name. */
  name: string
  /** URL-safe slug used in multi-tenant routing. */
  slug: string
  /** Optional brand logo URL. */
  logoUrl?: string
  /** Whether the partner account is currently active. */
  isActive: boolean
  created_at: string
  updated_at?: string
}

/**
 * A client organisation managed by a partner.
 * Assessments and diagnostic sessions are scoped to an organisation.
 */
export interface Organization {
  /** UUID primary key. */
  id: string
  /** Owning partner. */
  partnerId: string
  /** Organisation display name. */
  name: string
  /** URL-safe slug. */
  slug: string
  /** Industry vertical, used for benchmark grouping. */
  industry?: string
  /** Approximate headcount bracket (e.g. "50-200"). */
  sizeRange?: string
  /** Whether the organisation account is currently active. */
  isActive: boolean
  created_at: string
  updated_at?: string
}

/**
 * A user profile linked to the auth layer (e.g. Supabase Auth).
 * One profile may belong to many organisations through role assignments.
 */
export interface Profile {
  /** UUID primary key — usually matches the auth provider's user ID. */
  id: string
  /** Reference to the external authentication provider user ID. */
  authUserId: string
  /** User's email address. */
  email: string
  /** Given name. */
  firstName: string
  /** Family name. */
  lastName: string
  /** Platform-wide role. */
  role: UserRole
  /** Organisation the user primarily belongs to (nullable for platform admins). */
  organizationId?: string
  /** URL to the user's avatar image. */
  avatarUrl?: string
  /** Whether the user account is currently active. */
  isActive: boolean
  created_at: string
  updated_at?: string
}

/**
 * A scoring dimension within a competency category
 * (e.g. "Cognitive Ability", "Interpersonal Skills").
 */
export interface Dimension {
  /** UUID primary key. */
  id: string
  /** Scoped to a partner; null means platform-global. */
  partnerId?: string
  /** Dimension display name. */
  name: string
  /** URL-safe slug. */
  slug: string
  /** Rich description of what the dimension measures. */
  description?: string
  /** Formal definition used in reports. */
  definition?: string
  /** Whether this dimension produces a numeric score. */
  isScored: boolean
  /** Display ordering weight. */
  displayOrder: number
  /** Whether this dimension is currently active. */
  isActive: boolean
  /** Behavioural indicators for low performance. */
  indicatorsLow?: string
  /** Behavioural indicators for mid performance. */
  indicatorsMid?: string
  /** Behavioural indicators for high performance. */
  indicatorsHigh?: string
  created_at: string
  updated_at?: string
}

/**
 * A measurable behavioural or cognitive factor
 * (e.g. "Strategic Thinking", "Emotional Resilience").
 */
export interface Factor {
  /** UUID primary key. */
  id: string
  /** Optional parent dimension. */
  dimensionId?: string
  /** Scoped to a partner; null means platform-global. */
  partnerId?: string
  /** Short factor label. */
  name: string
  /** URL-safe slug. */
  slug: string
  /** Rich description explaining what the factor measures. */
  description?: string
  /** Formal definition used in reports. */
  definition?: string
  /** Whether this factor is available for use in assessments. */
  isActive: boolean
  /** Whether the AI matching engine can evaluate this factor. */
  isMatchEligible: boolean
  /** Client organisation this factor belongs to (null = platform-global). */
  organizationId?: string
  /** Behavioural indicators for low performance. */
  indicatorsLow?: string
  /** Behavioural indicators for mid performance. */
  indicatorsMid?: string
  /** Behavioural indicators for high performance. */
  indicatorsHigh?: string
  created_at: string
  updated_at?: string
}

/**
 * A measurable construct that can be linked to one or more factors
 * (e.g. "Adaptability", "Attention to Detail").
 */
export interface Construct {
  /** UUID primary key. */
  id: string
  /** Scoped to a partner; null means platform-global. */
  partnerId?: string
  /** Construct display name. */
  name: string
  /** URL-safe slug. */
  slug: string
  /** Rich description of what the construct measures. */
  description?: string
  /** Formal definition used in reports. */
  definition?: string
  /** Whether this construct is currently active. */
  isActive: boolean
  /** Behavioural indicators for low performance. */
  indicatorsLow?: string
  /** Behavioural indicators for mid performance. */
  indicatorsMid?: string
  /** Behavioural indicators for high performance. */
  indicatorsHigh?: string
  created_at: string
  updated_at?: string
}

/**
 * Junction linking a factor to its constituent constructs,
 * including per-construct weighting and ordering.
 */
export interface FactorConstruct {
  /** UUID primary key. */
  id: string
  /** Parent factor. */
  factorId: string
  /** Linked construct. */
  constructId: string
  /** Relative weight of this construct within the factor. */
  weight: number
  /** Display ordering weight. */
  displayOrder: number
  created_at: string
}

/**
 * Defines how responses for a particular format are structured and scored.
 */
export interface ResponseFormat {
  /** UUID primary key. */
  id: string
  /** The response capture format. */
  type: ResponseFormatType
  /** Human-readable name (e.g. "5-point Likert"). */
  name: string
  /**
   * JSON-serialised configuration for the format
   * (e.g. scale anchors, number of points, option count).
   */
  config: Record<string, unknown>
  /** Whether this format is currently available for use. */
  isActive: boolean
  created_at: string
  updated_at?: string
}

/**
 * A single assessment item (question/prompt) linked to a construct.
 */
export interface Item {
  /** UUID primary key. */
  id: string
  /** Optional factor (denormalized convenience column). */
  factorId?: string
  /** The construct this item measures — canonical link. */
  constructId: string
  /** Response format governing how the item is presented. */
  responseFormatId: string
  /** The question / stimulus text presented to the candidate. */
  stem: string
  /** Whether scoring is reversed for this item. */
  reverseScored: boolean
  /** Lifecycle status. */
  status: ItemStatus
  /** Display ordering weight within its assessment section. */
  displayOrder: number
  created_at: string
  updated_at?: string
}

/**
 * A selectable option within a multiple-choice or forced-choice item.
 */
export interface ItemOption {
  /** UUID primary key. */
  id: string
  /** Parent item. */
  itemId: string
  /** Text displayed for this option. */
  label: string
  /** Numeric value recorded when this option is selected. */
  value: number
  /** Display ordering weight. */
  sortOrder: number
  created_at: string
  updated_at?: string
}

/**
 * A media attachment for an assessment item (image, audio, video, or HTML).
 * Used by cognitive assessments, SJT scenarios, etc.
 */
export interface ItemMedia {
  /** UUID primary key. */
  id: string
  /** Parent item. */
  itemId: string
  /** Type of media: image, audio, video, or html. */
  mediaType: 'image' | 'audio' | 'video' | 'html'
  /** External URL or storage path. */
  url?: string
  /** Inline content (e.g. HTML scenario). */
  content?: string
  /** Accessibility description. */
  altText?: string
  /** Display ordering weight. */
  displayOrder: number
  created_at: string
  updated_at?: string
}

/**
 * A scoring rubric entry for SJT and other multi-option scored items.
 * Maps each option to a quality label and score value.
 */
export interface ItemScoringRubric {
  /** UUID primary key. */
  id: string
  /** Parent item. */
  itemId: string
  /** Linked option (nullable for rubrics that apply globally). */
  optionId?: string
  /** Quality label for this scoring level. */
  rubricLabel: 'best' | 'good' | 'neutral' | 'poor'
  /** Numeric score for this rubric level. */
  scoreValue: number
  /** Rationale for this scoring. */
  explanation?: string
  created_at: string
  updated_at?: string
}

/**
 * IRT or CTT psychometric parameters calibrated for a specific item.
 * These drive adaptive testing and scoring precision.
 */
export interface ItemParameter {
  /** UUID primary key. */
  id: string
  /** The item these parameters belong to. */
  itemId: string
  /** IRT model variant the parameters were estimated under. */
  modelType: IRTModelType
  /** IRT discrimination parameter (a). Higher = more informative. */
  discrimination: number
  /** IRT difficulty parameter (b). Centred around 0 on the theta scale. */
  difficulty: number
  /** IRT pseudo-guessing parameter (c). Typically 0 for non-MCQ items. */
  guessing: number
  /** Date the parameters were last calibrated. */
  calibrationDate: string
  /** Number of responses used in the calibration sample. */
  sampleSize: number
  created_at: string
  updated_at?: string
}

/**
 * A named assessment instrument that groups competencies and items
 * into a deliverable test.
 */
export interface Assessment {
  /** UUID primary key. */
  id: string
  /** Owning organisation (optional — assigned when deployed to an org). */
  organizationId?: string
  /** Assessment display title. */
  title: string
  /** Longer description / purpose statement. */
  description?: string
  /** Lifecycle status. */
  status: AssessmentStatus
  /** How items are chosen for candidates. */
  itemSelectionStrategy: ItemSelectionStrategy
  /** Algorithm used to convert responses to scores. */
  scoringMethod: ScoringMethod
  /** How the assessment was created. */
  creationMode: AssessmentCreationMode
  /** Matching run that generated this assessment (if AI-created). */
  matchingRunId?: string
  created_at: string
  updated_at?: string
}

/**
 * Junction between an assessment and the competencies it measures,
 * including per-competency configuration.
 */
export interface AssessmentCompetency {
  /** UUID primary key. */
  id: string
  /** Parent assessment. */
  assessmentId: string
  /** Linked competency. */
  competencyId: string
  /**
   * Relative weight of this competency within the assessment
   * (weights are normalised at scoring time).
   */
  weight: number
  /** Target number of items to administer for this competency. */
  itemCount: number
  created_at: string
  updated_at?: string
}

/**
 * A configurable rule that governs item selection
 * when the strategy is `rule_based`.
 */
export interface ItemSelectionRule {
  /** UUID primary key. */
  id: string
  /** The assessment this rule belongs to. */
  assessmentId: string
  /** Machine-readable rule type identifier (e.g. "difficulty_range"). */
  ruleType: string
  /**
   * JSON-encoded rule parameters
   * (e.g. `{ "minDifficulty": -1, "maxDifficulty": 1 }`).
   */
  config: Record<string, unknown>
  /** Evaluation priority — lower numbers are evaluated first. */
  priority: number
  created_at: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Diagnostic (360 / multi-rater) tables
// ---------------------------------------------------------------------------

/**
 * A behavioural dimension measured within a diagnostic
 * (e.g. "Communication", "Decision-Making").
 */
export interface DiagnosticDimension {
  /** UUID primary key. */
  id: string
  /** Scoped to a partner; null means platform-global. */
  partnerId?: string
  /** Dimension display name. */
  name: string
  /** Rich description of what the dimension measures. */
  description?: string
  /** Whether this dimension is available for use. */
  isActive: boolean
  created_at: string
  updated_at?: string
}

/**
 * A reusable template that defines the structure of a diagnostic survey.
 */
export interface DiagnosticTemplate {
  /** UUID primary key. */
  id: string
  /** Scoped to a partner; null means platform-global. */
  partnerId?: string
  /** Template display name. */
  name: string
  /** Template description / instructions. */
  description?: string
  /** Whether the template is currently available. */
  isActive: boolean
  created_at: string
  updated_at?: string
}

/**
 * Junction linking a diagnostic template to the dimensions it includes,
 * along with per-dimension ordering.
 */
export interface DiagnosticTemplateDimension {
  /** UUID primary key. */
  id: string
  /** Parent template. */
  templateId: string
  /** Linked dimension. */
  dimensionId: string
  /** Display ordering weight. */
  sortOrder: number
  created_at: string
  updated_at?: string
}

/**
 * An active diagnostic session created from a template,
 * scoped to one organisation and one subject (the person being rated).
 */
export interface DiagnosticSession {
  /** UUID primary key. */
  id: string
  /** Organisation running the session. */
  organizationId: string
  /** Template the session was created from. */
  templateId: string
  /** Profile ID of the subject being assessed. */
  subjectProfileId: string
  /** Session display title. */
  title: string
  /** Current lifecycle status. */
  status: DiagnosticSessionStatus
  /** ISO-8601 date after which the session is no longer accessible. */
  expiresAt?: string
  created_at: string
  updated_at?: string
}

/**
 * A person invited to provide ratings in a diagnostic session
 * (may or may not be a registered platform user).
 */
export interface DiagnosticRespondent {
  /** UUID primary key. */
  id: string
  /** Parent diagnostic session. */
  sessionId: string
  /** Linked profile if the respondent is a platform user. */
  profileId?: string
  /** Email used for the invitation. */
  email: string
  /** Relationship to the subject (e.g. "manager", "peer", "direct_report", "self"). */
  relationship: string
  /** Whether the respondent has completed their ratings. */
  hasCompleted: boolean
  /** ISO-8601 timestamp of completion, if applicable. */
  completedAt?: string
  created_at: string
  updated_at?: string
}

/**
 * A single numeric rating submitted by a respondent
 * for one dimension in a diagnostic session.
 */
export interface DiagnosticResponse {
  /** UUID primary key. */
  id: string
  /** The respondent who submitted this rating. */
  respondentId: string
  /** The dimension being rated. */
  dimensionId: string
  /** Numeric rating value. */
  value: number
  /** Optional free-text comment accompanying the rating. */
  comment?: string
  created_at: string
  updated_at?: string
}

/**
 * Per-dimension weighting applied within a diagnostic session,
 * allowing sessions to emphasise certain dimensions over others.
 */
export interface DiagnosticDimensionWeight {
  /** UUID primary key. */
  id: string
  /** Parent diagnostic session. */
  sessionId: string
  /** The dimension being weighted. */
  dimensionId: string
  /**
   * Relative weight (normalised at aggregation time).
   * Defaults to 1.0 for equal weighting.
   */
  weight: number
  created_at: string
  updated_at?: string
}

/**
 * Bridge linking a diagnostic dimension to taxonomy competencies,
 * seeding AI matching context. Admin controls which competencies
 * are relevant to each diagnostic dimension.
 */
export interface DiagnosticCompetencyHint {
  /** UUID primary key. */
  id: string
  /** The diagnostic dimension. */
  diagnosticDimensionId: string
  /** The taxonomy competency. */
  competencyId: string
  /** Relevance weight (normalised at matching time). */
  relevanceWeight: number
  created_at: string
}

/**
 * A point-in-time snapshot of aggregated diagnostic results,
 * stored as a JSON blob for historical reference.
 */
export interface DiagnosticSnapshot {
  /** UUID primary key. */
  id: string
  /** Parent diagnostic session. */
  sessionId: string
  /**
   * Aggregated results keyed by dimension ID.
   * Each value typically contains mean, count, and breakdown by relationship.
   */
  data: Record<string, unknown>
  /** Human-readable label (e.g. "Final results — 2026-03-25"). */
  label?: string
  created_at: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// AI / LLM configuration tables
// ---------------------------------------------------------------------------

/**
 * A registered AI provider instance (e.g. an Anthropic API account).
 */
export interface AIProvider {
  /** UUID primary key. */
  id: string
  /** Provider vendor type. */
  providerType: string
  /** Display name for the provider instance. */
  name: string
  /**
   * Base URL for the provider's API.
   * Only relevant for custom / self-hosted providers.
   */
  baseUrl?: string
  /** Whether this provider is currently enabled. */
  isActive: boolean
  created_at: string
  updated_at?: string
}

/**
 * Configuration for a specific model offered by an AI provider,
 * including default generation parameters.
 */
export interface AIModelConfig {
  /** UUID primary key. */
  id: string
  /** Parent provider. */
  providerId: string
  /** Model identifier (e.g. "claude-opus-4-20250514", "gpt-4o"). */
  modelId: string
  /** Human-friendly display name. */
  displayName: string
  /** Default sampling temperature. */
  defaultTemperature: number
  /** Default maximum output tokens. */
  defaultMaxTokens: number
  /** Whether this model config is currently enabled. */
  isActive: boolean
  created_at: string
  updated_at?: string
}

/**
 * A versioned system prompt stored for a specific AI purpose,
 * enabling prompt management and A/B testing.
 */
export interface AISystemPrompt {
  /** UUID primary key. */
  id: string
  /** The purpose this prompt serves. */
  purpose: AIPromptPurpose
  /** Monotonically increasing version number. */
  version: number
  /** The full system prompt text. */
  promptText: string
  /** Whether this version is the currently active prompt for its purpose. */
  isActive: boolean
  created_at: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Matching tables
// ---------------------------------------------------------------------------

/**
 * A single execution of the AI competency-matching pipeline,
 * typically triggered after a diagnostic session completes.
 */
export interface MatchingRun {
  /** UUID primary key. */
  id: string
  /** Organisation the matching was run for. */
  organizationId: string
  /** Diagnostic session whose data fed the matching. */
  diagnosticSessionId: string
  /** AI model config used for this run. */
  modelConfigId: string
  /** System prompt used for this run. */
  systemPromptId: string
  /** Current execution status. */
  status: MatchingRunStatus
  /** ISO-8601 timestamp when execution began. */
  startedAt?: string
  /** ISO-8601 timestamp when execution finished. */
  completedAt?: string
  /** Error message if the run failed. */
  errorMessage?: string
  created_at: string
  updated_at?: string
}

/**
 * A single ranked competency produced by a matching run,
 * including the AI's reasoning for the ranking.
 */
export interface MatchingResult {
  /** UUID primary key. */
  id: string
  /** Parent matching run. */
  matchingRunId: string
  /** The competency that was ranked. */
  competencyId: string
  /** Ordinal rank (1 = most relevant). */
  rank: number
  /** Normalised relevance score (0–1). */
  relevanceScore: number
  /** AI-generated explanation for this ranking. */
  reasoning: string
  created_at: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Candidate assessment session tables
// ---------------------------------------------------------------------------

/**
 * An individual candidate's attempt at an assessment,
 * tracking progress, timing and final status.
 */
export interface CandidateSession {
  /** UUID primary key. */
  id: string
  /** The assessment being taken. */
  assessmentId: string
  /** Profile of the candidate. */
  candidateProfileId: string
  /** Current session progress status. */
  status: CandidateSessionStatus
  /** ISO-8601 timestamp when the candidate started the assessment. */
  startedAt?: string
  /** ISO-8601 timestamp when the session was completed or expired. */
  completedAt?: string
  /** Browser / OS information captured at session start. */
  userAgent?: string
  /** Client IP address captured at session start. */
  ipAddress?: string
  created_at: string
  updated_at?: string
}

/**
 * A candidate's response to a single item within an assessment session.
 */
export interface CandidateResponse {
  /** UUID primary key. */
  id: string
  /** Parent candidate session. */
  sessionId: string
  /** The item that was answered. */
  itemId: string
  /** The assessment section this response belongs to. */
  sectionId?: string
  /** The recorded response value (numeric encoding of the chosen option). */
  responseValue: number
  /** Time in milliseconds the candidate spent on this item. */
  responseTimeMs?: number
  /** Display order position at which this item was presented. */
  presentationOrder: number
  created_at: string
  updated_at?: string
}

/**
 * A computed score for one competency within a candidate session,
 * persisted after the scoring engine runs.
 */
export interface CandidateScore {
  /** UUID primary key. */
  id: string
  /** Parent candidate session. */
  sessionId: string
  /** The competency that was scored. */
  competencyId: string
  /** Unscaled raw score. */
  rawScore: number
  /** Score transformed to the reporting scale (e.g. 0–100). */
  scaledScore: number
  /** Percentile rank relative to the norm group, if available. */
  percentile?: number
  /** Lower bound of the score confidence interval. */
  confidenceLower?: number
  /** Upper bound of the score confidence interval. */
  confidenceUpper?: number
  /** Algorithm used to produce this score. */
  scoringMethod: ScoringMethod
  /** Number of items that contributed to this score. */
  itemsUsed: number
  created_at: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Assessment sections
// ---------------------------------------------------------------------------

/**
 * A section within an assessment, enforcing a single response format.
 * Every assessment has at least one section.
 */
export interface AssessmentSection {
  /** UUID primary key. */
  id: string
  /** Parent assessment. */
  assessmentId: string
  /** The one response format used by all items in this section. */
  responseFormatId: string
  /** Admin-facing section title. */
  title: string
  /** Candidate-facing instruction text shown at section start. */
  instructions?: string
  /** Display ordering weight. */
  displayOrder: number
  /** How items are ordered within this section. */
  itemOrdering: ItemOrdering
  /** Number of items per page. NULL = all on one page; 1 = one-per-page (SJT). */
  itemsPerPage?: number
  /** Optional per-section time limit in seconds. */
  timeLimitSeconds?: number
  /** Whether candidates can navigate backwards within this section. */
  allowBackNav: boolean
  created_at: string
  updated_at?: string
}

/**
 * Junction linking an item to an assessment section with a display position.
 */
export interface AssessmentSectionItem {
  /** UUID primary key. */
  id: string
  /** Parent section. */
  sectionId: string
  /** Linked item. */
  itemId: string
  /** Display order used when `item_ordering = 'fixed'`. */
  displayOrder: number
  created_at: string
}

// ---------------------------------------------------------------------------
// Psychometric infrastructure
// ---------------------------------------------------------------------------

/**
 * A tracked execution of psychometric analyses (item stats, reliability,
 * DIF, factor analysis). Provides a full audit trail.
 */
export interface CalibrationRun {
  /** UUID primary key. */
  id: string
  /** Type of calibration event. */
  runType: CalibrationType
  /** Statistical method used. */
  method: CalibrationMethod
  /** Current execution status. */
  status: CalibrationStatus
  /** Number of responses in the analysis sample. */
  sampleSize?: number
  /** Start of the response date window. */
  dateRangeStart?: string
  /** End of the response date window. */
  dateRangeEnd?: string
  /** Free-form notes. */
  notes?: string
  /** When execution began. */
  startedAt?: string
  /** When execution completed. */
  completedAt?: string
  /** Error message if the run failed. */
  errorMessage?: string
  created_at: string
  updated_at?: string
}

/**
 * Per-item quality metrics computed during a calibration run.
 */
export interface ItemStatistic {
  /** UUID primary key. */
  id: string
  /** The item analysed. */
  itemId: string
  /** The calibration run that produced these statistics. */
  calibrationRunId: string
  /** CTT difficulty (p-value: proportion correct or mean/max). */
  difficulty?: number
  /** CTT discrimination (corrected item-total correlation). */
  discrimination?: number
  /** Cronbach's alpha if this item were removed. */
  alphaIfDeleted?: number
  /** Number of responses in the analysis. */
  responseCount?: number
  /** Response distribution as `{ optionValue: count }`. */
  responseDistribution?: Record<string, number>
  /** IRT information at theta = 0. */
  irtInformationAt0?: number
  /** IRT peak information. */
  irtMaxInformation?: number
  /** Theta where information peaks. */
  irtThetaAtMaxInfo?: number
  /** IRT infit mean square. */
  irtInfit?: number
  /** IRT outfit mean square. */
  irtOutfit?: number
  /** SE of discrimination parameter. */
  irtParamSeA?: number
  /** SE of difficulty parameter. */
  irtParamSeB?: number
  /** SE of guessing parameter. */
  irtParamSeC?: number
  /** Whether this item has been flagged for review. */
  flagged: boolean
  /** Reasons the item was flagged. */
  flagReasons?: string[]
  created_at: string
}

/**
 * Per-construct reliability metrics computed during a calibration run.
 */
export interface ConstructReliability {
  /** UUID primary key. */
  id: string
  /** The construct analysed. */
  constructId: string
  /** The calibration run that produced these metrics. */
  calibrationRunId: string
  /** Cronbach's alpha. */
  cronbachAlpha?: number
  /** McDonald's omega total. */
  omegaTotal?: number
  /** McDonald's omega hierarchical. */
  omegaHierarchical?: number
  /** CFA-based composite reliability. */
  compositeReliability?: number
  /** Spearman-Brown corrected split-half reliability. */
  splitHalf?: number
  /** Standard Error of Measurement. */
  sem?: number
  /** Conditional SEM at score levels: `{ scoreLevel: csem }`. */
  csemByScore?: Record<string, number>
  /** Number of items in the construct. */
  itemCount?: number
  /** Number of responses in the analysis. */
  responseCount?: number
  /** Observed score mean. */
  mean?: number
  /** Observed score standard deviation. */
  standardDeviation?: number
  /** Distribution skewness. */
  skewness?: number
  /** Distribution kurtosis. */
  kurtosis?: number
  /** Per-item contribution summary: `{ itemId: { discrimination, alphaIfDeleted } }`. */
  itemContributions?: Record<string, { discrimination: number; alphaIfDeleted: number }>
  created_at: string
}

/**
 * A norm group defined by segmentation criteria, used for
 * norm-referenced score transformations.
 */
export interface NormGroup {
  /** UUID primary key. */
  id: string
  /** Norm group display name. */
  name: string
  /** Description of the group composition. */
  description?: string
  /** Industry segment (e.g. "technology", "healthcare"). */
  industry?: string
  /** Role level (e.g. "executive", "manager", "individual_contributor"). */
  roleLevel?: string
  /** Job function (e.g. "engineering", "sales"). */
  jobFunction?: string
  /** Geographic region. */
  region?: string
  /** Optionally scoped to a specific organisation. */
  organizationId?: string
  /** Number of candidates in the norm sample. */
  sampleSize: number
  /** Start of data collection window. */
  collectionStart?: string
  /** End of data collection window. */
  collectionEnd?: string
  /** When the norms were last refreshed. */
  lastRefreshed?: string
  /** Whether this norm group is currently active. */
  isActive: boolean
  created_at: string
  updated_at?: string
}

/**
 * Per-construct distribution data for a norm group, enabling
 * T-score, percentile, stanine, and sten transformations.
 */
export interface NormTable {
  /** UUID primary key. */
  id: string
  /** Parent norm group. */
  normGroupId: string
  /** The construct these norms apply to. */
  constructId: string
  /** Mean score in the norm sample. */
  mean: number
  /** Standard deviation in the norm sample. */
  standardDeviation: number
  /** Number of candidates in this specific norm. */
  sampleSize: number
  /** Percentile lookup table: `{ "5": 23.4, "10": 28.1, ... }`. */
  percentileLookup?: Record<string, number>
  /** 8 cutpoints defining 9 stanine bins. */
  stanineCutpoints?: number[]
  /** 9 cutpoints defining 10 sten bins. */
  stenCutpoints?: number[]
  /** What score scale mean/SD are expressed in (e.g. "pomp", "raw"). */
  scoreType: string
  /** When this norm table was last computed. */
  lastComputed: string
  created_at: string
  updated_at?: string
}

/**
 * Results of a factor analysis (EFA or CFA) from a calibration run.
 */
export interface FactorAnalysisResult {
  /** UUID primary key. */
  id: string
  /** The calibration run that produced this analysis. */
  calibrationRunId: string
  /** Analysis type: 'efa' or 'cfa'. */
  analysisType: 'efa' | 'cfa'
  /** Estimation method (e.g. 'ml', 'wlsmv', 'paf'). */
  estimationMethod?: string
  /** Comparative Fit Index. */
  cfi?: number
  /** Tucker-Lewis Index. */
  tli?: number
  /** Root Mean Square Error of Approximation. */
  rmsea?: number
  /** RMSEA 90% CI lower bound. */
  rmseaCiLower?: number
  /** RMSEA 90% CI upper bound. */
  rmseaCiUpper?: number
  /** Standardized Root Mean Square Residual. */
  srmr?: number
  /** Chi-square statistic. */
  chiSquare?: number
  /** Chi-square degrees of freedom. */
  chiSquareDf?: number
  /** Chi-square p-value. */
  chiSquareP?: number
  /** Factor loadings: `{ itemId: { factorName: loading } }`. */
  loadings?: Record<string, Record<string, number>>
  /** Average Variance Extracted per construct. */
  ave?: Record<string, number>
  /** Heterotrait-Monotrait ratio matrix. */
  htmt?: Record<string, Record<string, number>>
  /** Inter-construct correlation matrix. */
  constructCorrelations?: Record<string, Record<string, number>>
  /** Number of responses in the analysis. */
  sampleSize?: number
  /** Free-form notes. */
  notes?: string
  created_at: string
}

/**
 * Differential Item Functioning result for one item and one group comparison.
 */
export interface DIFResult {
  /** UUID primary key. */
  id: string
  /** The item analysed. */
  itemId: string
  /** The calibration run that produced this analysis. */
  calibrationRunId: string
  /** Demographic variable used for grouping (e.g. 'gender'). */
  groupingVariable: string
  /** Reference group label. */
  referenceGroup: string
  /** Focal group label. */
  focalGroup: string
  /** Statistical method used. */
  method: DIFMethod
  /** Effect size (MH delta or equivalent). */
  effectSize?: number
  /** Statistical significance. */
  pValue?: number
  /** Effect-size classification (A = negligible, B = moderate, C = large). */
  classification?: DIFClassification
  /** Sample size for the reference group. */
  referenceN?: number
  /** Sample size for the focal group. */
  focalN?: number
  /** Whether this result was flagged for review. */
  flagged: boolean
  /** Free-form notes. */
  notes?: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Forced choice blocks
// ---------------------------------------------------------------------------

/**
 * A grouping of items presented together in a forced-choice format.
 * Typically contains 3–4 items that the candidate must rank or select from.
 */
export interface ForcedChoiceBlock {
  /** UUID primary key. */
  id: string
  /** Block display name. */
  name: string
  /** Optional description of the block's purpose. */
  description?: string
  /** Display ordering weight. */
  displayOrder: number
  created_at: string
  updated_at?: string
}

/**
 * Junction linking an item to a forced-choice block with a position.
 */
export interface ForcedChoiceBlockItem {
  /** UUID primary key. */
  id: string
  /** Parent block. */
  blockId: string
  /** Linked item. */
  itemId: string
  /** Position within the block. */
  position: number
  created_at: string
}
