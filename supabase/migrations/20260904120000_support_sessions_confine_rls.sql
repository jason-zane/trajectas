-- =========================================================================
-- 20260904120000_support_sessions_confine_rls.sql
--
-- Make a support session confining in Postgres, not just in the app.
--
-- THE PROBLEM
--
-- RLS scopes by MEMBERSHIP. It cannot scope by WORKSPACE: the active context
-- and any support session live in a signed cookie (tf_active_context) that
-- never reaches the database, and is_platform_admin() is role-only:
--
--     SELECT EXISTS (SELECT 1 FROM profiles
--                    WHERE id = auth.uid() AND role = 'platform_admin')
--
-- So while a platform admin is inside a support session for one named client,
-- the application correctly narrows them to that client and the database does
-- not narrow them at all. Any read that trusted RLS returned every tenant's
-- rows. That is how the Compare participant picker served one client's portal
-- all 51 participants across 3 clients (PR #379, then the app-layer sweep in
-- the preceding commit).
--
-- Unlike the workspace switcher, a support session needs no request plumbing
-- to fix: it is a ROW, in support_sessions, that the database can simply read.
-- It cannot be forged or omitted from the client side.
--
-- WHAT THIS CHANGES, AND WHAT IT DELIBERATELY DOES NOT
--
-- is_platform_admin() is left ALONE. It is referenced by 239 policies, and
-- ~60 of those are INSERT/UPDATE/DELETE policies where it is the only way an
-- admin qualifies. Narrowing it wholesale would strip a support session of the
-- ability to *act* on the tenant it was opened to help — the opposite of what
-- support sessions are for — across roughly 30 tables at once, with no staged
-- rollout. It also gates platform tables (item_parameters, item_statistics)
-- that have nothing to do with tenancy.
--
-- Instead:
--
--   1. is_unconfined_platform_admin() — platform admin AND not currently
--      inside a support session. New function; nothing depends on it yet.
--
--   2. Every tenant-scoped SELECT policy swaps is_platform_admin() for it —
--      35 of them, derived from pg_policies at migration time rather than
--      transcribed. A first pass enumerated eleven by hand and missed the
--      org_diagnostic_* family, client_roles, the eight integration_* tables,
--      audit_events, person_link_audit, campaign_access_links, profiles and
--      others. Reads confine; writes are untouched. Five FOR ALL policies are
--      a documented, deliberate gap — see 5c.
--
--   3. auth_user_client_ids() / auth_user_partner_ids() return ONLY the
--      support session's target while one is live. Required, not incidental:
--      once (2) lands, those arrays are how an admin in a session still sees
--      the tenant they came to help. A platform admin normally holds no
--      memberships, so without this they would see nothing at all.
--
-- The *_admin_ids() functions are deliberately not touched. Write access
-- during a support session continues to flow from is_platform_admin(), which
-- is unchanged, so nothing an admin can do today stops working.
--
-- REMAINING GAP (by design, tracked)
--
-- A platform admin who *selects* a client in the workspace switcher rather
-- than opening a support session is still unconfined at the database level.
-- There is no row to consult, so that case genuinely needs a GUC or a JWT
-- claim, and both are forgeable by the admin unless the cookie's signing
-- secret moves into Postgres. It stays an application-level predicate,
-- enforced by tests/architecture/tenant-scope-predicates.test.ts.
-- See docs/superpowers/specs/2026-09-04-workspace-tenant-boundary.md.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Is the caller inside a live support session?
-- -------------------------------------------------------------------------
-- SECURITY DEFINER so it can read support_sessions, which client members have
-- no SELECT policy on. Indexed by idx_support_sessions_actor.
CREATE OR REPLACE FUNCTION public.auth_in_support_session()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM support_sessions ss
    WHERE ss.actor_profile_id = auth.uid()
      AND ss.ended_at IS NULL
      AND ss.expires_at > now()
  );
$function$;

COMMENT ON FUNCTION public.auth_in_support_session() IS
  'True while the caller has a live support session. Unforgeable from the client: it reads support_sessions rather than any request-supplied context.';

-- -------------------------------------------------------------------------
-- 2. A platform admin who is NOT standing inside a tenant
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_unconfined_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT is_platform_admin() AND NOT auth_in_support_session();
$function$;

