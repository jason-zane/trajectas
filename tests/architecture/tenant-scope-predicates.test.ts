/**
 * Architectural guard: a read of a tenant-scoped table must derive its own
 * tenant predicate. RLS is a floor, not the workspace boundary.
 *
 * WHY THIS EXISTS
 *
 * Postgres does not know which workspace the caller is standing in. The active
 * context and any support session live in a signed cookie (`tf_active_context`,
 * src/lib/auth/active-context.ts) that never reaches the database, and the two
 * helper functions every policy leans on are blind to it:
 *
 *   - auth_user_client_ids() returns EVERY membership, active workspace or not.
 *   - is_platform_admin() is role-only, so for a platform admin RLS is not a
 *     tenant boundary at all — including mid support session.
 *
 * So a query that carries no predicate of its own returns rows from outside the
 * workspace the user is looking at. That is not hypothetical: the Compare
 * participant picker served all 51 participants across 3 clients from inside
 * one client's portal (fix: "confine the comparison picker to the active
 * workspace"). This test exists so the next such query fails CI instead of
 * production.
 *
 * WHAT COUNTS AS SCOPED
 *
 * Any one of:
 *   - an explicit id predicate in the query chain — `.eq('client_id', …)`,
 *     `.in('campaign_id', …)`, `.eq('campaigns.client_id', …)`;
 *   - an authorization gate in the enclosing function — `requireCampaignAccess`
 *     and friends, which resolve access through resolveAuthorizedScope();
 *   - `resolveTenantClientFilter` / `applyTenantClientFilter` /
 *     `getAccessibleCampaignIds`, which return the workspace boundary directly;
 *   - a vetted entry in ALLOWLIST below.
 *
 * Writes are not scanned: they are covered by
 * tests/architecture/admin-actions-authz.test.ts.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN_ROOTS = [
  join(ROOT, "src", "app", "actions"),
  join(ROOT, "src", "app", "api"),
  join(ROOT, "src", "lib", "dal"),
];

/**
 * Tables whose rows belong to one tenant. A read of any of these is only safe
 * if it names the tenant it is reading for.
 */
const TENANT_TABLES = new Set([
  "campaign_participants",
  "participant_sessions",
  "participant_scores",
  "participant_responses",
  "campaigns",
  "campaign_assessments",
  "campaign_access_links",
  "report_snapshots",
  "comparisons",
  "comparison_snapshots",
  "clients",
  "client_roles",
  "client_assessment_assignments",
  "client_report_template_assignments",
  "assessments",
  "diagnostic_sessions",
  "diagnostic_snapshots",
  "matching_runs",
  "audit_events",
  "person_link_audit",
  "org_diagnostic_campaigns",
  "org_diagnostic_profiles",
]);

/**
 * Vetted exceptions: `<file>:<function>` → why it needs no tenant predicate.
 * Add an entry only when the read genuinely spans tenants BY DESIGN, and say
 * why. "It's behind requireAdminScope" is a reason; "it seemed fine" is not.
 */
