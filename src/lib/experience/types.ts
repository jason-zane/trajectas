// =============================================================================
// Experience template types
// =============================================================================

/** Page types in the participant experience flow. */
export type ExperiencePageType =
  | 'join'
  | 'welcome'
  | 'consent'
  | 'demographics'
  | 'section_intro'
  | 'runner'
  | 'review'
  | 'complete'
  | 'report'
  | 'expired'

/** Who owns an experience template. */
export type ExperienceOwnerType = 'platform' | 'campaign'

/** Report display mode. */
export type ReportMode = 'holding' | 'view_results'

// ---------------------------------------------------------------------------
// Page content slots
// ---------------------------------------------------------------------------

export interface JoinContent {
  heading: string
  body: string
  buttonLabel: string
  footerText?: string
  marketingConsentEnabled: boolean
  marketingConsentRequired: boolean
  marketingConsentLabel: string
}

export interface WelcomeContent {
  eyebrow: string
  heading: string
  body: string
  infoHeading: string
  infoItems: string[]
  buttonLabel: string
  resumeButtonLabel: string
  footerText?: string
}

export interface ConsentContent {
  eyebrow: string
  heading: string
  /** Supports markdown. */
  body: string
  consentCheckboxLabel: string
  buttonLabel: string
  footerText?: string
}

export interface DemographicsContent {
  eyebrow: string
  heading: string
  body: string
  buttonLabel: string
  footerText?: string
}

export interface SectionIntroContent {
  eyebrow: string
  heading: string
  body: string
  buttonLabel: string
  footerText?: string
}

export interface RunnerContent {
  backButtonLabel: string
  saveStatusIdle: string
  saveStatusSaving: string
  saveStatusSaved: string
  continueButtonLabel: string
  footerText?: string
}

export interface ReviewContent {
  eyebrow: string
  heading: string
  body: string
  buttonLabel: string
  incompleteWarning: string
  footerText?: string
}

export interface CompleteContent {
  heading: string
  body: string
  footerText?: string
  redirectUrl?: string
  redirectLabel?: string
}

export interface ReportContent {
  heading: string
  body: string
  buttonLabel: string
  reportMode: ReportMode
  footerText?: string
  redirectUrl?: string
  redirectLabel?: string
}

export interface ExpiredContent {
  heading: string
  body: string
  footerText?: string
}

/** Custom page content — simple content page added by the user. */
export interface CustomPageContent {
  eyebrow?: string
  heading: string
  body: string
  buttonLabel: string
  footerText?: string
}

/** Custom page entry in the flow config. */
export interface CustomPageConfig {
  id: string       // "custom_1", "custom_2", etc.
  label: string    // User-visible name in editor
  enabled: boolean
  order: number
}

/** Map of page type → content shape. */
export interface PageContentMap {
  join: JoinContent
  welcome: WelcomeContent
  consent: ConsentContent
  demographics: DemographicsContent
  section_intro: SectionIntroContent
  runner: RunnerContent
  review: ReviewContent
  complete: CompleteContent
  report: ReportContent
  expired: ExpiredContent
}

// ---------------------------------------------------------------------------
// Flow config
// ---------------------------------------------------------------------------

export interface FlowPageConfig {
  enabled: boolean
  order: number
}

export interface ReportFlowConfig extends FlowPageConfig {
  reportMode: ReportMode
}

export interface FlowConfig {
  join: FlowPageConfig
  welcome: FlowPageConfig
  consent: FlowPageConfig
  demographics: FlowPageConfig
  review: FlowPageConfig
  complete: FlowPageConfig
  report: ReportFlowConfig
  expired: FlowPageConfig
  customPages?: CustomPageConfig[]
}

// ---------------------------------------------------------------------------
// Demographics config
// ---------------------------------------------------------------------------

export type DemographicsFieldType = 'select' | 'text'

export interface DemographicsFieldOption {
  value: string
  label: string
}

export interface DemographicsFieldConfig {
  key: string
  enabled: boolean
  required: boolean
  label: string
  type: DemographicsFieldType
  options?: DemographicsFieldOption[]
}

export interface DemographicsConfig {
  fields: DemographicsFieldConfig[]
}

// ---------------------------------------------------------------------------
// Full template
// ---------------------------------------------------------------------------

export interface ExperienceTemplate {
  pageContent: Partial<PageContentMap>
  flowConfig: Partial<FlowConfig>
  demographicsConfig: DemographicsConfig
  customPageContent?: Record<string, CustomPageContent>
  privacyUrl?: string
  termsUrl?: string
}

// ---------------------------------------------------------------------------
// Database row
// ---------------------------------------------------------------------------

export interface ExperienceTemplateRow {
  id: string
  owner_type: ExperienceOwnerType
  owner_id: string | null
  page_content: Partial<PageContentMap>
  flow_config: Partial<FlowConfig>
  demographics_config: DemographicsConfig
  custom_page_content: Record<string, CustomPageContent>
  privacy_url: string | null
  terms_url: string | null
  created_at: string
  updated_at: string | null
  deleted_at: string | null
}

/** Camel-case TypeScript representation. */
export interface ExperienceTemplateRecord {
  id: string
  ownerType: ExperienceOwnerType
  ownerId: string | null
  pageContent: Partial<PageContentMap>
  flowConfig: Partial<FlowConfig>
  demographicsConfig: DemographicsConfig
  customPageContent: Record<string, CustomPageContent>
  privacyUrl: string | null
  termsUrl: string | null
  createdAt: string
  updatedAt: string | null
  deletedAt: string | null
}

// ---------------------------------------------------------------------------
// Template variables available for interpolation
// ---------------------------------------------------------------------------

export interface TemplateVariables {
  participantName?: string
  campaignTitle?: string
  assessmentCount?: number
  clientName?: string
  campaignDescription?: string
  sectionTitle?: string
  sectionNumber?: number
}
