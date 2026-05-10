ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_assessments_partner_id
  ON assessments(partner_id)
  WHERE partner_id IS NOT NULL AND deleted_at IS NULL;

DROP POLICY IF EXISTS assessments_select_all ON assessments;
CREATE POLICY assessments_select_all ON assessments
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR (partner_id IS NULL AND client_id IS NULL)
    OR partner_id = ANY(auth_user_partner_ids())
    OR client_id = ANY(auth_user_client_ids())
  );

DROP POLICY IF EXISTS assessments_partner_admin_manage ON assessments;
CREATE POLICY assessments_partner_admin_manage ON assessments
  FOR ALL TO authenticated
  USING (
    partner_id IS NOT NULL
    AND partner_id = ANY(auth_user_partner_admin_ids())
  )
  WITH CHECK (
    partner_id IS NOT NULL
    AND partner_id = ANY(auth_user_partner_admin_ids())
  );;
