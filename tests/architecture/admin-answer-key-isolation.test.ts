/**
 * Architectural guard: answer keys stay on the ADMIN SERVER PATH.
 *
 * `tests/architecture/answer-key-isolation.test.ts` guards the participant
 * runner — the code that assembles what a candidate is shown. That guard
 * deliberately scopes itself out of admin and scoring code, because those
 * legitimately read keys server-side.
 *
 * This is the complementary guard for the admin surface introduced by LR-8 /
 * #347. A reviewer MUST see the key and the per-distractor error labels; that
 * is the entire point of item review. What must not happen is the key material
 * spreading beyond the one admin-scoped server module that owns it, or
 * crossing into a client bundle on its way to a reviewer's screen.
 *
 * The invariants pinned here:
 *
 *   1. Exactly one DAL module (`src/lib/dal/item-bank-review.ts`) reads key
 *      material for an admin, and the set of modules under `src/` that name
 *      key material at all is a closed, reviewed list.
 *   2. No `'use client'` module imports that DAL — not even for its types.
 *      A client component that types its props as `ItemForReview` is one
 *      `<Panel item={item} />` away from serialising `keyOptionId` and every
 *      `errorLabel` into the browser payload. Client components that display
 *      review data must declare their own redacted props type.
 *   3. Every export of the Server Action module that exposes the key path is
 *      authorization-gated with `requireAdminScope()` — platform admin, not
 *      merely signed in.
 *   4. The participant-path DAL still names no key material.
 *
 * Non-vacuity is asserted explicitly: the scan must find files, the anchor
 * modules must exist, and every allowlist entry must still resolve. A guard
 * whose file list silently empties is worse than no guard.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC_DIR = join(ROOT, "src");

/** The admin key path. */
const REVIEW_DAL = "src/lib/dal/item-bank-review.ts";
const ADMIN_ACTIONS = "src/app/actions/item-bank.ts";
/** The participant path, which must stay clean. */
const DELIVERY_DAL = "src/lib/dal/cognitive-items.ts";

/**
 * Identifiers that ARE key material, or index it. `item_option_diagnostics`
 * counts because it is key-revealing by omission: every distractor carries an
 * error label, so the option without one is the key.
 */
const KEY_IDENTIFIERS: Array<{ pattern: RegExp; rationale: string }> = [
  {
    pattern: /\bitem_answer_keys\b|\bitemAnswerKeys\b/,
    rationale: "item_answer_keys is the key table (service-role only).",
  },
  {
    pattern: /\bitem_option_diagnostics\b|\bitemOptionDiagnostics\b/,
    rationale:
      "Per-distractor error labels are key-revealing by omission (the option with no label is the key).",
  },
  {
    pattern: /\bcorrect_option_id\b|\bcorrectOptionId\b/,
    rationale: "Names the correct option directly.",
  },
  // Deliberately NOT scanned here: item_options.score_value. It is the LEGACY
  // keyed-scoring column for Likert/binary items, named across the existing
  // admin item editor, its zod schema, its mappers and CTT scoring. Adding it
  // would mean five allowlist entries that have nothing to do with cognitive
  // keys — exactly the "noise that trains people to add exemptions" the
  // participant-side guard warns about. It is covered where it matters:
  // answer-key-isolation.test.ts forbids it on the runner path, the
  // anon/authenticated column grant withholds it (20260813101000), and
  // forbid_option_keys_on_cognitive_items_trg rejects it outright on any item
  // that has a cognitive spec.
];

/**
 * Modules allowed to name key material, each with a concrete reason. Adding to
 * this list is a security decision, not a formality.
 */
