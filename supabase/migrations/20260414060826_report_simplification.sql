
-- 1. Add is_default to report_templates
ALTER TABLE report_templates
ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN report_templates.is_default IS
  'When true, this template is auto-assigned to new campaigns on creation.';

-- 2. Add brand_mode to campaigns (moved from campaign_report_config)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS brand_mode TEXT NOT NULL DEFAULT 'platform'
CHECK (brand_mode IN ('platform', 'client', 'custom'));

-- 3. Create campaign_report_templates join table
CREATE TABLE IF NOT EXISTS campaign_report_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  template_id UUID        NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  sort_order  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT campaign_report_templates_unique UNIQUE (campaign_id, template_id)
);

CREATE INDEX IF NOT EXISTS campaign_report_templates_campaign_idx
  ON campaign_report_templates (campaign_id);
CREATE INDEX IF NOT EXISTS campaign_report_templates_template_idx
  ON campaign_report_templates (template_id);

COMMENT ON TABLE campaign_report_templates IS
  'Maps report templates to campaigns. Each row = one report generated per completed session.';

-- RLS for campaign_report_templates
ALTER TABLE campaign_report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read campaign_report_templates"
  ON campaign_report_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert campaign_report_templates"
  ON campaign_report_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update campaign_report_templates"
  ON campaign_report_templates FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete campaign_report_templates"
  ON campaign_report_templates FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access to campaign_report_templates"
  ON campaign_report_templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Alter report_snapshots
-- Drop the old unique constraint (session + audience_type)
ALTER TABLE report_snapshots
DROP CONSTRAINT IF EXISTS report_snapshots_session_audience_unique;

-- Make audience_type nullable (existing rows keep their values, new rows won't set it)
ALTER TABLE report_snapshots
ALTER COLUMN audience_type DROP NOT NULL;

-- Add new unique constraint: one snapshot per template per session
ALTER TABLE report_snapshots
ADD CONSTRAINT report_snapshots_session_template_unique
  UNIQUE (participant_session_id, template_id);

-- 5. Migrate brand_mode data from campaign_report_config to campaigns, then drop
UPDATE campaigns c
SET brand_mode = crc.brand_mode
FROM campaign_report_config crc
WHERE crc.campaign_id = c.id
  AND crc.brand_mode != 'platform';

-- Drop campaign_report_config (RLS policies are dropped automatically with the table)
DROP TABLE IF EXISTS campaign_report_config CASCADE;
;
