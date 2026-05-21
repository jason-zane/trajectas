-- =========================================================================
-- 20260522030000_grant_admin_list_migrations_to_service_role.sql
--
-- Follow-up to 20260522020000_admin_list_migrations_rpc.sql. The previous
-- migration revoked EXECUTE on the new admin_list_migrations() function
-- from anon/authenticated/public, intending to leave service_role with
-- the privilege via default. In practice the service role can still call
-- the function on Supabase today (verified via SET ROLE service_role),
-- but being explicit matches the convention other service-role RPC
-- migrations use in this repo and avoids depending on whatever default
-- grant behaviour Supabase chooses going forward.
--
-- Caught by Codex P1 on PR #145.
-- =========================================================================

GRANT EXECUTE ON FUNCTION public.admin_list_migrations() TO service_role;
