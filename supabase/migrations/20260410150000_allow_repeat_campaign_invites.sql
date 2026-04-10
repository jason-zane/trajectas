-- Allow the same email to be invited to the same campaign more than once.
--
-- Rationale: Participants may legitimately need to retake an assessment within
-- the same campaign (e.g. resend after a technical failure, or a true retake).
-- Each invite already gets its own random access_token and its own
-- participant_sessions rows, so there is no data-integrity reason to enforce
-- one-invite-per-email-per-campaign at the DB level.

ALTER TABLE campaign_participants
  DROP CONSTRAINT IF EXISTS campaign_participants_email_per_campaign;
