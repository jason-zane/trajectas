#!/usr/bin/env node

/**
 * First-load JS budget check for the hot routes (Turbopack layout).
 *
 * After `next build`, each app route has:
 *   .next/server/app/<route>/page_client-reference-manifest.js
 *     -> globalThis.__RSC_MANIFEST["<route>/page"].entryJSFiles
 *        (client chunks per entry in the route's layout+page chain)
 *   .next/server/app/<route>/page/build-manifest.json
 *     -> rootMainFiles (the shared framework chunks)
 *
 * First-load JS for a route = gzipped union of both sets — matching what
 * the browser downloads on a cold hit of that route.
 *
 * Usage:
 *   node scripts/check-bundle-budgets.mjs            # enforce budgets (CI)
 *   node scripts/check-bundle-budgets.mjs --print    # print sizes for all routes
 *
 * Budgets seeded from the 2026-06-12 build at +15% headroom (performance
 * audit guardrail). When a deliberate feature grows a route, raise its
 * budget in scripts/bundle-budgets.json in the same PR and say why.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(repoRoot, ".next");
const appServerDir = join(distDir, "server", "app");
const printOnly = process.argv.includes("--print");
const require = createRequire(import.meta.url);

if (!existsSync(appServerDir)) {
  console.error("check-bundle-budgets: .next/server/app not found — run `next build` first.");
  process.exit(2);
}

const gzipCache = new Map();
function gzippedSize(relFile) {
  if (gzipCache.has(relFile)) return gzipCache.get(relFile);
  let size = 0;
  try {
    size = gzipSync(readFileSync(join(distDir, relFile))).length;
  } catch {
    // Chunk listed but not on disk (shouldn't happen post-build) — count 0.
  }
  gzipCache.set(relFile, size);
  return size;
}

/** All app routes that have a page client-reference manifest. */
function discoverRoutes(dir = appServerDir, prefix = "") {
  const routes = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      routes.push(...discoverRoutes(join(dir, entry.name), `${prefix}/${entry.name}`));
    } else if (entry.name === "page_client-reference-manifest.js") {
      routes.push(prefix);
    }
  }
  return routes;
}

function routeFirstLoadBytes(route) {
  const manifestPath = join(appServerDir, ...route.split("/").filter(Boolean), "page_client-reference-manifest.js");
  if (!existsSync(manifestPath)) return null;

  globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST ?? {};
  require(manifestPath);
  const rsc = globalThis.__RSC_MANIFEST[`${route}/page`];
  if (!rsc?.entryJSFiles) return null;

  const files = new Set();
  for (const chunkList of Object.values(rsc.entryJSFiles)) {
    for (const file of chunkList) if (file.endsWith(".js")) files.add(file);
  }

  const routeBuildManifest = join(appServerDir, ...route.split("/").filter(Boolean), "page", "build-manifest.json");
  if (existsSync(routeBuildManifest)) {
    const bm = JSON.parse(readFileSync(routeBuildManifest, "utf8"));
    for (const file of bm.rootMainFiles ?? []) if (file.endsWith(".js")) files.add(file);
    for (const file of bm.polyfillFiles ?? []) if (file.endsWith(".js")) files.add(file);
  }

  let total = 0;
  for (const file of files) total += gzippedSize(file);
  return total;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

if (printOnly) {
  const sizes = discoverRoutes()
    .map((route) => ({ route, bytes: routeFirstLoadBytes(route) }))
    .filter((r) => r.bytes !== null)
    .sort((a, b) => b.bytes - a.bytes);
  for (const { route, bytes } of sizes) console.log(`${kb(bytes).padStart(10)}  ${route}`);
  process.exit(0);
}

const budgets = JSON.parse(readFileSync(join(repoRoot, "scripts", "bundle-budgets.json"), "utf8"));

let failed = false;
console.log("First-load JS budgets (gzipped):");
for (const [route, budgetBytes] of Object.entries(budgets.routes)) {
  const actual = routeFirstLoadBytes(route);
  if (actual === null) {
    // Route disappeared/renamed — fail loudly so budgets don't silently rot.
    console.log(`  MISSING  ${route} — not in build output; update scripts/bundle-budgets.json`);
    failed = true;
    continue;
  }
  const over = actual > budgetBytes;
  if (over) failed = true;
  console.log(`  ${over ? "OVER " : "ok   "} ${kb(actual).padStart(10)} / ${kb(budgetBytes).padEnd(10)} ${route}`);
}

if (failed) {
  console.error(
    "\ncheck-bundle-budgets: budget exceeded. If the growth is deliberate, raise the route's budget in scripts/bundle-budgets.json in this PR and say why."
  );
  process.exit(1);
}
console.log("\nAll routes within budget.");
