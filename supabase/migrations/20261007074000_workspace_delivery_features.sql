BEGIN;
-- Additive compatibility defaults: no existing tenant rows or feature values are rewritten.
ALTER TABLE public.workspace_feature_settings
  ADD COLUMN module_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN change_origin text NOT NULL DEFAULT 'override';
DO $$ DECLARE constraint_name text; BEGIN
  SELECT conname INTO constraint_name FROM pg_constraint
  WHERE conrelid='public.workspace_feature_settings'::regclass AND contype='c'
    AND pg_get_constraintdef(oid) LIKE '%unified_trajectory_enabled%';
  IF constraint_name IS NOT NULL THEN EXECUTE format('ALTER TABLE public.workspace_feature_settings DROP CONSTRAINT %I',constraint_name); END IF;
END $$;
ALTER TABLE public.workspace_feature_settings ADD CONSTRAINT client_dashboard_style CHECK(client_id IS NULL OR dashboard_style <> 'portfolio');

-- Invoker functions keep the existing service-role-only mutation model.
CREATE FUNCTION private.workspace_feature_configuration(row_value public.workspace_feature_settings)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
  SELECT '{"compare":true,"trajectory":true,"unifiedTrajectory":true,"assessmentLibrary":true,"assessmentDelivery":true,"assessmentAuthoring":true,"assessmentPublishing":true,"campaignViewing":true,"campaignManagement":true,"participantInvitations":true,"reportViewing":true,"reportGeneration":true,"reportTemplateLibrary":true,"reportTemplateAuthoring":true,"clientDirectory":true,"clientProvisioning":true,"clientManagement":true,"clientAssessmentAllocation":true,"clientTemplateAllocation":true,"usageVisibility":true,"feedback360":true,"participantExperience":true,"insightCsvExport":true,"reportDownload":true,"campaignBranding":true,"teamManagement":true,"personIdentityManagement":true,"orgDiagnostics":true,"roleMatching":true,"outcomeStudies":true,"outcomeReports":true,"integrationManagement":true,"integrationLaunches":true,"workspaceAssistant":true,"billingVisibility":true,"dashboardStyle":"default"}'::jsonb || CASE WHEN row_value.client_id IS NOT NULL THEN '{"clientDirectory":false,"clientProvisioning":false,"clientManagement":false,"clientAssessmentAllocation":false,"clientTemplateAllocation":false}'::jsonb ELSE '{}'::jsonb END
    || row_value.module_flags || jsonb_build_object('compare',row_value.compare_enabled,'trajectory',row_value.trajectory_enabled,
       'unifiedTrajectory',row_value.unified_trajectory_enabled,'dashboardStyle',row_value.dashboard_style)
$$;
REVOKE ALL ON FUNCTION private.workspace_feature_configuration(public.workspace_feature_settings) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.workspace_feature_configuration(public.workspace_feature_settings) TO service_role;

