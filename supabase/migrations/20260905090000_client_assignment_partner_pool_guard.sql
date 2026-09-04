-- =============================================================================
-- Partner-managed clients, Phase 1 (docs/superpowers/plans/2026-09-04-partner-
-- self-service.md, decisions D2 and D4).
--
-- Partner admins may now assign assessments to their own clients through the
-- Server Actions, which run on the service role. The database therefore cannot
-- tell a partner's write from an admin's, so the pool invariant moves here and
-- holds for every actor:
--
--   an ACTIVE client_assessment_assignments row for a partner-owned client must
--   reference an assessment that is (a) in that partner's active allocation
--   (partner_assessment_assignments), or (b) owned by that partner, or
--   (c) owned by that client.
--
-- RLS write policies on the entitlement tables stay platform-admin-only on
-- purpose: direct PostgREST writes by partner admins would bypass the quota cap
-- and the audit log. Read-parity policies and the memberships-only rewrite of
-- the auth_user_* helpers are sequenced after PR #381 (support-session
-- confinement), which touches the same objects.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_client_assignment_in_partner_pool()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_partner_id uuid;
  v_assessment_partner_id uuid;
  v_assessment_client_id uuid;
BEGIN
  IF NEW.is_active IS DISTINCT FROM true THEN
    RETURN NEW; -- deactivating is always allowed
  END IF;

  SELECT partner_id INTO v_partner_id FROM public.clients WHERE id = NEW.client_id;
  IF v_partner_id IS NULL THEN
    RETURN NEW; -- platform-owned client: no pool to check
  END IF;

  SELECT partner_id, client_id
    INTO v_assessment_partner_id, v_assessment_client_id
  FROM public.assessments
  WHERE id = NEW.assessment_id;

  IF v_assessment_partner_id = v_partner_id OR v_assessment_client_id = NEW.client_id THEN
    RETURN NEW; -- D4: partner-owned or client-owned assessment
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.partner_assessment_assignments paa
    WHERE paa.partner_id = v_partner_id
      AND paa.assessment_id = NEW.assessment_id
      AND paa.is_active = true
  ) THEN
    RAISE EXCEPTION 'assessment % is not in the partner pool for client %',
      NEW.assessment_id, NEW.client_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger functions are never called directly; keep the surface closed.
REVOKE EXECUTE ON FUNCTION public.enforce_client_assignment_in_partner_pool() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_client_assignment_partner_pool ON public.client_assessment_assignments;
CREATE TRIGGER trg_client_assignment_partner_pool
  BEFORE INSERT OR UPDATE OF assessment_id, client_id, is_active
  ON public.client_assessment_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_client_assignment_in_partner_pool();
