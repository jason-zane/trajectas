# Trajectas release and recovery runbook

This is the canonical release policy. `AGENTS.md`, the PR evidence template and
`release-preflight` point here; executable checks live in `scripts/release/` and
`.github/workflows/`. Keep release evidence with its PR and exact commit SHA.
This process reduces mistakes; it does not promise risk-free releases.

## What is implemented, and what remains unknown

Repository baseline reconciled on 2026-10-06: main `5724f87c` (includes PR424,
patched Sharp PR427, outstanding-invitation PR428 and performance PR426).
These are source facts, not proof of current provider settings:

| Item | Evidence / status |
| --- | --- |
| Existing CI | `security`, then `quality` and `integration`; smoke follows quality. Integration uses local Supabase; database-touching tests skip in ordinary coverage without a stack. |
| Added CI orchestration | `release-gate` requires successful scope, security, quality, integration and smoke results. Seeded E2E is required for every diff except known docs/skill metadata paths. Failure, cancellation, missing/unknown results and unexpected skips fail the gate. |
| Enforcement still pending | The last permitted main-check summary listed only `security`, `quality`, `e2e-smoke` as required. Full protection read was denied; current rules are unverified. Adding `release-gate` as required needs separate owner approval and permitted settings access. Until then, this gate is evidence, not a newly enforced merge protection. |
| Seeded E2E coverage | Existing campaign states, participant entry/completion routing, partner portal and editor-save journeys. It does **not** prove completing a fresh assessment, generating its report/PDF, or restoring it. Those need explicit synthetic acceptance evidence. |
| Production target | Last permitted read identified Supabase `rwpfwfcaxoevnvtkdmkx` / main as `ACTIVE_HEALTHY`; its migration metadata was stale. Health and history do not establish schema parity, backups or recovery. |
| Hosting source | `vercel.json` requests `sin1` and defines cron schedules. GitHub records successful Production deployments of merged main commits `f4f0f179` and `701a111b`; normal main merge must therefore be treated as a production release. Provider-specific READY, configuration, rollback availability, plan and actual region remain unverified. |
| Hosted staging / recovery | Jason confirmed no Preview Supabase exists and approved the interim workflow below. Isolated hosted staging and recovery rehearsal remain future setup decisions; they are not blanket prerequisites for migration-free releases. Historic Free/Pro statements are not current billing evidence. |
| Access blocks | Vercel project/environment/deployment detail reads and full GitHub protection reads returned 403 in the prior audit. Do not inspect those through browser/CLI alternatives. Request narrowly scoped read access or owner-provided redacted evidence. |

This repository change does not provision services or credentials, apply a
migration, or change account settings, branch rules or deployment policy.
Merging uses the existing deployment path. Journal is a separate project.

## Current approved interim workflow

Until a separately approved isolated hosted target exists, use synthetic local
and disposable CI stacks for automated writes, migration replay and browser
journeys. Jason approved bounded read-only production acceptance and normal
reviewed releases after applicable exact-head checks. Production is not a test
fixture: never seed it, send/reissue/revoke invitations, submit assessments,
change customer settings or invoke side-effecting jobs to obtain acceptance.
Record unrun acceptance and unavailable provider evidence explicitly for the
owner's release decision; do not label them passed. Provider denials remain
blocked and must not be retried through another tool, account or interface.

Missing hosted isolation alone does not block a migration-free release under
this interim workflow. Database, scoring and billing changes still require the
ordered compatibility, target/schema and recovery evidence below; a green
disposable-stack replay is not production schema or recovery verification.
Creating staging, changing credentials/provider settings and activating new
branch protections are separate owner decisions, not effects of this PR.

## Normal change: branch → local/CI → acceptance → review → release

1. Inspect status; use `scripts/agent-worktree.sh <branch>` from a permitted
   checkout, or an isolated checkout/worktree in the task workspace. Start from
   current remote main. Preserve concurrent branches and unrelated files.
