-- =============================================================================
-- Partner pool invariant, parent-side guards (companion to
-- 20260905090000_client_assignment_partner_pool_guard.sql).
--
-- The child-row trigger only fires when a client assignment itself changes.
-- Two parent-side changes could silently invalidate existing active rows:
--
--   1. moving a client under a partner (clients.partner_id) while it holds
--      active assignments that are not in that partner's allocation, and
--   2. deactivating or deleting a partner_assessment_assignments row that
--      active client assignments still depend on.
--
-- Both are refused here, for every actor. Exemptions: a partner that is
-- archived (partners.deleted_at IS NOT NULL) may have its whole allocation
-- deactivated (deletePartner does exactly that), and assessments owned by the
-- partner or by the client never depended on a pool row (D4).
-- =============================================================================

-- 1. clients.partner_id --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_client_partner_change_pool()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_bad_count integer;
BEGIN
  IF NEW.partner_id IS NULL OR NEW.partner_id IS NOT DISTINCT FROM OLD.partner_id THEN
    RETURN NEW; -- becoming platform-owned, or no change
  END IF;

  SELECT count(*) INTO v_bad_count
  FROM public.client_assessment_assignments caa
  JOIN public.assessments a ON a.id = caa.assessment_id
  WHERE caa.client_id = NEW.id
    AND caa.is_active
    AND a.partner_id IS DISTINCT FROM NEW.partner_id
    AND a.client_id IS DISTINCT FROM NEW.id
    AND NOT EXISTS (
      SELECT 1
      FROM public.partner_assessment_assignments paa
      WHERE paa.partner_id = NEW.partner_id
        AND paa.assessment_id = caa.assessment_id
        AND paa.is_active
    );

  IF v_bad_count > 0 THEN
    RAISE EXCEPTION 'client % holds % active assessment assignment(s) outside partner % allocation; remove them or allocate the assessments first',
      NEW.id, v_bad_count, NEW.partner_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_client_partner_change_pool() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_clients_partner_change_pool ON public.clients;
CREATE TRIGGER trg_clients_partner_change_pool
  BEFORE UPDATE OF partner_id ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.enforce_client_partner_change_pool();

-- 2. partner_assessment_assignments removal -----------------------------------
CREATE OR REPLACE FUNCTION public.enforce_pool_row_removal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_partner_deleted_at timestamptz;
  v_owner_partner_id uuid;
  v_bad_count integer;
BEGIN
  -- Only an active row going away matters: an UPDATE that keeps it active, or
  -- that touches an already-inactive row, and a DELETE of an inactive row pass.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_active OR NOT OLD.is_active THEN
      RETURN NEW;
    END IF;
  ELSIF NOT OLD.is_active THEN
    RETURN OLD;
  END IF;

  -- Archived partners are out of service; their allocation may be wound down.
  SELECT deleted_at INTO v_partner_deleted_at FROM public.partners WHERE id = OLD.partner_id;
  IF v_partner_deleted_at IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- A partner-owned assessment never depended on the pool row (D4).
  SELECT partner_id INTO v_owner_partner_id FROM public.assessments WHERE id = OLD.assessment_id;
  IF v_owner_partner_id = OLD.partner_id THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT count(*) INTO v_bad_count
  FROM public.client_assessment_assignments caa
  JOIN public.clients c ON c.id = caa.client_id
  JOIN public.assessments a ON a.id = caa.assessment_id
  WHERE c.partner_id = OLD.partner_id
    AND caa.assessment_id = OLD.assessment_id
    AND caa.is_active
    AND a.client_id IS DISTINCT FROM caa.client_id; -- client-owned never depended on it either

  IF v_bad_count > 0 THEN
    RAISE EXCEPTION 'assessment % is still assigned to % client(s) of partner %; remove it from those clients first',
      OLD.assessment_id, v_bad_count, OLD.partner_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_pool_row_removal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pool_row_removal ON public.partner_assessment_assignments;
CREATE TRIGGER trg_pool_row_removal
  BEFORE UPDATE OF is_active OR DELETE ON public.partner_assessment_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pool_row_removal();
