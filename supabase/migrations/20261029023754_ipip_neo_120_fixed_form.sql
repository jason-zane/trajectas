-- Additive native fixed-form support. No assessment is imported or activated here.
-- Distinguish personality scale position from competency effectiveness POMP.
ALTER TABLE public.participant_scores DROP CONSTRAINT participant_scores_metric_check;
ALTER TABLE public.participant_scores ADD CONSTRAINT participant_scores_metric_check
  CHECK(metric IN ('pomp','personality_pomp','percent_correct','t_score'));
ALTER TABLE public.participant_scores ADD CONSTRAINT personality_scores_no_norm_claims CHECK(
  metric<>'personality_pomp' OR (percentile IS NULL AND confidence_interval_lower IS NULL
    AND confidence_interval_upper IS NULL AND norm_group_id IS NULL AND norm_version IS NULL)
);
CREATE TABLE public.standardized_assessment_forms (
  assessment_id uuid PRIMARY KEY REFERENCES public.assessments(id) ON DELETE RESTRICT,
  instrument_id text NOT NULL CHECK (instrument_id='ipip-neo-120-johnson-2014'),
  definition jsonb NOT NULL CHECK (definition->>'instrumentId'=instrument_id),
  activation_ready boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.standardized_assessment_forms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.standardized_assessment_forms FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.standardized_assessment_forms TO service_role;
CREATE POLICY standardized_forms_service ON public.standardized_assessment_forms FOR ALL TO service_role USING(true) WITH CHECK(true);

CREATE TABLE public.participant_instrument_results (
  session_id uuid PRIMARY KEY REFERENCES public.participant_sessions(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.standardized_assessment_forms(assessment_id) ON DELETE RESTRICT,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(result->>'instrumentId'='ipip-neo-120-johnson-2014'),
  CHECK(result->>'primaryMetric'='pomp' AND result->'normReference'='null'::jsonb AND result->'overallScore'='null'::jsonb)
);
CREATE INDEX participant_instrument_results_assessment_idx ON public.participant_instrument_results(assessment_id);
ALTER TABLE public.participant_instrument_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.participant_instrument_results FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.participant_instrument_results TO service_role;
CREATE POLICY instrument_results_service ON public.participant_instrument_results FOR ALL TO service_role USING(true) WITH CHECK(true);

CREATE FUNCTION private.guard_standardized_content() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE before_row jsonb; after_row jsonb; config jsonb; expected jsonb; reference record; related boolean; target_id text;
BEGIN
  before_row:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  after_row:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  -- Allow only the parent session's authorized cascade purge, never direct result edits.
  IF TG_TABLE_NAME='participant_instrument_results' AND TG_OP='DELETE'
    AND NOT EXISTS(SELECT 1 FROM public.participant_sessions WHERE id=(before_row->>'session_id')::uuid) THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME IN ('standardized_assessment_forms','participant_instrument_results') THEN
    RAISE EXCEPTION 'Versioned instrument definitions and results are immutable' USING ERRCODE='23514';
  END IF;
  FOR config IN SELECT definition FROM public.standardized_assessment_forms LOOP
    expected:=NULL;
    SELECT value INTO expected FROM jsonb_array_elements(coalesce(config->'rows'->TG_TABLE_NAME,'[]'))
    WHERE value->>'id'=before_row->>'id' OR value->>'id'=after_row->>'id' LIMIT 1;
    related:=expected IS NOT NULL;
    FOR reference IN SELECT key,value FROM jsonb_each(coalesce(config->'references'->TG_TABLE_NAME,'{}')) LOOP
      related:=related OR reference.value ? (before_row->>reference.key) OR reference.value ? (after_row->>reference.key);
    END LOOP;
    IF related AND (TG_OP='DELETE' OR expected IS NULL OR NOT after_row @> expected) THEN
      RAISE EXCEPTION 'IPIP-NEO-120 is a complete, immutable standardized assessment; create a new instrument version for changes' USING ERRCODE='23514';
    END IF;
  END LOOP;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION private.guard_standardized_content() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['content_sources','response_formats','dimensions','constructs','factors','factor_constructs','items','item_options','assessments','assessment_factors','assessment_sections','assessment_section_items','forced_choice_block_items'] LOOP
    EXECUTE format('CREATE TRIGGER standardized_content_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.guard_standardized_content()',tbl);
  END LOOP;
END $$;
CREATE TRIGGER standardized_definition_immutable BEFORE UPDATE OR DELETE ON public.standardized_assessment_forms FOR EACH ROW EXECUTE FUNCTION private.guard_standardized_content();
CREATE TRIGGER standardized_result_immutable BEFORE UPDATE OR DELETE ON public.participant_instrument_results FOR EACH ROW EXECUTE FUNCTION private.guard_standardized_content();

-- Service-only check called before delivery and scoring. Detects extra links too.
CREATE FUNCTION public.get_ipip_neo_120_delivery(p_assessment_id uuid,p_campaign_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE config jsonb; tbl text; expected jsonb; actual jsonb; selected_count integer; selected_valid integer; ca uuid;
BEGIN
  SELECT definition INTO STRICT config FROM public.standardized_assessment_forms WHERE assessment_id=p_assessment_id;
  FOR tbl IN SELECT jsonb_object_keys(config->'rows') LOOP
    FOR expected IN SELECT value FROM jsonb_array_elements(config->'rows'->tbl) LOOP
      EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',tbl) INTO actual USING (expected->>'id')::uuid;
      IF actual IS NULL OR NOT actual @> expected THEN RAISE EXCEPTION 'IPIP canonical content mismatch: %',tbl USING ERRCODE='23514'; END IF;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM public.assessment_sections WHERE assessment_id=p_assessment_id)<>1
    OR (SELECT count(*) FROM public.assessment_section_items WHERE section_id=(config->>'sectionId')::uuid)<>120
    OR (SELECT count(*) FROM public.assessment_factors WHERE assessment_id=p_assessment_id)<>30 THEN
    RAISE EXCEPTION 'IPIP-NEO-120 must be delivered as the full original form' USING ERRCODE='23514';
  END IF;
  IF p_campaign_id IS NOT NULL THEN
    SELECT id INTO ca FROM public.campaign_assessments WHERE campaign_id=p_campaign_id AND assessment_id=p_assessment_id AND deleted_at IS NULL;
    SELECT count(*),count(*) FILTER (WHERE factor_id::text IN (SELECT value->>'factorId' FROM jsonb_each(config->'facets')))
      INTO selected_count,selected_valid FROM public.campaign_assessment_factors WHERE campaign_assessment_id=ca;
    IF selected_count NOT IN (0,30) OR selected_valid<>selected_count THEN
      RAISE EXCEPTION 'IPIP-NEO-120 does not support facet selection' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN config;
END $$;
REVOKE ALL ON FUNCTION public.get_ipip_neo_120_delivery(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_ipip_neo_120_delivery(uuid,uuid) TO service_role;

-- Exact frozen identity is checked in addition to the existing authoring-revision guard.
CREATE FUNCTION private.guard_ipip_frozen_form() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE config jsonb; aid uuid; cid uuid;
BEGIN
  SELECT assessment_id,campaign_id INTO aid,cid FROM public.participant_sessions WHERE id=NEW.session_id;
  SELECT definition INTO config FROM public.standardized_assessment_forms WHERE assessment_id=aid;
  IF config IS NULL THEN RETURN NEW; END IF;
  PERFORM public.get_ipip_neo_120_delivery(aid,cid);
  IF NEW.section_id<>(config->>'sectionId')::uuid OR NEW.entry_count<>120 OR jsonb_array_length(NEW.entries)<>120
    OR NEW.form_code IS DISTINCT FROM config->>'formVersion'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.entries) WITH ORDINALITY e(value,n)
      WHERE value->>'itemId' IS DISTINCT FROM config->'items'->>('q'||lpad(n::text,3,'0'))
        OR (value->>'position')::integer<>n OR (value->>'itemVersion')::integer<>1
        OR value->>'contentHash' IS DISTINCT FROM config->'itemContentHashes'->>('q'||lpad(n::text,3,'0'))
        OR value->>'purpose' IS DISTINCT FROM 'construct' OR value->'countsTowardScore' IS DISTINCT FROM 'true'::jsonb) THEN
    RAISE EXCEPTION 'IPIP-NEO-120 requires its exact complete frozen form' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_ipip_frozen_form() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER ipip_frozen_form_guard BEFORE INSERT ON public.participant_section_forms FOR EACH ROW EXECUTE FUNCTION private.guard_ipip_frozen_form();

-- Reject missing statistics as well as incorrect arithmetic (SQL NULL must fail closed).
CREATE FUNCTION private.ipip_statistics_match(stats jsonb,total numeric,n integer) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog AS $$
  SELECT coalesce((stats->>'rawSum')::numeric=total
    AND (stats->>'itemsUsed')::integer=n
    AND abs((stats->>'itemMean')::numeric-total/n)<=0.00000001
    AND abs((stats->>'pomp')::numeric-100*(total-n)/(4*n))<=0.00000001,false)
$$;
REVOKE ALL ON FUNCTION private.ipip_statistics_match(jsonb,numeric,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.ipip_statistics_match(jsonb,numeric,integer) TO service_role;

CREATE FUNCTION public.persist_ipip_neo_120_result(p_session_id uuid,p_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE sess record; config jsonb; facet record; domain record; native_sum numeric; display_sum numeric; score jsonb; prior jsonb; factor uuid;
BEGIN
  SELECT * INTO STRICT sess FROM public.participant_sessions WHERE id=p_session_id FOR UPDATE;
  IF sess.status::text<>'completed' THEN RAISE EXCEPTION 'IPIP session must be completed'; END IF;
  config:=public.get_ipip_neo_120_delivery(sess.assessment_id,sess.campaign_id);
  IF p_result->>'instrumentId' IS DISTINCT FROM config->>'instrumentId'
    OR p_result->>'formVersion' IS DISTINCT FROM config->>'formVersion'
    OR p_result->>'scoringVersion' IS DISTINCT FROM config->>'scoringVersion'
    OR p_result->>'presentationVersion' IS DISTINCT FROM config->>'presentationVersion'
    OR p_result->>'itemsetSha256' IS DISTINCT FROM config->>'itemsetSha256'
    OR p_result->>'primaryMetric' IS DISTINCT FROM 'pomp'
    OR p_result->'normReference' IS DISTINCT FROM 'null'::jsonb OR p_result->'overallScore' IS DISTINCT FROM 'null'::jsonb
    OR p_result->'responseCount' IS DISTINCT FROM '120'::jsonb
    OR (SELECT count(*) FROM jsonb_object_keys(p_result->'facets'))<>30
    OR (SELECT count(*) FROM jsonb_object_keys(p_result->'dimensions'))<>5 THEN RAISE EXCEPTION 'Invalid IPIP result envelope'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.participant_section_forms WHERE session_id=p_session_id AND section_id=(config->>'sectionId')::uuid AND entry_count=120 AND form_code=config->>'formVersion') THEN RAISE EXCEPTION 'Missing IPIP frozen form'; END IF;
  IF (SELECT count(*) FROM public.participant_responses WHERE session_id=p_session_id)<>120
    OR EXISTS(SELECT 1 FROM public.participant_responses r WHERE r.session_id=p_session_id AND
      (r.item_id::text NOT IN (SELECT value#>>'{}' FROM jsonb_each(config->'items')) OR r.section_id IS DISTINCT FROM (config->>'sectionId')::uuid OR r.response_value IS NULL OR r.response_value NOT IN (1,2,3,4,5))) THEN RAISE EXCEPTION 'Invalid IPIP responses'; END IF;
  FOR facet IN SELECT key,value FROM jsonb_each(config->'facets') LOOP
    SELECT sum(CASE WHEN i.reverse_scored THEN 6-r.response_value ELSE r.response_value END) INTO native_sum
      FROM public.participant_responses r JOIN public.items i ON i.id=r.item_id
      WHERE r.session_id=p_session_id AND i.construct_id=(facet.value->>'constructId')::uuid;
    display_sum:=CASE WHEN facet.key IN ('N4','N6') THEN 24-native_sum ELSE native_sum END;
    score:=p_result->'facets'->facet.key;
    IF native_sum IS NULL OR score IS NULL OR (score->'native'->>'rawSum')::numeric IS DISTINCT FROM native_sum
      OR (score->'display'->>'rawSum')::numeric IS DISTINCT FROM display_sum
      OR abs((score->'display'->>'pomp')::numeric-100*(display_sum-4)/16)>0.00000001
      OR NOT coalesce(private.ipip_statistics_match(score->'native',native_sum,4),false)
      OR NOT coalesce(private.ipip_statistics_match(score->'display',display_sum,4),false)
      OR score->>'direction' IS DISTINCT FROM (CASE WHEN facet.key IN ('N4','N6') THEN 'reversed' ELSE 'original' END) THEN RAISE EXCEPTION 'IPIP facet score mismatch: %',facet.key; END IF;
  END LOOP;
  FOR domain IN SELECT key,value FROM jsonb_each(config->'dimensions') LOOP
    SELECT sum((value->'native'->>'rawSum')::numeric) INTO native_sum FROM jsonb_each(p_result->'facets') WHERE left(key,1)=domain.key;
    score:=p_result->'dimensions'->domain.key;
    IF score IS NULL OR (score->'native'->>'rawSum')::numeric IS DISTINCT FROM native_sum
      OR NOT coalesce(private.ipip_statistics_match(score->'native',native_sum,24),false)
      OR NOT coalesce(private.ipip_statistics_match(score->'display',native_sum,24),false)
      OR score->>'direction' IS DISTINCT FROM 'original' THEN RAISE EXCEPTION 'IPIP domain score mismatch: %',domain.key; END IF;
  END LOOP;
  SELECT result INTO prior FROM public.participant_instrument_results WHERE session_id=p_session_id;
  IF prior IS NOT NULL THEN
    IF prior<>p_result THEN RAISE EXCEPTION 'Stored IPIP result is immutable'; END IF;
    RETURN;
  END IF;
  FOR facet IN SELECT key,value FROM jsonb_each(config->'facets') LOOP
    factor:=(facet.value->>'factorId')::uuid; score:=p_result->'facets'->facet.key;
    INSERT INTO public.participant_scores(session_id,factor_id,raw_score,scaled_score,scoring_method,metric,scoring_variant,items_used,items_attempted,provisional)
      VALUES(p_session_id,factor,(score->'native'->>'rawSum')::numeric,(score->'display'->>'pomp')::numeric,'ctt','personality_pomp',config->>'scoringVersion',4,4,false)
      ON CONFLICT(session_id,factor_id) DO UPDATE SET raw_score=excluded.raw_score,scaled_score=excluded.scaled_score,metric='personality_pomp',scoring_method='ctt',provisional=false,scoring_variant=excluded.scoring_variant,items_used=4,items_attempted=4,
      percentile=NULL,confidence_interval_lower=NULL,confidence_interval_upper=NULL,norm_group_id=NULL,norm_version=NULL;
  END LOOP;
  INSERT INTO public.participant_instrument_results(session_id,assessment_id,result) VALUES(p_session_id,sess.assessment_id,p_result);
  UPDATE public.participant_sessions SET composite_score=NULL,composite_method=NULL WHERE id=p_session_id;
END $$;
REVOKE ALL ON FUNCTION public.persist_ipip_neo_120_result(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persist_ipip_neo_120_result(uuid,jsonb) TO service_role;

-- Campaign customisation must commit either no filter or the entire facet set.
CREATE FUNCTION private.guard_ipip_campaign_selection() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ca_id uuid; ca record; config jsonb; total integer; valid integer;
BEGIN
  FOR ca_id IN SELECT DISTINCT value::uuid FROM unnest(ARRAY[
    CASE WHEN TG_TABLE_NAME='campaign_assessments' THEN to_jsonb(NEW)->>'id' ELSE to_jsonb(NEW)->>'campaign_assessment_id' END,
    CASE WHEN TG_TABLE_NAME='campaign_assessments' THEN to_jsonb(OLD)->>'id' ELSE to_jsonb(OLD)->>'campaign_assessment_id' END
  ]) value WHERE value IS NOT NULL LOOP
    SELECT * INTO ca FROM public.campaign_assessments WHERE id=ca_id AND deleted_at IS NULL;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT definition INTO config FROM public.standardized_assessment_forms WHERE assessment_id=ca.assessment_id;
    IF config IS NULL THEN CONTINUE; END IF;
    SELECT count(*),count(*) FILTER(WHERE factor_id::text IN (SELECT value->>'factorId' FROM jsonb_each(config->'facets'))) INTO total,valid
      FROM public.campaign_assessment_factors WHERE campaign_assessment_id=ca_id;
    IF total NOT IN(0,30) OR total<>valid THEN RAISE EXCEPTION 'IPIP-NEO-120 must be used as one complete assessment' USING ERRCODE='23514'; END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.guard_ipip_campaign_selection() FROM PUBLIC,anon,authenticated,service_role;
CREATE CONSTRAINT TRIGGER ipip_campaign_selection_guard AFTER INSERT OR UPDATE OR DELETE ON public.campaign_assessment_factors DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.guard_ipip_campaign_selection();
CREATE CONSTRAINT TRIGGER ipip_campaign_assessment_guard AFTER INSERT OR UPDATE ON public.campaign_assessments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.guard_ipip_campaign_selection();

ALTER TABLE public.assessments ADD CONSTRAINT ipip_profile_canonical_assessment CHECK (scoring_profile<>'ipip_neo_120_v1' OR id='741663b2-fbc1-56fe-a0ed-c9bb521e18b6'::uuid);
