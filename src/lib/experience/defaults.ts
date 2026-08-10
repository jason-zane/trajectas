import type {
  PageContentMap,
  FlowConfig,
  DemographicsConfig,
  ExperienceTemplate,
} from './types'

// =============================================================================
// Default page content — extracted from current hardcoded text in components
// =============================================================================

export const DEFAULT_PAGE_CONTENT: Readonly<PageContentMap> = {
  join: {
    heading: 'Register to begin.',
    body: "We'll use this to create your personal access link.",
    buttonLabel: 'Continue',
    marketingConsentEnabled: false,
    marketingConsentRequired: false,
    marketingConsentLabel: 'I agree to receive communications about future opportunities and insights.',
  },

  welcome: {
    eyebrow: '{{campaignTitle}}',
    heading: '{{timeOfDayGreeting}}, {{participantName}}. This is about how you work best.',
    body: 'There are no right answers — your first instinct is usually the truest one. Your responses save automatically, and you can pause and return any time.',
    infoHeading: 'Before you begin',
    infoItems: [
      'This campaign contains {{assessmentCount}} assessment(s).',
      'Takes about {{estimatedMinutes}} minutes.',
      'There are no right or wrong answers — respond honestly.',
    ],
    buttonLabel: 'Begin assessment',
    resumeButtonLabel: 'Resume assessment',
  },

  consent: {
    eyebrow: 'Before you begin',
    heading: 'How your answers are used.',
    body: '- Your responses are used to generate a profile based on validated psychometric constructs.\n- Results are used for professional development and/or selection purposes.\n- Your responses save automatically — you may pause, or withdraw at any time by closing this page.',
    consentCheckboxLabel: 'I have read and agree to the above information',
    buttonLabel: 'Continue',
  },

  demographics: {
    eyebrow: 'A little about you',
    heading: 'Help us read the results fairly.',
    body: 'Used only to compare groups fairly — never to identify you.',
    buttonLabel: 'Continue',
  },

  runner: {
    backButtonLabel: 'Back',
    saveStatusIdle: 'Autosave on',
    saveStatusSaving: 'Saving…',
    saveStatusSaved: 'Saved a moment ago',
    continueButtonLabel: 'Continue',
    footerText: 'Powered by Trajectas',
  },

  review: {
    eyebrow: 'Review & submit',
    heading: 'Review Your Responses',
    body: '{{answeredCount}} of {{totalItems}} questions answered',
    buttonLabel: 'Submit assessment',
    incompleteWarning:
      'You have unanswered questions. You can still submit, but incomplete sections may affect your results.',
  },

  complete: {
    heading: 'Thank you, {{participantName}}.',
    body: 'Your assessment has been submitted. You can safely close this page.',
    redirectUrl: 'https://trajectas.com',
  },

  report: {
    heading: 'Your Report',
    // No automatic participant email exists on release — do not promise one.
    // The report page polls and updates itself when the report is ready.
    body: 'Your report is being prepared. It will appear here automatically once it is ready.',
    buttonLabel: 'View Report',
    reportMode: 'holding',
  },

  expired: {
    heading: 'Link Expired',
    body: 'This assessment link is no longer valid. The campaign may have closed or your access may have been revoked. Please contact your administrator.',
  },
}

/**
 * Default consent body for aggregate-only confidentiality mode.
 * Replaces the "Results are used for..." line with a guarantee that
 * individual answers are never visible to the organization.
 */
export const AGGREGATE_ONLY_CONSENT_BODY = `- Your responses are used to generate a profile based on validated psychometric constructs.
- {{brandName}} receives group-level patterns only — never your individual answers.
- Your responses save automatically — you may pause, or withdraw at any time by closing this page.`

// =============================================================================
// Default flow config — order mirrors the participant journey
// =============================================================================

export const DEFAULT_FLOW_CONFIG: Readonly<FlowConfig> = {
  join: { enabled: true, order: 10 },
  welcome: { enabled: true, order: 20 },
  consent: { enabled: false, order: 30 },
  demographics: { enabled: false, order: 40 },
  // Pages with order < 100 are pre-assessment, >= 100 are post-assessment
  // Assessment runner occupies the conceptual slot at 100
  review: { enabled: true, order: 110 },
  complete: { enabled: true, order: 120 },
  report: { enabled: false, order: 130, reportMode: 'holding' },
  expired: { enabled: true, order: 999 },
}

// =============================================================================
// Default demographics config
// =============================================================================

