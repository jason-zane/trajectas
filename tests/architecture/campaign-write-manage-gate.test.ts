/**
 * Architectural guard: MUTATING a campaign requires the right to MANAGE it,
 * not merely membership of the tenant that owns it.
 *
 * `requireCampaignAccess()` is a READ gate. It admits any member of the owning
 * client or partner, because reading a campaign is a membership-wide right.
 * The campaign actions then run on the service-role client, so RLS never sees
 * them — a mutation gated only on access lets an ordinary, view-only member
 * edit, activate, delete, or invite into any campaign their tenant owns.
 *
 * This regressed into existence once already: 22 mutating actions in
 * campaigns.ts had drifted onto the read gate by the time the partner campaign
 * console surfaced them (Codex review of the partner self-service stack,
 * 2026-09-04). `requireCampaignManage()` is the write gate — it layers
 * `canManageCampaign` onto the same lookup — and this test pins the boundary
 * so the next new action cannot quietly pick the wrong one.
 *
 * If a genuinely membership-wide write ever exists (a per-user preference, say,
 * keyed to the caller's own row and written through the RLS client), add it to
 * ALLOWLIST with the reason — do not relax the scan.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Server-action modules whose campaign writes this guard covers. */
const SCANNED = [
  "src/app/actions/campaigns.ts",
  "src/app/actions/factor-selection.ts",
];

/**
 * Exported actions allowed to mutate while holding only the read gate.
 * Each entry needs a reason that survives review.
 */
const ALLOWLIST = new Map<string, string>([
  // (empty — every campaign write currently uses the manage gate)
]);

/** Writes through the service-role client. `.select(` is excluded. */
const MUTATION_RE = /\.(insert|update|upsert|delete)\s*\(/;

type ExportedFn = { name: string; body: string };

/** Split a module into its exported async functions by brace depth. */
function exportedFunctions(source: string): ExportedFn[] {
  const out: ExportedFn[] = [];
  const lines = source.split("\n");
  const header = /^export\s+async\s+function\s+(\w+)/;

  for (let i = 0; i < lines.length; i++) {
    const match = header.exec(lines[i]);
    if (!match) continue;

    // Walk to the closing brace at column 0 — the file is Prettier-formatted,
    // so a top-level function always ends there.
    let end = i;
    while (end < lines.length && lines[end] !== "}") end++;
    out.push({ name: match[1], body: lines.slice(i, end + 1).join("\n") });
    i = end;
  }
  return out;
}

describe("campaign writes are gated on manage, not membership", () => {
  const offenders: string[] = [];

  for (const relative of SCANNED) {
    const source = readFileSync(join(ROOT, relative), "utf8");

    for (const fn of exportedFunctions(source)) {
      if (!MUTATION_RE.test(fn.body)) continue;
      if (!/\brequireCampaignAccess\s*\(/.test(fn.body)) continue;
      if (/\brequireCampaignManage\s*\(/.test(fn.body)) continue;
      if (/\bcanManageCampaign\s*\(/.test(fn.body)) continue;
      if (ALLOWLIST.has(fn.name)) continue;
      offenders.push(`${relative} → ${fn.name}()`);
    }
  }

  it("no mutating action holds only the read gate", () => {
    expect(
      offenders,
      `These actions mutate a campaign while holding only requireCampaignAccess(), ` +
        `which admits any member of the owning tenant. Use requireCampaignManage() ` +
        `instead, or allowlist with a reason:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("the write gate itself checks canManageCampaign", () => {
    const authz = readFileSync(join(ROOT, "src/lib/auth/authorization.ts"), "utf8");
    const helper = authz.slice(authz.indexOf("export async function requireCampaignManage"));
    const body = helper.slice(0, helper.indexOf("\n}\n") + 1);

    expect(body).toContain("requireCampaignAccess(");
    expect(body).toContain("canManageCampaign(");
    expect(body).toContain("AuthorizationError");
  });

  it("finds the actions it claims to scan", () => {
    // A parser that silently matched nothing would make this suite vacuous.
    const source = readFileSync(join(ROOT, "src/app/actions/campaigns.ts"), "utf8");
    const mutating = exportedFunctions(source).filter((fn) =>
      MUTATION_RE.test(fn.body)
    );
    expect(mutating.length).toBeGreaterThan(15);
    expect(mutating.map((fn) => fn.name)).toContain("activateCampaign");
  });
});
