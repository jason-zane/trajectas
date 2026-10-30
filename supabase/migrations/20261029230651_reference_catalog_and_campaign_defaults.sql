-- Expand only. Existing norm_groups/norm_tables and delivered reports retain meaning.
-- All new reference data is private to the service DAL; the DAL applies workspace scope.
CREATE TABLE public.norm_reference_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key text NOT NULL,
  name text NOT NULL CHECK (length(trim(name))>0),
  version text NOT NULL,
  instrument_id text NOT NULL,
  form_version text NOT NULL,
  scoring_version text NOT NULL,
  itemset_sha256 text NOT NULL CHECK (itemset_sha256 ~ '^[a-f0-9]{64}$'),
  method_version text NOT NULL,
  family text NOT NULL,
  scope_client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','active','superseded','withdrawn')),
  artifact_text text NOT NULL,
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  provenance jsonb NOT NULL,
  review_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_key,version),
  CONSTRAINT reference_artifact_hash CHECK (encode(sha256(convert_to(artifact_text,'UTF8')),'hex')=artifact_sha256),
  CONSTRAINT active_reference_reviewed CHECK (status NOT IN ('active','superseded') OR coalesce((
    review_evidence->>'datasetReuse'='approved' AND review_evidence->>'formEquivalence'='approved'
    AND review_evidence->>'methodology'='approved' AND review_evidence->>'stability'='approved'
    AND review_evidence->>'intendedUse'='approved' AND length(trim(review_evidence->>'evidence'))>=20
    AND review_evidence->>'reviewedBy' IS NOT NULL AND review_evidence->>'reviewedAt' IS NOT NULL),false))
);
CREATE INDEX norm_reference_contract_idx ON public.norm_reference_versions(instrument_id,form_version,scoring_version,status);
CREATE INDEX norm_reference_scope_idx ON public.norm_reference_versions(scope_client_id);
CREATE TABLE public.assessment_norm_references (
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  reference_version_id uuid NOT NULL REFERENCES public.norm_reference_versions(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  PRIMARY KEY(assessment_id,reference_version_id)
);
CREATE UNIQUE INDEX assessment_one_reference_default ON public.assessment_norm_references(assessment_id) WHERE is_default;
ALTER TABLE public.campaign_assessments ADD COLUMN reference_version_id uuid REFERENCES public.norm_reference_versions(id) ON DELETE RESTRICT;
CREATE INDEX campaign_assessment_reference_idx ON public.campaign_assessments(reference_version_id);
ALTER TABLE public.report_snapshots
  ADD COLUMN edition_number integer NOT NULL DEFAULT 1 CHECK (edition_number>=1),
  ADD COLUMN parent_snapshot_id uuid REFERENCES public.report_snapshots(id) ON DELETE SET NULL,
  ADD COLUMN reference_version_id uuid REFERENCES public.norm_reference_versions(id) ON DELETE RESTRICT,
  ADD COLUMN generation_request_id uuid,
  ADD COLUMN generation_intent text NOT NULL DEFAULT 'completion_default' CHECK (generation_intent IN ('completion_default','manager_requested')),
  ADD COLUMN generation_manifest jsonb,
  ADD COLUMN reference_interpretation jsonb,
  ADD COLUMN participant_selected boolean NOT NULL DEFAULT true;
ALTER TABLE public.report_snapshots ADD CONSTRAINT report_snapshots_session_template_edition_unique UNIQUE(participant_session_id,template_id,edition_number);
CREATE UNIQUE INDEX report_generation_request_unique ON public.report_snapshots(generation_request_id) WHERE generation_request_id IS NOT NULL;
-- The old (session,template) constraint remains until the explicit contract migration.
CREATE TABLE public.norm_reporting_capabilities (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), editions_enabled boolean NOT NULL DEFAULT false);
INSERT INTO public.norm_reporting_capabilities(singleton) VALUES(true);

ALTER TABLE public.norm_reference_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_norm_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.norm_reporting_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.norm_reference_versions,public.assessment_norm_references,public.norm_reporting_capabilities FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.norm_reference_versions,public.assessment_norm_references TO service_role;
GRANT SELECT ON public.norm_reporting_capabilities TO service_role;
CREATE POLICY reference_service ON public.norm_reference_versions FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE POLICY reference_assignment_service ON public.assessment_norm_references FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE POLICY reference_capability_service ON public.norm_reporting_capabilities FOR SELECT TO service_role USING(true);

