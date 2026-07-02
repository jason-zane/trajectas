/**
 * Guard against literal backslash-escaped paths entering the repo.
 *
 * Next.js route groups (`src/app/(dashboard)/`) and dynamic segments
 * (`[id]`) contain characters that need escaping in a shell. Tools that
 * mishandle that escaping occasionally create files at paths where the
 * backslash is part of the file name itself, e.g.
 * `src/app/\(dashboard\)/chat/loading.tsx`. Those files:
 *
 *  - shadow the real route files as stale byte-drifting duplicates,
 *  - are dead to the Next.js router (`\(dashboard\)` is a literal segment,
 *    not a route group), and
 *  - break the pre-commit hook: ESLint treats `\(` in a CLI file argument
 *    as a glob escape, resolves it to a path that doesn't exist, and fails
 *    with "No files matching the pattern ... were found" — which is what
 *    pushed several commits into `--no-verify`.
 *
 * 38 such files (all `loading.tsx` duplicates from the skeleton-library
 * work) were removed in the commit that introduced this test. The
 * pre-commit hook (.husky/pre-commit) blocks staging new ones; this test
 * is the CI backstop since hooks can be skipped.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("no escaped paths", () => {
  it("no tracked file path contains a literal backslash", () => {
    const trackedPaths = execFileSync("git", ["ls-files", "-z"], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
      .split("\0")
      .filter(Boolean);

    const escaped = trackedPaths.filter((p) => p.includes("\\"));

    expect(
      escaped,
      `Tracked paths contain literal backslashes — these are shell-escaping ` +
        `artifacts, not real route files. The real file lives at the ` +
        `unescaped path; write there and delete these:\n  ${escaped.join("\n  ")}`,
    ).toEqual([]);
  });
});
