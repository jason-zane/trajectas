# Security Best Practices Audit - 2026-04-24

Updated: 2026-04-27

## Scope

Reviewed the Next.js 16 app request surfaces, Server Actions, API routes, Supabase service-role usage, RLS/RPC migrations, token handling, upload handling, outbound integrations, CSP/rate-limit configuration, and dependency audit output.

This was a static and local verification audit. I read Vercel environment configuration, but did not overwrite deployment secrets. I did not write to production Supabase. Local Supabase was not available because Docker was not running, so the new migration was type/read reviewed but not executed against a local database.

## Fixes Applied

### F-001: Outbound webhook SSRF guard

Patched webhook destination validation and dispatch defense-in-depth.

- Creation/update now rejects embedded credentials, non-HTTPS public URLs, localhost, private networks, link-local addresses, and common cloud metadata hosts: `src/app/actions/integrations.ts:39`, `src/lib/integrations/url-security.ts:131`.
- Dispatch revalidates stored endpoint URLs immediately before `fetch`, so existing unsafe endpoints fail closed without making the outbound request: `src/lib/integrations/webhooks.ts:116`.
- Residual risk: DNS rebinding and public hostnames resolving to private IPs are not fully solved by string validation. Add DNS/IP resolution checks or route webhook egress through a constrained egress proxy for complete coverage.

### F-002: Brand asset upload content validation

Patched the public `brand-assets` upload route to validate file bytes instead of trusting `File.type`.

- PNG/JPEG magic bytes are checked, empty files are rejected, and JPEG extensions are canonicalized to `.jpg`: `src/lib/brand-assets/file-validation.ts:20`.
- Upload paths now use the validated extension and content type: `src/app/api/brand-assets/upload/route.ts:81`.

### F-003: Email template Server Action authorization

Patched email template read/write/test-send Server Actions so direct action calls require template-scope management rights.

- Platform templates require platform admin.
- Partner templates require partner management access.
- Client templates require client management access.
- Applies to list, get, upsert, and test-send actions: `src/app/actions/email-templates.ts:36`, `src/app/actions/email-templates.ts:76`, `src/app/actions/email-templates.ts:101`, `src/app/actions/email-templates.ts:136`, `src/app/actions/email-templates.ts:202`.

### F-004: Assessment runner RPC hardening

Added migration `supabase/migrations/20260424143500_harden_assessment_runner_rpc.sql`.

- Adds `SET search_path = public` to both `SECURITY DEFINER` runner RPCs.
- Validates the session token, in-progress status, assessment membership, item membership, and section membership before writes: `supabase/migrations/20260424143500_harden_assessment_runner_rpc.sql:5`, `supabase/migrations/20260424143500_harden_assessment_runner_rpc.sql:76`.
- Revokes direct execution from `PUBLIC`, `anon`, and `authenticated`; grants only `service_role`: `supabase/migrations/20260424143500_harden_assessment_runner_rpc.sql:128`.

### F-005: Removed weaker direct assessment write path

The legacy exported Server Actions for response save/progress now route through the same hardened RPCs instead of writing `participant_responses` / `participant_sessions` directly: `src/app/actions/assess.ts:646`, `src/app/actions/assess.ts:687`.

### F-006: API route body caps

All direct request body reads under `src/app/api` now go through the shared streaming byte-limit helper instead of relying only on `Content-Length`.

- Added reusable request/response text readers and optional JSON parsing with hard byte limits: `src/lib/security/request-body.ts:8`.
- Applied bounded reads to chat, generation start, report generation, report PDF queueing, assessment progress beacons, CSP reports, and the Supabase auth send-email hook.
- Bounded stored webhook response excerpts so a third-party webhook endpoint cannot force an unbounded response body read: `src/lib/integrations/webhooks.ts:136`.

### F-007: Deployment secret posture checked

Vercel already has dedicated production/preview/development values for:

- `REPORT_ACCESS_TOKEN_SECRET`
- `REPORT_PDF_TOKEN_SECRET`
- `INTEGRATIONS_API_SECRET_PEPPER`
- `INTEGRATIONS_CONFIG_ENCRYPTION_KEY`
- Upstash/KV rate-limit variables

No secret values were read or changed.

## Open Findings

### MEDIUM: Token signing code still allows broad-purpose fallback

Report and PDF token signing currently falls back from dedicated secrets to `TRAJECTAS_CONTEXT_SECRET` and then `INTERNAL_API_KEY`: `src/lib/reports/report-access-token.ts:10`, `src/lib/reports/pdf-token.ts:9`.