export const DEFAULT_DEMOGRAPHICS_CONFIG: Readonly<DemographicsConfig> = {
  fields: [
    {
      key: 'age_range',
      enabled: true,
      required: false,
      label: 'Age Range',
      type: 'select',
      options: [
        { value: '18-24', label: '18–24' },
        { value: '25-34', label: '25–34' },
        { value: '35-44', label: '35–44' },
        { value: '45-54', label: '45–54' },
        { value: '55-64', label: '55–64' },
        { value: '65+', label: '65+' },
      ],
    },
    {
      key: 'gender',
      enabled: true,
      required: false,
      label: 'Gender',
      type: 'select',
      options: [
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
        { value: 'non-binary', label: 'Non-binary' },
        { value: 'prefer-not-to-say', label: 'Prefer not to say' },
      ],
    },
    {
      key: 'ethnicity',
      enabled: false,
      required: false,
      label: 'Ethnicity',
      type: 'select',
      options: [
        { value: 'white', label: 'White' },
        { value: 'black', label: 'Black or African American' },
        { value: 'hispanic', label: 'Hispanic or Latino' },
        { value: 'asian', label: 'Asian' },
        { value: 'native', label: 'American Indian or Alaska Native' },
        { value: 'pacific-islander', label: 'Native Hawaiian or Pacific Islander' },
        { value: 'two-or-more', label: 'Two or more races' },
        { value: 'prefer-not-to-say', label: 'Prefer not to say' },
      ],
    },
    {
      key: 'education_level',
      enabled: true,
      required: false,
      label: 'Education Level',
      type: 'select',
      options: [
        { value: 'high-school', label: 'High school' },
        { value: 'bachelors', label: "Bachelor's degree" },
        { value: 'masters', label: "Master's degree" },
        { value: 'doctorate', label: 'Doctorate' },
        { value: 'other', label: 'Other' },
      ],
    },
    {
      key: 'job_level',
      enabled: true,
      required: false,
      label: 'Job Level',
      type: 'select',
      options: [
        { value: 'individual-contributor', label: 'Individual contributor' },
        { value: 'manager', label: 'Manager' },
        { value: 'senior-manager', label: 'Senior Manager' },
        { value: 'director', label: 'Director' },
        { value: 'vp', label: 'VP' },
        { value: 'c-suite', label: 'C-suite' },
      ],
    },
    {
      key: 'job_title',
      enabled: false,
      required: false,
      label: 'Job Title',
      type: 'text',
    },
    {
      key: 'department',
      enabled: false,
      required: false,
      label: 'Department',
      type: 'text',
    },
    {
      key: 'tenure_range',
      enabled: false,
      required: false,
      label: 'Tenure',
      type: 'select',
      options: [
        { value: '<1yr', label: 'Less than 1 year' },
        { value: '1-3yr', label: '1–3 years' },
        { value: '3-5yr', label: '3–5 years' },
        { value: '5-10yr', label: '5–10 years' },
        { value: '10+yr', label: '10+ years' },
      ],
    },
    {
      key: 'industry',
      enabled: false,
      required: false,
      label: 'Industry',
      type: 'select',
      options: [
        { value: 'technology', label: 'Technology' },
        { value: 'finance', label: 'Finance & Banking' },
        { value: 'healthcare', label: 'Healthcare' },
        { value: 'education', label: 'Education' },
        { value: 'government', label: 'Government' },
        { value: 'retail', label: 'Retail' },
        { value: 'manufacturing', label: 'Manufacturing' },
        { value: 'consulting', label: 'Consulting' },
        { value: 'nonprofit', label: 'Non-profit' },
        { value: 'other', label: 'Other' },
      ],
    },
    {
      key: 'country',
      enabled: false,
      required: false,
      label: 'Country',
      type: 'select',
      options: [
        { value: 'AU', label: 'Australia' },
        { value: 'CA', label: 'Canada' },
        { value: 'NZ', label: 'New Zealand' },
        { value: 'GB', label: 'United Kingdom' },
        { value: 'US', label: 'United States' },
        { value: 'other', label: 'Other' },
      ],
    },
    {
      key: 'language',
      enabled: false,
      required: false,
      label: 'Preferred Language',
      type: 'select',
      options: [
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Spanish' },
        { value: 'fr', label: 'French' },
        { value: 'de', label: 'German' },
        { value: 'zh', label: 'Chinese' },
        { value: 'other', label: 'Other' },
      ],
    },
  ],
}

// =============================================================================
// Combined default template
// =============================================================================

export const DEFAULT_EXPERIENCE_TEMPLATE: Readonly<ExperienceTemplate> = {
  pageContent: { ...DEFAULT_PAGE_CONTENT },
  flowConfig: { ...DEFAULT_FLOW_CONFIG },
  demographicsConfig: { ...DEFAULT_DEMOGRAPHICS_CONFIG },
}
