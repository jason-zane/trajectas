// =============================================================================
// database.ts — Row types mirroring the PostgreSQL schema for Trajectas
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
  | 'participant'

/** Lifecycle status of an assessment item (question). */
export type ItemStatus = 'draft' | 'active' | 'archived'

/** The UI/data format used to capture a participant's answer. */
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
 * Strategy that governs which items are presented to a participant.
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

/** Lifecycle status of a campaign. */
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'closed' | 'archived'

/** Campaign kind — distinguishes a single self-assessment from a leadership 360. */
export type CampaignKind = 'self' | 'leadership_360'

/** Relationship of a 360 rater to the subject being rated. */
export type RaterRelationship =
  | 'self'
  | 'manager'
  | 'peer'
  | 'direct_report'
  | 'other'

/** Lifecycle status of a 360 rater, from nomination through completion. */
export type RaterStatus =
  | 'nominated'
  | 'approved'
  | 'declined'
  | 'invited'
  | 'in_progress'
  | 'completed'
  | 'withdrawn'
  | 'expired'

/** Progress status of a participant within a campaign. */
export type CampaignParticipantStatus =
  | 'invited'
  | 'registered'
  | 'in_progress'
  | 'completed'
  | 'withdrawn'
  | 'expired'

/** How the assessment was created. */
export type AssessmentCreationMode = 'manual' | 'ai_generated' | 'org_choice'

/** Delivery format for an assessment — traditional (per-item rating) or forced-choice (block comparison). */
export type FormatMode = 'traditional' | 'forced_choice'

/** Lifecycle status of a 360-style diagnostic session. */
export type DiagnosticSessionStatus = 'draft' | 'active' | 'completed' | 'archived'

// ---------------------------------------------------------------------------
// Org Diagnostic Enums
// ---------------------------------------------------------------------------

/** Kind of diagnostic campaign. */
export type OrgDiagnosticCampaignKind = 'baseline' | 'role_rep'

/** Lifecycle status of a diagnostic campaign. */
export type OrgDiagnosticCampaignStatus = 'draft' | 'active' | 'closed' | 'archived'

/** The instrument administered within a track. */
export type OrgDiagnosticInstrument = 'OPS' | 'LCQ' | 'REP'

/** Lifecycle status of an instrument track. */
export type OrgDiagnosticTrackStatus = 'pending' | 'open' | 'closed'

/** The role/perspective of a respondent. Determines which instrument they see. */
export type OrgDiagnosticRespondentType =
  | 'employee'
  | 'senior_leader'
  | 'hiring_manager'
  | 'team_member'

/** Progress of a respondent through their assigned instrument. */
export type OrgDiagnosticRespondentStatus =
  | 'invited'
  | 'in_progress'
  | 'completed'
  | 'withdrawn'
  | 'expired'

/** Kind of profile snapshot — mirrors campaign kind. */
export type OrgDiagnosticProfileKind = 'baseline' | 'role'

/** Lifecycle status of a hiring role at a client. */
export type ClientRoleStatus = 'open' | 'filled' | 'closed' | 'archived'

/** Progress status of an individual participant's assessment attempt. */
export type ParticipantSessionStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'expired'

/** Processing lifecycle for work performed after a session is submitted. */
export type ParticipantSessionProcessingStatus =
  | 'idle'
  | 'scoring'
  | 'scored'
  | 'reporting'
  | 'ready'
  | 'failed'

/** Execution status for an AI-driven competency-matching run. */
export type MatchingRunStatus = 'pending' | 'running' | 'completed' | 'failed'

/**
 * Strategy that governs how items are ordered within an assessment section.
 * - `fixed`                    – exact order set by admin
 * - `randomised`               – full shuffle per participant
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
  | 'item_generation'
  | 'factor_item_generation'
  | 'library_import_structuring'
  | 'preflight_analysis'
  | 'embedding'
  | 'chat'
  | 'report_narrative'
  | 'report_strengths_analysis'
  | 'report_development_advice'
  | 'item_critique'
  | 'synthetic_respondent'
  | 'brief_extraction'
  | 'architect_overview'
  | 'library_field_assist'

/** Report assessment type. */
export type ReportType = 'self_report' | '360'

/** Score resolution depth for a report block. */
export type ReportDisplayLevel = 'dimension' | 'factor' | 'construct'

/** How the report refers to the participant in narrative text. */
export type PersonReferenceType = 'you' | 'first_name' | 'participant' | 'the_participant' | 'neutral'

/** Presentation layout mode for a report block. */
export type PresentationMode = 'featured' | 'open' | 'carded' | 'split' | 'inset'

/** Chart visualisation variant for score blocks. */
export type ChartType = 'bar' | 'radar' | 'gauges' | 'segment' | 'scorecard' | 'grouped_bar' | 'radar_360' | 'gap'

/** Controls which brand layer is applied to a report. */
export type BrandModeType = 'platform' | 'client' | 'custom'

/** Lifecycle status of a report snapshot. */
export type ReportSnapshotStatus = 'pending' | 'generating' | 'ready' | 'released' | 'failed'

/** Lifecycle status of an asynchronously generated report PDF. */
export type ReportPdfStatus = 'queued' | 'generating' | 'ready' | 'failed'


/** How report narrative text was produced. */
export type NarrativeModeType = 'derived' | 'ai_enhanced'

/** Execution status for an AI-GENIE item generation run. */
export type GenerationRunStatus =
  | 'configuring'
  | 'generating'
  | 'embedding'
  | 'analysing'
  | 'reviewing'
  | 'completed'
  | 'failed'

/** Pipeline step identifier within a generation run. */
export type GenerationStep =
  | 'preflight'
  | 'item_generation'
  | 'embedding'
  | 'initial_ega'
  | 'uva'
  | 'boot_ega'
  | 'final'

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

