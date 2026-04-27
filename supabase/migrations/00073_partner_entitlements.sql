-- =============================================================================
-- Partner entitlements: assessment/report assignments + branding flag
-- Mirrors 00066_client_entitlements.sql for the partner level
-- =============================================================================

-- 1. Branding flag
ALTER TABLE partners ADD COLUMN IF NOT EXISTS can_customize_branding BOOLEAN NOT NULL DEFAULT false;
-- 2. Assessment assignments
CREATE TABLE IF NOT EXISTS partner_assessment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  quota_limit INT,  -- NULL = unlimited
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_partner_assessment UNIQUE (partner_id, assessment_id)
);
CREATE INDEX IF NOT EXISTS idx_partner_assessment_assignments_partner
  ON partner_assessment_assignments(partner_id);
-- 3. Report template assignments
CREATE TABLE IF NOT EXISTS partner_report_template_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  report_template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_partner_report_template UNIQUE (partner_id, report_template_id)
);
CREATE INDEX IF NOT EXISTS idx_partner_report_template_assignments_partner
  ON partner_report_template_assignments(partner_id);
-- 4. Partner quota usage function
CREATE OR REPLACE FUNCTION get_partner_assessment_quota_usage(
  p_partner_id UUID,
  p_assessment_id UUID
) RETURNS INT AS $$
  SELECT COALESCE(COUNT(*)::INT, 0)
  FROM campaign_participants cp
  JOIN campaign_assessments ca ON ca.campaign_id = cp.campaign_id
  JOIN campaigns c ON c.id = cp.campaign_id
  JOIN clients cl ON c.client_id = cl.id
  WHERE cl.partner_id = p_partner_id
    AND ca.assessment_id = p_assessment_id
    AND c.deleted_at IS NULL
    AND (
      cp.status IN ('invited', 'registered', 'in_progress', 'completed')
      OR (cp.status = 'withdrawn' AND cp.started_at IS NOT NULL)
    )
$$ LANGUAGE sql STABLE;
-- 5. Updated-at triggers
DROP TRIGGER IF EXISTS trg_partner_assessment_assignments_updated ON partner_assessment_assignments;
CREATE TRIGGER trg_partner_assessment_assignments_updated
  BEFORE UPDATE ON partner_assessment_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_partner_report_template_assignments_updated ON partner_report_template_assignments;
CREATE TRIGGER trg_partner_report_template_assignments_updated
  BEFORE UPDATE ON partner_report_template_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- 6. RLS policies
ALTER TABLE partner_assessment_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_admins_full_access" ON partner_assessment_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );
CREATE POLICY "partner_members_select_own" ON partner_assessment_assignments
  FOR SELECT TO authenticated
  USING (
    partner_id IN (
      SELECT pm.partner_id FROM partner_memberships pm
      WHERE pm.profile_id = auth.uid() AND pm.revoked_at IS NULL
    )
  );
ALTER TABLE partner_report_template_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_admins_full_access" ON partner_report_template_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );
CREATE POLICY "partner_members_select_own" ON partner_report_template_assignments
  FOR SELECT TO authenticated
  USING (
    partner_id IN (
      SELECT pm.partner_id FROM partner_memberships pm
      WHERE pm.profile_id = auth.uid() AND pm.revoked_at IS NULL
    )
  );
