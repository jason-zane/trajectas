# Infrastructure Evaluation: Adding a Render Backend

**Date:** 2026-04-10
**Status:** Parked — no action needed yet, revisit when pain points emerge
**Context:** Evaluated whether adding Render alongside Vercel + Supabase makes sense for Trajectas

---

## Current Stack

| Layer | Service | Notes |
|-------|---------|-------|
| Frontend + API | **Vercel** | Single Next.js 16 app, full-stack |
| Database + Auth + Storage | **Supabase** | Postgres, Auth, Storage (PDF uploads) |
| AI inference | **OpenRouter** | Item generation, critique, embeddings, narrative enhancement |

The app is a monolithic Next.js deployment: 26 route handlers, 75+ `use server` files, 310+ `createAdminClient()` call sites. There is no existing backend split, Docker config, or worker infrastructure.

---

## Workloads That Could Outgrow Vercel

### 1. PDF Report Generation (HIGH priority to watch)

**Files:** `src/app/api/reports/[snapshotId]/pdf/route.ts`, `src/lib/reports/pdf-browser.ts`

- Launches headless Chromium via `puppeteer-core` + `@sparticuz/chromium`
- Navigates to an internal print-format URL, waits for fonts, renders A4 PDF
- Uploads result to Supabase Storage (25MB limit)
- **Resource profile:** 500MB–1GB memory, 15–30s per report, 60s Vercel timeout
- **Scaling concern:** Chromium cold starts on serverless are inherently fragile. Generating multiple PDFs concurrently (e.g. batch of 10 after a campaign closes) would likely hit memory limits or timeouts on Vercel. Each invocation spins up its own browser instance.
- **Current status:** Not heavily tested yet. Needs real-world validation under load.

### 2. AI Item Generation Pipeline (MEDIUM priority)

**Files:** `src/lib/ai/generation/pipeline.ts`, `src/app/api/generation/start/route.ts`

- Multi-step pipeline: batch LLM generation, critique loops, embeddings, EGA network analysis, bootstrap stability
- 50–100+ LLM calls per medium job (5 constructs x 10 items), hundreds of embedding calls
- OpenRouter timeout: 120s per request
- **Resource profile:** 300–800MB memory, 5–15+ minutes total
- **Scaling concern:** Exceeds Vercel's 300s (5 min) function timeout for larger jobs. Currently appears to work — unclear whether it's completing within limits or benefiting from some execution grace period. Needs investigation.
- **Current status:** Working in practice, but duration is a known unknown.

### 3. Webhook Dispatch (LOW priority)

**Files:** `src/lib/integrations/webhooks.ts`, `src/app/api/internal/v1/webhooks/dispatch/`

- Polls outbox table, claims pending events, delivers with HMAC signing
- 10s timeout per delivery, max 5 retries with 5-min backoff
- **Scaling concern:** No built-in scheduler — requires external trigger. Network-bound, not compute-bound.
- **Current status:** Functional but needs a cron trigger.

### 4. Report Snapshot Generation (LOW priority)

**Files:** `src/app/api/reports/generate/route.ts`, `src/lib/reports/runner.ts`

- 6-step pipeline: fetch data, condition blocks, band resolution, derived narratives, optional AI enhancement, DB write
- Fire-and-forget from `submitSession()` in `src/app/actions/assess.ts`
- **Resource profile:** 200–400MB, 5–30s depending on AI enhancement
- **Scaling concern:** Manageable within Vercel limits. AI enhancement adds time but is optional and fails gracefully.

### 5. In-Memory Rate Limiting (MINOR)

**File:** `src/lib/security/rate-limit.ts`

- Sliding window stored in a `Map` on `globalThis`, capped at 2048 keys
- Resets on every deployment
- **Concern:** Not persistent. Fine for now, would need Redis (e.g. Upstash) if rate limiting needs to be durable.

---

## Options Evaluated

### Option A: Keep everything on Vercel (current state)
- **Pros:** Simple, no new infrastructure, well-integrated with Next.js
- **Cons:** Chromium PDF is fragile at scale, AI pipeline may timeout, no built-in job queue
- **Verdict:** Fine for now. Monitor the two high-risk workloads.

