-- =========================================================================
-- 20260521150000_profile_deletion_columns.sql
--
-- Adds account-deletion request tracking to public.profiles.
--
-- Two-stage deletion flow (see docs/runbook.md):
--   Stage A (this migration + PR feat/account-deletion-soft):
--     - User requests deletion → deletion_requested_at = now(),
--       scheduled_deletion_at = now() + 30 days
--     - During the grace period the user can still sign in and cancel;
--       cancellation clears both timestamps
--   Stage B (PR feat/account-deletion-cron, follow-up):
--     - Nightly cron sweeps profiles where scheduled_deletion_at < now()
--     - Calls auth.admin.deleteUser(profile.id) → cascades into auth.users
--     - Writes an audit entry per deletion
--
-- Both columns are nullable: NULL means the account has no pending
-- deletion. Adding columns is non-destructive — existing profiles get
-- NULL on both, which is the "no pending deletion" state.
--
-- RLS: existing profiles_update_own policy already permits the user to
-- update any column on their own row (except role, which is explicitly
-- locked in WITH CHECK). No new policy needed.
-- =========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at timestamptz;

-- Partial index so the stage-B cron can find ripe candidates cheaply.
-- Most profiles will never have these columns set, so a partial index
-- keeps the structure tiny.
CREATE INDEX IF NOT EXISTS profiles_scheduled_deletion_at_idx
  ON public.profiles (scheduled_deletion_at)
  WHERE scheduled_deletion_at IS NOT NULL;

COMMENT ON COLUMN public.profiles.deletion_requested_at IS
  'When the user requested account deletion. NULL = no request pending.';
COMMENT ON COLUMN public.profiles.scheduled_deletion_at IS
  'When the nightly cron will hard-delete this profile. Always 30 days after deletion_requested_at while the request is active.';
