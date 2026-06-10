# Remediation & Hardening Plan

**Companion to:** `audits/2026-06-10-full-site-audit.md`
**Date:** 2026-06-10
**Status:** plan only — no code changed.

This document turns the audit findings into an actionable, sequenced plan. Each item states **what**, **why it matters**, **how** (concrete steps against real files/symbols), **how to verify**, **risk & rollback**, **effort**, and **dependencies**. The final section, "Things to consider adding," is the forward-looking architecture work the audit implies but that goes beyond fixing what's broken.

Effort key: **S** = <½ day · **M** = ½–2 days · **L** = >2 days.
All DB work follows the repo's flow (AGENTS.md): branch in a worktree → apply locally via `supabase db reset` → `npm run test:integration:local` → apply to live via Supabase MCP `apply_migration` → `get_advisors` → commit the migration → PR with CI green.

---

## Phasing overview

| Phase | Theme | Items | Rationale |
| --- | --- | --- | --- |
| **0 — Stop the bleeding** (hours) | Active security regressions + cheap wins | 1, 2, 10, and stand up the stricter test (3) to surface blast radius | Cross-tenant data exposure is live; these are small diffs. |
| **1 — Close the gaps** (this week) | Finish the systemic guard, observability seam, test scaffolding | 3 (finalize), 4, 5, 9 | Make regressions impossible to reintroduce silently; restore error visibility. |
| **2 — Performance & DB hygiene** (next) | Latency + advisor debt, guarded by tests | 6, 7, 8 | Do the RLS rewrite only *after* its RLS tests exist (item 9). |
| **3 — Roadmap** (planned) | Durable infra & defensibility | "Things to consider adding" | Larger architectural investments. |

A guiding principle from the audit's root-cause analysis: **every security fix ships with a pinning test.** S1 and S2 regressed precisely because nothing failed when their guards were removed.

---

## Phase 0 — Stop the bleeding

### Item 1 — Restore authorization on email-template Server Actions  `[Security/High]`

**What.** `src/app/actions/email-templates.ts` exposes three `'use server'` exports that each become an independently-callable endpoint. Current state (confirmed):
- `listEmailTemplates` (line 16) — no auth check at all.
- `getEmailTemplate` (line 39) — no auth check at all.
- `upsertEmailTemplate` (line 68) — checks only `actor?.isActive` (line 77), not whether the actor may manage the *target scope*.

**Why it matters.** Any active, authenticated user — regardless of tenant or role — can call `upsertEmailTemplate({ type: 'magic_link', scopeType: 'platform', scopeId: null, ... })` and overwrite the platform-wide magic-link / welcome / staff-invite / report-ready / rater-invite email bodies that are then rendered and delivered to *other tenants'* users and participants. That is a stored content-injection / phishing vector reaching the most trust-laden emails in the system. The reads additionally leak any tenant's templates. This is a regression of prior finding F-003.

**How.**
1. Resolve scope once: `const scope = await resolveAuthorizedScope()` (already used elsewhere in `src/app/actions/reports.ts`).
2. Add a small internal guard, e.g. `assertCanManageEmailScope(scope, scopeType, scopeId)`:
   - `platform` → `assertAdminOnly(scope)` (`src/lib/auth/authorization.ts:859`).
   - `partner` → require `canManagePartner(scope, scopeId)` (`:395`).
   - `client` → require `canManageClient(scope, scopeId)` (`:383`).
   - Throw `AuthorizationError` on failure (the API/action layer already maps these to 403).
3. Apply it at the top of all three actions. For `listEmailTemplates`, when the caller is a partner/client admin requesting a scope they can't manage, return `[]` or throw — pick throw for consistency. (`assertAdminOnly` throwing for a platform-scope list is correct: only platform admins manage platform templates.)
4. Leave `upsertEmailTemplate`'s zod parse as the first step (it already validates shape), then scope-check, then write.

**Verify.**
- Unit: mock `resolveAuthorizedScope` to a client-admin scope; assert `upsertEmailTemplate` with `scopeType:'platform'` rejects, and with their own `client` scope succeeds.
- Integration (local Supabase, RLS fixture): a client-admin user cannot read or upsert another client's template nor any platform template.
- The hardened architecture test (item 3) must now pass for this file.

**Risk & rollback.** Low. Risk is over-restricting a legitimate admin path — covered by the success-case tests. Pure code change, revert is a one-file diff.

**Effort.** S. **Depends on:** nothing (but pairs with item 3).

---

### Item 2 — Gate the report-PDF Server Actions (IDOR)  `[Security/High]`

