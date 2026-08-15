# `pg-migrate-check.sh` — migration verification without Docker

Applies every file in `supabase/migrations/` in order against a throwaway
PostgreSQL 16 cluster, and fails loudly on the first migration that errors.

It exists because `npx supabase start` / `supabase db reset` need the Docker
daemon, which is not available in every environment (CI sandboxes, Claude Code
web containers). This harness needs only the Postgres 16 server binaries.

## Usage

```sh
scripts/pg-migrate-check.sh --fresh          # destroy + recreate, apply all
scripts/pg-migrate-check.sh --keep-running   # leave the server up afterwards
scripts/pg-migrate-check.sh --from 20260813100000_cognitive_enums.sql
```

Exit code is 0 only if every migration applied cleanly. With `--keep-running`
it prints a connection string so you can inspect the resulting schema:

```sh
psql -h /tmp/pg-migrate-check/run -p 55432 -U postgres -d postgres
```

## What it models

The migrations assume a Supabase database, so the harness recreates the parts
of that environment the platform normally provides, **before** applying any
migration:

- Roles: `anon`, `authenticated`, `service_role`, `supabase_admin`,
  `supabase_auth_admin`, `authenticator`, `postgres`
- Schemas: `auth`, `storage`, `extensions`, `graphql_public`, `realtime`,
  `supabase_migrations`
- Extensions: `pgcrypto`, `citext`
- Stubs: `auth.uid()`, `auth.role()`, `auth.jwt()`, and an `auth.users` table
- `supabase_migrations.schema_migrations`, populated as each migration is
  applied, because `20260522020000_admin_list_migrations_rpc.sql` reads it
- `search_path = "$user", public, extensions` at database level, because
  `20260508214400_phase4_security_hardening.sql` relocates `citext` into
  `extensions` and every later `CITEXT` column depends on it being searchable
- **Supabase's blanket table grants** to `anon`/`authenticated`/`service_role`
  via `ALTER DEFAULT PRIVILEGES`

That last one matters more than it looks. Those grants come from the Supabase
platform, not from this repo's migrations. Without them every table has a NULL
`relacl` (owner-only), and any test of a `GRANT`/`REVOKE` in a migration passes
vacuously — the privilege was never there to remove. Modelling them is what
caught the `item_options.score_value` bug described below.

## Verifying RLS policies locally

The harness's `auth.uid()` / `auth.role()` / `auth.jwt()` are the real Supabase
definitions: they read the `request.jwt.claim*` GUCs that PostgREST normally
sets per request. Nothing here acts as PostgREST — but you can set those GUCs
yourself, which means **RLS policies can be exercised locally**, not merely
inspected.

Run with `--keep-running`, then simulate a signed-in user by combining
`SET ROLE` with the claim GUC:

```sql
-- Seed a user and profile as the superuser (bypasses RLS)
INSERT INTO auth.users (id) VALUES ('1111...1111');
INSERT INTO profiles (id, email, role)
  VALUES ('1111...1111', 'padmin@example.com', 'platform_admin');

-- Now query as that user would
SET ROLE authenticated;
SET request.jwt.claim.sub = '1111...1111';
SELECT count(*) FROM item_parameters;
```

Worked example, verified: with one `item_parameters` row present, a
`platform_admin` sees 1 row and an `org_admin` sees 0, exercising the
`is_platform_admin()` policy added in `20260813101000`. Swapping only the claim
GUC changes the result, which is the property you want to test.

Two things to remember: `SET ROLE authenticated` matters as much as the claim,
because table and column grants are checked before RLS; and the superuser
bypasses RLS entirely, so seed as `postgres` and always assert as
`authenticated`.

## Limitations — read before trusting a green run

- It verifies **DDL correctness, migration ordering, constraint and enum
  hazards, trigger creation, table/column privilege arithmetic, and (per above)
  RLS policy behaviour** — the classes of failure otherwise only discovered in
  CI or production.
- It does **not** exercise PostgREST itself: request shaping, embedded-resource
  authorization, error-code mapping and the Supabase client's behaviour are out
  of scope. `npm run test:integration:local` against a real stack still covers
  those, and CI runs it.
- Stubs may drift from real Supabase over time. A green run is necessary, not
  sufficient.

## Worked example: the bug this caught

`20260813101000_item_key_privilege_hardening.sql` originally contained:

```sql
REVOKE SELECT (score_value) ON TABLE item_options FROM anon, authenticated;
```

which reads as though it withholds the answer-key column from dashboard users.
It does not. In PostgreSQL **a column-level `REVOKE` cannot subtract from a
table-level grant**, and Supabase grants table-level `SELECT` to
`authenticated` on everything in `public`. The statement wrote no column ACL
entry and `has_column_privilege()` still returned true — a silent no-op that
would have shipped as a fix while changing nothing.

The working form drops the table-level grant and grants back the safe columns:

```sql
REVOKE SELECT ON TABLE item_options FROM anon, authenticated;
GRANT SELECT (id, item_id, label, value, display_order, exclude_from_scoring)
  ON TABLE item_options TO anon, authenticated;
```

Verified by connecting as the role and confirming `SELECT score_value` raises
`permission denied` while `SELECT id, label, value` succeeds.

**Consequence for future work:** any column added to `item_options` must be
added to that `GRANT`, or it will be unreadable by `anon`/`authenticated`. That
is a deliberate fail-closed default for a table holding answer keys.
