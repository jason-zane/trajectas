#!/usr/bin/env node

/**
 * Production dependency audit for CI — fails on advisories, not on the registry.
 *
 * `npm audit --omit=dev --audit-level=high` exits 1 both when it finds a
 * high-severity advisory and when it could not reach the audit endpoint at all,
 * so the `security` job used to go red on registry blips. Three of those in one
 * day (a 400 from the retired quick-audit endpoint, two 503s) trained everyone
 * to re-run the job, which is the worst possible habit for a security gate.
 *
 * Two facts, both verified against the npm sources and a fake registry:
 *
 *   1. npm 10.x asks `/-/npm/v1/security/advisories/bulk` first and, on ANY
 *      failure, silently falls back to `/-/npm/v1/security/audits/quick` — an
 *      endpoint npm has retired, which answers 400 "Invalid package tree".
 *      That fallback is why the logs blamed the lockfile for a network problem.
 *      npm 11 dropped the fallback and only ever calls the bulk endpoint, so CI
 *      pins npm 11 (see .github/workflows/ci.yml) and a failure here is now
 *      always the bulk endpoint failing for real.
 *   2. npm does not retry the audit request. The body is gzipped into a stream,
 *      and make-fetch-happen will not replay a stream body, so the response
 *      carries `x-fetch-attempts: 1` even under `--fetch-retries=3`. The retry
 *      has to live out here.
 *
 * So: run the audit under `--json`, classify what came back, and only let a
 * genuine advisory fail the build.
 *
 *   real report, high/critical present   -> exit 1  (the gate doing its job)
 *   real report, clean at `high`         -> exit 0
 *   audit endpoint unreachable/5xx       -> retry; if it never lands, warn loudly and exit 0
 *   anything else (local npm error, 4xx  -> exit 1  (fail closed — that is not a blip)
 *     from bulk, unparseable output)
 *
 * The threshold is deliberately not configurable. Weakening the gate should
 * take a diff, not an environment variable.
 *
 * Usage:
 *   node scripts/audit-production-deps.mjs
 */

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Severities that fail the build. Matches `--audit-level=high`. */
export const FAILING_SEVERITIES = ["high", "critical"];

const ATTEMPTS = 4;
const BASE_DELAY_MS = 3_000;
const MAX_DELAY_MS = 30_000;

/**
 * Per-attempt ceiling. A hung request is a registry failure too, just a quieter
 * one — without this the job sits until the job timeout and goes red anyway.
 *
 * Sized off observation, not taste: on this change's own first CI run the audit
 * endpoint blew a 90s ceiling twice and then answered in 82s, so the registry is
 * capable of being slow rather than dead, and a tight ceiling throws away
 * attempts that were about to succeed. 4 x 150s plus backoff fits the job's
 * 20-minute budget with room for `npm ci` and gitleaks.
 */
const AUDIT_TIMEOUT_MS = 150_000;

/** The audit endpoints npm may call. A failure naming one of these is transport. */
const AUDIT_ENDPOINT = /\/-\/npm\/v1\/security\/(advisories\/bulk|audits(\/quick)?)\b/;

/** Retired in favour of the bulk endpoint; anything it says is noise, including its 400s. */
const RETIRED_ENDPOINT = /\/-\/npm\/v1\/security\/audits\/quick\b/;

/** Registry statuses worth another go. A 4xx from the bulk endpoint is not one. */
const isRetryableStatus = (status) => status >= 500 || status === 408 || status === 429;

/**
 * Decide what a single `npm audit --json` run actually told us.
 *
 * Returns one of:
 *   { outcome: "report", report }        a real advisory report came back
 *   { outcome: "transport", reason }     the audit endpoint failed; worth retrying
 *   { outcome: "unknown", reason }       something else went wrong; fail closed
 */
