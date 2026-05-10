#!/usr/bin/env node

/**
 * Run integration tests against the LOCAL Supabase stack.
 *
 * Why this exists:
 *   The integration test files (e.g., tests/integration/tenant-isolation.test.ts)
 *   read NEXT_PUBLIC_SUPABASE_URL etc. from process.env, falling back to
 *   .env.local. By default .env.local points at PRODUCTION — which means
 *   running `npm run test:integration` directly creates rows in prod (yes,
 *   really).
 *
 *   This script overrides those env vars with the local Supabase values from
 *   `supabase status -o env` before delegating to vitest. Use this for any
 *   integration work that touches the DB locally.
 *
 * Usage:
 *   npm run test:integration:local                              # all integration tests
 *   npm run test:integration:local -- tests/integration/foo.ts  # a specific file
 */

import { execFileSync } from "node:child_process";

// Pull local Supabase env vars
const envOutput = execFileSync("npx", ["supabase", "status", "-o", "env"], {
  encoding: "utf-8",
});

const localEnv = {};
for (const line of envOutput.split("\n")) {
  const match = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (match) localEnv[match[1]] = match[2];
}

if (!localEnv.API_URL || !localEnv.SERVICE_ROLE_KEY || !localEnv.ANON_KEY) {
  console.error(
    "Could not resolve local Supabase env. Is the stack running? Try: npm run db:test:start",
  );
  process.exit(1);
}

// Map local-style names to the names the test files expect
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: localEnv.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: localEnv.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: localEnv.SERVICE_ROLE_KEY,
};

// Delegate to vitest. Pass through any extra args (e.g. a specific test file).
const extra = process.argv.slice(2);
const args = ["vitest", "run", "tests/integration", ...extra];

try {
  execFileSync("npx", args, { stdio: "inherit", env });
} catch {
  process.exit(1);
}
