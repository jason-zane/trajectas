-- Memberships are the only tenant authority. profiles.partner_id can describe
-- a client's parent partner and MUST NOT implicitly grant partner access.
-- Existing memberships (including revoked ones) are preserved verbatim. The
-- production preflight found no staff requiring a legacy membership backfill.
-- Do not manufacture partner memberships from a client profile's parent id.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.auth_profile_is_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_active
  );
$$;
REVOKE ALL ON FUNCTION private.auth_profile_is_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.auth_profile_is_active() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_active AND p.role = 'platform_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_in_support_session()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.is_platform_admin() AND EXISTS (
    SELECT 1 FROM public.support_sessions ss
    WHERE ss.actor_profile_id = auth.uid()
      AND ss.ended_at IS NULL AND ss.expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_user_partner_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH active_support AS (
    SELECT ss.target_surface, ss.partner_id
    FROM public.support_sessions ss
    WHERE public.is_platform_admin() AND ss.actor_profile_id = auth.uid()
      AND ss.ended_at IS NULL AND ss.expires_at > now()
    ORDER BY ss.created_at DESC, ss.id DESC LIMIT 1
  )
  SELECT CASE
    WHEN NOT private.auth_profile_is_active() THEN ARRAY[]::uuid[]
    WHEN EXISTS (SELECT 1 FROM active_support) THEN (
      SELECT CASE WHEN s.target_surface = 'partner' AND s.partner_id IS NOT NULL
        THEN ARRAY[s.partner_id] ELSE ARRAY[]::uuid[] END FROM active_support s
    )
    ELSE ARRAY(
      SELECT DISTINCT pm.partner_id FROM public.partner_memberships pm
      WHERE pm.profile_id = auth.uid() AND pm.revoked_at IS NULL
      ORDER BY pm.partner_id
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_client_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH active_support AS (
    SELECT ss.target_surface, ss.client_id, ss.partner_id
    FROM public.support_sessions ss
    WHERE public.is_platform_admin() AND ss.actor_profile_id = auth.uid()
      AND ss.ended_at IS NULL AND ss.expires_at > now()
    ORDER BY ss.created_at DESC, ss.id DESC LIMIT 1
  )
  SELECT CASE
    WHEN NOT private.auth_profile_is_active() THEN ARRAY[]::uuid[]
    WHEN EXISTS (SELECT 1 FROM active_support) THEN (
      SELECT CASE
        WHEN s.target_surface = 'client' AND s.client_id IS NOT NULL THEN ARRAY[s.client_id]
        WHEN s.target_surface = 'partner' AND s.partner_id IS NOT NULL THEN ARRAY(
          SELECT c.id FROM public.clients c
          WHERE c.partner_id = s.partner_id AND c.deleted_at IS NULL ORDER BY c.id
        )
        ELSE ARRAY[]::uuid[] END FROM active_support s
    )
    ELSE ARRAY(
      SELECT member_client_id FROM (
        SELECT cm.client_id AS member_client_id FROM public.client_memberships cm
        WHERE cm.profile_id = auth.uid() AND cm.revoked_at IS NULL
        UNION
        SELECT c.id FROM public.clients c
        WHERE c.partner_id = ANY(public.auth_user_partner_ids()) AND c.deleted_at IS NULL
      ) accessible ORDER BY member_client_id
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_partner_admin_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT ARRAY(
    SELECT DISTINCT pm.partner_id FROM public.partner_memberships pm
    WHERE private.auth_profile_is_active() AND pm.profile_id = auth.uid()
      AND pm.role = 'admin' AND pm.revoked_at IS NULL
      AND pm.partner_id = ANY(public.auth_user_partner_ids())
    ORDER BY pm.partner_id
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_user_client_admin_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT ARRAY(
    SELECT DISTINCT cm.client_id FROM public.client_memberships cm
    WHERE private.auth_profile_is_active() AND cm.profile_id = auth.uid()
      AND cm.role = 'admin' AND cm.revoked_at IS NULL
      AND cm.client_id = ANY(public.auth_user_client_ids())
    ORDER BY cm.client_id
  );
$$;

-- Single-id and admin predicate helpers delegate to the arrays above. Re-emit
-- them to keep the full authorization contract explicit in this migration.
CREATE OR REPLACE FUNCTION public.auth_user_partner_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$ SELECT (public.auth_user_partner_ids())[1]; $$;
CREATE OR REPLACE FUNCTION public.auth_user_client_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$ SELECT (public.auth_user_client_ids())[1]; $$;
CREATE OR REPLACE FUNCTION public.is_partner_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$ SELECT cardinality(public.auth_user_partner_admin_ids()) > 0; $$;
CREATE OR REPLACE FUNCTION public.is_unconfined_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$ SELECT public.is_platform_admin() AND NOT public.auth_in_support_session(); $$;

-- RLS is evaluated as the caller, so authenticated must keep EXECUTE. These
-- existing helper signatures are still used by policies and application RPCs.
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'auth_user_role', 'is_platform_admin', 'auth_in_support_session',
    'auth_user_partner_ids', 'auth_user_client_ids',
    'auth_user_partner_admin_ids', 'auth_user_client_admin_ids',
    'auth_user_partner_id', 'auth_user_client_id', 'is_partner_admin',
    'is_unconfined_platform_admin'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I() FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I() TO authenticated, service_role', fn);
  END LOOP;
END $$;

-- An inline role check or auth.uid() owner arm must not bypass deactivation.
-- One restrictive policy combines with existing permissive policies. It does
-- not itself grant access; it adds an active-account prerequisite. Anonymous
-- assessment-token traffic and service-role server operations are unchanged.
DO $$
DECLARE target record;
BEGIN
  FOR target IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_active_account ON public.%I', target.relname);
    EXECUTE format(
      'CREATE POLICY authenticated_active_account ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT private.auth_profile_is_active())) WITH CHECK ((SELECT private.auth_profile_is_active()))',
      target.relname
    );
  END LOOP;
END $$;

-- Remove the recursive profiles role subquery. User-facing profile updates
-- may edit names only. Role, tenant IDs, active status, email and deletion
-- scheduling are privileged and remain server-action/service-role writes.
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
DO $$
DECLARE col record;
BEGIN
  FOR col IN
    SELECT attname FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND NOT attisdropped
  LOOP
    EXECUTE format('REVOKE UPDATE (%I) ON public.profiles FROM PUBLIC, anon, authenticated', col.attname);
  END LOOP;
END $$;
GRANT UPDATE (display_name, first_name, last_name) ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO service_role;

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_anon ON public.profiles;
DROP POLICY IF EXISTS profiles_update_authenticated ON public.profiles;
CREATE POLICY profiles_update_authenticated ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

COMMENT ON FUNCTION public.auth_user_partner_ids() IS
  'Active partner memberships only, confined by an active platform-admin support session; profile tenant columns grant no authority.';
COMMENT ON FUNCTION public.auth_user_client_ids() IS
  'Active client memberships plus clients of active partner memberships, confined by an active platform-admin support session.';

NOTIFY pgrst, 'reload schema';