export function classifyAuditRun({ stdout, exitCode, timedOut = false }) {
  if (timedOut) {
    return {
      outcome: "transport",
      reason: `npm audit did not answer within ${AUDIT_TIMEOUT_MS / 1000}s.`,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return {
      outcome: "unknown",
      reason: `npm audit produced output that is not JSON (exit ${exitCode}).`,
    };
  }

  // A real report always carries the report version and the severity tallies.
  if (parsed && typeof parsed === "object" && "auditReportVersion" in parsed) {
    return { outcome: "report", report: parsed };
  }

  // npm's error shape: { message, uri?, statusCode?, body?, headers? }
  const message = typeof parsed?.message === "string" ? parsed.message : "";
  const uri = typeof parsed?.uri === "string" ? parsed.uri : "";
  const statusCode = typeof parsed?.statusCode === "number" ? parsed.statusCode : null;
  const target = `${uri} ${message}`;

  if (!AUDIT_ENDPOINT.test(target)) {
    return {
      outcome: "unknown",
      reason: message || `npm audit failed without a report (exit ${exitCode}).`,
    };
  }

  // The retired endpoint only ever gets hit as npm 10's fallback after bulk
  // already failed, so whatever it answers — 400 included — is a transport tell.
  if (statusCode === null || isRetryableStatus(statusCode) || RETIRED_ENDPOINT.test(target)) {
    return { outcome: "transport", reason: message || `audit endpoint failed (exit ${exitCode}).` };
  }

  return {
    outcome: "unknown",
    reason: `audit endpoint answered ${statusCode}, which is not a transient failure: ${message}`,
  };
}

/** Severity tallies from a report, defaulting missing buckets to 0. */
export function severityCounts(report) {
  const counts = report?.metadata?.vulnerabilities ?? {};
  return {
    info: counts.info ?? 0,
    low: counts.low ?? 0,
    moderate: counts.moderate ?? 0,
    high: counts.high ?? 0,
    critical: counts.critical ?? 0,
  };
}

/** True when the report contains something at or above `--audit-level=high`. */
export function hasFailingAdvisory(report) {
  const counts = severityCounts(report);
  return FAILING_SEVERITIES.some((severity) => counts[severity] > 0);
}

/** One line per failing package, with the advisories behind it. */
export function describeFailingAdvisories(report) {
  const lines = [];
  for (const [name, vuln] of Object.entries(report?.vulnerabilities ?? {})) {
    if (!FAILING_SEVERITIES.includes(vuln?.severity)) continue;
    const fix =
      vuln.fixAvailable === true
        ? "fix available"
        : vuln.fixAvailable
          ? `fix: ${vuln.fixAvailable.name}@${vuln.fixAvailable.version}${vuln.fixAvailable.isSemVerMajor ? " (semver-major)" : ""}`
          : "no fix available";
    lines.push(`  ${vuln.severity.toUpperCase().padEnd(8)} ${name} ${vuln.range ?? ""} — ${fix}`);
    for (const via of vuln.via ?? []) {
      if (typeof via === "object" && via.title) {
        lines.push(`      ${via.title}${via.url ? ` (${via.url})` : ""}`);
      }
    }
  }
  return lines;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Exponential backoff with ±20% jitter, so parallel jobs do not retry in lockstep. */
export function backoffMs(attempt, { base = BASE_DELAY_MS, max = MAX_DELAY_MS, random = Math.random } = {}) {
  const delay = base * 3 ** (attempt - 1);
  return Math.round(Math.min(delay * (0.8 + random() * 0.4), max));
}

function runNpmAudit() {
  const result = spawnSync("npm", ["audit", "--omit=dev", "--audit-level=high", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: AUDIT_TIMEOUT_MS,
    shell: process.platform === "win32",
  });

  // spawnSync signals a timeout through either channel depending on platform.
  const timedOut = result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM";
  if (result.error && !timedOut) {
    return { stdout: "", stderr: String(result.error.message), exitCode: -1, timedOut: false };
  }
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? -1,
    timedOut,
  };
}

/**
 * Run the audit, retrying only the failures that are the registry's fault.
 * `run` and `wait` are injected so the retry policy can be tested without a network.
 */
export async function auditWithRetry({ run = runNpmAudit, wait = sleep, attempts = ATTEMPTS, random } = {}) {
  let last = { outcome: "unknown", reason: "audit never ran" };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = run(attempt);
    last = classifyAuditRun(result);
    last.stderr = result.stderr;
    last.exitCode = result.exitCode;

    if (last.outcome !== "transport") return { ...last, attempts: attempt };

    console.warn(`audit-production-deps: attempt ${attempt}/${attempts} — ${last.reason}`);
    if (attempt < attempts) {
      const delay = backoffMs(attempt, random ? { random } : {});
      console.warn(`audit-production-deps: retrying in ${Math.round(delay / 1000)}s.`);
      await wait(delay);
    }
  }

  return { ...last, attempts };
}

/** Surface a transport give-up in the Actions UI without going red. */
function warnInCi(message) {
  console.warn(`::warning title=npm audit unreachable::${message}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `> ⚠️ **npm audit skipped** — ${message}\n`
    );
  }
}

async function main() {
  const npmVersion = spawnSync("npm", ["--version"], { encoding: "utf8" }).stdout?.trim();
  console.log(`audit-production-deps: npm ${npmVersion ?? "unknown"}, failing at ${FAILING_SEVERITIES.join("/")}.`);

  const result = await auditWithRetry();

  if (result.outcome === "transport") {
    warnInCi(
      `the npm audit endpoint failed ${result.attempts} times (${result.reason}). ` +
        "No advisory data was returned, so nothing was verified — this is a registry outage, not a clean bill of health."
    );
    return 0;
  }

  if (result.outcome === "unknown") {
    console.error(`audit-production-deps: ${result.reason}`);
    if (result.stderr) console.error(result.stderr);
    console.error(
      "This is not a transient registry failure. Check the lockfile is installed (`npm ci`) and the audit command is well-formed."
    );
    return 1;
  }

  const counts = severityCounts(result.report);
  console.log(
    `audit-production-deps: critical ${counts.critical}, high ${counts.high}, ` +
      `moderate ${counts.moderate}, low ${counts.low}, info ${counts.info}.`
  );

  if (hasFailingAdvisory(result.report)) {
    console.error("\naudit-production-deps: high-severity advisories in production dependencies:\n");
    for (const line of describeFailingAdvisories(result.report)) console.error(line);
    console.error(
      "\nRun `npm audit fix` and commit the lockfile bump as its own chore(deps) commit. " +
        "If no patched version exists yet, raise it — do not relax the audit level."
    );
    return 1;
  }

  // We decide from the tallies rather than npm's exit code, so the two
  // disagreeing means npm failed for a reason this script does not model.
  // Nothing about that is transient, so fail closed rather than guess.
  if (result.exitCode !== 0) {
    console.error(
      `audit-production-deps: npm exited ${result.exitCode} on a report with no high or critical advisories.`
    );
    if (result.stderr) console.error(result.stderr);
    return 1;
  }

  console.log("audit-production-deps: no high or critical advisories in production dependencies.");
  return 0;
}

// Percent-encoding matters here: a hand-built `file://` string stops matching
// as soon as the checkout path contains a space, and a mismatch would leave the
// security gate silently doing nothing and exiting 0.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error("audit-production-deps: unexpected failure", error);
      process.exit(1);
    }
  );
}
