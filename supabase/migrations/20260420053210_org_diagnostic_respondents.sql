-- =========================================================================
-- People invited to complete one instrument within one campaign. Token-based
-- access (no Supabase Auth required).
--
-- ANONYMITY CONTRACT (spec §1.6): client members must NEVER read this table.
-- Only the platform-admin policy is created. RLS denies by default for any
-- role without a matching policy.
-- IDEMPOTENT.
-- =========================================================================

CREATE TABLE IF NOT EXISTS org_diagnostic_respondents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES org_diagnostic_campaigns(id) ON DELETE CASCADE,
    track_id            UUID NOT NULL REFERENCES org_diagnostic_campaign_tracks(id) ON DELETE CASCADE,
    respondent_type     org_diagnostic_respondent_type NOT NULL,
    name                TEXT,
    email               CITEXT NOT NULL,
    access_token        TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    status              org_diagnostic_respondent_status NOT NULL DEFAULT 'invited',
    invited_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ,

    CONSTRAINT org_diag_respondents_email_per_campaign UNIQUE (campaign_id, email),
    CONSTRAINT org_diag_respondents_token_unique UNIQUE (access_token),
    CONSTRAINT org_diag_respondents_dates_valid CHECK (
        completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
    )
);

COMMENT ON TABLE org_diagnostic_respondents IS
    'Invitee for one instrument in one diagnostic campaign. Identity hidden from client admins per anonymity contract.';

CREATE INDEX IF NOT EXISTS idx_org_diag_respondents_campaign
    ON org_diagnostic_respondents (campaign_id);

CREATE INDEX IF NOT EXISTS idx_org_diag_respondents_track
    ON org_diagnostic_respondents (track_id);

CREATE INDEX IF NOT EXISTS idx_org_diag_respondents_email
    ON org_diagnostic_respondents (email);

CREATE INDEX IF NOT EXISTS idx_org_diag_respondents_status
    ON org_diagnostic_respondents (status);

DROP TRIGGER IF EXISTS set_org_diag_respondents_updated_at ON org_diagnostic_respondents;
CREATE TRIGGER set_org_diag_respondents_updated_at
    BEFORE UPDATE ON org_diagnostic_respondents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE org_diagnostic_respondents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_diag_respondents_all_platform_admin ON org_diagnostic_respondents;
CREATE POLICY org_diag_respondents_all_platform_admin ON org_diagnostic_respondents
    FOR ALL TO authenticated USING (is_platform_admin());;
