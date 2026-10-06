BEGIN;
CREATE TABLE public.workspace_feature_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  partner_id uuid UNIQUE REFERENCES public.partners(id) ON DELETE CASCADE,
  compare_enabled boolean NOT NULL DEFAULT true,
  trajectory_enabled boolean NOT NULL DEFAULT true,
  unified_trajectory_enabled boolean NOT NULL DEFAULT false,
  dashboard_style text NOT NULL DEFAULT 'default' CHECK (dashboard_style IN ('default', 'operational', 'portfolio')),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(client_id, partner_id) = 1),
  CHECK (client_id IS NULL OR (NOT unified_trajectory_enabled AND dashboard_style <> 'portfolio'))
);
COMMENT ON TABLE public.workspace_feature_settings IS 'Trajectas-controlled feature availability and dashboard presentation. No row preserves the existing portal defaults. Does not replace tenant access, staff roles, or content allocations.';
CREATE INDEX workspace_feature_settings_updated_by_idx ON public.workspace_feature_settings(updated_by);
ALTER TABLE public.workspace_feature_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_feature_settings FROM anon, authenticated;
GRANT SELECT ON public.workspace_feature_settings TO authenticated;
GRANT ALL ON public.workspace_feature_settings TO service_role;
CREATE POLICY workspace_features_select ON public.workspace_feature_settings FOR SELECT TO authenticated
USING (public.is_unconfined_platform_admin() OR client_id = ANY(public.auth_user_client_ids()) OR partner_id = ANY(public.auth_user_partner_ids()));
CREATE OR REPLACE FUNCTION private.audit_workspace_feature_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE previous jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.compare_enabled,NEW.trajectory_enabled,NEW.unified_trajectory_enabled,NEW.dashboard_style)
       IS NOT DISTINCT FROM ROW(OLD.compare_enabled,OLD.trajectory_enabled,OLD.unified_trajectory_enabled,OLD.dashboard_style) THEN RETURN NEW; END IF;
    previous := jsonb_build_object('compare',OLD.compare_enabled,'trajectory',OLD.trajectory_enabled,'unifiedTrajectory',OLD.unified_trajectory_enabled,'dashboardStyle',OLD.dashboard_style);
  END IF;
  NEW.updated_at := now();
  INSERT INTO public.audit_events(actor_profile_id,event_type,target_table,target_id,partner_id,client_id,metadata)
  VALUES(NEW.updated_by,'workspace.features_updated','workspace_feature_settings',NEW.id,NEW.partner_id,NEW.client_id,
    jsonb_build_object('previous',previous,'next',jsonb_build_object('compare',NEW.compare_enabled,'trajectory',NEW.trajectory_enabled,'unifiedTrajectory',NEW.unified_trajectory_enabled,'dashboardStyle',NEW.dashboard_style)));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_workspace_feature_settings() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER workspace_feature_settings_audit BEFORE INSERT OR UPDATE ON public.workspace_feature_settings
FOR EACH ROW EXECUTE FUNCTION private.audit_workspace_feature_settings();
COMMIT;
