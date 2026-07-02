-- ==========================================================================
-- 20260702120000_campaign_options.sql
-- Add campaign-level options: confidentiality mode and inviter identity.
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE confidentiality_mode AS ENUM (
    'standard',
    'aggregate_only'
);

-- ---------------------------------------------------------------------------
-- campaigns table alterations
-- ---------------------------------------------------------------------------

ALTER TABLE campaigns
  ADD COLUMN confidentiality_mode confidentiality_mode NOT NULL DEFAULT 'standard',
  ADD COLUMN inviter_name TEXT,
  ADD COLUMN inviter_role TEXT,
  ADD CONSTRAINT campaigns_inviter_name_length CHECK (char_length(inviter_name) <= 200),
  ADD CONSTRAINT campaigns_inviter_role_length CHECK (char_length(inviter_role) <= 200);

COMMENT ON COLUMN campaigns.confidentiality_mode IS
  'Reporting mode: "standard" allows individual results; "aggregate_only" promises group-level reporting only.';
COMMENT ON COLUMN campaigns.inviter_name IS
  'Optional name of the person inviting participants (shown on join screen).';
COMMENT ON COLUMN campaigns.inviter_role IS
  'Optional role/title of the inviter (shown on join screen).';
