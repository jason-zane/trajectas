-- Item bank admin (LR-8 / #347) — review sign-offs + content-hash uniqueness.
--
-- Two gaps in the LR-1 bank schema (20260813100500) that #347 needs closed:
--
--   1. The lifecycle state machine has `content_reviewed` and
--      `fairness_reviewed` states, and `items_lifecycle_guard()` enforces the
--      legal transition graph — but NOTHING records WHO signed an item off or
--      WHEN. #347 requires the two judgements to be recorded separately (they
--      are different judgements, often made by different people) and requires
--      that an item cannot reach `operational` without both. There is nowhere
--      in the existing schema to put either fact, hence this migration.
--
--   2. Ingest is specified as "idempotent by content hash so re-running cannot
--      duplicate a bank". Application-level dedupe (see
--      src/lib/item-bank/plan.ts) is the first line, but two concurrent
--      ingests of the same bank would both pass their pre-flight check and
--      both insert. A partial unique index makes the invariant the database's,
--      not the application's.
--
-- Timestamped 20260814110000 deliberately: 20260814090000
-- (instrument_stage_run_single_flight) and 20260814100000
-- (lr6_practice_completion_gate) already occupy the two prior slots on this
-- branch, and main previously collided at 090000. Verified end-to-end with
-- `scripts/pg-migrate-check.sh --fresh` (Docker is unavailable in the
-- environment this was written in; see scripts/README-pg-migrate-check.md).

-- ===========================================================================
-- item_reviews — the sign-off ledger
-- ===========================================================================
-- Append-only. The STANDING decision for a (item, kind) pair is its most
-- recent row; a rejection after an approval revokes the approval, and a fresh
-- approval after a content edit re-establishes it. Keeping the history rather
-- than a pair of columns on `items` is what makes "who signed this off, and
-- what exactly did they see" answerable months later, which is the whole point
-- of a review record in a psychometric audit trail.
--
-- `reviewed_content_hash` is stamped by trigger from the item's own
-- content_hash at insert time — never supplied by the caller. It is what makes
-- a sign-off specific to the content that was actually reviewed: edit the item
-- and its standing approvals stop matching, so the lifecycle guard below
-- refuses promotion until it is re-reviewed. (Cognitive items are frozen once
-- `calibrated`/`operational` by items_lifecycle_guard, so in practice this
-- catches edits during the draft -> fairness_reviewed window, which is exactly
-- the window where review happens.)

CREATE TABLE item_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id               UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  review_kind           TEXT NOT NULL CHECK (review_kind IN ('content', 'fairness')),
  decision              TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  -- The actor. NOT NULL and ON DELETE RESTRICT: an unattributable sign-off is
  -- worse than no sign-off, and deleting a reviewer must not silently convert
  -- their approvals into anonymous ones.
  reviewer_profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  -- Stamped by trg_item_reviews_stamp_content_hash; see above.
  reviewed_content_hash TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Standing-decision lookup: newest row per (item, kind).
CREATE INDEX idx_item_reviews_item_kind_recent
  ON item_reviews (item_id, review_kind, created_at DESC, id DESC);
CREATE INDEX idx_item_reviews_reviewer ON item_reviews (reviewer_profile_id);

-- ---------------------------------------------------------------------------
-- Stamp the reviewed content hash from the item itself.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.item_reviews_stamp_content_hash()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT i.content_hash INTO NEW.reviewed_content_hash
  FROM items i WHERE i.id = NEW.item_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_item_reviews_stamp_content_hash
  BEFORE INSERT ON item_reviews
  FOR EACH ROW EXECUTE FUNCTION public.item_reviews_stamp_content_hash();

-- ---------------------------------------------------------------------------
-- Append-only. Same shape as 20260611180315_append_only_audit_tables.sql,
-- including its pg_trigger_depth() carve-out so the ON DELETE CASCADE from
-- `items` still works (RI actions fire at depth > 1).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.item_reviews_prevent_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION
    'item_reviews is append-only: a sign-off cannot be % (record a new review instead)',
    lower(TG_OP);
END; $$;

CREATE TRIGGER item_reviews_prevent_mutation_trg
  BEFORE UPDATE OR DELETE ON item_reviews
  FOR EACH ROW EXECUTE FUNCTION public.item_reviews_prevent_mutation();

