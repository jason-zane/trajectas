-- =========================================================================
-- 20260512150000_trajectory_revoke_trigger_fn_exec.sql
--
-- Follow-up to 20260512140000_trajectory_person_key.sql.
--
-- The campaign_participants_auto_link_person() function is invoked only
-- by the BEFORE INSERT trigger on campaign_participants. It must NOT be
-- exposed via PostgREST's /rest/v1/rpc surface (Supabase advisor lint
-- 0028 / 0029). Revoke EXECUTE from anon, authenticated, and public so
-- the trigger remains functional (triggers run as table owner) but the
-- RPC entry is shut.
--
-- IDEMPOTENT.
-- =========================================================================

REVOKE EXECUTE ON FUNCTION public.campaign_participants_auto_link_person()
    FROM anon, authenticated, public;
