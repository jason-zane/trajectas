-- Repair functions whose search_path was set to the quoted string "public, pg_catalog"
-- (one schema name with a literal comma inside) instead of the list public, pg_catalog.
-- That left `public` out of the resolved search path, so is_platform_admin() and the
-- other affected functions errored with 42P01 (e.g. relation "profiles" does not exist),
-- which cascaded into every RLS-protected SELECT on the app.
ALTER FUNCTION public.activate_ai_system_prompt(p_purpose ai_prompt_purpose, p_name text, p_content text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.auth_user_role() SET search_path = public, pg_catalog;
ALTER FUNCTION public.brand_configs_set_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.create_report_snapshots_on_completion() SET search_path = public, pg_catalog;
ALTER FUNCTION public.experience_templates_set_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_assessment_quota_usage(p_client_id uuid, p_assessment_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_client_assessment_quota_usage_bulk(p_client_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_partner_assessment_quota_usage(p_partner_id uuid, p_assessment_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_partner_assessment_quota_usage_bulk(p_partner_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.increment_access_link_usage(p_link_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.is_platform_admin() SET search_path = public, pg_catalog;
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_catalog;