-- ---------------------------------------------------------------------------
-- RLS + grants: service-role only, matching every other bank table
-- (20260813100500 note 4). The admin review UI reaches this exclusively
-- through admin-scoped Server Actions, never with an RLS-scoped client.
-- ---------------------------------------------------------------------------
ALTER TABLE item_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access" ON item_reviews
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE item_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE item_reviews TO service_role;

-- ===========================================================================
-- The lifecycle transition graph, as data
-- ===========================================================================
-- 20260813100500's items_lifecycle_guard() hardcodes the legal (from, to)
-- pairs inside an IN-list. That was fine while nothing but the trigger needed
-- them; #347's review UI needs to know which transitions to OFFER, and the one
-- thing it must not do is keep a second copy of the graph in TypeScript —
-- a UI copy that drifts from the trigger is exactly how you end up with
-- buttons that always fail, or worse, a UI that quietly stops offering a
-- transition the database still permits.
--
-- So the graph moves into a function both callers share. This is a faithful
-- extraction: the pairs below are byte-for-byte the ones from
-- items_lifecycle_guard()'s original IN-list, and the guard is re-created to
-- consult it. No transition is added, removed or reordered. (Verified by
-- scripts/cognitive/ingest-roundtrip.ts, which exercises both a legal and an
-- illegal transition against a real cluster.)
--
-- Deliberately NOT a table: the graph is a design invariant of the state
-- machine, not configuration. A table invites someone to INSERT a row at 2am
-- and quietly legalise draft -> operational; a function makes changing it a
-- migration, which is a reviewed act.
--
-- Left callable by anon/authenticated (default function grants): it is a
-- static list of enum pairs with no data in it, and items_lifecycle_guard()
-- is NOT security-definer, so it must remain executable by whoever is doing
-- the UPDATE.

CREATE OR REPLACE FUNCTION public.item_lifecycle_legal_transitions()
RETURNS TABLE (from_state item_lifecycle_state, to_state item_lifecycle_state)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT v.f::item_lifecycle_state, v.t::item_lifecycle_state
  FROM (VALUES
    ('draft','content_reviewed'), ('draft','killed'),
    ('content_reviewed','fairness_reviewed'), ('content_reviewed','draft'),
    ('fairness_reviewed','piloting'), ('fairness_reviewed','draft'),
    ('piloting','calibrated'), ('piloting','killed'),
    ('calibrated','operational'), ('calibrated','suspended'),
    ('operational','suspended'), ('operational','retired'),
    ('suspended','operational'), ('suspended','retired'), ('suspended','calibrated')
  ) AS v(f, t);
$$;

COMMENT ON FUNCTION public.item_lifecycle_legal_transitions() IS
  'The item lifecycle state machine. Single source of truth: items_lifecycle_guard() enforces it and the admin review UI reads it to decide which transitions to offer.';

CREATE OR REPLACE FUNCTION public.items_lifecycle_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_legal boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.lifecycle_state <> OLD.lifecycle_state THEN
    SELECT EXISTS (
      SELECT 1 FROM public.item_lifecycle_legal_transitions() t
       WHERE t.from_state = OLD.lifecycle_state AND t.to_state = NEW.lifecycle_state
    ) INTO v_legal;
    IF NOT v_legal THEN
      RAISE EXCEPTION 'illegal item lifecycle transition % -> %',
        OLD.lifecycle_state, NEW.lifecycle_state;
    END IF;
  END IF;

  -- Unchanged from 20260813100500: operational/calibrated/retired items are
  -- frozen content; edits must clone.
  IF TG_OP = 'UPDATE'
     AND OLD.lifecycle_state IN ('calibrated','operational','retired')
     AND (NEW.stem IS DISTINCT FROM OLD.stem
          OR NEW.construct_id IS DISTINCT FROM OLD.construct_id
          OR NEW.reverse_scored IS DISTINCT FROM OLD.reverse_scored
          OR NEW.content_hash IS DISTINCT FROM OLD.content_hash) THEN
    RAISE EXCEPTION
      'item % is % — content is frozen; clone it (parent_item_id, item_version+1) instead',
      OLD.id, OLD.lifecycle_state;
  END IF;

  IF NEW.lifecycle_state = 'operational' AND NEW.status <> 'active' THEN
    RAISE EXCEPTION 'operational items must have status = active';
  END IF;
  IF NEW.lifecycle_state = 'retired' AND NEW.status <> 'archived' THEN
    RAISE EXCEPTION 'retired items must have status = archived';
  END IF;

  RETURN NEW;
