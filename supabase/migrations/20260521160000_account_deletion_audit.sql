-- =========================================================================
-- 20260521160000_account_deletion_audit.sql
--
-- Audit table for the Stage-B account-deletion cron (see PR
-- feat/account-deletion-cron). Every hard-delete writes one row here
-- BEFORE calling auth.admin.deleteUser, so we retain forensic evidence
-- of who was deleted, when, and why even after the user row itself
-- (and the cascaded profile) is gone.
--
-- Notes on shape:
--   - profile_id is intentionally NOT a FK. The whole point of this row
--     is that the profile (and the auth.users row it cascades from) is
--     about to be deleted; a FK would either CASCADE the audit away or
--     RESTRICT the deletion.
--   - email is stored at deletion time, not joined later, for the same
--     reason. This is the user's last known email.
--   - reason is a free-text string in case we ever add admin-initiated
--     deletions, GDPR data subject requests via legal, etc. Default
--     'user_requested' covers the only path that exists today.
--
-- RLS: only platform admins can read. No one can INSERT via the API —
-- the cron uses the service role.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.account_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  email text NOT NULL,
  deletion_requested_at timestamptz NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'user_requested',
  metadata jsonb
);

ALTER TABLE public.account_deletion_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_deletion_audit_select_platform_admin
  ON public.account_deletion_audit
  FOR SELECT
  USING (public.is_platform_admin());

-- No INSERT/UPDATE/DELETE policies — service role bypasses RLS.

CREATE INDEX IF NOT EXISTS account_deletion_audit_deleted_at_idx
  ON public.account_deletion_audit (deleted_at DESC);

COMMENT ON TABLE public.account_deletion_audit IS
  'Permanent record of account hard-deletions performed by the nightly cron. Written before auth.admin.deleteUser so it survives the cascade.';
