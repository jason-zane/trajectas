-- Verified hosted Development only; every synthetic fixture is rolled back.
BEGIN;
SET LOCAL ROLE service_role;
DO $acceptance$
DECLARE
  aid uuid:='741663b2-fbc1-56fe-a0ed-c9bb521e18b6'; section_key uuid:='66da538c-6850-5513-a97d-09cdd56ac7c7';
  sid uuid; legacy uuid; rid uuid; review uuid:=gen_random_uuid(); config jsonb; frozen jsonb; saved jsonb; q record; version integer:=0; tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['session_response_quality_modules','participant_response_quality_results','response_quality_reviews'] LOOP
    IF has_table_privilege('anon','public.'||tab,'SELECT') OR has_table_privilege('authenticated','public.'||tab,'SELECT')
      OR has_table_privilege('anon','public.'||tab,'INSERT') OR has_table_privilege('authenticated','public.'||tab,'UPDATE')
      OR NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=tab AND c.relrowsecurity) THEN RAISE EXCEPTION 'Private grants/RLS failed: %',tab; END IF;
  END LOOP;
  IF has_function_privilege('anon','public.save_response_quality_answer(uuid,text,integer,integer)','EXECUTE')
    OR has_function_privilege('authenticated','public.save_response_quality_answer(uuid,text,integer,integer)','EXECUTE') THEN RAISE EXCEPTION 'Public save grant'; END IF;
  config:=public.get_ipip_neo_120_delivery(aid);
  SELECT jsonb_agg(jsonb_build_object('position',n,'itemId',config->'items'->>('q'||lpad(n::text,3,'0')),'itemVersion',1,'contentHash',config->'itemContentHashes'->>('q'||lpad(n::text,3,'0')),'purpose','construct','countsTowardScore',true) ORDER BY n) INTO frozen FROM generate_series(1,120) n;
  INSERT INTO public.participant_sessions(assessment_id,status,is_internal) VALUES(aid,'in_progress',true) RETURNING id INTO sid;
  INSERT INTO public.participant_section_forms(session_id,section_id,assembly_seed,assembler_version,form_code,entries,entry_count,authoring_revision)
    VALUES(sid,section_key,sid::text||':'||section_key::text,'form-assembler@2',config->>'formVersion',frozen,120,public.get_delivery_authoring_revision(aid));
  IF (SELECT jsonb_array_length(questions) FROM public.session_response_quality_modules WHERE session_id=sid) IS DISTINCT FROM 8 THEN RAISE EXCEPTION 'Assignment missing'; END IF;
  saved:=public.save_response_quality_answer(sid,'attention_agree',4,0);
  IF public.save_response_quality_answer(sid,'attention_agree',4,0)<>saved THEN RAISE EXCEPTION 'Save retry not idempotent'; END IF;
  BEGIN PERFORM public.save_response_quality_answer(sid,'attention_agree',3,0); RAISE EXCEPTION 'Stale save allowed'; EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  BEGIN PERFORM public.save_response_quality_answer(sid,'unknown',4,1); RAISE EXCEPTION 'Unknown question allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN PERFORM public.save_response_quality_answer(sid,'attention_agree',6,1); RAISE EXCEPTION 'Invalid value allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE public.session_response_quality_modules SET questions='[]',revision=revision+1 WHERE session_id=sid; RAISE EXCEPTION 'Question edit allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
  FOR q IN SELECT value->>'id' AS key FROM public.session_response_quality_modules m,jsonb_array_elements(m.questions) WHERE m.session_id=sid LOOP
    IF q.key='attention_agree' THEN CONTINUE; END IF;
    version:=version+1;
    PERFORM public.save_response_quality_answer(sid,q.key,CASE WHEN q.key='attention_disagree' THEN 1 ELSE 2 END,version);
  END LOOP;
  IF (SELECT count(*) FROM public.participant_section_forms WHERE session_id=sid AND entry_count=120 AND entries=frozen)<>1
    OR (SELECT count(*) FROM public.assessment_section_items WHERE section_id=section_key)<>120 THEN RAISE EXCEPTION 'Native form changed'; END IF;
  UPDATE public.participant_sessions SET status='completed' WHERE id=sid;
  BEGIN PERFORM public.save_response_quality_answer(sid,'attention_agree',3,8); RAISE EXCEPTION 'Closed save allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Closed save allowed' THEN RAISE; END IF; END;
  INSERT INTO public.participant_response_quality_results(session_id,policy_version,status,result)
    VALUES(sid,'trajectas-response-quality-pilot-v1','insufficient_information',jsonb_build_object('policyVersion','trajectas-response-quality-pilot-v1','status','insufficient_information','provisional',true,'indicators',jsonb_build_array('{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb))) RETURNING id INTO rid;
  INSERT INTO public.response_quality_reviews(id,result_id,reviewer_id,decision,notes) VALUES(review,rid,gen_random_uuid(),'follow_up','Synthetic rollback-only review.') ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.response_quality_reviews(id,result_id,reviewer_id,decision,notes) VALUES(review,rid,gen_random_uuid(),'follow_up','Synthetic rollback-only review.') ON CONFLICT(id) DO NOTHING;
  IF (SELECT count(*) FROM public.response_quality_reviews WHERE result_id=rid)<>1 THEN RAISE EXCEPTION 'Review retry duplicated'; END IF;
  BEGIN UPDATE public.response_quality_reviews SET notes='Rewritten review' WHERE id=review; RAISE EXCEPTION 'Review overwrite allowed'; EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;
  BEGIN DELETE FROM public.participant_response_quality_results WHERE id=rid; RAISE EXCEPTION 'Result deletion allowed'; EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;
  DELETE FROM public.participant_sessions WHERE id=sid;
  IF EXISTS(SELECT 1 FROM public.session_response_quality_modules WHERE session_id=sid)
    OR EXISTS(SELECT 1 FROM public.response_quality_reviews WHERE id=review) THEN RAISE EXCEPTION 'Parent purge failed'; END IF;
  INSERT INTO public.participant_sessions(assessment_id,status,is_internal) VALUES(aid,'completed',true) RETURNING id INTO legacy;
  INSERT INTO public.participant_section_forms(session_id,section_id,assembly_seed,assembler_version,form_code,entries,entry_count,authoring_revision)
    VALUES(legacy,section_key,legacy::text||':'||section_key::text,'form-assembler@2',config->>'formVersion',frozen,120,public.get_delivery_authoring_revision(aid));
  IF EXISTS(SELECT 1 FROM public.session_response_quality_modules WHERE session_id=legacy) THEN RAISE EXCEPTION 'Legacy form gained questions'; END IF;
END $acceptance$;
ROLLBACK;
SELECT 'passed: assignment, frozen core, save retries, stale writes, value checks, closed-state refusal, private grants/RLS, append-only review, cascade purge and legacy compatibility; all fixtures rolled back' AS response_quality_verification;
