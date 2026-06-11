# Performance Audit — 2026-06-11

**Scope:** every surface (admin `(dashboard)`, `client/`, `partner/`, `assess/`, marketing), server data flow, loading/perceived UX, client bundle, caching/revalidation, cross-surface duplication, and the production database.

**Method:** six parallel code investigations over the full route tree (~186 pages, 49 action modules, 350 client-component files), plus empirical data from production: `pg_stat_statements` (78-day window since 2026-03-24), `pg_stat_user_tables`, Supabase performance advisors (333 lints), and project/region config.

---

## TL;DR

The app is not slow because of slow queries — every production table is tiny and queries average **well under 1 ms**. It is slow because of **how many serial round trips each interaction makes**, and it *feels* slower than it is because **41% of pages have no loading state** and almost every mutation re-renders the entire route.

| # | Diagnosis | Evidence | Fix theme |
|---|-----------|----------|-----------|
| 1 | **Per-request auth tax**: every page/action request does ≥2 network `auth.getUser()` calls (proxy + RSC) before any real work | 76,396 `auth.users` lookups in 78 days — ~64% of all PostgREST data-request volume | Verify JWT locally (`getClaims`), one scope resolution per request |
| 2 | **Server waterfalls**: hot pages stack 5–8 *sequential* round trips | client dashboard chain ≈ 6–8 serial hops; scope resolution itself serializes 2 avoidable hops | `Promise.all` + pass scope down instead of re-resolving |
| 3 | **Mutation model**: 63–75 `router.refresh()` call sites re-run the whole RSC tree (incl. the auth chain) after every small edit; only 10 `useOptimistic` | caching + loading audits agree | Optimistic updates + targeted `revalidateTag` |
| 4 | **Perceived perf**: 77/186 pages have no `loading.tsx`; only 27 `<Suspense>` boundaries; assessment-edit tabs and most of the assess flow freeze on navigation | loading-state audit | Loading coverage + streaming + shared skeleton library |
| 5 | **Repeat navigation is never free**: client router cache uses Next defaults (`staleTimes.dynamic = 0`), so every revisit refetches everything | no `staleTimes` in next config | 30s dynamic staleTime |
| 6 | **Three-tree duplication**: ~1,000+ LOC copy-pasted across `(dashboard)`/`client`/`partner`, incl. 12 identical `loading.tsx`; 4 drift bugs already found | duplication audit | Surface-parameterized shared pages |
| 7 | **DB hygiene**: 225 overlapping permissive RLS policies, 99 unused indexes, 8 unindexed FKs | Supabase advisors | One hygiene migration; cheap now, expensive later |

Infra is healthy: Vercel (`sin1`) and Supabase (`ap-southeast-1`) are co-located; the assess save path (IndexedDB queue, batching, idempotency, sendBeacon) is genuinely excellent; server-only libs don't leak into the client bundle (and an architecture test enforces it); heavy editors (tiptap, maily, cmdk) are already lazy-loaded.

---

## The numbers that matter (production, 2026-03-24 → 2026-06-10)

- `auth.users` / `sessions` / `identities` lookups: **~76–77K each** — these back `supabase.auth.getUser()`; at ~119K total PostgREST data requests, **auth verification is ~2 of every 5 DB-bound round trips the platform makes**.
- `profiles` seq-scanned **461,521×** and `partner_memberships` **474,972×** — tables with **4 and 0 live rows**. Each scan is sub-ms (so this is not a today-bottleneck), but it shows RLS helper functions and membership checks run ~4× per data request. At 10K+ participants this becomes real latency.
- Largest table: `generated_items` at 37 MB / 4,404 rows. Everything else is KB-scale. **No query-side bottleneck exists today** — the cost is round-trip *count*, not query time.
- Advisors: **225 `multiple_permissive_policies`** warnings across 48 tables (platform-admin policy + tenant policy both evaluated on every row), **99 unused indexes**, **8 unindexed FKs**, 1 `auth_rls_initplan` (`generation_presets`).

### Anatomy of one dashboard navigation today

```
proxy (src/proxy.ts:351)            auth.getUser()            ~30–80ms  network hop 1
RSC render
  resolveSessionActor (actor.ts:55) auth.getUser() AGAIN      ~30–80ms  hop 2
  actor queries (actor.ts:60-78)    3 queries (parallel ✓)    ~20–40ms  hop 3
  scope extras (authorization.ts)   client-partner map, then
                                    support session (serial)  ~40–80ms  hops 4–5
  layout bootstrap                  context options (serial)  ~20–40ms  hop 6
  page queries                      2–6, often serial         ~50–200ms hops 7+
```

