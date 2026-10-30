-- Version only NEW unanswered form assignments. Existing v1 modules and all
-- native forms, responses, scoring results and report snapshots are preserved.
ALTER TABLE public.session_response_quality_modules DROP CONSTRAINT session_response_quality_modules_module_version_check;
ALTER TABLE public.session_response_quality_modules ADD CONSTRAINT session_response_quality_modules_module_version_check
  CHECK (module_version IN ('trajectas-response-quality-v1','trajectas-response-quality-v2'));

CREATE OR REPLACE FUNCTION private.assign_ipip_response_quality() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.section_id='66da538c-6850-5513-a97d-09cdd56ac7c7'::uuid
    AND EXISTS(SELECT 1 FROM public.participant_sessions s WHERE s.id=NEW.session_id
      AND s.assessment_id='741663b2-fbc1-56fe-a0ed-c9bb521e18b6'::uuid AND s.status::text='in_progress')
    AND NOT EXISTS(SELECT 1 FROM public.participant_responses WHERE session_id=NEW.session_id) THEN
    INSERT INTO public.session_response_quality_modules(session_id,module_version,questions)
    VALUES(NEW.session_id,'trajectas-response-quality-v2', $questions$[
      {"id":"attention_agree","stem":"For this statement, please select Very Accurate.","afterItem":12},
      {"id":"presentation_lie","stem":"I have never told a lie, even a small one.","afterItem":27},
      {"id":"infrequency_sleep","stem":"I have never needed sleep at any point in my life.","afterItem":42},
      {"id":"presentation_commitment","stem":"I always follow through on every commitment I make, no matter how minor.","afterItem":57},
      {"id":"presentation_jealousy","stem":"I have never felt jealous of a colleague’s success.","afterItem":72},
      {"id":"infrequency_languages","stem":"I can read and understand every language ever written.","afterItem":87},
      {"id":"presentation_feedback","stem":"I never find it difficult to accept feedback from others.","afterItem":102},
      {"id":"attention_disagree","stem":"For this statement, please select Very Inaccurate.","afterItem":117}
    ]$questions$::jsonb) ON CONFLICT(session_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.assign_ipip_response_quality() FROM PUBLIC,anon,authenticated,service_role;
