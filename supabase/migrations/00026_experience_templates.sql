-- =============================================================================
-- Experience Templates
--
-- Stores candidate experience configuration (page content, flow config,
-- demographics settings) for the platform default and per-campaign overrides.
-- Follows the brand_configs resolution pattern: platform default → campaign.
-- =============================================================================

-- Main table
CREATE TABLE IF NOT EXISTS experience_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type          TEXT NOT NULL CHECK (owner_type IN ('platform', 'campaign')),
  owner_id            UUID,  -- NULL for platform, campaign.id for campaign
  page_content        JSONB NOT NULL DEFAULT '{}'::jsonb,
  flow_config         JSONB NOT NULL DEFAULT '{}'::jsonb,
  demographics_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ
);

-- Unique: one active template per owner
CREATE UNIQUE INDEX IF NOT EXISTS experience_templates_owner_unique
  ON experience_templates (owner_type, owner_id)
  WHERE deleted_at IS NULL;

-- Index for fast campaign lookups
CREATE INDEX IF NOT EXISTS experience_templates_owner_id_idx
  ON experience_templates (owner_id)
  WHERE deleted_at IS NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION experience_templates_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS experience_templates_updated_at ON experience_templates;
CREATE TRIGGER experience_templates_updated_at
  BEFORE UPDATE ON experience_templates
  FOR EACH ROW
  EXECUTE FUNCTION experience_templates_set_updated_at();

-- RLS policies
ALTER TABLE experience_templates ENABLE ROW LEVEL SECURITY;

-- Platform admins: full access
CREATE POLICY experience_templates_admin_all ON experience_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'platform_admin'
    )
  );

-- Campaign owners (org admins): read/update campaign templates
CREATE POLICY experience_templates_campaign_read ON experience_templates
  FOR SELECT TO authenticated
  USING (
    owner_type = 'campaign'
    AND owner_id IN (
      SELECT c.id FROM campaigns c
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
        AND p.role IN ('org_admin', 'platform_admin')
    )
  );

CREATE POLICY experience_templates_campaign_write ON experience_templates
  FOR UPDATE TO authenticated
  USING (
    owner_type = 'campaign'
    AND owner_id IN (
      SELECT c.id FROM campaigns c
      JOIN profiles p ON p.organization_id = c.organization_id
      WHERE p.id = auth.uid()
        AND p.role IN ('org_admin', 'platform_admin')
    )
  );

-- Platform default readable by all authenticated
CREATE POLICY experience_templates_default_read ON experience_templates
  FOR SELECT TO authenticated
  USING (
    owner_type = 'platform' AND owner_id IS NULL
  );

-- Anonymous access (for assessment runner)
CREATE POLICY experience_templates_anon_read ON experience_templates
  FOR SELECT TO anon
  USING (
    (owner_type = 'platform' AND owner_id IS NULL)
    OR owner_type = 'campaign'
  );