### Option B: Add Render worker tier for heavy jobs
- **Scope:** Extract PDF generation and AI pipeline into Render background workers. Keep everything else on Vercel.
- **Pros:** Solves the two biggest pain points (Chromium + long AI jobs). Render workers have no timeout ceiling and can pre-warm Chromium.
- **Cons:** Second platform to manage. Need a communication channel (webhook callback or polling) between Vercel app and Render workers.
- **Effort:** ~2–3 days to prove PDF worker, 1–2 weeks to harden both workers.
- **Verdict:** Best option if/when PDF generation or AI pipeline starts failing.

### Option C: Move entire Next.js app to Render
- **Scope:** Migrate off Vercel entirely. Run `next start` on Render web service.
- **Pros:** Single platform, no timeout issues, full control over runtime.
- **Cons:** Lose Vercel edge network, preview deploys, automatic optimisations. Need to manage custom domains, SSL, CDN separately. The multi-surface host routing (`proxy.ts`) adds complexity.
- **Effort:** Medium — mostly config/env/domain work plus soak testing.
- **Verdict:** Only makes sense if Vercel becomes a bottleneck across many workloads, not just two.

### Option D: Vercel frontend + Render backend API split
- **Scope:** Extract server actions and route handlers into a separate Render API service.
- **Pros:** Clean separation of concerns in theory.
- **Cons:** Massive refactor (75+ `use server` files, 310+ Supabase calls). Render private services are only reachable from other Render services, so the API would need to be public and separately authenticated. Weeks of work for no user-facing benefit.
- **Verdict:** Not recommended. The app is deeply integrated as a full-stack Next.js monolith.

### Option E: Managed job queue (Inngest, Trigger.dev)
- **Scope:** Add a managed queue service that deploys alongside the Vercel app.
- **Pros:** No second platform to manage. Native retry/timeout/scheduling. Integrates with Vercel.
- **Cons:** Another SaaS dependency. May still not solve Chromium memory issues (still runs in Vercel functions).
- **Verdict:** Good for orchestration (webhook dispatch, retry logic) but doesn't solve the Chromium problem.

### Option F: Supabase-native solutions
- **Scope:** Use `pg_cron` for scheduled tasks, Edge Functions for lightweight workers.
- **Pros:** No new platform — already have Supabase.
- **Cons:** Edge Functions have their own size/duration limits. Can't run Chromium.
- **Verdict:** Good for webhook dispatch scheduling. Not suitable for PDF or AI workloads.

---

## Decision Framework

```
Is PDF generation failing or unreliable?
├── No  → Stay on Vercel (Option A). Revisit quarterly.
├── Yes → Is it just PDF, or are AI jobs also timing out?
│   ├── Just PDF     → Add a single Render worker for PDF (Option B, minimal scope)
│   └── Both failing → Add Render workers for PDF + AI pipeline (Option B, full scope)
│
Is webhook dispatch needed on a schedule?
├── Yes → Add Vercel cron job or Supabase pg_cron (Option F). No Render needed.
│
Is rate limiting causing issues across deploys?
├── Yes → Add Upstash Redis. No Render needed.
```

---

## Supabase Region Note

Render's regions: Oregon, Ohio, Virginia, Frankfurt, Singapore. If the Supabase project is in a region Render doesn't serve (e.g. Sydney), co-location isn't possible, which could negate latency benefits for DB-heavy workers. Check this before committing to Render.

---

## Concrete Next Steps (when ready)

1. **Test PDF generation under load** — try generating 5–10 PDFs concurrently from a completed campaign. Note failures, timeouts, and memory errors in Vercel logs.
2. **Instrument AI pipeline duration** — add timing logs to `pipeline.ts` to understand actual execution time per job. Determine whether it's completing within 300s or silently exceeding it.
3. **Set up webhook dispatch cron** — a Vercel cron job hitting `/api/internal/v1/webhooks/dispatch/` every 1–5 minutes. No new platform needed.
4. **If PDF fails under load** — prototype a Render background worker:
   - Receives snapshot ID via HTTP or queue
   - Runs Chromium with pre-warmed browser pool
   - Uploads PDF to Supabase Storage
   - Calls back to the app with the result URL

---

## References

- Next.js self-hosting: https://nextjs.org/docs/app/guides/self-hosting
- Render workers: https://render.com/docs/background-workers
- Render Puppeteer guide: https://render.com/docs/deploy-puppeteer-node
- Render regions: https://render.com/docs/regions
- Vercel function limits: https://vercel.com/docs/functions/configuring-functions
- Vercel cron: https://vercel.com/docs/cron-jobs
