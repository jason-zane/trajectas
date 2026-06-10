# Full Site Audit — Security · Performance · Auditability · Testing

**Date:** 2026-06-10
**Scope:** entire repo @ `claude/focused-rubin-eu3wwc` (static analysis), plus live Supabase advisors (project `rwpfwfcaxoevnvtkdmkx`), `npm audit`, and local runs of the unit/component/architecture suites + typecheck. No code was modified; no remote database was written to.

---

## Executive summary

| Domain | Verdict |
| --- | --- |
| **Security** | Strong foundations (tenancy model, hardened assess RPCs, SSRF guards, sanitization) — but **two previously-fixed findings have regressed**, one of them a cross-tenant report-PDF IDOR. |
| **Performance** | Solid fundamentals (RLS initplan pass done, FK-index pass done, memoized auth, persisted artifacts) — remaining hotspots are double auth roundtrips per request, serial LLM calls in report generation, and a few unbounded queries. Live DB shows one systemic RLS-policy fan-out pattern (225 advisor warnings). |
| **Auditability** | Unusually strong application audit trail (~160 actor-attributed events, append-only `audit_events`) — but error capture is opt-in and unhandled server errors effectively vanish (`/tmp` log on Vercel). No email delivery ledger. |
| **Testing** | All green (719 vitest cases, typecheck clean, zero skip debt) with excellent psychometric-core and invariant coverage — but the write path is thin: ~440 Server Actions with ~8 files tested, the live scoring orchestrator and the 1,967-line bulk import are untested, and only ~12 of ~95 RLS tables have RLS tests. |

### Fix-first list (ranked)

1. **[Security/High]** Restore authz on the email-template Server Actions (`src/app/actions/email-templates.ts`) — regression of prior finding F-003.
2. **[Security/High]** Gate the report-PDF Server Actions (`src/app/actions/reports.ts:82,108`) with `requireReportSnapshotAccess` — cross-tenant report exfiltration via IDOR.
3. **[Systemic]** Harden `tests/architecture/admin-actions-authz.test.ts` — it currently exempts admin-client **reads** and accepts weak patterns as gates, which is exactly how items 1 and 2 slipped through.
4. **[Security/Medium]** Confirm `CSP_ENFORCE=1` in production (CSP is Report-Only by default, `src/proxy.ts:178`); re-wire the brand-asset magic-byte validator (F-002 regression, `src/app/api/brand-assets/upload/route.ts:83`).
5. **[Auditability/High]** Wire `onRequestError` → `reportError()` (`src/instrumentation.ts:16-27` currently appends to `/tmp` and swallows failures); sweep silent catches in actions through `logActionError`.
6. **[Performance/High]** Eliminate the proxy's remote `getUser()` (use local JWT verification via `getClaims()`) — saves an Auth-API roundtrip on every authenticated request (`src/proxy.ts:351` + `src/lib/auth/actor.ts:55`).
7. **[Performance/High]** Parallelize report-narrative LLM calls and hoist prompt/model config out of the per-entity loop (`src/lib/reports/runner.ts:666-692`, `src/lib/reports/ai-narrative.ts:30-33`).
8. **[Performance/DB]** One consolidation migration merging the `*_all_platform_admin` catch-all RLS policies into the per-action policies on the top 5 hot tables (`assessments`, `profiles`, `diagnostic_sessions`, `diagnostic_respondents`, `clients`) — removes ~87 of 225 live advisor warnings; also fix the one remaining `auth_rls_initplan` (`generation_presets_admin_all`) and add the 8 missing FK indexes.
9. **[Testing/High]** Add tests for `scoreSessionCTT` (`src/lib/scoring/ctt-session.ts`), cross-tenant RLS probes for the `candidate_*` / response-data family, and parse/validate tests for `src/app/actions/bulk-import.ts`.
10. **[Deps]** `npm audit fix` — one moderate prod vuln (`ws` &lt; 8.20.1, uninitialized memory disclosure) + one moderate dev-only (`brace-expansion`).

---

## 1. Security

**Posture: strong foundations with regressions.** No committed secrets, no password APIs (passwordless invariant enforced by architecture test), no service-key exposure to the client.

### Strengths (verified)

