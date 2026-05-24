-- Saved comparisons
-- ------------------
-- A `comparisons` row captures everything needed to reconstruct a Compare
-- view: which participants/sessions, which assessments, which column
-- levels, whether delta-vs-mean is on, plus a name and a share scope.
--
-- Share semantics:
--   - share_scope = 'private': only the owner can see/edit.
--   - share_scope = 'team':    anyone in the same client / partner scope
--                              can see and edit (collaborative editing —
--                              last write wins).
--
-- Scope context (partner_id, client_id) is captured at save time and
-- determines which audience "team" maps to:
--   - client_id set  → visible to members of that client (when shared)
--   - partner_id set → visible to members of that partner (when shared)
--   - neither set    → platform-admin scope (visible to platform admins
--                      when shared)

CREATE TABLE IF NOT EXISTS comparisons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  entries         jsonb NOT NULL,
  assessment_ids  text[] NOT NULL DEFAULT '{}',
  visible_levels  text[] NOT NULL DEFAULT ARRAY['dimension','factor'],
  delta_mode      boolean NOT NULL DEFAULT false,
  share_scope     text NOT NULL DEFAULT 'private' CHECK (share_scope IN ('private','team')),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  partner_id      uuid REFERENCES partners(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT comparisons_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT comparisons_single_scope   CHECK (
    NOT (client_id IS NOT NULL AND partner_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS comparisons_owner_idx   ON comparisons (owner_id);
CREATE INDEX IF NOT EXISTS comparisons_client_idx  ON comparisons (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comparisons_partner_idx ON comparisons (partner_id) WHERE partner_id IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION comparisons_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comparisons_set_updated_at ON comparisons;
CREATE TRIGGER comparisons_set_updated_at
  BEFORE UPDATE ON comparisons
  FOR EACH ROW EXECUTE FUNCTION comparisons_set_updated_at();

-- RLS
ALTER TABLE comparisons ENABLE ROW LEVEL SECURITY;

-- Owner: full access to their own rows
CREATE POLICY comparisons_owner_select ON comparisons
  FOR SELECT USING (owner_id = (select auth.uid()));
CREATE POLICY comparisons_owner_insert ON comparisons
  FOR INSERT WITH CHECK (owner_id = (select auth.uid()));
CREATE POLICY comparisons_owner_update ON comparisons
  FOR UPDATE USING (owner_id = (select auth.uid()))
              WITH CHECK (owner_id = (select auth.uid()));
CREATE POLICY comparisons_owner_delete ON comparisons
  FOR DELETE USING (owner_id = (select auth.uid()));

-- Team in a client: read + edit when shared
CREATE POLICY comparisons_team_client_select ON comparisons
  FOR SELECT USING (
    share_scope = 'team'
    AND client_id IS NOT NULL
    AND client_id = ANY (auth_user_client_ids())
  );
CREATE POLICY comparisons_team_client_update ON comparisons
  FOR UPDATE USING (
    share_scope = 'team'
    AND client_id IS NOT NULL
    AND client_id = ANY (auth_user_client_ids())
  ) WITH CHECK (
    share_scope = 'team'
    AND client_id IS NOT NULL
    AND client_id = ANY (auth_user_client_ids())
  );

-- Team in a partner: read + edit when shared
CREATE POLICY comparisons_team_partner_select ON comparisons
  FOR SELECT USING (
    share_scope = 'team'
    AND partner_id IS NOT NULL
    AND partner_id = ANY (auth_user_partner_ids())
  );
CREATE POLICY comparisons_team_partner_update ON comparisons
  FOR UPDATE USING (
    share_scope = 'team'
    AND partner_id IS NOT NULL
    AND partner_id = ANY (auth_user_partner_ids())
  ) WITH CHECK (
    share_scope = 'team'
    AND partner_id IS NOT NULL
    AND partner_id = ANY (auth_user_partner_ids())
  );

-- Team in platform scope (no partner/client): visible & editable by platform admins
CREATE POLICY comparisons_team_platform_select ON comparisons
  FOR SELECT USING (
    share_scope = 'team'
    AND client_id IS NULL
    AND partner_id IS NULL
    AND is_platform_admin()
  );
CREATE POLICY comparisons_team_platform_update ON comparisons
  FOR UPDATE USING (
    share_scope = 'team'
    AND client_id IS NULL
    AND partner_id IS NULL
    AND is_platform_admin()
  ) WITH CHECK (
    share_scope = 'team'
    AND client_id IS NULL
    AND partner_id IS NULL
    AND is_platform_admin()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON comparisons TO authenticated;
