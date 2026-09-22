/**
 * Keep Claude Code and Codex on the same instructions.
 *
 * Codex reads `AGENTS.md` only: it never opens `CLAUDE.md` and does not expand
 * `@file` imports. Claude Code reads `CLAUDE.md`, which imports `AGENTS.md`.
 * So any rule written into `CLAUDE.md` is silently Claude-only, and any rule
 * past Codex's 32 KiB `project_doc_max_bytes` budget is silently Claude-only
 * too — Codex truncates without warning. Both drifts happened before this
 * test existed (a six-rule "Efficiency" section lived only in `CLAUDE.md`).
 *
 * A nested `CLAUDE.md` or `AGENTS.md` would reintroduce the same split, since
 * each tool discovers only its own filename in subdirectories.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Codex's default `project_doc_max_bytes` is 32 KiB; keep 2 KiB of headroom. */
const AGENTS_MD_MAX_BYTES = 30 * 1024;

const read = (file: string) => readFileSync(resolve(repoRoot, file), "utf8");

describe("agent instruction files", () => {
  it("CLAUDE.md holds nothing but the AGENTS.md import", () => {
    const withoutComments = read("CLAUDE.md")
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim();

    expect(
      withoutComments,
      "Put new rules in AGENTS.md — Codex never reads CLAUDE.md, so anything here is Claude-only.",
    ).toBe("@AGENTS.md");
  });

  it("AGENTS.md fits inside Codex's instruction budget", () => {
    const bytes = Buffer.byteLength(read("AGENTS.md"), "utf8");

    expect(
      bytes,
      `AGENTS.md is ${bytes} bytes. Codex drops everything past 32 KiB without warning — move long background into docs/ and link to it.`,
    ).toBeLessThanOrEqual(AGENTS_MD_MAX_BYTES);
  });

  it("AGENTS.md carries the next dev managed block exactly once", () => {
    const content = read("AGENTS.md");
    expect(content.split("<!-- BEGIN:nextjs-agent-rules -->").length - 1).toBe(1);
    expect(content.split("<!-- END:nextjs-agent-rules -->").length - 1).toBe(1);
  });

  it("there are no nested instruction files", () => {
    const tracked = execFileSync(
      "git",
      ["ls-files", "--", "*CLAUDE.md", "*AGENTS.md", "*AGENTS.override.md", "*CLAUDE.local.md"],
      { cwd: repoRoot, encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);

    expect(tracked.sort()).toEqual(["AGENTS.md", "CLAUDE.md"]);
  });
});
