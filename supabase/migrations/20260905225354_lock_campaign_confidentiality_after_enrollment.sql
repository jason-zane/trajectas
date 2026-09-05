-- A campaign's confidentiality promise is fixed once participants have been
-- enrolled. Existing bearer links cannot be retrospectively made private by
-- changing standard -> aggregate_only, and the reverse weakens prior consent.
-- Soft-deleted, withdrawn and expired participants still count as enrollment.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.lock_campaign_for_participant_enrollment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- FOR SHARE conflicts with the row lock held by a campaign UPDATE. An
  -- enrollment that wins first is visible to the waiting UPDATE's guard; a
  -- mode change that wins first commits before enrollment may complete.
  PERFORM 1 FROM campaigns WHERE id=NEW.campaign_id FOR SHARE;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.lock_campaign_for_participant_enrollment() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.guard_enrolled_campaign_confidentiality()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.confidentiality_mode IS DISTINCT FROM OLD.confidentiality_mode
    AND EXISTS (SELECT 1 FROM campaign_participants WHERE campaign_id=OLD.id) THEN
    RAISE EXCEPTION 'Campaign confidentiality cannot change after participants are enrolled; create a new campaign.'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_enrolled_campaign_confidentiality() FROM PUBLIC,anon,authenticated;

CREATE TRIGGER campaign_participant_enrollment_lock
BEFORE INSERT OR UPDATE OF campaign_id ON public.campaign_participants
FOR EACH ROW EXECUTE FUNCTION private.lock_campaign_for_participant_enrollment();
CREATE TRIGGER enrolled_campaign_confidentiality_guard
BEFORE UPDATE OF confidentiality_mode ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION private.guard_enrolled_campaign_confidentiality();