/**
 * A reseller or consulting firm that owns one or more clients.
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
  /** Whether the partner can customise their own brand and control client branding. */
  canCustomizeBranding: boolean
  /** Optional description of the partner. */
  description?: string
  /** Partner website URL. */
  website?: string
  /** Primary contact email. */
  contactEmail?: string
  /** Internal notes (not visible to partner users). */
  notes?: string
  created_at: string
  updated_at?: string
  /** Soft-delete timestamp; NULL means active. */
  deletedAt?: string
}

/**
 * A client account managed by a partner.
 * A client account managed by a partner or platform-owned.
 * Assessments and diagnostic sessions are scoped to a client record.
 */
export interface Client {
  /** UUID primary key. */
  id: string
  /** Owning partner; omitted when the client is platform-owned. */
  partnerId?: string
  /** Client display name. */
  name: string
  /** URL-safe slug. */
  slug: string
  /** Industry vertical, used for benchmark grouping. */
  industry?: string
  /** Approximate headcount bracket (e.g. "50-200"). */
  sizeRange?: string
  /** Whether the client account is currently active. */
  isActive: boolean
  /** Whether this client can customise their own branding in the client portal. */
  canCustomizeBranding?: boolean
  created_at: string
  updated_at?: string
  /** Soft-delete timestamp; NULL means active. */
  deletedAt?: string
}

/**
 * A provenance / IP-attribution label for library content.
 * Independent of the clients table — just a tag that says "where this
 * dimension / factor / construct / item / assessment came from" so
 * imports keep their origin visible in the UI.
 */
export interface ContentSource {
  /** UUID primary key. */
  id: string
  /** Display name (e.g. "Executive Performance Partners"). */
  name: string
  /** URL-safe slug — unique. */
  slug: string
  /** Free-form admin notes. */
  notes?: string
  created_at: string
  updated_at?: string
}

/**
 * A user profile linked to the auth layer (e.g. Supabase Auth).
 * One profile may belong to many clients through role assignments.
 */
export interface Profile {
  /** UUID primary key — usually matches the auth provider's user ID. */
  id: string
  /** Reference to the external authentication provider user ID. */
  authUserId: string
  /** User's email address. */
  email: string
  /** Optional display name used in staff surfaces. */
  displayName?: string
  /** Given name. */
  firstName: string
  /** Family name. */
  lastName: string
  /** Platform-wide role. */
  role: UserRole
  /** Client the user primarily belongs to (nullable for platform admins). */
  clientId?: string
  /** URL to the user's avatar image. */
  avatarUrl?: string
  /** Whether the user account is currently active. */
  isActive: boolean
  created_at: string
  updated_at?: string
}

/**
 * Partner-scoped membership record used for multi-membership resolution.
 */
export interface PartnerMembership {
  id: string
  profileId: string
  partnerId: string
  role: 'admin' | 'member'
  isDefault: boolean
  createdBy?: string
  revokedAt?: string
  revokedByProfileId?: string
  created_at: string
  updated_at?: string
}

/**
 * Client-scoped membership record used for multi-membership resolution.
 *
 * Persistence still uses `client_id` for compatibility, even though
 * the product term is "client".
 */
export interface ClientMembership {
  id: string
  profileId: string
  clientId: string
  role: 'admin' | 'member'
  isDefault: boolean
  createdBy?: string
  revokedAt?: string
  revokedByProfileId?: string
  created_at: string
  updated_at?: string
}

export interface UserInvite {
  id: string
  email: string
  tenantType: 'platform' | 'partner' | 'client'
  tenantId?: string
  role:
    | 'platform_admin'
    | 'partner_admin'
    | 'partner_member'
    | 'client_admin'
    | 'client_member'
  authUserId?: string
  expiresAt: string
  acceptedAt?: string
  revokedAt?: string
  invitedByProfileId: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at?: string
}

/**
 * Audited admin support launch into a partner or client surface.
 */
export interface SupportSession {
  id: string
  actorProfileId: string
  targetSurface: 'partner' | 'client'
  partnerId?: string
  clientId?: string
  reason: string
  sessionKey: string
  metadata: Record<string, unknown>
  created_at: string
  expiresAt: string
  endedAt?: string
}

/**
 * Append-only audit log record for privileged and security-relevant actions.
 */
