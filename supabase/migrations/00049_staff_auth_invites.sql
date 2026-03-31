BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE partner_memberships
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE client_memberships
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL,
  tenant_type TEXT NOT NULL,
  tenant_id UUID,
  role TEXT NOT NULL,
  invite_token_hash TEXT NOT NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  invited_by_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_invites_tenant_type_check CHECK (
    tenant_type IN ('platform', 'partner', 'client')
  ),
  CONSTRAINT user_invites_role_not_empty CHECK (length(trim(role)) > 0),
  CONSTRAINT user_invites_token_hash_not_empty CHECK (
    length(trim(invite_token_hash)) > 0
  ),
  CONSTRAINT user_invites_scope_check CHECK (
    (tenant_type = 'platform' AND tenant_id IS NULL)
    OR
    (tenant_type IN ('partner', 'client') AND tenant_id IS NOT NULL)
  )
);

COMMENT ON TABLE user_invites IS
  'Invite-only onboarding records for staff accounts.';

CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites (email);
CREATE INDEX IF NOT EXISTS idx_user_invites_invited_by ON user_invites (invited_by_profile_id);
CREATE INDEX IF NOT EXISTS idx_user_invites_auth_user ON user_invites (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_invites_expires_at ON user_invites (expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_invites_active_scope
  ON user_invites (lower(email::text), tenant_type, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), role)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

DROP TRIGGER IF EXISTS trg_user_invites_updated_at ON user_invites;
CREATE TRIGGER trg_user_invites_updated_at
  BEFORE UPDATE ON user_invites
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_invites_select ON user_invites;
CREATE POLICY user_invites_select ON user_invites
  FOR SELECT USING (is_platform_admin());

DROP POLICY IF EXISTS user_invites_insert ON user_invites;
CREATE POLICY user_invites_insert ON user_invites
  FOR INSERT WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS user_invites_update ON user_invites;
CREATE POLICY user_invites_update ON user_invites
  FOR UPDATE USING (is_platform_admin());

DROP POLICY IF EXISTS user_invites_delete ON user_invites;
CREATE POLICY user_invites_delete ON user_invites
  FOR DELETE USING (is_platform_admin());

COMMIT;
