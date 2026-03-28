-- =============================================================================
-- Candidate Demographics & Consent
--
-- Adds demographics collection, consent tracking, and demographics completion
-- to the campaign_candidates table.
-- =============================================================================

ALTER TABLE campaign_candidates
  ADD COLUMN IF NOT EXISTS demographics             JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS consent_given_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_ip               TEXT,
  ADD COLUMN IF NOT EXISTS demographics_completed_at TIMESTAMPTZ;