2. Make a small focused change. Install locked dependencies in that worktree.
   Do not copy `.env.local` from the primary checkout: historically it targets
   production. Use `npm run release:validate` for ordinary local evidence. The
   runner refuses env files and known inherited application/provider variables,
   passes only system paths/directories and locale to child checks (excluding
   unknown variables, Node options and inherited npm configuration), then
   runs release-logic tests, lint, typecheck, unit, component, architecture,
   build and local smoke checks, stopping on the first failure. Playwright's
   Chromium installation is a prerequisite; it does not install browsers.
3. For database work, replay migrations and run
   `npm run test:integration:local` on an **isolated local synthetic stack**.
   Before starting/resetting, confirm the local project, ports and containers
   belong to this task. The default `trajectas-local` stack/ports can be shared
   with another session; do not reset it under that session. Use the existing
   CLI's `--help` to plan isolation rather than guessing flags. Never run
   `test:integration` directly using production env. Seeded E2E likewise needs
   that local stack and local env; do not set `PLAYWRIGHT_BASE_URL` to production
   or an unverified Preview. Keep existing local-host guards when adding tests.
   CI provisions disposable local stacks for both.
4. Open a PR and fill its evidence template. Under the interim workflow,
   synthetic acceptance runs only on verified local/disposable CI targets.
   An unverified Preview must not be used for authenticated write tests.
   Where authorized, inspect existing production views through bounded read-only
   acceptance, preserving customer data and normal role/tenant boundaries.
   Record unavailable or unrun live checks and their limits; absent Preview
   infrastructure is not by itself a migration-free release blocker. For
   docs/CI-only changes, explain hosted acceptance N/A and verify automation.
   Once isolated hosted staging is approved and verified, use that target for
   synthetic Preview acceptance as described in the future setup checklist.
5. Review the diff and findings; resolve review conversations. After the last
   edit/rebase, require CI for the **final SHA**. Do not reuse earlier green runs.
   `release-gate` has no workflow path filter and runs with `always()` even if
   dependencies fail or skip. `change-scope` reads the complete base/head git
   diff, including both sides of renames/deletions; unknown paths run seeded
   E2E. Only `docs/**`, `.agents/skills/**` and listed top-level instruction/PR
   metadata files may intentionally skip it. Integration always runs. Manual
   or weekly seeded runs do not substitute for a PR's final-commit evidence.
6. Present the evidence and unresolved blockers. Jason explicitly decides
   release for a named SHA, including remaining risks. PR approval alone does
   not authorize production migrations or paid/security settings changes.
   Treat normal main merge as production deployment based on the observed
   GitHub Production records. Record exact merged SHA, environment and deployment
   outcome through permitted evidence; do not claim that these records verify
   provider-specific settings or rollback availability. Changes to deployment
   policy need separate approval and permitted settings access.
7. With applicable approval, merge through the normal reviewed PR path and
   verify the resulting deployed commit and Production environment through
   permitted GitHub deployment records, plus bounded read-only health/acceptance
   where available. Record provider-specific READY/rollback and unavailable
   live checks as unverified; never substitute synthetic CI for live acceptance.
   Inspect redacted queue/errors and
   real cron invocation evidence where relevant. Record results and owner;
   contain or recover if verification fails. Never invoke billing/deletion/
   reminder jobs on live data simply to test that a route responds.

A green `security` job can contain a dependency-audit-unavailable warning under
existing retry behavior. Record that limitation and require an owner decision;
do not describe an unavailable audit as verified or relax checks. See
[docs/ci-npm-audit.md](ci-npm-audit.md). This workflow change does not change that
existing audit behavior or repair unrelated application/security issues.

## Database, scoring and billing changes

Before a release decision, supply the migration ID/hash, exact target, current
schema evidence, compatibility matrix and tested recovery path. Replay from an
empty local stack proves replayability, not parity with production; see
[the historical drift audit](schema-drift-audit-2026-08-16.md). Never edit or rename
an applied migration to imply the live database changed.

