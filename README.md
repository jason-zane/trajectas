## Local Development

Run the normal development server:

```bash
npm run dev
```

Open `http://localhost:3002`.

## Safe-To-Deploy Workflow

Keep this simple. Before shipping changes:

1. Run `npm run lint`
2. Run `npm run typecheck`
3. Run `npm run test:coverage`
4. Run `npm run build`
5. Run `npm run test:e2e:smoke`
6. Run the seeded full-stack check when you changed auth, campaigns, participants, reports/PDFs, or runner flows:

```bash
npm run db:test:start
npm run db:test:reset
npm run test:e2e:seeded
npm run db:test:stop
```

Do not lower lint/test thresholds or skip jobs to get green. Fix the code or the stale tests.

## Launch Env Checklist

These variables are required on day one:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `PUBLIC_APP_URL`
- `ADMIN_APP_URL`
- `ASSESS_APP_URL`
- `PARTNER_APP_URL`
- `CLIENT_APP_URL`
- `COOKIE_DOMAIN`
- `NEXT_PUBLIC_COOKIE_DOMAIN`
- `SERVER_ACTION_ALLOWED_ORIGINS`
- `TRAJECTAS_CONTEXT_SECRET`
- `INTERNAL_API_KEY`
- `REPORT_PDF_TOKEN_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SUPABASE_AUTH_HOOK_SECRET`
- `OpenRouter_API_KEY` for real OpenRouter-backed generation
- `OPENROUTER_MANAGEMENT_KEY` if OpenRouter management/credits UI remains enabled

Notes:

- `REPORT_PDF_TOKEN_SECRET` is new and should be generated fresh for each deployed environment.
- Keep the current env names and casing exactly as shown above. Do not rename `OpenRouter_API_KEY` before launch.
- Keep `INTERNAL_INTEGRATIONS_API_ENABLED=false` unless integrations are explicitly part of the launch scope and separately verified.

## Pre-Deploy Manual Steps

1. In the Supabase dashboard, manually set the existing `reports` storage bucket to private before launch. The code now creates new buckets as private, but that does not change an already-created production bucket.
2. Confirm the preview or production environment has `REPORT_PDF_TOKEN_SECRET` set and that report/PDF access still works through the tokenized flow.
3. If you changed campaign readiness logic, make sure any seeded campaign fixtures used in E2E still satisfy activation/readiness requirements.

## What GitHub Checks

GitHub blocks changes automatically if any of these fail:

- dependency vulnerability audit
- committed secret scan
- lint
- typecheck
- unit, integration, and component tests
- production build
- browser smoke tests

That means the simplest rule is:

- if GitHub is green and your local checks are green, it is safe to deploy

## After Deploy

Do one manual production smoke on every launch:

1. open the public site and `/surface-coming-soon`
2. open admin dashboard, campaigns, participants, and reports
3. open one live assessment link and complete the core runner flow
4. verify one report PDF download/render path
5. verify one participant invite send path through Resend
6. verify one auth email path through the Supabase `send_email` hook
7. confirm partner and client surfaces load on their intended hosts or routed paths with no auth or loading errors