export interface AuditEvent {
  id: string
  actorProfileId?: string
  eventType: string
  targetTable?: string
  targetId?: string
  partnerId?: string
  clientId?: string
  supportSessionId?: string
  metadata: Record<string, unknown>
  created_at: string
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
  /** Short sentence describing what a low score on this entity means. */
  anchorLow?: string
  /** Short sentence describing what a high score on this entity means. */
  anchorHigh?: string
  /** Label for the low performance band. Null = global default ("Developing"). */
  bandLabelLow?: string
  /** Label for the mid performance band. Null = global default ("Effective"). */
  bandLabelMid?: string
  /** Label for the high performance band. Null = global default ("Highly Effective"). */
  bandLabelHigh?: string
  /** POMP upper boundary for low band. Null = global default (40). */
  pompThresholdLow?: number
  /** POMP lower boundary for high band. Null = global default (70). */
  pompThresholdHigh?: number
  /** Development suggestion text for reports. AI-generated when blank. */
  developmentSuggestion?: string
  /** Strength commentary text shown when this entity is a top-scoring area. */
  strengthCommentary?: string
  /** Optional content_sources.id — provenance label, not a tenant link. */
  sourceId?: string
  created_at: string
  updated_at?: string
  /** Soft-delete timestamp; NULL means active. */
  deletedAt?: string
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
  /** Client this factor belongs to (null = platform-global). */
  clientId?: string
  /** Behavioural indicators for low performance. */
  indicatorsLow?: string
  /** Behavioural indicators for mid performance. */
  indicatorsMid?: string
  /** Behavioural indicators for high performance. */
  indicatorsHigh?: string
  /** Short sentence describing what a low score on this entity means. */
  anchorLow?: string
  /** Short sentence describing what a high score on this entity means. */
  anchorHigh?: string
  /** Label for the low performance band. Null = global default ("Developing"). */
  bandLabelLow?: string
  /** Label for the mid performance band. Null = global default ("Effective"). */
  bandLabelMid?: string
  /** Label for the high performance band. Null = global default ("Highly Effective"). */
  bandLabelHigh?: string
  /** POMP upper boundary for low band. Null = global default (40). */
  pompThresholdLow?: number
  /** POMP lower boundary for high band. Null = global default (70). */
  pompThresholdHigh?: number
  /** Development suggestion text for reports. AI-generated when blank. */
  developmentSuggestion?: string
  /** Strength commentary text shown when this entity is a top-scoring area. */
  strengthCommentary?: string
  /** Optional content_sources.id — provenance label, not a tenant link. */
  sourceId?: string
  /** When true, the set of constructs linked to this factor is frozen. Defaults to false. */
  compositionLocked?: boolean
  /** Architect eligibility: decision types this factor suits (selection|development|team_composition). Empty = applies to all. */
  applicableOutcomes?: string[]
  /** Architect eligibility: seniority levels this factor suits (ic|first_line_manager|mid_manager|senior_leader|executive). Empty = applies to all. */
  applicableLevels?: string[]
  /** Architect eligibility: free-tag job functions this factor suits. Empty = applies to all. */
  applicableFunctions?: string[]
  /** High-level category (above dimensions) — the primary "kind of capability" this factor measures. */
  primaryCategoryId?: string
  /** Optional secondary category for cross-category factors (display-only in coverage maths for v1). */
  secondaryCategoryId?: string
  /** Two-tier quality gate: draft | assessment_ready | match_ready. */
  readiness?: 'draft' | 'assessment_ready' | 'match_ready'
  /** What this looks like when overused / the derailer. Required for match_ready. */
  overuseSignature?: string
  /** Factor slugs this is meant to be distinct from (nomological net). Required for match_ready. */
  contrastsWith?: string[]
  /** Where the construct comes from (framework / origin). Required for match_ready. */
  theoreticalLineage?: string
  reviewedBy?: string
  reviewedAt?: string
  created_at: string
  updated_at?: string
  /** Soft-delete timestamp; NULL means active. */
  deletedAt?: string
}

