#!/usr/bin/env bash
#
# pg-migrate-check.sh
#
# Applies every migration in supabase/migrations/ to a throwaway local
# Postgres 16 cluster, WITHOUT Docker / the Supabase CLI. Exists because
# `npx supabase start` / `supabase db reset` need a Docker daemon, which
# isn't available in every environment this repo gets worked on in (e.g.
# sandboxed agent containers).
#
# It verifies:
#   - every migration is valid DDL/DML against a real Postgres 16 server
#   - migrations apply cleanly in filename order, each as its own
#     transaction (matching how Supabase applies them -- see the enum
#     hazard note below)
#   - enum ADD VALUE / USE-in-same-transaction hazards (SQLSTATE 55P04)
#
# It does NOT verify RLS behaviour end-to-end: auth.uid()/auth.role()/
# auth.jwt() are stubs that read the request.jwt.claim* GUCs the way the
# real Supabase functions do, but nothing in this harness acts as
# PostgREST to set those GUCs per-request. See README-pg-migrate-check.md.
#
# Usage:
#   scripts/pg-migrate-check.sh [--fresh] [--from <filename>] [--keep-running]
#
#   --fresh          Destroy any existing throwaway cluster and recreate
#                     it from scratch, then apply ALL migrations from
#                     00001 onward. This is the real verification mode.
#   --from <file>     Skip initdb/baseline (the cluster must already
#                     exist) and apply only migrations from <file>
#                     (basename, e.g. 00042_report_generation_system.sql)
#                     onward, in sort order. Assumes everything before
#                     it is already applied. Useful for iterating on a
#                     new migration without re-running the other 200+.
#   --keep-running    Don't stop the server when the script exits --
#                     leave it up for `psql` inspection.
#
#   With no flags: starts (initialising if necessary) the cluster and
#   applies every migration that isn't already recorded as applied in
#   the harness's own bookkeeping table (incremental / resume mode).
#
# Exit status: 0 only if every non-skipped migration applied cleanly.
#
# Data location: everything lives under $PGMC_DATA_DIR (default below).
# Override it if the default isn't writable in your environment -- e.g.
# in the sandboxed container this was built in, all of /tmp except a
# scratch subtree is root-only, so PGMC_DATA_DIR was pointed at that
# scratch subtree for development. See README-pg-migrate-check.md.

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration (all overridable via environment variables)
# ---------------------------------------------------------------------------
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"

PGMC_DATA_DIR="${PGMC_DATA_DIR:-${TMPDIR:-/tmp}/pg-migrate-check}"
PGDATA="$PGMC_DATA_DIR/data"
RUNDIR="$PGMC_DATA_DIR/run"
LOGFILE="$RUNDIR/postgres.log"
PORT="${PGMC_PORT:-55432}"
SUPERUSER="${PGMC_SUPERUSER:-postgres}"
DBNAME="${PGMC_DBNAME:-postgres}"

# Where the Postgres 16 server binaries live.
PGBIN="${PGMC_PGBIN:-/usr/lib/postgresql/16/bin}"
if [ ! -x "$PGBIN/initdb" ]; then
  if command -v initdb >/dev/null 2>&1; then
    PGBIN="$(dirname "$(command -v initdb)")"
  else
    echo "ERROR: cannot find initdb. Set PGMC_PGBIN to the Postgres bin directory." >&2
    exit 1
  fi
fi

# initdb/postgres refuse to run as root. When this script itself is run as
# root (true in the sandbox this was built in), the actual server process
# is dropped to this unprivileged OS account via `su`. When the script is
# already running as a normal user, no privilege drop happens.
RUN_AS_OS_USER="${PGMC_OS_USER:-postgres}"

# ---------------------------------------------------------------------------
# SKIP list -- migrations that cannot be satisfied by a reasonable stub in
# this harness. Keep this EMPTY unless you have exhausted reasonable stubs;
# every entry must carry a comment explaining why. (As of writing, every one
# of the 206 migrations in this repo applies cleanly, so this is empty.)
# Format: ["filename.sql"]="reason"
# ---------------------------------------------------------------------------
declare -A SKIP_MIGRATIONS=(
  # (intentionally empty)
)

# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------
FRESH=0
FROM_FILE=""
KEEP_RUNNING=0

