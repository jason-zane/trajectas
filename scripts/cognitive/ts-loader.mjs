// Node ESM resolve hook that lets `node --import ./register-ts-loader.mjs
// generate-matrix-bank.ts` run this repo's TypeScript sources directly,
// with NO new dependencies (no tsx/ts-node — neither is installed, and
// this task's constraints rule out touching package.json/package-lock.json
// while another agent has a concurrent migration in flight on this repo).
//
// Node 22's built-in TypeScript support (unflagged in this runtime) strips
// type annotations from .ts files automatically, but it does NOT resolve
// extensionless relative specifiers the way a bundler does — and every
// file under src/lib/cognitive/ imports its siblings as `./schema`,
// `./geometry`, etc, per this repo's normal (bundler-resolved) convention.
// This hook adds exactly that resolution rule, and nothing else:
//   - a bare `server-only` import resolves to an empty module, mirroring
//     tests/mocks/server-only.ts's role in vitest.config.ts (server-only's
//     real package.json points the `default` condition at a file that
//     unconditionally throws — it only resolves safely under the
//     `react-server` webpack condition Next.js sets, which plain `node`
//     never sets).
//   - a relative specifier with no file extension is resolved by trying
//     `.ts`, then `.tsx`, then `/index.ts`, in that order — the same
//     resolution order a bundler's TS/TSX resolver would use.
//   - `@/foo` resolves to `<repo>/src/foo`, mirroring tsconfig.json's
//     `"@/*": ["./src/*"]` path mapping, so the pilot-bank script can
//     import the LR-4 fixtures (tests/fixtures/cognitive/*.ts) without
//     rewriting their existing `@/lib/...` imports.
// Everything else (bare package specifiers like `zod`) is left to Node's
// default resolution.
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const EXTS = ['.ts', '.tsx', '/index.ts']
// scripts/cognitive/ts-loader.mjs -> repo root is two levels up.
const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const SRC_ROOT = join(REPO_ROOT, 'src')

async function resolveWithExts(baseSpecifier, context, nextResolve) {
  for (const ext of EXTS) {
    const url = baseSpecifier.startsWith('file://') ? new URL(baseSpecifier + ext) : new URL(baseSpecifier + ext, context.parentURL)
    if (existsSync(fileURLToPath(url))) {
      return nextResolve(url.href, context)
    }
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { url: 'data:text/javascript,export {}', shortCircuit: true }
  }

  if (specifier.startsWith('@/')) {
    const absPath = pathToFileURL(join(SRC_ROOT, specifier.slice(2))).href
    const hasExt = /\.[a-zA-Z0-9]+$/.test(specifier)
    if (hasExt) return nextResolve(absPath, context)
    const resolved = await resolveWithExts(absPath, context, nextResolve)
    if (resolved) return resolved
    return nextResolve(absPath, context)
  }

  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const base = new URL(specifier, context.parentURL)
    if (!/\.[a-zA-Z0-9]+$/.test(base.pathname)) {
      const resolved = await resolveWithExts(specifier, context, nextResolve)
      if (resolved) return resolved
    }
  }
  return nextResolve(specifier, context)
}
