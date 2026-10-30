-- A refresh is a new draft, atomically assigned to the same assessments.
-- Old campaign defaults, report snapshots, distributions and approvals remain.
CREATE FUNCTION public.create_norm_reference_version(
  p_prior_id uuid,p_id uuid,p_version text,p_artifact text,p_hash text,p_provenance jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE prior public.norm_reference_versions; existing public.norm_reference_versions; artifact jsonb;
BEGIN
  SELECT * INTO STRICT prior FROM public.norm_reference_versions WHERE id=p_prior_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(prior.group_key,0));
  SELECT * INTO existing FROM public.norm_reference_versions WHERE id=p_id;
  IF FOUND THEN
    IF existing.group_key<>prior.group_key OR existing.version<>p_version OR existing.artifact_sha256<>p_hash
      OR (existing.provenance-ARRAY['preparedAt']) IS DISTINCT FROM (p_provenance-ARRAY['preparedAt']) THEN
      RAISE EXCEPTION 'This version request has already been used';
    END IF;
    RETURN existing.id;
  END IF;
  artifact:=p_artifact::jsonb;
  IF char_length(btrim(p_version)) NOT BETWEEN 1 AND 100 OR p_version=prior.version
    OR p_provenance->>'previousVersionId' IS DISTINCT FROM p_prior_id::text
    OR artifact->'id' IS DISTINCT FROM prior.artifact_text::jsonb->'id'
    OR artifact->'ageBoundsInclusive' IS DISTINCT FROM prior.artifact_text::jsonb->'ageBoundsInclusive'
    OR artifact->'countryLabels' IS DISTINCT FROM prior.artifact_text::jsonb->'countryLabels'
    OR artifact->'weighting' IS DISTINCT FROM prior.artifact_text::jsonb->'weighting' THEN
    RAISE EXCEPTION 'A refresh must preserve the population definition and use a new version';
  END IF;
  INSERT INTO public.norm_reference_versions(id,group_key,name,version,instrument_id,form_version,scoring_version,itemset_sha256,method_version,family,scope_client_id,artifact_text,artifact_sha256,provenance,status)
    VALUES(p_id,prior.group_key,prior.name,p_version,prior.instrument_id,prior.form_version,prior.scoring_version,prior.itemset_sha256,prior.method_version,prior.family,prior.scope_client_id,p_artifact,p_hash,p_provenance,'draft');
  INSERT INTO public.assessment_norm_references(assessment_id,reference_version_id,is_default)
    SELECT assessment_id,p_id,false FROM public.assessment_norm_references WHERE reference_version_id=p_prior_id;
  RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.create_norm_reference_version(uuid,uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_norm_reference_version(uuid,uuid,text,text,text,jsonb) TO service_role;
