-- 20260814140000_internal_data_and_calibration_scope.sql
-- Internal-data flagging and calibration run scoping.
--
-- This migration introduces data-quality gates: campaigns and sessions can be marked internal
-- (test data excluded from psychometric analysis by default), and calibration runs can be scoped
-- to specific campaigns, assessments, and options for reproducible, auditable analysis.
--
-- Changes:
-- 1. Backfill is_internal flag on six audit-confirmed test campaigns and their sessions.
-- 2. Add scoping columns to calibration_runs: campaign_ids, assessment_id, include_internal,
--    label, session_count, deleted_at — making runs reproducible and comparable.
-- 3. Add item_version traceability to item_statistics for version-aware analysis.
-- 4. Partial indexes on is_internal = true for efficient filtering of internal-only data.

-- ============================================================================
-- 1. Internal-data flags: campaigns
-- ============================================================================
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN campaigns.is_internal IS
  'True if this campaign is internal test data, excluded from psychometric analysis by default.';

CREATE INDEX IF NOT EXISTS idx_campaigns_is_internal
  ON campaigns(is_internal) WHERE is_internal;

-- ============================================================================
-- 2. Internal-data flags: participant_sessions
-- ============================================================================
ALTER TABLE participant_sessions
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN participant_sessions.is_internal IS
  'True if this session is internal test data, excluded from psychometric analysis by default.';

CREATE INDEX IF NOT EXISTS idx_participant_sessions_is_internal
  ON participant_sessions(is_internal) WHERE is_internal;

-- ============================================================================
-- 3. Backfill: mark six audit-confirmed test campaigns as internal
-- ============================================================================
-- These campaigns were explicitly verified by audit (2026-08-14) as internal test data.
-- All 1,296 production responses come from these six campaigns.
-- This list is auditable and reversible by setting is_internal back to false.
UPDATE campaigns
SET is_internal = true
WHERE id IN (
  '462175f2-2a5c-47f2-8fb0-44634d962fca'::uuid,  -- 5Brains Test 1
  '4012a066-5311-4771-9fed-22b1332e0c26'::uuid,  -- June test
  '2330104a-25fa-43d2-bed3-9713fff7f0cc'::uuid,  -- 5Brains Master Test
  'c1f4d660-f6df-47c3-b80c-afb7013cce2c'::uuid,  -- EPP Test 3
  '00001c56-5745-43e4-a01f-2e2436b31e52'::uuid,  -- Watermark Demo
  '986f5601-4517-40e2-aa3d-e29abb9f1667'::uuid   -- Watermark (test)
);

-- Mark all sessions of those campaigns as internal.
UPDATE participant_sessions
SET is_internal = true
WHERE campaign_id IN (
  '462175f2-2a5c-47f2-8fb0-44634d962fca'::uuid,
  '4012a066-5311-4771-9fed-22b1332e0c26'::uuid,
  '2330104a-25fa-43d2-bed3-9713fff7f0cc'::uuid,
  'c1f4d660-f6df-47c3-b80c-afb7013cce2c'::uuid,
  '00001c56-5745-43e4-a01f-2e2436b31e52'::uuid,
  '986f5601-4517-40e2-aa3d-e29abb9f1667'::uuid
);

-- ============================================================================
-- 4. Calibration scoping: extend calibration_runs with run definition columns
-- ============================================================================
ALTER TABLE calibration_runs
  ADD COLUMN IF NOT EXISTS campaign_ids UUID[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS include_internal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS session_count INT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN calibration_runs.campaign_ids IS
  'Array of campaign IDs to include; null means all eligible campaigns (subject to include_internal flag).';

COMMENT ON COLUMN calibration_runs.assessment_id IS
  'Optional: if set, restrict this run to sessions from this specific assessment.';

COMMENT ON COLUMN calibration_runs.include_internal IS
  'If false (default), exclude sessions with is_internal = true; if true, include them.';

COMMENT ON COLUMN calibration_runs.label IS
  'Human-readable label for this run, e.g., "Baseline 2026-Q3" or "Validation cohort exclude-EPP".';

COMMENT ON COLUMN calibration_runs.session_count IS
  'Number of sessions analyzed in this run (denormalized for audit trail and comparison).';

COMMENT ON COLUMN calibration_runs.deleted_at IS
  'Soft-delete timestamp; runs are never hard-deleted for reproducibility and audit trail.';

CREATE INDEX IF NOT EXISTS idx_calibration_runs_assessment_id
  ON calibration_runs(assessment_id);

CREATE INDEX IF NOT EXISTS idx_calibration_runs_label
  ON calibration_runs(label);

CREATE INDEX IF NOT EXISTS idx_calibration_runs_deleted_at
  ON calibration_runs(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- 5. Item-version traceability: extend item_statistics
-- ============================================================================
ALTER TABLE item_statistics
  ADD COLUMN IF NOT EXISTS item_version INT;

COMMENT ON COLUMN item_statistics.item_version IS
  'Version of the item at the time this statistic was computed; allows version-aware rollup and tracking of changes over time.';

CREATE INDEX IF NOT EXISTS idx_item_statistics_item_version
  ON item_statistics(item_version) WHERE item_version IS NOT NULL;
