/**
 * Architectural guard: a self-hosted font's CSS variable must point at a
 * family that actually has faces.
 *
 * Fonts are vendored and loaded with `next/font/local` (see the block comment
 * at the top of src/app/layout.tsx for the full rationale). Google ships one
 * file per subset, so `latin` and `latin-ext` are separate woff2s that must
 * end up under ONE font-family — otherwise the metric-adjusted fallback face
 * sits between them and every latin-ext character renders in Arial.
 *
 * Merging them relies on a sharp edge in next/font:
 *
 *   - the generated @font-face family name comes from the call's BINDING NAME,
 *     unless `declarations` sets `font-family` explicitly;
 *   - the CSS variable's value is ALWAYS derived from the binding name, even
 *     when `declarations` overrides the face family.
 *
 * So the pattern is: the latin call owns the CSS variable and takes its family
 * from its binding name, and the latin-ext call pins `font-family` in
 * `declarations` to THAT SAME BINDING NAME. The coupling is a string on one
 * side and an identifier on the other, and nothing in the type system relates
 * them.
 *
 * WHY THIS TEST EXISTS. An earlier version of the self-hosting change pinned
 * `font-family` on the variable-owning call instead. Every `--font-*` variable
 * then resolved to a family with ZERO faces, so every glyph in the entire
 * application — not merely latin-ext — would have rendered in size-adjusted
 * Arial. That version built cleanly, typechecked, linted, and passed all 1,981
 * unit and architecture tests. A total visual breakage is invisible to every
 * other check we run, which is precisely why it needs a dedicated one.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Every file that loads a vendored font. */
const FONT_FILES = [
  "src/app/layout.tsx",
  "src/app/(marketing)/layout.tsx",
  "src/app/(marketing)/page.tsx",
];

/** `const someBinding = localFont({` */
const BINDING_RE = /const\s+([A-Za-z_$][\w$]*)\s*=\s*localFont\s*\(/g;

/** `{ prop: "font-family", value: "someBinding" }` */
const PINNED_FAMILY_RE =
  /prop:\s*["']font-family["']\s*,\s*value:\s*["']([^"']+)["']/g;

/** `variable: "--font-something"` */
const VARIABLE_RE = /variable:\s*["'](--[\w-]+)["']/g;

function matchAll(source: string, re: RegExp): string[] {
  return [...source.matchAll(new RegExp(re.source, re.flags))].map((m) => m[1]);
}

describe("self-hosted font family bindings", () => {
  it("scans a non-empty set of font-loading files", () => {
    // A rename that emptied this list would make every assertion below vacuous.
    const present = FONT_FILES.filter((rel) => existsSync(join(ROOT, rel)));
    expect(present).toEqual(FONT_FILES);
  });

  it("finds the localFont calls it expects to check", () => {
    // Guards against the regexes silently matching nothing after a refactor.
    const total = FONT_FILES.reduce((n, rel) => {
      const src = readFileSync(join(ROOT, rel), "utf8");
      return n + matchAll(src, BINDING_RE).length;
    }, 0);
    // Three families in the root layout, two in the marketing layout, one on
    // the marketing page — each a latin + latin-ext pair.
    expect(total).toBeGreaterThanOrEqual(12);
  });

  for (const rel of FONT_FILES) {
    it(`${rel}: every pinned font-family names a real localFont binding`, () => {
      const src = readFileSync(join(ROOT, rel), "utf8");
      const bindings = new Set(matchAll(src, BINDING_RE));
      const pinned = matchAll(src, PINNED_FAMILY_RE);

      // The whole point of the pattern: an ext call pins the family to its
      // latin partner's binding name. If that string does not name a binding
      // in this file, the two faces land under different families and the
      // fallback wedges between them.
      const orphaned = pinned.filter((family) => !bindings.has(family));
      expect(
        orphaned,
        `pinned font-family does not match any localFont binding in ${rel} — ` +
          `latin-ext would render in the fallback face. Bindings here: ${[...bindings].join(", ")}`,
      ).toEqual([]);
    });

    it(`${rel}: no call both owns a CSS variable and pins its own family`, () => {
      const src = readFileSync(join(ROOT, rel), "utf8");

      // Split into per-call blocks so `variable:` and `declarations` can be
      // attributed to the same localFont call rather than to the file at large.
      const calls = src.split(/const\s+[A-Za-z_$][\w$]*\s*=\s*localFont\s*\(/).slice(1);
      expect(calls.length).toBeGreaterThan(0);

      const offenders: string[] = [];
      calls.forEach((block, i) => {
        const body = block.slice(0, block.indexOf("});") + 1);
        const ownsRealVariable = matchAll(body, VARIABLE_RE).some(
          (v) => !v.endsWith("-ext"),
        );
        const pinsFamily = matchAll(body, PINNED_FAMILY_RE).length > 0;
        // This exact combination is the shipped-and-silently-broken case: the
        // variable resolves to the binding name while the faces are emitted
        // under the pinned name, so the variable points at an empty family.
        if (ownsRealVariable && pinsFamily) offenders.push(`call #${i + 1}`);
      });

      expect(
        offenders,
        `a localFont call in ${rel} owns a --font-* variable AND pins font-family. ` +
          `next/font derives the variable's value from the BINDING NAME but the ` +
          `@font-face family from the pin, so the variable would point at a family ` +
          `with no faces and EVERY glyph would render in the fallback.`,
      ).toEqual([]);
    });
  }

  it("no font-loading file reaches for next/font/google", () => {
    // The CDN 404s intermittently; that is why these are vendored. A single
    // reintroduced import brings the flake back for the whole build.
    for (const rel of FONT_FILES) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code, `${rel} imports next/font/google`).not.toMatch(
        /from\s+["']next\/font\/google["']/,
      );
    }
  });
});
