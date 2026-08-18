-- A saved answer must be ack-able forever: the batch-save RPC learns to
-- acknowledge idempotent replays, and to name what is permanently lost.
--
-- THE BUG THIS FIXES (found by the first real pilot sitting, 2026-08-18)
-- ----------------------------------------------------------------------
-- The client's save queue is IndexedDB-backed: an entry stays pending until
-- the server echoes its item_id back, and the flusher retries pending
-- entries forever. That is the right design — an answer must never be lost
-- to a flaky network.
--
-- But the RPC refused work by silently CONTINUE-ing, and a refused item was
-- absent from the returned ids. Three refusal paths bit in practice:
--
--   1. The pagehide/visibilitychange handler flushes via sendBeacon, whose
--      response is unreadable BY DESIGN. The row saved server-side but
--      stayed pending in IDB. Every later retry hit the no-back-nav guard
--      ("a response already exists") and was refused — so the entry could
--      never be acknowledged again. One tab-switch = a permanently wedged
--      queue.
--   2. Once a section's deadline + grace passed, every retry of an
--      already-saved row was refused by the deadline guard. Same wedge.
--   3. The section-boundary flush waits for the queue to drain before it
--      lets the participant move on. A wedged queue = "Saving your
--      responses..." forever, on a session whose every answer was already
--      persisted. The pilot participant sat through exactly that.
--
-- THE PRINCIPLE
-- -------------
-- The ack answers "is a response for this (session, item) durably stored?",
-- not "did this particular write mutate the table?". A replay of an answer
-- that is already stored is a success, not a violation:
--
--   - no-back-nav refusals: the stored answer stands (first answer wins;
--     that is what the policy means), so the entry is acked.
--   - finalised/expired sections: if a row exists, it is stored — acked.
--     If no row exists, the answer arrived too late and is genuinely lost;
--     it can NEVER be saved, so retrying is pointless. It is returned in a
--     new `terminal` list so the client can stop retrying and say so,
--     instead of hanging the participant at the boundary forever.
--   - an item that is not part of the assessment, or a NaN/out-of-range
--     value: terminal. No amount of retrying fixes a client bug.
--   - the practice-completeness gate stays a plain refusal (absent from
--     both lists): it is the one genuinely TRANSIENT case, resolved as soon
--     as the practice saves land, and the client's retry loop is exactly
--     right for it. The gate now also recomputes after each practice-row
--     insert, so a batch carrying practice and scored rows together drains
--     in one pass instead of two.
--
-- RETURN SHAPE — and the deploy-order constraint it creates
-- ---------------------------------------------------------
-- Old: jsonb array of saved item ids (or -1 for an ownership failure).
-- New: {"acked": [...], "terminal": [...]}  (ownership failure still -1).
--
-- The API route is written to accept BOTH shapes, so it must deploy BEFORE
-- this migration is applied to a live project: new code + old RPC works,
-- old code + new RPC would 500 on every batch. This is the one migration in
-- the cognitive series that is applied to live AFTER the code deploy, not
-- before, and this header is the warning.

CREATE OR REPLACE FUNCTION public.save_responses_batch_for_session(
  p_access_token text,
  p_session_id uuid,
  p_saves jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_acked_ids uuid[] := '{}';
  v_terminal_ids uuid[] := '{}';
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

    -- Not part of this assessment: no retry can ever change that.
    IF v_section_id IS NULL THEN
      v_terminal_ids := array_append(v_terminal_ids, v_item_id);
      CONTINUE;
    END IF;

    -- The one transient refusal: scored rows wait for practice. Absent from
    -- both lists on purpose — the client's retry IS the resolution.
    IF v_section_role = 'scored' AND v_practice_incomplete THEN
      CONTINUE;
    END IF;

    SELECT st.deadline_at, st.grace_seconds, st.finalised_at
      INTO v_deadline, v_grace, v_finalised
    FROM participant_section_states st
    WHERE st.session_id = p_session_id AND st.section_id = v_section_id;

    -- Section over (finalised, or past deadline + grace): if the answer is
    -- already stored it is safe — ack the replay. If it never arrived in
    -- time, it is lost for good — terminal, so the client stops retrying.
    IF v_finalised IS NOT NULL
       OR (v_deadline IS NOT NULL
           AND now() > v_deadline + make_interval(secs => COALESCE(v_grace, 20))) THEN
      SELECT EXISTS (
        SELECT 1 FROM participant_responses pr
        WHERE pr.session_id = p_session_id AND pr.item_id = v_item_id
      ) INTO v_existing;
      IF v_existing THEN
        v_acked_ids := array_append(v_acked_ids, v_item_id);
      ELSE
        v_terminal_ids := array_append(v_terminal_ids, v_item_id);
      END IF;
      CONTINUE;
    END IF;

    -- No-back-nav: the FIRST stored answer stands; a later write must not
    -- replace it. But the replay of an answer that is already stored is a
    -- success — the sendBeacon flush produces exactly that replay, because
    -- its response is unreadable and the row stays pending client-side.
    IF NOT v_allow_back_nav THEN
      SELECT EXISTS (
        SELECT 1 FROM participant_responses pr
        WHERE pr.session_id = p_session_id AND pr.item_id = v_item_id
      ) INTO v_existing;
      IF v_existing THEN
        v_acked_ids := array_append(v_acked_ids, v_item_id);
        CONTINUE;
      END IF;
    END IF;

    v_value := (v_save->>'responseValue')::numeric;
    IF v_value IS NULL OR v_value = 'NaN'::numeric THEN
      v_terminal_ids := array_append(v_terminal_ids, v_item_id);
      CONTINUE;
    END IF;

    SELECT rf.type, COALESCE(rf.config, '{}'::jsonb)
      INTO v_format_type, v_cfg
    FROM items i
    LEFT JOIN response_formats rf ON rf.id = i.response_format_id
    WHERE i.id = v_item_id;

    IF COALESCE(v_format_type, '') <> 'free_text' THEN
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

      -- A value that matches no option and falls outside the format's range
      -- is a client bug; replaying it can never succeed.
      IF NOT v_option_match AND (v_value < v_min OR v_value > v_max) THEN
        v_terminal_ids := array_append(v_terminal_ids, v_item_id);
        CONTINUE;
      END IF;
    END IF;

    INSERT INTO participant_responses (
      session_id, item_id, section_id, response_value,
      response_data, response_time_ms, answered_at
    )
    VALUES (
      p_session_id, v_item_id, v_section_id, v_value,
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

    v_acked_ids := array_append(v_acked_ids, v_item_id);

    -- A practice row just landed: the gate may have opened for scored rows
    -- later in this same batch. Recomputing here lets a mixed batch drain
    -- in one pass instead of needing a second flush.
    IF v_section_role = 'practice' AND v_practice_incomplete THEN
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
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'acked', to_jsonb(v_acked_ids),
    'terminal', to_jsonb(v_terminal_ids)
  );
END;
$function$;
