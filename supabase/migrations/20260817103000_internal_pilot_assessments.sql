-- An assessment that may hold unreviewed cognitive items, and can only ever
-- be taken by us.
--
-- WHY THIS EXISTS
-- ---------------
-- 20260815091500 + 20260815100000 made a cognitive item unplaceable until it
-- has cleared content AND fairness review, checked against the standing
-- sign-offs in `item_reviews`. That gate is correct and stays.
--
-- It also means the bank cannot be tried out. To find out whether a generated
-- item set produces sensible scores you have to sit the thing, and to sit the
-- thing you have to place items, and to place items you have to have reviewed
-- 98 items first. Reviewing is the right cost before anyone is measured
-- against the instrument; it is the wrong cost before we know the instrument
-- is worth reviewing.
--
-- The tempting shortcut is to write approvals into `item_reviews` from a
-- script. That is forbidden, and not merely by convention: a sign-off is a
-- named person's judgement, the table is append-only so it cannot be tidied
-- up afterwards, and a fabricated row is indistinguishable from a real one
-- forever. No code in this repository writes that table.
--
-- So the exception is named instead of faked. `internal_pilot` says out loud
-- "this assessment contains items nobody has reviewed", and three rules keep
-- that claim honest:
--
--   1. The placement gate is relaxed ONLY for an internal pilot.
--   2. An internal pilot cannot be attached to a campaign that is not itself
--      internal — so an unreviewed item can never reach a real candidate.
--      (`campaigns.is_internal` already exists and already excludes those
--      sessions from calibration, which is the other half of what we want:
--      our own practice attempts must not become item statistics.)
--   3. The flag cannot simply be switched off. Clearing it is refused while
--      the assessment still holds an item that would fail the normal gate,
--      so "seed it dirty, then flip it clean" is not a path. The way out is
--      to do the reviews.

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS internal_pilot boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN assessments.internal_pilot IS
  'This assessment may contain cognitive items that have not cleared content and fairness review. It can only be attached to an internal campaign, and the flag cannot be cleared while such items remain placed.';

-- ---------------------------------------------------------------------------
-- 1. The placement gate learns about the exception.
-- ---------------------------------------------------------------------------
-- Same shape as before, with one added lookup. Note it is the ASSESSMENT that
-- carries the permission, not the section: a section is only ever reachable
-- through its assessment, and putting it on the section would let one part of
-- a real assessment quietly opt out.
CREATE OR REPLACE FUNCTION public.cognitive_item_review_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item     RECORD;
  v_blocker  TEXT;
  v_is_pilot BOOLEAN;
BEGIN
  SELECT i.lifecycle_state, i.content_hash
    INTO v_item
    FROM items i
   WHERE i.id = NEW.item_id
     AND EXISTS (SELECT 1 FROM cognitive_item_specs s WHERE s.item_id = i.id);

  -- Not a cognitive item. The gate has never applied to the Likert library.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT a.internal_pilot
    INTO v_is_pilot
    FROM assessment_sections sec
    JOIN assessments a ON a.id = sec.assessment_id
   WHERE sec.id = NEW.section_id;

  IF COALESCE(v_is_pilot, false) THEN
    RETURN NEW;
  END IF;

  IF v_item.lifecycle_state NOT IN ('piloting', 'calibrated', 'operational') THEN
    RAISE EXCEPTION
      'item % is %; a cognitive item cannot be placed in an assessment until it has cleared content and fairness review',
      NEW.item_id, v_item.lifecycle_state
      USING ERRCODE = 'check_violation';
  END IF;

  v_blocker := item_standing_signoff_blocker(NEW.item_id, v_item.content_hash, ARRAY['content', 'fairness']);
  IF v_blocker IS NOT NULL THEN
    RAISE EXCEPTION
      'item % cannot be placed in an assessment — %',
      NEW.item_id, v_blocker
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. An internal pilot cannot reach a real campaign.
-- ---------------------------------------------------------------------------
-- This is the rule that actually protects candidates. Everything else here is
-- bookkeeping; this is the wall.
CREATE OR REPLACE FUNCTION public.internal_pilot_stays_internal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_pilot   BOOLEAN;
  v_campaign   RECORD;
