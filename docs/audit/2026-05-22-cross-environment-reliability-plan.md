# Cross-Environment Reliability Plan

**Author:** investigation conducted 2026-05-22
**Status:** REVISED v2 — incorporates external review (round 2) on 2026-05-22
**Scope:** make Trajectas work reliably for users on any reasonable browser, network, and device, with the immediate trigger being a user-reported incident on a corporate-managed work laptop where (a) the marketing page rendered incorrectly and (b) the login Verify button could not be clicked after entering the OTP code

---

## Reading guide

This document has five parts, plus appendices:

1. **What happened and how the investigation evolved** — narrative, including what was initially assumed, what was found to be wrong, and what the eventual diagnosis was. The "Post-review revisions" subsection at the end of Part 1 covers the round-2 corrections.
2. **Findings** — every concrete issue uncovered, with file:line citations, confidence rating, and evidence.
3. **External research** — what published sources say about each class of issue, used to calibrate confidence.
4. **Solutions** — what to do for each finding.
5. **Implementation plan** — PR-level sequencing, risks, rollback, definition of done.

**Substantive changes from v1** (driven by the external review):
- F4 (CSP) reframed from "Next.js upstream bug, unfixable" to "missing middleware line, likely tractable via documented Next.js 16 pattern"
- F3 (fetch timeouts) split into interactive vs. long-running endpoints — the blanket-timeout approach in v1 would have broken generation/chat
- F5 (URL fallbacks / Server Action origins) expanded to cover the current direct env-read and localhost-fallback inventory in `src/`
- OTP Server Action solution corrected to use server-side `redirect()`, not a client-side `useEffect` redirect (closes a progressive-enhancement gap)
- Browserslist floor aligned to Next 16's documented baseline (Safari 16.4+ not iOS 15.4+)
- Integration test approach shifted from Vitest to Playwright e2e (Server Action cookies don't test cleanly in plain Vitest)
- Implementation sequence restructured: CSP spike first (PR 0), then OTP+short-timeout (PR 1), then a dedicated long-running-endpoint PR (PR 2), then URL centralisation, then CSS

The marketing site is intentionally NOT in the fix plan — the user has decided to do a full redesign of that surface separately, and we agreed to park it. Diagnosis of the marketing page is included in Part 1 because the investigation produced concrete findings about it that should inform the redesign.

---

## Part 1 — Investigation narrative

### The trigger

A user (Jason, founder) accessed the production site from a corporate-managed work laptop on multiple networks (home wifi, office wifi). Two symptoms:

- The marketing home page "didn't work correctly" — visually broken or with missing information.
- On the login page, after the OTP code was sent and entered, the "Verify" button could not be clicked.

The user explicitly framed the goal as: this is critical for launch — the platform must work in every environment.

### First-pass diagnosis (later partially revised)

The first round of investigation centred on hypotheses informed by:

- The user's environment being corporate-managed (locked browser version, possible Zscaler-class SSL inspection, possible browser extension interference).
- Knowledge that the marketing page uses heavy CSS (`color-mix()` with the `oklch` colour space, `mix-blend-mode: screen` on a canvas overlay, scroll-driven animations).
- Knowledge that the login form uses `@base-ui/react` controlled inputs and a JS-only `onClick` Verify path.

Initial hypothesis set:

1. **Login Verify "stays disabled":** the `<Input value={code} onChange={...}>` controlled input from `@base-ui/react` doesn't capture browser/password-manager autofill because autofill commonly bypasses React's synthetic `onChange`. With `code.length < 6` driving `disabled`, the button never enables even when the code is visibly populated.
2. **Marketing page breakage:** modern CSS features (`color-mix(in oklch)`, `mix-blend-mode`, `field-sizing`) without `@supports` fallbacks fail silently on locked corporate browsers; or hydration mismatch in `MarketingInteractive`'s `useSyncExternalStore`; or CSP / corporate browser extensions interfering with hydration.
3. **Corporate SSL inspection (Zscaler-class)** breaking the browser→Supabase fetch that the JS verify path depends on, with no server-side fallback.

These hypotheses were plausible but speculative. The first plan that came out of them was a long list of fixes for *categories* of risk, not for specific verified causes.

### What changed: external review (round 1) and direct production probing

An external reviewer pushed back on the marketing severity claim and several other points. They were correct on every one:

- Marketing's static state in the CSS *did* exist and render text — the bug wasn't "no static fallback," it was something else.
- `field-sizing: content` is a polish concern, not a "broken entire app" concern — textareas fall back to a static height.
- Most `color-mix()` usages are decorative shadows, not legibility-critical.
- "Use relative URLs from server actions" was wrong as a blanket fix; the right pattern is a validated absolute-URL helper.
- The OTP fix needs to go further than "remove the disabled gate" — it needs to be a real Server Action so the verify step doesn't depend on the browser reaching Supabase at all.

After the review, the investigation actually loaded the production site in Playwright (Chrome 148) to ground-truth the marketing claim. This was a turning point. The browser-compatibility theories collapsed:

- `CSS.supports('color: color-mix(in oklch, red, blue)')` → true
- `CSS.supports('selector(:has(*))')` → true
- `CSS.supports('field-sizing: content')` → true
- `CSS.supports('height: 100svh')` → true

The page was on a fully-modern Chrome, the supposed CSS gaps were not gaps, yet **the production page still had massive empty regions on first paint**. Inspecting the rendered DOM:

- Problem section: only the "Legacy" half visible; "Trajectas Difference" half at `opacity: 0` until scroll-progress drives it up.
- Journey section: all four stages at `opacity: 0`, transformed offset 30px until scroll-progress reveals them one by one. Section height was 2,681px on a 766px viewport.

This was not browser incompatibility. The dynamic motion design itself gates primary content visibility on scroll progress, and the section heights are so tall that without scrolling significantly into them, the content never appears.

Re-running the same DOM with `data-motion` removed showed every section rendering with all content visible. The static fallback was actually the better-rendering version. When this was presented, the user decided to do a full marketing redesign separately. Marketing is therefore out of scope for this plan.

### What changed: the CSP discovery (and its post-review reframing)

While researching the script-blocking theory, a `curl` against the live HTML revealed something I had not checked before: the production `<script>` tags **have no `nonce=` attribute**, despite the CSP response header carrying `script-src 'self' 'nonce-XXX' 'strict-dynamic'`.

In v1 of this plan, I framed this as a Next.js bug to be worked around. The external reviewer (round 2, below) corrected me: this codebase is on **Next 16.2.3** (verified in `package.json`), and `src/proxy.ts:205-210` only sets `x-nonce` on forwarded request headers — it does NOT set the `Content-Security-Policy` header itself on the forwarded request. Per the official [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy), Next reads the CSP from the request headers (`content-security-policy` or `content-security-policy-report-only`) during SSR in order to attach the nonce to script tags. Without the CSP header on the request, Next has nothing to attach the nonce to.

This is **our implementation gap, not an upstream bug**. It is likely fixable in our middleware with the documented pattern. The remaining question is whether static pages (which don't run through SSR per request) can receive nonces at all without being forced to dynamic rendering — that requires a spike to verify.

### Post-review revisions (round 2)

A second external review of this document caught six blocking issues, all of which I've adopted:

1. **CSP reframed.** Not an upstream Next.js bug. Likely an implementation gap (missing CSP request-header forwarding). Worth a spike before committing to either "accept report-only forever" or "build hash-based CSP."
2. **Fetch timeouts cannot be blanket.** Three endpoints in this codebase have `maxDuration = 300` (5 minutes): `/api/generation/start`, `/api/generation/readiness`, `/api/chat`. The chat endpoint streams via OpenRouter. A 20-30s `AbortSignal.timeout()` on these would kill every long generation and every chat stream. The fix differentiates by call category, not by site.
3. **OTP Server Action progressive enhancement gap.** v1's plan was to return `{ redirectTo }` from the action and let the client redirect in `useEffect`. That requires JS. The action should call `redirect()` server-side for success. Returning state is fine for the error path.
4. **URL audit incomplete.** v1 listed four sites; a full `rg` pass found additional auth, report, campaign, deletion, SEO, and invite URL builders. The same env set also feeds `serverActions.allowedOrigins`, so the fix needs to be a centralised URL policy plus build/startup assertions, not a narrow patch.
5. **Browser support floor mismatch.** v1 proposed iOS 15.4+; Next 16 documents Safari 16.4+ as its baseline. Aligning is required; if we want to keep older Safari, we need explicit fallbacks for what Next dropped.
6. **Integration test approach.** v1 proposed Vitest; Server Action cookie semantics don't test cleanly in plain Vitest because they require a real Next request/response cycle. Test plan shifts to Playwright e2e against the local Supabase stack, with the host-whitelist guard per `AGENTS.md`.

Smaller adjustments also adopted:
- Clipboard fallback uses a dialog with a selectable input, not a toast that includes the full URL/token.
- `randomId()` helper documented as "not cryptographically secure; UI use only."
- "Corporate browsers ignore report-only" claim downgraded — no concrete source, reframed as "EDR-injected scripts can fail under CSP and produce broken-hydration symptoms; no direct evidence this caused the user's incident."
- DMARC adoption recommended as gradual rollout (`p=none` → `p=quarantine` → `p=reject`), not immediate `p=reject`.
- BrowserStack profile made concrete as a Windows/browser baseline, not a corporate-proxy substitute. A real managed laptop or explicitly configured proxy profile is still required before claiming corporate-environment coverage.
- Sentry/PostHog declination made more explicit: confidence ceiling is capped without client-side observability, and the next non-obvious incident should re-open this decision.

### Confidence calibration

Throughout the investigation, I have distinguished between:

- **Things I observed directly** in the codebase or in Playwright (high confidence)
- **Things I read in external sources** that match the symptoms (medium confidence)
- **Things I am inferring from the user's verbal description** of the incident (low confidence)

The honest answer to "are you 100% sure this is the bulletproof fix" is no. What this plan delivers is: every known, documented failure mode is closed, and the fixes are tied to verifiable sources. The residual risk is that there's an Nth cause I haven't identified, which can only be reduced by operational telemetry that the user has explicitly declined.

---

## Part 2 — Findings

Each finding has: file:line citation, severity, confidence, evidence type.

### CRITICAL

#### F1. OTP "Verify" button stays disabled on autofill — login form

- **Location:** `src/app/login/login-form.tsx:100-122`
- **Severity:** Critical (blocks sign-in)
- **Confidence:** 90% that this matches the user's symptom; 100% that it's a real bug
- **Pattern:** `<Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoComplete="one-time-code" />` paired with `<Button disabled={code.length < 6 || verifying} onClick={handleVerify}>`
- **Mechanism:** Browser-level autofill (OS one-time-code passthrough, password managers like 1Password Business pushed by corporate IT) sets `input.value` via the property setter directly, which does not always fire React's synthetic `onChange` for wrapper components. The visible code appears in the input but React state stays empty, so `disabled` remains true.
- **Evidence:** Confirmed against [facebook/react #2125](https://github.com/facebook/react/issues/2125), [1Password community thread](https://www.1password.community/discussions/1password/react-re-rendering-causing-autocomplete-suggestion-issue/116882), [react-hook-form discussion #1882](https://github.com/orgs/react-hook-form/discussions/1882). All document the same controlled-input + autofill bypass behaviour going back years.
- **Why the existing pattern was chosen (charitable read):** The send-code half uses a Server Action correctly. The verify half went client-only because `supabase.auth.verifyOtp()` is conventionally called from the browser to set the session cookie via the supabase-js client. There is a server-side equivalent (`@supabase/ssr` server client), which is the right path to convert to.

#### F2. OTP "Verify" button stays disabled on autofill — invite accept form

- **Location:** `src/app/auth/accept/accept-invite-form.tsx:101-121`
- **Severity:** Critical (blocks new-user onboarding — invited clients/partners cannot accept)
- **Confidence:** Same as F1
- **Mechanism:** Byte-for-byte identical to F1. Same fix applies.
- **User-impact angle that makes this worse than F1:** an existing user blocked at login may find workarounds; a newly invited user has no existing relationship with the product — they will silently bounce.

#### F3a. Interactive client fetches hang indefinitely under network stalls

These calls should be short (sub-30s); have no `AbortController` or `AbortSignal.timeout()`; will hang on a stalled proxy or flaky network with no recovery UI:

- `src/components/brand-editor/logo-uploader.tsx:52` — brand-asset upload (~30s budget)
- `src/components/auth/session-activity-provider.tsx:84` — session keep-alive ping (~5s budget; fires on every debounced user interaction)
- `src/components/reports/report-pdf-button.tsx:85` — PDF status poll (~10s per poll)
- `src/components/reports/report-pdf-button.tsx:174` — PDF download (~60s budget; large file)
- `src/components/comparison/comparison-export-button.tsx:21` — comparison export (~30s budget)
- `src/components/reports/preview-pdf-button.tsx:23` — preview PDF (~60s budget)

**Severity:** High (visible "loading forever" UX on flaky / proxied networks)
**Confidence:** 100% (mechanical — no timeout = no recovery)
**Counter-example (positive case for the codebase):** `src/components/assess/use-save-queue.ts:47` does have a 15-second `AbortController` timeout. That pattern is the right model to generalise — but only for endpoints in this category, not the F3b set below.

#### F3b. Long-running and streaming endpoints — different pattern required

These endpoints are configured with `maxDuration = 300` (5 minutes) and intentionally do long work. A blanket `AbortSignal.timeout()` would be a regression:

- `src/app/api/generation/start/route.ts:14` — `maxDuration = 300`, awaits the generation pipeline. Called from `src/app/(dashboard)/generate/[runId]/page.tsx:286` and `src/app/(dashboard)/generate/new/page.tsx:485,1805`.
- `src/app/api/generation/readiness/route.ts:13` — `maxDuration = 300`, explicitly designed for 2-3 minute readiness checks.
- `src/app/api/chat/route.ts:16` — `maxDuration = 300`, streams via OpenRouter. Called from `src/app/(dashboard)/chat/chat-interface.tsx:63`.

**Severity:** Same fundamental risk as F3a (request can hang) but mitigation must be different.
**Confidence:** 100% — verified by reading each route's `maxDuration` declaration.
**Why this matters:** v1 of this plan would have applied a 20-30s timeout to these via the same helper. That would have killed every long generation and every chat stream. PR 2 treats them as a separate workstream.

#### F4. CSP nonces are not being applied to rendered script tags in production

- **Location:** Next.js middleware at `src/proxy.ts:205-210` (forwards `x-nonce` only; does not forward the `Content-Security-Policy` header on the request)
- **Severity:** High (sleeper) — today silent in report-only mode; under enforcement, the entire app would fail to load
- **Confidence:** 100% on the symptom (verified directly: `curl https://www.trajectas.com/ | grep nonce=` returns zero matches; CSP response header carries `script-src 'self' 'nonce-XXX' 'strict-dynamic'`; production console logs every script as a violation). High confidence on the cause (missing CSP request-header forwarding), but a spike is required to confirm and verify the fix on a real route.
- **Mechanism (per [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy)):** Middleware must set BOTH `x-nonce` AND `Content-Security-Policy` (or `Content-Security-Policy-Report-Only`) on the forwarded request headers. Next's SSR pass reads the CSP from the request to know what policy is active, and uses the matching nonce when emitting script tags. Setting only `x-nonce` (current behaviour) leaves Next with no policy context, so it emits unnoncing script tags.
- **Additional consideration:** Static (cached) pages do not run SSR per request and therefore do not get a fresh nonce per request. Routes that must enforce strict CSP either need to be dynamic, or use a different CSP strategy (hash-based) for static content. This is a real architectural constraint and is part of why the spike is necessary.
- **Version note:** This codebase is on Next 16.2.3 (`package.json`). v1 of this plan incorrectly cited Next 15 issues as the cause. They were related but not authoritative.
- **Why this matters beyond "report-only is fine":**
  - The comment at `proxy.ts:170` says "Flip `CSP_ENFORCE=1` once the violation log is clean." With the current middleware, that state is unachievable.
  - The current XSS posture relies on a nonce that never reaches the browser. The deployed security claim and reality diverge.
  - Whether the user's incident was caused by CSP-related script blocking on their corporate browser is unverified, but the broken middleware is a real issue independent of that.

### HIGH

#### F5. Hard-coded localhost / unguarded env reads / Server Action origin drift

Current inventory from `rg "localhost:3002|NEXT_PUBLIC_APP_URL|PUBLIC_APP_URL|ADMIN_APP_URL" src`:

**Auth and invite URL builders**

- `src/lib/auth/otp.ts:13-33` — `buildAuthRedirectUrl` can fall back to `"http://localhost:3002"`
- `src/app/actions/auth.ts:50-65,114-120` — request-origin and OTP redirect fallbacks
- `src/app/actions/admin-user-actions.ts:27-35,68-75` — admin-triggered OTP fallbacks
- `src/app/login/page.tsx:12-15,41` — public home/request URL fallback
- `src/app/auth/accept/page.tsx:7-10` — public home fallback
- `src/lib/auth/staff-auth.ts:676` — invite link fallback

**Assessment, campaign, report, deletion, SEO, and integration URL builders**

- `src/app/actions/campaigns.ts:1377` — `const assessBaseUrl = process.env.NEXT_PUBLIC_APP_URL`; becomes `undefined/assess/...` if unset
- `src/app/actions/reports.ts:1282,1309` — server-side fetch to `${process.env.NEXT_PUBLIC_APP_URL}/api/reports/generate` with no validation
- `src/app/actions/assess.ts:1465-1468` — report runner URL fallback
- `src/lib/reports/pdf.ts:47-52` and `src/lib/reports/preview-pdf.ts:4-9` — browser/PDF capture base URL fallback
- `src/app/actions/account-deletion.ts:128-133` — public app URL fallback
- `src/lib/campaign-access-links.ts:7-15` — access-link URL builder returns a relative path if no base exists
- `src/lib/seo/public-site.ts:4,19-25` — public metadata fallback to localhost
- `src/app/api/auth/send-email/route.ts:145` — welcome email login URL fallback to Supabase URL
- `src/lib/integrations/service.ts:29-42` — integration assessment URL fallback; this already throws if no base exists, but should still use the central policy for consistency

**Related Server Action risk**

- `src/lib/next-config/security.ts:49-61` derives `serverActions.allowedOrigins` from the same surface URL env vars. If a deploy omits `PARTNER_APP_URL`, `CLIENT_APP_URL`, `ASSESS_APP_URL`, etc., Server Actions from that surface can 403 before the action code runs. That matters more after PR 1 because OTP verify will also be a Server Action.

**Severity:** High (silent prod failure if env vars go missing on a deploy — auth redirect emails can point at localhost, campaign assess links can become `undefined/assess/...`, and Server Actions can 403 on entire surfaces)
**Confidence:** 100%
**Fix shape:** Central URL policy via `requireAppUrl(surface)` that throws in production when configuration is missing, plus both:

1. A build/CI assertion, because `serverActions.allowedOrigins` is computed from env during Next config evaluation.
2. A runtime startup assertion in `src/instrumentation.ts` via `export async function register()` so misconfigured runtime deployments fail fast.

The narrow patch approach in v1 was insufficient.

#### F6. Clipboard writes without rejection handling — false success toast

- **Locations:**
  - `src/app/(dashboard)/campaigns/[id]/settings/campaign-access-links.tsx:76`
  - `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx:301`
- **Severity:** High (silent data loss from the user's perspective — they think they copied a link, paste, nothing happens)
- **Confidence:** 100%
- **Two distinct failure modes:**
  1. `navigator.clipboard` is `undefined` in insecure contexts (any non-HTTPS, plus some corporate-locked browsers) → uncaught `TypeError`
  2. `clipboard.writeText()` returns a rejected promise (document not focused, etc.) → silently ignored when not `await`ed
- **Current code:** `navigator.clipboard.writeText(url); toast.success("Copied")` — no awaiting, no try/catch, no guard
- **Counter-example (positive case in same codebase):** `src/components/campaigns/copy-campaign-link-button.tsx:31-39` handles this correctly with a try/catch and `await`
- **Evidence:** [MDN Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText), [web.dev clipboard guide](https://web.dev/articles/async-clipboard)
- **Round-2 refinement:** The fallback UI should be a dialog with a selectable input (so the user can copy manually), not a toast that contains the full URL/token. While the leak is to the same logged-in user on the same page, a dialog is better UX and avoids exposure to over-the-shoulder viewing.

#### F7. `crypto.randomUUID()` called in browser without fallback

- **Locations:**
  - `src/app/(dashboard)/chat/chat-interface.tsx:46` — chat message ID
  - `src/app/(dashboard)/chat/chat-interface.tsx:52` — chat message ID
  - `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx:137` — block ID
- **Severity:** Medium-High (production is HTTPS, so works there; breaks on plain-HTTP internal previews, file:// loads, certain corporate-sandboxed contexts)
- **Confidence:** 100% (verified: [MDN Crypto.randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) says secure-context-only; in non-secure contexts `crypto.randomUUID` is `undefined`, throwing `TypeError` when called)
- **Counter-example (positive case):** `src/lib/assess/response-store.ts:158-164` has the fallback pattern — copy that.
- **Round-2 refinement:** The shared helper must be documented as "non-security UI ID generation only" so it doesn't accidentally get pulled into a security-sensitive path. The fallback (`Date.now() + Math.random()`) is uniqueness-sufficient but not cryptographically secure.

### MEDIUM

#### F8. `color-mix()` in participant-facing progress bar without `@supports` fallback

- **Location:** `src/components/assess/progress-bar.tsx:29`
- **Severity:** Medium (visual degradation during an assessment — the progress track loses its background colour on browsers without `color-mix` support)
- **Confidence:** 80% as a real-world concern; `color-mix` is at ~89% global support but locked corporate browsers can be pre-Chrome-111 / pre-Safari-16.2
- **Decision per external review:** only gate the participant-facing legibility case (this one and `src/components/assess/item-card.tsx:47`). Decorative shadows elsewhere degrade gracefully on declaration drop.

#### F9. `backdrop-filter` ungated in global stylesheet

- **Location:** `src/app/globals.css:438-439`
- **Severity:** Low-Medium (cosmetic — falls back to no blur; many other uses in the codebase already correctly use `supports-[backdrop-filter]:` Tailwind variant)
- **Confidence:** 100%

#### F10. No `browserslist` floor in `package.json`

- **Location:** `package.json` (no `browserslist` key)
- **Severity:** Medium (process risk — without a target, future code can introduce features that silently break locked browsers)
- **Confidence:** 100%
- **Round-2 refinement:** The floor must align with Next 16's documented modern-browser baseline (Safari 16.4+, not iOS 15.4+ as in v1). Older Safari support would require explicit polyfills/fallbacks for what Next dropped.

### LOW (acknowledged but not in fix plan)

#### F11. `field-sizing: content` unsupported in Firefox

- **Location:** `src/components/ui/textarea.tsx:10`
- **Severity:** Low (textareas lose auto-grow polish on Firefox but remain functional via `min-h-16`)
- **Decision:** acknowledge in plan, do not fix this round.

#### F12. Marketing scroll-reveal design hides content on first paint

- **Status:** Out of scope (full redesign decided separately)
- **Diagnosis preserved for the redesign team:** the issue is that `data-motion="on"` (which is always set on hydration) activates CSS that gates content visibility on `--scroll-progress`. The static CSS fallback in `globals-marketing.css` displays all content correctly. The redesign should either preserve the static-displays-everything default or be built without reveal-on-scroll-gating of primary content.

#### F13. `localStorage` usages with no graceful fallback

- **Locations:** `src/app/preview/experience/page.tsx:57`, `src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx:295,308`, `src/components/flow-editor/flow-editor.tsx:297`
- **Severity:** Low (all in preview/builder paths; none block primary user flows)
- **Decision:** wrap in try/catch when next touched, not a dedicated fix.

#### F14. Microsoft 365 Outlook OTP delivery delays (3-10 min in common cases)

- **Status:** Environmental — code can't fix this. Mitigation lives in DNS (SPF, DKIM, DMARC for the sending subdomain `mail.trajectas.com`) and Resend sender warm-up.
- **Round-2 refinement:** DMARC adoption should be gradual (`p=none` collecting reports for ~2 weeks → `p=quarantine` for ~2 weeks → `p=reject`), not immediate `p=reject`. Premature `p=reject` without SPF/DKIM alignment risks blocking legitimate auth mail.

#### F15. Microsoft Defender Safe Links pre-clicking OTP URLs

- **Status:** Already mitigated. The OTP email contains a code in the body, not a clickable magic link. `src/lib/auth/otp.ts:51` uses `generateLink` only to extract the `email_otp` from the response, then sends that code to the user via Resend. No URL for Safe Links to pre-click. Worth documenting that this was a deliberate (or fortunate) design choice and shouldn't be reverted.

---

## Part 3 — External research

### Controlled inputs + autofill = no onChange

The pattern is documented at the browser/React boundary and well-known:

- [facebook/react #2125](https://github.com/facebook/react/issues/2125) — Safari autofill doesn't trigger onChange. Open since 2014.
- [react-hook-form discussion #1882](https://github.com/orgs/react-hook-form/discussions/1882) — same problem in modern React form libraries.
- [1Password community](https://www.1password.community/discussions/1password/react-re-rendering-causing-autocomplete-suggestion-issue/116882) — password manager autofill bypasses controlled-input change events.
- [Codedaily — Animated Input Label with Chrome Autofill Detection](https://www.codedaily.io/tutorials/Animated-Input-Label-with-Chrome-Autofill-Detection-in-React) — documents the `onAnimationStart` workaround.

**Why this informs the solution:** the fix isn't to detect autofill cleverly. The fix is to stop reading the code from React state. Read it from FormData on the server. Server Actions give us this for free.

### Supabase server-side OTP verification

The browser-side `supabase.auth.verifyOtp` is one supported path. The server-side equivalent is documented:

- [Supabase — Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase — Passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase — verifyOtp reference](https://supabase.com/docs/reference/javascript/auth-verifyotp)

The server-side flow uses `@supabase/ssr`'s server client (which Trajectas already has — `createServerSupabaseClient` from `@/lib/supabase/server`). Calling `supabase.auth.verifyOtp({ email, token, type: 'email' })` on the server sets the session cookies via the response cookie store. This is the same pattern used in `src/app/auth/callback/route.ts` already, which does `supabase.auth.getUser()` after the browser-side verify writes cookies.

**Why this informs the solution:** the conversion is straightforward — the server client already exists, the cookie machinery already works.

### Fetch timeouts: matching the pattern to the call

Modern primitive is `AbortSignal.timeout(ms)`:

- [MDN — AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)
- Errors with `TimeoutError` `DOMException`, distinguishable from user-cancelled aborts.

`AbortSignal.any([signal1, signal2])` (Chrome 116+, Firefox 124+) can combine a timeout signal with a user-cancellable one:

- [MDN — AbortSignal.any()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static)

**Round-2 refinement — feature-detect the abort helpers:** Next 16's browser floor is Safari 16.4+, while MDN marks both `AbortSignal.timeout()` and `AbortSignal.any()` as Baseline 2024 features. Do not assume either API exists across the full floor. The helper must feature-detect both and fall back to a manual `AbortController` + `setTimeout` implementation.

**Round-2 refinement — three call categories:**
1. **Interactive short calls** (session ping, copy confirmations): helper-enforced 5-10s timeout
2. **Medium async tasks** (uploads, exports, downloads): helper-enforced 30-60s timeout
3. **Long-running / streaming** (generation start, readiness, chat): NO blanket timeout. Use either (a) a heartbeat / per-chunk read timeout, (b) explicit cancel button driven by an `AbortController`, or (c) accept the platform's `maxDuration = 300` as the implicit ceiling and provide cancel UI.

### CSP nonce in Next.js 16

- [Next.js — Content Security Policy guide](https://nextjs.org/docs/app/guides/content-security-policy) — official pattern: middleware generates nonce, sets BOTH `x-nonce` AND `Content-Security-Policy` on forwarded request headers, also sets `Content-Security-Policy` on the response.
- Next reads the policy from the request headers during SSR to know which scripts to nonce.
- Static (cached) pages do not get a fresh nonce per request and need a different strategy (force dynamic, or hash-based CSP).

Related (but no longer the primary frame):
- [Next.js #55638](https://github.com/vercel/next.js/issues/55638), [#63749](https://github.com/vercel/next.js/issues/63749), [#77952](https://github.com/vercel/next.js/issues/77952), [#89754](https://github.com/vercel/next.js/issues/89754) — historical issues about nonce + middleware + caching interactions; useful background but not authoritative for "the implementation pattern is broken."

**Why this informs the solution:** the right next step is a spike — set the CSP header on the forwarded request in middleware, verify with `curl` that script tags get nonces in the rendered HTML, then decide on enforcement. The "upstream bug" framing in v1 was premature.

### Clipboard API on insecure contexts

- [MDN — Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)
- [web.dev — Unblocking clipboard access](https://web.dev/articles/async-clipboard)

`navigator.clipboard` is only present in [secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts). Production is HTTPS, so this is mostly defensive, but the larger issue is the un-awaited rejected promise pattern leading to false-success toasts. Fallback UI should be a dialog with selectable text (per round-2 review), not a toast containing the secret.

### `crypto.randomUUID` secure-context restriction

- [MDN — Crypto.randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)
- Multiple reports of failure in non-secure contexts: [payloadcms #11825](https://github.com/payloadcms/payload/issues/11825), [prisma #29534](https://github.com/prisma/prisma/issues/29534).

### Email deliverability for OTP on corporate networks

- [MojoAuth — Email Infrastructure & OTP Success Rates](https://mojoauth.com/blog/email-infrastructure-otp-magic-link-authentication) — delays of 3-10 minutes are common for transactional emails on Microsoft 365 tenants without warmed-up sender reputation. SPF/DKIM/DMARC are mandatory.
- [Supabase — OTP "token expired" troubleshooting](https://supabase.com/docs/guides/troubleshooting/otp-verification-failures-token-has-expired-or-otp_expired-errors-5ee4d0).
- [Microsoft Defender — Safe Links overview](https://learn.microsoft.com/en-us/defender-office-365/safe-links-about) — pre-clicks URLs in incoming emails. **Already mitigated** here by sending OTP codes in the email body.

### Browser feature support

- [caniuse — color-mix()](https://caniuse.com/mdn-css_types_color_color-mix) — ~89% global, Chrome 111+/Safari 16.2+/Firefox 113+
- [caniuse — :has()](https://caniuse.com/css-has) — broadly supported by 2026 (Chrome 105+, Safari 15.4+, Firefox 121+) — **NOT a real concern** in 2026
- [caniuse — field-sizing: content](https://caniuse.com/mdn-css_properties_field-sizing_content) — Chrome 123+/Safari 17+, **Firefox does not support** as of 2026
- Next 16 documented baseline: Safari 16.4+ — adopt this as the floor.

### Corporate SSL inspection (Zscaler-class)

- [Zscaler — Understanding SSL/TLS Inspection](https://help.zscaler.com/zia/understanding-ssltls-inspection)
- [Zscaler — Certificate Pinning and SSL/TLS Inspection](https://help.zscaler.com/zia/certificate-pinning-and-ssltls-inspection)

Not a *code-level* fix target. The code can be resilient to corporate-proxy effects (timeouts, retry-on-cancel, server-side auth flows) but the proxy itself is not something we control.

**Round-2 refinement — downgraded claim:** "Corporate browsers ignore CSP report-only and enforce blocking" is not well-sourced. What is documented is that EDR-injected scripts (CrowdStrike, Defender for Endpoint, Citrix Workspace browser shims) can fail under strict CSP because their script sources aren't in the policy, manifesting as broken hydration. Whether this caused the user's incident is unverified.

---

## Part 4 — Solutions

For each finding, the *what* and the *why-this-works*. The *how* is in Part 5.

### S1 (fixes F1, F2). Convert OTP verify to a Server Action with server-side redirect

Replace the two client-only `onClick` verify handlers with `<form action={verifyServerAction}>`. The server action reads the code from `FormData`, instantiates the supabase server client, calls `supabase.auth.verifyOtp({ email, token: code, type: 'email' })`, and on success **calls `redirect()` server-side** to the appropriate callback path. On failure, returns an error state that the form re-renders.

For the invite flow, the action must not trust a hidden `email` input. It should read the invite token from `FormData`, re-load the invite server-side via `getInviteByToken(token)`, derive the email from that invite, validate the invite is still usable, then call `verifyOtp` for that email. The existing callback/finalisation path still validates that the authenticated user's email matches the invite before accepting it.

**Why this works:**

1. **Eliminates the autofill class of bug entirely.** FormData captures whatever the browser submits, regardless of whether React's synthetic `onChange` fired.
2. **Removes the browser→Supabase reachability dependency for the verify step.** The current client-side `supabase.auth.verifyOtp` requires the browser to reach `*.supabase.co` directly. Some corporate firewalls block uncategorised SaaS domains. A Server Action runs on Vercel infrastructure, which the browser reaches via the same domain as the rest of the app — already trusted by definition. Supabase is then reached server-to-server.
3. **Works without JS** (progressive enhancement). The server-side `redirect()` happens during the form POST response; no client-side `useEffect` is required. v1 of this plan got this wrong.
4. **Allows Enter-to-submit naturally** via standard form semantics.
5. **Drops the `disabled={code.length < 6}` gate.** Validation moves server-side — the user clicks, the server checks, the form re-renders with an error if needed.

**Implementation note:** Two forms now live on the page (verify + resend). Use distinct `useActionState` instances for each, or split into separate route components, to avoid action collisions.

### S2 (fixes F3a, F3b). Tiered fetch resilience

**Two helpers, not one:**

```ts
// src/lib/net/fetch-with-timeout.ts — for interactive + medium calls only
function createTimeoutSignal(timeoutMs: number): {
  signal: AbortSignal
  cleanup: () => void
} {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(timeoutMs), cleanup: () => {} }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"))
  }, timeoutMs)

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeout),
  }
}

function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1) return signals[0]
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals)
  }

  const controller = new AbortController()
  const abort = (signal: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason)
  }

  for (const signal of signals) {
    if (signal.aborted) {
      abort(signal)
      break
    }
    signal.addEventListener("abort", () => abort(signal), { once: true })
  }

  return controller.signal
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs: number },
): Promise<Response> {
  const { timeoutMs, signal, ...rest } = init;
  const timeout = createTimeoutSignal(timeoutMs);
  const signals = signal ? [signal, timeout.signal] : [timeout.signal];

  try {
    return await fetch(input, { ...rest, signal: combineSignals(signals) });
  } finally {
    timeout.cleanup();
  }
}
```

Required: every call site that adopts this passes an explicit `timeoutMs` — no default that could be silently inherited by an inappropriate caller.

```ts
// src/lib/net/cancellable-fetch.ts — for long-running calls (chat, generation)
export function cancellableFetch(
  input: RequestInfo | URL,
  init: RequestInit & { controller: AbortController },
): Promise<Response> {
  return fetch(input, { ...init, signal: init.controller.signal });
}
```

For long-running calls, the calling component owns the `AbortController`, exposes a Cancel button, and decides what (if any) per-chunk/heartbeat timeout makes sense. NO blanket timeout from the helper.

**Why this works:**

- `AbortSignal.timeout(ms)` is the documented modern primitive for short/medium calls where available; the helper falls back manually where it is not.
- Long-running endpoints (`maxDuration = 300`) don't get killed by a timeout that doesn't match their actual workload.
- Cancel UI is the right user-facing pattern for "this is taking a while" on streaming or async-job endpoints.
- The two helpers communicate intent at the call site — you can't accidentally use the wrong one.
- The helper does not assume Baseline 2024 abort helpers are present across every browser supported by Next 16.

### S3 (fixes F4). CSP spike + targeted fix

**Step 1 — spike, before any other CSP work:**

1. Update `src/proxy.ts` to ALSO set the `Content-Security-Policy-Report-Only` (or `Content-Security-Policy`) header on the forwarded request headers, matching the response header, per the [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy).
2. Deploy to a preview environment.
3. Verify with `curl` that script tags in rendered HTML now carry the nonce on at least one dynamic route. Start with `/login` and an authenticated dashboard route; treat the marketing home separately because static routes may not receive per-request nonces.
4. Verify the marketing home, login, and one authenticated dashboard route in particular (they may behave differently depending on rendering mode).
5. Decision point:
   - **If nonces are now attached** on dynamic routes: file a follow-up to investigate static routes specifically, then plan enforcement rollout (preview → small percent of production → full enforcement).
   - **If nonces still aren't attached:** capture what we tried, file an issue (or find an existing one) upstream, and de-fang `CSP_ENFORCE` by removing the flag from the codebase so nobody flips it.

**Why this works:** The current implementation is incomplete. Fixing the request-header forwarding may be all that's needed. We don't know without trying, but trying is cheap.

### S4 (fixes F5). Centralised URL policy + startup assertion

```ts
// src/lib/hosts.ts (additions)
export function requireAppUrl(surface: Surface = "public"): string {
  const configured = getConfiguredSurfaceUrl(surface);
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3002";
  throw new Error(
    `Missing surface URL env var for "${surface}". ` +
    `Configure PUBLIC_APP_URL / ADMIN_APP_URL / etc. before deploy.`
  );
}

export function assertSurfaceUrlsConfigured(): void {
  if (process.env.NODE_ENV !== "production") return;
  const required: Surface[] = ["public", "admin", "assess"];
  // partner / client are optional depending on tenant setup
  const missing = required.filter(s => !getConfiguredSurfaceUrl(s));
  if (missing.length) {
    throw new Error(`Missing surface URLs in production: ${missing.join(", ")}`);
  }
}
```

Call `assertSurfaceUrlsConfigured()` from `src/instrumentation.ts` inside `export async function register()` so misconfiguration fails the boot, not the first user request. Also add a CI/build-time check for the same required envs because `src/lib/next-config/security.ts` computes `serverActions.allowedOrigins` during Next config evaluation; a runtime assertion cannot retroactively add missing allowed origins to an already-built deployment.

**Updated audit (sites to migrate or explicitly classify as safe):**
- `src/lib/auth/otp.ts:13-33`
- `src/app/actions/auth.ts:50-65,114-120`
- `src/app/actions/admin-user-actions.ts:27-35,68-75`
- `src/app/actions/assess.ts:1465-1468`
- `src/app/actions/reports.ts:1282,1309`
- `src/app/actions/campaigns.ts:1377`
- `src/app/actions/account-deletion.ts:128-133`
- `src/lib/auth/staff-auth.ts:676`
- `src/lib/reports/pdf.ts:47-52`
- `src/lib/reports/preview-pdf.ts:4-9`
- `src/lib/campaign-access-links.ts:7-15`
- `src/lib/seo/public-site.ts:4,19-25`
- `src/lib/integrations/service.ts:29-42`
- `src/app/login/page.tsx:12-15,41`
- `src/app/auth/accept/page.tsx:7-10`
- `src/app/api/auth/send-email/route.ts:145`
- `src/lib/next-config/security.ts:49-61` (assert origins, not URL construction)

**Why this works:** Fail-loud at boot beats fail-silent per-request. A misconfigured preview deploy is caught before users hit it. The localhost fallback in dev keeps developer experience unchanged.

### S5 (fixes F6). Clipboard dialog fallback

Helper:

```ts
// src/lib/clipboard.ts
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator?.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
```

Call site pattern:

```tsx
const copied = await copyToClipboard(url);
if (copied) {
  toast.success("Link copied");
} else {
  // Open a small dialog with a pre-selected, read-only input containing the URL.
  // User copies manually. URL is not shown in a toast.
  setManualCopyDialogState({ open: true, value: url });
}
```

**Why this works (round-2 refinement):** Honest failure feedback without spilling the token into a toast that other people standing behind the user could see. The dialog has the text in a focused, selectable input — the user does Cmd-C themselves.

### S6 (fixes F7). `randomId()` helper

```ts
// src/lib/ids.ts
/**
 * Generates a non-cryptographic random ID for UI use (React keys, message IDs,
 * draft IDs). NOT suitable for security tokens, session IDs, or anything that
 * must be unguessable — use `crypto.randomUUID()` directly in those cases and
 * ensure you're in a secure context.
 */
export function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```

Update `src/lib/assess/response-store.ts:158-164` to use this (dropping the duplicate fallback). Migrate the three browser-only call sites.

**Why this works:** Production HTTPS uses the secure-context `randomUUID`; non-secure contexts fall back to a uniqueness-sufficient ID. Documentation makes intent explicit and prevents accidental misuse.

### S7 (fixes F8). `@supports` gate for participant-facing `color-mix`

```css
.progress-track {
  background-color: rgba(127, 200, 178, 0.1); /* flat fallback */
}
@supports (background: color-mix(in srgb, red, blue)) {
  .progress-track {
    background-color: color-mix(in srgb, var(--emerald) 10%, transparent);
  }
}
```

Same treatment for `src/components/assess/item-card.tsx:47` if visual review confirms its background is legibility-critical.

### S8 (fixes F9). `@supports` gate for `backdrop-filter`

Wrap the rule:

```css
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .original-rule { backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%); }
}
```

Matches the pattern already used in `src/components/ui/dialog.tsx:34`.

### S9 (fixes F10). `browserslist` aligned to Next 16

```json
"browserslist": [
  "Chrome >= 111",
  "Edge >= 111",
  "Firefox >= 113",
  "Safari >= 16.4",
  "iOS >= 16.4",
  "not dead"
]
```

Floor chosen to:
- Cover `color-mix()` everywhere (Chrome 111 / Safari 16.2 / Firefox 113)
- Cover Next 16's documented Safari 16.4+ baseline
- Avoid promising Baseline 2024 abort helpers across the whole support floor; `fetchWithTimeout` still feature-detects `AbortSignal.timeout()` and `AbortSignal.any()`

---

## Part 5 — Implementation plan

### Sequencing rationale

- **PR 0 — CSP spike first.** If tractable, this addresses one of the more plausible causes of corporate-laptop weirdness AND closes a sleeper. If not tractable, we know quickly and de-fang the flag.
- **PR 0.5 — Trivial mechanical fixes** (clipboard dialog, `randomId()`). Low risk, ship alongside PR 0 or in parallel.
- **PR 1 — User blockers** (OTP + interactive timeouts). The actual user-reported issue.
- **PR 2 — Long-running endpoint behaviour.** A deliberate workstream — generation, readiness, chat. Cancel UI, heartbeat, per-chunk timeout where appropriate. NOT folded into PR 1.
- **PR 3 — URL centralisation.** Mechanical migration plus startup assertion.
- **PR 4 — CSS/browserslist cleanup.** Lowest urgency, easy to ship as a chore.

### PR 0 — CSP spike

#### Scope

- Add `Content-Security-Policy-Report-Only` (or `Content-Security-Policy`) to forwarded request headers in `src/proxy.ts`
- Deploy to preview
- Verify nonce attachment with `curl`
- Decide on follow-up based on outcome

#### Files touched

```
src/proxy.ts                                                       (add CSP request header)
```

#### Step-by-step

1. Refactor the CSP header-name/policy computation so `withSurfaceHeaders` receives the same `cspHeaderName` and `csp` that `applySecurityHeaders` will put on the response, then set `requestHeaders.set(cspHeaderName, csp)` before `NextResponse.next()` / `NextResponse.rewrite()`.
2. Deploy preview.
3. `curl -sA "Chrome" https://<preview-url>/login | grep -c 'nonce='` — expect non-zero count if `/login` is rendered dynamically after the fix.
4. Same on one authenticated dashboard route. Check `/` separately; if it remains static and has zero nonces, that is expected and feeds the static-route decision.
5. If nonces are attached on dynamic routes: write a follow-up document covering static-route strategy (force-dynamic vs. hash-based CSP) and enforcement rollout.
6. If nonces are NOT attached: remove the `CSP_ENFORCE` env-var path and the misleading comment at `src/proxy.ts:170`. Update the comment to say "CSP runs in report-only mode for telemetry; enforcement is not currently achievable in this Next.js setup."

#### Risks

- Low, but not zero. The change should remain report-only in preview, but it can alter how Next renders nonce attributes. Verify preview before production.
- Preview-only first, no production risk.

#### Rollback

- One-line revert.

#### Definition of done

- Either nonces are visible in preview HTML script tags on dynamic routes and a follow-up enforcement rollout is documented, OR a clear decision document explains why enforcement is deferred. Production enforcement waits for that rollout.

### PR 0.5 — Trivial mechanical fixes

#### Scope

- `randomId()` helper + migration of 3 call sites + use in `response-store.ts`
- `copyToClipboard()` helper + dialog-fallback pattern + migration of 2 call sites

#### Files touched

```
src/lib/ids.ts                                                     (new)
src/lib/clipboard.ts                                               (new)
src/lib/assess/response-store.ts                                   (use randomId)
src/app/(dashboard)/chat/chat-interface.tsx                        (use randomId)
src/app/(dashboard)/report-templates/[id]/builder/block-builder-client.tsx (use randomId)
src/app/(dashboard)/campaigns/[id]/settings/campaign-access-links.tsx  (use copyToClipboard + dialog)
src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx (use copyToClipboard + dialog)
```

#### Step-by-step

1. Create `src/lib/ids.ts` with `randomId()` and the JSDoc warning.
2. Create `src/lib/clipboard.ts` with `copyToClipboard()`.
3. Migrate `response-store.ts` to use `randomId()` (drop the duplicate fallback).
4. Migrate the 3 browser-only `crypto.randomUUID` call sites.
5. Build a shared `ManualCopyDialog` component (or reuse a `Dialog` primitive) with a read-only, pre-focused input.
6. Migrate the 2 unsafe clipboard call sites: replace toast-on-success-without-checking with `await copyToClipboard()` and either toast-success or open the dialog.

#### Risks

- Visual regression in the manual-copy dialog if the styling is off.
- The dialog is new component territory — needs accessibility check (focus management, escape-to-close, label).

#### Rollback

- Per-site revert; helpers are additive.

#### Definition of done

- Grep confirms zero remaining `navigator.clipboard.writeText` calls outside the helper.
- Grep confirms zero remaining `crypto.randomUUID()` calls in browser code outside the helper.
- Manual/automated test: stub `navigator.clipboard` to be missing/rejecting in Playwright, or test on a genuinely non-secure, non-local HTTP origin. Click copy — see the dialog, not a false success.

### PR 1 — User blockers (highest priority, highest impact)

#### Scope

- Convert OTP verify to Server Action (with `redirect()`) in login form
- Convert OTP verify to Server Action (with `redirect()`) in invite-accept form
- Create `fetchWithTimeout` helper
- Route the **6 interactive/medium** client fetches through it (F3a list — NOT the F3b long-running endpoints)

#### Files touched

```
src/app/login/login-form.tsx                                       (rewrite verify step)
src/app/auth/accept/accept-invite-form.tsx                         (rewrite verify step)
src/app/actions/auth.ts                                            (add verifyStaffOtp + verifyInviteOtp)
src/lib/net/fetch-with-timeout.ts                                  (new)
src/components/brand-editor/logo-uploader.tsx                      (use fetchWithTimeout, 30s)
src/components/auth/session-activity-provider.tsx                  (use fetchWithTimeout, 5s)
src/components/reports/report-pdf-button.tsx                       (use fetchWithTimeout — 10s status poll, 60s download)
src/components/comparison/comparison-export-button.tsx             (use fetchWithTimeout, 30s)
src/components/reports/preview-pdf-button.tsx                      (use fetchWithTimeout, 60s)
tests/e2e/auth-otp.spec.ts                                         (new — Playwright e2e for the server action path)
```

#### Step-by-step

1. **Add Server Action `verifyStaffOtp`** in `src/app/actions/auth.ts`:
   - Takes `FormData` with `email`, `code`, optional `next`.
   - Validates with zod (`code` must be exactly 6 digits).
   - Calls `createServerSupabaseClient()` and `supabase.auth.verifyOtp({ email, token: code, type: 'email' })`.
   - On success: `redirect(buildCallbackPath(next, null))`. Server-side, no client involvement.
   - On failure: returns `{ error: "That code didn't work. Request a new one and try again." }`.
2. **Add Server Action `verifyInviteOtp`**:
   - Takes `FormData` with `invite`, `code`, optional `next`.
   - Re-loads the invite with `getInviteByToken(token)` and rejects revoked, accepted, expired, or missing invites.
   - Derives the email from the invite record server-side; do not trust a hidden email field.
   - Calls `supabase.auth.verifyOtp({ email: invite.email, token: code, type: 'email' })`.
   - On success: `redirect(buildCallbackPath(next, token))`.
   - On failure: returns the same generic code error.
3. **Rewrite the verify-step UI in login-form.tsx:**
   - Replace `<Button onClick={handleVerify}>` with `<form action={verifyStaffOtp}>`.
   - Switch the `<Input>` from controlled to uncontrolled (`name="code"`, no `value`/`onChange`). Keep `inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`.
   - Hidden inputs for `email` and `next`.
   - Submit button is `type="submit"`, no `disabled` gate.
   - Use `useActionState` for pending state and error messages.
4. **Rewrite the verify-step UI in accept-invite-form.tsx** — same shape.
5. **Resend code button:** keep using its existing `formAction` for `requestStaffOtp`. Confirm the two forms don't share state in a way that breaks each other (separate `useActionState` instances).
6. **Create `fetchWithTimeout` helper** at `src/lib/net/fetch-with-timeout.ts` (signature in S2). Required `timeoutMs`; no default.
7. **Route the 6 F3a call sites through it.** Per-site timeouts:
   - `logo-uploader.tsx:52` — 30s (file size)
   - `session-activity-provider.tsx:84` — 5s (small payload, should be fast)
   - `report-pdf-button.tsx:85` — 10s per poll
   - `report-pdf-button.tsx:174` — 60s (large file download)
   - `comparison-export-button.tsx:21` — 30s
   - `preview-pdf-button.tsx:23` — 60s
8. **Update each affected component to handle `TimeoutError`** with an inline error or toast: "This is taking longer than expected. Check your connection and try again."
9. **Tests:**
   - Add `tests/e2e/auth-otp.spec.ts` covering: valid code submit → arrives at dashboard; invalid code → error message inline; expired/missing code → error message inline. Uses Playwright against the local stack via the existing `npm run dev:test` / `npm run test:e2e` path, or a dedicated Playwright script that loads the same local Supabase env.
   - The local-Supabase host whitelist guard per `AGENTS.md` must be present in any test that touches the DB.

#### Risks

- **Behavioural change in verify path.** `supabase.auth.verifyOtp` server-side sets cookies via the server client's cookie store. The `auth/callback` route already demonstrates this pattern works for the post-redirect cookie read. Test path: code → server action → `redirect(/auth/callback)` → callback reads `supabase.auth.getUser()` → onward redirect.
- **Resend code interaction.** Two forms on the same page. Use distinct `useActionState` instances. Don't share `pending` state between them.
- **Server-side `redirect()` thrown errors must propagate.** Per Next.js docs, throwing a redirect is normal — it's caught by the framework. Don't wrap the `verifyOtp + redirect` call in a try/catch that swallows the redirect throw.
- **Server Action allowed origins.** The send-code flow already depends on Server Actions, and PR 1 makes verify depend on them too. Before deploying PR 1 to preview, confirm `PUBLIC_APP_URL`, `ADMIN_APP_URL`, `ASSESS_APP_URL`, and any enabled partner/client surface URLs are present so `serverActions.allowedOrigins` includes the submitting host.

#### Rollback

- If the OTP server action causes regressions, revert just the verify-step UI to the prior `onClick` handler. Keep the new server actions in place but unused — they're additive.
- `fetchWithTimeout` is opt-in per call site; revert individual sites if needed.

#### Definition of done

- Login completes the full email-OTP-verify flow on BrowserStack Live → Windows 11 → Chrome latest, and separately on a real managed laptop or explicitly configured corporate proxy profile before claiming corporate-environment coverage.
- All 6 interactive client fetches show error-recovery UI when the network is throttled to "slow 3G" or blocked in DevTools.
- Existing CI (`security` → `quality` → `e2e-smoke`) passes.
- New OTP e2e test passes against local Supabase, with the production-guard whitelist active.

### PR 2 — Long-running endpoint behaviour

#### Scope

A separate workstream for the three endpoints with `maxDuration = 300`. Goal: provide cancel UI and meaningful "still working" feedback, not a blanket timeout.

#### Files touched

```
src/lib/net/cancellable-fetch.ts                                   (new)
src/app/(dashboard)/chat/chat-interface.tsx                        (cancel button, streaming UI)
src/app/(dashboard)/generate/[runId]/page.tsx                      (cancel button, progress UI)
src/app/(dashboard)/generate/new/page.tsx                          (same, 2 sites)
```

#### Step-by-step

1. Create `cancellableFetch` helper as described in S2.
2. For each long-running call:
   - Component owns an `AbortController` per request, stored in a ref or state.
   - User-visible Cancel button that calls `controller.abort()`.
   - Progress UI: spinner with elapsed time and "still working" message after 30s, "this is taking longer than expected — please wait or cancel" after 90s.
   - On abort, show a "Cancelled" state and offer Retry.
3. For the chat streaming endpoint specifically, ensure the cancel correctly closes the SSE/stream reader.

#### Risks

- Streaming protocol behaviour varies — make sure the OpenRouter retry helper (`withOpenRouterRetry`) cooperates with cancel.
- Per-request `AbortController` state needs to survive component re-renders cleanly; use `useRef` for the controller.

#### Rollback

- Per-component revert.

#### Definition of done

- A user can cancel a generation that's been running for 2 minutes and the UI returns to a usable state immediately.
- Cancelling chat mid-stream returns the partial response and stops the streaming reader cleanly.
- Readiness polling has a Cancel option.

### PR 3 — URL centralisation

#### Scope

- `requireAppUrl()` helper
- `assertSurfaceUrlsConfigured()` startup check
- Build/CI check that required surface URL envs are present before `serverActions.allowedOrigins` is generated
- Migration/classification of the current URL fallback inventory
- Removal of `'http://localhost:3002'` literal in production paths

#### Files touched

```
src/lib/hosts.ts                                                   (add requireAppUrl + assert)
src/instrumentation.ts                                             (call assertSurfaceUrlsConfigured from register())
scripts/check-surface-env.mjs                                      (new build/CI guard, if not wired directly into config)
src/lib/auth/otp.ts                                                (use requireAppUrl)
src/app/actions/auth.ts                                            (use requireAppUrl)
src/app/actions/assess.ts                                          (use requireAppUrl)
src/app/actions/admin-user-actions.ts                              (use requireAppUrl)
src/app/actions/reports.ts                                         (use requireAppUrl)
src/app/actions/campaigns.ts                                       (use requireAppUrl)
src/app/actions/account-deletion.ts                                (use requireAppUrl)
src/lib/auth/staff-auth.ts                                         (use requireAppUrl)
src/lib/reports/pdf.ts                                             (use requireAppUrl)
src/lib/reports/preview-pdf.ts                                     (use requireAppUrl)
src/lib/campaign-access-links.ts                                   (use requireAppUrl or explicitly relative-only)
src/lib/seo/public-site.ts                                         (use requireAppUrl or explicitly classify as dev-only fallback)
src/lib/integrations/service.ts                                    (use requireAppUrl)
src/app/login/page.tsx                                             (use requireAppUrl)
src/app/auth/accept/page.tsx                                       (use requireAppUrl)
src/app/api/auth/send-email/route.ts                               (use requireAppUrl / configured login URL)
src/lib/next-config/security.ts                                    (assert allowedOrigins config)
tests/unit/hosts.test.ts                                           (new — assert throws / dev-fallback behaviour)
```

#### Step-by-step

1. Add helpers in `src/lib/hosts.ts`.
2. Wire the startup assertion in `src/instrumentation.ts` via `export async function register()` (Next 16's recommended boot-time hook).
3. Add a build/CI assertion for the same envs, because `serverActions.allowedOrigins` is derived before runtime.
4. Find every `?? 'http://localhost:3002'` and every direct `process.env.NEXT_PUBLIC_APP_URL` / `PUBLIC_APP_URL` / `ADMIN_APP_URL` read. Replace with `requireAppUrl()` calls in production paths, or explicitly classify a site as a dev-only fallback / relative-only URL builder.
5. Confirm via grep that no `'http://localhost:3002'` literal remains in `src/` outside the central URL module and any deliberately documented dev-only fallback.
6. Unit tests: `requireAppUrl` throws in production with no env; returns localhost in dev; `assertSurfaceUrlsConfigured` throws if any required surface is missing; the allowed-origin builder fails or reports clearly when a required surface env is missing.
7. Verify on a preview deploy with one surface URL deliberately unset: build or boot fails with the expected error.

#### Risks

- **Boot failure on a misconfigured deploy.** This is intentional — fail loud > silent breakage. But it WILL block a deploy that was previously "working" by accident. Audit env vars on Vercel before merging.

#### Rollback

- Per-file revert; helpers are additive.

#### Definition of done

- Grep confirms zero unreviewed `'http://localhost:3002'` literals in production code paths (`src/` excluding the central URL module and documented dev-only fallback, if retained).
- Grep confirms zero unreviewed direct `process.env.NEXT_PUBLIC_APP_URL` reads in production URL builders.
- `serverActions.allowedOrigins` includes every configured surface host in the environments where those surfaces are deployed.
- A preview deploy with `PUBLIC_APP_URL` deliberately unset fails at boot with the expected error.
- All migrated sites continue to function in normal operation.

### PR 4 — CSS / browserslist cleanup

#### Scope

- `@supports` gate participant-facing `color-mix`
- `@supports` gate `backdrop-filter` in globals.css
- `browserslist` entry in package.json

#### Files touched

```
src/components/assess/progress-bar.tsx     (CSS update)
src/components/assess/item-card.tsx        (CSS update if participant-critical)
src/app/globals.css                        (backdrop-filter gate)
package.json                               (browserslist)
```

#### Step-by-step

1. Update `progress-bar.tsx:29` per S7.
2. Optionally update `item-card.tsx:47` (visual review first).
3. Wrap `globals.css:438-439` per S8.
4. Add `browserslist` to `package.json` per S9.

#### Risks

- Visual regression — manual visual check against the modern-supported version.

#### Rollback

- Trivial.

#### Definition of done

- Test on a browser that doesn't support `color-mix` (BrowserStack older Chrome/Safari, or a targeted CSS fixture); progress bar and card render with sensible colours.

### Decisions outside PR scope

#### D1. CSP enforcement strategy (post-PR 0)

Depends on PR 0 outcome:

- **D1.a (if nonces attach after the spike):** Plan enforcement rollout. Preview → 10% production → 100%. Requires deciding static-route strategy (force-dynamic for sensitive routes vs. hash-based CSP for static).
- **D1.b (if nonces still don't attach):** Remove `CSP_ENFORCE` flag and misleading comment. Document that CSP is telemetry-only. Track as technical debt for a future hash-based pipeline.

#### D2. Email deliverability operations

Not in PR scope; parallel ops task:

- Verify SPF for `mail.trajectas.com` includes Resend.
- Verify DKIM is signed by Resend.
- Add DMARC at `p=none` first, with `rua=mailto:...` for reports.
- Monitor Resend deliverability + DMARC reports for ~2 weeks.
- Progress to `p=quarantine` if all is clean; then to `p=reject` after another stable period.

#### D3. Operational telemetry (Sentry / PostHog)

User has explicitly declined. The consequence is explicit: **without client-side error capture, reliability confidence is capped.** The next non-obvious incident will again require user verbal reports without stack traces or session replay. This decision should be revisited the next time an unexplained incident occurs.

#### D4. Browser-profile testing before claiming "works everywhere"

Once PR 1 ships, manual test on at least:

- Latest stable Chrome (baseline)
- Latest stable Safari (different rendering engine)
- Latest stable Firefox (different rendering engine, no `field-sizing`)
- **BrowserStack Live → Windows 11 → Chrome (latest)** as a Windows/browser baseline, not as proof of corporate-proxy behaviour
- A real managed corporate laptop OR an explicitly configured proxy/EDR profile (for example Zscaler/Citrix/Defender environment) before claiming corporate-environment coverage
- iOS Safari (latest minus 1)
- Reduced-motion preference enabled

This is not optional — it's how we validate the "works everywhere" claim with actual evidence.

### Out of scope for this plan (tracked separately)

- Marketing site redesign — user decision
- Field-sizing fallback for Firefox (low-impact, polish only)
- localStorage hardening (preview paths only, not user-blocking)
- Print surface audit
- Snapshot report viewer (`/assess/r/[snapshotId]`) audit
- Diagnostic campaign respondent flows audit (recent work, may not be in scope of current incident)

These are noted for completeness; pulling them in would expand the scope without addressing the immediate reliability concerns.

---

## Appendix A — Evolution of thinking

### Round 1 (initial investigation)

- Thought the marketing failure was browser CSS compatibility
- Thought the login failure was the autofill bug
- Thought CSP report-only was harmless
- Proposed 14-item fix plan organised by guess

### Round 2 (after first reviewer feedback)

- Downgraded marketing severity (correctly)
- Tightened OTP fix to be a real Server Action
- Corrected "relative URLs from server actions" to "validated absolute URL"
- Refined clipboard analysis (two failure modes, not one)

### Round 3 (after actually loading production in Playwright)

- Browser CSS compatibility theories collapsed (modern Chrome supports everything)
- Marketing root cause identified as scroll-reveal design pattern
- User moved marketing to a redesign track

### Round 4 (after deeper external research)

- Discovered the CSP nonce architecture appeared broken in production (zero nonces on script tags)
- Confirmed Microsoft Safe Links is already mitigated (code-in-body pattern)
- Confirmed `AbortSignal.timeout()` is the right modern primitive
- Calibrated `field-sizing` and `:has()` as smaller concerns than initially scored

### Round 5 (after second external review of v1 of this document)

- **CSP reframed** from "Next.js upstream bug" to "missing middleware line, likely tractable" — most important correction
- **Fetch timeout differentiation** — v1 would have killed long-running endpoints; split into interactive vs. long-running
- **OTP `redirect()` correction** — server-side, not client-side `useEffect`
- **URL audit expanded** — full direct-env and localhost-fallback inventory identified, plus Server Action allowed-origin drift
- **Browser floor aligned** to Next 16 baseline (Safari 16.4+)
- **Integration test approach** shifted from Vitest to Playwright e2e
- **Clipboard fallback** moved from toast-with-URL to dialog-with-selectable-input
- **DMARC** sequenced as gradual rollout, not immediate `p=reject`
- **CSP-corporate-browser claim** downgraded; no concrete source
- **BrowserStack profile** downgraded to Windows/browser baseline; corporate proxy coverage requires a real managed laptop or configured proxy/EDR profile

### Final position (this plan)

- Concrete, file:line-cited findings with confidence ratings
- PR scope ordered by impact and risk, CSP spike first
- Explicit treatment of long-running endpoints separately from interactive calls
- Honest about residual risk (no telemetry = capped confidence)
- Reviewer's corrections fully integrated

---

## Appendix B — What "bulletproof" actually means in this plan

"Bulletproof platform that works in every environment" cannot be reached by code changes alone. The contributions are layered:

1. **Code resilience** (this plan, PRs 0-4) — closes every documented failure mode tied to a specific cause.
2. **Architecture decisions** (D1) — CSP gets fixed or honestly documented as not-currently-enforceable.
3. **Operations** (D2) — email deliverability via DNS configuration with a gradual DMARC rollout.
4. **Validation** (D4) — actually test on representative environments instead of assuming, including BrowserStack Windows 11 + Chrome plus a real/configured corporate environment.
5. **Telemetry** (D3, currently declined) — converts unknown failures from anecdote to actionable signal.

Without telemetry (D3), we cap at "every failure mode we know about is closed, and we tested on representative environments before claiming success." That's a meaningful posture and arguably the right one for a startup pre-launch, but it is not "bulletproof in every environment for all time" — that level of confidence requires ongoing observability.

The user's framing — "this is pivotal for launching properly" — is correct. The most leveraged thing for *launch* is **PR 0 (CSP spike), PR 1 (user-blockers), D2 (email deliverability), and D4 (real environment testing).** PR 2 (long-running endpoints) becomes important once users are doing real work in chat and generation. The rest is hardening that matters for the second and third week of being live, not the first day.
