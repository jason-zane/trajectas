# Trajectas Runbook

Operational reference for deployment, rollback, observability, and recovery. This is the document to reach for when something is on fire. Keep it short and current — if a section starts feeling out of date, fix it the same day you notice.

For the day-to-day workflow (branching, migrations, PR flow), see `AGENTS.md`. This document is what you need when AGENTS.md isn't enough.

## Production stack at a glance

| Layer | Service | Identifier |
|---|---|---|
| Hosting | Vercel | project linked to `github.com/jason-zane/trajectas` |
| Database / Auth | Supabase | project `rwpfwfcaxoevnvtkdmkx` (org `Leadership Quarter`), region `ap-southeast-1` (Singapore) |
| Region (Vercel) | Singapore | `sin1` (see `vercel.json`) |
| Email | Resend | `EMAIL_FROM=Trajectas <noreply@mail.trajectas.com>` |
| LLM router | OpenRouter | via `OpenRouter_API_KEY` |
| Bot protection | Vercel BotID | wired in `next.config.ts` |
| Error tracking | Sentry | client + server + edge (see Sentry section) |
| Rate limiting | Upstash Redis | `@upstash/ratelimit`, see `src/lib/` |

## Deploying

The default path: open a PR, let CI go green, merge to `main`. Vercel deploys `main` to production automatically. Branch protection on `main` requires all three CI jobs (`security`, `quality`, `e2e-smoke`) to pass — see `.github/workflows/ci.yml`.

To deploy a fix urgently:

1. Branch from the latest `main` (`git checkout main && git pull --ff-only && git checkout -b fix/...`)
2. Make the change. Keep the diff small.
3. If the fix touches the DB, write the migration and apply it to live via the Supabase MCP **before** opening the PR (see "Database migrations" in `AGENTS.md`).
4. Open the PR. CI must be green before merge.
5. Merge with `gh pr merge --squash --delete-branch`.

There is no separate staging environment yet — Vercel Preview deployments are the closest thing. Test against a Preview URL before promoting.

## Rolling back

Two options, fastest first:

1. **Vercel instant rollback** — Vercel Dashboard → Deployments → find the last known-good production deployment → **Promote to Production**. This is the fastest path and does not touch git. Use this when the code is the problem.

2. **Git revert** — when you want the history to reflect the rollback:

   ```sh
   git checkout main && git pull --ff-only
   git revert <bad-commit-sha>
   git push                       # triggers a new prod deploy
   ```

If the rollback is required because of a database migration, instant Vercel rollback alone is not enough — the schema is still in the new state. See "Migration rollback" below.

## Database migrations

The flow lives in `AGENTS.md` ("Migration & deploy flow"). The short version:

- Apply locally with `supabase db push` (or `supabase db reset` if you can wipe local data)
- Run `npm run test:integration:local` to confirm
- Apply to live via the Supabase MCP (`apply_migration`) BEFORE opening the PR — Vercel previews will exercise the new code against the new schema
- Run `mcp__claude_ai_Supabase__get_advisors` after every DDL change
- Commit the migration file so source matches live

### Migration rollback

There is no automatic rollback. If a migration is bad:

1. Stop merging the offending PR — close it.
2. Write a forward-fix migration that undoes the change (drop the column, recreate the constraint, etc.).
3. Apply the forward-fix via the MCP and merge it as a new PR.

Never edit a migration that has already been applied to live, even if it has not been merged to `main`. Always write a new follow-up.

### Backups

The Supabase organisation is currently on the **free** plan, which means:

- No guaranteed automated daily backups
- No PITR (point-in-time recovery)
- Auto-pause on inactivity is possible

**Upgrade to Pro before commercial launch.** Until then, take manual `pg_dump` snapshots ahead of any risky migration:

```sh
# Replace HOST/PASSWORD with values from the Supabase dashboard Connection page
pg_dump 'postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres' \
  --schema=public --no-owner --no-privileges \
  > backups/manual-$(date +%Y%m%d-%H%M%S).sql
```

Store these somewhere outside the platform — your local machine + cloud storage.

## Observability

### Sentry

