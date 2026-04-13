# Sentry Error Monitoring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Sentry into the Next.js app so uncaught errors, server action failures, and edge runtime exceptions are automatically captured and reported, without requiring partners or clients to report them manually.

**Architecture:** `@sentry/nextjs` wraps the Next.js build via `withSentryConfig` in `next.config.ts`. Three config files handle client, server, and edge runtimes. A custom `error.tsx` at the root and per-route level calls `Sentry.captureException`. Source maps are uploaded at build time so stack traces resolve to real line numbers. DSN and auth token are env vars — absent in local dev means Sentry no-ops.

**Tech stack:** `@sentry/nextjs`

**Key reference files:**
- `next.config.ts` — needs `withSentryConfig` wrapper
- Root error boundary: check if `src/app/error.tsx` exists
- Existing diagnostics page: search for `diagnostics` in `src/app/`
- Env files: `.env.local`, `.env.example`

---

## Implementation Steps

### Phase 1 — Install

- [ ] Install: `npm install @sentry/nextjs`
- [ ] Read `node_modules/@sentry/nextjs/README.md` — confirm current API for Next.js App Router (the SDK has had breaking changes; do not rely on training data)

### Phase 2 — Create Sentry config files

- [ ] Create `sentry.client.config.ts` at project root:
  ```ts
  import * as Sentry from '@sentry/nextjs'
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  })
  ```
- [ ] Create `sentry.server.config.ts` at project root (same shape, no `NEXT_PUBLIC_` prefix for server DSN)
- [ ] Create `sentry.edge.config.ts` at project root (same shape)

### Phase 3 — Wrap next.config.ts

- [ ] Read `next.config.ts` fully before editing
- [ ] Wrap the existing config export with `withSentryConfig(config, { silent: true, hideSourceMaps: true, widenClientFileUpload: true })`
- [ ] Add `SENTRY_AUTH_TOKEN` to build env — document in `.env.example`

### Phase 4 — Wire error boundaries

- [ ] Check if `src/app/error.tsx` exists; if not, create it
- [ ] In `error.tsx`, call `Sentry.captureException(error)` in a `useEffect` on mount
- [ ] Create or update `src/app/global-error.tsx` for root-level crashes
- [ ] Check for partner and client portal route groups (`src/app/partner/`, `src/app/client/`) — add `error.tsx` in each if not present

### Phase 5 — Server action error capture

- [ ] Create `src/lib/sentry.ts` utility: `captureActionError(error: unknown, context?: Record<string, unknown>)` — wraps `Sentry.captureException` with action name tagging
- [ ] Add `captureActionError` calls to the catch blocks in the three most critical server actions: session completion, report generation, and PDF export (find via Grep for `export async function` in `src/app/`)

### Phase 6 — User context

- [ ] In the auth session provider (find via Grep for `useSession` or `createServerClient`), set `Sentry.setUser({ id, email })` on sign-in and `Sentry.setUser(null)` on sign-out
- [ ] Add partner/client context as a Sentry tag: `Sentry.setTag('portal', 'partner' | 'client' | 'admin')`

### Phase 7 — Env and docs

- [ ] Add `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` to `.env.example` with placeholder values
- [ ] Add note to `CLAUDE.md` or `docs/` that Sentry is no-op locally unless DSN is set

---

## Acceptance criteria

- Throwing an unhandled error in a page shows it captured in the Sentry dashboard
- Stack traces resolve to source file line numbers (not minified)
- Error boundaries render the existing error UI (not a blank page)
- No Sentry calls fire in local dev when `NEXT_PUBLIC_SENTRY_DSN` is absent
