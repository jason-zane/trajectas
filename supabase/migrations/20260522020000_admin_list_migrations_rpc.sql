-- =========================================================================
-- 20260522020000_admin_list_migrations_rpc.sql
--
-- Function so /settings/migrations can read supabase_migrations.schema_migrations
-- without having to expose the supabase_migrations schema via PostgREST.
-- Called from a server component using the service role (createAdminClient),
-- which bypasses the EXECUTE grant — so we can keep authenticated locked
-- out and avoid advisor lint 0029 entirely.
--
-- The page itself is gated to platform_admin; this function is a
-- service-role-only data accessor.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.admin_list_migrations()
RETURNS TABLE(version text, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT sm.version, sm.name
  FROM supabase_migrations.schema_migrations sm
  ORDER BY sm.version DESC
  LIMIT 200;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_migrations() FROM anon, authenticated, public;
