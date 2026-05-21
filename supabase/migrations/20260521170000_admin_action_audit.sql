-- =========================================================================
-- 20260521170000_admin_action_audit.sql
--
-- Audit table for every write action performed by platform admins via
-- /admin (Phase 1 of the admin dashboard — see
-- docs/superpowers/plans/2026-05-21-admin-dashboard.md).
--
-- Every server action under /admin that mutates anything beyond the
-- admin's own profile MUST insert a row here. This is the accountability
-- spine the production-readiness audit asked for (Section 14 P1, "Audit
-- log for admin actions on user data").
--
-- Shape:
--   - actor_profile_id — the admin who did the thing
--   - action          — short verb-noun string, e.g. 'resend_otp',
--                       'force_sign_out', 'cancel_pending_deletion'
--   - target_profile_id — the user the action was performed on; nullable
--                       because some actions target non-user entities
--   - target_kind     — what kind of entity was targeted; defaults to
--                       'profile' since most actions target users
--   - target_id       — UUID of the target when not a profile (campaign,
--                       assessment, etc.); nullable
--   - payload         — jsonb capturing any action-specific arguments
--                       (e.g. for resend_otp: { redirect_path: ... })
--   - created_at      — when the action ran
--
-- RLS: read access for platform admins only; the table is INSERT-only
-- in practice and the service role bypasses RLS. No policy is defined
-- for INSERT/UPDATE/DELETE — admins must not amend the audit trail.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.admin_action_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id uuid NOT NULL,
  action text NOT NULL,
  target_profile_id uuid,
  target_kind text NOT NULL DEFAULT 'profile',
  target_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_action_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_action_audit_select_platform_admin
  ON public.admin_action_audit
  FOR SELECT
  USING (public.is_platform_admin());

CREATE INDEX IF NOT EXISTS admin_action_audit_created_at_idx
  ON public.admin_action_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_action_audit_target_profile_id_idx
  ON public.admin_action_audit (target_profile_id, created_at DESC)
  WHERE target_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS admin_action_audit_actor_profile_id_idx
  ON public.admin_action_audit (actor_profile_id, created_at DESC);

COMMENT ON TABLE public.admin_action_audit IS
  'Append-only log of every mutating action performed via the /admin surface. Insert via lib/admin/log-action.ts; never amended.';
