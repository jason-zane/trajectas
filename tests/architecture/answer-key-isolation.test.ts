/**
 * Architectural guard: answer keys must never reach the participant client.
 *
 * Cognitive ability items (figural matrices and the deductive set) are scored
 * against a key. Unlike a Likert instrument, where the "score" of an option is
 * inert, leaking a key here hands the candidate the answers. The defences are
 * layered:
 *
 *   1. Database — keys live in `item_answer_keys` and `item_option_diagnostics`,
 *      both service-role only; `item_options.score_value` is excluded from the
 *      anon/authenticated column grant; and `cognitive_item_specs` carries a
 *      CHECK constraint forbidding key-shaped properties inside the spec JSON.
 *      (20260813100500 / 20260813101000.)
 *   2. This test — the runner's data path must not even name a key field, so a
 *      future `select("*")` or an absent-minded DTO widening fails in CI rather
 *      than in production.
 *
 * Scope is deliberately narrow: the participant-facing runner path only. Admin
 * and scoring code legitimately reads keys via the service-role client, so
 * scanning those would produce noise and train people to add exemptions.
 *
 * `item_option_diagnostics` counts as key material because it is key-revealing
 * by omission: every distractor carries an error label, so the option WITHOUT
 * one is the key.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Files that assemble or type the payload sent to the participant runner.
 * If the runner's data path moves, update this list — an empty scan is treated
 * as a failure below so a rename cannot silently disable the guard.
 */
const RUNNER_PATH_FILES = [
  "src/app/actions/assess.ts",
  "src/components/assess/item-card.tsx",
  "src/components/assess/section-wrapper.tsx",
  "src/components/assess/use-save-queue.ts",
];

/** Identifiers that carry, or index, the correct answer. */
const KEY_IDENTIFIERS: Array<{ pattern: RegExp; rationale: string }> = [
  {
    pattern: /\bscore_value\b|\bscoreValue\b/,
    rationale:
      "item_options.score_value is the legacy keyed-scoring column. The runner must never select or type it.",
  },
  {
    pattern: /\bitem_answer_keys\b|\bitemAnswerKeys\b/,
    rationale:
      "item_answer_keys is service-role only and must not be referenced on the participant path.",
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
  {
    pattern: /\bis_correct\b|\bisCorrect\b/,
    rationale:
      "Per-option correctness must be resolved server-side; sending it to the runner leaks the key.",
  },
];

/**
 * Reading the whole file would flag prose in comments. Strip line and block
 * comments first so the guard tracks code, not documentation about the guard.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("answer keys never reach the participant runner", () => {
  it("scans a non-empty set of runner-path files", () => {
    const present = RUNNER_PATH_FILES.filter((rel) =>
      existsSync(join(ROOT, rel)),
    );
    // A rename that empties this list would make every assertion below vacuous.
    expect(present.length).toBe(RUNNER_PATH_FILES.length);
  });

  for (const rel of RUNNER_PATH_FILES) {
    it(`${rel} references no answer-key field`, () => {
      const abs = join(ROOT, rel);
      if (!existsSync(abs)) return; // covered by the completeness test above
      const code = stripComments(readFileSync(abs, "utf8"));

      const violations = KEY_IDENTIFIERS.filter(({ pattern }) =>
        pattern.test(code),
      ).map(({ pattern, rationale }) => `${pattern} — ${rationale}`);

      expect(violations, `${rel} leaks answer-key material`).toEqual([]);
    });
  }

  it("the runner never issues an unqualified select on item_options", () => {
    // `select("*")` against item_options would pull score_value for any caller
    // holding a service-role client, and would break outright for an
    // RLS-scoped one now that the column grant is withheld.
    const abs = join(ROOT, "src/app/actions/assess.ts");
    const code = stripComments(readFileSync(abs, "utf8"));
    const unqualified =
      /from\(\s*['"]item_options['"]\s*\)\s*[\s\S]{0,80}?\.select\(\s*['"]\*['"]\s*\)/;
    expect(unqualified.test(code)).toBe(false);
  });
});
