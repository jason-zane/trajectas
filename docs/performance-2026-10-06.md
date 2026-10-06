# Performance diagnosis — 6 October 2026

Ordinary signed-in production navigation reproduced multi-second responses. A
small directory response finished after 2.8–3.6 seconds; the dashboard navigation
request took 3.6 seconds. Three avoidable read costs are addressed in this branch.
The patch has not been deployed, and these findings do not establish field p95
or promise a particular production speedup.

## Live observations

Chrome used Jason's existing signed-in profile at `admin.trajectas.com`, with its
normal extensions, cache enabled, no throttling, and DevTools open. These are
individual diagnostic samples, not a controlled cold-cache/warm-cache benchmark.
No service worker participated in the observed directory navigation. No
assessments were submitted, customer data changed, or load tests run.

| Journey | Observation | Interpretation and limit |
| --- | --- | --- |
| Directory document, already-loaded reload sample | TTFB 59 ms; response-start→response-end 3,554 ms; DOMContentLoaded 3,628 ms; load 4,212 ms; encoded body 17,160 bytes | The small response takes seconds to finish. Early headers do not mean route data is ready. |
| Directory, fresh ordinary reload, HTTP 200 | TTFB 7 ms; response-start→response-end 2,789 ms; DOMContentLoaded 2,813 ms; load 2,832 ms; encoded body 17,160 bytes | Reproduces the wait. The interval includes streamed server work and transport; no trace identifies the individual slow operation. |
| Click to admin dashboard, RSC request, HTTP 200 | Request duration 3,610 ms; TTFB 504 ms; transferred 4,732 bytes | Slow navigation is also present outside the directory. Other 258–287 ms requests were prefetches, not comparable navigations. |
| Directory result | Search blank, no active filter; server RSC supplied `clients: []`; table shows 0 clients | Empty data originated on the server, rather than only in table filtering or hydration. |
| Dashboard result | 6 dimensions, 29 factors, 29 constructs, 623 items, 5 assessments, 0 clients | The client discrepancy also affects another authenticated read path. |

Network panel totals spanning cached requests and unrelated frames are excluded
from payload claims. Observed console errors were extensions and a blocked
Vercel toolbar frame; they do not establish an application rendering failure.
Client main-thread/render cost was not separately profiled.

## Database, location, and release evidence

Authorized Supabase metadata identifies project `rwpfwfcaxoevnvtkdmkx` as healthy
in `ap-southeast-1` (Singapore). Repository `vercel.json` requests `sin1`
(Singapore). There is no evidence here of a Singapore-to-different-region
database hop. Actual deployment placement and routing remain unverified.

Bounded, read-only aggregate queries with a 3-second statement timeout found
five clients, all active and unarchived. Taxonomy counts were 6/29/29/623,
matching the live dashboard; nine unarchived assessments contrasted with five
visible in that session. No customer names or payloads were exported. This
supports investigating session/workspace visibility, but does not prove the
deployed app's datasource or the precise authorization branch.

Historical `pg_stat_statements` was last reset on 6 September 2026. Coarse
client-related entries had a call-weighted mean of 7.408 ms (278 calls, 37
patterns), profile-related 5.219 ms (271 calls, 14 patterns), and report-related
0.357 ms (67,881 calls, 26 patterns). These categories are approximate, overlap
in topic, and do not correlate to these browser samples. Other entries include
an execution maximum of 6.375 seconds. They neither establish a current database
bottleneck nor rule out a slow route query. No heavy queries or EXPLAIN ANALYZE
were run.

A bounded snapshot aggregate found 12 reports: seven released with PDFs ready,
five ready with PDF status unset, and no queued/processing PDF backlog. The
repository schedules PDF recovery every minute and report generation recovery
every five minutes, with bounded concurrency and sequential PDF processing per
worker. Scheduling and Chromium/provider startup can affect a newly queued
report; no end-to-end generation timing was measured and no job was triggered.

GitHub confirms PR #423 merged at 06:33:52 UTC into
`4dc792a283a828065452fa74bae499081a8d49ea`, this branch's base. A successful
Vercel commit status does not verify the SHA serving production. PR #422 remains
draft/unmerged. Neither pending work nor this patch is credited as a live
performance improvement. Vercel project/environment/deployment reads returned
403 earlier; those operations were not retried through another access route.

## Ranked costs and proposed actions

1. **Route response latency — measured, high confidence; precise cause unknown.**
   Directory and dashboard responses wait seconds despite small payloads. After
   release approval, repeat these same journeys and correlate route, auth,
   Supabase, and downstream operation durations using authorized tracing.
   Cold-start attribution, individual API spans, and client rendering remain
   evidence gaps. Existing request-scoped scope/actor caching and `getClaims()`
   are already on the base branch; the old June audit is not a current checklist.
