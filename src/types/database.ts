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
 * A measurable behavioural or cognitive competency
 * (e.g. "Strategic Thinking", "Emotional Resilience").
 */
export interface Competency {
  /** UUID primary key. */
  id: string
  /** Optional parent dimension. */
  dimensionId?: string
  /** Scoped to a partner; null means platform-global. */
  partnerId?: string
  /** Short competency label. */
  name: string
  /** URL-safe slug. */
  slug: string
  /** Rich description explaining what the competency measures. */
  description?: string
  /** Formal definition used in reports. */
  definition?: string
  /** Whether this competency is available for use in assessments. */
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
 * A measurable trait that can be linked to one or more competencies
 * (e.g. "Adaptability", "Attention to Detail").
 */
export interface Trait {
  /** UUID primary key. */
  id: string
  /** Scoped to a partner; null means platform-global. */
  partnerId?: string
  /** Trait display name. */
  name: string
  /** URL-safe slug. */
  slug: string
  /** Rich description of what the trait measures. */
  description?: string
  /** Formal definition used in reports. */
  definition?: string
  /** Whether this trait is currently active. */
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
 * Junction linking a competency to its constituent traits,
 * including per-trait weighting and ordering.
 */
export interface CompetencyTrait {
  /** UUID primary key. */
  id: string
  /** Parent competency. */
  competencyId: string
  /** Linked trait. */
  traitId: string
  /** Relative weight of this trait within the competency. */
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
 * A single assessment item (question/prompt) linked to a construct (trait).
 */
export interface Item {
  /** UUID primary key. */
  id: string
  /** Optional competency (denormalized convenience column). */
  competencyId?: string
  /** The construct (trait) this item measures — canonical link. */
  traitId: string
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
  /** Owning organisation. */
  organizationId: string
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
  /** Maximum time allowed in minutes, null = unlimited. */
  timeLimitMinutes?: number
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
