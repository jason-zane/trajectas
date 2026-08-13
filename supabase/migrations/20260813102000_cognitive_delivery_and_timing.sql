-- Server-authoritative section timing (LR-2 / #332).
--
-- Spec: docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
-- 02-platform-architecture.md §1.3 (delivery/timing data model), §3
-- (server-authoritative timing), §9 (sequencing — this is migration 4 of 5;
-- migrations 1-3 shipped in LR-1 / #331).
--
-- Deviations from the doc, found while implementing against the LIVE schema
-- (not the doc's "verified against eb890c7" snapshot, which has drifted):
--
--   1. allow_back_nav DRIFT. The doc's audit (§0) says allow_back_nav
--      "exists on assessment_sections (00009) but is never selected into
--      SectionForRunner." That is stale: 20260521080000_drop_dead_section_
--      columns.sql actually DROPPED the column outright as dead (the old
--      builder UI never wrote a non-default value and the runner never read
--      it). This migration re-adds it — this time actually enforced, both in
--      the runner DTO and server-side in the two save RPCs below (issue
--      scope item 5: "not just in the UI"). Default true preserves today's
--      behaviour for every existing section.
--
--   2. Ownership predicate. The doc's §3.1 draft of start_section_for_session
--      copies the OLDER ownership check from 20260424143500 (access-token +
--      deleted-participant + in_progress only). The save RPCs being patched
--      here were hardened further by 20260810094500 / 20260810093000 (a live
--      campaign_assessments attachment is also required for campaign
--      sessions). Both new RPCs below, and the CREATE OR REPLACE of the two
--      save RPCs, use the CURRENT (more hardened) predicate throughout —
--      copying the doc's older draft would silently regress already-shipped
--      hardening.
--
--   3. §1.2.4 (cognitive item specs / distractorPlan) is out of scope here —
--      that landed in LR-1's 20260813100500_cognitive_item_bank.sql. This
--      migration only touches §1.3 (delivery/timing).
--
-- Deadline / grace semantics (issue scope item 2):
--   deadline_at = started_at + ceil(section.time_limit_seconds * multiplier)
--   multiplier  = the participant's active 'extra_time' accommodation for
--                 this assessment (or every assessment, when
--                 accommodation.assessment_id IS NULL), 1.25 or 1.50, else 1.0
--   grace       = assessment_sections.grace_seconds (0-120, default 20) —
--                 the save RPCs accept writes up to deadline_at + grace, but
--                 the DISPLAYED countdown (deadline_at itself) never reflects
--                 the grace window. 20s covers one full offline-queue retry
--                 backoff cycle (src/components/assess/use-save-queue.ts) —
--                 rejecting a save that left the client in time but arrived
--                 late over a poor connection would punish network quality,
--                 which is exactly the construct-irrelevant variance this
--                 whole feature exists to exclude.
--   practice    = never timed, regardless of time_limit_seconds.

-- ===========================================================================
-- §1.3.2 — assessment_sections additive columns
-- ===========================================================================

ALTER TABLE assessment_sections
  ADD COLUMN section_role   assessment_section_role NOT NULL DEFAULT 'scored',
  ADD COLUMN grace_seconds  INT NOT NULL DEFAULT 20,
  ADD COLUMN allow_back_nav BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE assessment_sections
  ADD CONSTRAINT assessment_sections_grace_seconds_range
    CHECK (grace_seconds BETWEEN 0 AND 120);

COMMENT ON COLUMN assessment_sections.allow_back_nav IS
  'Re-added by 20260813102000 — was dropped by 20260521080000 as dead (the
   builder UI never wrote a non-default value and the runner never read it).
   Now enforced both client-side (the Back control is hidden) and
   server-side: save_response_for_session / save_responses_batch_for_session
   refuse to overwrite an item that already has a saved response in a
   section with allow_back_nav = false. Default true is a no-op for every
   existing section.';

COMMENT ON COLUMN assessment_sections.grace_seconds IS
  'Window past deadline_at (participant_section_states) inside which a save
   is still accepted, to absorb offline-queue retry latency. Does NOT extend
   the countdown shown to the participant — see 20260813102000 header note.';

-- ===========================================================================
-- §1.3.2 — server-authoritative section timing state
-- ===========================================================================

CREATE TABLE participant_section_states (
  session_id          UUID NOT NULL REFERENCES participant_sessions(id) ON DELETE CASCADE,
  section_id          UUID NOT NULL REFERENCES assessment_sections(id) ON DELETE RESTRICT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  base_limit_seconds  INT,                     -- NULL = untimed section
  time_multiplier     NUMERIC NOT NULL DEFAULT 1.0,
  accommodation_id    UUID,                    -- FK added below (participant_accommodations, created after)
  deadline_at         TIMESTAMPTZ,             -- NULL when untimed
  grace_seconds       INT NOT NULL DEFAULT 20,
  expired_at          TIMESTAMPTZ,
  finalised_at        TIMESTAMPTZ,
  finalised_by        TEXT,
  PRIMARY KEY (session_id, section_id)
);

ALTER TABLE participant_section_states
  ADD CONSTRAINT participant_section_states_multiplier_range
    CHECK (time_multiplier BETWEEN 1.0 AND 3.0),
  ADD CONSTRAINT participant_section_states_finalised_by_check
    CHECK (finalised_by IN ('participant', 'client_timer', 'sweep'));

COMMENT ON TABLE participant_section_states IS
  'One row per (session, section) once the participant is first delivered
   that section — the server-stamped clock start. Written once by
   start_section_for_session (ON CONFLICT DO NOTHING), so a refresh or a
   second tab always resumes the SAME started_at/deadline_at; no client
   action can restart or extend it. finalised_at is set by
   finalise_section_for_session (participant completes normally, or the
   client-side timer confirms the server deadline has passed) or by the
   assessment-timing-sweep cron for abandoned sections.';

CREATE INDEX idx_section_states_open_deadlines
  ON participant_section_states (deadline_at)
  WHERE finalised_at IS NULL AND deadline_at IS NOT NULL;

CREATE TABLE participant_accommodations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_participant_id UUID NOT NULL REFERENCES campaign_participants(id) ON DELETE CASCADE,
  assessment_id           UUID REFERENCES assessments(id) ON DELETE CASCADE,  -- NULL = every assessment
  kind                    TEXT NOT NULL DEFAULT 'extra_time',
  time_multiplier         NUMERIC NOT NULL,
  reason_category         TEXT NOT NULL,
  notes                   TEXT,
  approved_by             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE participant_accommodations
  ADD CONSTRAINT participant_accommodations_kind_check
    CHECK (kind IN ('extra_time')),
  -- Accommodation presets per the issue scope: +25% / +50% only. Anything
  -- else is a policy decision (a new preset), not a per-participant value —
  -- keeping it a closed set stops "just this once" ad-hoc multipliers.
  ADD CONSTRAINT participant_accommodations_multiplier_check
    CHECK (time_multiplier IN (1.25, 1.50)),
  ADD CONSTRAINT participant_accommodations_reason_check
    CHECK (reason_category IN ('disability', 'temporary_impairment', 'language', 'other'));

-- At most one ACTIVE (non-revoked) accommodation per (participant,
-- assessment) — and per (participant, "every assessment") using the nil-uuid
-- sentinel for the NULL case, since a partial unique index can't express
-- NULLS NOT DISTINCT pre-PG15-only-partially / to keep this portable.
CREATE UNIQUE INDEX participant_accommodations_active_unique
  ON participant_accommodations (
    campaign_participant_id,
    COALESCE(assessment_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE revoked_at IS NULL;

COMMENT ON TABLE participant_accommodations IS
  'Extra-time accommodations, applied by start_section_for_session as a
   multiplier on the section limit. Never visible to hiring reviewers — see
   the RLS/grants below; excluded from report_snapshots.rendered_data by
   construction (nothing in src/lib/reports reads this table).';

ALTER TABLE participant_section_states
  ADD CONSTRAINT participant_section_states_accommodation_fk
  FOREIGN KEY (accommodation_id) REFERENCES participant_accommodations(id) ON DELETE SET NULL;

-- RLS: deny-all for anon/authenticated (matches the item_answer_keys /
-- cognitive_item_specs precedent from 20260813100500 — explicit
-- service_role policy, not bare RLS-enabled-with-zero-policies, to avoid
-- retripping the rls_enabled_no_policy advisor finding already resolved
-- once in 20260508214400).
ALTER TABLE participant_section_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_accommodations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access" ON participant_section_states
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access" ON participant_accommodations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE participant_section_states FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE participant_accommodations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE participant_section_states TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE participant_accommodations TO service_role;

-- ===========================================================================
-- §1.3.3 — server answer timestamps
-- ===========================================================================

ALTER TABLE participant_responses
  ADD COLUMN answered_at       TIMESTAMPTZ,   -- server receipt; stamped/refreshed on every write below
  ADD COLUMN client_latency_ms INT;           -- reserved: server-derived per-item latency (not yet populated — see note)

COMMENT ON COLUMN participant_responses.answered_at IS
  'Server receipt time, set on INSERT and refreshed on every UPDATE by
   save_response_for_session / save_responses_batch_for_session. Unlike
   created_at (first-write only), this reflects the most recent answer to
   this item — the trustworthy timing signal for scoring/audit.';

COMMENT ON COLUMN participant_responses.client_latency_ms IS
  'Reserved for server-derived per-item latency once the runner captures a
   per-item "shown at" timestamp (doc 02-platform-architecture.md §2.5,
   latency capture — out of scope for #332). Currently always NULL;
   response_time_ms remains the client-reported value until that lands.';

-- ===========================================================================
-- §3.1 — where the clock starts
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.start_section_for_session(
  p_access_token text,
  p_session_id   uuid,
  p_section_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant_id uuid;
  v_assessment_id  uuid;
  v_limit          int;
  v_role           assessment_section_role;
  v_section_grace  int;
  v_mult           numeric := 1.0;
  v_accom          uuid;
  v_row            participant_section_states;
BEGIN
  SELECT ps.campaign_participant_id, ps.assessment_id
    INTO v_participant_id, v_assessment_id
  FROM participant_sessions ps
  JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token
    AND cp.deleted_at IS NULL
    AND ps.status = 'in_progress'
    AND (
      ps.campaign_id IS NULL
      OR EXISTS (
        SELECT 1 FROM campaign_assessments ca
        WHERE ca.campaign_id = ps.campaign_id
          AND ca.assessment_id = ps.assessment_id
          AND ca.deleted_at IS NULL
      )
    );

  IF v_participant_id IS NULL OR v_assessment_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.time_limit_seconds, s.section_role, s.grace_seconds
    INTO v_limit, v_role, v_section_grace
  FROM assessment_sections s
  WHERE s.id = p_section_id AND s.assessment_id = v_assessment_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Practice sections are never timed, whatever the column says.
  IF v_role = 'practice' THEN
    v_limit := NULL;
  END IF;

  IF v_limit IS NOT NULL THEN
    SELECT a.id, a.time_multiplier INTO v_accom, v_mult
    FROM participant_accommodations a
    WHERE a.campaign_participant_id = v_participant_id
      AND a.revoked_at IS NULL
      AND a.kind = 'extra_time'
      AND (a.assessment_id IS NULL OR a.assessment_id = v_assessment_id)
    -- An assessment-specific accommodation wins over a blanket one when both
    -- somehow exist (the active-unique index normally prevents that, but
    -- stay deterministic if it's ever relaxed); ties broken by the larger
    -- multiplier.
    ORDER BY a.assessment_id NULLS LAST, a.time_multiplier DESC
    LIMIT 1;
    v_mult := COALESCE(v_mult, 1.0);
  END IF;

  -- The whole "resume, don't restart" guarantee: this INSERT fires once per
  -- (session, section) ever. A refresh, a second tab, or a slow network
  -- retry that calls this again all hit DO NOTHING and fall through to the
  -- SELECT below, returning the ORIGINAL started_at/deadline_at.
  INSERT INTO participant_section_states AS st (
    session_id, section_id, started_at, base_limit_seconds,
    time_multiplier, accommodation_id, deadline_at, grace_seconds
  )
  VALUES (
    p_session_id, p_section_id, now(), v_limit,
    v_mult, v_accom,
    CASE WHEN v_limit IS NULL THEN NULL
         ELSE now() + make_interval(secs => ceil(v_limit * v_mult)) END,
    COALESCE(v_section_grace, 20)
  )
  ON CONFLICT (session_id, section_id) DO NOTHING;

  SELECT * INTO v_row
  FROM participant_section_states
  WHERE session_id = p_session_id AND section_id = p_section_id;

  RETURN jsonb_build_object(
    'startedAt',    v_row.started_at,
    'deadlineAt',   v_row.deadline_at,
    'serverNow',    now(),
    'graceSeconds', v_row.grace_seconds,
    'multiplier',   v_row.time_multiplier,
    'expired',      v_row.deadline_at IS NOT NULL AND now() > v_row.deadline_at,
    'finalised',    v_row.finalised_at IS NOT NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_section_for_session(text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_section_for_session(text, uuid, uuid)
  TO service_role;

-- ===========================================================================
-- §3.3 — expiry, auto-submit, and finalisation
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.finalise_section_for_session(
  p_access_token text,
  p_session_id   uuid,
  p_section_id   uuid,
  p_reason       text            -- 'participant' | 'client_timer'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant_id uuid;
  v_assessment_id  uuid;
  v_row            participant_section_states;
  v_unanswered     int;
BEGIN
  IF p_reason NOT IN ('participant', 'client_timer') THEN
    RETURN NULL;
  END IF;

  SELECT ps.campaign_participant_id, ps.assessment_id
    INTO v_participant_id, v_assessment_id
  FROM participant_sessions ps
  JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token
    AND cp.deleted_at IS NULL
    AND ps.status = 'in_progress'
    AND (
      ps.campaign_id IS NULL
      OR EXISTS (
        SELECT 1 FROM campaign_assessments ca
        WHERE ca.campaign_id = ps.campaign_id
          AND ca.assessment_id = ps.assessment_id
          AND ca.deleted_at IS NULL
      )
    );

  IF v_participant_id IS NULL OR v_assessment_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM participant_section_states
  WHERE session_id = p_session_id AND section_id = p_section_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.finalised_at IS NOT NULL THEN
    -- Idempotent: a duplicate finalise call (e.g. the client-timer path
    -- firing after the participant already clicked Complete) is a success,
    -- not an error.
    v_unanswered := (
      SELECT count(*)::int FROM assessment_section_items asi
      WHERE asi.section_id = p_section_id
        AND NOT EXISTS (
          SELECT 1 FROM participant_responses pr
          WHERE pr.session_id = p_session_id AND pr.item_id = asi.item_id
        )
    );
    RETURN jsonb_build_object(
      'finalised', true, 'finalisedBy', v_row.finalised_by,
      'unansweredCount', v_unanswered
    );
  END IF;

  -- A tampered client cannot end a TIMED section early by claiming
  -- 'client_timer': that reason is honoured only once the server-side
  -- deadline has actually passed. 'participant' (normal Continue/Complete)
  -- is always honoured, timed or not — finishing early is allowed; finishing
  -- "early" via a fake expiry event is not.
  IF p_reason = 'client_timer'
     AND NOT (v_row.deadline_at IS NOT NULL AND now() > v_row.deadline_at) THEN
    RETURN NULL;
  END IF;

  UPDATE participant_section_states
  SET expired_at = CASE WHEN deadline_at IS NOT NULL AND now() > deadline_at
                         THEN COALESCE(expired_at, deadline_at) ELSE expired_at END,
      finalised_at = now(),
      finalised_by = p_reason
  WHERE session_id = p_session_id AND section_id = p_section_id
  RETURNING * INTO v_row;

  v_unanswered := (
    SELECT count(*)::int FROM assessment_section_items asi
    WHERE asi.section_id = p_section_id
      AND NOT EXISTS (
        SELECT 1 FROM participant_responses pr
        WHERE pr.session_id = p_session_id AND pr.item_id = asi.item_id
      )
  );

  RETURN jsonb_build_object(
    'finalised', true, 'finalisedBy', v_row.finalised_by,
    'unansweredCount', v_unanswered
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalise_section_for_session(text, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalise_section_for_session(text, uuid, uuid, text)
  TO service_role;

-- ===========================================================================
-- §3.2 — deadline (+ back-nav) enforcement in the save RPCs
-- ===========================================================================
-- Both re-issued with CREATE OR REPLACE (same signatures, so the existing
-- REVOKE/GRANT set still applies — re-stated below for clarity, per
-- AGENTS.md). Bodies are otherwise IDENTICAL to the current live versions
-- (save_response_for_session from 20260810094500,
-- save_responses_batch_for_session from 20260810093000) plus:
--   (a) the deadline check — reject, don't clamp, same contract as the
--       bounds ladder below: the write silently doesn't happen and the item
--       is absent from what the RPC reports saved, so the client's existing
--       failure-banner path handles it instead of losing the answer.
--   (b) the back-navigation check — a section with allow_back_nav = false
--       refuses to overwrite an item that already has a saved response.
--   (c) answered_at stamped/refreshed on every write (§1.3.3).

CREATE OR REPLACE FUNCTION public.save_response_for_session(
  p_access_token text,
  p_session_id uuid,
  p_item_id uuid,
  p_section_id uuid,
  p_response_value numeric,
  p_response_data jsonb DEFAULT '{}',
  p_response_time_ms integer DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant_id uuid;
  v_assessment_id uuid;
  v_section_id uuid;
  v_allow_back_nav boolean;
  v_deadline timestamptz;
  v_grace int;
  v_finalised timestamptz;
  v_existing boolean;
BEGIN
  SELECT ps.campaign_participant_id, ps.assessment_id
    INTO v_participant_id, v_assessment_id
  FROM participant_sessions ps
  JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token
    AND cp.deleted_at IS NULL
    AND ps.status = 'in_progress'
    AND (
      ps.campaign_id IS NULL
      OR EXISTS (
        SELECT 1 FROM campaign_assessments ca
        WHERE ca.campaign_id = ps.campaign_id
          AND ca.assessment_id = ps.assessment_id
          AND ca.deleted_at IS NULL
      )
    );

  IF v_participant_id IS NULL OR v_assessment_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT asi.section_id, s.allow_back_nav
    INTO v_section_id, v_allow_back_nav
  FROM assessment_section_items asi
  JOIN assessment_sections s ON s.id = asi.section_id
  WHERE s.assessment_id = v_assessment_id
    AND asi.item_id = p_item_id
    AND (p_section_id IS NULL OR asi.section_id = p_section_id)
  ORDER BY s.display_order, asi.display_order
  LIMIT 1;

  IF v_section_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT st.deadline_at, st.grace_seconds, st.finalised_at
    INTO v_deadline, v_grace, v_finalised
  FROM participant_section_states st
  WHERE st.session_id = p_session_id AND st.section_id = v_section_id;

  IF v_finalised IS NOT NULL THEN
    RETURN false;
  END IF;
  IF v_deadline IS NOT NULL
     AND now() > v_deadline + make_interval(secs => COALESCE(v_grace, 20)) THEN
    RETURN false;
  END IF;

  IF NOT v_allow_back_nav THEN
    SELECT EXISTS (
      SELECT 1 FROM participant_responses pr
      WHERE pr.session_id = p_session_id AND pr.item_id = p_item_id
    ) INTO v_existing;
    IF v_existing THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO participant_responses (
    session_id,
    item_id,
    section_id,
    response_value,
    response_data,
    response_time_ms,
    answered_at
  )
  VALUES (
    p_session_id,
    p_item_id,
    v_section_id,
    p_response_value,
    COALESCE(p_response_data, '{}'::jsonb),
    p_response_time_ms,
    now()
  )
  ON CONFLICT (session_id, item_id)
  DO UPDATE SET
    section_id = EXCLUDED.section_id,
    response_value = EXCLUDED.response_value,
    response_data = EXCLUDED.response_data,
    response_time_ms = EXCLUDED.response_time_ms,
    answered_at = now();

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_responses_batch_for_session(
  p_access_token text,
  p_session_id uuid,
  p_saves jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant_id uuid;
  v_assessment_id uuid;
  v_save jsonb;
  v_item_id uuid;
  v_section_id uuid;
  v_allow_back_nav boolean;
  v_deadline timestamptz;
  v_grace int;
  v_finalised timestamptz;
  v_existing boolean;
  v_saved_ids uuid[] := '{}';
  v_value numeric;
  v_format_type text;
  v_cfg jsonb;
  v_min numeric;
  v_max numeric;
  v_option_match boolean;
BEGIN
  SELECT ps.campaign_participant_id, ps.assessment_id
    INTO v_participant_id, v_assessment_id
  FROM participant_sessions ps
  JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token
    AND cp.deleted_at IS NULL
    AND ps.status = 'in_progress'
    AND (
      ps.campaign_id IS NULL
      OR EXISTS (
        SELECT 1 FROM campaign_assessments ca
        WHERE ca.campaign_id = ps.campaign_id
          AND ca.assessment_id = ps.assessment_id
          AND ca.deleted_at IS NULL
      )
    );

  IF v_participant_id IS NULL OR v_assessment_id IS NULL THEN
    RETURN to_jsonb(-1);
  END IF;

  FOR v_save IN SELECT * FROM jsonb_array_elements(p_saves)
  LOOP
    v_item_id := (v_save->>'itemId')::uuid;

    SELECT asi.section_id, s.allow_back_nav
      INTO v_section_id, v_allow_back_nav
    FROM assessment_section_items asi
    JOIN assessment_sections s ON s.id = asi.section_id
    WHERE s.assessment_id = v_assessment_id
      AND asi.item_id = v_item_id
    ORDER BY s.display_order, asi.display_order
    LIMIT 1;

    IF v_section_id IS NULL THEN
      -- Item doesn't belong to this assessment: not saved, and deliberately
      -- absent from the returned array so the caller can see it was skipped.
      CONTINUE;
    END IF;

    -- Server-authoritative deadline. Late writes are REJECTED, not clamped —
    -- same contract as the bounds check below: the row is not saved and its
    -- item_id is absent from the returned array, so the client keeps it
    -- pending and surfaces its persistent-failure banner instead of losing
    -- data silently.
    SELECT st.deadline_at, st.grace_seconds, st.finalised_at
      INTO v_deadline, v_grace, v_finalised
    FROM participant_section_states st
    WHERE st.session_id = p_session_id AND st.section_id = v_section_id;

    IF v_finalised IS NOT NULL THEN
      CONTINUE;
    END IF;
    IF v_deadline IS NOT NULL
       AND now() > v_deadline + make_interval(secs => COALESCE(v_grace, 20)) THEN
      CONTINUE;
    END IF;

    -- Back-navigation enforcement: a section with allow_back_nav = false
    -- locks an item the instant it has a saved response — the first answer
    -- is final. Default true, so this is a no-op for every section that
    -- doesn't opt in (every section today).
    IF NOT v_allow_back_nav THEN
      SELECT EXISTS (
        SELECT 1 FROM participant_responses pr
        WHERE pr.session_id = p_session_id AND pr.item_id = v_item_id
      ) INTO v_existing;
      IF v_existing THEN
        CONTINUE;
      END IF;
    END IF;

    v_value := (v_save->>'responseValue')::numeric;
    IF v_value IS NULL OR v_value = 'NaN'::numeric THEN
      CONTINUE;
    END IF;

    SELECT rf.type, COALESCE(rf.config, '{}'::jsonb)
      INTO v_format_type, v_cfg
    FROM items i
    LEFT JOIN response_formats rf ON rf.id = i.response_format_id
    WHERE i.id = v_item_id;

    IF COALESCE(v_format_type, '') <> 'free_text' THEN
      -- An exact match against ANY of the item's options (excluded ones
      -- included) is always legitimate input.
      SELECT EXISTS (
        SELECT 1 FROM item_options io
        WHERE io.item_id = v_item_id AND io.value = v_value
      ) INTO v_option_match;

      v_min := NULL;
      v_max := NULL;

      IF jsonb_typeof(v_cfg->'minValue') = 'number'
         AND jsonb_typeof(v_cfg->'maxValue') = 'number' THEN
        v_min := (v_cfg->>'minValue')::numeric;
        v_max := (v_cfg->>'maxValue')::numeric;
      END IF;

      IF v_min IS NULL THEN
        SELECT min(io.value), max(io.value)
          INTO v_min, v_max
        FROM item_options io
        WHERE io.item_id = v_item_id
          AND COALESCE(io.exclude_from_scoring, false) = false;
      END IF;

      IF v_min IS NULL AND jsonb_typeof(v_cfg->'labels') = 'object' THEN
        SELECT min(k::numeric), max(k::numeric)
          INTO v_min, v_max
        FROM jsonb_object_keys(v_cfg->'labels') AS k
        WHERE k ~ '^-?[0-9]+(\.[0-9]+)?$';
        -- Mirror the TS ladder: a single distinct label value defines no scale.
        IF v_min IS NOT NULL AND v_min = v_max THEN
          v_min := NULL;
          v_max := NULL;
        END IF;
      END IF;

      IF v_min IS NULL
         AND jsonb_typeof(v_cfg->'trueValue') = 'number'
         AND jsonb_typeof(v_cfg->'falseValue') = 'number'
         AND (v_cfg->>'trueValue')::numeric <> (v_cfg->>'falseValue')::numeric THEN
        v_min := least((v_cfg->>'trueValue')::numeric, (v_cfg->>'falseValue')::numeric);
        v_max := greatest((v_cfg->>'trueValue')::numeric, (v_cfg->>'falseValue')::numeric);
      END IF;

      IF v_min IS NULL THEN
        IF v_format_type = 'binary' THEN
          v_min := 0;
          v_max := 1;
        ELSE
          v_min := 1;
          IF jsonb_typeof(v_cfg->'points') = 'number' THEN
            v_max := (v_cfg->>'points')::numeric;
          ELSE
            v_max := 5;
          END IF;
        END IF;
      END IF;

      IF NOT v_option_match AND (v_value < v_min OR v_value > v_max) THEN
        -- Out of range and not one of the item's options: not saved, absent
        -- from the returned array.
        CONTINUE;
      END IF;
    END IF;

    INSERT INTO participant_responses (
      session_id,
      item_id,
      section_id,
      response_value,
      response_data,
      response_time_ms,
      answered_at
    )
    VALUES (
      p_session_id,
      v_item_id,
      v_section_id,
      v_value,
      COALESCE(v_save->'responseData', '{}'::jsonb),
      NULLIF(v_save->>'responseTimeMs', '')::integer,
      now()
    )
    ON CONFLICT (session_id, item_id)
    DO UPDATE SET
      section_id = EXCLUDED.section_id,
      response_value = EXCLUDED.response_value,
      response_data = EXCLUDED.response_data,
      response_time_ms = EXCLUDED.response_time_ms,
      answered_at = now();

    v_saved_ids := array_append(v_saved_ids, v_item_id);
  END LOOP;

  RETURN to_jsonb(v_saved_ids);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_response_for_session(
  text, uuid, uuid, uuid, numeric, jsonb, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_response_for_session(
  text, uuid, uuid, uuid, numeric, jsonb, integer
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.save_responses_batch_for_session(text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_responses_batch_for_session(text, uuid, jsonb)
  TO service_role;
