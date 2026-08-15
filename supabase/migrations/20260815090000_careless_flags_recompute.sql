-- 20260815090000_careless_flags_recompute.sql
-- Let careless-responding flags be recomputed for a session.
--
-- session_quality_flags.session_id carried a plain UNIQUE constraint, which
-- counts soft-deleted rows. insertSessionQualityFlags soft-deletes the previous
-- row and inserts a fresh one, so the SECOND computation for any session failed
-- with a duplicate-key error. Since calibration now scores every session in its
-- scope, re-running calibration would have broken on every session already
-- scored — i.e. on the second run onwards.
--
-- Replace it with a partial unique index over live rows only: one active flag
-- row per session, any number of superseded ones retained for audit.

ALTER TABLE session_quality_flags
  DROP CONSTRAINT IF EXISTS session_quality_flags_session_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_quality_flags_one_live_per_session
  ON session_quality_flags(session_id)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_session_quality_flags_one_live_per_session IS
  'One live flags row per session. Soft-deleted rows are excluded so a session can be re-scored without colliding with its own history.';