CREATE FUNCTION private.validate_workspace_feature_configuration(config jsonb, tenant_type text)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE k text; d text;
BEGIN
  IF jsonb_typeof(config) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(config)) <> 36 THEN RAISE EXCEPTION 'Invalid feature configuration'; END IF;
  FOR k IN SELECT jsonb_array_elements_text('["compare","trajectory","unifiedTrajectory","assessmentLibrary","assessmentDelivery","assessmentAuthoring","assessmentPublishing","campaignViewing","campaignManagement","participantInvitations","reportViewing","reportGeneration","reportTemplateLibrary","reportTemplateAuthoring","clientDirectory","clientProvisioning","clientManagement","clientAssessmentAllocation","clientTemplateAllocation","usageVisibility","feedback360","participantExperience","insightCsvExport","reportDownload","campaignBranding","teamManagement","personIdentityManagement","orgDiagnostics","roleMatching","outcomeStudies","outcomeReports","integrationManagement","integrationLaunches","workspaceAssistant","billingVisibility"]'::jsonb) LOOP
    IF jsonb_typeof(config->k) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid feature: %',k; END IF;
  END LOOP;
  IF jsonb_typeof(config->'dashboardStyle') IS DISTINCT FROM 'string' OR config->>'dashboardStyle' NOT IN ('default','operational','portfolio') THEN RAISE EXCEPTION 'Invalid dashboard'; END IF;
  IF tenant_type='client' THEN
    IF config->>'dashboardStyle'='portfolio' THEN RAISE EXCEPTION 'Portfolio dashboards require a partner'; END IF;
    FOR k IN SELECT jsonb_array_elements_text('["clientDirectory","clientProvisioning","clientManagement","clientAssessmentAllocation","clientTemplateAllocation"]'::jsonb) LOOP
      IF (config->>k)::boolean THEN RAISE EXCEPTION 'Partner feature unavailable: %',k; END IF;
    END LOOP;
  END IF;
  FOR k,d IN SELECT dep.key, jsonb_array_elements_text(dep.value) FROM jsonb_each('{"assessmentAuthoring":["assessmentLibrary"],"assessmentDelivery":["assessmentLibrary"],"assessmentPublishing":["assessmentAuthoring"],"feedback360":["campaignManagement","assessmentDelivery"],"integrationLaunches":["assessmentDelivery"],"reportTemplateAuthoring":["reportTemplateLibrary"],"clientProvisioning":["clientDirectory"],"clientManagement":["clientDirectory"],"clientAssessmentAllocation":["clientDirectory"],"clientTemplateAllocation":["clientDirectory"]}'::jsonb) dep LOOP
    IF (config->>k)::boolean AND NOT (config->>d)::boolean THEN RAISE EXCEPTION '% requires %',k,d; END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.validate_workspace_feature_configuration(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.validate_workspace_feature_configuration(jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION private.audit_workspace_feature_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous jsonb; next_config jsonb;
BEGIN
  next_config := private.workspace_feature_configuration(NEW);
  PERFORM private.validate_workspace_feature_configuration(next_config,CASE WHEN NEW.client_id IS NULL THEN 'partner' ELSE 'client' END);
  IF TG_OP='UPDATE' THEN
    previous := private.workspace_feature_configuration(OLD);
    IF previous=next_config AND OLD.change_origin=NEW.change_origin THEN RETURN NEW; END IF;
  ELSE
    previous := '{"compare":true,"trajectory":true,"unifiedTrajectory":true,"assessmentLibrary":true,"assessmentDelivery":true,"assessmentAuthoring":true,"assessmentPublishing":true,"campaignViewing":true,"campaignManagement":true,"participantInvitations":true,"reportViewing":true,"reportGeneration":true,"reportTemplateLibrary":true,"reportTemplateAuthoring":true,"clientDirectory":true,"clientProvisioning":true,"clientManagement":true,"clientAssessmentAllocation":true,"clientTemplateAllocation":true,"usageVisibility":true,"feedback360":true,"participantExperience":true,"insightCsvExport":true,"reportDownload":true,"campaignBranding":true,"teamManagement":true,"personIdentityManagement":true,"orgDiagnostics":true,"roleMatching":true,"outcomeStudies":true,"outcomeReports":true,"integrationManagement":true,"integrationLaunches":true,"workspaceAssistant":true,"billingVisibility":true,"dashboardStyle":"default"}'::jsonb || CASE WHEN NEW.client_id IS NOT NULL THEN '{"clientDirectory":false,"clientProvisioning":false,"clientManagement":false,"clientAssessmentAllocation":false,"clientTemplateAllocation":false}'::jsonb || '{"unifiedTrajectory":false}'::jsonb ELSE '{}'::jsonb END;
  END IF;
  NEW.updated_at := now();
  INSERT INTO public.audit_events(actor_profile_id,event_type,target_table,target_id,partner_id,client_id,metadata)
  VALUES(NEW.updated_by,'workspace.features_updated','workspace_feature_settings',NEW.id,NEW.partner_id,NEW.client_id,
    jsonb_build_object('previous',previous,'next',next_config,'origin',NEW.change_origin));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.audit_workspace_feature_settings() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.patch_workspace_features(p_tenant_type text,p_tenant_id uuid,p_actor uuid,p_patch jsonb,p_origin text DEFAULT 'override',p_expected jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE existing public.workspace_feature_settings; current_config jsonb; next_config jsonb; flags jsonb;
BEGIN
  IF p_tenant_type NOT IN ('partner','client') OR p_actor IS NULL OR p_patch IS NULL OR jsonb_typeof(p_patch)<>'object' THEN RAISE EXCEPTION 'Invalid feature request'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE NOT k=ANY(ARRAY['compare','trajectory','unifiedTrajectory','assessmentLibrary','assessmentDelivery','assessmentAuthoring','assessmentPublishing','campaignViewing','campaignManagement','participantInvitations','reportViewing','reportGeneration','reportTemplateLibrary','reportTemplateAuthoring','clientDirectory','clientProvisioning','clientManagement','clientAssessmentAllocation','clientTemplateAllocation','usageVisibility','feedback360','participantExperience','insightCsvExport','reportDownload','campaignBranding','teamManagement','personIdentityManagement','orgDiagnostics','roleMatching','outcomeStudies','outcomeReports','integrationManagement','integrationLaunches','workspaceAssistant','billingVisibility','dashboardStyle'])) THEN RAISE EXCEPTION 'Unknown feature'; END IF;
  -- Serializes first inserts and per-field patches without losing concurrent independent updates.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_type||':'||p_tenant_id::text,0));
  SELECT * INTO existing FROM public.workspace_feature_settings WHERE CASE WHEN p_tenant_type='partner' THEN partner_id=p_tenant_id ELSE client_id=p_tenant_id END FOR UPDATE;
  IF FOUND THEN current_config := private.workspace_feature_configuration(existing);
  ELSE current_config := '{"compare":true,"trajectory":true,"unifiedTrajectory":true,"assessmentLibrary":true,"assessmentDelivery":true,"assessmentAuthoring":true,"assessmentPublishing":true,"campaignViewing":true,"campaignManagement":true,"participantInvitations":true,"reportViewing":true,"reportGeneration":true,"reportTemplateLibrary":true,"reportTemplateAuthoring":true,"clientDirectory":true,"clientProvisioning":true,"clientManagement":true,"clientAssessmentAllocation":true,"clientTemplateAllocation":true,"usageVisibility":true,"feedback360":true,"participantExperience":true,"insightCsvExport":true,"reportDownload":true,"campaignBranding":true,"teamManagement":true,"personIdentityManagement":true,"orgDiagnostics":true,"roleMatching":true,"outcomeStudies":true,"outcomeReports":true,"integrationManagement":true,"integrationLaunches":true,"workspaceAssistant":true,"billingVisibility":true,"dashboardStyle":"default"}'::jsonb || CASE WHEN p_tenant_type='client' THEN '{"clientDirectory":false,"clientProvisioning":false,"clientManagement":false,"clientAssessmentAllocation":false,"clientTemplateAllocation":false}'::jsonb || '{"unifiedTrajectory":false}'::jsonb ELSE '{}'::jsonb END; END IF;
  IF p_expected IS NOT NULL AND p_expected IS DISTINCT FROM current_config THEN RAISE EXCEPTION 'Workspace features changed. Refresh and review the new diff.'; END IF;
  next_config := current_config || p_patch;
  PERFORM private.validate_workspace_feature_configuration(next_config,p_tenant_type);
  flags := next_config - ARRAY['compare','trajectory','unifiedTrajectory','dashboardStyle'];
  IF existing.id IS NULL THEN
    INSERT INTO public.workspace_feature_settings(client_id,partner_id,compare_enabled,trajectory_enabled,unified_trajectory_enabled,dashboard_style,module_flags,updated_by,change_origin)
    VALUES(CASE WHEN p_tenant_type='client' THEN p_tenant_id END,CASE WHEN p_tenant_type='partner' THEN p_tenant_id END,
      (next_config->>'compare')::boolean,(next_config->>'trajectory')::boolean,(next_config->>'unifiedTrajectory')::boolean,next_config->>'dashboardStyle',flags,p_actor,p_origin);
  ELSE
    UPDATE public.workspace_feature_settings SET compare_enabled=(next_config->>'compare')::boolean,trajectory_enabled=(next_config->>'trajectory')::boolean,
      unified_trajectory_enabled=(next_config->>'unifiedTrajectory')::boolean,dashboard_style=next_config->>'dashboardStyle',module_flags=flags,updated_by=p_actor,change_origin=p_origin WHERE id=existing.id;
  END IF;
  RETURN next_config;
