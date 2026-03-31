-- =============================================================================
-- Migration 00042: Report generation system — tables, enums, RLS, seeds
-- Note: ai_prompt_purpose enum extension + prompt seed are in 00043 because
-- PostgreSQL does not allow ADD VALUE to be used in the same transaction.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. New enum types
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE report_type AS ENUM ('self_report', '360');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_display_level AS ENUM ('dimension', 'factor', 'construct');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE person_reference_type AS ENUM ('you', 'first_name', 'participant', 'the_participant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_snapshot_status AS ENUM ('pending', 'generating', 'ready', 'released', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_audience_type AS ENUM ('participant', 'hr_manager', 'consultant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE narrative_mode_type AS ENUM ('derived', 'ai_enhanced');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Add band + development fields to taxonomy tables
-- ---------------------------------------------------------------------------

ALTER TABLE dimensions
  ADD COLUMN IF NOT EXISTS band_label_low         TEXT,
  ADD COLUMN IF NOT EXISTS band_label_mid         TEXT,
  ADD COLUMN IF NOT EXISTS band_label_high        TEXT,
  ADD COLUMN IF NOT EXISTS pomp_threshold_low     INTEGER,
  ADD COLUMN IF NOT EXISTS pomp_threshold_high    INTEGER,
  ADD COLUMN IF NOT EXISTS development_suggestion TEXT;

ALTER TABLE factors
  ADD COLUMN IF NOT EXISTS band_label_low         TEXT,
  ADD COLUMN IF NOT EXISTS band_label_mid         TEXT,
  ADD COLUMN IF NOT EXISTS band_label_high        TEXT,
  ADD COLUMN IF NOT EXISTS pomp_threshold_low     INTEGER,
  ADD COLUMN IF NOT EXISTS pomp_threshold_high    INTEGER,
  ADD COLUMN IF NOT EXISTS development_suggestion TEXT;

ALTER TABLE constructs
  ADD COLUMN IF NOT EXISTS band_label_low         TEXT,
  ADD COLUMN IF NOT EXISTS band_label_mid         TEXT,
  ADD COLUMN IF NOT EXISTS band_label_high        TEXT,
  ADD COLUMN IF NOT EXISTS pomp_threshold_low     INTEGER,
  ADD COLUMN IF NOT EXISTS pomp_threshold_high    INTEGER,
  ADD COLUMN IF NOT EXISTS development_suggestion TEXT;

-- ---------------------------------------------------------------------------
-- 3. report_templates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS report_templates (
  id               UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id       UUID                 REFERENCES partners(id) ON DELETE CASCADE,
  name             TEXT                 NOT NULL,
  description      TEXT,
  report_type      report_type          NOT NULL DEFAULT 'self_report',
  display_level    report_display_level NOT NULL DEFAULT 'factor',
  group_by_dimension BOOLEAN            NOT NULL DEFAULT false,
  person_reference person_reference_type NOT NULL DEFAULT 'the_participant',
  auto_release     BOOLEAN              NOT NULL DEFAULT false,
  blocks           JSONB                NOT NULL DEFAULT '[]'::jsonb,
  is_active        BOOLEAN              NOT NULL DEFAULT true,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ          NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ          NOT NULL DEFAULT now(),

  CONSTRAINT report_templates_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS report_templates_partner_id_idx
  ON report_templates (partner_id);
CREATE INDEX IF NOT EXISTS report_templates_report_type_idx
  ON report_templates (report_type);
CREATE INDEX IF NOT EXISTS report_templates_active_idx
  ON report_templates (is_active) WHERE deleted_at IS NULL;

CREATE TRIGGER set_report_templates_updated_at
  BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE report_templates IS
  'Reusable report layouts for a single audience. Blocks stored as ordered JSONB array.';

-- ---------------------------------------------------------------------------
-- 4. campaign_report_config
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS campaign_report_config (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id              UUID NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
  participant_template_id  UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  hr_manager_template_id   UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  consultant_template_id   UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_campaign_report_config_updated_at
  BEFORE UPDATE ON campaign_report_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE campaign_report_config IS
  'Maps audience types to report templates for a campaign. One row per campaign.';

-- ---------------------------------------------------------------------------
-- 5. report_snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS report_snapshots (
  id                     UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id            UUID                   NOT NULL REFERENCES report_templates(id),
  participant_session_id UUID                   NOT NULL REFERENCES participant_sessions(id) ON DELETE CASCADE,
  campaign_id            UUID                   NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  audience_type          report_audience_type   NOT NULL,
  status                 report_snapshot_status NOT NULL DEFAULT 'pending',
  narrative_mode         narrative_mode_type    NOT NULL DEFAULT 'derived',
  rendered_data          JSONB,
  pdf_url                TEXT,
  released_at            TIMESTAMPTZ,
  released_by            UUID                   REFERENCES profiles(id),
  generated_at           TIMESTAMPTZ,
  error_message          TEXT,
  created_at             TIMESTAMPTZ            NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ            NOT NULL DEFAULT now(),

  CONSTRAINT report_snapshots_session_audience_unique
    UNIQUE (participant_session_id, audience_type)
);

CREATE INDEX IF NOT EXISTS report_snapshots_session_id_idx
  ON report_snapshots (participant_session_id);
CREATE INDEX IF NOT EXISTS report_snapshots_campaign_id_idx
  ON report_snapshots (campaign_id);
CREATE INDEX IF NOT EXISTS report_snapshots_status_idx
  ON report_snapshots (status);
CREATE INDEX IF NOT EXISTS report_snapshots_pending_idx
  ON report_snapshots (status, created_at) WHERE status = 'pending';

CREATE TRIGGER set_report_snapshots_updated_at
  BEFORE UPDATE ON report_snapshots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE report_snapshots IS
  'Point-in-time report renders. One row per session x audience. Frozen at generation.';

-- ---------------------------------------------------------------------------
-- 6. Snapshot creation trigger on participant_sessions completion
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_report_snapshots_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_config
  FROM campaign_report_config
  WHERE campaign_id = NEW.campaign_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_config.participant_template_id IS NOT NULL THEN
    INSERT INTO report_snapshots
      (template_id, participant_session_id, campaign_id, audience_type, status)
    VALUES
      (v_config.participant_template_id, NEW.id, NEW.campaign_id, 'participant', 'pending')
    ON CONFLICT (participant_session_id, audience_type) DO NOTHING;
  END IF;

  IF v_config.hr_manager_template_id IS NOT NULL THEN
    INSERT INTO report_snapshots
      (template_id, participant_session_id, campaign_id, audience_type, status)
    VALUES
      (v_config.hr_manager_template_id, NEW.id, NEW.campaign_id, 'hr_manager', 'pending')
    ON CONFLICT (participant_session_id, audience_type) DO NOTHING;
  END IF;

  IF v_config.consultant_template_id IS NOT NULL THEN
    INSERT INTO report_snapshots
      (template_id, participant_session_id, campaign_id, audience_type, status)
    VALUES
      (v_config.consultant_template_id, NEW.id, NEW.campaign_id, 'consultant', 'pending')
    ON CONFLICT (participant_session_id, audience_type) DO NOTHING;
  END IF;

  PERFORM pg_notify('report_generation_queue', NEW.id::text);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_session_completed_create_snapshots ON participant_sessions;
CREATE TRIGGER on_session_completed_create_snapshots
  AFTER UPDATE OF status ON participant_sessions
  FOR EACH ROW EXECUTE FUNCTION create_report_snapshots_on_completion();

-- ---------------------------------------------------------------------------
-- 7. RLS policies
-- ---------------------------------------------------------------------------

ALTER TABLE report_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_report_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_snapshots       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_templates_select" ON report_templates
  FOR SELECT TO authenticated
  USING (
    partner_id IS NULL
    OR partner_id IN (
      SELECT pm.partner_id FROM partner_memberships pm
      WHERE pm.profile_id = auth.uid()
    )
  );

CREATE POLICY "report_templates_insert" ON report_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    partner_id IN (
      SELECT pm.partner_id FROM partner_memberships pm
      WHERE pm.profile_id = auth.uid() AND pm.role = 'admin'
    )
  );

CREATE POLICY "report_templates_update" ON report_templates
  FOR UPDATE TO authenticated
  USING (
    partner_id IN (
      SELECT pm.partner_id FROM partner_memberships pm
      WHERE pm.profile_id = auth.uid() AND pm.role = 'admin'
    )
  );

CREATE POLICY "campaign_report_config_select" ON campaign_report_config
  FOR SELECT TO authenticated
  USING (
    campaign_id IN (
      SELECT c.id FROM campaigns c
      JOIN partner_memberships pm ON pm.partner_id = c.partner_id
      WHERE pm.profile_id = auth.uid()
    )
  );

CREATE POLICY "campaign_report_config_all" ON campaign_report_config
  FOR ALL TO authenticated
  USING (
    campaign_id IN (
      SELECT c.id FROM campaigns c
      JOIN partner_memberships pm ON pm.partner_id = c.partner_id
      WHERE pm.profile_id = auth.uid()
    )
  );

CREATE POLICY "report_snapshots_consultant_select" ON report_snapshots
  FOR SELECT TO authenticated
  USING (
    audience_type = 'consultant'
    AND status IN ('ready', 'released')
    AND campaign_id IN (
      SELECT c.id FROM campaigns c
      JOIN partner_memberships pm ON pm.partner_id = c.partner_id
      WHERE pm.profile_id = auth.uid()
    )
  );

CREATE POLICY "report_snapshots_participant_select" ON report_snapshots
  FOR SELECT TO authenticated
  USING (
    audience_type = 'participant'
    AND released_at IS NOT NULL
    AND participant_session_id IN (
      SELECT ps.id FROM participant_sessions ps
      WHERE ps.participant_profile_id = auth.uid()
    )
  );

CREATE POLICY "report_snapshots_hr_manager_select" ON report_snapshots
  FOR SELECT TO authenticated
  USING (
    audience_type = 'hr_manager'
    AND released_at IS NOT NULL
    AND campaign_id IN (
      SELECT c.id FROM campaigns c
      JOIN client_memberships cm ON cm.organization_id = c.organization_id
      WHERE cm.profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Seed 4 platform-global templates
-- ---------------------------------------------------------------------------

INSERT INTO report_templates
  (id, partner_id, name, description, report_type, display_level,
   group_by_dimension, person_reference, auto_release, blocks, is_active)
VALUES
  (
    'a1b2c3d4-0001-0000-0000-000000000001',
    NULL,
    'Standard Individual',
    'Participant-facing self-report summary with narrative, strengths, and development plan.',
    'self_report', 'factor', true, 'you', false,
    '[
      {"id":"blk-si-01","type":"cover_page","order":1,"config":{"showDate":true,"showLogo":true}},
      {"id":"blk-si-02","type":"custom_text","order":2,"config":{"heading":"About This Report","content":"This report summarises your assessment results. Use it as a guide for reflection and professional development."}},
      {"id":"blk-si-03","type":"score_overview","order":3,"config":{"chartType":"radar","displayLevel":"factor","groupByDimension":true,"showDimensionScore":true}},
      {"id":"blk-si-04","type":"score_detail","order":4,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":false,"showChildBreakdown":false}},
      {"id":"blk-si-05","type":"score_detail","order":5,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":false,"showChildBreakdown":false}},
      {"id":"blk-si-06","type":"score_detail","order":6,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":false,"showChildBreakdown":false}},
      {"id":"blk-si-07","type":"strengths_highlights","order":7,"config":{"topN":3,"displayLevel":"factor","style":"cards"}},
      {"id":"blk-si-08","type":"development_plan","order":8,"config":{"maxItems":3,"prioritiseByScore":true}}
    ]'::jsonb,
    true
  ),
  (
    'a1b2c3d4-0001-0000-0000-000000000002',
    NULL,
    'Hiring Manager Brief',
    'Concise hr_manager-facing summary: scores and band labels only.',
    'self_report', 'factor', false, 'the_participant', false,
    '[
      {"id":"blk-hm-01","type":"cover_page","order":1,"config":{"showDate":true,"showLogo":true}},
      {"id":"blk-hm-02","type":"score_overview","order":2,"config":{"chartType":"bars","displayLevel":"factor","groupByDimension":false,"showDimensionScore":false}},
      {"id":"blk-hm-03","type":"score_detail","order":3,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":false,"showIndicators":false,"showDevelopment":false,"showChildBreakdown":false}},
      {"id":"blk-hm-04","type":"score_detail","order":4,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":false,"showIndicators":false,"showDevelopment":false,"showChildBreakdown":false}},
      {"id":"blk-hm-05","type":"custom_text","order":5,"config":{"heading":"Confidentiality Notice","content":"This report is provided for assessment purposes only. Results should be interpreted by a qualified practitioner."}}
    ]'::jsonb,
    true
  ),
  (
    'a1b2c3d4-0001-0000-0000-000000000003',
    NULL,
    '360 Debrief — Participant',
    'Participant-facing 360 report with rater comparison, gap analysis, and development plan.',
    '360', 'factor', true, 'you', false,
    '[
      {"id":"blk-3p-01","type":"cover_page","order":1,"config":{"showDate":true,"showLogo":true}},
      {"id":"blk-3p-02","type":"custom_text","order":2,"config":{"heading":"Confidentiality","content":"Ratings have been aggregated to protect rater anonymity. No individual rater can be identified."}},
      {"id":"blk-3p-03","type":"score_overview","order":3,"config":{"chartType":"radar","displayLevel":"factor","groupByDimension":true,"showDimensionScore":true}},
      {"id":"blk-3p-04","type":"rater_comparison","order":4,"config":{"raterGroups":["self","manager","peers","direct_reports"]}},
      {"id":"blk-3p-05","type":"gap_analysis","order":5,"config":{"gapThreshold":20,"showBlindSpots":true,"showHiddenStrengths":true}},
      {"id":"blk-3p-06","type":"score_detail","order":6,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":true,"showChildBreakdown":false}},
      {"id":"blk-3p-07","type":"score_detail","order":7,"config":{"displayLevel":"factor","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":true,"showChildBreakdown":false}},
      {"id":"blk-3p-08","type":"development_plan","order":8,"config":{"maxItems":3,"prioritiseByScore":true}}
    ]'::jsonb,
    true
  ),
  (
    'a1b2c3d4-0001-0000-0000-000000000004',
    NULL,
    '360 Debrief — Consultant',
    'Full consultant 360 report with construct-level breakdown and open comments.',
    '360', 'construct', true, 'the_participant', false,
    '[
      {"id":"blk-3c-01","type":"cover_page","order":1,"config":{"showDate":true,"showLogo":true}},
      {"id":"blk-3c-02","type":"score_overview","order":2,"config":{"chartType":"radar","displayLevel":"factor","groupByDimension":true,"showDimensionScore":true}},
      {"id":"blk-3c-03","type":"rater_comparison","order":3,"config":{"raterGroups":["self","manager","peers","direct_reports"]}},
      {"id":"blk-3c-04","type":"gap_analysis","order":4,"config":{"gapThreshold":20,"showBlindSpots":true,"showHiddenStrengths":true}},
      {"id":"blk-3c-05","type":"score_detail","order":5,"config":{"displayLevel":"construct","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":true,"showChildBreakdown":true}},
      {"id":"blk-3c-06","type":"score_detail","order":6,"config":{"displayLevel":"construct","entityId":null,"showScore":true,"showBandLabel":true,"showDefinition":true,"showIndicators":true,"showDevelopment":true,"showChildBreakdown":true}},
      {"id":"blk-3c-07","type":"open_comments","order":7,"config":{"minRatersForDisplay":3,"groupByFactor":true}},
      {"id":"blk-3c-08","type":"development_plan","order":8,"config":{"maxItems":5,"prioritiseByScore":true}}
    ]'::jsonb,
    true
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. Extend ai_prompt_purpose enum
-- Must be committed before migration 00043 can INSERT a row using this value.
-- ---------------------------------------------------------------------------

ALTER TYPE ai_prompt_purpose ADD VALUE IF NOT EXISTS 'report_narrative';

COMMIT;