/** A high-level competency category (above dimensions) — classifies factors by kind of capability. */
export interface LibraryCategory {
  id: string
  key: string
  name: string
  definition: string
  decisionRule: string
  displayOrder: number
  colour?: string
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
  /** Short sentence describing what a low score on this entity means. */
  anchorLow?: string
  /** Short sentence describing what a high score on this entity means. */
  anchorHigh?: string
  /** Label for the low performance band. Null = global default ("Developing"). */
  bandLabelLow?: string
  /** Label for the mid performance band. Null = global default ("Effective"). */
  bandLabelMid?: string
  /** Label for the high performance band. Null = global default ("Highly Effective"). */
  bandLabelHigh?: string
  /** POMP upper boundary for low band. Null = global default (40). */
  pompThresholdLow?: number
  /** POMP lower boundary for high band. Null = global default (70). */
  pompThresholdHigh?: number
  /** Development suggestion text for reports. AI-generated when blank. */
  developmentSuggestion?: string
  /** Strength commentary text shown when this entity is a top-scoring area. */
  strengthCommentary?: string
  /** Optional content_sources.id — provenance label, not a tenant link. */
  sourceId?: string
  created_at: string
  updated_at?: string
  /** Soft-delete timestamp; NULL means active. */
  deletedAt?: string
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

/** The purpose of an assessment item — whether it scores a construct or serves a validity function. */
export type ItemPurpose = 'construct' | 'impression_management' | 'infrequency' | 'attention_check'

/** Difficulty band — the assessment composer spreads items evenly across these. */
export type ItemDifficulty = 'easy' | 'medium' | 'hard'

/**
 * A single assessment item (question/prompt) linked to a construct.
 */
export interface Item {
  /** UUID primary key. */
  id: string
  /** The construct this item measures — canonical link. */
  constructId?: string
  /** Response format governing how the item is presented. */
  responseFormatId: string
  /** The question / stimulus text presented to the participant (first person — self perspective). */
  stem: string
  /**
   * Observer/rater-perspective phrasing (third person), e.g. "This leader
   * communicates clearly". Rendered to raters in a 360; self sessions use `stem`.
   * NULL ⇒ no observer variant yet, so the item is not 360-eligible.
   */
  stemObserver?: string
  /** Whether scoring is reversed for this item. */
  reverseScored: boolean
  /**
   * Relative weight of this item's contribution to its construct score.
   * Default 1.0 — all items contribute equally.
   */
  weight: number
  /** Lifecycle status. */
  status: ItemStatus
  /** Display ordering weight within its assessment section. */
  displayOrder: number
  /** Purpose of this item — construct scoring or validity detection. */
  purpose: ItemPurpose
  /** Expected response value for attention check items. */
  keyedAnswer?: number
  created_at: string
  updated_at?: string
  /** Difficulty band — easy / medium / hard. Drives even distribution across the construct's selected items. */
  difficulty: ItemDifficulty
  /** Optional content_sources.id — provenance label, not a tenant link. */
  sourceId?: string
  /** Soft-delete timestamp; NULL means active. */
  deletedAt?: string
}

/**
 * Configurable threshold determining how many items per construct
 * are selected based on total construct count in an assessment.
 */
export interface ItemSelectionRule {
  /** UUID primary key. */
  id: string
  /** Minimum construct count for this rule to apply (inclusive). */
  minConstructs: number
  /** Maximum construct count (inclusive). NULL means "and above". */
  maxConstructs: number | null
  /** Number of items to select per construct when this rule matches. */
  itemsPerConstruct: number
  /** Display ordering weight. */
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

/** Intro screen content owned by an assessment. */
export interface AssessmentIntroContent {
  enabled: boolean
  heading: string
  body: string
  buttonLabel: string
}

/** Campaign-level override for an assessment's intro screen. */
export type IntroOverride =
  | null
  | { suppress: true }
  | { heading: string; body: string; buttonLabel: string }

/**
 * A named assessment instrument that groups competencies and items
 * into a deliverable test.
 */
export interface Assessment {
  /** UUID primary key. */
  id: string
  /** Owning partner for partner-scoped assessments. */
  partnerId?: string
  /** Owning client (optional — assigned when deployed to an org). */
  clientId?: string
  /** Assessment display title. */
  title: string
  /** Longer description / purpose statement. */
  description?: string
  /** Lifecycle status. */
  status: AssessmentStatus
  /** How items are chosen for participants. */
  itemSelectionStrategy: ItemSelectionStrategy
  /** Algorithm used to convert responses to scores. */
  scoringMethod: ScoringMethod
  /** How the assessment was created. */
  creationMode: AssessmentCreationMode
  /** Delivery format — traditional per-item or forced-choice blocks. */
  formatMode: FormatMode
  /** Number of items per forced-choice block (3 or 4). Only set when formatMode is forced_choice. */
  fcBlockSize?: number
  /** Matching run that generated this assessment (if AI-created). */
  matchingRunId?: string
  /** Intro screen content shown before the assessment runner. */
  introContent?: AssessmentIntroContent | null
  /** Minimum number of factors a campaign must select when customising this assessment (NULL = no customisation). */
  minCustomFactors: number | null
  /** Optional content_sources.id — provenance label, not a tenant link. */
  sourceId?: string
  created_at: string
  updated_at?: string
  /** Soft-delete timestamp; NULL means active. */
  deletedAt?: string
}

/**
 * Junction between an assessment and the factors it measures,
 * including per-factor configuration.
 */
export interface AssessmentFactor {
  /** UUID primary key. */
  id: string
  /** Parent assessment. */
  assessmentId: string
  /** Linked factor. */
  factorId: string
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
 * scoped to one client and one subject (the person being rated).
 */
export interface DiagnosticSession {
  /** UUID primary key. */
  id: string
  /** Client running the session. */
  clientId: string
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
 * Bridge linking a diagnostic dimension to taxonomy factors,
 * seeding AI matching context. Admin controls which factors
 * are relevant to each diagnostic dimension.
 */
export interface DiagnosticCompetencyHint {
  /** UUID primary key. */
  id: string
  /** The diagnostic dimension. */
  diagnosticDimensionId: string
  /** The taxonomy factor. */
  factorId: string
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
  /** Purpose this task config applies to. */
  purpose?: AIPromptPurpose
  /** Model identifier (e.g. "claude-opus-4-20250514", "gpt-4o"). */
  modelId: string
  /** Human-friendly display name. */
  displayName: string
  /** Config JSONB persisted with the model selection. */
  config: { temperature?: number; max_tokens?: number }
  /** Whether this row is marked as the provider default. */
  isDefault: boolean
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
  /** Human-readable prompt name. */
  name: string
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
  /** Client the matching was run for. */
  clientId: string
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
 * A single ranked factor produced by a matching run,
 * including the AI's reasoning for the ranking.
 */
export interface MatchingResult {
  /** UUID primary key. */
  id: string
  /** Parent matching run. */
  matchingRunId: string
  /** The factor that was ranked. */
  factorId: string
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
// Participant assessment session tables
// ---------------------------------------------------------------------------

/**
 * An individual participant's attempt at an assessment,
 * tracking progress, timing and final status.
 */
export interface ParticipantSession {
  /** UUID primary key. */
  id: string
  /** The assessment being taken. */
  assessmentId: string
  /** Profile of the participant. */
  participantProfileId: string
  /** Current session progress status. */
  status: ParticipantSessionStatus
  /** Downstream processing state after submission. */
  processingStatus: ParticipantSessionProcessingStatus
  /** Most recent downstream processing error. */
  processingError?: string
  /** ISO-8601 timestamp when the participant started the assessment. */
  startedAt?: string
  /** ISO-8601 timestamp when the session was completed or expired. */
  completedAt?: string
  /** ISO-8601 timestamp when downstream processing last reached a ready state. */
  processedAt?: string
  /** Browser / OS information captured at session start. */
  userAgent?: string
  /** Client IP address captured at session start. */
  ipAddress?: string
  created_at: string
  updated_at?: string
}

/**
 * A participant's response to a single item within an assessment session.
 */
export interface ParticipantResponse {
  /** UUID primary key. */
  id: string
  /** Parent participant session. */
  sessionId: string
  /** The item that was answered. */
  itemId: string
  /** The assessment section this response belongs to. */
  sectionId?: string
  /** The recorded response value (numeric encoding of the chosen option). */
  responseValue: number
  /** Time in milliseconds the participant spent on this item. */
  responseTimeMs?: number
  /** Display order position at which this item was presented. */
  presentationOrder: number
  created_at: string
  updated_at?: string
}

/**
 * A computed score for one factor within a participant session,
 * persisted after the scoring engine runs.
 */
export interface ParticipantScore {
  /** UUID primary key. */
  id: string
  /** Parent participant session. */
  sessionId: string
  /** The factor that was scored. */
  factorId: string
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
  /** Participant-facing instruction text shown at section start. */
  instructions?: string
  /** Display ordering weight. */
  displayOrder: number
  /** How items are ordered within this section. */
  itemOrdering: ItemOrdering
  /** Optional duration override (seconds) — used only to override the
   *  duration estimate shown to participants. Not enforced as a timer. */
  timeLimitSeconds?: number
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
  /** Optionally scoped to a specific client. */
  clientId?: string
  /** Number of participants in the norm sample. */
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
  /** Number of participants in this specific norm. */
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
 * Typically contains 3–4 items that the participant must rank or select from.
 */
export interface ForcedChoiceBlock {
  /** UUID primary key. */
  id: string
  /** Parent assessment this block belongs to. */
  assessmentId: string
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

// ---------------------------------------------------------------------------
// Campaign management
// ---------------------------------------------------------------------------

/**
 * Operational container that holds assessments, manages participants,
 * and controls access windows for deploying assessments.
 */
export interface Campaign {
  /** UUID primary key. */
  id: string
  /** Campaign display title. */
  title: string
  /** URL-safe slug. */
  slug: string
  /** Longer description / purpose statement. */
  description?: string
  /** Lifecycle status. */
  status: CampaignStatus
  /** Campaign kind — self-assessment (default) or leadership 360 (multi-rater). */
  kind: CampaignKind
  /** Owning client (optional). */
  clientId?: string
  /** Owning partner (optional). */
  partnerId?: string
  /** Profile ID of the user who created the campaign. */
  createdBy?: string
  /** When the campaign opens for participants. */
  opensAt?: string
  /** When the campaign closes. */
  closesAt?: string
  /** Branding configuration (logo, colors, welcome message). */
  branding: Record<string, unknown>
  /** Whether participants can resume an in-progress session. */
  allowResume: boolean
  /** Whether to show progress indicators to participants. */
  showProgress: boolean
  /** Whether to randomize the order assessments are presented. */
  randomizeAssessmentOrder: boolean
  created_at: string
  updated_at?: string
  /** Soft-delete timestamp; NULL means active. */
  deletedAt?: string
}

/**
 * A 360 rater of a subject within a leadership_360 campaign. Distinct from
 * campaign_participants: the subject is a participant; their raters are these.
 */
export interface CampaignRater {
  id: string
  campaignId: string
  /** The campaign_participant being rated. */
  subjectParticipantId: string
  relationship: RaterRelationship
  name?: string
  email: string
  /** Magic-link token for anonymous survey access (never exposed to the subject). */
  accessToken: string
  /** The runner session this rater fills out, once started. */
  sessionId?: string
  status: RaterStatus
  nominatedBy?: string
  approvedBy?: string
  nominatedAt: string
  approvedAt?: string
  invitedAt?: string
  startedAt?: string
  completedAt?: string
  /** When a reminder email was last sent to this rater. */
  lastRemindedAt?: string
  created_at: string
  updated_at?: string
}

/**
 * Immutable aggregate snapshot produced when a 360 campaign closes.
 * Aggregate-only — never per-rater rows. One per campaign.
 */
export interface Campaign360Snapshot {
  id: string
  campaignId: string
  subjectParticipantId: string
  /** Per-category means, self-vs-others gaps, Johari quadrants, suppression flags. */
  data: Record<string, unknown>
  raterCount: number
  /** e.g. {"manager":1,"peer":4,"direct_report":5}. */
  raterCountByCategory: Record<string, number>
  generatedAt: string
  generatedBy?: string
}

/**
 * Junction linking an assessment to a campaign with ordering.
 */
export interface CampaignAssessment {
  /** UUID primary key. */
  id: string
  /** Parent campaign. */
  campaignId: string
  /** Linked assessment. */
  assessmentId: string
  /** Display ordering weight. */
  displayOrder: number
  /** Whether this assessment is required to complete the campaign. */
  isRequired: boolean
  /** Campaign-level override for the assessment intro screen. */
  introOverride?: IntroOverride
  created_at: string
}

/**
 * Junction linking a campaign-assessment to a specific factor,
 * used when the campaign customises which factors are measured.
 */
export interface CampaignAssessmentFactor {
  /** UUID primary key. */
  id: string
  /** Parent campaign-assessment junction row. */
  campaignAssessmentId: string
  /** Selected factor. */
  factorId: string
  created_at: string
}

/**
 * A person invited to take assessments in a campaign.
 * Token-based auth — no login required.
 */
export interface CampaignParticipant {
  /** UUID primary key. */
  id: string
  /** Parent campaign. */
  campaignId: string
  /** Participant email. */
  email: string
  /** Given name. */
  firstName?: string
  /** Family name. */
  lastName?: string
  /** Optional job title collected during self-registration. */
  jobTitle?: string
  /** Optional company collected during self-registration. */
  company?: string
  /** Unique 64-char hex token used as URL identifier. */
  accessToken: string
  /** Progress status within the campaign. */
  status: CampaignParticipantStatus
  /** When the invitation was sent. */
  invitedAt: string
  /** When the participant started. */
  startedAt?: string
  /** When the participant completed all assessments. */
  completedAt?: string
  /** When consent was recorded. */
  consentGivenAt?: string
  created_at: string
  updated_at?: string
  participantSessions?: { id: string; status: string }[]
}

/**
 * Shareable enrollment link that allows self-registration into a campaign.
 */
export interface CampaignAccessLink {
  /** UUID primary key. */
  id: string
  /** Parent campaign. */
  campaignId: string
  /** Unique token for the link URL. */
  token: string
  /** Optional descriptive label. */
  label?: string
  /** Maximum allowed uses (NULL = unlimited). */
  maxUses?: number
  /** Current use count. */
  useCount: number
  /** When the link expires. */
  expiresAt?: string
  /** Whether the link is currently active. */
  isActive: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Org Diagnostic Entities
// ---------------------------------------------------------------------------

/**
 * Versioned, immutable snapshot of a client's diagnostic profile (org-level
 * or role-level). Produced when a campaign closes.
 */
export interface OrgDiagnosticProfile {
  /** UUID primary key. */
  id: string
  /** Owning client. */
  clientId: string
  /** Source campaign (1:1). */
  campaignId: string
  /** baseline (from a baseline campaign) or role (from a role_rep campaign). */
  kind: OrgDiagnosticProfileKind
  /** For role-kind snapshots: the baseline snapshot this role is anchored to. */
  pinnedBaselineSnapshotId?: string
  /** Composite snapshot data — per-respondent-type aggregates + gap analysis. Internal shape defined by the future scoring spec. */
  data: Record<string, unknown>
  /** Total respondents whose data is included. */
  respondentCount: number
  /** Per-type counts, e.g. { employee: 24, senior_leader: 6 }. */
  respondentCountByType: Record<string, number>
  /** When the snapshot was generated. */
  generatedAt: string
  /** Profile ID of the user who triggered generation. */
  generatedBy?: string
}

/**
 * A position the client is hiring for. Pinned at creation to a baseline
 * diagnostic snapshot; the pin is read-only after creation except via the
 * explicit re-pin admin operation (see spec §3.4).
 */
export interface ClientRole {
  /** UUID primary key. */
  id: string
  /** Owning client. */
  clientId: string
  /** Role title, e.g. "Head of Product". */
  title: string
  /** Department/function, free text in MVP. */
  function?: string
  /** Hiring manager display name. */
  hiringManagerName?: string
  /** Hiring manager email (CITEXT). */
  hiringManagerEmail?: string
  /** Baseline snapshot this role is locked to. */
  pinnedBaselineSnapshotId: string
  /** Lifecycle status. */
  status: ClientRoleStatus
  created_at: string
  updated_at?: string
  /** Soft-delete timestamp. */
  deletedAt?: string
  /** Profile ID of creator. */
  createdBy?: string
}

/**
 * A diagnostic data-collection campaign (baseline or role_rep). Holds N
 * instrument tracks and N respondents. Produces one OrgDiagnosticProfile
 * snapshot when closed.
 */
export interface OrgDiagnosticCampaign {
  /** UUID primary key. */
  id: string
  /** Owning client. */
  clientId: string
  /** baseline = OPS+/-LCQ; role_rep = REP for one role. */
  kind: OrgDiagnosticCampaignKind
  /** For role_rep campaigns: the role being assessed. NULL for baseline. */
  clientRoleId?: string
  /** For role_rep campaigns: the baseline snapshot this campaign anchors to. NULL for baseline. */
  pinnedBaselineSnapshotId?: string
  /** Display title. */
  title: string
  /** Optional description. */
  description?: string
  /** Lifecycle status. */
  status: OrgDiagnosticCampaignStatus
  /** Default open date — tracks inherit if their own opens_at is NULL. */
  defaultOpensAt?: string
  /** Default close date — tracks inherit if their own closes_at is NULL. */
  defaultClosesAt?: string
  /** Set when status transitions to 'closed'. */
  closedAt?: string
  created_at: string
  updated_at?: string
  /** Soft-delete timestamp. */
  deletedAt?: string
  /** Profile ID of creator. */
  createdBy?: string
}

/**
 * Per-instrument track inside a campaign. One track per instrument the
 * campaign is administering. Inherits campaign-level dates if its own are
 * NULL.
 */
export interface OrgDiagnosticCampaignTrack {
  /** UUID primary key. */
  id: string
  /** Parent campaign. */
  campaignId: string
  /** The instrument administered in this track. */
  instrument: OrgDiagnosticInstrument
  /** Override open date — falls back to campaign default. */
  opensAt?: string
  /** Override close date — falls back to campaign default. */
  closesAt?: string
  /** Track lifecycle. */
  status: OrgDiagnosticTrackStatus
  /** Set when status transitions to 'closed'. */
  closedAt?: string
  created_at: string
  updated_at?: string
}

/**
 * A person invited to complete one instrument in one diagnostic campaign.
 * Token-based access — no Supabase Auth required. Identity is hidden from
 * client admins per the anonymity contract (spec §1.6).
 */
export interface OrgDiagnosticRespondent {
  /** UUID primary key. */
  id: string
  /** Parent campaign. */
  campaignId: string
  /** Track within that campaign — determines which instrument this respondent sees. */
  trackId: string
  /** Respondent's role/perspective. */
  respondentType: OrgDiagnosticRespondentType
  /** Display name (optional — may be missing from CSV upload). */
  name?: string
  /** Email (CITEXT in DB). */
  email: string
  /** Unique 64-char hex token used as URL identifier. */
  accessToken: string
  /** Progress status. */
  status: OrgDiagnosticRespondentStatus
  /** When the invitation was created. */
  invitedAt: string
  /** When the respondent first opened the survey. */
  startedAt?: string
  /** When the respondent finished. */
  completedAt?: string
  created_at: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Brand Configuration
// ---------------------------------------------------------------------------

// Re-export brand types from their canonical location
export type {
  BrandConfig,
  BrandConfigRow,
  BrandConfigRecord,
  BrandOwnerType,
  NeutralTemperature,
  BorderRadiusPreset,
} from '@/lib/brand/types'

// ---------------------------------------------------------------------------
// AI-GENIE item generation
// ---------------------------------------------------------------------------

/** Configuration snapshot stored with a generation run. */
export interface ConstructConfigOverride {
  definition?: string
  description?: string
  indicatorsLow?: string
  indicatorsMid?: string
  indicatorsHigh?: string
  anchorLow?: string
  anchorHigh?: string
}

/** Item shape the LLM is asked to write. */
export type MeasurementMode = 'behavioural' | 'trait' | 'capability' | 'situational' | 'open'

/** Intended consumer of the items. */
export type UseContext = 'development' | 'selection' | 'research' | 'open'

/** Reading-level and contextualisation target. `level` is structured; `description` is free-text. */
export interface Audience {
  level?: 'entry' | 'mid' | 'senior' | 'executive' | 'mixed' | 'open'
  description?: string
}

/** Verdict and reason for an exemplar item shown to the LLM. */
export interface PresetExemplar {
  stem: string
  verdict: 'good' | 'bad'
  reason: string
}

/** Snapshot of playbook content resolved at run kickoff. Recorded on the run for reproducibility. */
export interface PlaybookSnapshot {
  rubric?: string
  exemplars?: PresetExemplar[]
  critiqueEmphasis?: string
  sdTolerance?: 'low' | 'moderate' | 'high'
  difficultyMix?: { easy?: number; moderate?: number; hard?: number }
  critiqueStrictness?: 'lenient' | 'standard' | 'strict'
  sourcePresetId?: string
  sourcePresetName?: string
  modifiedFromPreset?: boolean
}

/** A playbook template for the AI item generator. */
export interface GenerationPreset {
  id: string
  name: string
  description?: string
  measurementMode: MeasurementMode
  measurementModeDescription?: string
  audience: Audience
  useContext: UseContext
  useContextDescription?: string
  responseFormatId?: string
  responseFormatRationale?: string
  rubric?: string
  exemplars: PresetExemplar[]
  critiqueEmphasis?: string
  sdTolerance?: 'low' | 'moderate' | 'high'
  difficultyMix?: { easy?: number; moderate?: number; hard?: number }
  critiqueStrictness: 'lenient' | 'standard' | 'strict'
  pipelineDefaults: {
    enableItemCritique?: boolean
    enableLeakageGuard?: boolean
    enableDifficultyTargeting?: boolean
    enableSyntheticValidation?: boolean
  }
  recommendedTargetPerConstruct: number
  createdAt: string
  updatedAt: string
  deletedAt?: string
  createdBy?: string
}

export interface GenerationRunConfig {
  constructIds: string[]
  targetItemsPerConstruct: number
  temperature: number
  generationModel: string
  embeddingModel: string
  networkEstimator?: 'tmfg' | 'ebicglasso'
  responseFormatId?: string
  promptPurpose?: 'item_generation' | 'factor_item_generation'
  constructOverrides?: Record<string, ConstructConfigOverride>
  enableItemCritique?: boolean
  enableLeakageGuard?: boolean
  enableDifficultyTargeting?: boolean
  enableSyntheticValidation?: boolean