- **Coherent central tenancy model** — `src/lib/auth/authorization.ts` resolves a cached `AuthorizedScope`; `require*Access` helpers re-fetch the row and check membership; API routes consistently map auth errors to 401/403.
- **Hardened SECURITY DEFINER RPCs for the anonymous assess flow** — `save_responses_batch_for_session` et al. validate the token↔session↔item chain, pin `search_path`, and are REVOKEd from PUBLIC/anon/authenticated (`supabase/migrations/20260519210000_save_responses_batch_rpc.sql:86`).
- **Report rich-text sanitized before every `dangerouslySetInnerHTML`** — `sanitizeBlockData` allowlist in `src/components/reports/report-renderer.tsx:141`; assessment-intro interpolates *then* sanitizes (correct order).
- **Webhook SSRF guard intact** (`src/lib/integrations/url-security.ts:131`): blocks creds, localhost, private IPv4/IPv6, metadata hosts, non-HTTPS in prod; re-validated at dispatch.
- **Integrations API authn** uses HMAC-hashed keys with `crypto.timingSafeEqual`, scope/expiry/revocation checks, feature-flag gate, idempotency keys (`src/lib/integrations/auth.ts`).
- **Baseline hygiene:** always-on HSTS/X-Frame-Options-DENY/nosniff/Permissions-Policy (`src/lib/next-config/security.ts`); per-API-mutation Origin/Fetch-Metadata enforcement (`src/proxy.ts:328`); body-size caps on all API routes; cron behind `Bearer ${CRON_SECRET}`; token secret fail-closed in production (`src/lib/reports/token-secrets.ts:13` — prior open finding now RESOLVED).

### Findings

| # | Sev | Finding |
| --- | --- | --- |
| S1 | **High** | **Email-template actions lost their authz gate (F-003 regression).** `src/app/actions/email-templates.ts:16,39,68` — upsert checks only `actor?.isActive`; reads check nothing. Any active user in any tenant can overwrite platform-wide magic-link/welcome/report-ready templates (stored phishing vector) and read other tenants' templates. Each `'use server'` export is an independently invocable endpoint. Fix: restore per-scope gates (`assertAdminOnly` / `canManagePartner` / `canManageClient`). |
| S2 | **High** | **Report-PDF actions IDOR.** `src/app/actions/reports.ts:108` `downloadSnapshotPdfBase64(snapshotId)` returns the full PDF (RLS-bypassing) with only a UUID-format check; `:82` `getSignedReportPdfUrl(storagePath)` signs any path in the `reports` bucket with no validation (paths are predictable `reports/<snapshotId>.pdf`). Fix: wrap both in `requireReportSnapshotAccess`, or move them out of the `'use server'` module. |
| S3 | Medium | **CSP is Report-Only unless `CSP_ENFORCE=1`** (`src/proxy.ts:178`). The nonce + `strict-dynamic` policy enforces nothing unless the env flag is set; verify production env or flip the default. |
| S4 | Medium | **Brand-asset upload trusts client `file.type` (F-002 regression).** `src/app/api/brand-assets/upload/route.ts:83` no longer imports the magic-byte validator at `src/lib/brand-assets/file-validation.ts`. Impact bounded (stored contentType forced to image), but the documented control silently reverted. |
| S5 | Low | **Rate limiter fails open** to per-process memory on Upstash error/missing config (`src/lib/security/rate-limit.ts:270`); cost-heavy AI/PDF routes are not fail-closed. |
| S6 | Low | **SSRF guard is string-based** — no resolved-IP check; DNS-rebinding residual risk (acknowledged in prior audit, unchanged). |

**Minor:** OTP/login rate limit keyed on IP only (no per-email throttle; Supabase server-side limits are the backstop). `sec-fetch-site: none` treated as same-site for mutations (`src/lib/security/request-origin.ts:50`). Wide `USING (true)` SELECT policies on shared psychometric library tables — appears intentional; confirm none carry tenant-private content.

### Live Supabase security advisors

- 9 `SECURITY DEFINER` helper functions (`auth_user_client_id`, `auth_user_client_ids`, `auth_user_client_admin_ids`, `auth_user_partner_id/_ids/_admin_ids`, `auth_user_role`, `is_partner_admin`, `is_platform_admin`) are **RPC-callable by `authenticated`** via `/rest/v1/rpc/...`. They return the caller's own scope so impact is low, but the repo's own convention (`20260512150000_trajectory_revoke_trigger_fn_exec.sql`) is to revoke EXECUTE on DEFINER functions not meant for direct RPC. One revoke migration cleans this up.
- "Leaked password protection disabled" — **N/A** under the passwordless-only model (documented in AGENTS.md).

### Dependency audit