BEGIN
  SELECT a.internal_pilot INTO v_is_pilot
    FROM assessments a WHERE a.id = NEW.assessment_id;

  IF NOT COALESCE(v_is_pilot, false) THEN
    RETURN NEW;
  END IF;

  SELECT c.is_internal, c.title INTO v_campaign
    FROM campaigns c WHERE c.id = NEW.campaign_id;

  IF NOT COALESCE(v_campaign.is_internal, false) THEN
    RAISE EXCEPTION
      'assessment % is an internal pilot and may contain unreviewed items; it cannot be added to campaign "%", which is not an internal campaign',
      NEW.assessment_id, v_campaign.title
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.internal_pilot_stays_internal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS campaign_assessments_internal_pilot_trg ON campaign_assessments;
CREATE TRIGGER campaign_assessments_internal_pilot_trg
  BEFORE INSERT OR UPDATE OF assessment_id, campaign_id ON campaign_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.internal_pilot_stays_internal();

-- The same wall from the other side: a campaign that is already carrying an
-- internal pilot cannot be un-marked as internal.
CREATE OR REPLACE FUNCTION public.campaign_stays_internal_while_piloting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offender TEXT;
BEGIN
  IF NEW.is_internal OR NOT COALESCE(OLD.is_internal, false) THEN
    RETURN NEW;
  END IF;

  SELECT a.title INTO v_offender
    FROM campaign_assessments ca
    JOIN assessments a ON a.id = ca.assessment_id
   WHERE ca.campaign_id = NEW.id
     AND ca.deleted_at IS NULL
     AND a.internal_pilot
   LIMIT 1;

  IF v_offender IS NOT NULL THEN
    RAISE EXCEPTION
      'campaign % cannot stop being internal while it carries the internal pilot "%"',
      NEW.id, v_offender
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_stays_internal_while_piloting() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS campaigns_stay_internal_while_piloting_trg ON campaigns;
CREATE TRIGGER campaigns_stay_internal_while_piloting_trg
  BEFORE UPDATE OF is_internal ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.campaign_stays_internal_while_piloting();

-- ---------------------------------------------------------------------------
-- 3. The flag cannot be laundered off.
-- ---------------------------------------------------------------------------
-- Without this the gate is decorative: seed with the flag on, clear the flag,
-- and you have an ordinary-looking assessment full of unreviewed items that
-- the placement gate will never re-examine, because it only runs on INSERT.
CREATE OR REPLACE FUNCTION public.internal_pilot_clear_requires_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offender UUID;
BEGIN
  IF NEW.internal_pilot OR NOT COALESCE(OLD.internal_pilot, false) THEN
    RETURN NEW;
  END IF;

  SELECT i.id INTO v_offender
    FROM assessment_sections sec
    JOIN assessment_section_items asi ON asi.section_id = sec.id
    JOIN items i ON i.id = asi.item_id
    JOIN cognitive_item_specs s ON s.item_id = i.id
   WHERE sec.assessment_id = NEW.id
     AND (
       i.lifecycle_state NOT IN ('piloting', 'calibrated', 'operational')
       OR item_standing_signoff_blocker(i.id, i.content_hash, ARRAY['content', 'fairness']) IS NOT NULL
     )
   LIMIT 1;

  IF v_offender IS NOT NULL THEN
    RAISE EXCEPTION
      'assessment % still holds unreviewed cognitive item %; review it or remove it before clearing internal_pilot',
      NEW.id, v_offender
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.internal_pilot_clear_requires_review() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS assessments_internal_pilot_clear_trg ON assessments;
CREATE TRIGGER assessments_internal_pilot_clear_trg
  BEFORE UPDATE OF internal_pilot ON assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.internal_pilot_clear_requires_review();
