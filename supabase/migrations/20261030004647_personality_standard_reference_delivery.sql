-- Additive presentation settings and explicit standard-report reference support.
ALTER TABLE public.report_templates ADD COLUMN presentation_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(presentation_config)='object');

CREATE OR REPLACE FUNCTION public.enqueue_reference_report(
 p_session_id uuid,p_template_id uuid,p_reference_id uuid,p_request_id uuid,
 p_parent_snapshot_id uuid DEFAULT NULL,p_automatic boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE sess public.participant_sessions; camp public.campaigns; tpl public.report_templates;
 existing public.report_snapshots; campaign_ref uuid; native jsonb; interpretation jsonb;
 manifest jsonb; new_id uuid; revision integer; enabled boolean;
BEGIN
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'A generation request ID is required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id::text||p_template_id::text,842));
 SELECT * INTO existing FROM public.report_snapshots WHERE generation_request_id=p_request_id;
 IF FOUND THEN
  IF existing.participant_session_id<>p_session_id OR existing.template_id<>p_template_id OR existing.reference_version_id IS DISTINCT FROM p_reference_id
    OR existing.parent_snapshot_id IS DISTINCT FROM p_parent_snapshot_id OR (existing.generation_intent='completion_default') IS DISTINCT FROM p_automatic THEN
    RAISE EXCEPTION 'Generation request ID was already used for another report';
  END IF;
  RETURN existing.id;
 END IF;
 SELECT * INTO sess FROM public.participant_sessions WHERE id=p_session_id;
 IF NOT FOUND OR sess.status<>'completed' THEN RAISE EXCEPTION 'A completed assessment is required'; END IF;
 SELECT * INTO camp FROM public.campaigns WHERE id=sess.campaign_id;
 IF NOT FOUND OR camp.confidentiality_mode='aggregate_only' THEN RAISE EXCEPTION 'This campaign does not allow individual reports'; END IF;
 IF sess.client_id IS DISTINCT FROM camp.client_id THEN RAISE EXCEPTION 'Assessment attempt client does not match campaign'; END IF;
 SELECT reference_version_id INTO campaign_ref FROM public.campaign_assessments WHERE campaign_id=camp.id AND assessment_id=sess.assessment_id AND deleted_at IS NULL;
 IF p_automatic AND p_reference_id IS DISTINCT FROM campaign_ref THEN RAISE EXCEPTION 'Automatic report must use the pinned campaign reference'; END IF;
 PERFORM private.assert_assessment_reference(sess.assessment_id,p_reference_id,camp.client_id,p_reference_id IS NOT DISTINCT FROM campaign_ref);
 SELECT * INTO tpl FROM public.report_templates WHERE id=p_template_id AND is_active AND deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Report template is unavailable'; END IF;
 SELECT result INTO native FROM public.participant_instrument_results WHERE session_id=p_session_id AND assessment_id=sess.assessment_id;
 IF native IS NULL THEN RAISE EXCEPTION 'This assessment has no supported saved native reference result'; END IF;
 IF tpl.custom_report_slug IS NULL OR tpl.custom_report_slug NOT IN ('ipip-reference-comparison','trajectas-personality-standard-v1') THEN RAISE EXCEPTION 'This report template does not support reference comparisons'; END IF;
 IF tpl.custom_report_slug='trajectas-personality-standard-v1' AND p_reference_id IS NULL THEN RAISE EXCEPTION 'The standard percentile report requires a norm reference'; END IF;
 IF p_parent_snapshot_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.report_snapshots WHERE id=p_parent_snapshot_id AND participant_session_id=p_session_id) THEN RAISE EXCEPTION 'Parent report belongs to another assessment attempt'; END IF;
 IF p_automatic THEN
  SELECT id INTO new_id FROM public.report_snapshots WHERE participant_session_id=p_session_id AND template_id=p_template_id AND edition_number=1;
  IF FOUND THEN RETURN new_id; END IF;
  revision:=1;
 ELSE
  SELECT editions_enabled INTO enabled FROM public.norm_reporting_capabilities WHERE singleton;
  IF NOT coalesce(enabled,false) THEN RAISE EXCEPTION 'Additional report editions are not enabled for this database'; END IF;
  SELECT greatest(coalesce(max(edition_number),1),1)+1 INTO revision FROM public.report_snapshots WHERE participant_session_id=p_session_id AND template_id=p_template_id;
 END IF;
 IF p_reference_id IS NOT NULL THEN interpretation:=private.build_reference_interpretation(native,p_reference_id); END IF;
 manifest:=jsonb_build_object('schemaVersion','report-generation-manifest-v1','nativeResult',native,'template',to_jsonb(tpl),
  'sourceResultSha256',encode(sha256(convert_to(native::text,'UTF8')),'hex'),'assessmentId',sess.assessment_id,
  'referenceVersionId',p_reference_id,'automatic',p_automatic);
 INSERT INTO public.report_snapshots(campaign_id,participant_session_id,template_id,edition_number,parent_snapshot_id,
  reference_version_id,generation_request_id,generation_intent,generation_manifest,reference_interpretation,participant_selected,status,narrative_mode)
 VALUES(camp.id,p_session_id,p_template_id,revision,p_parent_snapshot_id,p_reference_id,p_request_id,
  CASE WHEN p_automatic THEN 'completion_default' ELSE 'manager_requested' END,manifest,interpretation,p_automatic,'pending','derived') RETURNING id INTO new_id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_reference_report(uuid,uuid,uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_reference_report(uuid,uuid,uuid,uuid,uuid,boolean) TO service_role;


CREATE OR REPLACE FUNCTION public.validate_campaign_references(p_campaign_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE camp public.campaigns; link record;
BEGIN
 SELECT * INTO STRICT camp FROM public.campaigns WHERE id=p_campaign_id;
 IF EXISTS(SELECT 1 FROM public.campaign_assessments ca JOIN public.report_templates t ON
   (EXISTS(SELECT 1 FROM public.campaign_report_templates ct WHERE ct.campaign_id=ca.campaign_id AND ct.template_id=t.id)
    OR EXISTS(SELECT 1 FROM public.assessment_report_templates atp WHERE atp.assessment_id=ca.assessment_id AND atp.template_id=t.id AND atp.is_default))
   WHERE ca.campaign_id=p_campaign_id AND ca.deleted_at IS NULL AND ca.assessment_id='741663b2-fbc1-56fe-a0ed-c9bb521e18b6'
    AND ca.reference_version_id IS NULL AND t.is_active AND t.deleted_at IS NULL AND t.custom_report_slug='trajectas-personality-standard-v1') THEN
   RAISE EXCEPTION 'Choose a norm reference before launching the standard percentile report';
 END IF;
 FOR link IN SELECT * FROM public.campaign_assessments WHERE campaign_id=p_campaign_id AND deleted_at IS NULL AND reference_version_id IS NOT NULL LOOP
  PERFORM private.assert_assessment_reference(link.assessment_id,link.reference_version_id,camp.client_id,camp.status<>'draft');
  IF NOT EXISTS(SELECT 1 FROM public.report_templates t WHERE t.is_active AND t.deleted_at IS NULL AND t.custom_report_slug IN ('ipip-reference-comparison','trajectas-personality-standard-v1')
    AND (EXISTS(SELECT 1 FROM public.campaign_report_templates c WHERE c.campaign_id=p_campaign_id AND c.template_id=t.id)
      OR EXISTS(SELECT 1 FROM public.assessment_report_templates a WHERE a.assessment_id=link.assessment_id AND a.template_id=t.id AND a.is_default))) THEN
   RAISE EXCEPTION 'Assign an active reference comparison report before launching a campaign with a reference';
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.validate_campaign_references(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_campaign_references(uuid) TO service_role;

-- Registration only. Activation/assignment is an explicit environment setup step.
INSERT INTO public.report_templates(id,name,custom_report_slug,is_active,is_default,auto_release,blocks)
VALUES('238694bb-3e60-5fee-a558-2cdde1464bb5','Trajectas Personality Profile - Standard report','trajectas-personality-standard-v1',false,false,false,'[]'::jsonb)
ON CONFLICT(id) DO NOTHING;