`npm audit`: **1 moderate production** (`ws` 8.0.0–8.20.0, uninitialized memory disclosure, GHSA-58qx-3vcg-4xpx) and 1 moderate dev-only (`brace-expansion`). Both fixed by `npm audit fix`. Nothing at the CI gate level (high+).

### Prior-audit cross-check (`security_best_practices_report.md`)

| Prior finding | Status |
| --- | --- |
| F-001 webhook SSRF guard | Holds (residual DNS-rebinding risk = S6) |
| F-002 brand-asset content validation | **REGRESSED** (S4) |
| F-003 email-template authz | **REGRESSED** (S1) |
| F-004/F-005 assess RPC hardening | Holds |
| F-006 body-size caps | Holds |
| Token-secret production fallback | **Resolved** (fail-closed) |
| Rate-limit Redis dependency | Open (S5) |

---

## 2. Performance

**Verdict: solid fundamentals; the remaining hotspots are auth roundtrips, serial LLM fan-out, and a handful of unbounded queries.**

### Strengths (verified)

- **The DB perf pass was actually done:** 76 RLS policies rewritten to `(select auth.uid())` initplan form (`20260508214600`), 38 FK indexes added (`20260508214500`), hot columns indexed (`campaign_participants.access_token`, `participant_responses.session_id`, `report_snapshots.status`).
- **Request-scoped memoization everywhere it counts:** `resolveAuthorizedScope`, `resolveSessionActor`, `getWorkspaceBootstrap`, `validateAccessToken`, `getCampaignHeader` are `React.cache()`-wrapped; pages batch with `Promise.all`.
- **Expensive results computed once and persisted:** report blocks → `report_snapshots.rendered_data`; PDFs → storage; scores → `participant_scores`; brand/experience config via `unstable_cache` (300s + tags).
- **Background offloading via `after()`** for report processing and PDF generation; audit logging never blocks downloads.
- **Assess runner engineered for resilience:** batched saves via one transactional RPC sized for `sendBeacon`, Dexie offline queue, parallel session-state fan-out.
- **Bundle discipline:** tiptap/maily dynamically imported; marketing page static with lazy islands; `next/font` + swap; 109 `loading.tsx` across 189 pages.

### Findings

| # | Impact | Finding |
| --- | --- | --- |
| P1 | **High** | **Two remote auth verifications per authenticated request** — proxy `getUser()` (`src/proxy.ts:351`) + render-side `getUser()` (`src/lib/auth/actor.ts:55`); `React.cache()` doesn't span proxy→render. Fix: local JWT verification (`getClaims()`/JWKS) in the proxy, keep the single remote check in `resolveSessionActor`. Est. 50–150ms TTFB on every authenticated navigation/action. |
| P2 | **High** | **Report generation: serial per-entity LLM calls + per-entity config refetch** (`src/lib/reports/runner.ts:666-692`; `ai-narrative.ts:30-33`; `prompt-config.ts:22` / `model-config.ts:27` uncached). 20–30 entities ⇒ 20–30 serial LLM calls + 40–60 DB lookups; risks the 300s cap shared by `after()`. Fix: hoist config once per run; bounded-concurrency `Promise.all`. |
| P3 | Medium | **AI item generation runs inside a held-open HTTP request** (`/api/generation/start`, `maxDuration=300`, awaited pipeline; serial construct loop in `pipeline.ts:142,159`). Crash/timeout strands runs in `running` with no resume. Move to `after()` + polling (pattern exists for reports) or per-construct re-enqueue. |
| P4 | Medium | **N+1 RPC in partner entitlements** — `get_partner_assessment_quota_usage` called serially per assignment (`src/app/actions/partner-entitlements.ts:56-63`). |
| P5 | Medium | **Campaign overview fetches every participant row to render 4 counts** (`src/lib/dal/campaigns.ts:250-258`, unbounded `select('*')` + nested sessions); PostgREST's 1000-row default will silently truncate counts on large campaigns. Use `head:true, count:'exact'` aggregates (pattern already at `dal/campaigns.ts:213-217`). |
| P6 | Medium | **Items library ships the whole item bank to a client table** — unbounded `select('*', constructs, response_formats)` (`src/app/actions/items.ts:21-44`) into `ItemList`; same truncation risk + heavy RSC payload. |
| P7 | Medium | **Chromium pack downloaded from GitHub at cold start** when `CHROMIUM_MIN_PACK_URL` unset (`src/lib/reports/pdf-browser.ts:57-64`) — tens of seconds on cold PDF requests; availability coupled to GitHub. Host the pack in same-region storage; consider `functions` memory config in `vercel.json`. |
| P8 | Low | Proxy serializes rate-limit Redis call before auth check (`src/proxy.ts:315→351`) — run concurrently. |
| P9 | Low | Observer-variant commit: one `UPDATE items` per variant, serial (`src/app/actions/observer-variants.ts:168-178`). |
| P10 | Low | Comparison authz fan-out: 2 queries per participant (`src/app/actions/comparison.ts:49,317`) — batch-fetch and authorize per distinct campaign. |
| P11 | Low | Assess runtime access not `cache()`-wrapped (`src/lib/auth/participant-runtime.ts:24-71`) + duplicate session fetch (`actions/assess.ts:394-398`) — 3–4 redundant roundtrips per runner page. |
| P12 | Low | Unbounded dashboard list queries (`actions/clients.ts:83-100`, `dal/campaigns.ts:68-80`); fine at current scale, no growth guard. |