Impact: Vercel has dedicated secrets configured now, but the fallback path still means a missing env in a future environment could silently expand one broad internal secret into report link forgery.

Recommendation: remove fallback to `INTERNAL_API_KEY` and fail closed when dedicated report secrets are missing.

### MEDIUM: Rate limiting depends on deploy-time Redis configuration

The limiter falls back to per-process memory when Upstash/KV env vars are absent and falls open to memory on Redis errors: `src/lib/security/rate-limit.ts:25`, `src/lib/security/rate-limit.ts:232`.

Impact: Vercel has Upstash/KV configured, but fallback behavior still matters for staging, local previews, and Redis outages.

Recommendation: alert when the in-memory fallback is used. Consider fail-closed for cost-heavy AI/PDF routes.

### MEDIUM: Dependency audit has unresolved moderate advisories

`npm audit --json` reported 4 moderate vulnerabilities:

- `uuid <14.0.0` missing buffer bounds check.
- `@maily-to/core` affected through `uuid`.
- `resend` affected through `svix`/`uuid`.
- `svix` affected through `uuid`.

The suggested fixes include semver-major upgrades or downgrades, so I did not apply them automatically.

Recommendation: schedule dependency upgrade testing for `uuid`, `resend`, `svix`, and `@maily-to/core`; pin the safest compatible versions after release-note review.

### MEDIUM: Remaining `SECURITY DEFINER` functions need broader review

The assessment runner and factor mutation RPCs are now hardened in production, but historical migrations still define other `SECURITY DEFINER` functions.

Recommendation: in production, enumerate:

```sql
select n.nspname, p.proname, p.prosecdef, p.proconfig, p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prosecdef;
```

Then require `SET search_path`, internal authorization checks, and least-privilege `EXECUTE` grants for every exposed function.

## Resolved / Rechecked Findings

### Service-role boundary

`src/lib/supabase/admin.ts` now imports `server-only`, which makes accidental client-bound imports fail earlier.

### API mutation origin checks

`src/lib/security/request-origin.ts` no longer treats absent `Origin` as allowed by default. The proxy permits deliberate machine-authenticated exceptions and same-site Fetch Metadata, while cookie-authenticated mutations require an allowed origin or same-site signal.

### Integration and report security env documentation

`.env.example` contains the dedicated report and integration security variables, and Vercel has them configured.

### Supabase migration drift

Production and local migration history are now reconciled.

- Took a migration-history backup at `/tmp/trajectas_prod_schema_migrations_20260427.csv`.
- Kept production migration history as canonical and removed duplicate local migration versions.
- Repaired `20260418110000_campaign_favorites.sql` as applied after verifying the production table, indexes, RLS, and policy already matched.
- Applied `00079_seed_library_import_structuring_model.sql`, `20260422000000_revoke_unsafe_rpc_grants.sql`, and `20260424143500_harden_assessment_runner_rpc.sql` to production.
- Final `npm run db:status` shows local and remote aligned, and final `supabase db push --dry-run --include-all` reports the remote database is up to date.

Verified hardened production function grants/search paths for `delete_factor_cascade`, `upsert_factor_with_constructs`, `save_response_for_session`, and `update_session_progress_for_session`: each has `search_path=public` and `EXECUTE` only for `postgres` and `service_role`.

## Positive Observations

- Admin, client, and partner layouts gate protected surfaces through workspace bootstrap.
- Most Server Actions already use central authorization helpers before service-role reads/mutations.
- Report HTML rendering uses a sanitizer before `dangerouslySetInnerHTML` in the report block pipeline.
- CSP uses nonce plus `strict-dynamic` for scripts, and protected surfaces are no-store/noindex by default.
- Integration API credentials are HMAC-hashed and compared with `timingSafeEqual`.

## Verification

Passed:

```sh
npm run typecheck
npm run lint
npx vitest run tests/unit/request-body.test.ts tests/unit/request-origin.test.ts tests/unit/integration-request.test.ts tests/unit/webhook-url-security.test.ts tests/unit/brand-asset-validation.test.ts tests/integration/assess-progress-api.test.ts tests/integration/email-template-actions.test.ts
npm run build
```

Also ran:

```sh
npm audit --json
npx vercel env ls production --format json --no-color --non-interactive
npm run db:status
supabase migration repair 20260418110000 --status applied --db-url <production>
supabase db push --db-url <production> --include-all --yes
supabase db push --db-url <production> --dry-run --include-all
```

Not run:

```sh
npm run test:integration:local
```

Reason: Docker/local Supabase was unavailable in this environment, and `.env.local` points at production.
