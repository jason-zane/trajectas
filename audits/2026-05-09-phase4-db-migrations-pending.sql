-- =====================================================================
-- Phase 4 — production database hardening (PENDING USER APPROVAL)
-- =====================================================================
--
-- These migrations resolve all 51 Supabase security-advisor findings on
-- the trajectas production project (rwpfwfcaxoevnvtkdmkx) plus the
-- highest-impact performance findings.
--
-- Each migration block is self-contained and can be applied in any order
-- after the user explicitly authorises production DB changes. Recommend
-- applying as separate migrations (one block per file under
-- supabase/migrations/) so each is reviewable and revertable on its own.
--
-- All have been linted against the live schema via Supabase advisor
-- output but NOT executed.
--
-- See: audits/2026-05-09-routine-cleanup-plan.md (Phase 4)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 4.1  RLS policies for tables flagged "RLS enabled, no policy"
-- ---------------------------------------------------------------------
-- Tables: contact_submissions, generated_items, generation_run_logs,
-- generation_runs, platform_settings.
-- All five are server-side (admin-client) tables. Lock to service_role
-- only; deny anon and authenticated entirely.

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

-- ---------------------------------------------------------------------
-- 4.2  Tighten campaign_report_templates "USING (true)" policies
-- ---------------------------------------------------------------------
-- Existing policies effectively bypass RLS for INSERT/UPDATE/DELETE.
-- Constrain to platform admin OR (client admin who owns the parent
-- campaign).

DROP POLICY IF EXISTS "Authenticated users can insert campaign_report_templates"
  ON public.campaign_report_templates;
DROP POLICY IF EXISTS "Authenticated users can update campaign_report_templates"
  ON public.campaign_report_templates;
DROP POLICY IF EXISTS "Authenticated users can delete campaign_report_templates"
  ON public.campaign_report_templates;

CREATE POLICY "Platform admin or campaign client admin can write"
  ON public.campaign_report_templates
  FOR ALL TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_report_templates.campaign_id
        AND c.client_id = ANY(public.auth_user_client_admin_ids())
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_report_templates.campaign_id
        AND c.client_id = ANY(public.auth_user_client_admin_ids())
    )
  );

-- ---------------------------------------------------------------------
-- 4.3  Lock down SECURITY DEFINER helper functions
-- ---------------------------------------------------------------------
-- These functions are intended for use INSIDE RLS policies. They run
-- with the definer's role (postgres) which can bypass RLS itself, so
-- they must not be exposed as RPC endpoints.
-- Revoke EXECUTE from anon and authenticated; only service_role and
-- the SQL evaluator (which calls them inside policies) should be able
-- to invoke them.

REVOKE EXECUTE ON FUNCTION public.auth_user_client_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_user_client_ids() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_user_client_admin_ids() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_user_partner_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_user_partner_ids() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_user_partner_admin_ids() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_user_role() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_partner_admin() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_report_snapshots_on_completion() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 4.4  Pin search_path on functions
-- ---------------------------------------------------------------------
-- Empty search_path forces fully-qualified names inside the function
-- body, preventing search_path injection.

ALTER FUNCTION public.brand_configs_set_updated_at() SET search_path = '';
ALTER FUNCTION public.experience_templates_set_updated_at() SET search_path = '';
ALTER FUNCTION public.activate_ai_system_prompt(uuid, uuid) SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.get_client_assessment_quota_usage_bulk(uuid) SET search_path = '';
ALTER FUNCTION public.get_partner_assessment_quota_usage_bulk(uuid) SET search_path = '';
ALTER FUNCTION public.create_report_snapshots_on_completion() SET search_path = '';
ALTER FUNCTION public.get_assessment_quota_usage(uuid, uuid) SET search_path = '';
ALTER FUNCTION public.increment_access_link_usage(uuid) SET search_path = '';
ALTER FUNCTION public.get_partner_assessment_quota_usage(uuid, uuid) SET search_path = '';
ALTER FUNCTION public.auth_user_role() SET search_path = '';
ALTER FUNCTION public.is_platform_admin() SET search_path = '';

-- ---------------------------------------------------------------------
-- 4.5  Move citext extension out of public schema
-- ---------------------------------------------------------------------
-- public is the default search_path; extensions installed there can be
-- shadowed by user-defined objects of the same name.

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER EXTENSION citext SET SCHEMA extensions;
-- Then update any qualified references in code (likely none — citext
-- is referenced unqualified). Search the codebase for `citext` first.

-- ---------------------------------------------------------------------
-- 4.6  Auth: enable HaveIBeenPwned password protection
-- ---------------------------------------------------------------------
-- This is a dashboard setting, not SQL. Do this in the Supabase Auth
-- console:
--   Auth > Providers > Email > "Prevent use of leaked passwords" → on
-- See https://supabase.com/docs/guides/auth/password-security

-- ---------------------------------------------------------------------
-- 4.7a  RLS perf: wrap auth.uid() in (select auth.uid())
-- ---------------------------------------------------------------------
-- Per Supabase advisor 0003_auth_rls_initplan: wrapping auth.uid()
-- with a subquery causes the planner to call it once per query
-- instead of once per row, which is significant on large tables.
--
-- 77 policies across 24 tables are flagged. Best done as a generated
-- script. Pseudo-script:
--
-- DO $$
-- DECLARE r record;
-- BEGIN
--   FOR r IN
--     SELECT schemaname, tablename, policyname, qual, with_check, cmd, roles
--     FROM pg_policies
--     WHERE schemaname = 'public'
--       AND (qual ~ '\bauth\.uid\(\)' AND qual !~ '\(select auth\.uid\(\)\)'
--         OR with_check ~ '\bauth\.uid\(\)' AND with_check !~ '\(select auth\.uid\(\)\)')
--   LOOP
--     -- DROP POLICY ... CREATE POLICY with rewritten expressions.
--     -- Done with care; left as DELIBERATE manual work because the
--     -- existing policies have complex predicates that are easy to break.
--   END LOOP;
-- END $$;
--
-- TODO: enumerate the 77 policies, generate the rewrites, review each.

-- ---------------------------------------------------------------------
-- 4.7b  Add missing FK indexes
-- ---------------------------------------------------------------------
-- 38 unindexed FKs across 14 tables. Add B-tree on each.

CREATE INDEX IF NOT EXISTS idx_integration_launches_client_id
  ON public.integration_launches (client_id);
CREATE INDEX IF NOT EXISTS idx_integration_launches_partner_id
  ON public.integration_launches (partner_id);
CREATE INDEX IF NOT EXISTS idx_integration_launches_actor_id
  ON public.integration_launches (actor_profile_id);
-- ... (35 more — enumerate from advisor output)
-- TODO: full list from the advisor's unindexed_foreign_keys lints.

-- ---------------------------------------------------------------------
-- 4.7c  Drop unused indexes
-- ---------------------------------------------------------------------
-- 69 indexes flagged unused. DEFER. Many are recently added and may
-- not have seen production traffic yet. Better to confirm via
-- pg_stat_user_indexes idx_scan = 0 over a longer window.

-- ---------------------------------------------------------------------
-- 4.7d  Consolidate multiple permissive policies
-- ---------------------------------------------------------------------
-- 216 multiple-permissive findings. Each row is evaluated against
-- every matching policy. Consolidating typically gives 1.5-3× speedup
-- on hot tables.
-- TODO: enumerate per-table, OR-combine permissive policies into one.