**Minor:** `pdfkit` and `pdf-lib` are unreferenced dependencies (PDF path is puppeteer-based) — removable. 18 raw `<img>` usages are tenant logos/report covers (deliberate). `vercel.json` pins `sin1` — confirm Supabase co-location (project is `ap-southeast-1`, so yes, co-located).

### Live Supabase performance advisors (333 lints)

- **`multiple_permissive_policies` — 225 WARNs across 44 tables (68% of all lints).** One systemic pattern: a `*_all_platform_admin` catch-all policy coexists with per-role policies, so every query evaluates 2–5 policy expressions. Worst: `assessments` (3–4 policies/action), `profiles` (5 on SELECT), `diagnostic_sessions`/`diagnostic_respondents` (20 entries each), `clients` (4 on SELECT). Mitigating factor: hot paths mostly use the service-role client (106 files) which bypasses RLS; the 28 user-scoped query files still pay it. Consolidating the top 5 tables removes ~87 warnings. Also: most policies are `TO public`, so they're evaluated even for `anon`/`authenticator`/`dashboard_user` — scoping to `authenticated` cuts fan-out further.
- **`unused_index` — 99 INFOs** (e.g. 4 on `assessments`, 4 on `org_diagnostic_campaigns`, 4 on `matching_runs`). Don't drop blindly — some guard new features and stats may be young — but a periodic review is warranted; each unused index taxes writes.
- **`unindexed_foreign_keys` — 8 INFOs**, all on newer tables: `campaign_360_snapshots.generated_by`, `campaign_raters.approved_by/nominated_by`, `error_events.actor_profile_id`, `factors.reviewed_by`, `generation_presets.created_by/response_format_id`, `person_link_audit.performed_by`. Cheap one-migration fix.
- **`auth_rls_initplan` — 1 WARN**: `generation_presets_admin_all` calls `auth.*()` bare (the phase-4 pass missed this newer table).

---

## 3. Auditability & observability

**Verdict: unusually strong application-level audit trail; error/delivery observability is the weak half.**

### Strengths (verified)

- **Canonical append-only `audit_events`** with actor, tenant scoping, support-session attribution (`00038_surface_security_foundation.sql:64-91`; tenant-scoped SELECT policy in `00070`); single write helper `logAuditEvent`; admin UI at `/settings/audit`; a duplicate audit table was deliberately consolidated away (`20260521180000`).
- **~160 actor-attributed event types** across Server Actions, covering destructive/admin ops: campaign delete/restore/close, participant remove/restore (soft delete), role changes with previous/new values, force sign-out, report viewed/downloaded/sent.
- **Forensic account-deletion design:** `account_deletion_audit` row written *before* `auth.admin.deleteUser` so evidence survives the cascade; sweep failures raise ops alerts.
- **AI item generation is reproducible:** `generation_runs` stores config, model, prompt version, token usage + full `ai_snapshot` of prompts; per-step `generation_run_logs`; accepted items link back via `saved_item_id`.
- **Self-hosted `error_events` store** with fingerprinting + optional ops email (`src/lib/observability/report-error.ts`), observability dashboard, and a clean DB-liveness `/api/health` probe.
- **Integrations API is the internal gold standard:** request IDs on every response, audit events carry `requestId`, outbound webhook delivery/attempts outbox.

### Findings

