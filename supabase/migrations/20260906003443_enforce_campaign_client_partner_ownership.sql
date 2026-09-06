-- The client's current partner is authoritative for client-owned campaigns.
-- Keep standalone campaigns (client_id IS NULL) independently partner/platform
-- owned. Strictly reject inconsistent writes: app create/update already resolve
-- the client owner, so a request racing a transfer must reload its authorization.
-- A transfer updates every campaign, including archived/soft-deleted rows.
LOCK TABLE public.partners, public.clients, public.campaigns IN SHARE ROW EXCLUSIVE MODE;

-- Acquire ownership locks BEFORE row locks. Campaign ownership writes share it;
-- the rare client transfer/deletion takes it exclusively before touching the
-- parent and children. This prevents parent->child / child->parent deadlocks.
-- Partner deletion also cascades ownership changes through both FK paths.
-- Metadata-only campaign updates do not acquire this lock: profile deletion
-- updates campaigns.created_by before touching authoring tables (key 1), and
-- giving those unrelated updates key 2 would invert the deletion lock order.
CREATE OR REPLACE FUNCTION private.lock_campaign_client_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
  -- Deletion cascades into assessment-authoring tables. Take their existing
  -- lock first so an association insert holding key 1 cannot wait on a parent
  -- row that this deletion locked before trying to acquire key 1 itself.
  IF TG_OP = 'DELETE' THEN
    PERFORM pg_advisory_xact_lock(178438921, 1);
  END IF;
  IF TG_TABLE_NAME = 'campaigns' THEN
    PERFORM pg_advisory_xact_lock_shared(178438921, 2);
  ELSE
    PERFORM pg_advisory_xact_lock(178438921, 2);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.lock_campaign_client_ownership() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER campaign_client_ownership_lock
BEFORE INSERT OR UPDATE OF client_id, partner_id OR DELETE ON public.campaigns
FOR EACH STATEMENT EXECUTE FUNCTION private.lock_campaign_client_ownership();
CREATE TRIGGER client_campaign_ownership_lock
BEFORE UPDATE OF partner_id OR DELETE ON public.clients
FOR EACH STATEMENT EXECUTE FUNCTION private.lock_campaign_client_ownership();
CREATE TRIGGER partner_campaign_ownership_lock
BEFORE DELETE ON public.partners
FOR EACH STATEMENT EXECUTE FUNCTION private.lock_campaign_client_ownership();

CREATE OR REPLACE FUNCTION private.enforce_campaign_client_partner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE owner_partner uuid;
BEGIN
  IF NEW.client_id IS NULL THEN RETURN NEW; END IF;
  SELECT c.partner_id INTO owner_partner
  FROM public.clients c WHERE c.id = NEW.client_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign client does not exist' USING ERRCODE = '23503';
  END IF;
  IF NEW.partner_id IS DISTINCT FROM owner_partner THEN
    RAISE EXCEPTION 'Campaign partner must match its client owner; reload the client before saving'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_campaign_client_partner() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER campaign_client_partner_guard
BEFORE INSERT OR UPDATE OF client_id, partner_id ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION private.enforce_campaign_client_partner();

CREATE OR REPLACE FUNCTION private.sync_client_campaign_partner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
    UPDATE public.campaigns SET partner_id = NEW.partner_id
    WHERE client_id = NEW.id AND partner_id IS DISTINCT FROM NEW.partner_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_client_campaign_partner() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER client_campaign_partner_sync
AFTER UPDATE OF partner_id ON public.clients
FOR EACH ROW EXECUTE FUNCTION private.sync_client_campaign_partner();

-- Repair historical denormalization while writes are locked. Do not exclude
-- deleted campaigns: restoring one must never restore the former partner.
UPDATE public.campaigns ca SET partner_id = cl.partner_id
FROM public.clients cl
WHERE ca.client_id = cl.id AND ca.partner_id IS DISTINCT FROM cl.partner_id;
