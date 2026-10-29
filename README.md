## Local Development

Run the normal development server:

```bash
npm run dev
```

Open `http://localhost:3002`.

Normal development uses the existing hosted **Trajectas (Dev)** Supabase project:
`https://bgrvqvtlhmfmvcytncgw.supabase.co`. Docker is not required. Configure
client and server values for that project through authorized development-only
secret handling; do not copy the primary checkout's production `.env.local`.
Use synthetic data and preserve other tasks' fixtures. Never reset shared
hosted development.

## Validation and releases

Follow [the canonical release and recovery runbook](docs/runbook.md) for target
verification, ordered migrations, testing, acceptance and release decisions.
`node scripts/release/validate-local.mjs` runs ordinary checks in an isolated
environment-free worktree. CI provisions disposable local Supabase stacks for
full migration replay, integration and seeded browser tests. Those CI commands
are not a requirement to run Docker during normal development.

`npm run db:status` and `npm run db:push -- --dry-run` require an explicit
`TRAJECTAS_DEVELOPMENT_DATABASE_URL` and refuse production targets. Inspect
migration history before any apply; do not force bootstrap history or reset the
shared database. The authorized Supabase connector can apply reviewed migrations.

Green checks are evidence for review. Jason approves a release for an identified
commit; database changes and provider/security settings have their applicable
separate approval. Use verified development for synthetic write acceptance.
Production acceptance is bounded and read-only under the runbook.

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

## Environment and recovery evidence

The runbook owns the maintained provider, storage, auth/email, Preview mapping
and recovery requirements. Verify actual settings through permitted access;
source defaults do not establish current provider state. Report unavailable
or unrun checks explicitly. Do not submit a live assessment, send invitations,
change customer data or invoke side-effecting jobs as a production smoke test.