| # | Sev | Finding |
| --- | --- | --- |
| A1 | **High** | **Unhandled server errors go to `/tmp/trajectas-errors.log`** (`src/instrumentation.ts:16-27`, swallows its own failures) — effectively nowhere on Vercel. No Sentry/OTel. `onRequestError` never calls the existing `reportError()` even though the seam is documented (`report-error.ts:100-102`). RSC/action crashes leave operators blind. |
| A2 | **High** | **Error capture is opt-in and most failure paths don't opt in** (~34 files use `reportError`/`logActionError`). Silent catches: `actions/architect.ts:224-226`, `actions/factors.ts:174-176`, mid-stream provider errors in `/api/chat/route.ts:113-127`. An expired AI key fails user-visibly with zero server trace. |
| A3 | Medium | **No durable email-send record.** Resend message id discarded (`src/lib/email/provider.ts:33-63`); no Resend bounce/delivery webhook endpoint exists; `campaign.participant.invited` is logged *before* the send attempt (`campaigns.ts:1100-1110`), so "invited" ≠ "delivered". Add an `email_sends` ledger + webhooks. |
| A4 | Medium | **AI invocations outside item generation are untraceable.** Narrative enhancement silently falls back while the snapshot still claims `narrative_mode='ai_enhanced'` (`src/lib/reports/ai-narrative.ts:55`); `report_snapshots` records no model/prompt/tokens; `/api/chat` records nothing. A challenged AI-generated report wording cannot be reconstructed. |
| A5 | Medium | **Entitlement/quota changes unaudited** (`client-entitlements.ts:681-799`, `partner-entitlements.ts:119-242` — no `logAuditEvent`). A lowered quota that breaks invites has no who/when/previous-value record. |
| A6 | Medium | **Cron failure visibility inconsistent:** `assessment-resume-reminders` console-logs only (`route.ts:32-39`; per-session failures in `resume-reminders.ts:210,256`), unlike the alerting account-deletion sweep. |
| A7 | Medium | **Zero client-side error reporting** — `instrumentation-client.ts` only initialises BotID; error boundaries `console.error` in the user's browser; CSP-report endpoint console-logs only. |
| A8 | Low | **Append-only by convention, not enforcement** — no `REVOKE UPDATE/DELETE`/block-triggers on `audit_events`, `error_events`, `account_deletion_audit`; `org_diagnostic_profiles` ("Immutable") has a platform-admin `FOR ALL` policy. |
| A9 | Low | `logAuditEvent` throws on insert failure and call sites don't wrap it — a transient audit failure after a successful mutation surfaces as a user-facing error AND leaves the mutation unaudited. |
| A10 | Low | `error_events.request_id` never populated; no request id minted in the proxy — cross-referencing errors↔audit events is guesswork. |
| A11 | Low | Email template edits unversioned + unaudited (compounds S1). |
| A12 | Low | PII (recipient emails) in console logs (`provider.ts:57-59`; auth send-email hook) — adopt id-based redaction. |

**Anonymity check:** `org_diagnostic_respondents` is deny-by-default with a single platform-admin policy and is referenced by **no application code yet** — no leak path today. Forward-looking: codify in the feature spec that audit/error metadata must never combine respondent identity with response data.

---

## 4. Testing

**Verdict: disciplined and all-green; thin on the write path.**

### Inventory & CI

| Suite | Files / cases | Covers |
| --- | --- | --- |
| `tests/unit` | 73 / 653 | Scoring engine (IRT/CTT/pipeline/transforms), AI prompt builders + guards, comparison, email render/send, report tokens/runner, auth helpers, security utils, proxy routing, DAL mappers |
| `tests/integration` | 23 / 128 | RLS (tenant-isolation, org-diagnostic, trajectory-person-key), DAL families, server-action flows, API auth — local Supabase only, `describe.skipIf` guarded |
| `tests/components` | 15 / 54 | RTL: tables, assess Likert/save-queue, report renderer, charts, hooks |
| `tests/architecture` | 6 / 12 | Invariants (see below) |
| `tests/e2e` | smoke 3 specs (~10) + seeded 1 spec (7) | Marketing/fallback on PRs; admin + participant runtime weekly |

**CI (`.github/workflows/ci.yml`):** `security` (npm audit prod-high + gitleaks) → `quality` (lint, typecheck, coverage suites, build) ∥ `integration` (**ephemeral local Supabase per PR** — RLS/DAL get real DB signal) → `e2e-smoke`. Seeded e2e runs weekly cron only. Coverage thresholds (80/80/80/70) are enforced **per-file but only over a 17-file allowlist** (`vitest.config.ts:29-49`). Note: AGENTS.md still says "three jobs" — stale vs the 4-job ci.yml.

