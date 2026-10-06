import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Only known documentation/metadata-only diffs may omit seeded E2E. New or
// unrecognised paths default to running it, including deleted/renamed files.
export function needsSeededE2E(paths) {
  if (!paths.length) return true;
  return paths.some((path) => !(
    path.startsWith("docs/") ||
    path.startsWith(".agents/skills/") ||
    ["AGENTS.md", "CLAUDE.md", "README.md", "LICENSE", ".github/pull_request_template.md"].includes(path)
  ));
}

export function changedPaths(base, head, cwd = process.cwd()) {
  if (!base || !head) throw new Error("Both base and head revisions are required");
  // No rename detection: both the old and new paths contribute to the scope.
  // NUL separation handles spaces/newlines; full history avoids the PR paths
  // filter's file limit. Refs are arguments, never shell interpolation.
  return execFileSync("git", ["diff", "--no-renames", "--name-only", "-z", base, head, "--"], {
    cwd, encoding: "utf8",
  }).split("\0").filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const seeded = needsSeededE2E(changedPaths(process.argv[2], process.argv[3]));
  const output = `seeded=${seeded}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  process.stdout.write(output);
}
