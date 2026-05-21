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

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
