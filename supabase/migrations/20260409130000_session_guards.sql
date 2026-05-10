-- Prevent duplicate participant sessions for the same assessment
-- (guards against race condition in startSession)
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_sessions_unique_assessment
  ON participant_sessions (campaign_participant_id, assessment_id)
  WHERE status IN ('not_started', 'in_progress', 'completed');
-- Add deleted_at column to campaign_participants for soft-delete support
ALTER TABLE campaign_participants
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
-- Add deleted_at column to campaign_assessments for soft-delete support
ALTER TABLE campaign_assessments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
