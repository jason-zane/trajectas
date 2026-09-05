# Trajectas operations

## Production

- GitHub: `jason-zane/trajectas`; Vercel project `trajectas`, production branch `main`, region `sin1`.
- Supabase: `rwpfwfcaxoevnvtkdmkx`, organisation **Trajectas Intelligence**, Singapore.
- Authentication: email OTP. Resend delivers sign-in and participant mail.
- Distributed rate limits: Upstash through Vercel KV. Both `KV_REST_API_URL` / `KV_REST_API_TOKEN` and `UPSTASH_REDIS_REST_*` names are supported.
- Reports: database-backed generation and PDF queues; optional OpenRouter narratives with deterministic fallback; private report storage.
- Billing: Stripe and the monthly usage cron are implemented.

## Shipping and rollback

Create an isolated worktree with `scripts/agent-worktree.sh <branch>`. Do not switch or modify the founder's primary checkout. Follow `AGENTS.md`: validate locally, apply compatible migrations through Supabase MCP, run advisors, open a PR, wait for green CI, then squash merge. Verify production is READY at the merged commit.

Preview deployments can use production credentials. Never run destructive tests or load tests against a preview without verifying its database is isolated. The primary checkout's `.env.local` points at production.

Token-column permissions require two releases: deploy the explicit safe-column application queries first; then apply `protect_participant_bearer_tokens` and ship its migration in a follow-up PR. Reversing this order makes old `SELECT *` clients fail closed. Staff roster reads exclude participant bearer tokens. Authorized campaign managers can share links for standard campaigns through the gated application path.

For application regressions, roll back to a compatible Vercel deployment. After token-column protection, do not roll back to a build using participant `SELECT *`; use a forward application fix. Keep permission restrictions in force. For database regressions, write a new forward migration; never rewrite an applied migration or restore unsafe policies.

## Local verification

```sh
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run test:architecture
npm run test:integration:local
npm run build
npm run test:e2e:seeded
```

Integration tests require local Supabase and enforce a local-host guard. The local wrapper supports specific files. `tests/integration/assessment-capacity.test.ts` exercises a 100-participant burst through the real application handler and local database. This does not establish hosted throughput, Chromium capacity, or a 1,000-participant guarantee. Repeat representative load checks after changing compute, assessment size, or queue limits.

## Queues and recovery

| Job | UTC schedule | Behaviour |
|---|---|---|
| Account deletion | Daily 17:00 | Executes deletions after the grace period. |
| Assessment reminders | Every 5 minutes | Sends due resume reminders. |
| Assessment timing | Every 5 minutes | Advances expired timed work. |
| Report generation | Every 5 minutes | Drains pending snapshots and recovers abandoned work. |
| Report PDFs | Every minute | Drains durable PDF jobs with bounded concurrency and retries. |
| Usage billing | 02:00 on day 1 monthly | Creates usage billing records. |

`vercel.json` is the schedule source of truth. Every cron requires `CRON_SECRET`. Do not trigger deletion, reminder, or billing jobs merely to test authentication.

The database atomically limits report generation to six active jobs and PDFs to two across instances. PDF attempts and claim tokens are durable; a stale worker cannot publish over a newer attempt. Abandoned leases are recovered after 15 minutes. PDF retries are bounded to three attempts. Diagnose stored errors before manually retrying exhausted jobs. Increase concurrency only after measuring database latency and Chromium memory.

Each report has a cumulative 60-second budget for optional AI prose; individual calls are capped at 15 seconds with at most two attempts. Exhausted budgets use deterministic prose. PDF rendering runs separately from report generation.

## Monitoring

`GET /api/health` returns coarse status and disables caching. A 503 indicates an unavailable database or Redis, missing email/cron configuration, failed queue queries, or report/PDF work stranded over 15 minutes. Network probes have three-second timeouts. Empty queues do not prove cron delivery; inspect Vercel invocation history when diagnosing scheduling.

Server errors are recorded in `error_events` and Vercel logs. Existing operational alerts use `OPS_ALERT_EMAIL` and `RESEND_API_KEY`; throttling is per process. Diagnostic capture redacts participant links, token parameters, cookies, authorization headers, and secret fields. Never paste bearer links or environment values into incident reports.

Use the platform observability screen, Vercel logs, and Supabase logs/advisors. Sentry is not configured in this codebase; do not assume it is receiving events.

## Backups and recovery ownership

At the readiness configuration check, Supabase was on Free without included automatic database backups. Jason is handling the Pro upgrade himself; this change does not purchase paid services. Before commercial launch, confirm the upgrade and actual backup availability in the dashboard, and rehearse a restore into an isolated project. A plan change alone does not demonstrate recovery.

Keep recovery credentials in the password manager, not git: account ownership, database connections, DNS, Redis, Resend, report-signing and workspace-context keys, OpenRouter, and Stripe. Database backups do not by themselves preserve storage objects or external service configuration. Verify a separate private-report-storage recovery procedure.

## Incidents

For exposure, broken access controls, assessment data loss, or widespread failures: preserve a minimal redacted reproduction, identify the deployed commit, contain the failing operation, and deploy a tested fix. Involve the responsible business owner and appropriate external advice for suspected privacy incidents. Record impact, recovery, and regression coverage in `docs/incidents/` without participant data or secrets.
