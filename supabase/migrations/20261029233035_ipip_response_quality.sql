-- Additive pilot protocol. Original IPIP forms, answers, keys and results are untouched.
CREATE TABLE public.session_response_quality_modules (
  session_id uuid PRIMARY KEY REFERENCES public.participant_sessions(id) ON DELETE CASCADE,
  module_version text NOT NULL CHECK (module_version='trajectas-response-quality-v1'),
  questions jsonb NOT NULL CHECK (jsonb_typeof(questions)='array' AND jsonb_array_length(questions)=8),
  answers jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(answers)='object'),
  revision integer NOT NULL DEFAULT 0 CHECK (revision>=0),
  assigned_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.participant_response_quality_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.participant_sessions(id) ON DELETE CASCADE,
  policy_version text NOT NULL CHECK (policy_version='trajectas-response-quality-pilot-v1'),
  status text NOT NULL CHECK (status IN ('no_concerns_detected','review_recommended','insufficient_information')),
  result jsonb NOT NULL CHECK ((jsonb_typeof(result)='object' AND result->>'policyVersion'=policy_version AND result->>'status'=status AND result->'provisional'='true'::jsonb
    AND jsonb_typeof(result->'indicators')='array' AND jsonb_array_length(result->'indicators')=5) IS TRUE),
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id,policy_version)
);
CREATE TABLE public.response_quality_reviews (
  id uuid PRIMARY KEY,
  result_id uuid NOT NULL REFERENCES public.participant_response_quality_results(id) ON DELETE CASCADE,
  -- Durable audit identifier, intentionally retained if the profile is later purged.
  reviewer_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('accepted','follow_up','reassessment')),
  notes text NOT NULL CHECK (char_length(btrim(notes)) BETWEEN 10 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX response_quality_reviews_result_idx ON public.response_quality_reviews(result_id,created_at);
ALTER TABLE public.session_response_quality_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_response_quality_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_quality_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_response_quality_modules,public.participant_response_quality_results,public.response_quality_reviews FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,UPDATE ON public.session_response_quality_modules TO service_role;
GRANT SELECT,INSERT ON public.participant_response_quality_results,public.response_quality_reviews TO service_role;
CREATE POLICY quality_modules_service ON public.session_response_quality_modules FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE POLICY quality_results_service ON public.participant_response_quality_results FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE POLICY quality_reviews_service ON public.response_quality_reviews FOR ALL TO service_role USING(true) WITH CHECK(true);

-- Assignment occurs only at the FIRST freeze of a new, unanswered native form.
-- No backfill: delivered forms and in-flight legacy answers never acquire questions.
CREATE FUNCTION private.assign_ipip_response_quality() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.section_id='66da538c-6850-5513-a97d-09cdd56ac7c7'::uuid
    AND EXISTS(SELECT 1 FROM public.participant_sessions s WHERE s.id=NEW.session_id
      AND s.assessment_id='741663b2-fbc1-56fe-a0ed-c9bb521e18b6'::uuid AND s.status::text='in_progress')
    AND NOT EXISTS(SELECT 1 FROM public.participant_responses WHERE session_id=NEW.session_id) THEN
    INSERT INTO public.session_response_quality_modules(session_id,module_version,questions)
    VALUES(NEW.session_id,'trajectas-response-quality-v1', $questions$[
      {"id":"attention_agree","stem":"For this statement, please select Agree."},
      {"id":"presentation_lie","stem":"I have never told a lie, even a small one."},
      {"id":"infrequency_sleep","stem":"I have never needed sleep at any point in my life."},
      {"id":"presentation_commitment","stem":"I always follow through on every commitment I make, no matter how minor."},
      {"id":"presentation_jealousy","stem":"I have never felt jealous of a colleague’s success."},
      {"id":"infrequency_languages","stem":"I can read and understand every language ever written."},
      {"id":"presentation_feedback","stem":"I never find it difficult to accept feedback from others."},
      {"id":"attention_disagree","stem":"For this statement, please select Strongly disagree."}
    ]$questions$::jsonb) ON CONFLICT(session_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.assign_ipip_response_quality() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER ipip_response_quality_assignment AFTER INSERT ON public.participant_section_forms
FOR EACH ROW EXECUTE FUNCTION private.assign_ipip_response_quality();

CREATE FUNCTION private.guard_response_quality_module() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM public.participant_sessions WHERE id=OLD.session_id) THEN RETURN OLD; END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Delivered response-quality modules cannot be removed'; END IF;
  IF (to_jsonb(NEW)-'answers'-'revision') IS DISTINCT FROM (to_jsonb(OLD)-'answers'-'revision')
    OR NEW.revision<>OLD.revision+1
    OR NOT EXISTS(SELECT 1 FROM public.participant_sessions WHERE id=OLD.session_id AND status::text='in_progress')
    OR EXISTS(SELECT 1 FROM jsonb_each(NEW.answers) a WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(OLD.questions) q WHERE q->>'id'=a.key)
      OR jsonb_typeof(a.value)<>'number' OR a.value NOT IN ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb,'5'::jsonb))
    OR NOT (NEW.answers ?& ARRAY(SELECT jsonb_object_keys(OLD.answers))) THEN
    RAISE EXCEPTION 'Invalid or closed response-quality module update' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_response_quality_module() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER response_quality_module_guard BEFORE UPDATE OR DELETE ON public.session_response_quality_modules
