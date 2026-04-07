-- Campaign factor selection: allows per-campaign customisation of which
-- factors within an assessment are included.

-- 1. Junction table for custom factor selections
CREATE TABLE IF NOT EXISTS campaign_assessment_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_assessment_id UUID NOT NULL REFERENCES campaign_assessments(id) ON DELETE CASCADE,
  factor_id UUID NOT NULL REFERENCES factors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_campaign_assessment_factor UNIQUE (campaign_assessment_id, factor_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_assessment_factors_ca
  ON campaign_assessment_factors(campaign_assessment_id);

COMMENT ON TABLE campaign_assessment_factors IS
  'Per-campaign factor selection. No rows = full assessment (all factors). Rows present = custom selection of specific factors only.';

-- 2. Enable customisation toggle on assessments
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS min_custom_factors INT DEFAULT NULL;

COMMENT ON COLUMN assessments.min_custom_factors IS
  'Minimum factors required for custom selection. NULL = customisation not allowed.';

-- 3. RLS — writes go through admin client in server actions
ALTER TABLE campaign_assessment_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_full_access" ON campaign_assessment_factors
  FOR ALL TO authenticated
  USING (is_platform_admin());

CREATE POLICY "campaign_assessment_factors_select" ON campaign_assessment_factors
  FOR SELECT TO authenticated
  USING (
    campaign_assessment_id IN (
      SELECT ca.id FROM campaign_assessments ca
      JOIN campaigns c ON c.id = ca.campaign_id
      WHERE c.client_id = auth_user_client_id()
         OR c.partner_id = auth_user_partner_id()
    )
  );
