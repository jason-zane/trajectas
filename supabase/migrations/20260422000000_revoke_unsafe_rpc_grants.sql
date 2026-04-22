-- Revoke EXECUTE on factor-mutation RPCs from the public/anon/authenticated
-- roles. These are SECURITY DEFINER and do no internal authorization check —
-- they rely on only being callable via the service-role admin client from
-- the app's server actions (src/app/actions/factors.ts uses
-- createAdminClient()).
--
-- Before this migration, any authenticated (or even anonymous) caller could
-- RPC these from the client, inserting or deleting factor rows with
-- arbitrary client_id. After: only the service_role (used by the admin
-- client) can execute them.

REVOKE EXECUTE ON FUNCTION public.delete_factor_cascade(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_factor_with_constructs(uuid, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