COMMENT ON FUNCTION public.is_unconfined_platform_admin() IS
  'Platform admin acting AS the platform. False inside a support session, where they are acting as one tenant. Use in SELECT policies on tenant-scoped tables; use is_platform_admin() for writes and platform-owned tables.';

-- -------------------------------------------------------------------------
-- 3. Membership arrays collapse to the support target while a session is live
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_user_client_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH active_support AS (
    SELECT ss.target_surface, ss.client_id, ss.partner_id
    FROM support_sessions ss
    WHERE ss.actor_profile_id = auth.uid()
      AND ss.ended_at IS NULL
      AND ss.expires_at > now()
    ORDER BY ss.created_at DESC
    LIMIT 1
  ),
  membership_client_ids AS (
    SELECT cm.client_id
    FROM client_memberships cm
    WHERE cm.profile_id = auth.uid()
      AND cm.revoked_at IS NULL
  ),
  partner_client_ids AS (
    SELECT c.id
    FROM clients c
    WHERE c.partner_id = ANY(auth_user_partner_ids())
      AND c.deleted_at IS NULL
  ),
  legacy_client_ids AS (
    SELECT p.client_id
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.client_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM client_memberships cm
        WHERE cm.profile_id = auth.uid()
      )
  )
  SELECT CASE
    -- Inside a support session the caller's own memberships are set aside
    -- entirely: they are acting as the target tenant, and nothing else.
    --
    -- The NULL-target arms below are unreachable today —
    -- support_sessions_target_scope_check already guarantees a client session
    -- has client_id and a partner session has partner_id — but they fail CLOSED
    -- rather than trusting a constraint to outlive this function.
    WHEN EXISTS (SELECT 1 FROM active_support) THEN COALESCE((
      SELECT CASE
        WHEN a.target_surface = 'client' AND a.client_id IS NOT NULL
          THEN ARRAY[a.client_id]
        WHEN a.target_surface = 'partner' AND a.partner_id IS NOT NULL
          THEN ARRAY(
            SELECT c.id FROM clients c
            WHERE c.partner_id = a.partner_id AND c.deleted_at IS NULL
          )
        ELSE ARRAY[]::UUID[]
      END
      FROM active_support a
    ), ARRAY[]::UUID[])
    ELSE COALESCE(
      ARRAY(
        SELECT DISTINCT client_id
        FROM (
          SELECT client_id FROM membership_client_ids
          UNION
          SELECT id AS client_id FROM partner_client_ids
          UNION
          SELECT client_id FROM legacy_client_ids
        ) client_ids
      ),
      ARRAY[]::UUID[]
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.auth_user_partner_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH active_support AS (
    SELECT ss.target_surface, ss.partner_id
    FROM support_sessions ss
    WHERE ss.actor_profile_id = auth.uid()
      AND ss.ended_at IS NULL
      AND ss.expires_at > now()
    ORDER BY ss.created_at DESC
    LIMIT 1
  ),
  membership_partner_ids AS (
    SELECT pm.partner_id
    FROM partner_memberships pm
    WHERE pm.profile_id = auth.uid()
      AND pm.revoked_at IS NULL
  ),
  legacy_partner_ids AS (
    SELECT p.partner_id
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.partner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM partner_memberships pm
        WHERE pm.profile_id = auth.uid()
      )
  )
  SELECT CASE
    -- A client support session reaches no partner at all; a partner one
    -- reaches exactly its target. Mirrors resolveAuthorizedScope().
    WHEN EXISTS (SELECT 1 FROM active_support) THEN COALESCE((
      SELECT CASE
        WHEN a.target_surface = 'partner' AND a.partner_id IS NOT NULL
          THEN ARRAY[a.partner_id]
        ELSE ARRAY[]::UUID[]
      END
      FROM active_support a
    ), ARRAY[]::UUID[])
    ELSE COALESCE(
      ARRAY(
        SELECT DISTINCT partner_id
        FROM (
          SELECT partner_id FROM membership_partner_ids
          UNION
          SELECT partner_id FROM legacy_partner_ids
        ) partner_ids
      ),
      ARRAY[]::UUID[]
    )
  END;
$function$;

-- -------------------------------------------------------------------------
-- 4. RLS expressions run as the CALLER, so `authenticated` needs EXECUTE
-- -------------------------------------------------------------------------
-- SECURITY DEFINER does not bypass EXECUTE; revoking it here would break every
-- RLS-gated read. See 20260522000000_restore_auth_helper_exec_for_rls.sql,
-- which reverted exactly that mistake.
GRANT EXECUTE ON FUNCTION public.auth_in_support_session()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_unconfined_platform_admin()  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.auth_in_support_session()      FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_unconfined_platform_admin() FROM anon;

