-- =========================================================================
-- 20260521120000_revoke_auth_helper_definer_exec.sql
--
-- Closes Supabase advisor lint 0029 (authenticated_security_definer_function_executable)
-- for the auth-context helper functions in the public schema.
--
-- These functions are only ever invoked from inside RLS policies. Policy
-- evaluation runs as the policy/table owner, NOT the caller, so revoking
-- EXECUTE from anon / authenticated / public does not break policy
-- enforcement — it only shuts the /rest/v1/rpc/<fn> entry point that the
-- advisor flags as an unintentional API surface.
--
-- Verified before applying: zero references in src/ to any of these
-- function names, so no client code calls them via supabase.rpc(...).
--
-- IDEMPOTENT. Following the pattern from
-- 20260512150000_trajectory_revoke_trigger_fn_exec.sql.
-- =========================================================================

REVOKE EXECUTE ON FUNCTION public.auth_user_client_id()
    FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.auth_user_client_ids()
    FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.auth_user_client_admin_ids()
    FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.auth_user_partner_id()
    FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.auth_user_partner_ids()
    FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.auth_user_partner_admin_ids()
    FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.auth_user_role()
    FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.is_partner_admin()
    FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin()
    FROM anon, authenticated, public;

-- rls_auto_enable() is not created by any repo migration (it exists only where
-- it was added out-of-band), so guard the REVOKE for fresh rebuilds.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public';
  END IF;
END $$;