const KEY_MATERIAL_ALLOWLIST = new Map<string, string>([
  [
    REVIEW_DAL,
    "The admin review path itself. Reads the key and the error labels for a platform admin, server-side only; every caller is behind requireAdminScope().",
  ],
  [
    "src/lib/item-bank/store.ts",
    "Bank ingest writes the key (item_answer_keys) and the diagnostics rows. Write-only: it never selects them back.",
  ],
  [
    "src/lib/item-bank/ingest.ts",
    "Bank ingest orchestration: resolves which option id is the key so store.ts can write it. Write-only.",
  ],
  [
    "src/app/actions/assess-practice.ts",
    "Practice mode derives a { correct, message } verdict server-side from the key; the key itself never crosses back. See that module's own header.",
  ],
  [
    "src/lib/scoring/ability-session.ts",
    "Scoring reads keys server-side to mark responses.",
  ],
  [
    "src/lib/scoring/ability-scoring.ts",
    "Scoring reads keys server-side to mark responses.",
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

/** Strip comments so the guard tracks code, not documentation about the guard. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

type SourceFile = { rel: string; code: string; raw: string };

function sourceFiles(): SourceFile[] {
  return walk(SRC_DIR).map((file) => {
    const raw = readFileSync(file, "utf8");
    return { rel: file.replace(`${ROOT}/`, ""), code: stripComments(raw), raw };
  });
}

const FILES = sourceFiles();

function namesKeyMaterial(code: string): string[] {
  return KEY_IDENTIFIERS.filter(({ pattern }) => pattern.test(code)).map(
    ({ rationale }) => rationale,
  );
}

describe("answer keys stay on the admin server path", () => {
  it("scans a non-empty set of source files and every anchor exists", () => {
    // Without these the assertions below are all vacuously true.
    expect(FILES.length).toBeGreaterThan(100);
    for (const anchor of [REVIEW_DAL, ADMIN_ACTIONS, DELIVERY_DAL]) {
      expect(existsSync(join(ROOT, anchor)), `${anchor} is missing`).toBe(true);
    }
    for (const rel of KEY_MATERIAL_ALLOWLIST.keys()) {
      expect(existsSync(join(ROOT, rel)), `allowlisted ${rel} no longer exists`).toBe(true);
    }
  });

  it("only allowlisted modules name answer-key material", () => {
    const offenders = FILES.filter(({ rel, code }) => {
      if (KEY_MATERIAL_ALLOWLIST.has(rel)) return false;
      return namesKeyMaterial(code).length > 0;
    }).map(({ rel, code }) => `${rel} — ${namesKeyMaterial(code).join("; ")}`);

    expect(
      offenders,
      "These modules name answer-key material but are not on the reviewed allowlist. " +
        "Keys must be read only on an admin-scoped server path (src/lib/dal/item-bank-review.ts) " +
        "or a scoring/practice path that derives a safe verdict. If a new module genuinely needs " +
        "them, add it to KEY_MATERIAL_ALLOWLIST with a concrete reason.",
    ).toEqual([]);
  });

  it("no reusable component or page names answer-key material", () => {
    // Narrower restatement of the rule above, aimed at the surface the admin
    // review UI will be built on. A component is a render boundary: anything
    // it names is one prop away from the client bundle.
    const offenders = FILES.filter(
      ({ rel, code }) =>
        (rel.startsWith("src/components/") || rel.endsWith("page.tsx")) &&
        namesKeyMaterial(code).length > 0,
    ).map(({ rel }) => rel);

    expect(offenders, "components and pages must receive redacted DTOs, never name key tables").toEqual([]);
  });

  it("the admin review DAL is server-only", () => {
    const dal = FILES.find((f) => f.rel === REVIEW_DAL)!;
    expect(
      /^import ['"]server-only['"]/m.test(dal.raw),
      `${REVIEW_DAL} must start with import 'server-only'`,
    ).toBe(true);
  });

  it("no client module imports the admin review DAL", () => {
    const importPattern =
      /(?:from\s*['"][^'"]*(?:@\/lib\/dal\/item-bank-review|dal\/item-bank-review)['"]|import\(\s*['"][^'"]*item-bank-review['"])/;
    const offenders = FILES.filter(
      ({ raw, code }) => /^\s*(['"])use client\1;?\s*$/m.test(raw) && importPattern.test(code),
    ).map(({ rel }) => rel);

    expect(
      offenders,
      "A 'use client' module must not import src/lib/dal/item-bank-review — not even for its types. " +
        "ItemForReview carries keyOptionId, isKey and every per-distractor errorLabel; typing a client " +
        "component's props with it is how that payload reaches the browser. Declare a redacted props " +
        "type in the component instead, and render the key-bearing panel on the server.",
    ).toEqual([]);
  });

  it("every export of the admin key-path action module is authorization-gated", () => {
    const actions = FILES.find((f) => f.rel === ADMIN_ACTIONS)!;
    const exportRe =
      /export\s+(?:async\s+function\s+(\w+)|const\s+(\w+)\s*(?::[^=]+)?=\s*async\b)/g;

    const marks: Array<{ name: string; index: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = exportRe.exec(actions.code)) !== null) {
      marks.push({ name: m[1] ?? m[2], index: m.index });
    }

    // Non-vacuity: the module must actually export actions.
    expect(marks.length).toBeGreaterThan(5);

    const ungated = marks
      .map((mark, i) => {
        const end = i + 1 < marks.length ? marks[i + 1].index : actions.code.length;
        return { name: mark.name, body: actions.code.slice(mark.index, end) };
      })
      .filter((fn) => !/\brequireAdminScope\s*\(/.test(fn.body))
      .map((fn) => `${ADMIN_ACTIONS}#${fn.name}`);

    expect(
      ungated,
      "Every export in the item bank action module must call requireAdminScope() — this module's " +
        "read path returns answer keys, and authentication alone is not authorization.",
    ).toEqual([]);
  });

  it("the participant delivery DAL still names no answer-key material", () => {
    const dal = FILES.find((f) => f.rel === DELIVERY_DAL)!;
    expect(namesKeyMaterial(dal.code), `${DELIVERY_DAL} must never touch key material`).toEqual([]);
  });
});