  // Steering inputs added in the refactor. All optional for back-compat;
  // absence falls back to the implicit behavioural-Likert defaults.
  presetId?: string
  measurementMode?: MeasurementMode
  measurementModeDescription?: string
  audience?: Audience
  useContext?: UseContext
  useContextDescription?: string

  // Resolved-at-run-time snapshot of playbook content. Captured before the
  // pipeline starts so the run is reproducible regardless of later preset edits.
  playbookSnapshot?: PlaybookSnapshot
}

/** An AI-GENIE item generation run record. */
export interface GenerationRun {
  id: string
  status: GenerationRunStatus
  currentStep?: string
  progressDetail?: string
  progressPct: number
  config: GenerationRunConfig
  itemsGenerated: number
  itemsAfterUva?: number
  itemsAfterBoot?: number
  itemsAccepted?: number
  nmiInitial?: number
  nmiFinal?: number
  promptVersion?: number
  modelUsed?: string
  aiSnapshot?: {
    models?: Partial<Record<AIPromptPurpose, string>>
    prompts?: Partial<Record<AIPromptPurpose, { id: string; version: number }>>
    preflight?: {
      similarityThreshold: number
      llmPairCount: number
      pairCount: number
    }
    embeddingType?: 'full' | 'sparse'
    networkEstimator?: 'tmfg' | 'ebicglasso'
    walktrapStep?: number
    nmiByStage?: Partial<Record<'initial' | 'postEmbeddingSelection' | 'postUva' | 'postBoot' | 'final', number>>
    uvaSweeps?: number
    bootSweeps?: number
    pipelineStages?: {
      critique?: { itemsReviewed: number; kept: number; revised: number; dropped: number; critiqueFailed?: boolean }
      leakageGuard?: { itemsChecked: number; flagged: number }
      difficultyTargeting?: { enabled: true }
      syntheticValidation?: { respondentsGenerated: number; estimatedAlpha?: Record<string, number> }
    }
  }
  tokenUsage?: Record<string, number>
  errorMessage?: string
  startedAt?: string
  completedAt?: string
  created_at: string
  updated_at?: string
}

/** A candidate item generated during a generation run (before acceptance). */
export interface GeneratedItem {
  id: string
  generationRunId: string
  constructId: string
  stem: string
  /** Observer-perspective phrasing produced by dual-mode generation; copied to items.stem_observer on accept. */
  stemObserver?: string
  reverseScored: boolean
  rationale?: string
  embedding: number[]
  communityId?: number
  initialCommunityId?: number
  finalCommunityId?: number
  wtoMax?: number
  bootStability?: number
  removalStage?: 'critique' | 'leakage' | 'uva' | 'boot_ega' | 'kept'
  removalSweep?: number
  isRedundant: boolean
  isUnstable: boolean
  isAccepted?: boolean
  savedItemId?: string
  difficultyTier?: 'easy' | 'moderate' | 'hard' | 'foundation' | 'applied' | 'demanding'
  sdRisk?: 'low' | 'moderate' | 'high'
  facet?: string
  pipeline_metadata?: {
    critiqueVerdict?: 'kept' | 'revised' | 'dropped'
    critiqueReason?: string
    critiqueOriginalStem?: string
    leakageScore?: number
    leakageTarget?: string
    difficultyEstimate?: number
  }
  created_at: string
}

/** Audit log entry for a pipeline step within a generation run. */
export interface GenerationRunLog {
  id: string
  generationRunId: string
  step: string
  status: string
  details?: Record<string, unknown>
  durationMs?: number
  created_at: string
}

// ---------------------------------------------------------------------------
// Report generation tables
// ---------------------------------------------------------------------------

/**
 * Reusable report layout for a single audience.
 * Blocks are an ordered JSONB array of BlockConfig objects.
 */
export interface ReportTemplate {
  id: string
  partnerId?: string
  name: string
  description?: string
  reportType: ReportType
  displayLevel: ReportDisplayLevel
  groupByDimension: boolean
  personReference: PersonReferenceType
  autoRelease: boolean
  pageHeaderLogo: 'primary' | 'secondary' | 'none'
  blocks: Record<string, unknown>[]  // BlockConfig[] — typed in src/lib/reports/types.ts
  customReportSlug?: string  // When set, runner dispatches to a registered custom report instead of resolving blocks
  isActive: boolean
  isDefault: boolean
  deletedAt?: string
  created_at: string
  updated_at?: string
}

/**
 * Links a report template to a campaign.
 * Each row = one report generated per completed session.
 */
export interface CampaignReportTemplate {
  id: string
  campaignId: string
  templateId: string
  sortOrder: number
  created_at: string
}

/**
 * A point-in-time rendered report for one participant session.
 */
export interface ReportSnapshot {
  id: string
  templateId: string
  participantSessionId: string
  campaignId: string
  status: ReportSnapshotStatus
  narrativeMode: NarrativeModeType
  renderedData?: Record<string, unknown>  // ResolvedBlockData[] — typed in runner
  pdfUrl?: string
  pdfStatus?: ReportPdfStatus
  pdfErrorMessage?: string
  releasedAt?: string
  releasedBy?: string
  generatedAt?: string
  errorMessage?: string
  created_at: string
  updated_at?: string
}

// --- Client Entitlements ---

export interface ClientAssessmentAssignment {
  id: string
  clientId: string
  assessmentId: string
  quotaLimit: number | null // null = unlimited
  isActive: boolean
  assignedBy: string
  created_at: string
  updated_at: string
}

export interface ClientReportTemplateAssignment {
  id: string
  clientId: string
  reportTemplateId: string
  isActive: boolean
  assignedBy: string
  created_at: string
  updated_at: string
}

/** Assessment assignment enriched with usage data and assessment metadata */
export interface AssessmentAssignmentWithUsage extends ClientAssessmentAssignment {
  assessmentName: string
  quotaUsed: number
}

export interface PartnerAssessmentAssignment {
  id: string
  partnerId: string
  assessmentId: string
  quotaLimit: number | null // null = unlimited
  isActive: boolean
  assignedBy: string
  created_at: string
  updated_at: string
}

export interface PartnerReportTemplateAssignment {
  id: string
  partnerId: string
  reportTemplateId: string
  isActive: boolean
  assignedBy: string
  created_at: string
  updated_at: string
}

/** Partner assessment assignment enriched with usage data and assessment metadata */
export interface PartnerAssessmentAssignmentWithUsage extends PartnerAssessmentAssignment {
  assessmentName: string
  quotaUsed: number
}

export interface PartnerTaxonomyAssignment {
  id: string
  partnerId: string
  entityType: 'dimension' | 'factor' | 'construct'
  entityId: string
  isActive: boolean
  assignedBy: string
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Billing (Business Centre)
// ---------------------------------------------------------------------------

/** Lifecycle status of an invoice, mirroring Stripe's invoice statuses. */
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'

/** Which billing flow produced an invoice. */
export type InvoiceKind = 'one_off' | 'usage' | 'subscription'

/**
 * The party Trajectas invoices. v1 always points at a client (clientId set,
 * partnerId null); partnerId is scaffolding for future reseller billing.
 */
export interface BillingAccount {
  id: string
  clientId: string | null
  partnerId: string | null
  stripeCustomerId: string | null
  legalName: string | null
  billingEmail: string | null
  country: string
  taxId: string | null
  paymentTermsDays: number
  currency: string
  usageBillingEnabled: boolean
  usageUnit: string
  usageUnitPriceCents: number
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
  deletedAt: string | null
}

/** A single line on an invoice (display snapshot; Stripe owns the canonical). */
export interface InvoiceLineItem {
  description: string
  quantity: number
  unitAmountCents: number
}

/** Local mirror of a Stripe invoice. Amounts are integer minor units (cents). */
export interface Invoice {
  id: string
  billingAccountId: string
  stripeInvoiceId: string | null
  number: string | null
  kind: InvoiceKind
  status: InvoiceStatus
  currency: string
  subtotalCents: number
  taxCents: number
  totalCents: number
  amountDueCents: number
  amountPaidCents: number
  description: string | null
  lineItems: InvoiceLineItem[]
  hostedInvoiceUrl: string | null
  invoicePdfUrl: string | null
  metadata: Record<string, unknown>
  dueAt: string | null
  issuedAt: string | null
  paidAt: string | null
  voidedAt: string | null
  created_at: string
  updated_at: string
}

/** An invoice plus a human label for the account it belongs to (admin list). */
export interface InvoiceListItem extends Invoice {
  accountLabel: string
}

/** A client option for the create-invoice picker. */
export interface BillingClientOption {
  id: string
  name: string
}

/**
 * Actual product usage rolled up per client, for the Business → Usage view.
 * Counts come from `campaigns_with_counts` (raters/deleted already excluded):
 * `participantsInvited` = survey-takers invited; `assessmentsCompleted` = those
 * who finished. Both are shown rather than committing to one billable unit.
 */
export interface ClientUsageRow {
  clientId: string
  clientName: string
  isActive: boolean
  campaignsTotal: number
  campaignsActive: number
  participantsInvited: number
  assessmentsCompleted: number
  /** completed / invited, or null when nobody has been invited yet. */
  completionRate: number | null
  /** Most recent campaign activity, or null if the client has no campaigns. */
  lastActivityAt: string | null
}

/**
 * Immutable per-period usage frozen at billing time. The billed `quantity`
 * cannot drift afterward even if participants are later withdrawn/deleted.
 */
export interface UsageSnapshot {
  id: string
  billingAccountId: string
  periodStart: string
  periodEnd: string
  unit: string
  quantity: number
  unitPriceCents: number
  amountCents: number
  invoiceId: string | null
  created_at: string
}
