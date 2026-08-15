-- 20260814180000_careless_responding.sql
-- Session-level careless responding detection indices.
--
-- This migration introduces quality flags for respondent inattention detection,
-- stored per participant_sessions in a new additive table `session_quality_flags`.
--
-- Changes:
-- 1. Create session_quality_flags table with four indices:
--    - long_string: longest run of identical consecutive responses
--    - even_odd_consistency: split-half correlation
--    - psychometric_antonyms: reverse-scored item agreement
--    - response_time_floor: latency distribution
-- 2. Overall careless_verdict synthesizes all indices.
-- 3. Partial indexes for efficient querying of flagged sessions.
-- 4. RLS policy for admin access (platform_admin = true).

-- ============================================================================
-- 1. Create session_quality_flags table
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_quality_flags (
  id                                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                              UUID NOT NULL UNIQUE REFERENCES participant_sessions(id) ON DELETE CASCADE,

  -- LONG-STRING index
  long_string_max_run_length              INT,
  long_string_start_index                 INT,
  long_string_value                       NUMERIC,
  long_string_detected                    BOOLEAN,

  -- EVEN-ODD CONSISTENCY index
  even_odd_correlation                    NUMERIC(6,4),
  even_odd_spearman_brown                 NUMERIC(6,4),
  even_odd_detected                       BOOLEAN,

  -- PSYCHOMETRIC ANTONYMS index
  psychometric_antonyms_mean_agreement    NUMERIC(6,4),
  psychometric_antonyms_pair_count        INT,
  psychometric_antonyms_detected          BOOLEAN,

  -- RESPONSE-TIME FLOOR index
  response_time_floor_detected            BOOLEAN,
  response_time_median_ms                 INT,
  response_time_min_ms                    INT,
  response_time_max_ms                    INT,
  response_time_fast_proportion           NUMERIC(6,4),
  response_time_has_data                  BOOLEAN,

  -- Overall verdict and audit trail
  overall_careless_verdict                BOOLEAN NOT NULL DEFAULT false,
  computed_at                             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete for replayability
  deleted_at                              TIMESTAMPTZ
);

-- Document table and columns
COMMENT ON TABLE session_quality_flags IS
  'Per-session careless responding detection indices. Computed during or after calibration runs. '
  'Each index independently detects a category of inattentive behavior; overall_careless_verdict '
  'synthesizes them. Additive only: never alters participant_sessions, only stores analysis results.';

COMMENT ON COLUMN session_quality_flags.long_string_max_run_length IS
  'Maximum run length of identical consecutive responses (e.g., all 5s). '
  'NULL if not computable (< 3 items, all identical). Threshold: >= 6 for scale >= 20 items.';

COMMENT ON COLUMN session_quality_flags.long_string_detected IS
  'True if long_string_max_run_length exceeds flagging threshold (>= 6 for large scales). '
  'NULL if the index is not computable.';

COMMENT ON COLUMN session_quality_flags.even_odd_correlation IS
  'Pearson correlation between even-indexed and odd-indexed item responses (split-half). '
  'NULL if not computable (< 4 items, zero variance). Low or negative = inconsistent respondent.';

COMMENT ON COLUMN session_quality_flags.even_odd_spearman_brown IS
  'Spearman-Brown corrected split-half reliability coefficient. '
  'Ranges [0, 1]; < 0.5 indicates poor internal consistency / careless responding.';

COMMENT ON COLUMN session_quality_flags.even_odd_detected IS
  'True if Spearman-Brown corrected reliability < 0.50. '
  'NULL if the index is not computable.';

COMMENT ON COLUMN session_quality_flags.psychometric_antonyms_mean_agreement IS
  'Mean agreement rate across reverse-scored item pairs. Ranges [0, 1]. '
  'Close to 1 = high agreement on opposite items = careless. '
  'NULL if no reverse-scored item pairs exist.';

COMMENT ON COLUMN session_quality_flags.psychometric_antonyms_pair_count IS
  'Number of reverse-scored item pairs identified in the assessment construct(s). '
  'Null if no pairs exist.';

COMMENT ON COLUMN session_quality_flags.psychometric_antonyms_detected IS
  'True if psychometric_antonyms_mean_agreement > 0.65 (high careless agreement). '
  'NULL if the index is not computable.';

COMMENT ON COLUMN session_quality_flags.response_time_floor_detected IS
  'True if > 50% of responses completed in < 1000ms (floor effect). '
  'Indicates rushing through survey. NULL if no per-response timing data available.';

COMMENT ON COLUMN session_quality_flags.response_time_median_ms IS
  'Median response time (milliseconds) for this session. '
  'NULL if no timing data available.';

COMMENT ON COLUMN session_quality_flags.overall_careless_verdict IS
  'True if any single index is flagged as detected (boolean and true). '
  'Conservative: one strong signal is enough. Intended for human review, not automated exclusion.';

COMMENT ON COLUMN session_quality_flags.computed_at IS
  'Timestamp when this row''s indices were computed (when calibration ran or replay was triggered).';

COMMENT ON COLUMN session_quality_flags.deleted_at IS
  'Soft-delete timestamp for archival without losing audit trail.';

-- ============================================================================
-- 2. Indexes for efficient querying
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_session_quality_flags_session_id
  ON session_quality_flags(session_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_session_quality_flags_verdict
  ON session_quality_flags(overall_careless_verdict)
  WHERE deleted_at IS NULL AND overall_careless_verdict = true;

CREATE INDEX IF NOT EXISTS idx_session_quality_flags_long_string_detected
  ON session_quality_flags(long_string_detected)
  WHERE deleted_at IS NULL AND long_string_detected = true;

CREATE INDEX IF NOT EXISTS idx_session_quality_flags_even_odd_detected
  ON session_quality_flags(even_odd_detected)
  WHERE deleted_at IS NULL AND even_odd_detected = true;

CREATE INDEX IF NOT EXISTS idx_session_quality_flags_antonyms_detected
  ON session_quality_flags(psychometric_antonyms_detected)
  WHERE deleted_at IS NULL AND psychometric_antonyms_detected = true;

CREATE INDEX IF NOT EXISTS idx_session_quality_flags_time_floor_detected
  ON session_quality_flags(response_time_floor_detected)
  WHERE deleted_at IS NULL AND response_time_floor_detected = true;

-- ============================================================================
-- 3. RLS: enable read-only for admins
-- ============================================================================

ALTER TABLE session_quality_flags ENABLE ROW LEVEL SECURITY;

-- Platform-admin only, matching every other engine table. Uses the shared
-- is_platform_admin() helper rather than reading auth.users.raw_app_meta_data
-- directly: one definition of "admin" is the only way this stays consistent
-- when the rule changes.
-- DROP-then-CREATE so the migration is replayable against a database that
-- already has the policy; CREATE POLICY has no IF NOT EXISTS.
DROP POLICY IF EXISTS session_quality_flags_admin_read ON session_quality_flags;
DROP POLICY IF EXISTS session_quality_flags_admin_insert ON session_quality_flags;
DROP POLICY IF EXISTS session_quality_flags_platform_admin_all ON session_quality_flags;

CREATE POLICY "session_quality_flags_platform_admin_all" ON session_quality_flags
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