2. **Unrelated directory reads — confirmed in source; contribution unmeasured.**
   The clients tab awaited partners, and the partners tab awaited clients and
   commercial summaries. The patch reads only the selected tab's dependencies,
   preserving access gates and tab fallback. Clients still wait for their own
   commercial columns; removing that dependency would need a separate UI
   decision to preserve table filtering/sorting semantics.
3. **Duplicate client-dashboard campaign read — confirmed in source and synthetic
   execution; client-dashboard live impact not measured.** Both totals and
   operational cards requested the same campaign list. A private React `cache`
   wrapper now keys by the primitive client ID, with all existing authorization
   and scope resolution inside. It deduplicates only within a server render.
   The existing parallel access-link query and result ordering are preserved.
4. **Monthly health overfetch — confirmed in source; current volume unknown.**
   Health classification needs six completed UTC months but read all historical
   months. SQL now selects that exact date window. No schema/index/region change
   is proposed. A synthetic 109-row dataset returns 18 rows with the same health
   classifications, including the year boundary and old-only history.
5. **Large-client dashboard scaling — source hypothesis, follow-up.**
   `getRecentClientResults` reads all qualifying participants and nested sessions
   before deriving last activity, sorting and slicing to five. Operational cards
   similarly slice the full campaign list. A naive SQL limit changes the defined
   ordering because last activity is derived from sessions and campaign ordering
   prioritizes status. Measure real row counts/payloads first, then consider a
   scoped projection that retains these semantics. No query rewrite is included.

## Directory visibility remains separate

The five database clients versus zero session-visible clients are unresolved.
`resolveTenantClientFilter` permits an unrestricted result only for an
unconfined platform administrator; an active workspace/support/preview context
can narrow visible IDs to none. The visible admin sidebar does not expose this
scope. This is a source-supported candidate, not a confirmed root cause.

Source review confirms normal sign-out clears active and preview context
cookies, and successful admin sign-in clears them again. Signing in without
first signing out may preserve an existing context. A normal sign-out/sign-in
test awaits explicit approval and user participation in OTP entry. No auth flow,
permission change, scope bypass, or context manipulation was performed. These
performance changes do not purport to restore missing clients.

## Local verification and reproduction

Synthetic tests render the actual action module with the real React server
cache; only I/O, authority and data are mocked. Evidence is stored in
`performance-evidence/2026-10-06-campaign-reads.json`. The dashboard scenario
reduces campaign list calls **2→1** and mocked scope-resolver invocations **2→1**,
preserving the same 60-campaign total, six selected campaign IDs, and access links. Separate
renders/actors and different client keys do not share cached results. Confined
empty scopes and allowed campaign IDs remain intact. These call counts are
deterministic local evidence, not production latency benchmarks.

The real scope resolver already has its own request cache; the invocation count
does not imply an additional authorization database roundtrip has been removed.

```sh
git show 4dc792a283a828065452fa74bae499081a8d49ea:src/app/actions/campaigns.ts > /tmp/trajectas-campaigns-before.ts
node --conditions=react-server tests/fixtures/campaign-reads-rsc.mjs dashboard /tmp/trajectas-campaigns-before.ts
node --conditions=react-server tests/fixtures/campaign-reads-rsc.mjs dashboard
npx vitest run tests/unit/campaign-read-performance.test.ts tests/unit/business-health-window.test.ts tests/components/directory-tab-reads.test.tsx
```

Full lint and typecheck passed. All 247 selected unit/architecture/component
files passed, totaling 3,143 tests. No production env file was copied and no
database integration test was run. The dependency tree was copied independently
from the same-base checkout after registry access failed; dependency files are
unchanged.

The normal `npm run build` (Turbopack) remained in compilation without further
output for about five minutes and was interrupted. Its outcome is unverified;
there was no reported compiler error. Supplementary `npm run build -- --webpack`
failed with `UnhandledSchemeError` for `node:crypto` and `node:util/types`, through
the unchanged `instrumentation-node.ts` / observability modules. The exact
committed base, archived into a separate temporary tree with the same dependency
copy, reproduced both Webpack errors. This establishes that the Webpack failure
predates the patch; it does not establish why Turbopack stalled or validate a
normal release build. No build/configuration repair is included. Verify the
normal build in the release environment before merging.

Merge/deploy requires explicit release approval. After an approved release,
verify the serving SHA, repeat several ordinary signed-in reloads and navigation
samples under the same conditions, inspect the same payloads and counts, and
verify authorized/confined actors retain their existing visible data. Production
tracing and new assessment/report journeys require the relevant authorized
access and available client/report records; this investigation does not provide
their timings.
