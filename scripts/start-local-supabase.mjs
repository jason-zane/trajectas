#!/usr/bin/env node
/**
 * Start the local Supabase stack, surviving Docker Hub's anonymous pull limit.
 *
 * `supabase start` pulls a dozen images anonymously. On a busy runner Docker
 * Hub answers `toomanyrequests: Rate exceeded`, and the CLI still prints
 * "Started supabase local development setup" and exits 0 — with the auth
 * container missing. The failure then surfaces two steps later as
 * AuthenticationRequiredError in the browser tests, which reads like an
 * application bug and is how this cost an afternoon on 2026-09-04.
 *
 * So this script does two things the bare command does not:
 *
 *   1. Verifies the stack is actually serving before declaring success —
 *      specifically GoTrue, since a partial pull most often loses it and that
 *      is what every authenticated test depends on.
 *   2. Retries with backoff on a rate-limited pull, tearing the stack down
 *      between attempts so a half-pulled state does not wedge the next one.
 *
 * A pull limit is time-windowed, so waiting is the actual remedy. Anything
 * that is not a rate limit fails immediately — a broken migration or a port
 * clash will not fix itself, and retrying it just burns runner minutes.
 */

import { spawnSync } from "node:child_process";

const ATTEMPTS = Number(process.env.SUPABASE_START_ATTEMPTS ?? 4);
const BACKOFF_MS = [20_000, 45_000, 90_000];
const HEALTH_TIMEOUT_MS = 60_000;

const RATE_LIMIT = /toomanyrequests|rate exceeded|429 Too Many Requests|pull rate limit/i;

function run(command, args, { capture = true } = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (capture) process.stdout.write(stdout + stderr);
  return { code: result.status ?? 1, output: stdout + stderr };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The API URL and anon key, read back from the CLI once it claims to be up. */
function readStatus() {
  const { code, output } = run("npx", ["supabase", "status", "-o", "env"]);
  if (code !== 0) return null;
  const read = (key) => {
    const match = new RegExp(`^${key}="?([^"\\n]+)"?$`, "m").exec(output);
    return match?.[1];
  };
  const apiUrl = read("API_URL");
  const anonKey = read("ANON_KEY");
  return apiUrl && anonKey ? { apiUrl, anonKey } : null;
}

/**
 * True once GoTrue answers. `/auth/v1/health` is unauthenticated but the
 * gateway still wants an apikey, so send one.
 */
async function authIsServing({ apiUrl, anonKey }) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastError = "no attempt made";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiUrl}/auth/v1/health`, {
        headers: { apikey: anonKey },
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) return true;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(2_000);
  }
  console.error(`  auth never answered within ${HEALTH_TIMEOUT_MS / 1000}s: ${lastError}`);
  return false;
}

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  console.log(`::group::supabase start (attempt ${attempt}/${ATTEMPTS})`);
  const { code, output } = run("npx", ["supabase", "start"]);
  console.log("::endgroup::");

  const rateLimited = RATE_LIMIT.test(output);

  if (code === 0 && !rateLimited) {
    const status = readStatus();
    if (status && (await authIsServing(status))) {
      console.log("Local Supabase stack is up and auth is serving.");
      process.exit(0);
    }
    console.error("Stack reported success but is not serving — treating as a failed start.");
  } else if (code === 0 && rateLimited) {
    // The exit code lies when only some images were pulled. Trust the log.
    console.error("Docker Hub rate-limited part of the pull; the stack is incomplete.");
  }

  if (!rateLimited && code !== 0) {
    console.error("supabase start failed for a reason that is not a pull limit — not retrying.");
    process.exit(code);
  }

  if (attempt === ATTEMPTS) break;

  const wait = BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)];
  console.log(`Tearing the stack down and retrying in ${wait / 1000}s.`);
  run("npx", ["supabase", "stop", "--no-backup"]);
  await sleep(wait);
}

console.error(
  "::error::Local Supabase stack never came up. Docker Hub's anonymous pull " +
    "limit is the usual cause; authenticating the runner to Docker Hub would " +
    "remove it for good."
);
process.exit(1);