while [ $# -gt 0 ]; do
  case "$1" in
    --fresh) FRESH=1; shift ;;
    --from)
      [ $# -ge 2 ] || { echo "ERROR: --from requires a filename argument" >&2; exit 2; }
      FROM_FILE="$2"; shift 2 ;;
    --keep-running) KEEP_RUNNING=1; shift ;;
    -h|--help)
      sed -n '2,50p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      echo "Run with --help for usage." >&2
      exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# Privilege helper: run a command as RUN_AS_OS_USER when we're root, else
# run it directly as the invoking user.
# ---------------------------------------------------------------------------
run_as_pg() {
  if [ "$(id -u)" -eq 0 ]; then
    su -s /bin/bash "$RUN_AS_OS_USER" -c "$(printf '%q ' "$@")"
  else
    "$@"
  fi
}

psql_run() {
  # psql_run <extra psql args...> -- runs against $DBNAME over the unix socket.
  run_as_pg "$PGBIN/psql" -h "$RUNDIR" -p "$PORT" -U "$SUPERUSER" -d "$DBNAME" \
    -v ON_ERROR_STOP=1 -X -q "$@"
}

log()  { echo "[pg-migrate-check] $*"; }
err()  { echo "[pg-migrate-check] $*" >&2; }

# ---------------------------------------------------------------------------
# Directory / permission setup
# ---------------------------------------------------------------------------
ensure_dirs() {
  mkdir -p "$PGMC_DATA_DIR" "$RUNDIR"
  if [ "$(id -u)" -eq 0 ]; then
    # postgres (RUN_AS_OS_USER) needs to be able to traverse every ancestor
    # directory down to PGMC_DATA_DIR. Only ever add the execute
    # (traverse) bit for "other" -- never read/write -- and only where
    # it isn't already set. This is a no-op on a normal /tmp (already
    # world-traversable); it matters in sandboxes where the scratch
    # directory tree is chmod 700.
    local d="$PGMC_DATA_DIR"
    while [ "$d" != "/" ] && [ -n "$d" ]; do
      chmod o+x "$d" 2>/dev/null || true
      d="$(dirname "$d")"
    done
    chown -R "$RUN_AS_OS_USER":"$RUN_AS_OS_USER" "$PGMC_DATA_DIR"
  fi
}

# ---------------------------------------------------------------------------
# Cluster lifecycle
# ---------------------------------------------------------------------------
is_initialized() { [ -f "$PGDATA/PG_VERSION" ]; }

is_running() {
  run_as_pg "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1
}

do_initdb() {
  log "Initialising Postgres 16 cluster at $PGDATA"
  run_as_pg "$PGBIN/initdb" -D "$PGDATA" -U "$SUPERUSER" -E UTF8 \
    --auth=trust --auth-host=trust --auth-local=trust >/dev/null
}

start_server() {
  if is_running; then
    log "Server already running on port $PORT"
    return
  fi
  log "Starting Postgres on port $PORT (unix socket only, dir: $RUNDIR)"
  run_as_pg "$PGBIN/pg_ctl" -D "$PGDATA" -l "$LOGFILE" -w -t 30 \
    -o "-p $PORT -k $RUNDIR -h '' -c logging_collector=off" start
}

stop_server() {
  if is_running; then
    log "Stopping Postgres"
    run_as_pg "$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
}

CONN_STRING="postgresql://${SUPERUSER}@/${DBNAME}?host=${RUNDIR}&port=${PORT}"

print_conn_string() {
  echo ""
  echo "Connection string:"
  echo "  $CONN_STRING"
  echo "Or:"
  echo "  psql -h $RUNDIR -p $PORT -U $SUPERUSER -d $DBNAME"
  echo ""
}

