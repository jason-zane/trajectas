-- Fix silent data loss in the batched response save path.
--
-- save_responses_batch_for_session validated each item against the session's
-- assessment (via assessment_section_items) and silently CONTINUEd past any
-- item that didn't match — returning only a COUNT of rows upserted. The API
-- route couldn't tell WHICH items were skipped, so the client marked every
-- row in the batch synced=1 in IndexedDB and never retried them: responses
-- were permanently lost whenever an assessment's section/item wiring was
-- inconsistent.
--
-- The fix: return the item_ids actually upserted so the client can mark
-- exactly those synced, leave unmatched rows pending, and surface its
-- persistent-failure banner instead of dropping data.
--
-- Return type changes (integer → jsonb), so DROP + CREATE:
--   * to_jsonb(-1) when the token/session pair fails the ownership check.
--     Same sentinel as before — route code from the previous deploy still
--     maps a numeric -1 to 403 during the deploy window, and on success it
--     falls back to its old mark-everything behaviour (the status quo), so
--     the window is no worse than today.
--   * otherwise a jsonb array of the item_id values actually upserted
--     (unmatched items are excluded — they were NOT saved).

DROP FUNCTION IF EXISTS public.save_responses_batch_for_session(text, uuid, jsonb);

CREATE FUNCTION public.save_responses_batch_for_session(
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
BEGIN
  SELECT ps.campaign_participant_id, ps.assessment_id
    INTO v_participant_id, v_assessment_id
  FROM participant_sessions ps
  JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token
    AND ps.status = 'in_progress';

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
      (v_save->>'responseValue')::numeric,
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
