ALTER TABLE campaign_participants
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS company TEXT;

COMMENT ON COLUMN campaign_participants.job_title IS
  'Optional job title collected during self-registration.';

COMMENT ON COLUMN campaign_participants.company IS
  'Optional company name collected during self-registration.';;
