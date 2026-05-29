-- Leadership 360 — Phase 2: campaign skeleton.
--
-- A 360 is a campaign *kind*, not a new product. This adds the kind discriminator
-- to campaigns, plus the two 360-specific tables (raters, immutable snapshot).
-- Self campaigns are unaffected (kind defaults to 'self').
--
-- SCOPE: admin test-bed. RLS exposes these tables to platform admins only; no
-- client/partner SELECT policies yet (deferred — see design §1.1a). Subject/rater
-- survey access later runs via service-role tokens, which don't need client RLS.
--
-- See docs/superpowers/specs/2026-05-29-leadership-360-campaigns-design.md §2–§3.

-- ── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE campaign_kind AS ENUM ('self', 'leadership_360');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rater_relationship AS ENUM
    ('self', 'manager', 'peer', 'direct_report', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rater_status AS ENUM
    ('nominated', 'approved', 'declined', 'invited',
     'in_progress', 'completed', 'withdrawn', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── campaigns.kind ───────────────────────────────────────────────────────────
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS kind campaign_kind NOT NULL DEFAULT 'self';

COMMENT ON COLUMN campaigns.kind IS
  'self = single self-assessment (default, legacy behaviour); leadership_360 = '
  'one subject rated by self + observers.';

-- ── campaign_raters ──────────────────────────────────────────────────────────
-- One row per invited rater of the subject. Kept separate from campaign_participants
-- so that table stays cleanly single-rater (no relationship / nomination state).
CREATE TABLE IF NOT EXISTS campaign_raters (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id            UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  subject_participant_id UUID NOT NULL REFERENCES campaign_participants(id) ON DELETE CASCADE,
  relationship           rater_relationship NOT NULL,
  name                   TEXT,
  email                  CITEXT NOT NULL,
  access_token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  session_id             UUID REFERENCES participant_sessions(id) ON DELETE SET NULL,
  status                 rater_status NOT NULL DEFAULT 'nominated',
  nominated_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  nominated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at            TIMESTAMPTZ,
  invited_at             TIMESTAMPTZ,
  started_at             TIMESTAMPTZ,
  completed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ,
  CONSTRAINT campaign_raters_email_per_subject UNIQUE (subject_participant_id, email),
  CONSTRAINT campaign_raters_email_format
    CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT campaign_raters_completed_after_started
    CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_campaign_raters_campaign ON campaign_raters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_raters_subject ON campaign_raters(subject_participant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_raters_status ON campaign_raters(status);
CREATE INDEX IF NOT EXISTS idx_campaign_raters_session
  ON campaign_raters(session_id) WHERE session_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_campaign_raters_updated_at ON campaign_raters;
CREATE TRIGGER trg_campaign_raters_updated_at
  BEFORE UPDATE ON campaign_raters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Anonymity: only platform admins can read/write raters in the test-bed phase.
-- The subject must never be able to see who their raters are; copying the
-- org-diagnostic pattern, there is deliberately NO client/subject SELECT policy.
ALTER TABLE campaign_raters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_raters_all_platform_admin ON campaign_raters;
CREATE POLICY campaign_raters_all_platform_admin ON campaign_raters
  FOR ALL TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- ── campaign_360_snapshots ───────────────────────────────────────────────────
-- Immutable aggregate produced when a 360 campaign closes. Aggregate-only
-- payload; never per-rater rows. One per campaign.
CREATE TABLE IF NOT EXISTS campaign_360_snapshots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id             UUID NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  subject_participant_id  UUID NOT NULL REFERENCES campaign_participants(id) ON DELETE RESTRICT,
  data                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  rater_count             INT NOT NULL DEFAULT 0 CHECK (rater_count >= 0),
  rater_count_by_category JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT campaign_360_snapshots_one_per_campaign UNIQUE (campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_360_snapshots_subject
  ON campaign_360_snapshots(subject_participant_id);

ALTER TABLE campaign_360_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_360_snapshots_all_platform_admin ON campaign_360_snapshots;
CREATE POLICY campaign_360_snapshots_all_platform_admin ON campaign_360_snapshots
  FOR ALL TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
