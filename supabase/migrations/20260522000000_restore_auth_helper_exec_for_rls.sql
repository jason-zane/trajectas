-- =========================================================================
-- 20260522000000_restore_auth_helper_exec_for_rls.sql
--
-- HOTFIX. Reverts the EXECUTE revoke from
-- 20260521120000_revoke_auth_helper_definer_exec.sql.
--
-- That migration was wrong. Each of these 10 functions is referenced from
-- RLS policy USING / WITH CHECK expressions across the schema
-- (assessments_all_platform_admin, clients_select_platform_admin,
-- factors_select, items_all_platform_admin, …). RLS expressions are
-- evaluated in the security context of the CALLER, not the policy owner —
-- so the caller's role must hold EXECUTE on any function the policy
-- invokes. Revoking from `authenticated` broke every RLS-gated read for
-- a platform admin, manifesting first as a 500 on /dashboard
-- (getDashboardStats.platform → digest 1427784684).
--
-- SECURITY DEFINER does NOT bypass EXECUTE. It only changes privileges
-- INSIDE the function once it begins running.
--
-- The Supabase advisor lint 0029
-- (authenticated_security_definer_function_executable) we were chasing is
-- the wrong fix for THESE functions. The right fix is to move them out of
-- the `public` schema so they aren't exposed via /rest/v1/rpc but remain
-- callable from policies — that's a separate follow-up. For now we accept
-- the advisor warning to keep production reads working.
-- =========================================================================

GRANT EXECUTE ON FUNCTION public.auth_user_client_id()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_client_ids()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_client_admin_ids()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_partner_id()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_partner_ids()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_partner_admin_ids()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_role()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_partner_admin()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin()              TO authenticated;
DO $$
BEGIN
  -- rls_auto_enable() is not created by any repo migration; guard for fresh rebuilds.
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO authenticated';
  END IF;
END $$;
