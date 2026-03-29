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
    heading: 'Join Assessment',
    body: 'Enter your details to begin the assessment.',
    buttonLabel: 'Continue',
    marketingConsentEnabled: false,
    marketingConsentRequired: false,
    marketingConsentLabel: 'I agree to receive communications about future opportunities and insights.',
  },

  welcome: {
    eyebrow: 'Welcome, {{participantName}}',
    heading: '{{campaignTitle}}',
    body: '{{campaignDescription}}',
    infoHeading: 'Before you begin',
    infoItems: [
      'This campaign contains {{assessmentCount}} assessment(s).',
      'Your responses are saved automatically as you go.',
      'You can leave and return to continue where you left off.',
      'There are no right or wrong answers — respond honestly.',
    ],
    buttonLabel: 'Begin Assessment',
    resumeButtonLabel: 'Resume Assessment',
  },

  consent: {
    eyebrow: 'Information & Consent',
    heading: 'Before We Begin',
    body: 'This assessment is being administered as part of a structured evaluation process. Your responses will be used to generate a profile based on validated psychometric constructs.\n\n**What to expect:**\n- The assessment will take approximately 15–25 minutes\n- Your responses are confidential and stored securely\n- Results are used for professional development and/or selection purposes\n- You may withdraw at any time by closing this page\n\nBy proceeding, you confirm that you consent to participate in this assessment and that your responses may be used for the purposes described above.',
    consentCheckboxLabel: 'I have read and agree to the above information',
    buttonLabel: 'Continue',
  },

  demographics: {
    eyebrow: 'About You',
    heading: 'Demographics',
    body: 'The following information helps us ensure fair and accurate assessment results. All fields are optional unless marked as required.',
    buttonLabel: 'Continue',
  },

  section_intro: {
    eyebrow: '{{campaignTitle}}',
    heading: 'Section Instructions',
    body: 'Please read each statement carefully and select the response that best describes you.',
    buttonLabel: 'Start Section',
  },

  runner: {
    backButtonLabel: 'Back',
    saveStatusIdle: 'Responses saved automatically',
    saveStatusSaving: 'Saving...',
    saveStatusSaved: 'Saved',
    continueButtonLabel: 'Continue',
    footerText: 'Powered by TalentFit',
  },

  review: {
    eyebrow: '{{campaignTitle}}',
    heading: 'Review Your Responses',
    body: '{{answeredCount}} of {{totalItems}} questions answered',
    buttonLabel: 'Submit Assessment',
    incompleteWarning:
      'You have unanswered questions. You can still submit, but incomplete sections may affect your results.',
  },

  complete: {
    heading: 'Thank You',
    body: 'Your assessment has been submitted successfully. You can safely close this page.',
  },

  report: {
    heading: 'Your Report',
    body: 'Your report is being prepared. You will receive an email when it is ready.',
    buttonLabel: 'View Report',
    reportMode: 'holding',
  },

  expired: {
    heading: 'Link Expired',
    body: 'This assessment link is no longer valid. The campaign may have closed or your access may have been revoked. Please contact your administrator.',
  },
}

// =============================================================================
// Default flow config — order mirrors the participant journey
// =============================================================================

export const DEFAULT_FLOW_CONFIG: Readonly<FlowConfig> = {
  join: { enabled: true, order: 10 },
  welcome: { enabled: true, order: 20 },
  consent: { enabled: false, order: 30 },
  demographics: { enabled: false, order: 40 },
  // Pages with order < 100 are pre-assessment, >= 100 are post-assessment
  // Assessment sections (section_intro + runner) occupy the conceptual slot at 100
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
