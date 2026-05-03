-- Harden assessment-runner RPCs used by server-side save/progress actions.
-- These functions are SECURITY DEFINER, so keep them out of direct anon/auth
-- execution and validate item/section membership inside the function body.

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
BEGIN
  SELECT ps.campaign_participant_id, ps.assessment_id
    INTO v_participant_id, v_assessment_id
  FROM participant_sessions ps
  JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token
    AND ps.status = 'in_progress';

  IF v_participant_id IS NULL OR v_assessment_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT asi.section_id
    INTO v_section_id
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
    p_item_id,
    v_section_id,
    p_response_value,
    COALESCE(p_response_data, '{}'::jsonb),
    p_response_time_ms
  )
  ON CONFLICT (session_id, item_id)
  DO UPDATE SET
    section_id = EXCLUDED.section_id,
    response_value = EXCLUDED.response_value,
    response_data = EXCLUDED.response_data,
    response_time_ms = EXCLUDED.response_time_ms;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_session_progress_for_session(
  p_access_token text,
  p_session_id uuid,
  p_current_section_id uuid DEFAULT NULL,
  p_current_item_index integer DEFAULT NULL,
  p_time_remaining jsonb DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant_id uuid;
  v_assessment_id uuid;
  v_section_valid boolean;
BEGIN
  SELECT ps.campaign_participant_id, ps.assessment_id
    INTO v_participant_id, v_assessment_id
  FROM participant_sessions ps
  JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token
    AND ps.status = 'in_progress';

  IF v_participant_id IS NULL OR v_assessment_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_current_section_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM assessment_sections s
      WHERE s.id = p_current_section_id
        AND s.assessment_id = v_assessment_id
    ) INTO v_section_valid;

    IF NOT v_section_valid THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE participant_sessions
  SET current_section_id = COALESCE(p_current_section_id, current_section_id),
      current_item_index = COALESCE(p_current_item_index, current_item_index),
      time_remaining_seconds = COALESCE(p_time_remaining, time_remaining_seconds)
  WHERE id = p_session_id
    AND campaign_participant_id = v_participant_id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_response_for_session(
  text,
  uuid,
  uuid,
  uuid,
  numeric,
  jsonb,
  integer
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_session_progress_for_session(
  text,
  uuid,
  uuid,
  integer,
  jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_response_for_session(
  text,
  uuid,
  uuid,
  uuid,
  numeric,
  jsonb,
  integer
) TO service_role;

GRANT EXECUTE ON FUNCTION public.update_session_progress_for_session(
  text,
  uuid,
  uuid,
  integer,
  jsonb
) TO service_role;