END; $$;

-- ===========================================================================
-- Lifecycle guard: no promotion without the sign-offs it implies
-- ===========================================================================
-- This does NOT duplicate items_lifecycle_guard()'s transition graph — that
-- function still owns which transitions are legal at all. This one adds the
-- orthogonal precondition: reaching a reviewed state requires the review to
-- have actually happened.
--
--   -> content_reviewed                                  needs content
--   -> fairness_reviewed | piloting | calibrated
--      | operational                                     needs content + fairness
--
-- The later states are listed explicitly rather than relying on "you can only
-- get there via fairness_reviewed": `suspended -> operational` and
-- `suspended -> calibrated` are legal transitions, and an item whose approval
-- was revoked while suspended must not walk straight back into service.
--
-- Deliberately applies to ALL items, not just cognitive ones. Nothing today
-- moves a Likert item off `draft`, so this is inert for them; if something
-- ever does, requiring a recorded sign-off is the behaviour we want anyway.
--
-- SECURITY DEFINER because it reads item_reviews, which is service-role only:
-- a platform_admin updating `items` through the RLS-scoped client would
-- otherwise trip "permission denied for table item_reviews" instead of the
-- intended check. EXECUTE is revoked below so it cannot be reached as an RPC.

CREATE OR REPLACE FUNCTION public.items_review_signoff_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kind    TEXT;
  v_needed  TEXT[];
  v_row     RECORD;
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

  FOREACH v_kind IN ARRAY v_needed LOOP
    SELECT r.decision, r.reviewed_content_hash
      INTO v_row
      FROM item_reviews r
     WHERE r.item_id = NEW.id AND r.review_kind = v_kind
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'item % cannot enter % — no % review has been recorded',
        NEW.id, NEW.lifecycle_state, v_kind;
    END IF;

    IF v_row.decision <> 'approved' THEN
      RAISE EXCEPTION
        'item % cannot enter % — the standing % review is a rejection',
        NEW.id, NEW.lifecycle_state, v_kind;
    END IF;

    IF NEW.content_hash IS NOT NULL
       AND v_row.reviewed_content_hash IS DISTINCT FROM NEW.content_hash THEN
      RAISE EXCEPTION
        'item % cannot enter % — the standing % sign-off was given for different content; re-review it',
        NEW.id, NEW.lifecycle_state, v_kind;
    END IF;
  END LOOP;

  RETURN NEW;
END; $$;

CREATE TRIGGER items_review_signoff_guard_trg
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION public.items_review_signoff_guard();

-- Trigger functions are permission-checked at CREATE TRIGGER time, not at fire
-- time, so shutting the RPC door costs nothing. Same rationale as
-- 20260512150000_trajectory_revoke_trigger_fn_exec.sql (Supabase advisor
-- lint 0028/0029).
REVOKE EXECUTE ON FUNCTION public.items_review_signoff_guard()
  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.item_reviews_stamp_content_hash()
  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.item_reviews_prevent_mutation()
  FROM anon, authenticated, public;

-- ===========================================================================
-- Content-hash uniqueness — the database half of ingest idempotency
-- ===========================================================================
-- One LIVE item per content hash. Partial (deleted_at IS NULL) following
-- 20260810092000's precedent, so a soft-deleted item does not permanently
-- burn its hash; and partial on content_hash IS NOT NULL because every
-- non-cognitive item in the bank has a NULL hash and would otherwise collide
-- with every other one.
--
-- Note this is NOT in tension with the clone-on-edit rule in
-- items_lifecycle_guard(): a clone exists precisely because its content
-- differs, so it hashes differently. Two live rows with the same hash are, by
-- definition, the duplicate that G-13 and the ingest both exist to prevent.
CREATE UNIQUE INDEX items_live_content_hash_unique
  ON items (content_hash)
  WHERE content_hash IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE item_reviews IS
  'Append-only sign-off ledger for the item lifecycle. Content and fairness are separate judgements; the newest row per (item_id, review_kind) is the standing decision. items_review_signoff_guard() blocks promotion without both.';
