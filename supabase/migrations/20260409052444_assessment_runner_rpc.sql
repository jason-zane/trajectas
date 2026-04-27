-- Save a participant response with single-roundtrip ownership validation.
-- Used by the assessment runner's optimistic save queue.
CREATE OR REPLACE FUNCTION save_response_for_session(
  p_access_token text,
  p_session_id uuid,
  p_item_id uuid,
  p_section_id uuid,
  p_response_value numeric,
  p_response_data jsonb DEFAULT '{}',
  p_response_time_ms integer DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_valid boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM participant_sessions ps
    JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
    WHERE ps.id = p_session_id
      AND cp.access_token = p_access_token
      AND ps.status = 'in_progress'
  ) INTO v_valid;

  IF NOT v_valid THEN
    RETURN false;
  END IF;

  INSERT INTO participant_responses (session_id, item_id, section_id, response_value, response_data, response_time_ms)
  VALUES (p_session_id, p_item_id, p_section_id, p_response_value, p_response_data, p_response_time_ms)
  ON CONFLICT (session_id, item_id)
  DO UPDATE SET
    response_value = EXCLUDED.response_value,
    response_data = EXCLUDED.response_data,
    response_time_ms = EXCLUDED.response_time_ms;

  RETURN true;
END;
$$;

-- Update session progress with single-roundtrip ownership validation.
-- Used by the debounced progress updater and sendBeacon endpoint.
CREATE OR REPLACE FUNCTION update_session_progress_for_session(
  p_access_token text,
  p_session_id uuid,
  p_current_section_id uuid DEFAULT NULL,
  p_current_item_index integer DEFAULT NULL,
  p_time_remaining jsonb DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_participant_id uuid;
BEGIN
  SELECT cp.id INTO v_participant_id
  FROM participant_sessions ps
  JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token;

  IF v_participant_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE participant_sessions
  SET current_section_id = COALESCE(p_current_section_id, current_section_id),
      current_item_index = COALESCE(p_current_item_index, current_item_index),
      time_remaining_seconds = COALESCE(p_time_remaining, time_remaining_seconds)
  WHERE id = p_session_id
    AND campaign_participant_id = v_participant_id;

  RETURN true;
END;
$$;;
