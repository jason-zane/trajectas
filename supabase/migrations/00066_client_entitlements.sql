-- 00066_client_entitlements.sql
-- Client entitlements: assessment assignments, report template assignments,
-- quota computation, and branding toggle

-- 1. Assessment assignments table
CREATE TABLE IF NOT EXISTS client_assessment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  quota_limit INT,  -- NULL = unlimited
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_client_assessment UNIQUE (organization_id, assessment_id)
);
CREATE INDEX IF NOT EXISTS idx_client_assessment_assignments_org
  ON client_assessment_assignments(organization_id);
COMMENT ON TABLE client_assessment_assignments IS
  'Links organizations to the assessments they can use in campaigns, with optional per-row quota limits.';
-- 2. Report template assignments table
CREATE TABLE IF NOT EXISTS client_report_template_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_client_report_template UNIQUE (organization_id, report_template_id)
);
CREATE INDEX IF NOT EXISTS idx_client_report_template_assignments_org
  ON client_report_template_assignments(organization_id);
COMMENT ON TABLE client_report_template_assignments IS
  'Links organizations to the report templates they can generate from campaign results.';
-- 3. Branding toggle on organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS can_customize_branding BOOLEAN NOT NULL DEFAULT false;
-- 4. Quota computation function
CREATE OR REPLACE FUNCTION get_assessment_quota_usage(p_org_id UUID, p_assessment_id UUID)
RETURNS INT AS $$
  SELECT COALESCE(COUNT(*)::INT, 0)
  FROM campaign_participants cp
  JOIN campaign_assessments ca ON ca.campaign_id = cp.campaign_id
  JOIN campaigns c ON c.id = cp.campaign_id
  WHERE ca.assessment_id = p_assessment_id
    AND c.organization_id = p_org_id
    AND c.deleted_at IS NULL
    AND (
      cp.status IN ('invited', 'registered', 'in_progress', 'completed')
      OR (cp.status = 'withdrawn' AND cp.started_at IS NOT NULL)
    )
$$ LANGUAGE sql STABLE;
COMMENT ON FUNCTION get_assessment_quota_usage IS
  'Computes live quota usage for a given org + assessment. NULL-safe (returns 0 if no matches).';
-- 5. updated_at triggers
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_client_assessment_assignments_updated ON client_assessment_assignments;
CREATE TRIGGER trg_client_assessment_assignments_updated
  BEFORE UPDATE ON client_assessment_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_client_report_template_assignments_updated ON client_report_template_assignments;
CREATE TRIGGER trg_client_report_template_assignments_updated
  BEFORE UPDATE ON client_report_template_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- 6. RLS policies
ALTER TABLE client_assessment_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_admins_full_access" ON client_assessment_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );
CREATE POLICY "client_members_select_own" ON client_assessment_assignments
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT cm.organization_id FROM client_memberships cm
      WHERE cm.profile_id = auth.uid() AND cm.revoked_at IS NULL
    )
  );
ALTER TABLE client_report_template_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_admins_full_access" ON client_report_template_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );
CREATE POLICY "client_members_select_own" ON client_report_template_assignments
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT cm.organization_id FROM client_memberships cm
      WHERE cm.profile_id = auth.uid() AND cm.revoked_at IS NULL
    )
  );
