# Cache Components migration — measured findings and staged plan

**Date:** 2026-06-12 · **Status:** deliberately deferred after a measured experiment · **Context:** final item of the [2026-06-11 performance audit](2026-06-11-performance-audit.md) remediation. Next 16 supersedes `unstable_cache` with `use cache`, which requires the app-wide `cacheComponents: true` flag.

## What the experiment showed

Flag flipped in an isolated worktree on top of the full remediation (commit range #254–#284), then `next build`, peeling errors layer by layer:

| Layer | Surface | Effort class |
|---|---|---|
| 1 | `export const dynamic` segment configs banned — **8 files** | Mechanical (under the flag everything is dynamic by default; configs simply deleted) |
| 2 | `export const runtime = 'nodejs'` banned — **23 API routes** | Mechanical (nodejs is the default runtime; deletions safe) |
| 3 | **"Uncached data was accessed outside of `<Suspense>`"** — fires per route at prerender, starting from the root layout's provider chain (`TooltipProvider` in `src/app/layout.tsx`) on `/client/reports/[snapshotId]` | **Structural, per-route** |

Layer 3 is the real migration: under `cacheComponents`, every one of ~190 dynamic routes must satisfy the prerender contract — all uncached IO below a `<Suspense>` boundary (or the segment's `loading.tsx`), with the static shell above it IO-free. The build fails one route at a time, so the surface can't even be enumerated in one pass; each failure needs triage (move the fetch, add a boundary, or `use cache` it). The root-layout hit shows the shell itself needs restructuring before any route passes.

## Why deferred rather than pushed through

- The remediation program already banked the wins this flag would mostly re-deliver (tag-invalidated caching via `unstable_cache`+`updateTag` in #266, loading/Suspense coverage in #264/#269, 30s router cache in #257). `unstable_cache` is superseded but fully supported in Next 16.
- The flag also swaps the client navigation model to React `<Activity>` state preservation — a behavioral change that deserves its own verification pass, not a rider on a perf program.
- Estimated honestly: days of route-by-route work with UX-visible risk, against marginal latency gain over the current state.

## Staged path when it's picked up

1. Strip layers 1–2 (mechanical, ~31 files — keep this list: `grep -rl "export const \(dynamic\|runtime\)" src/app`).
2. Restructure `src/app/layout.tsx` so the shell renders IO-free (providers must not read dynamic data).
3. Migrate route-group by route-group, `(dashboard)` first (best loading.tsx coverage), assess tree **last** (participant-facing; its intro deliberately renders synchronously — see #269 discussion).
4. Convert `unstable_cache` → `use cache` + `cacheTag`/`cacheLife` per module as its group migrates (`updateTag` calls stay — already the Next 16 API).
5. Drop `experimental.staleTimes` at the end (superseded by the Activity model).

Until then: new caching uses the established `unstable_cache` + tags + `updateTag` pattern (see `src/app/actions/brand.ts` as the reference).