FOR EACH ROW EXECUTE FUNCTION private.guard_response_quality_module();

-- Session lock serialises saves with completion. Revision detects stale tabs;
-- an identical lost-response retry is safe and does not overwrite newer answers.
CREATE FUNCTION public.save_response_quality_answer(p_session_id uuid,p_question_id text,p_value integer,p_expected_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE state text; module public.session_response_quality_modules%ROWTYPE;
BEGIN
  SELECT status::text INTO state FROM public.participant_sessions WHERE id=p_session_id FOR UPDATE;
  IF state IS DISTINCT FROM 'in_progress' THEN RAISE EXCEPTION 'This assessment is no longer open'; END IF;
  SELECT * INTO STRICT module FROM public.session_response_quality_modules WHERE session_id=p_session_id FOR UPDATE;
  IF p_value IS NULL OR p_value NOT BETWEEN 1 AND 5 OR p_question_id IS NULL OR p_expected_revision IS NULL
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(module.questions) q WHERE q->>'id'=p_question_id) THEN
    RAISE EXCEPTION 'Invalid supplementary response' USING ERRCODE='23514';
  END IF;
  IF module.revision<>p_expected_revision THEN
    IF module.answers->p_question_id IS NOT DISTINCT FROM to_jsonb(p_value) THEN
      RETURN jsonb_build_object('answers',module.answers,'revision',module.revision);
    END IF;
    RAISE EXCEPTION 'Your answers changed in another tab. Refresh this page before continuing.' USING ERRCODE='PT409';
  END IF;
  UPDATE public.session_response_quality_modules SET answers=answers||jsonb_build_object(p_question_id,p_value),revision=revision+1
  WHERE session_id=p_session_id RETURNING * INTO module;
  RETURN jsonb_build_object('answers',module.answers,'revision',module.revision);
END $$;
REVOKE ALL ON FUNCTION public.save_response_quality_answer(uuid,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_response_quality_answer(uuid,text,integer,integer) TO service_role;

CREATE FUNCTION private.guard_response_quality_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='DELETE' AND TG_TABLE_NAME='participant_response_quality_results'
    AND NOT EXISTS(SELECT 1 FROM public.participant_sessions WHERE id=(to_jsonb(OLD)->>'session_id')::uuid) THEN RETURN OLD; END IF;
  IF TG_OP='DELETE' AND TG_TABLE_NAME='response_quality_reviews'
    AND NOT EXISTS(SELECT 1 FROM public.participant_response_quality_results WHERE id=(to_jsonb(OLD)->>'result_id')::uuid) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Response-quality evidence is append-only' USING ERRCODE='23514';
END $$;
REVOKE ALL ON FUNCTION private.guard_response_quality_evidence() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER response_quality_result_immutable BEFORE UPDATE OR DELETE ON public.participant_response_quality_results
FOR EACH ROW EXECUTE FUNCTION private.guard_response_quality_evidence();
CREATE TRIGGER response_quality_review_immutable BEFORE UPDATE OR DELETE ON public.response_quality_reviews
FOR EACH ROW EXECUTE FUNCTION private.guard_response_quality_evidence();

CREATE FUNCTION private.check_response_quality_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.participant_sessions WHERE id=NEW.session_id
    AND assessment_id='741663b2-fbc1-56fe-a0ed-c9bb521e18b6'::uuid AND status::text='completed') THEN
    RAISE EXCEPTION 'Response-quality results require a completed personality assessment';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.check_response_quality_completion() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER response_quality_completed_guard BEFORE INSERT ON public.participant_response_quality_results
FOR EACH ROW EXECUTE FUNCTION private.check_response_quality_completion();
