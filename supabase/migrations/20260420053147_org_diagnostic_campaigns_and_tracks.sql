-- =========================================================================
-- Diagnostic campaigns (baseline or role_rep) and the per-instrument tracks
-- inside them. Also adds the deferred FK from org_diagnostic_profiles.
-- IDEMPOTENT.
-- =========================================================================

CREATE TABLE IF NOT EXISTS org_diagnostic_campaigns (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    kind                        org_diagnostic_campaign_kind NOT NULL,
    client_role_id              UUID REFERENCES client_roles(id) ON DELETE RESTRICT,
    pinned_baseline_snapshot_id UUID REFERENCES org_diagnostic_profiles(id) ON DELETE RESTRICT,
    title                       TEXT NOT NULL,
    description                 TEXT,
    status                      org_diagnostic_campaign_status NOT NULL DEFAULT 'draft',
    default_opens_at            TIMESTAMPTZ,
    default_closes_at           TIMESTAMPTZ,
    closed_at                   TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ,
    deleted_at                  TIMESTAMPTZ,
    created_by                  UUID REFERENCES profiles(id) ON DELETE SET NULL,

    CONSTRAINT org_diag_campaigns_title_not_empty CHECK (char_length(trim(title)) > 0),
    CONSTRAINT org_diag_campaigns_dates_valid CHECK (
        default_closes_at IS NULL OR default_opens_at IS NULL OR default_closes_at > default_opens_at
    ),
    CONSTRAINT org_diag_campaigns_kind_consistency CHECK (
        (kind = 'role_rep' AND client_role_id IS NOT NULL AND pinned_baseline_snapshot_id IS NOT NULL)
        OR
        (kind = 'baseline' AND client_role_id IS NULL AND pinned_baseline_snapshot_id IS NULL)
    )
);

COMMENT ON TABLE org_diagnostic_campaigns IS
    'Container for an org diagnostic data-collection round. Either baseline (OPS+/-LCQ) or role_rep.';

CREATE INDEX IF NOT EXISTS idx_org_diag_campaigns_client
    ON org_diagnostic_campaigns (client_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_org_diag_campaigns_status
    ON org_diagnostic_campaigns (status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_org_diag_campaigns_role
    ON org_diagnostic_campaigns (client_role_id) WHERE client_role_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_org_diag_campaigns_updated_at ON org_diagnostic_campaigns;
CREATE TRIGGER set_org_diag_campaigns_updated_at
    BEFORE UPDATE ON org_diagnostic_campaigns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS org_diagnostic_campaign_tracks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES org_diagnostic_campaigns(id) ON DELETE CASCADE,
    instrument          org_diagnostic_instrument NOT NULL,
    opens_at            TIMESTAMPTZ,
    closes_at           TIMESTAMPTZ,
    status              org_diagnostic_track_status NOT NULL DEFAULT 'pending',
    closed_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ,

    CONSTRAINT org_diag_tracks_unique UNIQUE (campaign_id, instrument),
    CONSTRAINT org_diag_tracks_dates_valid CHECK (
        closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at
    )
);

COMMENT ON TABLE org_diagnostic_campaign_tracks IS
    'Per-instrument lifecycle inside a diagnostic campaign. Inherits campaign-level dates if its own are NULL.';

CREATE INDEX IF NOT EXISTS idx_org_diag_tracks_campaign
    ON org_diagnostic_campaign_tracks (campaign_id);

CREATE INDEX IF NOT EXISTS idx_org_diag_tracks_status_close
    ON org_diagnostic_campaign_tracks (status, closes_at);

DROP TRIGGER IF EXISTS set_org_diag_tracks_updated_at ON org_diagnostic_campaign_tracks;
CREATE TRIGGER set_org_diag_tracks_updated_at
    BEFORE UPDATE ON org_diagnostic_campaign_tracks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DO $$ BEGIN
  ALTER TABLE org_diagnostic_profiles
    ADD CONSTRAINT org_diag_profiles_campaign_fk
    FOREIGN KEY (campaign_id) REFERENCES org_diagnostic_campaigns(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE org_diagnostic_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_diag_campaigns_all_platform_admin ON org_diagnostic_campaigns;
CREATE POLICY org_diag_campaigns_all_platform_admin ON org_diagnostic_campaigns
    FOR ALL TO authenticated USING (is_platform_admin());

DROP POLICY IF EXISTS org_diag_campaigns_select_client ON org_diagnostic_campaigns;
CREATE POLICY org_diag_campaigns_select_client ON org_diagnostic_campaigns
    FOR SELECT TO authenticated USING (
        is_platform_admin()
        OR client_id = auth_user_client_id()
        OR client_id IN (
            SELECT c.id FROM clients c
            WHERE c.partner_id = (SELECT partner_id FROM profiles WHERE id = auth.uid())
              AND c.deleted_at IS NULL
        )
    );

ALTER TABLE org_diagnostic_campaign_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_diag_tracks_all_platform_admin ON org_diagnostic_campaign_tracks;
CREATE POLICY org_diag_tracks_all_platform_admin ON org_diagnostic_campaign_tracks
    FOR ALL TO authenticated USING (is_platform_admin());

DROP POLICY IF EXISTS org_diag_tracks_select_via_campaign ON org_diagnostic_campaign_tracks;
CREATE POLICY org_diag_tracks_select_via_campaign ON org_diagnostic_campaign_tracks
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM org_diagnostic_campaigns c
            WHERE c.id = campaign_id
              AND (
                  is_platform_admin()
                  OR c.client_id = auth_user_client_id()
                  OR c.client_id IN (
                      SELECT cl.id FROM clients cl
                      WHERE cl.partner_id = (SELECT partner_id FROM profiles WHERE id = auth.uid())
                        AND cl.deleted_at IS NULL
                  )
              )
        )
    );;
