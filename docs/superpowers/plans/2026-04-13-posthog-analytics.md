# PostHog Product Analytics Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PostHog to capture product usage data across admin, partner, and client portals — page views, key funnel events, and feature flags — so product decisions are data-driven rather than assumption-driven.

**Architecture:** `posthog-js` is initialised in a client-side `PostHogProvider` that wraps the root layout. `posthog-node` handles server-side event capture in Server Components and server actions. A typed `analytics.ts` helper abstracts all `posthog.capture()` calls so event names are never raw strings scattered through the codebase. Feature flags are evaluated server-side in middleware for clean A/B gating.

**Tech stack:** `posthog-js`, `posthog-node`

**Key reference files:**
- Root layout: `src/app/layout.tsx`
- Auth session: find via Grep for `createServerClient` or `getSession`
- Middleware: `src/middleware.ts`
- Critical funnel: campaign setup, session completion, report viewing

---

## Implementation Steps

### Phase 1 — Install

- [ ] Install: `npm install posthog-js posthog-node`
- [ ] Read PostHog Next.js App Router integration docs — check `node_modules/posthog-js/` for any bundled docs, otherwise the PostHog docs at posthog.com/docs/libraries/next-js are authoritative

### Phase 2 — Client provider

- [ ] Create `src/components/posthog-provider.tsx` — client component, initialises `posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, { api_host: '/ingest', ui_host: 'https://app.posthog.com' })`, wraps children in `PostHogProvider`
- [ ] Route PostHog ingestion through `/ingest` to avoid ad blockers: add Next.js rewrites in `next.config.ts` for `/ingest/static/:path*` and `/ingest/:path*` → `https://app.posthog.com/...`
- [ ] Add `<PostHogProvider>` to `src/app/layout.tsx` (client boundary only — keep layout itself a Server Component by wrapping in a client child)

### Phase 3 — Page view tracking

- [ ] Create `src/components/posthog-page-view.tsx` — client component, uses `usePathname` + `useSearchParams` to fire `posthog.capture('$pageview')` on route change
- [ ] Mount inside `PostHogProvider`

### Phase 4 — Typed analytics helper

- [ ] Create `src/lib/analytics.ts` with typed event capture:
  ```ts
  export const analytics = {
    campaignCreated: (id: string) => posthog.capture('campaign_created', { campaign_id: id }),
    sessionCompleted: (sessionId: string, duration: number) => posthog.capture('session_completed', { session_id: sessionId, duration }),
    reportViewed: (reportId: string, portal: 'partner' | 'client') => posthog.capture('report_viewed', { report_id: reportId, portal }),
    partnerOnboarded: (partnerId: string) => posthog.capture('partner_onboarded', { partner_id: partnerId }),
    // Add more as identified below
  }
  ```
- [ ] Identify the 10 most important funnel events by grepping for key server actions and page entry points; add typed captures for each

### Phase 5 — Identity

- [ ] On sign-in, call `posthog.identify(userId, { email, role, partner_id })` — find the sign-in callback/session provider
- [ ] On sign-out, call `posthog.reset()`
- [ ] Tag portal context: `posthog.register({ portal: 'admin' | 'partner' | 'client' })` based on route group

### Phase 6 — Feature flags

- [ ] Create `src/lib/feature-flags.ts` using `posthog-node` `getFeatureFlag(key, distinctId)` for server-side evaluation
- [ ] Wire feature flags to at least one experimental feature (e.g., new report builder, AI suggestions) to validate the setup works
- [ ] Add flags to the diagnostics page so admins can see active flags for a given user

### Phase 7 — Env and privacy

- [ ] Add `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_PERSONAL_API_KEY` to `.env.example`
- [ ] Configure PostHog to disable capture when `NEXT_PUBLIC_POSTHOG_KEY` is absent (no-op in local dev)
- [ ] Confirm no PII beyond email/id is captured in event properties
- [ ] Do not capture assessment response content in analytics events

---

## Acceptance criteria

- Page views are tracked across all three portals in PostHog dashboard
- Campaign creation, session completion, and report view events appear in the Events stream
- Feature flag evaluation works server-side in middleware
- No PostHog calls fire when `NEXT_PUBLIC_POSTHOG_KEY` is absent
- No assessment response content is captured
