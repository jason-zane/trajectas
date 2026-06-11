/**
 * Architectural guard: any exported Server Action that opens the *admin*
 * Supabase client (`createAdminClient`, service role — which BYPASSES RLS and
 * tenant isolation) must also perform an *authorization* check. An
 * admin-client action without an authz gate is a cross-tenant data hole.
 *
 * Hardened 2026-06-11 after two prior findings (F-003 email-template authz,
 * report-PDF IDOR) regressed precisely through this test's blind spots:
 *
 *  1. AUTHENTICATION IS NOT AUTHORIZATION. `resolveSessionActor()` /
 *     `.auth.getUser()` only prove the caller is signed in — any active user
 *     in any tenant passes. They no longer count as gates. Self-service
 *     actions that genuinely operate only on the caller's own rows belong in
 *     the allowlist with a reason.
 *  2. READS ARE ENFORCED TOO. An admin-client read returns tenant data just
 *     as leaked as a mutation. Intentionally-public reads go in
 *     READ_ALLOWLIST as a conscious, reviewed decision.
 *  3. A `token: string` PARAMETER IS NOT A GATE. Only an in-function call to
 *     a validating helper counts.
 *  4. ALL `'use server'` MODULES ARE SCANNED, wherever they live under src/
 *     (module-level directive). Inline `'use server'` closures inside
 *     components are not statically analyzable here — keep admin-client use
 *     out of component files (no-db-in-components guards the client side).
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC_DIR = join(ROOT, "src");

/** Module-level `use server` directive (top of file) or inline directive line. */
const USE_SERVER_RE = /^\s*(['"])use server\1;?\s*$/m;

/**
 * Authorization evidence: scope/tenancy checks and token validation.
 * Deliberately ABSENT: resolveSessionActor, .auth.getUser, getCurrentProfile,
 * getAuthenticatedActor — authentication-only (see header).
 */
const AUTHZ_PATTERNS = [
  // require<Something>() / require360Admin() helpers (incl. digits).
  /\brequire[A-Za-z0-9]\w*\s*\(/,
  // assert<Something>() guards — assertAdminOnly, assertCanManageEmailScope, …
  /\bassert[A-Z]\w*\s*\(/,
  // canManage* / canAccess* boolean scope checks (used as `if (!canX(...)) throw`).
  /\bcanManage[A-Z]\w*\s*\(/,
  /\bcanAccess[A-Z]\w*\s*\(/,
  /resolveAuthorizedScope\s*\(/,
  /getValidatedSupportSession\s*\(/,
  // Participant/report token validation — the call, not a parameter name.
  /\bverify\w*Token\s*\(/,
  /\bvalidateAccessToken\s*\(/,
  /timingSafeEqual\s*\(/,
];

const MUTATION_RE = /\.(insert|update|delete|upsert|rpc)\s*\(/;
const STORAGE_WRITE_RE = /\.storage\b[\s\S]{0,120}?\.(upload|remove|move|copy)\s*\(/;

// `${relativePath}#${functionName}` -> reason. Vetted exceptions only.
const MUTATION_ALLOWLIST = new Map<string, string>([
  [
    "src/app/actions/account-deletion.ts#requestAccountDeletion",
    "Self-service: gated on the caller's own session userId (deletes own account).",
  ],
  [
    "src/app/actions/assess.ts#registerViaLink",
    "Participant self-registration; authorised by the campaign invite link token (linkToken).",
  ],
  [
    "src/app/(marketing)/actions/submit-contact.ts#submitContact",
    "Public marketing contact form (unauthenticated by design): zod-validated, rate-limited at the proxy, writes only contact_submissions.",
  ],
  [
    "src/app/actions/assess.ts#saveResponseLite",
    "Participant save path: authorization delegated to the hardened SECURITY DEFINER RPC save_response_for_session, which validates the access-token ↔ session ↔ item chain in-database.",
  ],
  [
    "src/app/actions/assess.ts#updateSessionProgressLite",
    "Participant save path: authorization delegated to the SECURITY DEFINER RPC update_session_progress_for_session (token ↔ session validated in-database).",
  ],
  [
    "src/app/actions/profile.ts#updateDisplayName",
    "Self-service: updates only the caller's own profiles row, keyed by the session user id from auth.getUser().",
  ],
]);

// Admin-client READS that are intentionally callable without a scope check.
// Every entry is a conscious decision — keep reasons concrete.
const READ_ALLOWLIST = new Map<string, string>([
  [
    "src/app/actions/assess.ts#getAssessmentItemCount",
    "Returns only an aggregate item count (no item content); used by the participant intro before a session exists.",
  ],
  [
    "src/app/actions/content-sources.ts#getContentSources",
    "Platform-curated generation reference library (no tenant rows); listed in admin/partner library UIs.",
  ],
  [
    "src/app/actions/content-sources.ts#getContentSourceById",
    "Platform-curated generation reference library (no tenant rows).",
  ],
  [
    "src/app/actions/experience.ts#getExperienceTemplate",
    "Participant-facing assess theming/flow config, fetched from token-validated /assess pages with NO user session — a user-scope gate here would break the runner. Presentation config only. Follow-up: split an internal lib helper (same pattern as reports pdf-access) and gate the workspace-facing surface.",
  ],
  [
    "src/app/actions/experience.ts#getPlatformExperienceTemplate",
    "Delegates to getExperienceTemplate (see above); flagged only because file-chunking attributes a private campaign-count helper's admin read to this export.",
  ],
  [
    "src/app/actions/item-selection-rules.ts#getItemSelectionRulesForEstimate",
    "Platform-wide item-selection algorithm parameters; pure reference data, no tenant rows.",
  ],
  [
    "src/app/actions/item-selection-rules.ts#getItemsPerConstructForCount",
    "Platform-wide item-selection algorithm parameters; pure reference data, no tenant rows.",
  ],
  [
    "src/app/actions/platform-settings.ts#getPlatformBandScheme",
    "Platform-default score band scheme; reference presentation data with no tenant rows.",
  ],
  [
    "src/app/actions/report-resend.ts#requestNewReportLink",
    "Public by design (expired-report resend): constant {ok:true} response regardless of match, and the new link is emailed only to the participant address already stored on the snapshot.",
  ],
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

interface Fn {
  name: string;
  body: string;
}

/**
 * Split a file into exported-async-function chunks (name + body to next export).
 * Matches both `export async function name` and
 * `export const name = async (...) =>` (arrow Server Actions).
 */
function exportedAsyncFunctions(text: string): Fn[] {
  const re =
    /export\s+(?:async\s+function\s+(\w+)|const\s+(\w+)\s*(?::[^=]+)?=\s*async\b)/g;
  const marks: Array<{ name: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    marks.push({ name: m[1] ?? m[2], index: m.index });
  }

  return marks.map((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    return { name: mark.name, body: text.slice(mark.index, end) };
  });
}

function serverDirectiveFiles(): Array<{ rel: string; text: string }> {
  return walk(SRC_DIR)
    .map((file) => ({
      rel: file.replace(`${ROOT}/`, ""),
      text: readFileSync(file, "utf8"),
    }))
    .filter(({ text }) => USE_SERVER_RE.test(text));
}

function collectViolations(kind: "mutation" | "read"): string[] {
  const violations: string[] = [];

  for (const { rel, text } of serverDirectiveFiles()) {
    for (const fn of exportedAsyncFunctions(text)) {
      if (!/createAdminClient\s*\(/.test(fn.body)) continue;

      const isMutation =
        MUTATION_RE.test(fn.body) || STORAGE_WRITE_RE.test(fn.body);
      if (kind === "mutation" ? !isMutation : isMutation) continue;

      if (AUTHZ_PATTERNS.some((re) => re.test(fn.body))) continue;

      const allowlist =
        kind === "mutation" ? MUTATION_ALLOWLIST : READ_ALLOWLIST;
      if (allowlist.has(`${rel}#${fn.name}`)) continue;

      violations.push(`${rel}#${fn.name}`);
    }
  }

  return violations;
}

describe("admin-client actions are authorization-gated", () => {
  it("every admin-client MUTATION performs an authorization check", () => {
    const violations = collectViolations("mutation");

    if (violations.length > 0) {
      throw new Error(
        `These Server Actions write through the admin (service-role) client with no authorization gate:\n` +
          violations.map((v) => `  ${v}`).join("\n") +
          `\n\ncreateAdminClient bypasses RLS. Authentication (resolveSessionActor / auth.getUser) is NOT\n` +
          `enough — any signed-in user in any tenant passes it. Each action must call a scope check\n` +
          `(require*/assert*/canManage*/resolveAuthorizedScope) or validate a token in-function.\n` +
          `Genuine self-service/public exceptions go in MUTATION_ALLOWLIST with a reason.`,
      );
    }

    expect(violations).toHaveLength(0);
  });

  it("every admin-client READ performs an authorization check", () => {
    const violations = collectViolations("read");

    if (violations.length > 0) {
      throw new Error(
        `These Server Actions read through the admin (service-role) client with no authorization gate:\n` +
          violations.map((v) => `  ${v}`).join("\n") +
          `\n\nAdmin-client reads return cross-tenant data just as leaked as writes (this is how the\n` +
          `email-template and report-PDF reads regressed). Add a scope check or token validation,\n` +
          `or — only for genuinely public reference data — add to READ_ALLOWLIST with a reason.`,
      );
    }

    expect(violations).toHaveLength(0);
  });

  it("report-PDF storage helpers stay un-exported from Server Actions", () => {
    // Pinning test for the report-PDF IDOR fix: these RLS-bypassing helpers
    // live in src/lib/reports/pdf-access.ts and must never be re-exported
    // from a 'use server' module (every export there is a public endpoint).
    const offenders = serverDirectiveFiles().filter(({ text }) =>
      /export\s+(?:async\s+function\s+|const\s+)(getSignedReportPdfUrl|downloadSnapshotPdfBase64)\b/.test(
        text,
      ),
    );

    expect(
      offenders.map((o) => o.rel),
      "getSignedReportPdfUrl / downloadSnapshotPdfBase64 are unauthorized storage access — keep them in src/lib/reports/pdf-access.ts, never exported from a 'use server' file",
    ).toHaveLength(0);
  });
});
