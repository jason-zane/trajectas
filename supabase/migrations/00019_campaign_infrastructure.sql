-- ==========================================================================
-- 00019_campaign_infrastructure.sql
-- Campaign management tables: campaigns, campaign_assessments,
-- campaign_candidates, campaign_access_links
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE campaign_status AS ENUM (
    'draft',
    'active',
    'paused',
    'closed',
    'archived'
);

CREATE TYPE campaign_candidate_status AS ENUM (
    'invited',
    'registered',
    'in_progress',
    'completed',
    'withdrawn',
    'expired'
);

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE campaigns (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                       TEXT                NOT NULL,
    slug                        TEXT                NOT NULL,
    description                 TEXT,
    status                      campaign_status     NOT NULL DEFAULT 'draft',
    organization_id             UUID                REFERENCES organizations(id) ON DELETE SET NULL,
    partner_id                  UUID                REFERENCES partners(id) ON DELETE SET NULL,
    created_by                  UUID                REFERENCES profiles(id) ON DELETE SET NULL,
    opens_at                    TIMESTAMPTZ,
    closes_at                   TIMESTAMPTZ,
    branding                    JSONB               NOT NULL DEFAULT '{}'::jsonb,
    allow_resume                BOOLEAN             NOT NULL DEFAULT true,
    show_progress               BOOLEAN             NOT NULL DEFAULT true,
    randomize_assessment_order  BOOLEAN             NOT NULL DEFAULT false,
    created_at                  TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ,
    deleted_at                  TIMESTAMPTZ,

    CONSTRAINT campaigns_title_not_empty CHECK (char_length(trim(title)) > 0),
    CONSTRAINT campaigns_slug_not_empty  CHECK (char_length(trim(slug)) > 0),
    CONSTRAINT campaigns_slug_format     CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' OR char_length(slug) = 1),
    CONSTRAINT campaigns_dates_valid     CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at)
);

CREATE UNIQUE INDEX campaigns_slug_unique ON campaigns (slug) WHERE deleted_at IS NULL;

COMMENT ON TABLE campaigns IS
    'Operational container that holds assessments, manages candidates, and controls access windows.';

CREATE TRIGGER set_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- campaign_assessments (junction)
-- ---------------------------------------------------------------------------
CREATE TABLE campaign_assessments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    assessment_id   UUID    NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    display_order   INT     NOT NULL DEFAULT 0,
    is_required     BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT campaign_assessments_unique UNIQUE (campaign_id, assessment_id),
    CONSTRAINT campaign_assessments_display_order_positive CHECK (display_order >= 0)
);

COMMENT ON TABLE campaign_assessments IS
    'Junction linking assessments to campaigns with ordering and required flag.';

-- ---------------------------------------------------------------------------
-- campaign_candidates
-- ---------------------------------------------------------------------------
CREATE TABLE campaign_candidates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    email           CITEXT  NOT NULL,
    first_name      TEXT,
    last_name       TEXT,
    access_token    TEXT    NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    status          campaign_candidate_status NOT NULL DEFAULT 'invited',
    invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ,

    CONSTRAINT campaign_candidates_email_per_campaign UNIQUE (campaign_id, email),
    CONSTRAINT campaign_candidates_token_unique UNIQUE (access_token),
    CONSTRAINT campaign_candidates_dates_valid CHECK (
        (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
    )
);

COMMENT ON TABLE campaign_candidates IS
    'People invited to take assessments in a campaign. Token-based auth, no login required.';

CREATE TRIGGER set_campaign_candidates_updated_at
    BEFORE UPDATE ON campaign_candidates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- campaign_access_links (shareable enrollment links)
-- ---------------------------------------------------------------------------
CREATE TABLE campaign_access_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    token       TEXT        NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    label       TEXT,
    max_uses    INT,
    use_count   INT         NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT campaign_access_links_token_unique UNIQUE (token),
    CONSTRAINT campaign_access_links_max_uses_positive CHECK (max_uses IS NULL OR max_uses > 0),
    CONSTRAINT campaign_access_links_use_count_valid CHECK (use_count >= 0)
);

COMMENT ON TABLE campaign_access_links IS
    'Shareable enrollment links that allow self-registration into a campaign.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_campaigns_status       ON campaigns(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_org          ON campaigns(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_partner      ON campaigns(partner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_campaigns_created_by   ON campaigns(created_by);

CREATE INDEX idx_campaign_assessments_campaign   ON campaign_assessments(campaign_id);
CREATE INDEX idx_campaign_assessments_assessment ON campaign_assessments(assessment_id);

CREATE INDEX idx_campaign_candidates_campaign ON campaign_candidates(campaign_id);
CREATE INDEX idx_campaign_candidates_token   ON campaign_candidates(access_token);
CREATE INDEX idx_campaign_candidates_email   ON campaign_candidates(email);
CREATE INDEX idx_campaign_candidates_status  ON campaign_candidates(status);

CREATE INDEX idx_campaign_access_links_campaign ON campaign_access_links(campaign_id);
CREATE INDEX idx_campaign_access_links_token   ON campaign_access_links(token);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE campaigns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_assessments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_candidates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_access_links  ENABLE ROW LEVEL SECURITY;

-- Campaigns: platform admin full access, org/partner scoped reads
CREATE POLICY campaigns_all_platform_admin ON campaigns
    FOR ALL TO authenticated USING (is_platform_admin());

CREATE POLICY campaigns_select ON campaigns
    FOR SELECT TO authenticated USING (
        is_platform_admin()
        OR (organization_id IS NOT NULL AND organization_id = auth_user_organization_id())
        OR (partner_id IS NOT NULL AND partner_id = (SELECT partner_id FROM profiles WHERE id = auth.uid()))
    );

-- Campaign assessments: follow campaign access
CREATE POLICY campaign_assessments_all_platform_admin ON campaign_assessments
    FOR ALL TO authenticated USING (is_platform_admin());

CREATE POLICY campaign_assessments_select ON campaign_assessments
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = campaign_id
            AND (
                is_platform_admin()
                OR (c.organization_id IS NOT NULL AND c.organization_id = auth_user_organization_id())
                OR (c.partner_id IS NOT NULL AND c.partner_id = (SELECT partner_id FROM profiles WHERE id = auth.uid()))
            )
        )
    );

-- Campaign candidates: platform admin full access
CREATE POLICY campaign_candidates_all_platform_admin ON campaign_candidates
    FOR ALL TO authenticated USING (is_platform_admin());

CREATE POLICY campaign_candidates_select ON campaign_candidates
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = campaign_id
            AND (
                is_platform_admin()
                OR (c.organization_id IS NOT NULL AND c.organization_id = auth_user_organization_id())
            )
        )
    );

-- Campaign access links: platform admin full access
CREATE POLICY campaign_access_links_all_platform_admin ON campaign_access_links
    FOR ALL TO authenticated USING (is_platform_admin());

CREATE POLICY campaign_access_links_select ON campaign_access_links
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = campaign_id
            AND (
                is_platform_admin()
                OR (c.organization_id IS NOT NULL AND c.organization_id = auth_user_organization_id())
            )
        )
    );

-- Allow anonymous/service role reads for candidate-facing operations
-- (the runner uses createAdminClient which bypasses RLS anyway)
