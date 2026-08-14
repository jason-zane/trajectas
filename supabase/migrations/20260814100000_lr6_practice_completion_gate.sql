-- Practice-completion gate for scored sections (LR-6 / #336).
--
-- Spec: docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
-- 02-platform-architecture.md §5 (practice mode). §5.3 leaves "practice items
-- in the completeness gate" as an open question with two options: required
-- (candidate cannot skip) or optional-with-a-skip-affordance. This issue
-- settles it: REQUIRED. Practice exists to remove format-learning variance
-- from the opening scored items — first exposure to a novel item format
-- (e.g. figural matrices) costs able candidates disproportionately, because
-- the format itself, not the construct, drives the miss on those first
-- items. Making practice skippable reintroduces exactly that variance, and
-- does so DIFFERENTIALLY: the candidates most likely to skip it are the ones
-- already most confident with the format, which means the reintroduced
-- noise would systematically favour the same people the unscored warm-up
-- was added to level the field for.
--
-- This migration is the server-side enforcement of that decision — not the
-- UI hiding a "skip" button, but the RPCs refusing to cooperate regardless
-- of what the client asks for:
--
--   1. start_section_for_session refuses to start (no clock, no
--      participant_section_states row) a 'scored' section while any item in
--      one of this assessment's 'practice'-role sections is unanswered for
--      this session. Returns a distinctly-shaped {blocked:
--      'practice_incomplete'} payload (never NULL, so the caller can tell
--      "blocked by the practice gate" apart from every other failure mode
--      and redirect the participant back to practice instead of silently
--      rendering the section un-timed).
--   2. save_response_for_session / save_responses_batch_for_session get the
--      SAME check. This closes the loophole (1) alone would leave open: if
--      start_section_for_session is never called for a section (a client
--      that talks to the save endpoints directly, or an old page load that
--      raced ahead), a scored item's save must still be refused — the save
--      RPCs are the actual chokepoint for every write path (see the
--      deadline-enforcement precedent in 20260813102000), so this is where
--      the gate has to be authoritative, not just where it's convenient.
--
-- Deliberately scoped to section_role = 'scored', not "anything that isn't
-- practice": the role enum also has 'instructions', and gating those behind
-- practice completion would deadlock an assessment that shows instructions
-- BEFORE its practice section (the natural order). "Cannot skip to the
-- TIMED section" is the actual product requirement, and 'scored' is the only
-- role start_section_for_session ever attaches a deadline to.
--
-- No-op for every existing assessment: the EXISTS check below is vacuously
-- false whenever an assessment has zero 'practice'-role sections (true of
-- every assessment shipped before this issue), so this migration changes
-- behaviour only for assessments that opt in by having a practice section.
--
-- CREATE OR REPLACE, same signatures throughout — REVOKE/GRANT re-stated per
-- AGENTS.md convention, not because the privilege set changed.

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
  v_participant_id      uuid;
  v_assessment_id       uuid;
  v_limit                int;
  v_role                 assessment_section_role;
  v_section_grace        int;
  v_mult                 numeric := 1.0;
  v_accom                uuid;
  v_row                  participant_section_states;
  v_practice_incomplete  boolean;
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
  ELSIF v_role = 'scored' THEN
    -- LR-6 / #336 practice-completion gate — see migration header.
    SELECT EXISTS (
      SELECT 1
      FROM assessment_sections prac_s
      JOIN assessment_section_items prac_asi ON prac_asi.section_id = prac_s.id
      WHERE prac_s.assessment_id = v_assessment_id
        AND prac_s.section_role = 'practice'
        AND NOT EXISTS (
          SELECT 1 FROM participant_responses pr
          WHERE pr.session_id = p_session_id AND pr.item_id = prac_asi.item_id
        )
    ) INTO v_practice_incomplete;

    IF v_practice_incomplete THEN
      RETURN jsonb_build_object('blocked', 'practice_incomplete');
    END IF;
  END IF;

  IF v_limit IS NOT NULL THEN
    SELECT a.id, a.time_multiplier INTO v_accom, v_mult
    FROM participant_accommodations a
    WHERE a.campaign_participant_id = v_participant_id
      AND a.revoked_at IS NULL
      AND a.kind = 'extra_time'
      AND (a.assessment_id IS NULL OR a.assessment_id = v_assessment_id)
    ORDER BY a.assessment_id NULLS LAST, a.time_multiplier DESC
    LIMIT 1;
    v_mult := COALESCE(v_mult, 1.0);
  END IF;

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
-- save_response_for_session — same gate, same rationale (see header point 2)
-- ===========================================================================

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
  v_section_role assessment_section_role;
  v_deadline timestamptz;
  v_grace int;
  v_finalised timestamptz;
  v_existing boolean;
  v_practice_incomplete boolean;
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

  SELECT asi.section_id, s.allow_back_nav, s.section_role
    INTO v_section_id, v_allow_back_nav, v_section_role
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

  -- LR-6 / #336 practice-completion gate — see 20260814090000 migration
  -- header. A client that never called start_section_for_session (or called
  -- it before this migration existed, or is simply bypassing it) must not be
  -- able to answer a scored item ahead of practice either.
  IF v_section_role = 'scored' THEN
    SELECT EXISTS (
      SELECT 1
      FROM assessment_sections prac_s
      JOIN assessment_section_items prac_asi ON prac_asi.section_id = prac_s.id
      WHERE prac_s.assessment_id = v_assessment_id
        AND prac_s.section_role = 'practice'
        AND NOT EXISTS (
          SELECT 1 FROM participant_responses pr
          WHERE pr.session_id = p_session_id AND pr.item_id = prac_asi.item_id
        )
    ) INTO v_practice_incomplete;

    IF v_practice_incomplete THEN
      RETURN false;
    END IF;
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
  v_section_role assessment_section_role;
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
  v_practice_incomplete boolean;
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

  -- LR-6 / #336 practice-completion gate — see 20260814090000 migration
  -- header. Computed once per call (unlike the per-item deadline lookup
  -- below): whether practice is complete does not depend on which item is
  -- being saved, only on the session and assessment, so one query up front
  -- is both cheaper and simpler than re-deriving it per loop iteration.
  SELECT EXISTS (
    SELECT 1
    FROM assessment_sections prac_s
    JOIN assessment_section_items prac_asi ON prac_asi.section_id = prac_s.id
    WHERE prac_s.assessment_id = v_assessment_id
      AND prac_s.section_role = 'practice'
      AND NOT EXISTS (
        SELECT 1 FROM participant_responses pr
        WHERE pr.session_id = p_session_id AND pr.item_id = prac_asi.item_id
      )
  ) INTO v_practice_incomplete;

  FOR v_save IN SELECT * FROM jsonb_array_elements(p_saves)
  LOOP
    v_item_id := (v_save->>'itemId')::uuid;

    SELECT asi.section_id, s.allow_back_nav, s.section_role
      INTO v_section_id, v_allow_back_nav, v_section_role
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

    IF v_section_role = 'scored' AND v_practice_incomplete THEN
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
