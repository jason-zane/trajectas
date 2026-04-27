BEGIN;
-- ============================================================================
-- Phase 1 surface security foundation
-- - membership-based tenancy primitives
-- - audited support sessions
-- - append-only audit events
-- - compatibility with existing organization-based schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_memberships (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    partner_id  UUID        NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    role        TEXT        NOT NULL DEFAULT 'member',
    is_default  BOOLEAN     NOT NULL DEFAULT false,
    created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT partner_memberships_unique UNIQUE (profile_id, partner_id),
    CONSTRAINT partner_memberships_role_check CHECK (role IN ('admin', 'member'))
);
COMMENT ON TABLE partner_memberships IS
    'Partner-scoped memberships for multi-membership tenancy resolution.';
CREATE TABLE IF NOT EXISTS client_memberships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role            TEXT        NOT NULL DEFAULT 'member',
    is_default      BOOLEAN     NOT NULL DEFAULT false,
    created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT client_memberships_unique UNIQUE (profile_id, organization_id),
    CONSTRAINT client_memberships_role_check CHECK (role IN ('admin', 'member'))
);
COMMENT ON TABLE client_memberships IS
    'Client-scoped memberships for multi-membership tenancy resolution. Uses organization_id for persistence compatibility.';
CREATE TABLE IF NOT EXISTS support_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_profile_id UUID       NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_surface  TEXT        NOT NULL,
    partner_id      UUID        REFERENCES partners(id) ON DELETE CASCADE,
    organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,
    reason          TEXT        NOT NULL,
    session_key     UUID        NOT NULL DEFAULT gen_random_uuid(),
    metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
    ended_at        TIMESTAMPTZ,

    CONSTRAINT support_sessions_target_surface_check CHECK (target_surface IN ('partner', 'client')),
    CONSTRAINT support_sessions_reason_not_empty CHECK (length(trim(reason)) > 0),
    CONSTRAINT support_sessions_target_scope_check CHECK (
        (target_surface = 'partner' AND partner_id IS NOT NULL AND organization_id IS NULL)
        OR
        (target_surface = 'client' AND organization_id IS NOT NULL)
    ),
    CONSTRAINT support_sessions_session_key_unique UNIQUE (session_key)
);
COMMENT ON TABLE support_sessions IS
    'Audited admin support launches into partner or client surfaces.';
CREATE TABLE IF NOT EXISTS audit_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_profile_id  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    event_type        TEXT        NOT NULL,
    target_table      TEXT,
    target_id         UUID,
    partner_id        UUID        REFERENCES partners(id) ON DELETE SET NULL,
    organization_id   UUID        REFERENCES organizations(id) ON DELETE SET NULL,
    support_session_id UUID       REFERENCES support_sessions(id) ON DELETE SET NULL,
    metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT audit_events_event_type_not_empty CHECK (length(trim(event_type)) > 0)
);
COMMENT ON TABLE audit_events IS
    'Append-only audit log for privileged and security-relevant product actions.';
