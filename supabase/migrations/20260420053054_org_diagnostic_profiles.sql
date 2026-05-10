-- =========================================================================
-- Versioned, immutable snapshot of a client's diagnostic profile (org-level
-- or role-level). One row per closed campaign.
-- IDEMPOTENT.
-- =========================================================================

CREATE TABLE IF NOT EXISTS org_diagnostic_profiles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    campaign_id                 UUID NOT NULL,
    kind                        org_diagnostic_profile_kind NOT NULL,
    pinned_baseline_snapshot_id UUID REFERENCES org_diagnostic_profiles(id) ON DELETE RESTRICT,
    data                        JSONB NOT NULL,
    respondent_count            INT  NOT NULL CHECK (respondent_count >= 0),
    respondent_count_by_type    JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    generated_by                UUID REFERENCES profiles(id) ON DELETE SET NULL,

    CONSTRAINT org_diagnostic_profiles_campaign_unique UNIQUE (campaign_id),
    CONSTRAINT org_diagnostic_profiles_pin_consistency CHECK (
        (kind = 'role'     AND pinned_baseline_snapshot_id IS NOT NULL) OR
        (kind = 'baseline' AND pinned_baseline_snapshot_id IS NULL)
    )
);

COMMENT ON TABLE org_diagnostic_profiles IS
    'Immutable snapshot produced when an org diagnostic campaign closes. One row per campaign.';

CREATE INDEX IF NOT EXISTS idx_org_diag_profiles_client_generated
    ON org_diagnostic_profiles (client_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_diag_profiles_client_kind_generated
    ON org_diagnostic_profiles (client_id, kind, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_diag_profiles_pinned
    ON org_diagnostic_profiles (pinned_baseline_snapshot_id)
    WHERE pinned_baseline_snapshot_id IS NOT NULL;

ALTER TABLE org_diagnostic_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_diag_profiles_all_platform_admin ON org_diagnostic_profiles;
CREATE POLICY org_diag_profiles_all_platform_admin ON org_diagnostic_profiles
    FOR ALL TO authenticated USING (is_platform_admin());

DROP POLICY IF EXISTS org_diag_profiles_select_client ON org_diagnostic_profiles;
CREATE POLICY org_diag_profiles_select_client ON org_diagnostic_profiles
    FOR SELECT TO authenticated USING (
        is_platform_admin()
        OR client_id = auth_user_client_id()
        OR client_id IN (
            SELECT c.id FROM clients c
            WHERE c.partner_id = (SELECT partner_id FROM profiles WHERE id = auth.uid())
              AND c.deleted_at IS NULL
        )
    );;
