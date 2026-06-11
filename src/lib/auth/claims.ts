import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve the authenticated user's id by verifying the session JWT locally
 * against the project's JWKS (asymmetric signing keys) via getClaims().
 *
 * Unlike auth.getUser(), this does not call the Auth server on every
 * invocation — verification is local, with the JWKS cached in memory
 * (~10 min). getClaims() still drives the SSR client's token refresh when
 * the access token has expired, so middleware cookie refresh keeps working.
 *
 * Trade-off: a banned/deleted user's existing JWT keeps verifying locally
 * until it expires. Keep using auth.getUser() at true auth boundaries
 * (sign-in callback, destructive account actions) where revocation
 * freshness matters more than per-request latency. The allowlist is
 * enforced by tests/architecture/auth-hot-path.test.ts.
 */
export async function getVerifiedUserId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}
