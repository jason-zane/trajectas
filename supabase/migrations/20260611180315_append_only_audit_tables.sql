-- =============================================================================
-- Migration 20260611180315: append_only_audit_tables
-- =============================================================================
-- Enforce database-level append-only semantics on audit and diagnostic
-- snapshot tables (A8 audit finding). Previously, these tables relied on
-- convention only: no grants revoked, no block triggers.
--
-- Changes:
-- 1. REVOKE UPDATE, DELETE from anon & authenticated on:
--    - audit_events (INSERT only, via service_role)
--    - error_events (INSERT only, via service_role)
--    - account_deletion_audit (INSERT only, via service_role)
--
-- 2. Add BEFORE UPDATE OR DELETE triggers to raise exceptions on all three.
--    Service_role bypasses RLS but NOT triggers, so the app code continues
--    to write via service_role; any buggy mutation code hits the trigger
--    exception as a safety net. INSERT is unaffected.
--
-- 3. Adjust org_diagnostic_profiles RLS: replace the broad "all platform admin"
--    policy with granular ones (SELECT/INSERT only, no UPDATE/DELETE),
--    matching its "Immutable snapshot" intent. Platform admins still have
--    SELECT and INSERT; no one gets UPDATE/DELETE.
--
-- IMPORTANT: error_events does NOT upsert in production code
-- (src/lib/observability/report-error.ts INSERT-only). Hence REVOKE UPDATE,
-- DELETE on error_events fully; the table is append-only with no exceptions.
--
-- Replayability: idempotent via IF EXISTS / DROP IF EXISTS guards.
-- =============================================================================

-- ====================================================================
-- 1. REVOKE UPDATE, DELETE from audit_events (anon, authenticated only)
-- ====================================================================

REVOKE UPDATE ON public.audit_events FROM anon, authenticated;
REVOKE DELETE ON public.audit_events FROM anon, authenticated;

-- ====================================================================
-- 2. REVOKE UPDATE, DELETE from error_events (anon, authenticated only)
-- ====================================================================

REVOKE UPDATE ON public.error_events FROM anon, authenticated;
REVOKE DELETE ON public.error_events FROM anon, authenticated;

-- ====================================================================
-- 3. REVOKE UPDATE, DELETE from account_deletion_audit (anon, authenticated only)
-- ====================================================================

REVOKE UPDATE ON public.account_deletion_audit FROM anon, authenticated;
REVOKE DELETE ON public.account_deletion_audit FROM anon, authenticated;

-- ====================================================================
-- 4. Create BEFORE UPDATE OR DELETE trigger on audit_events
--    Raises exception to protect append-only invariant.
--    (Service_role bypasses RLS but NOT triggers.)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.audit_events_prevent_mutation()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events: mutation not allowed — this table is append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_prevent_update_delete ON public.audit_events;
CREATE TRIGGER audit_events_prevent_update_delete
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_prevent_mutation();

-- ====================================================================
-- 5. Create BEFORE UPDATE OR DELETE trigger on error_events
--    Raises exception to protect append-only invariant.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.error_events_prevent_mutation()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'error_events: mutation not allowed — this table is append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS error_events_prevent_update_delete ON public.error_events;
CREATE TRIGGER error_events_prevent_update_delete
  BEFORE UPDATE OR DELETE ON public.error_events
  FOR EACH ROW EXECUTE FUNCTION error_events_prevent_mutation();

-- ====================================================================
-- 6. Create BEFORE UPDATE OR DELETE trigger on account_deletion_audit
--    Raises exception to protect append-only invariant.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.account_deletion_audit_prevent_mutation()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'account_deletion_audit: mutation not allowed — this table is append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS account_deletion_audit_prevent_update_delete ON public.account_deletion_audit;
CREATE TRIGGER account_deletion_audit_prevent_update_delete
  BEFORE UPDATE OR DELETE ON public.account_deletion_audit
  FOR EACH ROW EXECUTE FUNCTION account_deletion_audit_prevent_mutation();

-- ====================================================================
-- 7. Harden org_diagnostic_profiles RLS
--    Replace the blanket "FOR ALL TO authenticated USING (is_platform_admin())"
--    with granular SELECT/INSERT policies only. Platform admins can still
--    read and insert, but no one (including platform admins) can UPDATE/DELETE.
-- ====================================================================

DROP POLICY IF EXISTS org_diag_profiles_all_platform_admin ON public.org_diagnostic_profiles;

-- SELECT: platform admins, or clients / partners with policy access.
DROP POLICY IF EXISTS org_diag_profiles_select_client ON public.org_diagnostic_profiles;
CREATE POLICY org_diag_profiles_select_client ON public.org_diagnostic_profiles
  FOR SELECT
  TO authenticated
  USING (
    is_platform_admin()
    OR client_id = auth_user_client_id()
    OR client_id IN (
      SELECT c.id FROM clients c
      WHERE c.partner_id = (SELECT partner_id FROM profiles WHERE id = auth.uid())
        AND c.deleted_at IS NULL
    )
  );

-- INSERT: platform admins only (campaigns closing, platform operations).
DROP POLICY IF EXISTS org_diag_profiles_insert_platform_admin ON public.org_diagnostic_profiles;
CREATE POLICY org_diag_profiles_insert_platform_admin ON public.org_diagnostic_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin());

-- No UPDATE or DELETE policies — no one can mutate immutable snapshots.