-- =============================================================================
-- Seed: Platform default experience template
-- =============================================================================
INSERT INTO experience_templates (owner_type, owner_id, page_content, flow_config, demographics_config)
VALUES (
  'platform',
  NULL,
  '{
    "join": {
      "heading": "Join Assessment",
      "body": "Enter your details to begin the assessment.",
      "buttonLabel": "Continue"
    },
    "welcome": {
      "eyebrow": "Welcome, {{candidateName}}",
      "heading": "{{campaignTitle}}",
      "body": "{{campaignDescription}}",
      "infoHeading": "Before you begin",
      "infoItems": [
        "This campaign contains {{assessmentCount}} assessment(s).",
        "Your responses are saved automatically as you go.",
        "You can leave and return to continue where you left off.",
        "There are no right or wrong answers — respond honestly."
      ],
      "buttonLabel": "Begin Assessment",
      "resumeButtonLabel": "Resume Assessment"
    },
    "consent": {
      "eyebrow": "Information & Consent",
      "heading": "Before We Begin",
      "body": "This assessment is being administered as part of a structured evaluation process. Your responses will be used to generate a profile based on validated psychometric constructs.\n\n**What to expect:**\n- The assessment will take approximately 15–25 minutes\n- Your responses are confidential and stored securely\n- Results are used for professional development and/or selection purposes\n- You may withdraw at any time by closing this page\n\nBy proceeding, you confirm that you consent to participate in this assessment and that your responses may be used for the purposes described above.",
      "consentCheckboxLabel": "I have read and agree to the above information",
      "buttonLabel": "Continue"
    },
    "demographics": {
      "eyebrow": "About You",
      "heading": "Demographics",
      "body": "The following information helps us ensure fair and accurate assessment results. All fields are optional unless marked as required.",
      "buttonLabel": "Continue"
    },
    "section_intro": {
      "eyebrow": "{{campaignTitle}}",
      "heading": "Section Instructions",
      "body": "Please read each statement carefully and select the response that best describes you.",
      "buttonLabel": "Start Section"
    },
    "review": {
      "eyebrow": "{{campaignTitle}}",
      "heading": "Review Your Responses",
      "body": "{{answeredCount}} of {{totalItems}} questions answered",
      "buttonLabel": "Submit Assessment",
      "incompleteWarning": "You have unanswered questions. You can still submit, but incomplete sections may affect your results."
    },
    "complete": {
      "heading": "Thank You",
      "body": "Your assessment has been submitted successfully. You can safely close this page."
    },
    "report": {
      "heading": "Your Report",
      "body": "Your report is being prepared. You will receive an email when it is ready.",
      "buttonLabel": "View Report",
      "reportMode": "holding"
    },
    "expired": {
      "heading": "Link Expired",
      "body": "This assessment link is no longer valid. The campaign may have closed or your access may have been revoked. Please contact your administrator."
    }
  }'::jsonb,
  '{
    "join": { "enabled": true, "order": 1 },
    "welcome": { "enabled": true, "order": 2 },
    "consent": { "enabled": false, "order": 3 },
    "demographics": { "enabled": false, "order": 4 },
    "review": { "enabled": true, "order": 6 },
    "complete": { "enabled": true, "order": 7 },
    "report": { "enabled": false, "order": 8, "reportMode": "holding" },
    "expired": { "enabled": true, "order": 9 }
  }'::jsonb,
  '{
    "fields": [
      { "key": "age_range", "enabled": true, "required": false, "label": "Age Range", "type": "select", "options": [{"value":"18-24","label":"18–24"},{"value":"25-34","label":"25–34"},{"value":"35-44","label":"35–44"},{"value":"45-54","label":"45–54"},{"value":"55-64","label":"55–64"},{"value":"65+","label":"65+"}] },
      { "key": "gender", "enabled": true, "required": false, "label": "Gender", "type": "select", "options": [{"value":"male","label":"Male"},{"value":"female","label":"Female"},{"value":"non-binary","label":"Non-binary"},{"value":"prefer-not-to-say","label":"Prefer not to say"}] },
      { "key": "ethnicity", "enabled": false, "required": false, "label": "Ethnicity", "type": "select", "options": [{"value":"white","label":"White"},{"value":"black","label":"Black or African American"},{"value":"hispanic","label":"Hispanic or Latino"},{"value":"asian","label":"Asian"},{"value":"native","label":"American Indian or Alaska Native"},{"value":"pacific-islander","label":"Native Hawaiian or Pacific Islander"},{"value":"two-or-more","label":"Two or more races"},{"value":"prefer-not-to-say","label":"Prefer not to say"}] },
      { "key": "education_level", "enabled": true, "required": false, "label": "Education Level", "type": "select", "options": [{"value":"high-school","label":"High school"},{"value":"bachelors","label":"Bachelor''s degree"},{"value":"masters","label":"Master''s degree"},{"value":"doctorate","label":"Doctorate"},{"value":"other","label":"Other"}] },
      { "key": "job_level", "enabled": true, "required": false, "label": "Job Level", "type": "select", "options": [{"value":"individual-contributor","label":"Individual contributor"},{"value":"manager","label":"Manager"},{"value":"senior-manager","label":"Senior Manager"},{"value":"director","label":"Director"},{"value":"vp","label":"VP"},{"value":"c-suite","label":"C-suite"}] },
      { "key": "job_title", "enabled": false, "required": false, "label": "Job Title", "type": "text" },
      { "key": "department", "enabled": false, "required": false, "label": "Department", "type": "text" },
      { "key": "tenure_range", "enabled": false, "required": false, "label": "Tenure", "type": "select", "options": [{"value":"<1yr","label":"Less than 1 year"},{"value":"1-3yr","label":"1–3 years"},{"value":"3-5yr","label":"3–5 years"},{"value":"5-10yr","label":"5–10 years"},{"value":"10+yr","label":"10+ years"}] },
      { "key": "industry", "enabled": false, "required": false, "label": "Industry", "type": "select", "options": [{"value":"technology","label":"Technology"},{"value":"finance","label":"Finance & Banking"},{"value":"healthcare","label":"Healthcare"},{"value":"education","label":"Education"},{"value":"government","label":"Government"},{"value":"retail","label":"Retail"},{"value":"manufacturing","label":"Manufacturing"},{"value":"consulting","label":"Consulting"},{"value":"nonprofit","label":"Non-profit"},{"value":"other","label":"Other"}] },
      { "key": "country", "enabled": false, "required": false, "label": "Country", "type": "select", "options": [{"value":"AU","label":"Australia"},{"value":"CA","label":"Canada"},{"value":"NZ","label":"New Zealand"},{"value":"GB","label":"United Kingdom"},{"value":"US","label":"United States"},{"value":"other","label":"Other"}] },
      { "key": "language", "enabled": false, "required": false, "label": "Preferred Language", "type": "select", "options": [{"value":"en","label":"English"},{"value":"es","label":"Spanish"},{"value":"fr","label":"French"},{"value":"de","label":"German"},{"value":"zh","label":"Chinese"},{"value":"other","label":"Other"}] }
    ]
  }'::jsonb
)
ON CONFLICT DO NOTHING;
