-- A rejection now takes the item out of service, instead of only being recorded.
--
-- 20260815100000 made the placement gate consult the review ledger, so a
-- rejected item can no longer be PLACED into an assessment. It left one case
-- open, and the migration said so rather than implying otherwise: an item that
-- was already linked when the rejection arrived keeps its link, and
-- lifecycle_state still says `piloting`, so it keeps being served.
--
-- Two ways to close that were on the table:
--
--   (a) Delete the item's assessment_section_items rows on rejection. Rejected
--       because it silently rewrites an assessment's composition — an author
--       would come back to a form quietly one item shorter, with nothing
--       saying why, and no way to put it back except re-adding by hand.
--   (b) Move the item out of every servable state. Chosen. It is the smaller
--       claim: the item is out of service, the form still says what it was
--       built from, and re-approving restores it.
--
-- `suspended` is the state that already means "stop serving this, but it can
-- come back" — 20260814110000 exempts it from sign-off checks precisely
-- because entering it is a withdrawal, not a promotion. What the graph lacked
-- was any edge into it from `piloting`: a pilot could only go forward to
-- `calibrated` or be `killed` outright. That is why (b) looked impossible when
-- this was first written up. Adding the pair below is the actual fix, and it
-- is a gap worth closing on its own merits — "pause a pilot and resume it"
-- should have been expressible from the start.
--
-- Delivery already honours the result: form assembly drops suspended items
-- (src/lib/dal/session-forms.ts) and the placement gate refuses to link them.
-- A session that has already frozen its form keeps what it froze, which stays
-- deliberate — a form must not change under someone mid-test.

-- ---------------------------------------------------------------------------
-- 1. A pilot can now be paused and resumed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.item_lifecycle_legal_transitions()
RETURNS TABLE (from_state item_lifecycle_state, to_state item_lifecycle_state)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT v.f::item_lifecycle_state, v.t::item_lifecycle_state
  FROM (VALUES
    ('draft','content_reviewed'), ('draft','killed'),
    ('content_reviewed','fairness_reviewed'), ('content_reviewed','draft'),
    ('fairness_reviewed','piloting'), ('fairness_reviewed','draft'),
    ('piloting','calibrated'), ('piloting','killed'),
    -- New pair. Withdrawal from a pilot, and return to it once the reason is
    -- resolved. `suspended -> piloting` matters as much as the other
    -- direction: without it a paused pilot could only resume by claiming to be
    -- calibrated, which it is not.
    ('piloting','suspended'), ('suspended','piloting'),
    ('calibrated','operational'), ('calibrated','suspended'),
    ('operational','suspended'), ('operational','retired'),
    ('suspended','operational'), ('suspended','retired'), ('suspended','calibrated')
  ) AS v(f, t);
$$;

-- ---------------------------------------------------------------------------
-- 2. Recording a rejection withdraws the item.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.item_review_rejection_suspends()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY DEFINER to match the other guards on this table: the UPDATE has to
-- land regardless of which role recorded the review.
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.decision <> 'rejected' THEN
    RETURN NEW;
  END IF;

  -- Only from a state that is actually being served. A rejection against a
  -- draft, or against an item already withdrawn, changes nothing.
  UPDATE items
     SET lifecycle_state = 'suspended'
   WHERE id = NEW.item_id
     AND lifecycle_state IN ('piloting', 'calibrated', 'operational');

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.item_review_rejection_suspends() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS item_reviews_rejection_suspends_trg ON item_reviews;
CREATE TRIGGER item_reviews_rejection_suspends_trg
  AFTER INSERT ON item_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.item_review_rejection_suspends();

COMMENT ON FUNCTION public.item_review_rejection_suspends() IS
  'Withdraws an item from service when a rejection is recorded against it. Suspension is reversible: record a fresh approval, then move the item back to piloting or operational.';