Client + server + edge wired via `sentry.{client,server,edge}.config.ts` and `next.config.ts` (`withSentryConfig`). The SDK no-ops when DSN env vars are absent — local dev is unaffected unless you opt in.

Required env vars for live capture (all set in Vercel project env):

- `NEXT_PUBLIC_SENTRY_DSN` (Preview + Production)
- `SENTRY_DSN` (Preview + Production)
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (build-time, for source maps)

To verify: trigger a deliberate server error, watch it land in the Sentry project within ~30s. Source-map upload runs at Vercel build time; check the build log for "Successfully uploaded source maps".

### Vercel logs

`vercel logs <deployment-url> --follow` for the live tail of a specific deployment. For runtime errors of the production deployment, the Vercel Dashboard → project → Logs view is easier.

### Supabase logs

The Supabase MCP exposes `mcp__claude_ai_Supabase__get_logs` for the live project, plus `get_advisors` (security + performance lint). Run advisors after every DDL change.

### Local TEMP error log

`src/instrumentation.ts` also writes server render/action errors to a local file via `instrumentation-node.ts`. This is a **temporary** capture for the digest-671018856 crash — remove once that's resolved. Sentry is the long-term answer.

## Incident response

When users report a critical issue (data loss, auth broken, RLS leak, mass error rate):

1. **Acknowledge** — confirm the report internally (within 5 minutes during business hours).
2. **Triage severity:**
   - **Sev 1** — data exposure, broken auth, broken assessment runner. Drop everything else.
   - **Sev 2** — degraded feature, broken integration, slowness. Fix today.
   - **Sev 3** — UI papercut, single-customer issue. Fix this week.
3. **Stabilise first, debug second.** If a recent deploy is the suspect: instant rollback in Vercel BEFORE writing the post-mortem.
4. **Capture evidence** before fixing — Sentry event link, Vercel deployment ID, screenshots, repro steps. Without these the post-mortem is guesswork.
5. **Communicate** if customers were affected:
   - Sev 1 — proactive email to affected users within 24 hours, regardless of whether they noticed
   - Sev 2/3 — respond to the original reporter when fixed
6. **Write the post-mortem** within a week. Even one paragraph is useful. Save in `docs/incidents/YYYY-MM-DD-<slug>.md`. Cover: what happened, what we did, what we'll change to prevent recurrence.

### Australian Privacy Act — Notifiable Data Breaches

If an incident exposes personal information (psychometric profiles count) **and** a reasonable person would conclude there is a likely risk of serious harm, the Notifiable Data Breaches scheme applies. The clock starts when you become aware of suspected breach. Get external advice — do not self-diagnose this.

OAIC notification form: https://www.oaic.gov.au/privacy/notifiable-data-breaches/report-a-data-breach

## Critical configuration — write this down outside the platform

If your Vercel and Supabase accounts disappeared tomorrow, you would need:

- The DNS records currently pointing at Vercel (export from your registrar)
- The list of Vercel env vars (`vercel env pull`, then store the file securely — NOT in git)
- The Supabase project's API URL and anon key (recoverable from the dashboard, but log them)
- The Supabase database schema (it's in `supabase/migrations/` already — that's the source of truth)
- The Supabase storage bucket names and policies
- Resend API key and verified sending domain config
- Upstash Redis URL + token
- OpenRouter, Anthropic, OpenAI API keys

Pull all of these into a password-manager record labelled "Trajectas — recovery secrets" and review it quarterly.

## Useful commands

```sh
# Watch CI on a PR
gh pr checks <pr-number> --watch

# Inspect a Vercel deployment
vercel inspect <deployment-url>

# Tail production logs
vercel logs https://trajectas.com --follow

# Drop into a remote Postgres via the connection pooler
psql 'postgresql://postgres.rwpfwfcaxoevnvtkdmkx:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

# Run integration tests against the LOCAL Supabase stack (never prod)
npm run test:integration:local
```

## Things this runbook deliberately doesn't cover

- Onboarding new customers — that lives in the business ops playbook (TODO)
- Billing — no Stripe yet
- Oncall rotation — solo founder for now
- Multi-region failover — not relevant until enterprise customers contractually require it