-- -------------------------------------------------------------------------
-- 5a. Two policies hand-roll the admin check inline
-- -------------------------------------------------------------------------
-- These carry `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role =
-- 'platform_admin')` as a SEPARATE OR arm alongside is_platform_admin() — an
-- open-coded duplicate of the same test. The mechanical rewrite in 5b matches
-- the function call only, so swapping that alone would leave the inline arm
-- granting everything and the confinement would silently do nothing. Collapse
-- both arms into the confined check here, before the loop runs.
ALTER POLICY client_assessment_assignments_select_authenticated
  ON public.client_assessment_assignments
  USING (
    is_unconfined_platform_admin()
    OR client_id = ANY (auth_user_client_ids())
  );

ALTER POLICY client_report_template_assignments_select_authenticated
  ON public.client_report_template_assignments
  USING (
    is_unconfined_platform_admin()
    OR client_id = ANY (auth_user_client_ids())
  );

-- -------------------------------------------------------------------------
-- 5b. Every other tenant-scoped SELECT policy, rewritten mechanically
-- -------------------------------------------------------------------------
-- Derived from pg_policies at migration time rather than transcribed by hand.
-- Three reasons, all learned the expensive way:
--
--   1. There are 35 of these, not the eleven a hand-audit first turned up. The
--      list below is every table in `public` carrying a tenant-identifying
--      column (client_id / partner_id / campaign_id / session_id / …) whose
--      SELECT policy invokes the role-only admin check. Enumerating by memory
--      missed the org_diagnostic_* family, client_roles, the integration_*
--      tables, audit_events, person_link_audit and profiles.
--   2. Re-typing 35 policy expressions is a transcription-error machine, and an
--      error here silently widens or narrows access. Reading the live
--      expression and substituting one function name cannot drop a clause.
--   3. Production has drifted from the migration files before
--      (docs/schema-drift-audit-2026-08-16.md). Rewriting whatever the database
--      actually holds is correct in both a replayed and a drifted database.
--
-- Idempotent: 'is_unconfined_platform_admin()' does not contain the substring
-- 'is_platform_admin()', so a second run finds nothing left to replace.
DO $$
DECLARE
  target record;
  new_qual text;
  altered int := 0;
BEGIN
  FOR target IN
    SELECT tablename, policyname, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'SELECT'
      AND 'authenticated' = ANY(roles)
      AND coalesce(qual, '') LIKE '%is\_platform\_admin(%'
      AND tablename IN (
    'assessments', 'audit_events', 'campaign_access_links', 'campaign_assessments',
    'campaign_participants', 'campaigns', 'client_assessment_assignments',
    'client_memberships', 'client_report_template_assignments', 'client_roles',
    'clients', 'diagnostic_dimension_weights', 'diagnostic_respondents',
    'diagnostic_sessions', 'diagnostic_snapshots', 'factors',
    'integration_connections', 'integration_credentials', 'integration_events_outbox',
    'integration_external_refs', 'integration_idempotency_keys', 'integration_launches',
    'integration_webhook_endpoints', 'matching_runs', 'org_diagnostic_campaign_tracks',
    'org_diagnostic_campaigns', 'org_diagnostic_profiles', 'participant_responses',
    'participant_scores', 'participant_sessions', 'partner_memberships',
    'person_link_audit', 'profiles', 'report_snapshots', 'report_templates'
      )
    ORDER BY tablename, policyname
  LOOP
    new_qual := replace(target.qual, 'is_platform_admin()', 'is_unconfined_platform_admin()');
    EXECUTE format(
      'ALTER POLICY %I ON public.%I USING (%s)',
      target.policyname, target.tablename, new_qual
    );
    altered := altered + 1;
    RAISE NOTICE 'confined SELECT policy %.%', target.tablename, target.policyname;
  END LOOP;

  -- Deliberately NOT asserted on: a re-run finds nothing left to rewrite and
  -- reports zero, which is success, not divergence. The "did enough happen"
  -- check has to look at the resulting STATE, not at how much this particular
  -- run changed — see section 6.
  RAISE NOTICE 'support-session confinement applied to % SELECT policies', altered;
END $$;