**Suite runs (this audit):** unit 653/653 ✅ 25.5s · architecture 12/12 ✅ · components 54/54 ✅ · `typecheck` clean ✅. Zero `.skip`/`.todo` debt.

### Architecture tests (the security backstop)

`passwordless-only`, `admin-actions-authz` (2-entry vetted allowlist), `no-db-in-components`, `login-bundle-purity` (born from 4 real prod incidents), `integration-host-guard` + `rls-fixture-guard` (defense-in-depth against prod writes, incl. lookalike-host tests). Genuinely good — but see T9.

### Findings / gaps

| # | Sev | Finding |
| --- | --- | --- |
| T1 | **High** | **Live session-scoring orchestrator untested** — `src/lib/scoring/ctt-session.ts` (265 lines, prod entry from `actions/assess.ts:22` and `three-sixty.ts:8`), `validity.ts`, `adaptive/` (620 lines) have zero tests. The math beneath is tested; the rows→scores assembly that writes `participant_scores` is not. |
| T2 | **High** | **RLS tests cover ~12 of ~95 RLS-enabled tables.** No cross-tenant probe for `candidate_sessions`/`candidate_responses`/`candidate_scores`, `report_snapshots`, `items`/`item_*` (assessment IP), `integration_credentials`, `user_invites`. A policy regression on response data would leak silently. |
| T3 | **High** | **Server Actions: ~58 files / ~440 actions, ~8 files tested.** Untested heavyweights: `assess.ts` (11), `campaigns.ts` (38), `reports.ts` (44), `clients.ts` (18), `generation.ts` (16). |
| T4 | **High** | **CSV/bulk import (1,967 lines) untested** (`src/app/actions/bulk-import.ts`) — classic silent-data-corruption surface. Extract parse/validate helpers; fixture-test malformed CSVs. |
| T5 | Medium | **Auth flow half-tested:** `proxy.test.ts` mocks `getUser → null` throughout (authenticated branches — session-activity expiry, role redirects — uncovered); `actions/auth.ts` (368 lines, OTP request/verify) untested. |
| T6 | Medium | **Seeded e2e weekly only** — participant-runtime breakage can merge and sit ~a week. Run on PRs touching `src/app/assess/**` or nightly. |
| T7 | Medium | **PDF render path untested** (`pdf.ts`, `pdf-browser.ts`, the two PDF routes) — at minimum integration-test route auth/token validation. |
| T8 | Medium | **AI provider/orchestration untested** — `providers/*` (incl. `openrouter-retry.ts` backoff), `generation/pipeline.ts`, `matching/engine.ts`. `pipeline-mock.ts` already exists; use it. |
| T9 | Medium | **`admin-actions-authz` scope holes:** scans only `src/app/actions/` (misses inline `"use server"` in `components/comparison/comparison-workspace.tsx` and `(marketing)/actions/submit-contact.ts`); accepts a bare `token: string` param as a gate (line 37); deliberately exempts admin-client **reads** (line 103) — which is how S1/S2 escaped. Extend roots; tighten heuristics; consider enforcing sensitive reads. |
| T10 | Low | DAL stragglers untested: `dal/workspace.ts`, `dal/audit.ts`. |
| T11 | Low | Real-timer sleeps in `use-save-queue.test.ts` (50–200ms) — convert to fake timers. |
| T12 | Low | Coverage allowlist drift: well-tested modules (trajectory rollup, comparison, email, report runner) aren't pinned, so coverage can erode silently; AGENTS.md CI description stale. |

---

## Cross-cutting observations

1. **The two High security findings are regressions, and the architecture test designed to catch them has the exact blind spots they sit in** (reads exempted; weak gate heuristics). Fixing T9 is the systemic fix; S1/S2 are the immediate patches. Consider also a small regression test pinning each restored gate.
2. **The platform has two "gold standard" subsystems worth copying from** — the integrations API (request ids, audit correlation, outbox) and the item-generation pipeline (full reproducibility). The gaps (A3, A4, A10) are mostly "the rest of the app doesn't do what those two already do."
3. **DB hygiene debt is mechanical, not architectural:** one policy-consolidation migration, one FK-index migration, one initplan fix, one DEFINER-revoke migration. All low-risk, advisor-verifiable afterwards.
4. **`.env.local` → production remains the sharpest local footgun**; the fixture-level fail-closed guard is excellent. Keep new integration tests on the documented host-guard pattern.
