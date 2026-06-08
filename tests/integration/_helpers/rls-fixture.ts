/**
 * Shared fixture helpers for RLS / tenant-isolation integration tests.
 *
 * Extracted from the (previously duplicated) `createTestUser` helper in
 * tenant-isolation.test.ts, org-diagnostic-rls.test.ts and
 * trajectory-person-key.test.ts — both of which left a comment asking for
 * exactly this extraction once a third copy appeared.
 *
 * Two invariants this module enforces:
 *
 *  1. Passwordless / OTP-only. Trajectas never sets passwords (see AGENTS.md
 *     and migration 20260521130000_clear_user_passwords_and_lock.sql, which
 *     installs a trigger that NULLs any encrypted_password). The old fixtures
 *     used `admin.createUser({ password })` + `signInWithPassword`, which the
 *     trigger silently broke — the tests could never authenticate. We now
 *     authenticate the way real users do: `generateLink` → `email_otp` →
 *     `verifyOtp`, mirroring src/lib/auth/otp.ts and src/app/actions/auth.ts.
 *
 *  2. Local-only. `.env.local` points at PRODUCTION. Running `npm test` /
 *     `npm run test:integration` (instead of `test:integration:local`) would
 *     otherwise let these DB-mutating tests write rows to prod. `canRun`
 *     whitelists local hosts only, so the suite skips everywhere else.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Load .env.local without overriding anything already in process.env. */
function loadEnvFile() {
  try {
    const envPath = resolve(HERE, "../../../.env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx);
      const value = trimmed.slice(eqIdx + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local not present — rely on process.env (e.g. CI).
  }
}

loadEnvFile();

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Pure predicate: is this URL a local Supabase host? Only localhost /
 * 127.0.0.1 / Docker-internal / the Kong gateway count. Exported so the guard
 * itself is unit-tested and can't silently regress.
 */
export function isLocalSupabaseUrl(url: string | null | undefined): boolean {
  return (
    !!url &&
    /^(https?:\/\/)?(127\.0\.0\.1|localhost|host\.docker\.internal|kong)(:\d+)?(\/|$)/.test(
      url,
    )
  );
}

/**
 * Fail-closed guard. Throws if a Supabase URL is configured but is NOT local.
 * A properly guarded test skips (via `skipIf(!canRun)`) before reaching here;
 * this is the defence-in-depth net for when that per-file guard is missing or
 * wrong, so a misconfigured run (`npm test` / `npm run test:integration` with
 * `.env.local` pointing at prod) can never open a privileged connection to
 * production — it aborts loudly instead of writing rows.
 *
 * No-op when no URL is configured (CI), so guarded tests still skip there.
 */
export function assertLocalSupabaseUrl(url: string | null | undefined): void {
  if (url && !isLocalSupabaseUrl(url)) {
    throw new Error(
      `Refusing to open a Supabase connection from an integration test: ` +
        `NEXT_PUBLIC_SUPABASE_URL points at a non-local host (${url}). ` +
        `Integration tests may only run against a local stack — use ` +
        `\`npm run test:integration:local\`. (.env.local points at production.)`,
    );
  }
}

/**
 * Hard safety gate: only ever run against a local Supabase stack. `.env.local`
 * points at production by default, so anything that isn't localhost /
 * 127.0.0.1 / Docker-internal / the Kong gateway is refused.
 */
export const isLocalSupabase = isLocalSupabaseUrl(SUPABASE_URL);

export const canRun =
  Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY && SUPABASE_ANON_KEY) &&
  isLocalSupabase;

/** Service-role client for privileged setup/teardown (bypasses RLS). */
export function createAdminClient(): SupabaseClient {
  // Fail loud before connecting if pointed at a non-local host.
  assertLocalSupabaseUrl(SUPABASE_URL);
  if (!canRun) return null as never;
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
}

type TestRole = "platform_admin" | "partner_admin" | "org_admin" | "consultant";

/**
 * Create an auth user + profile and return an RLS-scoped anon client signed in
 * as that user — entirely via the passwordless OTP flow. No password is ever
 * set, so this exercises the same auth path production uses.
 */
export async function createTestUser(
  admin: SupabaseClient,
  opts: {
    email: string;
    role: TestRole;
    partnerId?: string;
    clientId?: string;
    firstName?: string;
    lastName?: string;
  },
): Promise<{ userId: string; client: SupabaseClient }> {
  // Fail loud before any write if pointed at a non-local host (defence in depth;
  // the admin client passed in is already guarded, but this also covers the
  // anon client created below).
  assertLocalSupabaseUrl(SUPABASE_URL);
  // 1. Create the auth user WITHOUT a password (OTP-only model).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: opts.email,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(
      `Failed to create auth user ${opts.email}: ${createErr?.message}`,
    );
  }
  const userId = created.user.id;

  // 2. Insert the profile via the admin client (bypasses RLS).
  const { error: profileErr } = await admin.from("profiles").insert({
    id: userId,
    email: opts.email,
    role: opts.role,
    partner_id: opts.partnerId ?? null,
    client_id: opts.clientId ?? null,
    first_name: opts.firstName ?? "Test",
    last_name: opts.lastName ?? opts.role,
  });
  if (profileErr) {
    throw new Error(
      `Failed to create profile for ${opts.email}: ${profileErr.message}`,
    );
  }

  // 3. Sign in via the real OTP flow: generateLink yields the email_otp code
  //    (see src/lib/auth/otp.ts), then verifyOtp establishes the session
  //    (see src/app/actions/auth.ts). This is what a real user does.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: opts.email,
  });
  if (linkErr) {
    throw new Error(
      `Failed to generate OTP for ${opts.email}: ${linkErr.message}`,
    );
  }
  const otp = link?.properties?.email_otp;
  if (!otp) {
    throw new Error(`OTP generation returned no email_otp for ${opts.email}`);
  }

  const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  const { error: verifyErr } = await client.auth.verifyOtp({
    email: opts.email,
    token: otp,
    type: "email",
  });
  if (verifyErr) {
    throw new Error(
      `Failed to verify OTP for ${opts.email}: ${verifyErr.message}`,
    );
  }

  return { userId, client };
}
