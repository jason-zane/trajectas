-- Unified participant write contract. Database first: legacy payloads still
-- work until an item receives its first revision-aware write; later legacy
-- retries acknowledge the durable answer without overwriting the newer one.
ALTER TABLE public.participant_responses
  ADD COLUMN client_revision bigint NOT NULL DEFAULT 0 CHECK (client_revision >= 0),
  ADD COLUMN response_write_key text;
CREATE INDEX participant_section_forms_entries_gin ON public.participant_section_forms
  USING gin (entries jsonb_path_ops);

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
  v_revision bigint;
  v_existing_revision bigint;
  v_write_key text;
  v_has_options boolean;
  v_timed boolean;
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
  IF p_saves IS NULL OR jsonb_typeof(p_saves) <> 'array' OR jsonb_array_length(p_saves) > 50 THEN
    RETURN to_jsonb(-1);
  END IF;
  SELECT ps.campaign_participant_id, ps.assessment_id
    INTO v_participant_id, v_assessment_id
  FROM participant_sessions ps
  JOIN campaign_participants cp ON cp.id = ps.campaign_participant_id
  JOIN campaigns c ON c.id = ps.campaign_id AND c.id = cp.campaign_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token
    AND cp.deleted_at IS NULL
    AND cp.status NOT IN ('withdrawn', 'expired')
    AND c.deleted_at IS NULL AND c.status = 'active'
    AND (c.opens_at IS NULL OR c.opens_at <= now())
    AND (c.closes_at IS NULL OR c.closes_at >= now())
    AND ps.status = 'in_progress'
    AND (
      ps.campaign_id IS NULL
      OR EXISTS (
        SELECT 1 FROM campaign_assessments ca
        WHERE ca.campaign_id = ps.campaign_id
          AND ca.assessment_id = ps.assessment_id
          AND ca.deleted_at IS NULL
      )
    )
  FOR UPDATE OF ps FOR SHARE OF cp, c;

  IF v_participant_id IS NULL OR v_assessment_id IS NULL THEN
    RETURN to_jsonb(-1);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM participant_section_forms pf
    JOIN assessment_sections prac_s ON prac_s.id = pf.section_id
    CROSS JOIN LATERAL jsonb_array_elements(pf.entries) e
    WHERE pf.session_id = p_session_id AND prac_s.section_role = 'practice'
      AND NOT EXISTS (
        SELECT 1 FROM participant_responses pr
        WHERE pr.session_id = p_session_id AND pr.item_id = (e->>'itemId')::uuid
      )
  ) INTO v_practice_incomplete;

  FOR v_save IN SELECT * FROM jsonb_array_elements(p_saves)
  LOOP
    v_item_id := (v_save->>'itemId')::uuid;

    SELECT pf.section_id, s.allow_back_nav, s.section_role,
           s.time_limit_seconds IS NOT NULL AND s.section_role <> 'practice'
      INTO v_section_id, v_allow_back_nav, v_section_role, v_timed
    FROM participant_section_forms pf
    JOIN assessment_sections s ON s.id = pf.section_id
    WHERE pf.session_id = p_session_id
      AND pf.entries @> jsonb_build_array(jsonb_build_object('itemId', v_item_id::text))
    ORDER BY s.display_order
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

    -- A timed section must be opened before any answers can be accepted.
    -- Missing timing state is a refusal, never an unlimited clock.
    IF v_timed AND NOT FOUND THEN
      CONTINUE;
    END IF;

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
      SELECT EXISTS (SELECT 1 FROM item_options WHERE item_id = v_item_id) INTO v_has_options;
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
      IF (v_has_options AND NOT v_option_match)
         OR (NOT v_has_options AND (v_value < v_min OR v_value > v_max OR v_value <> trunc(v_value))) THEN
        v_terminal_ids := array_append(v_terminal_ids, v_item_id);
        CONTINUE;
      END IF;
    END IF;

    v_revision := COALESCE((v_save->>'revision')::bigint, 0);
    v_write_key := v_save->>'idempotencyKey';
    IF v_revision < 0 OR v_revision > 9007199254740991 THEN
      v_terminal_ids := array_append(v_terminal_ids, v_item_id);
      CONTINUE;
    END IF;
    SELECT client_revision INTO v_existing_revision FROM participant_responses
    WHERE session_id = p_session_id AND item_id = v_item_id;
    IF FOUND AND v_existing_revision > 0 AND v_revision <= v_existing_revision THEN
      v_acked_ids := array_append(v_acked_ids, v_item_id);
      CONTINUE;
    END IF;

    INSERT INTO participant_responses (
      session_id, item_id, section_id, response_value,
      response_data, response_time_ms, answered_at, client_revision, response_write_key
    )
    VALUES (
      p_session_id, v_item_id, v_section_id, v_value,
      COALESCE(v_save->'responseData', '{}'::jsonb),
      NULLIF(v_save->>'responseTimeMs', '')::integer,
      now(), v_revision, v_write_key
    )
    ON CONFLICT (session_id, item_id)
    DO UPDATE SET
      section_id = EXCLUDED.section_id,
      response_value = EXCLUDED.response_value,
      response_data = EXCLUDED.response_data,
      response_time_ms = EXCLUDED.response_time_ms,
      answered_at = now(),
      client_revision = EXCLUDED.client_revision,
      response_write_key = EXCLUDED.response_write_key;

    v_acked_ids := array_append(v_acked_ids, v_item_id);

    -- A practice row just landed: the gate may have opened for scored rows
    -- later in this same batch. Recomputing here lets a mixed batch drain
    -- in one pass instead of needing a second flush.
    IF v_section_role = 'practice' AND v_practice_incomplete THEN
      SELECT EXISTS (
    SELECT 1 FROM participant_section_forms pf
    JOIN assessment_sections prac_s ON prac_s.id = pf.section_id
    CROSS JOIN LATERAL jsonb_array_elements(pf.entries) e
    WHERE pf.session_id = p_session_id AND prac_s.section_role = 'practice'
      AND NOT EXISTS (
        SELECT 1 FROM participant_responses pr
        WHERE pr.session_id = p_session_id AND pr.item_id = (e->>'itemId')::uuid
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

CREATE OR REPLACE FUNCTION public.save_response_for_session(
  p_access_token text, p_session_id uuid, p_item_id uuid, p_section_id uuid,
  p_response_value numeric, p_response_data jsonb DEFAULT '{}'::jsonb,
  p_response_time_ms integer DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM participant_section_forms pf WHERE pf.session_id=p_session_id
    AND pf.section_id=p_section_id
    AND pf.entries @> jsonb_build_array(jsonb_build_object('itemId',p_item_id::text))) THEN
    RETURN false;
  END IF;
  result := save_responses_batch_for_session(p_access_token,p_session_id,
    jsonb_build_array(jsonb_build_object('itemId',p_item_id,'responseValue',p_response_value,
      'responseData',p_response_data,'responseTimeMs',p_response_time_ms)));
  -- The legacy boolean API means this requested value is stored. The batch
  -- API may acknowledge a superseded write solely to drain a stale queue.
  RETURN COALESCE(result->'acked' @> to_jsonb(ARRAY[p_item_id]),false)
    AND EXISTS (SELECT 1 FROM participant_responses WHERE session_id=p_session_id AND item_id=p_item_id
      AND response_value=p_response_value
      AND response_data IS NOT DISTINCT FROM COALESCE(p_response_data,'{}'::jsonb));
END $$;
REVOKE EXECUTE ON FUNCTION public.save_responses_batch_for_session(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_responses_batch_for_session(text,uuid,jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.save_response_for_session(text,uuid,uuid,uuid,numeric,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_response_for_session(text,uuid,uuid,uuid,numeric,jsonb,integer) TO service_role;
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
  JOIN campaigns c ON c.id = ps.campaign_id AND c.id = cp.campaign_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token
    AND cp.deleted_at IS NULL AND cp.status NOT IN ('withdrawn','expired')
    AND c.status='active' AND c.deleted_at IS NULL
    AND (c.opens_at IS NULL OR c.opens_at <= now())
    AND (c.closes_at IS NULL OR c.closes_at >= now())
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

  IF NOT EXISTS (SELECT 1 FROM participant_section_forms WHERE session_id=p_session_id AND section_id=p_section_id) THEN
    RETURN NULL;
  END IF;

  -- Practice sections are never timed, whatever the column says.
  IF v_role = 'practice' THEN
    v_limit := NULL;
  ELSIF v_role = 'scored' THEN
    -- LR-6 / #336 practice-completion gate — see migration header.
    SELECT EXISTS (
    SELECT 1 FROM participant_section_forms pf
    JOIN assessment_sections prac_s ON prac_s.id = pf.section_id
    CROSS JOIN LATERAL jsonb_array_elements(pf.entries) e
    WHERE pf.session_id = p_session_id AND prac_s.section_role = 'practice'
      AND NOT EXISTS (
        SELECT 1 FROM participant_responses pr
        WHERE pr.session_id = p_session_id AND pr.item_id = (e->>'itemId')::uuid
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
  JOIN campaigns c ON c.id = ps.campaign_id AND c.id = cp.campaign_id
  WHERE ps.id = p_session_id
    AND cp.access_token = p_access_token
    AND cp.deleted_at IS NULL
    AND cp.status NOT IN ('withdrawn', 'expired')
    AND c.deleted_at IS NULL AND c.status = 'active'
    AND (c.opens_at IS NULL OR c.opens_at <= now())
    AND (c.closes_at IS NULL OR c.closes_at >= now())
    AND ps.status = 'in_progress'
    AND (
      ps.campaign_id IS NULL
      OR EXISTS (
        SELECT 1 FROM campaign_assessments ca
        WHERE ca.campaign_id = ps.campaign_id
          AND ca.assessment_id = ps.assessment_id
          AND ca.deleted_at IS NULL
      )
    )
  FOR UPDATE OF ps FOR SHARE OF cp, c;

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
      SELECT count(*)::int FROM participant_section_forms pf
      CROSS JOIN LATERAL jsonb_array_elements(pf.entries) e
      WHERE pf.session_id=p_session_id AND pf.section_id=p_section_id
        AND NOT EXISTS (
          SELECT 1 FROM participant_responses pr
          WHERE pr.session_id = p_session_id AND pr.item_id = (e->>'itemId')::uuid
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
  -- requires complete answers when early; finishing
  -- "early" via a fake expiry event is not.
  IF p_reason = 'client_timer'
     AND NOT (v_row.deadline_at IS NOT NULL AND now() > v_row.deadline_at) THEN
    RETURN NULL;
  END IF;

  -- Early completion requires every delivered item. Otherwise a caller can
  -- manually finalise an untimed section to bypass mandatory answers.
  IF p_reason='participant' AND (v_row.deadline_at IS NULL OR now() <= v_row.deadline_at)
    AND EXISTS (SELECT 1 FROM participant_section_forms pf
      CROSS JOIN LATERAL jsonb_array_elements(pf.entries) e
      WHERE pf.session_id=p_session_id AND pf.section_id=p_section_id
        AND NOT EXISTS (SELECT 1 FROM participant_responses pr
          WHERE pr.session_id=p_session_id AND pr.item_id=(e->>'itemId')::uuid)) THEN
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
    SELECT count(*)::int FROM participant_section_forms pf
    CROSS JOIN LATERAL jsonb_array_elements(pf.entries) e
    WHERE pf.session_id=p_session_id AND pf.section_id=p_section_id
      AND NOT EXISTS (
        SELECT 1 FROM participant_responses pr
        WHERE pr.session_id = p_session_id AND pr.item_id = (e->>'itemId')::uuid
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


-- Serialize completed-session retries; an expired lease can be reclaimed after
-- a worker disappears. Normal outcomes and failures release it in the action.
ALTER TABLE public.participant_sessions ADD COLUMN processing_claimed_at timestamptz;
CREATE INDEX participant_sessions_interrupted_processing ON public.participant_sessions(completed_at)
WHERE status='completed' AND processing_status IN ('idle','scoring','scored');
CREATE OR REPLACE FUNCTION public.claim_session_processing(p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claimed uuid;
BEGIN
  UPDATE participant_sessions SET processing_claimed_at=clock_timestamp()
  WHERE id=p_session_id AND status='completed'
    AND processing_status NOT IN ('ready','reporting')
    AND (processing_claimed_at IS NULL OR processing_claimed_at < clock_timestamp()-interval '10 minutes')
  RETURNING id INTO claimed;
  RETURN claimed IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_session_processing(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_session_processing(uuid) TO service_role;

-- Once a question has been delivered, its identity names immutable content.
-- Editors create a draft successor; existing assessments remain pinned.
CREATE SCHEMA IF NOT EXISTS private;

-- A form is assembled across several reads. A revision taken before those
-- reads, and checked under this lock at INSERT, detects every intervening
-- authoring change. Freezes take a shared lock, so concurrent participants
-- never queue behind each other; only authoring takes the exclusive lock.
CREATE TABLE private.assessment_authoring_clock (
  assessment_id uuid PRIMARY KEY,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0)
);
REVOKE ALL ON private.assessment_authoring_clock FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.participant_section_forms ADD COLUMN authoring_revision bigint;

CREATE OR REPLACE FUNCTION public.get_delivery_authoring_revision(p_assessment_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT revision FROM private.assessment_authoring_clock WHERE assessment_id=p_assessment_id), 1)
$$;
REVOKE ALL ON FUNCTION public.get_delivery_authoring_revision(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_authoring_revision(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.lock_assessment_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_TABLE_NAME = 'participant_section_forms' THEN
    PERFORM pg_advisory_xact_lock_shared(178438921, 1);
  ELSE
    PERFORM pg_advisory_xact_lock(178438921, 1);
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.lock_assessment_delivery() FROM PUBLIC, anon, authenticated;

-- Revision conflicts are scoped to affected assessments. An unrelated tenant
-- authoring its own content must not make another participant retry assembly.
-- Shared items, response formats and factor links intentionally affect every
-- assessment that references them. The statement lock above makes these
-- dependency lookups and changes atomic with respect to freezing a form.
CREATE OR REPLACE FUNCTION private.bump_assessment_authoring_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prior jsonb := '{}'; following jsonb := '{}'; affected uuid[] := '{}'; aid uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN prior:=to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN following:=to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME='assessments' THEN
    IF TG_OP='DELETE' THEN
      DELETE FROM private.assessment_authoring_clock WHERE assessment_id=OLD.id;
      RETURN NULL;
    END IF;
    affected:=ARRAY[NEW.id];
  ELSIF TG_TABLE_NAME IN ('assessment_sections','assessment_factors','campaign_assessments') THEN
    affected:=ARRAY[(prior->>'assessment_id')::uuid,(following->>'assessment_id')::uuid];
  ELSIF TG_TABLE_NAME='assessment_section_items' THEN
    SELECT array_agg(DISTINCT assessment_id) INTO affected FROM assessment_sections
    WHERE id IN ((prior->>'section_id')::uuid,(following->>'section_id')::uuid);
  ELSIF TG_TABLE_NAME='factor_constructs' THEN
    SELECT array_agg(DISTINCT assessment_id) INTO affected FROM assessment_factors
    WHERE factor_id IN ((prior->>'factor_id')::uuid,(following->>'factor_id')::uuid);
  ELSIF TG_TABLE_NAME='campaign_assessment_factors' THEN
    SELECT array_agg(DISTINCT assessment_id) INTO affected FROM campaign_assessments
    WHERE id IN ((prior->>'campaign_assessment_id')::uuid,(following->>'campaign_assessment_id')::uuid);
  ELSIF TG_TABLE_NAME='response_formats' THEN
    SELECT array_agg(DISTINCT s.assessment_id) INTO affected FROM assessment_sections s
    WHERE s.response_format_id IN ((prior->>'id')::uuid,(following->>'id')::uuid)
      OR EXISTS (SELECT 1 FROM assessment_section_items si JOIN items i ON i.id=si.item_id
        WHERE si.section_id=s.id AND i.response_format_id IN ((prior->>'id')::uuid,(following->>'id')::uuid));
  ELSIF TG_TABLE_NAME='item_selection_rules' THEN
    SELECT array_agg(id) INTO affected FROM assessments;
  ELSE
    IF TG_TABLE_NAME='items' THEN
      prior:=jsonb_build_object('item_id',prior->>'id');
      following:=jsonb_build_object('item_id',following->>'id');
    END IF;
    SELECT array_agg(DISTINCT s.assessment_id) INTO affected
    FROM assessment_section_items si JOIN assessment_sections s ON s.id=si.section_id
    WHERE si.item_id IN ((prior->>'item_id')::uuid,(following->>'item_id')::uuid);
  END IF;
  FOR aid IN SELECT DISTINCT unnest(affected) LOOP
    IF aid IS NOT NULL THEN
      INSERT INTO private.assessment_authoring_clock(assessment_id,revision) VALUES(aid,2)
      ON CONFLICT (assessment_id) DO UPDATE SET revision=private.assessment_authoring_clock.revision+1;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.bump_assessment_authoring_revision() FROM PUBLIC, anon, authenticated;

-- Statement triggers acquire the lock BEFORE any row locks. This ordering
-- also covers multirow edits and child-table changes (options, keys, specs).
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'items','item_options','cognitive_item_specs','cognitive_option_specs','item_answer_keys',
    'response_formats','assessment_sections','assessment_section_items','assessment_factors',
    'factor_constructs','assessments','campaign_assessments','campaign_assessment_factors','item_selection_rules'
  ] LOOP
    EXECUTE format('CREATE TRIGGER assessment_delivery_authoring_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION private.lock_assessment_delivery()', table_name);
    EXECUTE format('CREATE TRIGGER assessment_delivery_authoring_revision AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.bump_assessment_authoring_revision()', table_name);
  END LOOP;
END $$;
CREATE TRIGGER assessment_delivery_freeze_lock BEFORE INSERT ON public.participant_section_forms
FOR EACH STATEMENT EXECUTE FUNCTION private.lock_assessment_delivery();

CREATE OR REPLACE FUNCTION private.validate_form_authoring_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_revision bigint;
BEGIN
  -- A competing freeze already won. ON CONFLICT DO NOTHING preserves it;
  -- the caller reselects that durable form instead of using its own payload.
  IF EXISTS (SELECT 1 FROM participant_section_forms
    WHERE session_id=NEW.session_id AND section_id=NEW.section_id) THEN RETURN NEW; END IF;
  SELECT public.get_delivery_authoring_revision(s.assessment_id) INTO current_revision
  FROM assessment_sections s WHERE s.id=NEW.section_id;
  IF NEW.assembler_version='form-assembler@2' AND NEW.authoring_revision IS NULL THEN
    RAISE EXCEPTION 'A form authoring revision is required.' USING ERRCODE='23514';
  END IF;
  IF NEW.authoring_revision IS NOT NULL AND NEW.authoring_revision<>current_revision THEN
    RAISE EXCEPTION 'Assessment authoring changed while assembling the form; reload and retry.' USING ERRCODE='40001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_form_authoring_revision() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER assessment_delivery_revision_check BEFORE INSERT ON public.participant_section_forms
FOR EACH ROW EXECUTE FUNCTION private.validate_form_authoring_revision();

-- Database-first deployment: existing form-assembler@1 writers do not send a
-- revision, so remain accepted while old app instances drain. New writers use
-- @2 and must validate the full assembly. Existing frozen rows are untouched.
CREATE OR REPLACE FUNCTION private.item_was_delivered(p_item uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM participant_section_forms
    WHERE entries @> jsonb_build_array(jsonb_build_object('itemId',p_item::text)))
    OR EXISTS (SELECT 1 FROM participant_responses WHERE item_id=p_item)
$$;
REVOKE ALL ON FUNCTION private.item_was_delivered(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.item_was_delivered(uuid) TO service_role;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.guard_delivered_item_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_item uuid; new_item uuid;
BEGIN
  IF TG_TABLE_NAME='items' THEN
    old_item := OLD.id;
    IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['status','lifecycle_state','deleted_at','updated_at'])
      = (to_jsonb(OLD)-ARRAY['status','lifecycle_state','deleted_at','updated_at']) THEN RETURN NEW; END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN old_item := OLD.item_id; END IF;
    IF TG_OP <> 'DELETE' THEN new_item := NEW.item_id; END IF;
    IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'updated_at') = (to_jsonb(OLD)-'updated_at') THEN RETURN NEW; END IF;
  END IF;
  IF private.item_was_delivered(old_item) OR private.item_was_delivered(new_item) THEN
    RAISE EXCEPTION 'Delivered item content is immutable; save a new item revision.' USING ERRCODE='23514';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER delivered_item_content_guard BEFORE UPDATE OR DELETE ON public.items
FOR EACH ROW EXECUTE FUNCTION private.guard_delivered_item_content();
CREATE TRIGGER delivered_item_options_guard BEFORE INSERT OR UPDATE OR DELETE ON public.item_options
FOR EACH ROW EXECUTE FUNCTION private.guard_delivered_item_content();
CREATE TRIGGER delivered_cognitive_spec_guard BEFORE INSERT OR UPDATE OR DELETE ON public.cognitive_item_specs
FOR EACH ROW EXECUTE FUNCTION private.guard_delivered_item_content();
CREATE TRIGGER delivered_cognitive_options_guard BEFORE INSERT OR UPDATE OR DELETE ON public.cognitive_option_specs
FOR EACH ROW EXECUTE FUNCTION private.guard_delivered_item_content();
CREATE TRIGGER delivered_answer_key_guard BEFORE INSERT OR UPDATE OR DELETE ON public.item_answer_keys
FOR EACH ROW EXECUTE FUNCTION private.guard_delivered_item_content();
REVOKE ALL ON FUNCTION private.guard_delivered_item_content() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.guard_delivered_scoring_config()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aid uuid; fid uuid; sid uuid; rid uuid; changed boolean := true;
BEGIN
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'updated_at') = (to_jsonb(OLD)-'updated_at') THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='response_formats' THEN
    rid := OLD.id;
    IF TG_OP='UPDATE' AND NEW.type=OLD.type AND NEW.config=OLD.config THEN RETURN NEW; END IF;
    changed := EXISTS(SELECT 1 FROM items i WHERE i.response_format_id=rid AND private.item_was_delivered(i.id))
      OR EXISTS(SELECT 1 FROM assessment_sections s JOIN participant_section_forms f ON f.section_id=s.id WHERE s.response_format_id=rid);
  ELSIF TG_TABLE_NAME='assessment_sections' THEN
    sid:=OLD.id;
    IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['updated_at','title','instructions'])=(to_jsonb(OLD)-ARRAY['updated_at','title','instructions']) THEN RETURN NEW; END IF;
    changed:=EXISTS(SELECT 1 FROM participant_section_forms WHERE section_id=sid);
  ELSIF TG_TABLE_NAME='assessment_section_items' THEN
    sid:=CASE WHEN TG_OP='INSERT' THEN NEW.section_id ELSE OLD.section_id END;
    changed:=EXISTS(SELECT 1 FROM participant_section_forms WHERE section_id=sid);
    IF TG_OP='UPDATE' THEN changed:=changed OR EXISTS(SELECT 1 FROM participant_section_forms WHERE section_id=NEW.section_id); END IF;
  ELSIF TG_TABLE_NAME='assessment_factors' THEN
    aid:=CASE WHEN TG_OP='INSERT' THEN NEW.assessment_id ELSE OLD.assessment_id END;
    changed:=EXISTS(SELECT 1 FROM participant_section_forms f JOIN assessment_sections s ON s.id=f.section_id WHERE s.assessment_id=aid);
    IF TG_OP='UPDATE' THEN
      changed:=changed OR EXISTS(SELECT 1 FROM participant_section_forms f JOIN assessment_sections s ON s.id=f.section_id WHERE s.assessment_id=NEW.assessment_id);
    END IF;
  ELSIF TG_TABLE_NAME='factor_constructs' THEN
    fid:=CASE WHEN TG_OP='INSERT' THEN NEW.factor_id ELSE OLD.factor_id END;
    changed:=EXISTS(SELECT 1 FROM assessment_factors af JOIN assessment_sections s ON s.assessment_id=af.assessment_id JOIN participant_section_forms f ON f.section_id=s.id WHERE af.factor_id=fid);
    IF TG_OP='UPDATE' THEN
      changed:=changed OR EXISTS(SELECT 1 FROM assessment_factors af JOIN assessment_sections s ON s.assessment_id=af.assessment_id JOIN participant_section_forms f ON f.section_id=s.id WHERE af.factor_id=NEW.factor_id);
    END IF;
  ELSIF TG_TABLE_NAME='assessments' THEN
    changed := TG_OP='DELETE' OR NEW.scoring_profile IS DISTINCT FROM OLD.scoring_profile
      OR NEW.scoring_method IS DISTINCT FROM OLD.scoring_method;
    changed:=changed AND EXISTS(SELECT 1 FROM participant_section_forms f JOIN assessment_sections s ON s.id=f.section_id WHERE s.assessment_id=OLD.id);
  END IF;
  IF changed THEN RAISE EXCEPTION 'Delivered assessment scoring configuration is immutable; clone a new assessment version.' USING ERRCODE='23514'; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER delivered_format_guard BEFORE UPDATE OR DELETE ON public.response_formats FOR EACH ROW EXECUTE FUNCTION private.guard_delivered_scoring_config();
CREATE TRIGGER delivered_section_guard BEFORE UPDATE OR DELETE ON public.assessment_sections FOR EACH ROW EXECUTE FUNCTION private.guard_delivered_scoring_config();
CREATE TRIGGER delivered_section_items_guard BEFORE INSERT OR UPDATE OR DELETE ON public.assessment_section_items FOR EACH ROW EXECUTE FUNCTION private.guard_delivered_scoring_config();
CREATE TRIGGER delivered_assessment_factors_guard BEFORE INSERT OR UPDATE OR DELETE ON public.assessment_factors FOR EACH ROW EXECUTE FUNCTION private.guard_delivered_scoring_config();
CREATE TRIGGER delivered_factor_constructs_guard BEFORE INSERT OR UPDATE OR DELETE ON public.factor_constructs FOR EACH ROW EXECUTE FUNCTION private.guard_delivered_scoring_config();
CREATE TRIGGER delivered_assessment_profile_guard BEFORE UPDATE OR DELETE ON public.assessments FOR EACH ROW EXECUTE FUNCTION private.guard_delivered_scoring_config();
REVOKE ALL ON FUNCTION private.guard_delivered_scoring_config() FROM PUBLIC,anon,authenticated;

-- One transaction for metadata/options. Delivered items become new draft
-- revisions; no question already served to a participant is relinked.
CREATE OR REPLACE FUNCTION public.revise_library_item(p_item_id uuid,p_patch jsonb,p_options jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_row items; new_row items; target uuid; option_row item_options;
  new_option uuid; option_map jsonb := '{}'; cloned boolean;
BEGIN
  -- Match the statement-trigger lock order before taking the explicit item
  -- row lock below. A freeze cannot slip between the delivered check and edit.
  PERFORM pg_advisory_xact_lock(178438921, 1);
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN
    ('purpose','construct_id','response_format_id','stem','stem_observer','reverse_scored','weight','status','display_order','difficulty','source_id','keyed_answer')) THEN
    RAISE EXCEPTION 'Unsupported item property';
  END IF;
  IF p_options IS NOT NULL AND jsonb_typeof(p_options)<>'array' THEN RAISE EXCEPTION 'Options must be an array'; END IF;
  SELECT * INTO old_row FROM items WHERE id=p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  cloned:=private.item_was_delivered(p_item_id);
  target:=CASE WHEN cloned THEN gen_random_uuid() ELSE p_item_id END;
  new_row:=jsonb_populate_record(old_row,p_patch);
  IF cloned THEN
    new_row.id:=target; new_row.parent_item_id:=p_item_id;
    new_row.item_version:=old_row.item_version+1; new_row.content_hash:=NULL;
    new_row.status:='draft'; new_row.lifecycle_state:='draft';
    new_row.created_at:=now(); new_row.updated_at:=now();
    INSERT INTO items SELECT (new_row).*;
    FOR option_row IN SELECT * FROM item_options WHERE item_id=p_item_id LOOP
      new_option:=gen_random_uuid();
      option_map:=option_map||jsonb_build_object(option_row.id::text,new_option);
      option_row.id:=new_option; option_row.item_id:=target;
      INSERT INTO item_options SELECT (option_row).*;
    END LOOP;
    -- Preserve cognitive content and answer provenance without copying review
    -- approvals or calibration parameters. The successor must be reviewed.
    INSERT INTO cognitive_item_specs(item_id,kind,spec_version,spec,render_style_version,generation_run_id,generator_seed,qa,content_hash)
      SELECT target,kind,spec_version,spec,render_style_version,generation_run_id,generator_seed,qa,content_hash FROM cognitive_item_specs WHERE item_id=p_item_id;
    INSERT INTO cognitive_option_specs(option_id,item_id,spec)
      SELECT (option_map->>option_id::text)::uuid,target,spec FROM cognitive_option_specs WHERE item_id=p_item_id;
    INSERT INTO item_answer_keys(item_id,correct_option_id,scoring_rule,rationale)
      SELECT target,(option_map->>correct_option_id::text)::uuid,scoring_rule,rationale FROM item_answer_keys WHERE item_id=p_item_id;
  ELSE
    UPDATE items SET purpose=new_row.purpose,construct_id=new_row.construct_id,response_format_id=new_row.response_format_id,
      stem=new_row.stem,stem_observer=new_row.stem_observer,reverse_scored=new_row.reverse_scored,weight=new_row.weight,
      status=new_row.status,display_order=new_row.display_order,difficulty=new_row.difficulty,source_id=new_row.source_id,keyed_answer=new_row.keyed_answer
    WHERE id=target;
  END IF;
  IF p_options IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM cognitive_item_specs WHERE item_id=target) THEN
      RAISE EXCEPTION 'Cognitive options must be revised through the cognitive item bank.';
    END IF;
    DELETE FROM item_options WHERE item_id=target;
    INSERT INTO item_options(item_id,label,value,score_value,exclude_from_scoring,display_order)
      SELECT target,x->>'label',(x->>'value')::numeric,(x->>'scoreValue')::numeric,
        COALESCE((x->>'excludeFromScoring')::boolean,false),ord::int
      FROM jsonb_array_elements(p_options) WITH ORDINALITY AS opts(x,ord);
  END IF;
  RETURN target;
END $$;
REVOKE ALL ON FUNCTION public.revise_library_item(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.revise_library_item(uuid,jsonb,jsonb) TO service_role;
