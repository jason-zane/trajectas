-- Add marketing consent timestamp to campaign_candidates
ALTER TABLE campaign_candidates
  ADD COLUMN IF NOT EXISTS marketing_consent_given_at TIMESTAMPTZ;
-- Update platform seed experience_templates to include runner page content
-- and marketing consent fields on join (JSONB is flexible, no schema change needed)
UPDATE experience_templates
SET page_content = page_content
  || jsonb_build_object(
    'runner', jsonb_build_object(
      'backButtonLabel', 'Back',
      'saveStatusIdle', 'Responses saved automatically',
      'saveStatusSaving', 'Saving...',
      'saveStatusSaved', 'Saved',
      'continueButtonLabel', 'Continue',
      'footerText', 'Powered by TalentFit'
    )
  )
WHERE owner_type = 'platform'
  AND deleted_at IS NULL
  AND NOT (page_content ? 'runner');
-- Ensure join content has marketing consent fields
UPDATE experience_templates
SET page_content = jsonb_set(
  page_content,
  '{join}',
  COALESCE(page_content->'join', '{}'::jsonb)
    || jsonb_build_object(
      'marketingConsentEnabled', false,
      'marketingConsentRequired', false,
      'marketingConsentLabel', 'I agree to receive communications about future opportunities and insights.'
    )
)
WHERE owner_type = 'platform'
  AND deleted_at IS NULL
  AND page_content ? 'join'
  AND NOT (page_content->'join' ? 'marketingConsentEnabled');
