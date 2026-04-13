BEGIN;

ALTER TABLE participant_sessions
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS processing_error TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

UPDATE participant_sessions ps
SET
  processing_status = CASE
    WHEN ps.status <> 'completed' THEN 'idle'
    WHEN EXISTS (
      SELECT 1
      FROM report_snapshots rs
      WHERE rs.participant_session_id = ps.id
        AND rs.audience_type = 'participant'
        AND rs.status IN ('pending', 'generating')
    ) THEN 'reporting'
    WHEN EXISTS (
      SELECT 1
      FROM report_snapshots rs
      WHERE rs.participant_session_id = ps.id
        AND rs.audience_type = 'participant'
        AND rs.status IN ('ready', 'released')
    ) THEN 'ready'
    WHEN EXISTS (
      SELECT 1
      FROM report_snapshots rs
      WHERE rs.participant_session_id = ps.id
        AND rs.audience_type = 'participant'
        AND rs.status = 'failed'
    ) THEN 'failed'
    WHEN EXISTS (
      SELECT 1
      FROM participant_scores psc
      WHERE psc.session_id = ps.id
    ) THEN 'ready'
    ELSE 'idle'
  END,
  processing_error = CASE
    WHEN EXISTS (
      SELECT 1
      FROM report_snapshots rs
      WHERE rs.participant_session_id = ps.id
        AND rs.audience_type = 'participant'
        AND rs.status = 'failed'
    ) THEN (
      SELECT rs.error_message
      FROM report_snapshots rs
      WHERE rs.participant_session_id = ps.id
        AND rs.audience_type = 'participant'
        AND rs.status = 'failed'
      ORDER BY rs.updated_at DESC
      LIMIT 1
    )
    ELSE NULL
  END,
  processed_at = CASE
    WHEN EXISTS (
      SELECT 1
      FROM report_snapshots rs
      WHERE rs.participant_session_id = ps.id
        AND rs.audience_type = 'participant'
        AND rs.status IN ('ready', 'released')
    ) THEN COALESCE(
      (
        SELECT COALESCE(rs.generated_at, rs.released_at)
        FROM report_snapshots rs
        WHERE rs.participant_session_id = ps.id
          AND rs.audience_type = 'participant'
          AND rs.status IN ('ready', 'released')
        ORDER BY rs.updated_at DESC
        LIMIT 1
      ),
      ps.completed_at,
      now()
    )
    WHEN EXISTS (
      SELECT 1
      FROM participant_scores psc
      WHERE psc.session_id = ps.id
    ) THEN COALESCE(ps.completed_at, now())
    ELSE NULL
  END;

ALTER TABLE participant_sessions
  DROP CONSTRAINT IF EXISTS participant_sessions_processing_status_check;

ALTER TABLE participant_sessions
  ADD CONSTRAINT participant_sessions_processing_status_check
  CHECK (
    processing_status IN (
      'idle',
      'scoring',
      'scored',
      'reporting',
      'ready',
      'failed'
    )
  );

CREATE INDEX IF NOT EXISTS idx_participant_sessions_processing_status
  ON participant_sessions (processing_status);

COMMIT;
