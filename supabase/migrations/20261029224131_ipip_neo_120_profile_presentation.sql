-- Catalogue presentation and owner-requested activation. The scientific form,
-- scoring/label versions, item hashes, response options and stored results stay fixed.
-- Only the migration owner can update the binding; application grants are unchanged.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('ipip-neo-120-import-v1', 0));
DO $presentation$
DECLARE
  aid constant uuid := '741663b2-fbc1-56fe-a0ed-c9bb521e18b6';
  config jsonb;
  tbl text;
  expected jsonb;
  changed jsonb;
BEGIN
  config := public.get_ipip_neo_120_delivery(aid, NULL);
  IF config->>'itemsetSha256' <> '0a1c55b136a3a6021cfaeb210931b61d19f4e0d5ced7787c6daf3228cfdd50e6'
    OR config->>'scoringVersion' <> 'ipip-neo-120-raw-v1'
    OR config->>'presentationVersion' <> 'trajectas-personality-labels-v1' THEN
    RAISE EXCEPTION 'Unexpected personality form version';
  END IF;

  config := jsonb_set(config, '{cataloguePresentationVersion}', '"trajectas-personality-profile-catalogue-v1"');
  config := jsonb_set(config, '{activationReady}', 'true');
  SELECT jsonb_agg(value || jsonb_build_object(
    'title', 'Trajectas Personality Profile',
    'description', 'A complete 120-item self-report personality profile based on IPIP-NEO-120 (Johnson, 2014), describing five dimensions and 30 traits. Results use 0–100 scale scores with native totals retained.',
    'status', 'active')) INTO changed FROM jsonb_array_elements(config->'rows'->'assessments');
  config := jsonb_set(config, '{rows,assessments}', changed);

  FOREACH tbl IN ARRAY ARRAY['dimensions', 'constructs', 'factors'] LOOP
    SELECT jsonb_agg(value || jsonb_build_object('description', regexp_replace(value->>'description', '^[NEOAC][1-6]? — ', '')))
      INTO changed FROM jsonb_array_elements(config->'rows'->tbl);
    config := jsonb_set(config, ARRAY['rows', tbl], changed);
  END LOOP;

  -- Atomic owner-only rebinding of presentation metadata. Re-enable before any
  -- content updates so the normal exact-content guards validate every row.
  ALTER TABLE public.standardized_assessment_forms DISABLE TRIGGER standardized_definition_immutable;
  UPDATE public.standardized_assessment_forms SET definition=config, activation_ready=true WHERE assessment_id=aid;
  ALTER TABLE public.standardized_assessment_forms ENABLE TRIGGER standardized_definition_immutable;

  FOREACH tbl IN ARRAY ARRAY['dimensions', 'constructs', 'factors'] LOOP
    FOR expected IN SELECT value FROM jsonb_array_elements(config->'rows'->tbl) LOOP
      EXECUTE format('UPDATE public.%I SET description=$1 WHERE id=$2', tbl)
        USING expected->>'description', (expected->>'id')::uuid;
    END LOOP;
  END LOOP;
  expected := config->'rows'->'assessments'->0;
  UPDATE public.assessments SET title=expected->>'title', description=expected->>'description', status='active' WHERE id=aid;
  PERFORM public.get_ipip_neo_120_delivery(aid, NULL);
END $presentation$;
COMMIT;
