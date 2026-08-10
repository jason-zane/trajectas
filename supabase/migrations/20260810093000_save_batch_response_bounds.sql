-- Reject out-of-range response values at the save layer.
--
-- The batch save RPC validated item ownership but not the response value: a
-- tampered client could store 999 or -50 for a 1–6 item, and the scorer
-- would silently clamp it into range — masking the tampering and corrupting
-- the score. Values are now validated against the item's actual bounds and
-- rejected before persistence.
--
-- The bounds ladder mirrors deriveItemBounds in src/lib/scoring/ctt-session.ts:
--   1. explicit minValue/maxValue on the response-format config
--   2. min/max of the item's non-excluded option values
--   3. numeric keys of a binary-style config `labels` object (>= 2 distinct)
--   4. trueValue/falseValue on the config
--   5. binary format default 0–1
--   6. Likert default 1–`points` (default 5)
-- A value exactly matching ANY of the item's option values — including
-- excluded ("Don't know") options whose sentinel sits outside the scored
-- scale — is always accepted: excluded options are legitimate participant
-- input, they just don't define the scoring bounds. free_text items skip
-- range validation entirely (response_value is a presence flag; the content
-- lives in response_data).
--
-- Rejected values behave exactly like the assessment-membership skip: the
-- row is not saved and its item_id is absent from the returned array, so the
-- client keeps it pending and surfaces its persistent-failure banner instead
-- of losing data silently.

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
  v_saved_ids uuid[] := '{}';
  v_value numeric;
  v_format_type text;
  v_cfg jsonb;
  v_min numeric;
  v_max numeric;
  v_option_match boolean;
BEGIN
  -- Ownership requires a live (non-deleted) participant and, for campaign
  -- sessions, a live campaign_assessments attachment — removed participants
  -- and removed assessments must not keep writing through this RPC.
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

    SELECT asi.section_id
      INTO v_section_id
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
      response_time_ms
    )
    VALUES (
      p_session_id,
      v_item_id,
      v_section_id,
      v_value,
      COALESCE(v_save->'responseData', '{}'::jsonb),
      NULLIF(v_save->>'responseTimeMs', '')::integer
    )
    ON CONFLICT (session_id, item_id)
    DO UPDATE SET
      section_id = EXCLUDED.section_id,
      response_value = EXCLUDED.response_value,
      response_data = EXCLUDED.response_data,
      response_time_ms = EXCLUDED.response_time_ms;

    v_saved_ids := array_append(v_saved_ids, v_item_id);
  END LOOP;

  RETURN to_jsonb(v_saved_ids);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_responses_batch_for_session(text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_responses_batch_for_session(text, uuid, jsonb)
  TO service_role;
