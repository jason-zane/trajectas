-- =============================================================================
-- 20260522190000 — consultant_notified_at on report_snapshots
--
-- Tracks when the post-release consultant notification was sent for a given
-- snapshot. Used to keep the consultant-notification path idempotent (we only
-- send once per snapshot, even if the runner re-fires the release path or
-- markSnapshotReleased is called more than once).
-- =============================================================================

ALTER TABLE report_snapshots
  ADD COLUMN IF NOT EXISTS consultant_notified_at timestamptz;

COMMENT ON COLUMN report_snapshots.consultant_notified_at IS
  'When the post-release consultant notification email was sent for this snapshot. Null until the first consultant notification fires. Used for idempotency.';