END $$;
REVOKE ALL ON FUNCTION public.patch_workspace_features(text,uuid,uuid,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.patch_workspace_features(text,uuid,uuid,jsonb,text,jsonb) TO service_role;
-- New platform provisioning is atomic: failure leaves neither an organisation nor feature settings.
CREATE FUNCTION public.provision_workspace_with_features(p_tenant_type text,p_record jsonb,p_actor uuid,p_features jsonb,p_origin text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE tenant_id uuid;
BEGIN
  IF p_actor IS NULL OR p_record IS NULL OR p_tenant_type NOT IN ('client','partner') THEN RAISE EXCEPTION 'Invalid provisioning request'; END IF;
  PERFORM private.validate_workspace_feature_configuration(p_features,p_tenant_type);
  IF p_tenant_type='partner' THEN
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_record) k WHERE NOT k=ANY(ARRAY['name','slug','is_active'])) THEN RAISE EXCEPTION 'Invalid partner fields'; END IF;
    INSERT INTO public.partners(name,slug,is_active) VALUES(p_record->>'name',p_record->>'slug',(p_record->>'is_active')::boolean) RETURNING id INTO tenant_id;
  ELSE
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_record) k WHERE NOT k=ANY(ARRAY['name','slug','is_active','partner_id','industry','size_range'])) THEN RAISE EXCEPTION 'Invalid client fields'; END IF;
    INSERT INTO public.clients(name,slug,is_active,partner_id,industry,size_range)
    VALUES(p_record->>'name',p_record->>'slug',(p_record->>'is_active')::boolean,(p_record->>'partner_id')::uuid,p_record->>'industry',p_record->>'size_range') RETURNING id INTO tenant_id;
  END IF;
  PERFORM public.patch_workspace_features(p_tenant_type,tenant_id,p_actor,p_features,p_origin);
  RETURN tenant_id;
END $$;
REVOKE ALL ON FUNCTION public.provision_workspace_with_features(text,jsonb,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.provision_workspace_with_features(text,jsonb,uuid,jsonb,text) TO service_role;
COMMIT;