- Preserve frozen delivered forms and stored report snapshots. Test old forms
  and stored snapshots against the new app/scoring behavior using synthetic
  equivalents. New scoring versions must not silently recompute delivered
  evidence. Billing evidence includes test-mode invoices/webhooks, duplicate
  delivery/idempotency and expected amounts; it must not charge a live customer.
- On an isolated synthetic local/CI target (or separately approved staging),
  demonstrate a fresh assessment → submission → scoring
  → stored report snapshot → downloadable PDF, plus relevant retry behavior.
  Existing seeded E2E is partial evidence, so record the missing steps explicitly
  until this full journey is automated. Run the Python outcome tests when
  changing the numerical worker (`python -m unittest discover -s tests/outcomes -v`).
- Prefer expand → compatible app → verify → later contract. Show current app
  with expanded schema, new app with expanded schema, and the rollback app with
  the schema that will remain. Replay reviewed migrations on an isolated local/CI
  target before a PR, and on hosted staging if such a target is approved and
  available; **never require a production migration just to open one**. Missing
  staging does not remove production schema, compatibility or recovery checks.
- At production action time, obtain explicit approval for the exact migration,
  target, order and side effects. If a compatible additive migration must precede
  the app, apply and verify it only at this approved release stage. If app changes
  must precede a database change, release and verify that compatible app first.
  Contract/destructive changes belong in a later approved release after all
  readers/workers are compatible. Do not race an automatic main deploy with a
  migration; control the rollout order with the owner/provider setup first.
- Record backfill scope, duration/locking assumptions, retries, checks and stop
  conditions. No implicit production data repair, advisors or schema writes are
  authorized by this guide. Any live read must be permitted; unavailable schema
  evidence remains a blocker, not an invitation to bypass access restrictions.

## Future hosted staging setup checklist (separate owner decisions)

This is a recommended future setup, not an installed prerequisite for the
approved interim migration-free workflow. Complete in order after owner
decisions, recording resource IDs, scope, date and evidence; never record values.
Each settings mutation needs applicable approval at action time.