CREATE OR REPLACE FUNCTION private.guard_reference_version() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF (to_jsonb(NEW)-ARRAY['status','review_evidence','updated_at']) IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['status','review_evidence','updated_at']) THEN
    RAISE EXCEPTION 'A changed reference requires a new immutable version';
  END IF;
  IF OLD.status IN ('active','superseded','withdrawn') AND NEW.review_evidence IS DISTINCT FROM OLD.review_evidence THEN
    RAISE EXCEPTION 'Published reference evidence is immutable';
  END IF;
  IF OLD.status='withdrawn' AND NEW.status<>'withdrawn' THEN RAISE EXCEPTION 'A withdrawn version cannot be reactivated'; END IF;
  IF OLD.status='active' AND NEW.status NOT IN ('active','superseded','withdrawn') THEN RAISE EXCEPTION 'An active reference cannot return to draft review'; END IF;
  IF OLD.status='superseded' AND NEW.status NOT IN ('superseded','withdrawn') THEN RAISE EXCEPTION 'Create a new version to replace a superseded reference'; END IF;
  NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER reference_version_immutable BEFORE UPDATE ON public.norm_reference_versions FOR EACH ROW EXECUTE FUNCTION private.guard_reference_version();

-- Internal validation: explicit compatibility, source scoring contract and client scope.
CREATE OR REPLACE FUNCTION private.assert_assessment_reference(p_assessment uuid,p_reference uuid,p_client uuid,p_allow_superseded boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE ref public.norm_reference_versions; form public.standardized_assessment_forms;
BEGIN
 IF p_reference IS NULL THEN RETURN; END IF;
 SELECT * INTO ref FROM public.norm_reference_versions WHERE id=p_reference;
 IF NOT FOUND OR NOT (ref.status='active' OR (p_allow_superseded AND ref.status='superseded')) THEN
   RAISE EXCEPTION 'Reference is not approved for this use';
 END IF;
 IF ref.scope_client_id IS NOT NULL AND ref.scope_client_id IS DISTINCT FROM p_client THEN RAISE EXCEPTION 'Reference is outside the campaign client scope'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.assessment_norm_references WHERE assessment_id=p_assessment AND reference_version_id=p_reference) THEN RAISE EXCEPTION 'Reference is incompatible with this assessment'; END IF;
 SELECT * INTO form FROM public.standardized_assessment_forms WHERE assessment_id=p_assessment;
 IF NOT FOUND OR form.instrument_id IS DISTINCT FROM ref.instrument_id OR form.definition->>'formVersion' IS DISTINCT FROM ref.form_version OR form.definition->>'itemsetSha256' IS DISTINCT FROM ref.itemset_sha256
   OR ref.instrument_id<>'ipip-neo-120-johnson-2014' OR ref.scoring_version<>'ipip-neo-120-raw-v1'
   OR ref.method_version<>'weighted-empirical-midrank-v1' THEN
   RAISE EXCEPTION 'No approved reference adapter for this measurement contract';
 END IF;
END $$;

