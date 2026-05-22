-- =============================================================================
-- 20260522120000 — Composite-score columns on participant_sessions + sent-to-
-- participant timestamp on report_snapshots.
--
-- 1. composite_score / composite_method on participant_sessions
--    Single overall-score number per session, computed at scoring time.
--    composite_method records how it was derived so we can change defaults
--    later without losing history. v1 default = 'mean_of_children'.
--
-- 2. sent_to_participant_at on report_snapshots
--    Distinguishes "auto-released for viewing" (status='released' +
--    released_at) from "actually emailed to the participant" — two different
--    events that were collapsing onto the same column.
-- =============================================================================

ALTER TABLE participant_sessions
  ADD COLUMN IF NOT EXISTS composite_score numeric,
  ADD COLUMN IF NOT EXISTS composite_method text;

COMMENT ON COLUMN participant_sessions.composite_score IS
  'Overall score for this session (POMP 0–100). Computed at scoring time as the mean of the assessment-level scored entities (constructs for construct-scored assessments, factors for factor-scored). Null until scoring completes.';

COMMENT ON COLUMN participant_sessions.composite_method IS
  'Method used to compute composite_score. v1 only supports mean_of_children. Recorded for forward-compat when weighted/configurable formulas land.';

ALTER TABLE report_snapshots
  ADD COLUMN IF NOT EXISTS sent_to_participant_at timestamptz;

COMMENT ON COLUMN report_snapshots.sent_to_participant_at IS
  'When the report was emailed to the participant (separate from released_at, which marks available for viewing). Null until a Send action fires.';

-- Backfill composite_score for sessions that already have scores. The
-- session-scoring path only writes composite on future runs, so without this
-- backfill every historical session would render null in the new UI.
-- Idempotent: WHERE composite_score IS NULL skips already-populated rows on
-- any subsequent run (e.g. local-dev DB resets after the column landed).
UPDATE participant_sessions ps
SET composite_score = sub.avg_score,
    composite_method = 'mean_of_children'
FROM (
  SELECT session_id, AVG(scaled_score) AS avg_score
  FROM participant_scores
  GROUP BY session_id
) sub
WHERE ps.id = sub.session_id
  AND ps.composite_score IS NULL;
