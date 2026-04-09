-- Partner taxonomy assignments: which dimensions/factors/constructs a partner can use
CREATE TABLE IF NOT EXISTS partner_taxonomy_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('dimension', 'factor', 'construct')),
  entity_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_taxonomy_partner
  ON partner_taxonomy_assignments(partner_id, entity_type);

-- Updated-at trigger
DROP TRIGGER IF EXISTS trg_partner_taxonomy_assignments_updated ON partner_taxonomy_assignments;
CREATE TRIGGER trg_partner_taxonomy_assignments_updated
  BEFORE UPDATE ON partner_taxonomy_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE partner_taxonomy_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_full_access" ON partner_taxonomy_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );

CREATE POLICY "partner_members_select_own" ON partner_taxonomy_assignments
  FOR SELECT TO authenticated
  USING (
    partner_id IN (
      SELECT pm.partner_id FROM partner_memberships pm
      WHERE pm.profile_id = auth.uid() AND pm.revoked_at IS NULL
    )
  );
