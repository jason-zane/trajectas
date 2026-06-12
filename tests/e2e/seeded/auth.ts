import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

/**
 * The seeded admin actor (see supabase/seed.sql). An org-admin of "Seeded
 * Client Co" — on the single-host e2e harness the request surface always
 * resolves to "public", so this actor reaches the seeded campaigns/participants
 * through its client membership, not via platform-admin. Sessions are minted
 * here at test time; no password ever exists for this user (passwordless model).
 */
export const SEEDED_ADMIN = {
  id: "10000000-0000-0000-0000-000000000111",
  email: "seed-admin@seeded-client-co.test",
} as const;

/** Where the minted Playwright storageState is written. Gitignored. */
export const ADMIN_STORAGE_STATE = resolve(
  process.cwd(),
  "tests/e2e/seeded/.auth/admin.json"
);

const DEFAULT_SUPABASE_URL = "http://127.0.0.1:54321";

interface SupabaseTestEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
}

function parseEnvContent(content: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

function readEnvFile(filePath: string): Record<string, string> {
  return existsSync(filePath) ? parseEnvContent(readFileSync(filePath, "utf8")) : {};
}

function readSupabaseStatusEnv(cwd: string): Record<string, string> {
  try {
    const output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parseEnvContent(output);
  } catch {
    return {};
  }
}

/**
 * Resolve the local Supabase URL + keys the same way the e2e dev server does
 * (scripts/testing/run-next-dev-test.mjs): process.env first (CI exports them
 * via `supabase status -o env`), then .env.e2e.local, then a live
 * `supabase status` call. The URL must match what the app uses so the
 * @supabase/ssr cookie storage key lines up.
 */
// CI exports the Supabase env via `supabase status -o env >> $GITHUB_ENV`,
// which keeps the surrounding quotes (e.g. API_URL="http://127.0.0.1:54321"),
// so process.env values arrive quoted. The file/status parsers already strip
// quotes; do the same for anything read straight from process.env.
function stripQuotes(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function resolveSupabaseEnv(): SupabaseTestEnv {
  const cwd = process.cwd();
  const fileEnv = readEnvFile(resolve(cwd, ".env.e2e.local"));

  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = stripQuotes(process.env[key]);
      if (value) return value;
    }
    for (const key of keys) {
      if (fileEnv[key]) return fileEnv[key];
    }
    return undefined;
  };

  let url = pick("NEXT_PUBLIC_SUPABASE_URL", "API_URL");
  let anonKey = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY", "ANON_KEY");
  let serviceKey = pick("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceKey) {
    const statusEnv = readSupabaseStatusEnv(cwd);
    url = url ?? statusEnv.NEXT_PUBLIC_SUPABASE_URL ?? statusEnv.API_URL;
    anonKey =
      anonKey ?? statusEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? statusEnv.ANON_KEY;
    serviceKey =
      serviceKey ??
      statusEnv.SUPABASE_SERVICE_ROLE_KEY ??
      statusEnv.SERVICE_ROLE_KEY;
  }

  if (!anonKey || !serviceKey) {
    throw new Error(
      "[seeded-auth] Could not resolve local Supabase anon/service keys. " +
        "Run `npm run db:test:start` and `npm run db:test:env`, or create " +
        ".env.e2e.local from .env.e2e.example."
    );
  }

  const resolvedUrl = url ?? DEFAULT_SUPABASE_URL;
  assertLocalSupabaseUrl(resolvedUrl);
  return { url: resolvedUrl, anonKey, serviceKey };
}

// Fail closed: this harness mints sessions with a service-role key, so it must
// never run against a hosted project. If a shell/CI already exports
// NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY pointing at production,
// refuse rather than mutate prod auth state. Mirrors the integration-test guard
// (assertLocalSupabaseUrl) described in AGENTS.md.
function assertLocalSupabaseUrl(url: string): void {
  const isLocal =
    /^(https?:\/\/)?(127\.0\.0\.1|localhost|0\.0\.0\.0|host\.docker\.internal|kong)(:\d+)?(\/|$)/.test(
      url
    );
  if (!isLocal) {
    throw new Error(
      `[seeded-auth] Refusing to mint a session against non-local Supabase URL "${url}". ` +
        "This harness uses a service-role key and only runs against the local stack. " +
        "Unset NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY (or point them at the " +
        "local stack) before running the seeded suite."
    );
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Mint an authenticated session for the seeded admin and persist it as a
 * Playwright storageState file.
 *
 * Flow: the service-role client generates a one-time magic-link token for the
 * pre-seeded auth.users row, then a @supabase/ssr server client verifies it.
 * We capture the cookies that client writes — using the exact same library the
 * app reads them with — so the names, base64 encoding, and chunking all match.
 * No production auth path is touched; this only talks to the local Supabase
 * stack and writes a local file.
 */
export async function mintAdminStorageState(): Promise<void> {
  const { url, anonKey, serviceKey } = resolveSupabaseEnv();

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: SEEDED_ADMIN.email,
    });

  if (linkError || !linkData?.properties?.hashed_token) {
    throw new Error(
      `[seeded-auth] generateLink failed for ${SEEDED_ADMIN.email}: ` +
        `${linkError?.message ?? "no hashed_token returned"}`
    );
  }

  const tokenHash = linkData.properties.hashed_token;

  // In-memory cookie jar that mirrors what @supabase/ssr would set on a
  // response. Chunked auth cookies replace cleanly because each chunk is keyed
  // by its full name; a maxAge:0 entry is a deletion.
  const jar = new Map<string, string>();
  const ssr = createServerClient(url, anonKey, {
    cookies: {
      getAll: () =>
        Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          if (options && options.maxAge === 0) {
            jar.delete(name);
          } else {
            jar.set(name, value);
          }
        }
      },
    },
  });

  // The magic-link token is an email OTP under the hood; "email" is the modern
  // verify type for it. Fall back to the legacy "magiclink" type if the local
  // GoTrue rejects it.
  let verifyError = (
    await ssr.auth.verifyOtp({ token_hash: tokenHash, type: "email" })
  ).error;
  if (verifyError) {
    verifyError = (
      await ssr.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" })
    ).error;
  }
  if (verifyError) {
    throw new Error(
      `[seeded-auth] verifyOtp failed for ${SEEDED_ADMIN.email}: ${verifyError.message}`
    );
  }

  // setAll is driven by the SIGNED_IN auth-state event, which is delivered
  // during verifyOtp but flush defensively in case it lands a tick later.
  for (let i = 0; i < 50 && jar.size === 0; i++) {
    await sleep(20);
  }
  if (jar.size === 0) {
    throw new Error(
      "[seeded-auth] verifyOtp succeeded but no auth cookies were captured."
    );
  }

  const domain = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3101"
  ).hostname;

  const storageState = {
    cookies: Array.from(jar, ([name, value]) => ({
      name,
      value,
      domain,
      path: "/",
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    })),
    origins: [] as never[],
  };

  mkdirSync(dirname(ADMIN_STORAGE_STATE), { recursive: true });
  writeFileSync(ADMIN_STORAGE_STATE, JSON.stringify(storageState, null, 2));
}