const ALLOWLIST = new Map<string, string>([
  [
    "src/app/actions/reports.ts:listAssessmentsForPreview",
    "Platform-admin preview seeding behind an isPlatformAdmin gate; reads titles only, across tenants by design.",
  ],
  [
    "src/app/actions/reports.ts:backfillAllPreviewSeeds",
    "Platform-admin maintenance job behind an isPlatformAdmin gate; operates over every tenant's templates by design.",
  ],
  [
    "src/app/actions/assessments.ts:getAssessments",
    "The platform assessment library console. Listing every assessment IS the screen; the workspace-scoped view is getWorkspaceAssessmentSummaries(). Behind requireAdminScope(), so unreachable from a client or partner surface — and from a support session, where isPlatformAdmin is false.",
  ],
  [
    "src/app/actions/factors.ts:getClientsForFactorSelect",
    "Client picker on the platform factor-authoring screen: the admin is choosing which client to scope a factor to, so every client must be offered. Behind requireAdminScope().",
  ],
  [
    "src/app/actions/matching.ts:getClientsForMatchingSelect",
    "Client picker on the platform matching console — same reasoning as getClientsForFactorSelect. Behind requireAdminScope().",
  ],
  [
    "src/app/actions/matching.ts:getMatchingRuns",
    "The platform matching console's run list. Cross-tenant is the screen; the client-scoped list is getWorkspaceMatchingRuns(), which does apply the filter. Behind requireAdminScope().",
  ],
  [
    "src/app/actions/partners.ts:getUnassignedClients",
    "Lists clients with no partner so a platform admin can assign one — narrowing to a workspace would empty the screen it exists for. Behind requireAdminScope().",
  ],
]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

/**
 * A predicate on a TENANT-IDENTIFYING column — `client_id`, `campaign_id`,
 * `partner_id` — dotted embedded paths included.
 *
 * Deliberately narrow. An earlier version accepted any id-ish column, which is
 * wrong: `.eq('id', x)` or `.eq('session_id', x)` proves the query is TARGETED,
 * not that the target sits inside the caller's workspace. When the id arrives
 * from a request body or a model tool call, a targeted query is exactly how one
 * tenant's row gets read from inside another tenant's workspace. Those reads
 * must earn their pass through an access gate instead.
 */
const SCOPE_PREDICATE =
  /\.(eq|in|filter|match|contains)\(\s*['"`][A-Za-z_]*\.?(client_id|campaign_id|partner_id)['"`]/;

/**
 * A predicate on an opaque object id. Proves the query is TARGETED, not that
 * the target sits in the caller's workspace — so it is accepted only where the
 * id cannot have come straight off the wire:
 *
 *   - inside a module-private helper, reached only through an exported function
 *     in the same file that this guard has already checked; or
 *   - anywhere under src/lib/dal, which is not a network boundary. A DAL module
 *     is a building block called by a server action or route that must satisfy
 *     this guard itself (see src/lib/dal/README.md).
 *
 * In an exported function under src/app it is not accepted: that IS the wire.
 */
const OBJECT_ID_PREDICATE =
  /\.(eq|in|filter|match|contains)\(\s*['"`][A-Za-z_]*\.?(id|[a-z_]+_id|person_key|email|slug|token|session_key)['"`]/;

/**
 * Gates that resolve access for a SPECIFIC tenant object, or that hand back the
 * workspace boundary directly.
 *
 * `requireAdminScope()` and `assertAdminOnly()` are deliberately NOT here. They
 * assert role-and-surface, not workspace: a platform admin with a client
 * workspace active on the admin surface passes both, so accepting them would
 * wave through a completely unfiltered tenant read — recreating the very
 * admin-in-a-workspace leak this guard exists to catch. A function that is
 * genuinely cross-tenant admin tooling belongs in ALLOWLIST, where the reason
 * is written down and reviewed.
 */
const SCOPE_GATE =
  /\b(require|assert)[A-Z]\w*Access\s*\(|resolveTenantClientFilter\s*\(|applyTenantClientFilter\s*\(|getAccessibleCampaignIds\s*\(|isInWorkspace\s*\(/;

/**
 * A resolved boundary threaded in as a parameter. DAL functions take the client
 * injected and the scope alongside it, so the predicate is applied a statement
 * or two away from the `.from(...)` rather than in the same chain.
 */
const SCOPE_PARAMETER = [
  // A resolved boundary read off the scope object.
  /\bscope\.(clientIds|campaignIds|partnerIds|scopedCampaignIds)\b/,
  /\bparams\.(clientIds|campaignIds|partnerIds|scopedCampaignIds)\b/,
  // The local produced by resolveTenantClientFilter().
  /\bclientFilter\b/,
  // A boundary DESTRUCTURED FROM A PARAMETER — `{ partnerIds }: { … }`. Matching
  // the destructure rather than the bare name matters: an earlier version
  // accepted the identifier anywhere in the function, so an unrelated local
  // called `partnerIds` (or a stale one left behind by a refactor) silently
  // vouched for a query that filtered on nothing.
  /\{[^}]*\b(clientIds|campaignIds|partnerIds|scopedCampaignIds)\b[^}]*\}\s*:/,
];

const WRITE_CALL = /\.(insert|update|upsert|delete)\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (SCAN_EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) {
      out.push(full);
    }
  }
  return out;
}

/** Where each top-level function/const declaration starts, in line order. */
function declarationStarts(lines: string[]): number[] {
  const starts: number[] = [];
  lines.forEach((line, index) => {
    if (
      /^(export\s+)?(async\s+)?function\s+\w+/.test(line) ||
      /^(export\s+)?const\s+\w+\s*=\s*(async\s*)?[({]/.test(line)
    ) {
      starts.push(index);
    }
  });
  return starts;
}

function enclosingDeclaration(lines: string[], starts: number[], line: number) {
  let start = 0;
  for (const candidate of starts) {
    if (candidate <= line) start = candidate;
  }
  let end = lines.length;
  for (const candidate of starts) {
    if (candidate > start) {
      end = candidate;
      break;
    }
  }
  const named = lines[start].match(/function\s+(\w+)|const\s+(\w+)/);
  return {
    name: named ? (named[1] ?? named[2]) : "<module>",
    body: lines.slice(start, end).join("\n"),
    // Exported = reachable from outside the module. For a server action or a
    // route handler that means the arguments arrive from the client (or, in
    // chat, from a model tool call) and cannot be assumed to name a row inside
    // the caller's workspace. A module-private helper is only reachable through
    // an exported function in the same file, which must itself satisfy this
    // guard — so its ids have already been vouched for.
    exported: /^export\b/.test(lines[start]),
  };
}

/** The chained calls that belong to the `.from(...)` on `line`. */
function queryChain(lines: string[], line: number): string {
  let chain = lines[line];
  for (let i = line + 1; i < Math.min(line + 45, lines.length); i += 1) {
    chain += `\n${lines[i]}`;
    const continues = /^\s*[.)]|^\s*\}|^\s*$|^\s*['"`]/.test(lines[i]);
    if (!continues) break;
  }
  return chain;
}

interface Violation {
  location: string;
  table: string;
  fn: string;
  key: string;
}

function findViolations({ applyAllowlist = true } = {}): Violation[] {
  const violations: Violation[] = [];

  for (const root of SCAN_ROOTS) {
    for (const file of walk(root)) {
      const source = readFileSync(file, "utf8");
      // Only files that read on a caller-scoped (RLS or injected) client. The
      // admin client bypasses RLS entirely and is covered by admin-actions-authz.
      const usesScopedClient =
        /@\/lib\/supabase\/server/.test(source) || /SupabaseClient/.test(source);
      if (!usesScopedClient) continue;

      const relativePath = relative(ROOT, file).split("\\").join("/");
      const lines = source.split("\n");
      const starts = declarationStarts(lines);

      lines.forEach((line, index) => {
        const from = line.match(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/);
        if (!from || !TENANT_TABLES.has(from[1])) return;

        const chain = queryChain(lines, index);
        if (WRITE_CALL.test(chain)) return;

        // Look across the whole enclosing function, not just the chain: a
        // predicate is often applied to the builder a few statements later.
        const declaration = enclosingDeclaration(lines, starts, index);
        if (SCOPE_PREDICATE.test(declaration.body)) return;
        if (SCOPE_GATE.test(declaration.body)) return;
        if (SCOPE_PARAMETER.some((re) => re.test(declaration.body))) return;
        const isNetworkBoundary = relativePath.startsWith("src/app/");
        if (
          (!declaration.exported || !isNetworkBoundary) &&
          OBJECT_ID_PREDICATE.test(declaration.body)
        ) {
          return;
        }

        const key = `${relativePath}:${declaration.name}`;
        if (applyAllowlist && ALLOWLIST.has(key)) return;

        violations.push({
          location: `${relativePath}:${index + 1}`,
          table: from[1],
          fn: declaration.name,
          key,
        });
      });
    }
  }

  return violations;
}

describe("tenant-scoped reads carry their own predicate", () => {
  it("finds no read of a tenant table that trusts RLS alone", () => {
    const violations = findViolations();

    const report = violations
      .map((v) => `  ${v.location} — ${v.fn}() reads ${v.table} unscoped`)
      .join("\n");

    expect(
      violations,
      violations.length === 0
        ? ""
        : [
            "",
            "These reads rely on RLS for tenant isolation, and RLS does not know",
            "which workspace the caller is in (see the header of this file):",
            "",
            report,
            "",
            "Fix by applying the resolved scope as a predicate:",
            "",
            "  const scoped = applyTenantClientFilter(query, scope, 'client_id')",
            "  if (!scoped) return []",
            "",
            "or by gating the function on require<Thing>Access(). If the read is",
            "genuinely cross-tenant by design, add it to ALLOWLIST with a reason.",
            "",
          ].join("\n"),
    ).toEqual([]);
  });

  it("keeps the allowlist honest — every entry still resolves and is still needed", () => {
    // Two ways an entry goes stale, and the second is the one that matters.
    // A dead file or renamed function is obvious. The quiet failure is an entry
    // whose function has SINCE been given a proper predicate: the exemption then
    // sits there vouching for nothing, and the next person to read the list
    // learns the wrong thing about which reads are deliberately cross-tenant.
    const unscoped = new Set(
      findViolations({ applyAllowlist: false }).map((v) => v.key),
    );
    const stale: string[] = [];

    for (const key of ALLOWLIST.keys()) {
      const [path, fn] = key.split(":");
      const full = join(ROOT, path);
      let source: string;
      try {
        source = readFileSync(full, "utf8");
      } catch {
        stale.push(`${key} — file is gone`);
        continue;
      }
      if (!new RegExp(`(function|const)\\s+${fn}\\b`).test(source)) {
        stale.push(`${key} — function is gone`);
        continue;
      }
      if (!unscoped.has(key)) {
        stale.push(
          `${key} — no longer needed: this function now scopes its read, so the exemption is doing nothing`,
        );
      }
    }

    expect(
      stale,
      `Stale ALLOWLIST entries — delete them:\n${stale.join("\n")}`,
    ).toEqual([]);
  });
});