CREATE OR REPLACE FUNCTION private.guard_campaign_reference() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE campaign public.campaigns;
BEGIN
 IF TG_OP='UPDATE' AND NEW.reference_version_id IS NOT DISTINCT FROM OLD.reference_version_id AND NEW.assessment_id=OLD.assessment_id AND NEW.campaign_id=OLD.campaign_id THEN RETURN NEW; END IF;
 SELECT * INTO campaign FROM public.campaigns WHERE id=NEW.campaign_id FOR UPDATE;
 IF campaign.status<>'draft' OR EXISTS(SELECT 1 FROM public.participant_sessions WHERE campaign_id=NEW.campaign_id) THEN
  IF NEW.reference_version_id IS NOT NULL OR (TG_OP='UPDATE' AND OLD.reference_version_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Campaign references are frozen after launch or the first assessment attempt';
  END IF;
 END IF;
 PERFORM private.assert_assessment_reference(NEW.assessment_id,NEW.reference_version_id,campaign.client_id);
 RETURN NEW;
END $$;
CREATE TRIGGER campaign_reference_guard BEFORE INSERT OR UPDATE OF reference_version_id,assessment_id,campaign_id ON public.campaign_assessments FOR EACH ROW EXECUTE FUNCTION private.guard_campaign_reference();

CREATE OR REPLACE FUNCTION public.set_assessment_reference_default(p_assessment_id uuid,p_reference_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE owner_client uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_assessment_id::text,841));
 SELECT client_id INTO owner_client FROM public.assessments WHERE id=p_assessment_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assessment not found'; END IF;
 PERFORM private.assert_assessment_reference(p_assessment_id,p_reference_id,owner_client);
 UPDATE public.assessment_norm_references SET is_default=false WHERE assessment_id=p_assessment_id AND is_default;
 IF p_reference_id IS NOT NULL THEN UPDATE public.assessment_norm_references SET is_default=true WHERE assessment_id=p_assessment_id AND reference_version_id=p_reference_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_assessment_reference_default(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_assessment_reference_default(uuid,uuid) TO service_role;

-- New manifests and completed interpretation payloads are frozen. Operational job
-- state, delivery timestamps and PDF bookkeeping can still progress normally.
CREATE OR REPLACE FUNCTION private.guard_reference_report() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.generation_manifest IS NOT NULL THEN
  IF NEW.generation_manifest IS DISTINCT FROM OLD.generation_manifest OR NEW.reference_version_id IS DISTINCT FROM OLD.reference_version_id
    OR NEW.reference_interpretation IS DISTINCT FROM OLD.reference_interpretation OR NEW.edition_number<>OLD.edition_number
    OR NEW.template_id<>OLD.template_id OR NEW.participant_session_id<>OLD.participant_session_id OR NEW.generation_request_id IS DISTINCT FROM OLD.generation_request_id
    OR NEW.generation_intent<>OLD.generation_intent THEN RAISE EXCEPTION 'Report interpretation and request identity are immutable'; END IF;
  IF OLD.status IN ('ready','released') AND (NEW.rendered_data IS DISTINCT FROM OLD.rendered_data OR NEW.status NOT IN ('ready','released') OR NEW.generated_at IS DISTINCT FROM OLD.generated_at) THEN
   RAISE EXCEPTION 'Create another report edition to change a completed interpretation';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reference_report_immutable BEFORE UPDATE ON public.report_snapshots FOR EACH ROW EXECUTE FUNCTION private.guard_reference_report();

-- Computation stays on saved native totals; no participant score rows are re-normed.
CREATE OR REPLACE FUNCTION private.build_reference_interpretation(p_native jsonb,p_reference uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE ref public.norm_reference_versions; cohort jsonb; scale record; bin record;
 native_stats jsonb; scale_data jsonb; raw integer; lo integer; lower_mass numeric;
 equal_mass numeric; upper_mass numeric; total_mass numeric; result jsonb:='{}'::jsonb; reversed boolean;
BEGIN
 SELECT * INTO STRICT ref FROM public.norm_reference_versions WHERE id=p_reference;
 cohort:=ref.artifact_text::jsonb;
 IF p_native->>'instrumentId' IS DISTINCT FROM ref.instrument_id OR p_native->>'formVersion' IS DISTINCT FROM ref.form_version
 OR p_native->>'scoringVersion' IS DISTINCT FROM ref.scoring_version OR p_native->>'itemsetSha256' IS DISTINCT FROM ref.itemset_sha256
 OR p_native->>'responseCount' IS DISTINCT FROM '120' OR (SELECT count(*) FROM jsonb_object_keys(p_native->'facets'))<>30 THEN
  RAISE EXCEPTION 'Native result does not match reference contract';
 END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(cohort->'nativeScoreMass'))<>35 THEN RAISE EXCEPTION 'Reference needs all 35 scales'; END IF;
 FOR scale IN SELECT key,value FROM jsonb_each(cohort->'nativeScoreMass') LOOP
  IF scale.key !~ '^[NEOAC]([1-6])?$' THEN RAISE EXCEPTION 'Unknown native reference scale'; END IF;
  lo:=CASE WHEN length(scale.key)=1 THEN 24 ELSE 4 END;
  scale_data:=CASE WHEN lo=24 THEN p_native->'dimensions'->scale.key ELSE p_native->'facets'->scale.key END;
  native_stats:=scale_data->'native'; raw:=(native_stats->>'rawSum')::integer;
  IF raw IS NULL OR raw<lo OR raw>lo*5 OR (native_stats->>'itemsUsed')::integer IS DISTINCT FROM lo OR jsonb_array_length(scale.value) IS DISTINCT FROM lo*4+1 THEN RAISE EXCEPTION 'Invalid native/reference score range'; END IF;
  lower_mass:=0; equal_mass:=0; upper_mass:=0;
  FOR bin IN SELECT value::text::numeric AS mass,ordinality+lo-1 AS score FROM jsonb_array_elements(scale.value) WITH ORDINALITY LOOP
   IF bin.mass IS NULL OR bin.mass<0 THEN RAISE EXCEPTION 'Negative reference mass'; END IF;
   IF bin.score<raw THEN lower_mass:=lower_mass+bin.mass;
   ELSIF bin.score=raw THEN equal_mass:=bin.mass; ELSE upper_mass:=upper_mass+bin.mass; END IF;
  END LOOP;
  total_mass:=lower_mass+equal_mass+upper_mass;
  IF abs(total_mass-1)>0.000000001 THEN RAISE EXCEPTION 'Reference masses must sum to one'; END IF;
  reversed:=scale.key IN ('N4','N6');
  result:=result||jsonb_build_object(scale.key,jsonb_build_object(
   'nativeRawSum',raw,'displayPomp',(scale_data->'display'->>'pomp')::numeric,
   'displayName',scale_data->>'displayName','scientificName',scale_data->>'scientificName','direction',scale_data->>'direction',
   'nativePercentile',100*(lower_mass+equal_mass/2)/total_mass,
   'displayPercentile',100*((CASE WHEN reversed THEN upper_mass ELSE lower_mass END)+equal_mass/2)/total_mass,
   'tiedPercent',100*equal_mass/total_mass));
 END LOOP;
 RETURN jsonb_build_object('schemaVersion','reference-interpretation-v1','scores',result,'reference',jsonb_build_object(
  'id',ref.id,'name',ref.name,'version',ref.version,'groupKey',ref.group_key,'methodVersion',ref.method_version,
  'artifactSha256',ref.artifact_sha256,'rawN',cohort->'rawN','effectiveN',cohort->'kishEffectiveN',
  'ageBoundsInclusive',cohort->'ageBoundsInclusive','countryLabels',cohort->'countryLabels','weighting',cohort->'weighting',
  'provenance',ref.provenance));
END $$;

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
 IF tpl.custom_report_slug IS DISTINCT FROM 'ipip-reference-comparison' THEN RAISE EXCEPTION 'This report template does not support reference comparisons'; END IF;
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

CREATE OR REPLACE FUNCTION public.select_participant_report_edition(p_snapshot_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE chosen public.report_snapshots;
BEGIN
 SELECT * INTO chosen FROM public.report_snapshots WHERE id=p_snapshot_id;
 IF NOT FOUND OR chosen.status<>'released' THEN RAISE EXCEPTION 'Only a released report can be selected'; END IF;
 IF EXISTS(SELECT 1 FROM public.campaigns WHERE id=chosen.campaign_id AND confidentiality_mode='aggregate_only') THEN RAISE EXCEPTION 'Individual report access is unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(chosen.participant_session_id::text||chosen.template_id::text,842));
 UPDATE public.report_snapshots SET participant_selected=false WHERE participant_session_id=chosen.participant_session_id AND template_id=chosen.template_id AND participant_selected;
 UPDATE public.report_snapshots SET participant_selected=true WHERE id=p_snapshot_id;
END $$;
REVOKE ALL ON FUNCTION public.select_participant_report_edition(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.select_participant_report_edition(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_campaign_references(p_campaign_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE camp public.campaigns; link record;
BEGIN
 SELECT * INTO STRICT camp FROM public.campaigns WHERE id=p_campaign_id;
 FOR link IN SELECT * FROM public.campaign_assessments WHERE campaign_id=p_campaign_id AND deleted_at IS NULL AND reference_version_id IS NOT NULL LOOP
  PERFORM private.assert_assessment_reference(link.assessment_id,link.reference_version_id,camp.client_id,camp.status<>'draft');
  IF NOT EXISTS(SELECT 1 FROM public.report_templates t WHERE t.is_active AND t.deleted_at IS NULL AND t.custom_report_slug='ipip-reference-comparison'
    AND (EXISTS(SELECT 1 FROM public.campaign_report_templates c WHERE c.campaign_id=p_campaign_id AND c.template_id=t.id)
      OR EXISTS(SELECT 1 FROM public.assessment_report_templates a WHERE a.assessment_id=link.assessment_id AND a.template_id=t.id AND a.is_default))) THEN
   RAISE EXCEPTION 'Assign an active reference comparison report before launching a campaign with a reference';
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.validate_campaign_references(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_campaign_references(uuid) TO service_role;
