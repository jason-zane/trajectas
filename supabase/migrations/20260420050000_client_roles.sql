-- =========================================================================
-- 20260420050000_client_roles.sql
-- A position the client is hiring for. Pinned at creation to a baseline
-- snapshot (org_diagnostic_profiles). The pin is read-only after creation
-- except via the explicit re-pin admin operation (see spec §3.4).
-- IDEMPOTENT.
-- =========================================================================

CREATE TABLE IF NOT EXISTS client_roles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    title                       TEXT NOT NULL,
    function                    TEXT,
    hiring_manager_name         TEXT,
    hiring_manager_email        CITEXT,
    pinned_baseline_snapshot_id UUID NOT NULL REFERENCES org_diagnostic_profiles(id) ON DELETE RESTRICT,
    status                      client_role_status NOT NULL DEFAULT 'open',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ,
    deleted_at                  TIMESTAMPTZ,
    created_by                  UUID REFERENCES profiles(id) ON DELETE SET NULL,

    CONSTRAINT client_roles_title_not_empty CHECK (char_length(trim(title)) > 0)
);

COMMENT ON TABLE client_roles IS
    'A hiring position for a client. Pinned to a baseline diagnostic snapshot at creation.';

CREATE INDEX IF NOT EXISTS idx_client_roles_client
    ON client_roles (client_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_roles_client_status
    ON client_roles (client_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_roles_pinned
    ON client_roles (pinned_baseline_snapshot_id);

DROP TRIGGER IF EXISTS set_client_roles_updated_at ON client_roles;
CREATE TRIGGER set_client_roles_updated_at
    BEFORE UPDATE ON client_roles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE client_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_roles_all_platform_admin ON client_roles;
CREATE POLICY client_roles_all_platform_admin ON client_roles
    FOR ALL TO authenticated USING (is_platform_admin());

DROP POLICY IF EXISTS client_roles_select_client ON client_roles;
CREATE POLICY client_roles_select_client ON client_roles
    FOR SELECT TO authenticated USING (
        is_platform_admin()
        OR client_id = auth_user_client_id()
        OR client_id IN (
            SELECT c.id FROM clients c
            WHERE c.partner_id = (SELECT partner_id FROM profiles WHERE id = auth.uid())
              AND c.deleted_at IS NULL
        )
    );
