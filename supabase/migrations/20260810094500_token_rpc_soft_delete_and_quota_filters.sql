-- Close the remaining soft-delete gaps the app-level filters can't reach.
--
-- 1. The assessment-runner RPCs (save_response_for_session,
--    update_session_progress_for_session) validate token ownership but not
--    participant deletion or assessment attachment: a participant soft-
--    deleted mid-sitting, or a session whose assessment was removed from the
--    campaign, could keep writing responses/progress through the RPC paths.
--    Both ownership predicates now require a live participant and (for
--    campaign sessions) a live campaign_assessments row.
--    (save_responses_batch_for_session gets the same predicates in its own
--    migration, 20260810093000 — it owns that function definition.)
--
-- 2. The bulk quota-usage functions joined every campaign_assessments row.
--    After the remove-and-readd flow (partial unique indexes), a pair can
--    have BOTH a live and a historical row — the join then double-counts the
--    campaign's participants for that assessment, and removed assessments
--    keep consuming quota. Live rows only now.

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

CREATE OR REPLACE FUNCTION get_client_assessment_quota_usage_bulk(
  p_client_id UUID
)
RETURNS TABLE (assessment_id UUID, quota_used INT) AS $$
  SELECT
    ca.assessment_id,
    COALESCE(COUNT(cp.id)::INT, 0) AS quota_used
  FROM campaign_assessments ca
  JOIN campaigns c ON c.id = ca.campaign_id
  LEFT JOIN campaign_participants cp
    ON cp.campaign_id = c.id
    AND (
      cp.status IN ('invited', 'registered', 'in_progress', 'completed')
      OR (cp.status = 'withdrawn' AND cp.started_at IS NOT NULL)
    )
  WHERE c.client_id = p_client_id
    AND c.deleted_at IS NULL
    AND ca.deleted_at IS NULL
  GROUP BY ca.assessment_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_partner_assessment_quota_usage_bulk(
  p_partner_id UUID
)
RETURNS TABLE (assessment_id UUID, quota_used INT) AS $$
  SELECT
    ca.assessment_id,
    COALESCE(COUNT(cp.id)::INT, 0) AS quota_used
  FROM campaign_assessments ca
  JOIN campaigns c ON c.id = ca.campaign_id
  LEFT JOIN campaign_participants cp
    ON cp.campaign_id = c.id
    AND (
      cp.status IN ('invited', 'registered', 'in_progress', 'completed')
      OR (cp.status = 'withdrawn' AND cp.started_at IS NOT NULL)
    )
  WHERE c.partner_id = p_partner_id
    AND c.deleted_at IS NULL
    AND ca.deleted_at IS NULL
  GROUP BY ca.assessment_id;
$$ LANGUAGE sql STABLE;
