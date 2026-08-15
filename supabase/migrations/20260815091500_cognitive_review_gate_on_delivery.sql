-- An unreviewed cognitive item must not be placed into an assessment.
--
-- 20260814110000 gave items a lifecycle and two sign-off guards, and they work:
-- an item cannot CLAIM to be content- or fairness-reviewed without an
-- append-only record saying who reviewed it. What nothing enforced is the step
-- that actually matters to a respondent — nothing stopped a `draft` item being
-- linked into an assessment section and served. The review workflow governed
-- the label, not the delivery.
--
-- SCOPED TO ITEMS WITH A COGNITIVE SPEC, deliberately. Every item in the
-- library is currently `draft`, including the 400+ Likert items already linked
-- into live assessments: the lifecycle states were introduced for the cognitive
-- bank and only that bank has been through the workflow. A blanket rule would
-- refuse every existing assessment. Same scoping precedent as
-- 20260813101000's key-material triggers.
--
-- Servable states are `piloting`, `calibrated` and `operational` — everything
-- reachable only after BOTH sign-offs. `piloting` is included because piloting
-- is exactly when a reviewed-but-uncalibrated item is supposed to be answered;
-- requiring `operational` would make the first pilot impossible. `suspended`,
-- `retired` and `killed` are excluded: those mean stop serving this.
--
-- A session that has already frozen its form (20260813103000) keeps the items
-- it froze. That is intended — a form must not change under someone mid-test.
-- This guard governs what can enter a form, not what an in-flight session sees.
--
-- TWO KNOWN LIMITS, both verified rather than assumed, both needing
-- service-role write access and neither reachable from the application:
--
--   1. items_lifecycle_guard governs transitions, so an item INSERTed directly
--      at 'piloting' never passes through the sign-off checks and satisfies
--      this gate. The ingest path always writes 'draft'
--      (src/lib/item-bank/store.ts), so nothing in the app takes that route.
--      Closing it means guarding INSERT on `items` too, which would break every
--      fixture that builds a servable item directly.
--
--   2. This fires on the LINK, so linking an item and adding its
--      cognitive_item_specs row afterwards leaves a draft cognitive item in a
--      section. Closing it means a matching trigger on cognitive_item_specs
--      INSERT that refuses when the item is already linked — which is correct,
--      and would require reordering
--      tests/integration/cognitive-session-state-payload.test.ts, which links
--      before it specs. Left out here rather than changed untested: this
--      container has no Supabase stack to run that suite against.
--
-- Both are worth closing deliberately. Neither is a reason to leave the main
-- path — composing an assessment from an existing bank — ungated.

CREATE OR REPLACE FUNCTION cognitive_item_review_gate()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY DEFINER because `cognitive_item_specs` is service-role-only by
-- grant (20260813100500); an invoker-rights trigger could not see it and would
-- silently treat every cognitive item as non-cognitive, i.e. wave it through.
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_state item_lifecycle_state;
BEGIN
  SELECT i.lifecycle_state
    INTO item_state
    FROM items i
   WHERE i.id = NEW.item_id
     AND EXISTS (SELECT 1 FROM cognitive_item_specs s WHERE s.item_id = i.id);

  -- No row: either the item does not exist (the FK will say so more clearly)
  -- or it is not a cognitive item, which this workflow does not govern.
  IF item_state IS NULL THEN
    RETURN NEW;
  END IF;

  IF item_state NOT IN ('piloting', 'calibrated', 'operational') THEN
    RAISE EXCEPTION
      'item % is %; a cognitive item cannot be placed in an assessment until it has cleared content and fairness review',
      NEW.item_id, item_state
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Not an RPC. Nothing should be able to call it directly.
REVOKE EXECUTE ON FUNCTION cognitive_item_review_gate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS assessment_section_items_review_gate ON assessment_section_items;
CREATE TRIGGER assessment_section_items_review_gate
  BEFORE INSERT OR UPDATE OF item_id ON assessment_section_items
  FOR EACH ROW
  EXECUTE FUNCTION cognitive_item_review_gate();

COMMENT ON FUNCTION cognitive_item_review_gate() IS
  'Refuses to place a cognitive item into an assessment section before it has cleared content and fairness review. Scoped to items with a cognitive_item_specs row; non-cognitive items are unaffected.';
