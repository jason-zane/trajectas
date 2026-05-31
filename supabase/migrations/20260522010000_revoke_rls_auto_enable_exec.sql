-- =========================================================================
-- 20260522010000_revoke_rls_auto_enable_exec.sql
--
-- Follow-up to the previous migration. That one blanket-restored EXECUTE
-- on all 10 auth helper functions to keep production reads working, but
-- `rls_auto_enable()` is not referenced by any RLS policy (confirmed via
-- `SELECT … FROM pg_policies WHERE qual LIKE '%rls_auto_enable%'` → 0
-- rows). It does not need the grant; revoking puts it back behind the
-- service role only and avoids re-tripping advisor lint 0029 for this
-- one function specifically.
--
-- Caught by Codex review on PR #144.
-- =========================================================================

-- Guarded: rls_auto_enable() is not created by any repo migration, so a fresh
-- rebuild won't have it. The REVOKE only matters where the function exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated';
  END IF;
END $$;
