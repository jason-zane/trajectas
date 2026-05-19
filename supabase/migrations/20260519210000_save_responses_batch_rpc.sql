-- Batched per-session response save. Replaces N round-trips with one
-- transaction: one ownership check + one item-membership check + N upserts.
-- Used by the assessment runner's IndexedDB-backed flusher (Tier 2).
--
-- Returns -1 if the access token / session don't pair to a valid in_progress
-- session, otherwise the count of rows actually upserted (items whose
-- membership didn't validate are silently skipped — same shape as the
-- single-save RPC's failure mode).

CREATE OR REPLACE FUNCTION public.save_responses_batch_for_session(
  p_access_token text,
  p_session_id uuid,
  p_saves jsonb
) RETURNS integer
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
  v_count integer := 0;
BEGIN
  SELECT ps.campaign_participant_id, ps.assessment_id
    INTO v_participant_id, v_assessment_id
  FROM participant_sessions ps
  JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token
    AND ps.status = 'in_progress';

  IF v_participant_id IS NULL OR v_assessment_id IS NULL THEN
    RETURN -1;
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

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_responses_batch_for_session(text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_responses_batch_for_session(text, uuid, jsonb)
  TO service_role;