-- -------------------------------------------------------------------------
-- 5c. Known gap: five FOR ALL policies are NOT confined
-- -------------------------------------------------------------------------
-- billing_accounts, campaign_360_snapshots, campaign_raters,
-- org_diagnostic_respondents and session_quality_flags each carry a single
-- `FOR ALL USING (is_platform_admin())` policy — platform admins are the only
-- principal who can touch them at all. A support session therefore still reads
-- every tenant's rows on those five.
--
-- Confining them is not an ALTER: a FOR ALL policy also covers SELECT, so the
-- fix is DROP + CREATE of a confined SELECT policy plus separate INSERT/UPDATE/
-- DELETE policies — three objects per table, and a genuine write-regression
-- risk. That deserves its own migration and its own review rather than riding
-- along here. Deliberately deferred, and stated out loud rather than left to be
-- discovered.
DO $$
BEGIN
  RAISE NOTICE 'NOT confined (FOR ALL policies, deferred): billing_accounts, campaign_360_snapshots, campaign_raters, org_diagnostic_respondents, session_quality_flags';
END $$;

-- -------------------------------------------------------------------------
-- 6. Assert the swap actually took
-- -------------------------------------------------------------------------
-- Insurance against a silent partial apply, and against a future policy rewrite
-- quietly reintroducing the role-only check on a tenant table. Checks BOTH
-- forms: the function call, and the open-coded profiles-role lookup that 5a had
-- to special-case. Note `is_unconfined_platform_admin(` does not contain the
-- string `is_platform_admin(`, so this matches only the unconfined original.
--
-- Restricted to the `authenticated` role, matching 5b. Several of these tables
-- also carry a parallel `*_select_anon` policy that invokes the same check, and
-- those are deliberately left alone for two reasons: `is_platform_admin()`
-- calls auth.uid(), which is NULL for `anon`, so the arm is already dead code
-- there; and `anon` has no EXECUTE on is_unconfined_platform_admin() (revoked
-- in section 4), so rewriting an anon policy to call it would raise a
-- permission error on every anonymous read. A support session's caller is
-- always `authenticated`, so nothing is lost.
DO $$
DECLARE
  offenders text;
  confined  int;
BEGIN
  SELECT string_agg(format('%s.%s', tablename, policyname), ', ' ORDER BY tablename)
  INTO offenders
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd = 'SELECT'
    AND 'authenticated' = ANY(roles)
    AND (
      coalesce(qual, '') LIKE '%is\_platform\_admin(%'
      OR coalesce(qual, '') LIKE '%role = ''platform\_admin''%'
    )
    AND tablename IN (
    'assessments', 'audit_events', 'campaign_access_links', 'campaign_assessments',
    'campaign_participants', 'campaigns', 'client_assessment_assignments',
    'client_memberships', 'client_report_template_assignments', 'client_roles',
    'clients', 'diagnostic_dimension_weights', 'diagnostic_respondents',
    'diagnostic_sessions', 'diagnostic_snapshots', 'factors',
    'integration_connections', 'integration_credentials', 'integration_events_outbox',
    'integration_external_refs', 'integration_idempotency_keys', 'integration_launches',
    'integration_webhook_endpoints', 'matching_runs', 'org_diagnostic_campaign_tracks',
    'org_diagnostic_campaigns', 'org_diagnostic_profiles', 'participant_responses',
    'participant_scores', 'participant_sessions', 'partner_memberships',
    'person_link_audit', 'profiles', 'report_snapshots', 'report_templates'
    );

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Tenant-scoped SELECT policies still use the role-only admin check, so a support session would not confine reads: %',
      offenders;
  END IF;

  -- The negative check above passes vacuously if the table list has drifted out
  -- of step with the schema — nothing matched, so nothing offended. Assert the
  -- positive too: the confinement is actually PRESENT on the expected scale.
  -- State-based, so it holds on a re-run as well as a first apply.
  SELECT count(*) INTO confined
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd = 'SELECT'
    AND 'authenticated' = ANY(roles)
    AND coalesce(qual, '') LIKE '%is\_unconfined\_platform\_admin(%';

  IF confined < 25 THEN
    RAISE EXCEPTION
      'Only % tenant-scoped SELECT policies carry the confined admin check; expected ~35. The policy set has diverged from what this migration was written against — re-derive the table list before applying.',
      confined;
  END IF;

  RAISE NOTICE 'support-session confinement verified on % SELECT policies', confined;
END $$;