CREATE INDEX IF NOT EXISTS idx_partner_memberships_profile ON partner_memberships (profile_id);
CREATE INDEX IF NOT EXISTS idx_partner_memberships_partner ON partner_memberships (partner_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_profile ON client_memberships (profile_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_client ON client_memberships (organization_id);
CREATE INDEX IF NOT EXISTS idx_support_sessions_actor ON support_sessions (actor_profile_id);
CREATE INDEX IF NOT EXISTS idx_support_sessions_partner ON support_sessions (partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_sessions_client ON support_sessions (organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_sessions_active ON support_sessions (expires_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created ON audit_events (actor_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_client_created ON audit_events (organization_id, created_at DESC) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_partner_created ON audit_events (partner_id, created_at DESC) WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type_created ON audit_events (event_type, created_at DESC);
DROP TRIGGER IF EXISTS trg_partner_memberships_updated_at ON partner_memberships;
CREATE TRIGGER trg_partner_memberships_updated_at
    BEFORE UPDATE ON partner_memberships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_client_memberships_updated_at ON client_memberships;
CREATE TRIGGER trg_client_memberships_updated_at
    BEFORE UPDATE ON client_memberships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
INSERT INTO partner_memberships (profile_id, partner_id, role, is_default)
SELECT
    p.id,
    p.partner_id,
    CASE
        WHEN p.role = 'partner_admin' THEN 'admin'
        ELSE 'member'
    END,
    true
FROM profiles p
WHERE p.partner_id IS NOT NULL
ON CONFLICT (profile_id, partner_id) DO NOTHING;
INSERT INTO client_memberships (profile_id, organization_id, role, is_default)
SELECT
    p.id,
    p.organization_id,
    CASE
        WHEN p.role = 'org_admin' THEN 'admin'
        ELSE 'member'
    END,
    true
FROM profiles p
WHERE p.organization_id IS NOT NULL
ON CONFLICT (profile_id, organization_id) DO NOTHING;
CREATE OR REPLACE FUNCTION auth_user_partner_ids()
RETURNS UUID[] AS $$
    SELECT COALESCE(
        ARRAY(
            SELECT DISTINCT partner_id
            FROM (
                SELECT pm.partner_id
                FROM partner_memberships pm
                WHERE pm.profile_id = auth.uid()
                UNION
                SELECT p.partner_id
                FROM profiles p
                WHERE p.id = auth.uid() AND p.partner_id IS NOT NULL
            ) partner_ids
        ),
        ARRAY[]::UUID[]
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
COMMENT ON FUNCTION auth_user_partner_ids() IS
    'Returns all partner IDs the current authenticated user belongs to, including legacy direct profile ownership.';
CREATE OR REPLACE FUNCTION auth_user_client_ids()
RETURNS UUID[] AS $$
    SELECT COALESCE(
        ARRAY(
            SELECT DISTINCT organization_id
            FROM (
                SELECT cm.organization_id
                FROM client_memberships cm
                WHERE cm.profile_id = auth.uid()
                UNION
                SELECT p.organization_id
                FROM profiles p
                WHERE p.id = auth.uid() AND p.organization_id IS NOT NULL
            ) client_ids
        ),
        ARRAY[]::UUID[]
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
COMMENT ON FUNCTION auth_user_client_ids() IS
    'Returns all client organization IDs the current authenticated user belongs to, including legacy direct profile ownership.';
ALTER TABLE partner_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS partner_memberships_select ON partner_memberships;
CREATE POLICY partner_memberships_select ON partner_memberships
    FOR SELECT USING (is_platform_admin() OR profile_id = auth.uid());
DROP POLICY IF EXISTS partner_memberships_insert ON partner_memberships;
CREATE POLICY partner_memberships_insert ON partner_memberships
    FOR INSERT WITH CHECK (is_platform_admin());
DROP POLICY IF EXISTS partner_memberships_update ON partner_memberships;
CREATE POLICY partner_memberships_update ON partner_memberships
    FOR UPDATE USING (is_platform_admin());
DROP POLICY IF EXISTS partner_memberships_delete ON partner_memberships;
CREATE POLICY partner_memberships_delete ON partner_memberships
    FOR DELETE USING (is_platform_admin());
DROP POLICY IF EXISTS client_memberships_select ON client_memberships;
CREATE POLICY client_memberships_select ON client_memberships
    FOR SELECT USING (is_platform_admin() OR profile_id = auth.uid());
DROP POLICY IF EXISTS client_memberships_insert ON client_memberships;
CREATE POLICY client_memberships_insert ON client_memberships
    FOR INSERT WITH CHECK (is_platform_admin());
DROP POLICY IF EXISTS client_memberships_update ON client_memberships;
CREATE POLICY client_memberships_update ON client_memberships
    FOR UPDATE USING (is_platform_admin());
DROP POLICY IF EXISTS client_memberships_delete ON client_memberships;
CREATE POLICY client_memberships_delete ON client_memberships
    FOR DELETE USING (is_platform_admin());
DROP POLICY IF EXISTS support_sessions_select ON support_sessions;
CREATE POLICY support_sessions_select ON support_sessions
    FOR SELECT USING (is_platform_admin() OR actor_profile_id = auth.uid());
DROP POLICY IF EXISTS support_sessions_insert ON support_sessions;
CREATE POLICY support_sessions_insert ON support_sessions
    FOR INSERT WITH CHECK (is_platform_admin());
DROP POLICY IF EXISTS support_sessions_update ON support_sessions;
CREATE POLICY support_sessions_update ON support_sessions
    FOR UPDATE USING (is_platform_admin());
DROP POLICY IF EXISTS support_sessions_delete ON support_sessions;
CREATE POLICY support_sessions_delete ON support_sessions
    FOR DELETE USING (is_platform_admin());
DROP POLICY IF EXISTS audit_events_select ON audit_events;
CREATE POLICY audit_events_select ON audit_events
    FOR SELECT USING (is_platform_admin());
DROP POLICY IF EXISTS audit_events_insert ON audit_events;
CREATE POLICY audit_events_insert ON audit_events
    FOR INSERT WITH CHECK (is_platform_admin());
COMMIT;
