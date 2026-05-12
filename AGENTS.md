# Next.js — Read Before Writing Code
This version has breaking changes — APIs, conventions, and file structure
may differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## UI/UX Standards
Read `docs/ui-standards.md` before building any UI component or page.

## Behavioral Rules
- If uncertain or if multiple interpretations exist, surface it — don't pick silently
- If a simpler approach exists, push back

## Naming Conventions

The schema has been through several renames. **Use the canonical names below**; the old names appear in historical migrations but must NOT be used in new code, migrations, or types.

### The customer entity: `clients` (not `organizations`)
Migration `00068` renamed `organizations` → `clients`. This includes:
- Table: `clients` (was `organizations`)
- FK columns: `client_id` (was `organization_id`) — across `assessments`, `campaigns`, `profiles`, `diagnostic_sessions`, etc.
- Helper functions: `auth_user_client_id()`, `auth_user_client_ids()`, `auth_user_client_admin_ids()` (were `auth_user_organization_id` etc.)

The `org_admin` UserRole value was **deliberately not renamed** — it's a semantic role label ("admin of an organisation/client"), not a table reference. Code may keep using `org_admin` as a string literal.

### Survey takers: `campaign_participants` (not `campaign_candidates`)
Migration `00031` renamed `campaign_candidates` → `campaign_participants`. The route directory `/dashboard/participants/` and the UI all use "participant".

The word "candidate" still appears in unrelated contexts (algorithmic candidate items in AI generation, e.g., `pairCandidates` in `construct-preflight.ts`). Don't confuse those with survey-taker candidates.

### Adjective vs noun: `org_*` vs `client_*`
The codebase uses two patterns and they mean different things:
- **`client_*`** prefixes name things that belong to / are scoped by a client. Examples: `client_id`, `client_memberships`, `client_roles`, `client_entitlements`.
- **`org_*`** prefixes are adjectival, meaning "organisational" — describing the *kind* of thing, not its owner. Examples: `org_admin` (a role of admin-of-an-org), `org_diagnostic_*` (diagnostics that profile an organisation).

Both are valid; pick based on intent. Do not "fix" `org_*` to `client_*` or vice versa without thinking.

### Org Diagnostic feature tables
Introduced 2026-04-20 (this branch). Canonical names:
- `org_diagnostic_campaigns` — the data-collection round (kind: baseline | role_rep)
- `org_diagnostic_campaign_tracks` — per-instrument tracks within a campaign
- `org_diagnostic_respondents` — invitees (anonymity-protected; client members have no SELECT policy)
- `org_diagnostic_profiles` — versioned snapshots produced when a campaign closes
- `client_roles` — hiring positions at a client (uses `client_*` because the row is scoped to a specific client)

See `docs/superpowers/specs/2026-04-20-org-diagnostic-campaigns-and-roles-design.md` for the full data model and rationale.

### When in doubt, query the live schema
Don't trust grep-archaeology of historical migrations. The current truth is in the database:
```sh
docker exec supabase_db_trajectas-local psql -U postgres -d postgres -c "\d <table>"
```

## Integration tests vs production

`.env.local` points at the **production** Supabase project. The integration tests in `tests/integration/` read those env vars directly, so running `npm run test:integration` will create rows in production unless you override the env vars.

**For any DB-touching integration work, use:**
```sh
npm run test:integration:local                              # all
npm run test:integration:local -- tests/integration/foo.ts  # one file
```

This wraps vitest with the local Supabase env from `supabase status`. The script lives at `scripts/run-integration-tests-local.mjs`.

### The trap to avoid

`npm run test`, `npm run test:coverage`, and `npm run test:integration` all pick up `.env.local` automatically. Each integration test file is responsible for its own production guard. New integration tests **must** include a host-whitelist check before they will run; see the pattern in `tests/integration/trajectory-person-key.test.ts`:

```ts
const isLocalSupabase =
  !!SUPABASE_URL &&
  /^(https?:\/\/)?(127\.0\.0\.1|localhost|host\.docker\.internal|kong)(:\d+)?(\/|$)/.test(SUPABASE_URL)
const canRun = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY && SUPABASE_ANON_KEY) && isLocalSupabase
```

CI does not have `.env.local`, so the env vars are unset and tests skip. The guard is for local-developer safety.

## Migration & deploy flow

The project uses a PR-then-merge model with CI gating on each PR. The order of operations for any DB-touching feature:

1. **Branch from `origin/main`.** Never push to `main` directly — main is not currently protected, but the convention is PR-based and Vercel deploys from main. Use a descriptive branch name (`feat/X`, `fix/Y`, `refactor/Z`).
2. **Apply schema changes locally first.** Use the local Supabase stack via `supabase db reset` (or `db push` for incremental) and verify via `npm run test:integration:local`.
3. **Once the migration is green locally**, apply it to the live Supabase project via the Supabase MCP (`apply_migration`). The migration file in `supabase/migrations/` is the source of truth, but the MCP write keeps the live project in sync without waiting for a deploy.
4. **Run `mcp__claude_ai_Supabase__get_advisors` after every DDL change.** New `SECURITY DEFINER` functions that aren't intended for direct RPC need a follow-up migration revoking `EXECUTE` from `anon` and `authenticated`. See `20260512150000_trajectory_revoke_trigger_fn_exec.sql` for the pattern.
5. **Commit the migration file** so source matches live.
6. **Open a PR** with `gh pr create` and watch CI with `gh pr checks <num> --watch`.
7. **CI must be green to merge.** The three jobs are `security` → `quality` → `e2e-smoke`. Each gates the next.
8. **If `security` fails on `npm audit`**, that's almost always a pre-existing dependency issue, not the PR's fault. `npm audit fix` and commit the lockfile bump as a separate `chore(deps)` commit on the same branch — do NOT mix dep bumps with feature work in the same commit.
9. **Merge via `gh pr merge --squash --delete-branch`** once CI is green and any review feedback is addressed.

### Sequencing rationale

Apply the migration to live **before** opening the PR (step 3 before step 6) because:
- Vercel previews built from the PR will exercise the new code against the new schema.
- A failed-build PR is easier to diagnose if the schema is in place.
- If the migration itself is the problem, you catch it before sinking CI time into the rest.

Do NOT apply the migration to live after merging — the time between merge and Vercel's production deploy is when the schema and code can be out of sync.

### Pre-existing CI debt — `npm audit`

The `security → Audit production dependencies` step (`npm audit --omit=dev --audit-level=high`) is fragile because Next.js publishes high-severity advisories frequently. If a PR fails on this step and the failures are upstream of the PR's diff, treat it as repo maintenance, not feature work:

```sh
npm audit fix       # may bump minor versions
npm test:unit       # sanity check
npm run build       # sanity check
git add package-lock.json
git commit -m "chore(deps): npm audit fix — bump <pkg> to <version>"
```

If `npm audit fix` doesn't resolve the advisory (e.g. no patched version exists yet), surface it to the user — don't paper over it or relax `--audit-level`.
