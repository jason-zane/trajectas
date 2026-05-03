/**
 * Architectural regression guard for the login Lambda.
 *
 * The login route has crashed in production multiple times because a heavy
 * HTML sanitiser (isomorphic-dompurify / DOMPurify / jsdom) ended up in its
 * static module graph via a transitive import — see commits 68ffe8e,
 * 772eec5, ab6a145, ea1bbeb. Each fix was a one-shot patch; the next
 * refactor reintroduced the coupling.
 *
 * This test traces the import graph from each login-Lambda entry point and
 * fails if it reaches any banned module. If you are seeing this fail, do
 * NOT add an exception. The fix is one of:
 *
 *   1. Move the offending import into a route that is NOT in the login flow.
 *   2. Extract the pure helpers you actually need into a leaf module
 *      (see src/lib/security/escape-html.ts for the canonical example).
 *   3. Lazy-load the heavy sanitiser inside the function that uses it via
 *      `await import(...)` so it is not part of the static graph.
 *
 * Why these specific bans:
 *   - `jsdom` ships an ESM-only transitive dep (@exodus/bytes) that breaks
 *     CJS require() in Vercel's Node runtime.
 *   - `isomorphic-dompurify` and `dompurify` resolve to jsdom on the server.
 *   - `@/lib/security/sanitize-html` is the local entry point that has
 *     historically wrapped one of the above. Banning it from the login
 *     graph forces escape helpers to live in `escape-html.ts` instead.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const ENTRIES = [
  "src/app/login/page.tsx",
  "src/app/login/login-form.tsx",
  "src/app/login/layout.tsx",
  "src/app/actions/auth.ts",
  "src/app/auth/callback/route.ts",
  "src/lib/auth/otp.ts",
  "src/lib/email/send.ts",
  "src/lib/email/render.ts",
];

const BANNED_SPECIFIERS = new Set<string>([
  "jsdom",
  "isomorphic-dompurify",
  "dompurify",
  "html-encoding-sniffer",
  "@/lib/security/sanitize-html",
  "@/lib/reports/sanitize-block-data",
]);

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts", ".cjs"];

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function resolveLocalFile(path: string): string | null {
  if (isFile(path)) return path;
  for (const ext of EXTENSIONS) {
    if (isFile(path + ext)) return path + ext;
  }
  if (isDir(path)) {
    for (const ext of EXTENSIONS) {
      const indexPath = resolve(path, "index" + ext);
      if (isFile(indexPath)) return indexPath;
    }
  }
  return null;
}

function resolveImport(spec: string, importer: string): string | null {
  if (spec.startsWith("@/")) {
    return resolveLocalFile(resolve(ROOT, "src", spec.slice(2)));
  }
  if (spec.startsWith(".")) {
    return resolveLocalFile(resolve(dirname(importer), spec));
  }
  if (isAbsolute(spec)) {
    return resolveLocalFile(spec);
  }
  return null;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function extractImportSpecifiers(source: string): string[] {
  const stripped = stripComments(source);
  const specs: string[] = [];

  const patterns = [
    /\bimport\s+(?!type\b)[^'";]*?\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bexport\s+(?:\*|\{[^}]*\}|type\s+\{[^}]*\})\s+from\s+["']([^"']+)["']/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(stripped)) !== null) {
      if (m[1]) specs.push(m[1]);
    }
  }

  return specs;
}

function packageNameOf(spec: string): string {
  if (spec.startsWith("@")) {
    const [scope, name] = spec.split("/");
    return name ? `${scope}/${name}` : scope;
  }
  return spec.split("/")[0];
}

interface TraceResult {
  localFiles: Set<string>;
  externalPackages: Set<string>;
  bannedHits: Map<string, string>;
}

function trace(entries: string[]): TraceResult {
  const localFiles = new Set<string>();
  const externalPackages = new Set<string>();
  const bannedHits = new Map<string, string>();
  const queue: string[] = [];

  for (const entry of entries) {
    const abs = resolve(ROOT, entry);
    if (isFile(abs)) {
      queue.push(abs);
    }
  }

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (localFiles.has(file)) continue;
    localFiles.add(file);

    let source: string;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    for (const spec of extractImportSpecifiers(source)) {
      const aliasOrPkg = spec.startsWith("@/") ? spec : packageNameOf(spec);
      if (BANNED_SPECIFIERS.has(aliasOrPkg) || BANNED_SPECIFIERS.has(spec)) {
        if (!bannedHits.has(aliasOrPkg)) {
          bannedHits.set(aliasOrPkg, file);
        }
      }

      const resolved = resolveImport(spec, file);
      if (resolved !== null) {
        if (!localFiles.has(resolved)) queue.push(resolved);
      } else if (
        !spec.startsWith(".") &&
        !spec.startsWith("@/") &&
        !isAbsolute(spec)
      ) {
        externalPackages.add(packageNameOf(spec));
      }
    }
  }

  return { localFiles, externalPackages, bannedHits };
}

describe("login Lambda bundle purity", () => {
  const result = trace(ENTRIES);

  it("does not transitively import any jsdom-pulling module", () => {
    if (result.bannedHits.size > 0) {
      const lines = Array.from(result.bannedHits).map(
        ([spec, importer]) =>
          `  - "${spec}" imported from ${importer.replace(ROOT + "/", "")}`
      );
      throw new Error(
        [
          "The login Lambda's static module graph reaches modules that have",
          "crashed it in production. Do NOT add this import to the allow-list.",
          "",
          ...lines,
          "",
          "Fix: move the import out of the login flow, OR extract the helpers",
          "you need into a leaf module (see src/lib/security/escape-html.ts).",
        ].join("\n")
      );
    }
    expect(result.bannedHits.size).toBe(0);
  });

  it("does not pull jsdom or any of its known siblings as a bare specifier", () => {
    const jsdomFamily = [
      "jsdom",
      "isomorphic-dompurify",
      "dompurify",
      "html-encoding-sniffer",
      "@exodus/bytes",
      "whatwg-url",
    ];
    const hits = jsdomFamily.filter((p) => result.externalPackages.has(p));
    expect(hits, `Banned packages reached from login graph: ${hits.join(", ")}`)
      .toEqual([]);
  });

  it("trace reaches the expected core files (sanity check)", () => {
    const reached = (relPath: string) =>
      result.localFiles.has(resolve(ROOT, relPath));
    expect(reached("src/lib/email/render.ts")).toBe(true);
    expect(reached("src/lib/email/send.ts")).toBe(true);
    expect(reached("src/lib/auth/otp.ts")).toBe(true);
  });
});