cleanup() {
  local status=$?
  if [ "$KEEP_RUNNING" -eq 1 ]; then
    log "Leaving server running (--keep-running)."
    print_conn_string
  else
    stop_server
  fi
  exit $status
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Baseline: Supabase-compatible pre-migration environment
# ---------------------------------------------------------------------------
apply_baseline() {
  log "Applying Supabase-compatible baseline (roles, schemas, auth stand-in)"
  local baseline_file="$RUNDIR/000_baseline.sql"
  cat > "$baseline_file" <<'BASELINE_SQL'
-- =====================================================================
-- pg-migrate-check baseline
--
-- Reproduces the slice of a real Supabase Postgres instance that the
-- 206 migrations in supabase/migrations/ actually touch, established by
-- grepping the migration files (not guessed):
--   - extensions:      pgcrypto, citext            (both `CREATE EXTENSION
--                       IF NOT EXISTS` in 00001_initial_schema.sql --
--                       no vector/pg_trgm/uuid-ossp/pg_net/pg_cron use
--                       anywhere in the migration set)
--   - auth schema:      auth.uid() (31 call sites), auth.users(id) FK
--                       target (3 call sites), auth.users.encrypted_password
--                       (read/written by the passwordless-lock trigger in
--                       20260521130000_clear_user_passwords_and_lock.sql)
--   - storage schema:   one seed INSERT into storage.buckets
--                       (00062_brand_assets_bucket.sql)
--   - roles:            anon / authenticated / service_role appear in
--                       GRANT/REVOKE statements throughout; supabase_admin,
--                       supabase_auth_admin, authenticator, postgres exist
--                       for baseline fidelity even though no migration
--                       GRANTs to them directly.
--   - extensions/graphql_public/realtime schemas: not referenced by any
--                       migration, created empty for baseline fidelity /
--                       so a `CREATE SCHEMA IF NOT EXISTS` in a future
--                       migration is a no-op like it would be in prod.
-- =====================================================================

-- ---- Extensions ----
-- A real (self-hosted or cloud) Supabase Postgres image ships with these
-- already installed. Installing them here means the migrations' own
-- `CREATE EXTENSION IF NOT EXISTS` calls are no-ops against this harness,
-- matching production reality instead of exercising a code path
-- (first-time extension install) that never actually happens in prod.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---- Roles ----
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOINHERIT CREATEROLE LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin NOINHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN;
  END IF;
  -- 'postgres' already exists: it's the initdb superuser (-U postgres).
END
$$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- ---- Supabase-standard schemas ----
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS extensions AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS graphql_public AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS realtime AUTHORIZATION postgres;

-- ---- supabase_migrations.schema_migrations stand-in ----
-- The real Supabase CLI creates this ledger itself and records each applied
-- migration in it. This harness applies files directly with psql, so the table
-- would not otherwise exist -- and 20260522020000_admin_list_migrations_rpc.sql
-- reads from it. We create the table with the CLI's column shape and record
-- each migration as it is applied (see apply_migration), so the RPC compiles
-- and returns realistic rows.
CREATE SCHEMA IF NOT EXISTS supabase_migrations AUTHORIZATION postgres;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version    TEXT PRIMARY KEY,
  statements TEXT[],
  name       TEXT
);
GRANT USAGE ON SCHEMA supabase_migrations TO anon, authenticated, service_role;

-- ---- search_path: match real Supabase ----
-- Supabase keeps extensions in the `extensions` schema and puts that schema on
-- the database search_path. 20260508214400_phase4_security_hardening.sql relies
-- on this: it runs `ALTER EXTENSION citext SET SCHEMA extensions`, after which
-- every later migration declaring a CITEXT column only resolves because
-- `extensions` is searchable. Without this the harness fails at
-- 20260529140000 with `type "citext" does not exist` -- a harness artefact,
-- not a real defect. Set at database level so each per-migration psql session
-- inherits it.
DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET search_path TO %s',
    current_database(),
    '"$user", public, extensions'
  );
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- ---- Supabase bootstrap table grants ----
-- The Supabase platform (not this repo's migrations) grants blanket table
-- privileges to anon/authenticated/service_role in `public`, with RLS as the
-- actual access control. Without modelling that, every table here has a NULL
-- relacl (owner-only), and any test of a GRANT/REVOKE in a migration is
-- vacuous -- notably the column-level
-- `REVOKE SELECT (score_value) ON item_options FROM anon, authenticated`,
-- which would appear to "pass" simply because the privilege never existed.
-- ALTER DEFAULT PRIVILEGES makes later CREATE TABLEs inherit these, matching
-- how the platform behaves as migrations add tables over time.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

-- ---- auth.users stand-in ----
-- Columns the migrations actually reference: id, encrypted_password.
-- The rest of the common GoTrue columns (email, raw_user_meta_data, ...)
-- are included anyway so a future migration that touches them doesn't
-- need a harness change -- this mirrors the real auth.users shape.
CREATE TABLE IF NOT EXISTS auth.users (
    instance_id             uuid,
    id                      uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    aud                     varchar(255),
    role                    varchar(255),
    email                   varchar(255),
    encrypted_password      varchar(255),
    email_confirmed_at      timestamptz,
    invited_at              timestamptz,
    confirmation_token      varchar(255),
    confirmation_sent_at    timestamptz,
    recovery_token          varchar(255),
    recovery_sent_at        timestamptz,
    email_change_token_new  varchar(255),
    email_change             varchar(255),
    email_change_sent_at    timestamptz,
    last_sign_in_at         timestamptz,
    raw_app_meta_data       jsonb,
    raw_user_meta_data      jsonb,
    is_super_admin          boolean,
    created_at              timestamptz,
    updated_at              timestamptz,
    phone                   text,
    phone_confirmed_at      timestamptz,
    confirmed_at            timestamptz,
    banned_until            timestamptz,
    deleted_at              timestamptz,
    is_anonymous            boolean NOT NULL DEFAULT false
);

-- ---- auth.uid() / auth.role() / auth.jwt() ----
-- These are the real GoTrue/Supabase definitions: they read the
-- request.jwt.claim(s) GUCs that PostgREST sets per-request from the
-- caller's JWT. Nothing in this harness acts as PostgREST, so outside of
-- a manual `SET request.jwt.claim.sub = '<uuid>'` in a psql session,
-- auth.uid() returns NULL here -- exactly like a query run directly
-- against a real Supabase database outside of PostgREST would. This is
-- why the harness verifies DDL/constraint correctness, not RLS
-- authorization behaviour -- see README-pg-migrate-check.md.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;

-- ---- storage.buckets stand-in ----
-- Only storage.* object any migration touches: an idempotent seed INSERT
-- in 00062_brand_assets_bucket.sql (`INSERT INTO storage.buckets (id,
-- name, public) ... ON CONFLICT (id) DO NOTHING`).
CREATE TABLE IF NOT EXISTS storage.buckets (
    id                  text PRIMARY KEY,
    name                text NOT NULL,
    owner               uuid,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now(),
    public              boolean DEFAULT false,
    file_size_limit     bigint,
    allowed_mime_types  text[]
);

-- ---- Harness bookkeeping (not part of the app schema) ----
CREATE SCHEMA IF NOT EXISTS _pg_migrate_check;
CREATE TABLE IF NOT EXISTS _pg_migrate_check.applied_migrations (
    filename    text PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
);
BASELINE_SQL

  if [ "$(id -u)" -eq 0 ]; then
    chown "$RUN_AS_OS_USER":"$RUN_AS_OS_USER" "$baseline_file"
  fi

  if ! psql_run --single-transaction -f "$baseline_file"; then
    err "Baseline setup FAILED -- see errors above."
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Migration application
# ---------------------------------------------------------------------------
is_applied() {
  local fname="$1"
  local result
  result="$(psql_run -t -A -c "SELECT 1 FROM _pg_migrate_check.applied_migrations WHERE filename = '$fname'" 2>/dev/null || true)"
  [ "$result" = "1" ]
}

record_applied() {
  local fname="$1" version
  psql_run -c "INSERT INTO _pg_migrate_check.applied_migrations(filename) VALUES ('$fname') ON CONFLICT (filename) DO NOTHING;" >/dev/null
  # Mirror into the Supabase CLI's own ledger so migrations that read it
  # (e.g. admin_list_migrations_rpc) see realistic rows. version = the leading
  # timestamp/number, name = the remainder, matching the CLI's convention.
  version="${fname%%_*}"
  psql_run -c "INSERT INTO supabase_migrations.schema_migrations(version, name) VALUES ('$version', '${fname#*_}') ON CONFLICT (version) DO NOTHING;" >/dev/null
}

apply_one() {
  local filepath="$1" fname outfile errfile rc
  fname="$(basename "$filepath")"
  outfile="$(mktemp -p "$RUNDIR" out.XXXXXX)"
  errfile="$(mktemp -p "$RUNDIR" err.XXXXXX)"

  set +e
  run_as_pg "$PGBIN/psql" -h "$RUNDIR" -p "$PORT" -U "$SUPERUSER" -d "$DBNAME" \
    -v ON_ERROR_STOP=1 -X --single-transaction -f "$filepath" \
    >"$outfile" 2>"$errfile"
  rc=$?
  set -e

  if [ $rc -eq 0 ]; then
    record_applied "$fname"
    log "OK    $fname"
    rm -f "$outfile" "$errfile"
    return 0
  fi

  echo "" >&2
  echo "============================================================" >&2
  echo "MIGRATION FAILED: $fname" >&2
  echo "============================================================" >&2
  echo "--- psql error output ---" >&2
  cat "$errfile" >&2
  echo "--- psql stdout (last 20 lines, for context on how far it got) ---" >&2
  tail -n 20 "$outfile" >&2
  echo "============================================================" >&2
  rm -f "$outfile" "$errfile"
  return 1
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if [ "$FRESH" -eq 1 ]; then
  log "--fresh: destroying any existing cluster at $PGMC_DATA_DIR"
  stop_server 2>/dev/null || true
  rm -rf "$PGMC_DATA_DIR"
fi

ensure_dirs

FIRST_INIT=0
if ! is_initialized; then
  if [ -n "$FROM_FILE" ]; then
    err "ERROR: --from was given but no cluster exists at $PGDATA yet."
    err "Run without --from (or with --fresh) first to create and migrate it."
    exit 2
  fi
  do_initdb
  FIRST_INIT=1
fi

start_server

# Wait for readiness.
for _ in $(seq 1 30); do
  if run_as_pg "$PGBIN/pg_isready" -h "$RUNDIR" -p "$PORT" -U "$SUPERUSER" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if [ "$FIRST_INIT" -eq 1 ]; then
  apply_baseline
else
  # Cluster already existed. Make sure baseline objects are present
  # (idempotent -- IF NOT EXISTS / CREATE OR REPLACE throughout), in case
  # this is a cluster from an older version of this script.
  apply_baseline
fi

print_conn_string

mapfile -t ALL_MIGRATIONS < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort)

if [ "${#ALL_MIGRATIONS[@]}" -eq 0 ]; then
  err "ERROR: no .sql files found in $MIGRATIONS_DIR"
  exit 1
fi

START_INDEX=0
if [ -n "$FROM_FILE" ]; then
  FOUND=0
  for i in "${!ALL_MIGRATIONS[@]}"; do
    if [ "$(basename "${ALL_MIGRATIONS[$i]}")" = "$FROM_FILE" ]; then
      START_INDEX=$i
      FOUND=1
      break
    fi
  done
  if [ "$FOUND" -eq 0 ]; then
    err "ERROR: --from file not found among migrations: $FROM_FILE"
    exit 2
  fi
  log "Applying from $FROM_FILE onward (${#ALL_MIGRATIONS[@]} total migrations, starting at index $START_INDEX)"
fi

TOTAL=0
APPLIED=0
SKIPPED=0
FAILED_FILE=""

for i in "${!ALL_MIGRATIONS[@]}"; do
  [ "$i" -ge "$START_INDEX" ] || continue
  filepath="${ALL_MIGRATIONS[$i]}"
  fname="$(basename "$filepath")"
  TOTAL=$((TOTAL + 1))

  if [ -n "${SKIP_MIGRATIONS[$fname]+x}" ]; then
    log "SKIP  $fname -- ${SKIP_MIGRATIONS[$fname]}"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Resume mode (no --from, cluster pre-existed): don't re-apply what's
  # already recorded. --fresh and --from both mean "apply everything in
  # this range regardless of prior bookkeeping".
  if [ -z "$FROM_FILE" ] && [ "$FIRST_INIT" -eq 0 ] && is_applied "$fname"; then
    log "SKIP  $fname (already applied)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if ! apply_one "$filepath"; then
    FAILED_FILE="$fname"
    break
  fi
  APPLIED=$((APPLIED + 1))
done

echo ""
log "Summary: $TOTAL considered, $APPLIED applied, $SKIPPED skipped"

if [ -n "$FAILED_FILE" ]; then
  log "RESULT: FAILED at $FAILED_FILE"
  exit 1
fi

log "RESULT: all migrations applied cleanly"
exit 0
