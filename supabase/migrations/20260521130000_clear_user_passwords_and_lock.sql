-- =========================================================================
-- 20260521130000_clear_user_passwords_and_lock.sql
--
-- Trajectas is passwordless. Users sign in by receiving an OTP at their
-- email address; the UI never collects a password. However, every user in
-- auth.users currently has an `encrypted_password` (bcrypt 60-char hashes).
-- As long as those are non-NULL, an attacker who knows or guesses one can
-- authenticate via the `POST /auth/v1/token?grant_type=password` endpoint
-- that Supabase exposes by default — regardless of what our UI does.
--
-- This migration:
--   1. NULLs encrypted_password for every existing auth.users row.
--   2. Installs a BEFORE INSERT/UPDATE trigger on auth.users that re-NULLs
--      any incoming password hash. This belt-and-braces protects against
--      Supabase dashboard "Set password" actions, admin.updateUserById
--      calls, and any future signUp({password}) regressions.
--
-- Functional impact: zero. signInWithOtp / verifyOtp ignore the password
-- column. The companion architecture test (passwordless-only.test.ts)
-- prevents new src/ code from calling the password APIs.
--
-- The trigger function is SECURITY DEFINER and owned by postgres, with
-- EXECUTE revoked from anon/authenticated/public so it can never be called
-- as an RPC — only fires from the trigger.
--
-- IDEMPOTENT.
-- =========================================================================

UPDATE auth.users SET encrypted_password = NULL WHERE encrypted_password IS NOT NULL;

CREATE OR REPLACE FUNCTION public.auth_users_block_password_set()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.encrypted_password IS NOT NULL THEN
    NEW.encrypted_password := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auth_users_block_password_set()
  FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS block_password_set ON auth.users;

CREATE TRIGGER block_password_set
  BEFORE INSERT OR UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auth_users_block_password_set();
