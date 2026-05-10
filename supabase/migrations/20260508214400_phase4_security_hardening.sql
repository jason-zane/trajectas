-- Phase 4 — production database security hardening
-- Applied to production rwpfwfcaxoevnvtkdmkx via Supabase MCP on
-- 2026-05-09 (per audits/2026-05-09-routine-cleanup-plan.md).
-- Resolves 38 of 51 Supabase security advisor findings:
--   - 5 rls_enabled_no_policy            -> 0
--   - 12 function_search_path_mutable    -> 0
--   - 1  extension_in_public             -> 0
--   - 11 anon_security_definer_executable -> 0
--   - 3  rls_policy_always_true          -> 0
--   - 6  redundant 'authenticated' permissive policies dropped
-- 13 findings remain by design (12 authenticated_security_definer
-- helpers needed for RLS, 1 leaked-password-protection toggled in
-- the Auth dashboard).

-- =====================================================================
-- 4.1 — RLS policies for tables flagged 'RLS enabled, no policy'.
-- All five are accessed exclusively via the service-role admin client;
-- explicit service_role-only policy preserves current behaviour.
-- =====================================================================

CREATE POLICY "service_role full access" ON public.contact_submissions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role full access" ON public.generated_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role full access" ON public.generation_run_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role full access" ON public.generation_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role full access" ON public.platform_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- 4.2 — drop USING(true) policies on campaign_report_templates that
-- effectively bypassed RLS for any authenticated user. All access goes
-- through the service-role admin client; the existing
-- 'Service role full access' policy covers every operation.
-- =====================================================================

DROP POLICY IF EXISTS "Authenticated users can read campaign_report_templates"
  ON public.campaign_report_templates;
DROP POLICY IF EXISTS "Authenticated users can insert campaign_report_templates"
  ON public.campaign_report_templates;
DROP POLICY IF EXISTS "Authenticated users can update campaign_report_templates"
  ON public.campaign_report_templates;
DROP POLICY IF EXISTS "Authenticated users can delete campaign_report_templates"
  ON public.campaign_report_templates;

-- =====================================================================
-- 4.3 — revoke EXECUTE from PUBLIC on SECURITY DEFINER helper functions.
-- These helpers are intended to be called inside RLS policies (where
-- they evaluate the caller's scope). PUBLIC is inherited by all roles
-- including anon, so REVOKE FROM PUBLIC closes the actual surface.
-- 'authenticated' retains an explicit grant so RLS continues to work
-- in their queries; the residual 12 advisor findings are accepted
-- (each function only returns the caller's own scope info).
-- =====================================================================

REVOKE EXECUTE ON FUNCTION public.auth_user_client_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_user_client_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_user_client_admin_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_user_partner_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_user_partner_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_user_partner_admin_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_partner_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_report_snapshots_on_completion() FROM PUBLIC;
-- rls_auto_enable() is not created by any earlier repo migration; guard the
-- REVOKE so a fresh `supabase db reset` doesn't abort here when the function
-- is absent. In production it was created out-of-band and was successfully
-- locked down at the time this migration was applied.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC';
  END IF;
END $$;

-- Also revoke direct anon grants (idempotent — succeeds even if grant
-- never existed; covers a cleaner state for new environments).
REVOKE EXECUTE ON FUNCTION public.auth_user_client_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_client_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_client_admin_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_partner_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_partner_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_partner_admin_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_partner_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_report_snapshots_on_completion() FROM anon;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon';
  END IF;
END $$;

-- =====================================================================
-- 4.4 — pin search_path on functions flagged
-- 0011_function_search_path_mutable. Every function body uses unqualified
-- names from public (e.g. profiles, ai_system_prompts) and pg_catalog
-- (now(), COALESCE, etc.), so 'public, pg_catalog' is the smallest
-- pin that works without changing function bodies.
-- =====================================================================

ALTER FUNCTION public.brand_configs_set_updated_at() SET search_path = 'public, pg_catalog';
ALTER FUNCTION public.experience_templates_set_updated_at() SET search_path = 'public, pg_catalog';
ALTER FUNCTION public.activate_ai_system_prompt(p_purpose ai_prompt_purpose, p_name text, p_content text) SET search_path = 'public, pg_catalog';
ALTER FUNCTION public.set_updated_at() SET search_path = 'public, pg_catalog';
ALTER FUNCTION public.get_client_assessment_quota_usage_bulk(p_client_id uuid) SET search_path = 'public, pg_catalog';
ALTER FUNCTION public.get_partner_assessment_quota_usage_bulk(p_partner_id uuid) SET search_path = 'public, pg_catalog';
ALTER FUNCTION public.create_report_snapshots_on_completion() SET search_path = 'public, pg_catalog';
ALTER FUNCTION public.get_assessment_quota_usage(p_client_id uuid, p_assessment_id uuid) SET search_path = 'public, pg_catalog';
ALTER FUNCTION public.increment_access_link_usage(p_link_id uuid) SET search_path = 'public, pg_catalog';
ALTER FUNCTION public.get_partner_assessment_quota_usage(p_partner_id uuid, p_assessment_id uuid) SET search_path = 'public, pg_catalog';
ALTER FUNCTION public.auth_user_role() SET search_path = 'public, pg_catalog';
ALTER FUNCTION public.is_platform_admin() SET search_path = 'public, pg_catalog';

-- =====================================================================
-- 4.5 — move citext extension out of public into the extensions schema,
-- matching where pgcrypto, uuid-ossp, and pg_stat_statements already
-- live. Existing column types continue to resolve by OID.
-- =====================================================================

ALTER EXTENSION citext SET SCHEMA extensions;
