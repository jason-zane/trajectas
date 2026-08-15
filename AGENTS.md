# Next.js — Read Before Writing Code
This version has breaking changes — APIs, conventions, and file structure
may differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Workspace isolation — ALWAYS use a git worktree

The repo is regularly worked on in parallel (Jason's terminal, other Claude
sessions, scheduled agents). A git checkout has one HEAD across the whole
working tree, so a `git checkout` or `git switch` from any of those processes
silently rewrites the files under your feet. We have lost work to this twice.

**Rule:** any time you create a new branch — feature, fix, refactor, chore —
do it in a worktree under `.claude/worktrees/<branch-slug>/`, NOT in the
primary checkout at `/Users/jasonhunt/Developer/trajectas`. The primary
checkout is reserved for Jason's terminal.

The one-liner is `scripts/agent-worktree.sh <branch-name>`. It creates the
worktree off `origin/main`, prints the path, and `cd` into it is your first
command. From there, every subsequent `Bash` / `Read` / `Edit` should use
the worktree path. See the script for details and the "Worktree hygiene"
note under "Branch hygiene" below for cleanup after the PR merges.

Read-only work (grep, lookups, audits, answering questions) on existing
checked-in code is fine in the primary checkout — but the moment you're
about to `git checkout -b`, switch to a worktree.

## UI/UX Standards
Read `docs/ui-standards.md` before building any UI component or page.

## Data Access Layer

Database access is being centralised into `src/lib/dal/` (server-only modules
that own the query, return DTOs, and keep the persistence schema out of the UI).
It is incremental — not every query lives there yet — but new code should follow
the pattern. See `src/lib/dal/README.md`.

Hard rule (enforced by `tests/architecture/no-db-in-components.test.ts`):
**reusable components in `src/components/**` must NOT import `createAdminClient`
or `@/lib/supabase/server`.** They receive data as props or call a DAL function.
Pages (`src/app/**/page.tsx`) may fetch, preferably via the DAL.

## Cognitive item bank — review gates delivery

Cognitive items (anything with a `cognitive_item_specs` row) may not be placed
into an assessment until they have cleared **both** content and fairness review.
Enforced by `assessment_section_items_review_gate`
(`20260815091500_cognitive_review_gate_on_delivery.sql`): the link is refused
unless `items.lifecycle_state` is `piloting`, `calibrated` or `operational`.

Consequences worth knowing before you debug one of them:

- **Fixtures break if they link a draft cognitive item.** Create the item at
  `piloting` directly (the lifecycle guard governs transitions, not INSERT), or
  record real sign-offs and transition it.
- **Non-cognitive items are unaffected.** Every item in the library is `draft`,
  including the 400+ Likert items in live assessments; the lifecycle states were
  introduced for the cognitive bank and only that bank uses them.
- **Nothing in the app promotes an item.** Sign-offs come from a person in
  `/item-bank/review`. `item_reviews` is append-only — a mistaken approval is
  corrected by adding a rejection, never by editing history. Any script that
  writes an `item_reviews` row is fabricating a sign-off; that is what
  `scripts/cognitive/ingest-to-live.ts` was rewritten to stop doing.

To load items, use **`/item-bank/generate`** (seed + per-family count). Ingest is
idempotent by content hash, so re-running a seed completes a partial load rather
than duplicating it.

Every producer shapes a bank through `src/lib/item-bank/from-generation.ts` —
`bankFilesFromGeneration` for the CLI that writes `items.json` to disk,
`bankFromGeneration` (same projection, then `parseBankFile`) for everyone who
ingests. **Do not reconstruct that shape by hand.** Two reasons, both learned the
hard way: identical seeds must produce identical content hashes or idempotency
stops meaning anything, and each hand-rolled copy silently dropped the
per-distractor error labels, so reviewers saw four indistinguishable wrong
answers and no later run could backfill them.

## Behavioral Rules
- If uncertain or if multiple interpretations exist, surface it — don't pick silently
- If a simpler approach exists, push back

## Auth model — passwordless / OTP only

Trajectas does not use password authentication. Sign-in is via email OTP (`signInWithOtp` → `verifyOtp`). Do not introduce any of the following:

- `signInWithPassword(...)` / `signUp({ email, password })`
- `resetPasswordForEmail(...)`
- `updateUser({ password: ... })`
- `auth.admin.createUser({ password })` / `auth.admin.updateUserById(..., { password })`