- [ ] Obtain permitted read evidence of Vercel's linked repository, project,
  production branch/deploy policy, variable **names and target scopes**, Preview
  overrides, and Supabase project/branch mapping. Full GitHub rules are also
  needed to confirm effective required checks and review policy. Prior 403 reads
  remain blocked until access is explicitly resolved.
  GitHub's fine-grained protection-read API requires repository
  [Administration: read](https://docs.github.com/en/rest/branches/branch-protection#get-branch-protection).
  Request only owner-approved read access or redacted evidence; the precise
  cause of the prior 403 is unverified. Vercel access must permit project config,
  deployment metadata and variable names/target scopes for this project, without
  retrieving secret values. Settings-write access is a later separate decision.
- [ ] Owner chooses staging isolation: a data-less branch if available, or a
  separate non-production Supabase project. Confirm plan eligibility, region,
  compute/storage/egress/branch/backup costs and monthly ceiling before creation.
  Prefer a manually managed isolated target while release ordering is unverified.
  Any GitHub/Supabase integration must disclose whether merging main deploys
  schema/Edge Functions automatically; do not enable it as a hidden side effect.
  No AWS move or new paid service has been selected.
- [ ] Review migration replay and fixture contents before loading the new target.
  Use schema plus synthetic seeds, no production rows, auth users or Storage
  objects. Do not use a branch's "include data" option. Verify distinct target
  ID/URL and document collision/reset rules for parallel Preview branches.
  A shared staging DB requires serialized migration/acceptance windows; per-PR
  targets avoid incompatible branch schemas and need their own cost decision.
- [ ] Configure Preview/Development variables from the matrix below, with
  separate credentials and signing material kept in the secret manager. Record
  who sets values and which build must be redeployed. Do not blindly select
  "All environments" or pull production values into local development.
- [ ] Configure the selected Supabase target's own OTP site/redirect URLs,
  test-mail delivery, auth hook settings, Storage buckets and any deployed Edge
  Function secrets independently. Vercel variables do not update these. Review
  the scope and side effects first; production account/auth settings stay outside
  this setup. Verify test recipients and endpoints before exercising the app.
- [ ] Verify a Preview built from the PR SHA uses only the synthetic target, test
  integrations and its own report bucket. Run ordinary acceptance plus the full
  journey when consequential behavior changes. Capture only redacted IDs,
  outcomes and timestamps. Changing env configuration requires rebuilding the
  Preview before accepting it.
- [ ] After a successful final-commit CI run, request separate approval to add
  the stable `release-gate` required check while retaining current required
  checks and review protections. Confirm its observed name on GitHub first.
  Do not make path-filtered seeded jobs individually required: docs-only PRs
  should complete via the stable gate. Verify effective rules afterward.

### Environment matrix

Inventory `.env.example` plus actual code/workflow variables; the example is not
proof of deployment settings. Browser-exposed `NEXT_PUBLIC_*` values must never
contain server secrets. Production settings are reviewed, not rewritten here.

| Variables / setting | Development / local CI | Hosted Preview / staging | Production / side effects |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `DATABASE_URL` if used | Disposable local stack; integration runner derives local keys without printing them | Same isolated project/branch across client and server values; server role is server-only | Production-only mapping; wrong scope sends reads/writes to the wrong DB |
| `PUBLIC_APP_URL`, `ADMIN_APP_URL`, `ASSESS_APP_URL`, `PARTNER_APP_URL`, `CLIENT_APP_URL`, `NEXT_PUBLIC_APP_URL`, `SERVER_ACTION_ALLOWED_ORIGINS` | Local host/port | Exact Preview/staging origins; no production links | Production domains; wrong scope redirects people/mail to another environment |
| `COOKIE_DOMAIN`, `NEXT_PUBLIC_COOKIE_DOMAIN` | Usually unset on local host | Unset or limited to owned staging domains; never shared production cookie domain | Production scope only; changes affect sessions |
| `TRAJECTAS_CONTEXT_SECRET`, `INTERNAL_API_KEY`, `REPORT_ACCESS_TOKEN_SECRET`, `REPORT_PDF_TOKEN_SECRET` | Local test-only values | Dedicated staging signing values | Production-only; rotation may invalidate sessions/links; no automatic rotation |
| `INTERNAL_INTEGRATIONS_API_ENABLED`, `INTEGRATIONS_API_SECRET_PEPPER`, `INTEGRATIONS_CONFIG_ENCRYPTION_KEY` | Disabled unless fixture needs it | Disabled until synthetic integration approved; dedicated values if enabled | External calls, token validation and config decryption; no cross-environment keys |
| `RESEND_API_KEY`, `EMAIL_FROM`, `OPS_ALERT_EMAIL`, `SUPABASE_AUTH_HOOK_SECRET`; Supabase mail/hook configuration | Local mail sink | Test mail account/recipients and staging hook target; confirm no customer recipients | Sign-in/reminder/alert mail leaves the system; hook secrets/settings are separately scoped |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, optional public Stripe key | Test mode | Test mode and dedicated staging webhook | Live key only in Production; invoice/charge/webhook effects require approval |
| `UPSTASH_REDIS_REST_URL/TOKEN` or `KV_REST_API_URL/TOKEN` | Local/fixture where supported | Separate staging instance/namespace with isolation verified | Rate-limit/alert state; do not share production counters |
| `OpenRouter_API_KEY`, `OPENROUTER_MANAGEMENT_KEY`, optional AI provider keys | Mock/deterministic unless test spend approved | Mock/deterministic or a limited test budget; management key absent unless explicitly needed | Calls cost money and send inputs externally; shared prepaid balance is not isolation |
| `CRON_SECRET`, `vercel.json` schedules, report queue/storage config | CI/local fixture jobs only | Dedicated secret; explicitly review manual/scheduled job activation and recipient/payment isolation | Deletion, reminders, report/PDF writes, analysis, retention and billing are side effects |
| `TRAJECTAS_ALLOW_DEV_BYPASS` | Only the intended local development convention | Must be absent in deployed Preview/staging | Must be absent; do not change application/auth behavior in this workflow task |
| Supabase Edge Function secrets, Storage `reports` bucket, provider integrations | Local synthetic resources | Staging settings and private synthetic objects; no automatic production copying | Managed independently of Vercel; DB backups do not contain Storage object bytes |

## Recovery setup and rehearsal (not yet verified)

- [ ] Jason names the recovery owner and accepts recovery-time (RTO) and
  data-loss (RPO) targets for assessment responses, frozen forms, report snapshots,
  PDF objects and billing records. Define incident escalation and stop conditions.
- [ ] With permitted read access, record actual backup type, retention, oldest/
  latest restorable point and restore destination options. Confirm plan/add-on
  cost and permissions separately. Healthy status or plan upgrade is not a
  tested restore. Never restore/reset production as a rehearsal.
- [ ] Establish encrypted, access-controlled recovery of private `reports`
  Storage objects and their metadata/checksum mapping. Include essential provider
  configuration and signing-key custody in the password manager. Database backup
  alone does not preserve object bytes, external settings or all role passwords.
- [ ] On a synthetic isolated target, create a known assessment/form/response/
  snapshot/PDF fixture, record counts/checksums and time, take the planned backup,
  simulate loss there, restore database and objects, then verify login, old form
  rendering, stored snapshot/PDF access, new submissions and queue behavior.
  Keep mail, cron and billing side effects disabled/test-mode during restoration.
- [ ] Measure restore duration and latest recovered event against RTO/RPO,
  document gaps and owner acceptance. This proves the synthetic procedure only;
  validating access to real production backups is a separate approved activity.
- [ ] Rehearse app rollback to a previous compatible build on staging separately
  from data recovery, including schema compatibility and report/signing settings.
  Record the deploy ID and stop conditions; do not select a known incompatible
  build merely because it was previously green.

**App rollback** changes the deployed code; it does not undo schema changes,
invoices, outgoing mail, snapshots or data writes. Confirm schema/config
compatibility, then choose approved app rollback or forward fix.

**Migration recovery** normally uses a reviewed forward migration. Restoring a
backup can lose later valid writes and requires owner-approved reconciliation of
responses, objects and external billing. Contract changes can make old apps
unusable; backups are not a shortcut to reversible rollout.

## Operations after release

`vercel.json` is the queue schedule source. Verify actual invocation history;
empty queues do not prove scheduling. Report generation, PDF rendering, outcome
analysis, reminders, timing, deletion, retention and billing have separate effects.
Do not raise concurrency without measured staging evidence.

`GET /api/health` provides coarse readiness. Record the deployed SHA, health,
relevant queue/error observations and acceptance outcome; READY alone does not
prove a user journey. Use existing observability and permitted logs. Do not assume
Sentry or hosted capacity is verified. Keep incident notes in `docs/incidents/`
without production participant data, cookies, secrets or bearer links. Preserve
minimal redacted evidence, contain the affected operation with the owner, choose
compatible app rollback/forward fix or approved data recovery, then verify.

## Provider references

These describe capabilities, not this account's enabled configuration:
[Vercel environment scopes](https://vercel.com/docs/environment-variables),
[Supabase data-less branches and deployment side effects](https://supabase.com/docs/guides/deployment/branching),
[database backup limits and Storage exclusions](https://supabase.com/docs/guides/platform/backups),
[GitHub dependency-job conditions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds).
