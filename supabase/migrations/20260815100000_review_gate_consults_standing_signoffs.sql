-- The delivery gate was reading the label, not the ledger.
--
-- 20260815091500 refused to link a cognitive item unless its lifecycle_state
-- was piloting / calibrated / operational. That is necessary but not
-- sufficient, because lifecycle_state is a summary that can go stale:
--
--   1. item_reviews is append-only and a later rejection REVOKES the standing
--      approval (20260814110000's own design note). Nothing moves the item out
--      of piloting when that happens — items_review_signoff_guard only fires on
--      a lifecycle UPDATE, and recording a review is an INSERT on another
--      table. So a reviewer could reject an item that was already piloting and
--      the gate would still let it into an assessment.
--   2. A sign-off is bound to the content it was given for
--      (item_reviews.reviewed_content_hash, stamped on insert). The gate never
--      compared it to the item's current content_hash, so an approval given for
--      different content still counted.
--
-- Both were demonstrated against a throwaway cluster with every migration
-- applied before this was written; (1) is the one that matters, because it
-- means a reviewer's rejection had no effect on what could be served.
--
-- THE FIX IS ONE DEFINITION, NOT TWO. items_review_signoff_guard already knew
-- how to decide this and had the logic inline in its trigger body. Copying that
-- predicate into the gate would have created a second definition free to drift
-- from the first — the exact failure this migration exists to correct, one
-- level up. So the predicate is extracted into item_standing_signoff_blocker()
-- and BOTH callers now ask it.

-- ---------------------------------------------------------------------------
-- The single definition of "does this item have the sign-offs it needs".
-- Returns NULL when it does, or a human-readable reason when it does not.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.item_standing_signoff_blocker(
  p_item_id       uuid,
  p_content_hash  text,
  p_kinds         text[]
)
RETURNS text
LANGUAGE plpgsql
STABLE
-- SECURITY DEFINER so a caller that cannot itself SELECT item_reviews (which
-- grants only service_role) still gets a truthful answer rather than silently
-- seeing no rows and concluding "no review recorded".
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT;
  v_row  RECORD;
BEGIN
  FOREACH v_kind IN ARRAY p_kinds LOOP
    -- The STANDING decision is the most recent row for this (item, kind).
    -- Ordering matches idx_item_reviews_item_kind_recent exactly.
    SELECT r.decision, r.reviewed_content_hash
      INTO v_row
      FROM item_reviews r
     WHERE r.item_id = p_item_id AND r.review_kind = v_kind
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT 1;

    IF NOT FOUND THEN
      RETURN format('no %s review has been recorded', v_kind);
    END IF;

    IF v_row.decision <> 'approved' THEN
      RETURN format('the standing %s review is a rejection', v_kind);
    END IF;

    -- NULL content_hash means a non-cognitive item that never had one; those
    -- would otherwise all collide on this check. Same carve-out as the guard.
    IF p_content_hash IS NOT NULL
       AND v_row.reviewed_content_hash IS DISTINCT FROM p_content_hash THEN
      RETURN format('the standing %s sign-off was given for different content; re-review it', v_kind);
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.item_standing_signoff_blocker(uuid, text, text[])
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.item_standing_signoff_blocker(uuid, text, text[]) IS
  'The single definition of whether an item holds the standing sign-offs named in p_kinds. NULL = clear; otherwise the reason it is not. Consulted by items_review_signoff_guard (on lifecycle transitions) and cognitive_item_review_gate (on assessment placement).';

-- ---------------------------------------------------------------------------
-- The transition guard now asks the shared function. Behaviour is unchanged —
-- same predicate, same messages, same per-state required kinds.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.items_review_signoff_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_needed  TEXT[];
  v_blocker TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.lifecycle_state IS NOT DISTINCT FROM OLD.lifecycle_state THEN
    RETURN NEW;
  END IF;

  IF NEW.lifecycle_state = 'content_reviewed' THEN
    v_needed := ARRAY['content'];
  ELSIF NEW.lifecycle_state IN ('fairness_reviewed', 'piloting', 'calibrated', 'operational') THEN
    v_needed := ARRAY['content', 'fairness'];
  ELSE
    RETURN NEW;  -- draft / suspended / retired / killed need nothing
  END IF;

  v_blocker := item_standing_signoff_blocker(NEW.id, NEW.content_hash, v_needed);
  IF v_blocker IS NOT NULL THEN
    RAISE EXCEPTION 'item % cannot enter % — %', NEW.id, NEW.lifecycle_state, v_blocker;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.items_review_signoff_guard() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The delivery gate now asks the same question, on top of the state check.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cognitive_item_review_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item    RECORD;
  v_blocker TEXT;
BEGIN
  SELECT i.lifecycle_state, i.content_hash
    INTO v_item
    FROM items i
   WHERE i.id = NEW.item_id
     AND EXISTS (SELECT 1 FROM cognitive_item_specs s WHERE s.item_id = i.id);

  -- Not a cognitive item (or no such item — the FK will say so better). This
  -- workflow does not govern it.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_item.lifecycle_state NOT IN ('piloting', 'calibrated', 'operational') THEN
    RAISE EXCEPTION
      'item % is %; a cognitive item cannot be placed in an assessment until it has cleared content and fairness review',
      NEW.item_id, v_item.lifecycle_state
      USING ERRCODE = 'check_violation';
  END IF;

  -- The state says reviewed. Confirm the ledger still agrees.
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

REVOKE EXECUTE ON FUNCTION public.cognitive_item_review_gate() FROM PUBLIC, anon, authenticated;