**What.** In `src/app/actions/reports.ts`:
- `downloadSnapshotPdfBase64(snapshotId)` (line 108) validates only UUID *format* (line 111), then reads `report_snapshots` via the admin (RLS-bypassing) client and returns the full PDF as base64. No tenancy check.
- `getSignedReportPdfUrl(storagePath)` (line 82) takes a **client-supplied storage path** and returns a signed download URL for any object in the `reports` bucket, with no validation. Paths are the predictable `reports/<snapshotId>.pdf`.

**Why it matters.** A caller who can invoke the action (the repo's own `admin-actions-authz` test treats every `'use server'` export as a public endpoint) and knows a snapshot UUID exfiltrates another tenant's psychometric report + PII. Zero defense-in-depth today.

**How.** *(Updated after a call-site re-check, 2026-06-10.)* The fix is **not** to bolt a user-session gate onto the existing functions — a re-check found **every real caller is server-side and none passes a client-supplied path**, and one caller runs without a user session. Specifically, `downloadSnapshotPdfBase64` is invoked by `notifyConsultantsForSnapshot` (`src/lib/notifications/consultant-notification.ts:138`), which runs in a **system context with no authenticated user** — it uses `createAdminClient()` and fires from a background `after()` path post-PDF-generation (`src/lib/reports/pdf.ts:311`) and directly from `src/lib/reports/runner.ts:366`. So naively wrapping it in `requireReportSnapshotAccess` (which needs a user scope) would **break the consultant email-attachment flow.** Apply the split-helper pattern to *both* functions:
1. **Internal, non-exported helpers** for the already-authorized / system callers — e.g. `loadSnapshotPdfBase64(snapshotId)` (used by `consultant-notification.ts:138` and `reports.ts:1295`) and `signReportStoragePath(path)` (used by the render paths `reports.ts:843,1525` and the participant flow `assess.ts:1588`, which pass a `pdf_url` already read from a DB row in an authorized context). These stay in the module / a server-only lib, are **not** `'use server'` exports, and carry no user-session gate.
2. **A separate guarded `'use server'` action** for any genuine *client* invocation: it takes a `snapshotId`, calls `requireReportSnapshotAccess(snapshotId)` (`src/lib/auth/authorization.ts:603`), resolves the snapshot's `pdf_url` server-side, then delegates to the internal helper. Never accept a path from the client.
   - Since the re-check found **no direct client caller** of either function, the simplest correct fix is to **un-export both** and convert the cross-module import in `assess.ts:1588` to the internal helper — this removes the IDOR surface entirely with no new gate to maintain. Add the guarded action only if/when a client path is actually needed.
3. Remove/constrain the `startsWith('http')` legacy branches (`reports.ts:89,120`). Note the corrected threat read: in `getSignedReportPdfUrl` the http path is returned **as-is with no fetch** (a pass-through, *not* SSRF — the original plan mislabeled this), and in `downloadSnapshotPdfBase64` the http value *is* fetched but comes from the DB row, not a caller argument. Either way, only honor stored `pdf_url` values read from the row, never a caller-supplied one.

**Verify.**
- Integration: if a guarded public action is added, a user without access to a snapshot's tenant gets `AuthorizationError` from it while the owning client-admin succeeds. **Regression-critical:** confirm the consultant-notification background path (no user session) still attaches the PDF via the internal helper — this is the flow a naive gate breaks.
- Add a test asserting the public surface (action, or the absence of any export) rejects/forbids an arbitrary foreign `snapshotId` / `reports/<other-id>.pdf`.

**Risk & rollback.** Medium — touches report download/email flows. The split-helper (or un-export) keeps the session-less consultant-notification path working; only the *public* surface changes. Revertable per-file.

**Effort.** M. **Depends on:** item 9's report-access test is nice-to-have first, but not blocking.

---

### Item 3 — Harden the `admin-actions-authz` architecture test  `[Systemic]`

**What.** `tests/architecture/admin-actions-authz.test.ts` is the invariant that *should* have caught S1 and S2. It has three blind spots (from the audit):
- It scans only `src/app/actions/` (≈ line 21), so inline `"use server"` modules elsewhere escape — e.g. `src/components/comparison/comparison-workspace.tsx` and `src/app/(marketing)/actions/submit-contact.ts`.
- `AUTH_PATTERNS` (≈ line 37) accepts a bare `token: string` parameter as evidence of a gate.
- It deliberately exempts admin-client **reads** (≈ line 103) — so S1's read leak and S2's read IDOR were structurally invisible to it.

**Why it matters.** This is the *systemic* fix. Without it, items 1 and 2 are whack-a-mole; with it, the class of bug fails CI on every PR.

**How.**
1. **Broaden scan roots.** Discover endpoints by the directive, not the directory: glob `src/**/*.{ts,tsx}` for files containing `'use server'` / `"use server"` (top-of-file or inline), union with `src/app/actions/`. Exclude test files.
2. **Tighten the gate heuristic.** A `token: string` param is not a gate. Require evidence that the token is *validated* in-function — a call to one of an allowlisted set (`validateAccessToken`, `requireReportSnapshotAccess`, `requirePreviewAccess`, HMAC/`timingSafeEqual`, etc.). Keep the existing `require*Access` / `assert*` / `canManage*` recognizers.
3. **Decide the read policy.** Don't blanket-exempt admin-client reads. Replace the exemption with an explicit, reviewed `READ_ALLOWLIST` (mirroring the existing mutation ALLOWLIST philosophy) so each intentionally-public read is a conscious, documented decision. Everything else must show an authz call.
4. **Sequence as TDD-for-security.** Land the *stricter test first* (it will fail, enumerating every current violation), triage the list, then fix items 1–2 and any others it surfaces, then go green. The failing list is itself a useful inventory.

**Verify.** The test fails before fixes, passes after items 1–2 (+ any siblings) are gated; CI enforces it on every PR thereafter.

**Risk & rollback.** Low risk to prod (test-only), but expect the stricter scan to surface *additional* unguarded actions — budget time to triage them. If the list is large, gate the known-critical ones now and convert the rest into a temporary, shrinking allowlist with a tracking issue rather than weakening the test.

**Effort.** M. **Depends on:** drives items 1, 2.

---

### Item 10 — `npm audit fix`  `[Deps]`

**What.** One moderate **production** advisory: `ws` 8.0.0–8.20.0 (uninitialized memory disclosure, GHSA-58qx-3vcg-4xpx). One moderate dev-only: `brace-expansion`. Neither is at CI's high+ gate, so this is hygiene, not a blocker.

**How.** Per AGENTS.md's dependency convention, as a *separate* `chore(deps)` commit (never mixed with feature work):
```
npm audit fix
npm run test:unit      # sanity
npm run build          # sanity
git add package-lock.json
git commit -m "chore(deps): npm audit fix — ws, brace-expansion"
```
If `audit fix` pulls an unwanted major, pin via the existing `overrides` block in `package.json` instead.

**Verify.** `npm audit --omit=dev --audit-level=high` clean; unit + build green.

**Risk & rollback.** Low; lockfile-only. Revert the commit if a transitive bump breaks the build.

**Effort.** S. **Depends on:** none.

---

## Phase 1 — Close the gaps

### Item 4 — CSP enforcement + brand-asset content validation  `[Security/Medium]`

**Two sub-tasks.**

**4a. CSP is Report-Only unless `CSP_ENFORCE=1`** (`src/proxy.ts:178`, `resolveCspContext`). The nonce + `strict-dynamic` policy enforces nothing by default.
- **How.** First, *confirm the production env*: check Vercel project env vars for `CSP_ENFORCE=1`. If it's set, this is documentation only. If it isn't, **flip the code default to enforcing** and add an explicit `CSP_REPORT_ONLY=1` escape hatch for debugging — fail-secure beats fail-open for an XSS control. The `style-src 'unsafe-inline'` weakness is a separate, larger tightening job (see "Things to consider adding").
- **Verify.** Load the app with the CSP enforced in a preview deploy; check the browser console for violations from legitimate inline styles/scripts and fix nonce wiring before promoting. The CSP-report endpoint (`src/app/api/csp-report/route.ts`) gives you the violation feed (and see item A7 — it currently only console-logs).

**4b. Brand-asset upload trusts client `file.type`** (`src/app/api/brand-assets/upload/route.ts:83`). The magic-byte validator at `src/lib/brand-assets/file-validation.ts` exists but is no longer imported (regression of F-002).
- **How.** Re-import the validator; read the leading bytes, verify the signature against an allowlist (PNG/JPEG/WebP/SVG-as-needed), and **derive the stored `contentType` and extension from the validated bytes**, not from `file.type`. Reject mismatches. If SVG is allowed, run it through `sanitize-html` / an SVG sanitizer since SVG can carry script.
- **Verify.** Unit-test: an HTML/script payload renamed `logo.png` is rejected; a genuine PNG passes and stores `image/png`.

**Risk & rollback.** 4a is the riskier half — an over-strict CSP can break the app; stage it on a preview first. 4b is low-risk and self-contained.

**Effort.** 4a M (mostly verification), 4b S. **Depends on:** none.

---

### Item 5 — Restore error visibility: `onRequestError` → `reportError`, sweep silent catches  `[Auditability/High]`

**What.**
- `src/instrumentation.ts:16-27` appends unhandled errors to `/tmp/trajectas-errors.log` (and swallows its own failures at 24-26) — effectively nowhere on Vercel's ephemeral FS. `onRequestError` never calls the existing self-hosted `reportError()` even though the integration seam is documented at `src/lib/observability/report-error.ts:100-102`.
- Error capture is opt-in (`reportError`/`logActionError` in only ~34 files). Many catches discard entirely: `src/app/actions/architect.ts:224-226`, `src/app/actions/factors.ts:174-176`, `src/app/api/chat/route.ts:113-127`.

**Why it matters.** When a Server Action or RSC render throws (the very "digest" crashes the /tmp hack was added for), nothing reaches `error_events`; operators are blind beyond Vercel's short log window. An expired AI provider key currently fails user-visibly with *zero* server-side trace.

**How.**
1. Rewrite `onRequestError` (in `src/instrumentation.ts`) to `await reportError(err, { source: 'onRequestError', context: { routerKind, routePath, ... } })` (the request metadata Next passes to `onRequestError`). Delete the `/tmp` append hack.
2. Sweep generic-message catches in `src/app/actions/**` and AI/email paths to call `logActionError(context, error)` (`src/lib/security/action-errors.ts:14`) before returning the friendly message. Keep user-facing copy unchanged; just stop swallowing.
3. Add an ESLint guard (custom rule or `no-empty` + a lint convention) flagging bare `catch {}` / `catch (e) {}` that neither rethrow nor log in `src/app/actions/**` and `src/app/api/**`.
4. For `/api/chat` mid-stream errors, log server-side via `reportError` in addition to writing the client stream.

**Verify.** Locally (against local Supabase), force a throw in a test action and confirm an `error_events` row appears; unit-test that `onRequestError` invokes `reportError`. Watch the observability dashboard (`/settings/observability`) populate.

**Risk & rollback.** Low. Additive logging; the main caution is not logging PII — pass ids, not emails (see item A12 / "Things to consider adding"). Don't let a failing `reportError` throw inside `onRequestError` (guard it).

**Effort.** M. **Depends on:** none. Synergizes with request-id work (A10) below.

---

### Item 9 — Test scaffolding for the highest-risk write paths  `[Testing/High]`

Land these *before* the RLS rewrite (item 8) and alongside the report-access fix (item 2), so the risky changes are guarded.

**9a. Session-scoring orchestrator.** `src/lib/scoring/ctt-session.ts` (`scoreSessionCTT`, 265 lines) is the production entry from `src/app/actions/assess.ts:22` and `three-sixty.ts:8`, and it *writes* `participant_scores`. The pure math beneath is tested; the rows→scores assembly is not.
- **How.** Unit-test with fixture session rows (responses in → expected scores out), covering edge cases (missing responses, reverse-keyed items, partial sessions). Add one seeded-integration test asserting the persisted `participant_scores` row matches. Also cover `validity.ts` and `adaptive/` (cat-engine, rule-based).

**9b. RLS cross-tenant probes for response data.** Only ~12 of ~95 RLS tables have tests; the candidate/response family is uncovered.
- **How.** Extend the `tenant-isolation` fixture (`tests/integration/`) with cross-tenant SELECT/INSERT/UPDATE probes for, in priority order: `candidate_sessions`, `candidate_responses`, `candidate_scores`, `report_snapshots`, `items`/`item_*` (assessment IP), `integration_credentials`, `user_invites`. Assert a tenant-A user gets zero rows / RLS denial for tenant-B data. **These tests are the safety net for item 8.**

**9c. Bulk-import parse/validate.** `src/app/actions/bulk-import.ts` (1,967 lines; `importLibraryRows:1089`, `importLibraryBundleRows:1131`, `structureLibraryImportWithAI:1882`) — zero tests on a silent-data-corruption surface.
- **How.** Extract the pure parse/validate helpers out of the action into a `lib/` module (refactor-for-testability), then unit-test against malformed-CSV fixtures: wrong headers, duplicate keys, injection-y cell values, oversized rows, encoding issues.

**Verify.** New suites green locally and in CI's `quality`/`integration` jobs.

**Risk & rollback.** Low (tests). 9c involves a refactor — do it behind the existing integration coverage and keep the action's external behavior identical.

**Effort.** L (three sub-areas). **Depends on:** none; **enables** item 8.

---

## Phase 2 — Performance & DB hygiene

### Item 6 — Remove the proxy's second remote `getUser()`  `[Performance/High]`

**What.** Every authenticated request verifies the session twice over the network: `src/proxy.ts:351` (`supabase.auth.getUser()`) and again at render in `resolveSessionActor` (`src/lib/auth/actor.ts:55`). `React.cache()` doesn't span the proxy→render boundary.

**Why it matters.** ~50–150 ms TTFB on *every* dashboard/partner/client navigation and server action — and `vercel.json` pins `sin1` while the Supabase project is `ap-southeast-1` (co-located, good, but two Auth-API hops still stack).

**How.**
1. In the proxy, replace the remote `getUser()` with **local JWT verification**: `supabase.auth.getClaims()` verifies the JWT against the project's JWKS, cached, no network roundtrip. Use the claims for the proxy's role-based cross-surface redirects (≈ lines 390–429) and the session-activity expiry check (≈ 351–359).
2. Keep the single authoritative remote `getUser()` in `resolveSessionActor` at render — so a revoked session is still caught where it matters (page data), while the proxy only does cheap gating/redirects.
3. **Prerequisite to verify:** `getClaims()` local verification needs the project on **asymmetric JWT signing keys** (ES256/RS256 + JWKS). Confirm the Supabase project's JWT signing key configuration; if it's still on the legacy shared HS256 secret, either migrate to signing keys (Supabase dashboard → Auth → JWT keys) or have the proxy verify with the secret locally. This check gates the approach.

**Verify.** Measure TTFB on an authenticated route before/after (Vercel speed-insights is already wired). Update `tests/unit/proxy.test.ts` — it currently mocks `getUser → null` throughout; add `getClaims` mocking and cover the authenticated branches (this also closes test gap T5).

**Risk & rollback.** Medium. Getting proxy auth wrong risks lockouts or open redirects — stage on preview, and because the render-side `getUser()` remains authoritative, the proxy weakening is bounded. Revert is a single-file change.

**Effort.** M. **Depends on:** JWT-signing-key prerequisite; pairs with proxy test coverage (T5).

---

### Item 7 — Parallelize report-narrative LLM calls; hoist config  `[Performance/High]`

**What.** In `ai_enhanced` mode, `src/lib/reports/runner.ts` (entity loop ≈ 666–692) calls `enhanceNarrative` per scored entity, and `src/lib/reports/ai-narrative.ts:30-33` re-fetches `getActiveSystemPrompt` + `getModelForTask` (`prompt-config.ts:22`, `model-config.ts:27`, both uncached) on every call, then makes one blocking LLM call. Blocks are also serial (`runner.ts:280`). A 20–30 entity report = 20–30 serial LLM calls + 40–60 DB lookups — minutes of latency and a real risk against the 300 s cap shared by `after()` (`/api/reports/generate`).

**How.**
1. **Hoist** the prompt/model lookup to once per run — fetch before the loop, pass the resolved config down; or wrap the two getters in `React.cache()` / a per-run memo.
2. **Bound-concurrency parallelize** the per-entity narratives with `Promise.all` over a worker pool of 4–6 (reuse the bounded-concurrency pattern already used for bulk invites at `campaigns.ts:1361-1366`). Tune concurrency against the provider's rate limits.
3. If even parallelized runs approach 300 s for the largest reports, this becomes the trigger for the durable-queue work (item P3 / "Things to consider adding") rather than a band-aid.

**Verify.** Unit-test the orchestration with the existing `pipeline-mock` / a mocked LLM: assert config is fetched once and N narratives dispatch concurrently. Time a representative report before/after.

**Risk & rollback.** Low–medium. Watch provider rate-limit/429s under concurrency; keep retry/backoff. Revertable per-file.

**Effort.** M. **Depends on:** none.

---

### Item 8 — RLS consolidation + initplan fix + FK indexes (DB hygiene)  `[Performance/DB]`

**What.** Live advisors show 333 lints, 225 of them one systemic pattern: a `*_all_platform_admin` catch-all policy coexisting with per-role policies, so every query evaluates 2–5 policy expressions. Plus one `auth_rls_initplan` miss (`generation_presets_admin_all`) and 8 unindexed FKs.

**How — three *separate* migrations** (never mix concerns):

1. **Policy consolidation** (the big win). For the top-5 hot tables — `assessments`, `profiles`, `diagnostic_sessions`, `diagnostic_respondents`, `clients` — `DROP` the overlapping policies and `CREATE` a single policy per action that `OR`s the platform-admin branch with the role-specific branch, **scoped `TO authenticated`** (most are currently `TO public`, so they're needlessly evaluated for `anon`/`authenticator`/`dashboard_user`), using initplan form `(select is_platform_admin())` / `(select auth.uid())`. This removes ~87 of the 225 warnings and covers the hottest paths.
   - **Before touching `diagnostic_sessions` / `diagnostic_respondents`:** the advisor digest noted these have `anon` full-CRUD policies. **Verify whether anon writes are intentional** (anonymous survey flow) — the security agent did *not* flag them as a vuln, but confirm against the assess RPC design before rewriting, so consolidation doesn't accidentally widen or break the anonymous path.
2. **Initplan fix.** Rewrite `generation_presets_admin_all` to wrap its `auth.*()` call as `(select auth.*())`. One-line policy replace.
3. **FK indexes.** Add the 8 missing indexes: `campaign_360_snapshots.generated_by`, `campaign_raters.approved_by`, `campaign_raters.nominated_by`, `error_events.actor_profile_id`, `factors.reviewed_by`, `generation_presets.created_by`, `generation_presets.response_format_id`, `person_link_audit.performed_by`.

**Process (critical — this is RLS).**
- **Item 9b's RLS tests must exist first** for the affected tables. A consolidation bug either locks tenants out or opens a leak; the cross-tenant probes are the guardrail.
- Apply locally (`supabase db reset`), run `npm run test:integration:local` (tenant-isolation + new probes), then apply to live via MCP `apply_migration`, then **`get_advisors` to confirm the warning count drops** and no new ERRORs appear. Commit the migration files.
- Leave the 99 `unused_index` INFOs alone for now — schedule a *separate* review (some guard new features; stats may be young). Don't drop reflexively.

**Verify.** `get_advisors(performance)` warning count falls by ~87+; tenant-isolation and the new RLS probes stay green; spot-check `EXPLAIN` on a hot query shows fewer policy quals.

**Risk & rollback.** **Highest-risk item in the plan** — it rewrites live RLS. Mitigations: tests-first, local-first, advisor re-check, one table-group per migration so a bad one is isolated and revertable. Keep the original `CREATE POLICY` statements handy for instant rollback.

**Effort.** L. **Depends on:** item 9b (RLS tests) — hard dependency.

---

## Remaining audit findings (fold into the phases above or schedule)

These are the lower-severity findings from the four reports, grouped so none is lost.

**Security**
- **S5 — rate limiter fails open** to per-instance memory on Upstash error (`src/lib/security/rate-limit.ts:270`). Make AI/PDF/generation routes fail-*closed*, and alert on fallback (ties to observability). Add a **per-email** OTP throttle in addition to the IP key (`:192`) so an IP-rotating attacker is still bound per victim. *Effort M.*
- **S6 — SSRF guard is string-based** (`src/lib/integrations/url-security.ts`). Residual DNS-rebinding / public-host-resolves-private risk. Add a resolved-IP check at fetch time or route outbound webhooks through an egress proxy. *Effort M.*
- **SECURITY DEFINER RPC exposure** — 9 helper functions (`auth_user_client_id`, `auth_user_role`, `is_platform_admin`, …) are RPC-callable by `authenticated`. Low impact (they return the caller's own scope) but the repo convention is to `REVOKE EXECUTE` on DEFINER functions not meant for direct RPC (see `20260512150000_trajectory_revoke_trigger_fn_exec.sql`). One small migration. *Effort S.*

**Performance (lower)**
- **P3 — AI generation runs inside a held-open HTTP request** with no durable resume (`/api/generation/start`, `pipeline.ts:142,159`). See "Durable job queue" below — this is the flagship case. *Effort L.*
- **P4** — N+1 RPC in `partner-entitlements.ts:56-63`: replace per-row `get_partner_assessment_quota_usage` with a set-based RPC or `Promise.all`. *S.*
- **P5 / P6** — unbounded `select('*')` for counts (`dal/campaigns.ts:250-258`) and the whole item bank shipped to the client (`actions/items.ts:21-44`); both risk PostgREST's 1000-row silent truncation. Switch counts to `head:true, count:'exact'` aggregates; column-select + paginate the items list. *S–M.*
- **P7** — host the `@sparticuz/chromium-min` pack in same-region storage and set `CHROMIUM_MIN_PACK_URL` (`pdf-browser.ts:57-64`) to kill the cold-start GitHub fetch; add a `functions` memory bump for the PDF route in `vercel.json`. *S.*
- **P8–P12** — proxy rate-limit/auth can run concurrently (`proxy.ts:315→351`); observer-variant per-row UPDATEs → one jsonb RPC (`observer-variants.ts:168-178`); comparison authz batch-fetch (`comparison.ts:49,317`); `cache()`-wrap `requireParticipantRuntimeAccess` and reuse the session row (`participant-runtime.ts`); add growth guards to dashboard list queries. *Each S.*
- **Cleanup** — remove unused `pdfkit` / `pdf-lib` deps (PDF path is puppeteer-based). *S.*

**Auditability (lower)**
- **A5 — entitlement/quota changes unaudited** (`client-entitlements.ts:681-799`, `partner-entitlements.ts:119-242`). Add `entitlement.*` audit events with previous/new values. *S.*
- **A6 — cron failure visibility** — route `assessment-resume-reminders` failures through `reportError(..., { alert: true })` (`route.ts:32-39`, `resume-reminders.ts:210,256`), matching the account-deletion sweep. *S.*
- **A8 — audit tables append-only by convention only.** `REVOKE UPDATE/DELETE` + block-triggers on `audit_events`, `error_events`, `account_deletion_audit`; make `org_diagnostic_profiles` genuinely immutable (it has a platform-admin `FOR ALL` policy despite the "Immutable" comment). *M.*
- **A9 — `logAuditEvent` throws and isn't wrapped** at destructive call sites (`campaigns.ts:825,1443`): a transient audit-insert failure after a successful mutation surfaces as a user error *and* leaves the mutation unaudited. Catch + `reportError` fallback, or move the audit insert into the same RPC/transaction for destructive ops. *S–M.*
- **A11 — email template edits unversioned/unaudited** (compounds S1): add an audit event and consider a history/version table. *S.*
- **A12 — PII in logs** — recipient emails logged on Resend failure (`provider.ts:57-59`) flow into Vercel logs and `error_events.message`. Adopt id-based redaction. *S.*

**Testing (lower)**
- **T5** — covered by item 6's proxy test work + add tests for `actions/auth.ts` (OTP request/verify). *M.*
- **T6** — run seeded e2e on PRs that touch `src/app/assess/**` (path filter) or nightly, not just the weekly cron (`e2e-seeded.yml`). *S.*
- **T7 / T8** — integration-test the PDF route auth/token validation; unit-test the AI provider retry/backoff (`openrouter-retry.ts`) deterministically and orchestration via `pipeline-mock`. *M.*
- **T9** — covered by item 3.
- **T10–T12** — test `dal/workspace.ts` & `dal/audit.ts`; convert real-timer sleeps in `use-save-queue.test.ts` to fake timers; widen the coverage-threshold allowlist (`vitest.config.ts:29-49`) to pin already-well-tested modules so coverage can't silently erode; fix the stale "three jobs" CI note in AGENTS.md. *Each S.*

---

## Things to consider adding to the system (forward-looking)

These go beyond fixing what's broken — they're the structural investments the audit points toward. Two subsystems already model the target state and are worth copying from across the app: the **integrations API** (request ids, audit correlation, delivery outbox) and the **item-generation pipeline** (full reproducibility: model, prompt version, tokens, snapshot).

1. **Centralized error tracking (Sentry or OpenTelemetry).** Today there is none — only the self-hosted `error_events` store fed opt-in. A real APM gives unhandled-rejection capture, client-side JS error capture (the assessment runner is the highest-stakes client surface — a browser-specific break currently churns participants silently, finding A7), release health, and performance traces. The instrumentation seams already exist (`instrumentation-client.ts`, `instrumentation.ts`, `instrumentation-node.ts`); this is mostly wiring + a DSN. Decide: adopt Sentry *and* keep `error_events` as the in-app operator view, or feed both from one `reportError`.

2. **Request correlation ids end to end.** Mint a request id in `src/proxy.ts`, propagate via header/async-context, and thread it through `logAuditEvent` and `reportError` (the `error_events.request_id` column already exists but is never populated, finding A10). This makes "show me everything that happened in the request that errored" a query instead of guesswork — and ties error → audit → outbound webhook together.

3. **Durable job queue for long-running work.** AI generation (P3) and large `ai_enhanced` report rendering (item 7) run inside held-open HTTP requests against a 300 s ceiling, with crash = stranded `running` row and no resume. Adopt a real queue — **pgmq / Supabase Queues** fits the existing Postgres-centric stack, or a Vercel-friendly durable-execution service — with status polling (the reports `after()` + poll pattern is a half-step toward this), per-unit progress, idempotent retry, and resumability. This is the single biggest reliability investment.

4. **Email delivery ledger + Resend webhooks (finding A3).** An `email_sends` table (type, recipient-id, scope, `resend_message_id`, status, timestamps) written by `sendHtmlEmail` (which currently discards the message id), plus a Resend bounce/complaint/delivery webhook endpoint (verify signatures with the `standardwebhooks` lib already in `package.json`). Reconcile the `campaign.participant.invited` audit event (logged *before* the send today) with actual delivery so "they never got the invite" is answerable. Feed suppression back into the invite flow.

5. **AI invocation traceability everywhere (finding A4).** Extend the item-generation pipeline's reproducibility to *all* AI calls — report narratives, `/api/chat`, architect brief extraction, library field assist. Persist `{model, promptVersion, tokenUsage, fallbackUsed}` (an `ai_invocations` table, or into `report_snapshots.rendered_data`). For a psychometric product, "which model and prompt produced this report wording, and did AI even run?" is a **defensibility / compliance** question a client will eventually ask — and today the snapshot can claim `narrative_mode='ai_enhanced'` after a silent fallback to derived text.

6. **Cost & usage observability for AI.** With token usage captured (above), add per-client / per-run cost rollups and budget alerts. Generation and `ai_enhanced` reports are the cost centers; right now spend is invisible until the provider bill arrives.

7. **Immutability as a database guarantee, not a comment (finding A8).** `REVOKE UPDATE/DELETE` + raise-exception triggers on `audit_events`, `error_events`, `account_deletion_audit`, and the `org_diagnostic_profiles` snapshots. For a compliance-sensitive B2B product, "the audit log is tamper-evident at the DB layer" is a sellable property.

8. **CSP tightening roadmap.** After 4a enforces, remove `style-src 'unsafe-inline'` via hashed/nonce styles and audit `strict-dynamic` coverage. Wire the CSP-report endpoint (`api/csp-report`) into `error_events`/Sentry instead of console so violations are visible. End state: a strict, enforced CSP with a live violation feed.

9. **Anonymity safeguards for `org_diagnostic_respondents` — before the feature ships.** The table is deny-by-default and referenced by *no application code yet*, so there's no leak path today. Codify in the feature spec, **now**, that: audit/error metadata references respondents by id only (never email + response together); tenant-readable `audit_events` rows tagged with the respondent's `client_id` carry no respondent identity; and the same fail-closed discipline applies to logs. Cheaper to design in than to retrofit.

10. **Per-finding regression tests as policy.** The two High security findings regressed *because removing their guards broke no test.* Make "a fixed security finding ships with a test that fails if the guard is removed" a written convention (alongside the existing architecture-test suite). Item 3 generalizes this for the authz class; extend the habit to SSRF, content-validation, and rate-limit controls.

11. **Supabase JWT signing-keys migration** (prerequisite for item 6, but worth on its own). Moving from the legacy shared HS256 secret to asymmetric signing keys enables local JWT verification everywhere (faster auth), key rotation without downtime, and is the modern Supabase default.

12. **Secrets & config posture review.** Confirm in Vercel that `CSP_ENFORCE`, `CRON_SECRET`, `CHROMIUM_MIN_PACK_URL`, `OPS_ALERT_EMAIL` (ops alerts silently no-op when unset), the dedicated report token secret, and Upstash creds are all set in production. A short "required production env" checklist in the repo (validated at boot via a zod env schema) would catch the "control silently disabled because an env var wasn't set" class of issue — which is exactly what 4a and the ops-alert gap are.

---

## Suggested ticket breakdown

| Ticket | Items | Phase | Effort |
| --- | --- | --- | --- |
| `sec: restore email-template authz + regression test` | 1 | 0 | S |
| `sec: gate report-PDF actions (IDOR) + test` | 2 | 0 | M |
| `test: harden admin-actions-authz (roots, gate heuristic, reads)` | 3 | 0→1 | M |
| `chore(deps): npm audit fix` | 10 | 0 | S |
| `sec: enforce CSP + restore brand-asset byte validation` | 4 | 1 | M |
| `obs: onRequestError→reportError + sweep silent catches + lint` | 5 | 1 | M |
| `test: scoring orchestrator + RLS response-table probes + bulk-import` | 9 | 1 | L |
| `perf: local JWT verification in proxy` | 6 | 2 | M |
| `perf: parallelize report narratives + hoist config` | 7 | 2 | M |
| `db: consolidate RLS policies + initplan + FK indexes (3 migrations)` | 8 | 2 | L |
| `roadmap: durable queue / Sentry / email ledger / AI traceability` | "Things to add" | 3 | L+ |

Lower-severity findings (S5–S6, P4–P12, A5–A12, T5–T12) fold into the nearest phase or a periodic-hardening ticket as capacity allows.
