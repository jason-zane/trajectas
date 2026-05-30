-- Leadership 360: track when a rater was last reminded, so the admin can see
-- who's been nudged and avoid spamming. Drives the "Remind" UI on the Subject &
-- Raters tab; also the anchor for a future automated reminder cadence.

ALTER TABLE campaign_raters
  ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;

COMMENT ON COLUMN campaign_raters.last_reminded_at IS
  'When a reminder email was last sent to this rater (NULL = never reminded).';
