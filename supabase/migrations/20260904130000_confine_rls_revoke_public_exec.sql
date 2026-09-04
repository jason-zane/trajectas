-- =========================================================================
-- 20260904130000_confine_rls_revoke_public_exec.sql
--
-- Follow-up to 20260904120000_support_sessions_confine_rls.sql, found while
-- verifying that migration against production.
--
-- That migration ended with `REVOKE EXECUTE ... FROM anon`, and the comment
-- above it asserted that anon therefore holds no EXECUTE on the two new
-- helpers. It did. Postgres grants EXECUTE on every new function to PUBLIC,
-- and revoking from `anon` does not remove a grant held by PUBLIC — so anon
-- kept the privilege through role inheritance, and both functions were live
-- PostgREST RPC endpoints for unauthenticated callers.
--
-- The practical impact was nil: both return false for anon, because
-- is_platform_admin() and auth_in_support_session() key off auth.uid(), which
-- is NULL there. But the sibling helpers (auth_user_client_ids() and friends)
-- are all closed to anon, and the parent migration reasoned explicitly from
-- "anon cannot execute this" when explaining why the *_select_anon policies
-- are deliberately left alone. A comment that is load-bearing for a security
-- decision should be true.
--
-- `authenticated` MUST keep EXECUTE: RLS expressions are evaluated as the
-- CALLER, so revoking it breaks every RLS-gated read. That mistake has been
-- made here before — see 20260522000000_restore_auth_helper_exec_for_rls.sql,
-- which reverted it after a production 500 on /dashboard.
-- =========================================================================

REVOKE ALL ON FUNCTION public.auth_in_support_session()      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_unconfined_platform_admin() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.auth_in_support_session()       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_unconfined_platform_admin()  TO authenticated, service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.is_unconfined_platform_admin()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.auth_in_support_session()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon still holds EXECUTE on the support-session helpers';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.is_unconfined_platform_admin()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.auth_in_support_session()', 'EXECUTE') THEN
    RAISE EXCEPTION
      'authenticated lost EXECUTE on a helper used in RLS policy expressions — every RLS-gated read would break';
  END IF;
END $$;
