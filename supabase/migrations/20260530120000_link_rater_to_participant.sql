-- Leadership 360 — Phase 3b: let raters take the observer survey via the runner.
--
-- Approach A (rater-as-participant): a rater takes their survey through the
-- existing assessment runner via a normal campaign_participants row. This column
-- both FLAGS that row as an observer's taking-row and LINKS it back to the rater.
--
--   campaign_rater_id IS NULL  → the subject / a normal self participant
--   campaign_rater_id IS SET   → this participant row is rater <id> taking the
--                                observer-worded survey
--
-- The runner serves stem_observer for sessions whose participant has this set,
-- and subject-facing participant views/counts must filter it to NULL.
--
-- See docs/superpowers/specs/2026-05-29-leadership-360-campaigns-design.md §5.4.

ALTER TABLE campaign_participants
  ADD COLUMN IF NOT EXISTS campaign_rater_id UUID
    REFERENCES campaign_raters(id) ON DELETE CASCADE;

COMMENT ON COLUMN campaign_participants.campaign_rater_id IS
  'When set, this participant row is a 360 rater taking the observer-worded survey '
  '(links to campaign_raters.id). NULL = subject or normal self participant.';

-- One participant row per rater.
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_participants_rater
  ON campaign_participants(campaign_rater_id)
  WHERE campaign_rater_id IS NOT NULL;