These are enforced by `tests/architecture/passwordless-only.test.ts` (fails CI) and by a database trigger that nulls any `encrypted_password` written to `auth.users` (migration `20260521130000_clear_user_passwords_and_lock.sql`). If you find yourself wanting to bypass either, talk it through first — the constraint is what makes the security story coherent.

MFA, HIBP leaked-password protection, password-strength rules, and password-reset flows are all N/A under this model.

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

This is enforced two ways:

- **Static (CI):** `tests/architecture/integration-host-guard.test.ts` fails CI if an integration test opens a real Supabase client (imports `@supabase/supabase-js` or the rls-fixture) without the host guard.
- **Runtime (fail-closed):** the shared fixture's `createAdminClient()` / `createTestUser()` call `assertLocalSupabaseUrl()`, which **throws** if `NEXT_PUBLIC_SUPABASE_URL` is set to a non-local host. So even if a file's `skipIf` guard is missing or wrong, a run pointed at prod aborts loudly instead of writing rows. (No-op when the URL is unset, so CI still skips cleanly.) Pinned by `tests/architecture/rls-fixture-guard.test.ts`.

Relatedly, `tests/architecture/admin-actions-authz.test.ts` fails CI if a Server Action performs an admin-client (service-role, RLS-bypassing) **mutation** without an authorization gate — add a vetted entry to its ALLOWLIST only for genuine self-service/token exceptions.

## Migration & deploy flow

The project uses a PR-then-merge model with CI gating on each PR. The order of operations for any DB-touching feature:

1. **Branch from `origin/main`.** Never push to `main` directly — main is not currently protected, but the convention is PR-based and Vercel deploys from main. Use a descriptive branch name (`feat/X`, `fix/Y`, `refactor/Z`).
2. **Apply schema changes locally first.** Use the local Supabase stack via `supabase db reset` (or `db push` for incremental) and verify via `npm run test:integration:local`.
3. **Once the migration is green locally**, apply it to the live Supabase project via the Supabase MCP (`apply_migration`). The migration file in `supabase/migrations/` is the source of truth, but the MCP write keeps the live project in sync without waiting for a deploy.
4. **Run `mcp__claude_ai_Supabase__get_advisors` after every DDL change.** New `SECURITY DEFINER` functions that aren't intended for direct RPC need a follow-up migration revoking `EXECUTE` from `anon` and `authenticated`. See `20260512150000_trajectory_revoke_trigger_fn_exec.sql` for the pattern.
5. **Commit the migration file** so source matches live.
6. **Open a PR** with `gh pr create` and watch CI with `gh pr checks <num> --watch`.
7. **CI must be green to merge.** The four jobs are `security` (gates the rest), then `quality` and `integration` (parallel), then `e2e-smoke` (gates on `quality`).
8. **If `security` fails on `npm audit`**, that's almost always a pre-existing dependency issue, not the PR's fault. `npm audit fix` and commit the lockfile bump as a separate `chore(deps)` commit on the same branch — do NOT mix dep bumps with feature work in the same commit.
9. **Merge via `gh pr merge --squash --delete-branch`** once CI is green and any review feedback is addressed.
10. **Prune the local branch.** `--delete-branch` only removes the *remote* branch; the local one still points at the pre-squash commit and will not show up in `git branch --merged`. Run:
    ```sh
    git checkout main && git pull --ff-only
    git branch -D <branch-just-merged>
    ```
    Or use the `pr-ship` helper (see "Branch hygiene" below). Skipping this step is why local branch lists accumulate dozens of dead refs.

### Branch hygiene

A periodic cleanup pass (run weekly or whenever `git branch` feels noisy):

```sh
# 1. Sync remote refs and prune deleted upstreams.
git fetch -p

# 2. Delete branches whose upstream is gone (squash-merged + deleted on remote).
git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads/ \
  | awk '/\[gone\]/{print $1}' | xargs -r git branch -D

# 3. Cross-check remaining unmerged-vs-main branches against PR status:
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/); do
  git merge-base --is-ancestor "$b" origin/main && continue
  pr=$(gh pr list --state all --head "$b" --json number,state --jq '.[0] // empty')
  [ -n "$pr" ] && echo "$b → $pr"
done
```

Worktree hygiene: agent worktrees under `.claude/worktrees/*` and `.worktrees/*` pin branches. After the related PR is merged, remove the worktree (`git worktree remove <path>`) before deleting the branch.

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