≈ **250–500ms TTFB** before a single byte of UI streams, on every navigation, prefetch, and `router.refresh()`. Cutting hops 1–2 to ~0ms and parallelizing the rest gets most pages to <150ms.

---

## Theme 1 — The per-request auth tax (P0, biggest single win)

Two network `getUser()` calls per request:

1. [src/proxy.ts:351](../../src/proxy.ts) — session-activity check calls `supabase.auth.getUser()` on every matched request (all page navs, RSC prefetches, server actions, API calls).
2. [src/lib/auth/actor.ts:55](../../src/lib/auth/actor.ts) — `resolveSessionActor` calls it again inside the RSC render (React `cache()` dedupes within one render, but not across proxy→render, and each server action is its own request).

**Fix (in order):**
1. Check the project's JWT signing algorithm (Dashboard → Auth → JWT keys). The project was created 2026-03, so it should already be on asymmetric keys (ES256). If not, rotate.
2. Replace `getUser()` with **`supabase.auth.getClaims()`** in the proxy and in `resolveSessionActor`. With asymmetric keys this verifies the JWT **locally against a cached JWKS — zero network**. Keep `getUser()` only where revocation-freshness genuinely matters (e.g., `/auth/*` boundaries, destructive admin actions).
3. The proxy still needs `setSession`-style cookie refresh — `getClaims()` + the SSR client's token refresh handles this; only refresh when the access token is near expiry rather than verifying remotely every request.

**Expected effect:** −60–160ms on *every* request, and prefetches become nearly free (which makes the sidebar's default prefetching an asset instead of a load amplifier).

### 1b — Scope resolution does avoidable serial work (P0)

- [src/lib/auth/authorization.ts:314-318](../../src/lib/auth/authorization.ts) — `loadClientPartnerMap(...)` then `getValidatedSupportSession(...)` run sequentially; they're independent → `Promise.all`.
- `getWorkspaceContextOptions` re-enters `resolveAuthorizedScope` after bootstrap already resolved it (cache hit, but the serial shape remains) — [src/lib/auth/workspace-bootstrap.ts:93-96](../../src/lib/auth/workspace-bootstrap.ts).
- 185 call sites across `src/app/actions/*` call `resolveAuthorizedScope()`/`require*Access()` independently. Within one request `cache()` dedupes, but every *server action invocation* is its own request → its own full chain. For multi-action pages (client dashboard fires 6), each action used to its own auth chain when called as separate round trips.
- `require{Partner,Client,Campaign}Access` ([authorization.ts:475-531](../../src/lib/auth/authorization.ts)) each add a verification query *after* scope resolution, serially, on hot layouts.

**Fix:** parallelize the internals; batch the access-verification query with scope resolution; and for pages that call many actions, fetch once in the page and pass data down rather than letting each child action re-resolve.

---

## Theme 2 — Server waterfalls on hot pages (P0/P1)

Verified instances (all are independent queries currently awaited serially):

| Where | Chain | Fix |
|---|---|---|
| [src/app/client/dashboard/page.tsx:39-52](../../src/app/client/dashboard/page.tsx) | 6 actions in `Promise.all` ✓, but `getOperationalCampaignsForClient`, `getRecentClientResults`, `getCompletionTimeline` each hide an *internal* 2-step serial fetch ([campaigns.ts:1983→1990](../../src/app/actions/campaigns.ts), [2046→2067](../../src/app/actions/campaigns.ts), [2139→2160](../../src/app/actions/campaigns.ts)) | `Promise.all` inside each helper; net 6–8 hops → ~3 |
| [src/app/client/campaigns/[id]/participants/page.tsx:17-34](../../src/app/client/campaigns/%5Bid%5D/participants/page.tsx) | `getCampaignById` (4 parallel ✓) then `getCampaignSessions` serial | hoist into one `Promise.all` |
| [src/app/actions/campaigns.ts:2219-2293](../../src/app/actions/campaigns.ts) | `getUniqueParticipantsForClient`: campaigns → all participants → JS dedupe, **no pagination** | SQL `GROUP BY` / distinct-on + `.range()`; this is also the biggest future-scale risk (unbounded fetch) |
| [src/app/actions/campaigns.ts:250-329](../../src/app/actions/campaigns.ts) | `getCampaignById` re-counts assessments that `getCampaignHeader` already counted | drop redundant count |
| [src/app/(dashboard)/items/page.tsx](../../src/app/(dashboard)/items/page.tsx) → `getItemHealthIndicators` | calibration_runs → item_statistics serial | `Promise.all` |
| [src/app/actions/psychometrics.ts:119-150](../../src/app/actions/psychometrics.ts) | 7 parallel ✓ then 1 straggler count serial | fold into the `Promise.all` |

Systemic rule worth adopting: **an action helper may await at most one sequential round trip per logical step; anything independent goes in `Promise.all`.** Most violations are inside `src/app/actions/campaigns.ts` (2,500+ LOC — it has become the de-facto DAL; see Theme 7).

---

## Theme 3 — Mutation model: `router.refresh()` everywhere (P0 for feel, P1 for load)

**63–75 call sites across ~47 files.** Every participant invite/delete, user role change, settings save, taxonomy edit → full RSC re-render of the route (layout bootstrap + page queries + auth chain), typically 300–800ms of frozen-but-interactive UI with no feedback. Worst offenders:

- [campaign-participant-manager.tsx](../../src/app/(dashboard)/campaigns/%5Bid%5D/participants/campaign-participant-manager.tsx) — 6 refresh-triggering flows (invite, bulk upload, duplicate-confirm, restore, bulk delete, delete)
- [users/[id]/user-detail-client.tsx](../../src/app/(dashboard)/users/%5Bid%5D/user-detail-client.tsx) — refresh per field save (910-line client component)
- assignment panels (client + partner variants), brand/settings panels

**Fix pattern (one PR per cluster):**
1. `useOptimistic` for row add/remove/edit in the hot tables (participants, users, assignments) — UI updates in <50ms.
2. Server actions return the changed row(s); reconcile locally instead of refetching the world.
3. Where a server-side refresh is genuinely needed, prefer `revalidateTag('campaign-participants:<id>')`-style targeted invalidation over `router.refresh()`. (Tags require moving those reads behind `unstable_cache`/`"use cache"` — do it for the hot, clearly-scoped reads first; don't boil the ocean.)
4. While pending, keep the table interactive — never blank it.

Also in this theme: pollers.
- [generate/[runId]/page.tsx:80](../../src/app/(dashboard)/generate/%5BrunId%5D/page.tsx) polls a server action every **2s** flat (and the page is a page-level `"use client"`). Add backoff (2s → 30s cap) or move to Supabase Realtime; the run table already changes server-side.
- [campaign-session-reports-panel.tsx:71](../../src/components/results/campaign-session-reports-panel.tsx) polls at 3s; same treatment.

---

## Theme 4 — Perceived performance: loading states, streaming, skeleton fidelity (P0 for assess, P1 elsewhere)

Numbers from the route-by-route audit: **186 pages, 109 `loading.tsx`, 77 pages with no loading state in their segment chain.** `<Suspense>` appears only 27 times (almost all report rendering). 176 `useTransition` (good) vs 10 `useOptimistic`.

**Highest-stakes gaps:**
1. **Assess flow** (participant-facing, 40% coverage): `consent`, `demographics`, `complete`, `report/[snapshotId]`, `report/export`, `join/[linkToken]`, `r/[snapshotId]` all freeze on navigation. These users are the least forgiving and the most likely to be on a phone. → branded `RouteLoadingScreen` for each.
2. **Assessment edit tabs** — `(dashboard)/assessments/[id]/edit/{composition,overview,presentation,reports,settings}` and the partner mirror: no `loading.tsx` anywhere in the segment, so switching tabs freezes the tab bar while `getAssessmentWithItems()` runs. → one `loading.tsx` per tab segment (the layout already renders the shell — skeleton only needs the tab body).
3. **Settings cluster** — 11 admin subpages (audit, migrations, models, prompts, users, …) with no loading state.
4. **Campaign overview** — blocks CTA buttons on the completion chart's data; wrap the chart in `Suspense` so status actions render in ~300ms.

**Skeleton fidelity:** the audited top routes (dashboard, campaigns, directory, response-formats) match well. The drift risk is mechanical: **~80 hand-rolled `Skeleton`/`Shimmer` implementations** with three different animation styles, while `DataTableLoading` (used 19×) is the one shared primitive. 12 `loading.tsx` files are byte-identical copies. → consolidate into `src/components/loading/` primitives (`PageHeaderSkeleton`, `TableSkeleton`, `CardGridSkeleton`, `FormSkeleton`, `EditorSkeleton`) and make every `loading.tsx` a 5-line composition of those. Skeletons then stay in sync by construction.

**Streaming candidates (verified, ranked):** campaign overview chart; assessment composition editor (shell first, factor tree streamed); participant detail (header first, sessions streamed); diagnostics list; assess intro (brand shell first).

---

## Theme 5 — Caching & navigation (P1)

What's already right: brand + experience configs use `unstable_cache` with 5-min TTL and tag invalidation ([actions/brand.ts](../../src/app/actions/brand.ts), [actions/experience.ts](../../src/app/actions/experience.ts)); `validateAccessToken`, `getCampaignHeader`, scope resolution use React `cache()` for request-level dedupe. Marketing pages are static; login is correctly dynamic.

Gaps:
1. **No `staleTimes`** → `experimental.staleTimes = { dynamic: 30 }` makes back/forward and repeat navigation instant for 30s. For an internal dashboard this is the single cheapest "the app feels snappy" change that exists. (Add alongside `optimizePackageImports` — see Theme 6.)
2. **Semi-static data fetched per request**: taxonomy pickers (factors/constructs/response formats), AI settings, email templates. Wrap reads in `unstable_cache` with tags (`taxonomy`, `ai-config`, `email-templates`) invalidated by their mutation actions. These change weekly, not per-request.
3. **Broad invalidation**: e.g. constructs actions call `revalidatePath` at root ([actions/constructs.ts:202-206](../../src/app/actions/constructs.ts)) — switch to tags.
4. No client data library — fine, the RSC model fits this app; the fixes above remove most of the need rather than adding react-query.

---

## Theme 6 — Bundle & hydration (P1/P2 — mostly healthy)

Confirmed healthy: no server-lib leaks (`login-bundle-purity` architecture test guards it); tiptap/maily/cmdk lazy-loaded; lucide-react + date-fns are auto-optimized by Next's default `optimizePackageImports` list.

Worth doing:
1. **Fonts** ([src/app/layout.tsx:10-22](../../src/app/layout.tsx)): Plus Jakarta Sans ships 5 weights + Geist Mono 3 → trim to what's actually used (likely 400/600/700 + mono 400). ~30–40KB and faster first paint.
2. **`@base-ui/react` → add `optimizePackageImports`** entry (not in Next's default list).
3. **papaparse** statically imported in [campaign-participant-manager.tsx](../../src/app/(dashboard)/campaigns/%5Bid%5D/participants/campaign-participant-manager.tsx) — used only when a CSV is uploaded → `await import("papaparse")` in the handler (~12KB off that route).
4. **Full-array props to client tables**: participants/sessions arrive as complete arrays (every row, every column) serialized into the RSC payload. Fine at 30 rows; not at 1,000. Pair server-side pagination with #3 in Theme 2.
5. **Page-level `"use client"`** on [generate/[runId]/page.tsx:1](../../src/app/(dashboard)/generate/%5BrunId%5D/page.tsx) (910-line user-detail-client is the same shape) — convert shells to RSC with client islands when next touched; not urgent.
6. `@dnd-kit` static in composition editor — acceptable (power-user page), or wrap the editor in `next/dynamic` for free.

To get hard route-size numbers, run `ANALYZE=true next build` (or `next build` and read the route table) once the above land — worth capturing in CI as a budget later.

---

## Theme 7 — The three-tree duplication tax (P1, structural)

The duplication audit classified ~10 parallel routes: a few are thin wrappers over shared components (good — `report-templates/[id]/builder` is the model), but several are full copies with drift already visible:

- `campaigns/[id]/compare`: dashboard vs client are 99% identical, **but the client variant has an ownership guard and header details the dashboard variant lacks** — flagged as a possible drift bug; verify intent. Copies mean fixes land on one surface and silently miss the others.
- `campaigns/[id]/branding`: byte-identical 47-line wrappers.
- brand-settings pages: client + partner duplicate ~55 lines of inheritance-chain resolution.
- 12 byte-identical `loading.tsx` (~465 LOC), ~28 local re-implementations of `formatDate`/`formatDateTime`, 3 `statusBadgeVariant` copies.

**Consolidation order (each is an independent PR):**
1. `src/lib/formatting.ts` — formatters + badge variants; mechanical, ~30 files.
2. Shared skeleton library (merges with Theme 4's fix).
3. Surface-parameterized campaign detail pages (`overview`, `participants`, `compare`, `branding`) — one component, `surface` + feature props; deletes ~6 page bodies and ends compare-page drift.
4. Brand-inheritance resolver in `src/lib/brand/`.
5. Participants list + workspace-users pages (auth-sensitive; do last, test hardest).

This is also a *performance* program: shared pages mean waterfall fixes, skeletons, and optimistic patterns automatically apply to all three surfaces.

---

## Theme 8 — Database hygiene (P2 today, P1 at scale)

One migration (+ advisor re-run) covers:
1. **Merge overlapping permissive policies** on the 48 affected tables — fold the `*_all_platform_admin` check into the tenant policy with `OR`, or convert admin access to a single policy per action. Biggest offenders: `assessments`, `diagnostic_respondents`, `diagnostic_sessions`, `matching_runs` (20 overlaps each), `comparisons`, `profiles` (10 each).
2. **Fix `generation_presets_admin_all`** initplan lint (`auth.<fn>()` → `(select auth.<fn>())`).
3. **Add the 8 missing FK indexes** (`campaign_360_snapshots.generated_by`, `campaign_raters.approved_by/nominated_by`, `error_events.actor_profile_id`, `factors.reviewed_by`, `generation_presets.created_by/response_format_id`, `person_link_audit.performed_by`).
4. **Drop the 99 unused indexes** in two passes (drop the obviously-dead, re-check advisors after 30 days for the rest) — they cost every write.

None of this moves today's latency much (tables are tiny) — it's insurance that the RLS layer doesn't become the bottleneck right when usage grows, and it clears the advisor noise so real regressions are visible.

---

## Roadmap

**Phase 1 — Cut the request tax (1–2 days each, do first):**
1. `getClaims()` local JWT verification in proxy + `resolveSessionActor`; keep `getUser()` at auth boundaries only.
2. Parallelize `resolveAuthorizedScopeImpl` + bootstrap internals.
3. `staleTimes: { dynamic: 30 }` + `optimizePackageImports: ["@base-ui/react"]` + font-weight trim (one config PR).
4. Waterfall fixes in the six verified helpers (Theme 2 table).

**Phase 2 — Make mutations feel instant (≈1 week):**
5. Optimistic updates + targeted revalidation for participants manager, users table, assignment panels (replace ~75 `router.refresh()` progressively).
6. Backoff/Realtime for the 2s and 3s pollers.
7. `unstable_cache` + tags for taxonomy/AI-settings/email-template reads.

**Phase 3 — Make waiting invisible (≈1 week, parallelizable with 2):**
8. Skeleton library consolidation; then `loading.tsx` for: all assess-flow pages, assessment-edit tabs (both surfaces), settings cluster, remaining client/partner gaps.
9. Suspense streaming on the five identified pages.
10. Wire `isBoundaryPending` to the assess section-transition button; pending/disabled states on settings forms.

**Phase 4 — Structural (ongoing, one PR each):**
11. `lib/formatting.ts` extraction → 12. surface-parameterized campaign pages → 13. brand resolver → 14. users/participants consolidation.
15. DB hygiene migration (advisors re-run after).

## Measurement & guardrails

- **Before/after:** Speed Insights is already installed (`@vercel/speed-insights`) — capture current p75 TTFB/LCP/INP per route group now, re-check after each phase. Targets: dashboard TTFB p75 < 200ms (from an estimated 400–800ms), skeleton visible < 100ms on every navigation, mutation feedback < 50ms.
- **Server-Timing:** add a `Server-Timing` header in the proxy (auth, scope, page) so regressions show in DevTools without guesswork.
- **Budgets:** once Phase 1 lands, record `next build` route sizes and add a CI check for first-load JS on the five hottest routes; re-run `get_advisors` after the hygiene migration and after any new table.
- **Regression tripwires:** an architecture test asserting no `auth.getUser()` outside the allowed files (same pattern as `passwordless-only.test.ts` / `login-bundle-purity.test.ts`), and an ESLint `no-restricted-syntax` rule against new local `formatDate` definitions.
