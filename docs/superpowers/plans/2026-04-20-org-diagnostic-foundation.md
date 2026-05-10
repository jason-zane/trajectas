# Org Diagnostic Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the database foundation for the Organisational Diagnostics product capability — five new tables (`org_diagnostic_campaigns`, `org_diagnostic_campaign_tracks`, `org_diagnostic_respondents`, `org_diagnostic_profiles`, `client_roles`) with RLS, types, validation helpers, and verification tests. No application UI; no item bank; no scoring. This is purely the schema + lifecycle skeleton.

**Architecture:** Five migrations applied in dependency order (enums → profiles → roles → campaigns/tracks → respondents). RLS policies mirror the existing `campaigns` / `campaign_candidates` patterns from migration `00019`, with one critical exception: client members have **no** SELECT policy on `org_diagnostic_respondents` (anonymity contract). Cross-table validation that cannot be expressed in DB constraints (e.g., "baseline tracks must use OPS or LCQ") lives in a small pure-function library at `src/lib/org-diagnostic/validation.ts` for future server actions to consume.

**Tech Stack:** PostgreSQL via Supabase, TypeScript, vitest (unit + integration), `@supabase/supabase-js`. Migrations in `supabase/migrations/` named `YYYYMMDDHHMMSS_<descriptive>.sql`. Types hand-maintained in `src/types/database.ts` (no codegen). RLS tests follow the pattern of `tests/integration/tenant-isolation.test.ts`.

**Spec reference:** `docs/superpowers/specs/2026-04-20-org-diagnostic-campaigns-and-roles-design.md`

---

## Status: Foundation Complete (paused 2026-04-20)

This plan was executed end-to-end on 2026-04-20. All six phases (A–F) are done. The foundation is live in production. Work is paused; the next workstream (item bank + scoring pipeline) is unstarted.

### What landed

**In production** (applied via the Supabase MCP — direct `db:push` was blocked by Network Restrictions on the dev IP):
- 5 new tables: `org_diagnostic_campaigns`, `org_diagnostic_campaign_tracks`, `org_diagnostic_respondents`, `org_diagnostic_profiles`, `client_roles`
- 8 new enum types (`org_diagnostic_*`, `client_role_status`)
- RLS enabled on all five tables; the anonymity contract on `org_diagnostic_respondents` is enforced by deny-by-default (no client-member SELECT policy)
- FK from `org_diagnostic_profiles.campaign_id` → `org_diagnostic_campaigns(id)` ON DELETE RESTRICT
- Verified by direct schema query against production after deploy

**On the `feat/org-diagnostics-foundation` branch** (14 commits, see `git log main..HEAD`):
- All migration files
- TypeScript types in `src/types/database.ts` (8 enum unions + 5 entity interfaces, all hand-maintained per project convention)
- Validation library at `src/lib/org-diagnostic/validation.ts` + 19 unit tests
- RLS verification tests at `tests/integration/org-diagnostic-rls.test.ts` (17 tests including 5 anonymity-contract assertions)
- Constraint/lifecycle tests at `tests/integration/org-diagnostic-lifecycle.test.ts` (7 tests)
- Baseline repair: renamed `00048` → `00079` (out-of-order enum value usage was breaking fresh `db:test:reset`); updated stale `seed.sql` references (`organizations` → `clients`, `name` → `title` on assessments)
- New convenience: `npm run test:integration:local` (avoids accidentally hitting prod via `.env.local`)
- New `AGENTS.md` "Naming Conventions" section documenting the rename history (`organizations` → `clients`, `auth_user_organization_id` → `auth_user_client_id`, `campaign_candidates` → `campaign_participants`) and the `org_*` adjective vs `client_*` scope distinction

### Verification at pause

- `npm run test:unit` — 293/293 pass
- `npm run test:integration:local` — 79/79 pass
- `npm run typecheck` — clean
- `npm run lint` — 3 issues, all in pre-existing files unrelated to this work (`src/components/refresh-on-focus.tsx`, `src/app/client/dashboard/client-dashboard.tsx`, `scripts/audit-capture.mjs`); same issues exist on `main`
- `npm run db:test:reset` — applies all 109 migrations + seed cleanly from a fresh DB

### Known cosmetic divergences (non-blocking)

- **Migration timestamp drift.** Local files have one set of timestamps (e.g. `20260420042012_org_diagnostic_enums.sql`); the production `schema_migrations` tracker has different timestamps (e.g. `20260420053024`) because the MCP applied them with apply-time stamps rather than file-name stamps. Functional impact: zero (all migrations are idempotent). If anyone runs `db:push` later, supabase will see local files as "new" and reapply them — they'll succeed as no-ops, leaving duplicate-name rows in `schema_migrations`. Aesthetic only.
- **Local `00079` rename, production keeps `00048`.** The renamed seed migration is local-only convenience to make `db:test:reset` work. Production still tracks `00048`. Same idempotency guarantee.

### Where to resume

The architecture doc (`docs/architecture/2026-04-20-org-assessment-architecture.md`) frames this work as the foundation of the MVP. Six remaining MVP workstreams; the recommended next one is **Item bank schema + scoring pipeline** (see "Recommended next step" in the resumption note below).

**Resumption note for the next session:**
1. Read this plan's "Status" section and `docs/architecture/2026-04-20-org-assessment-architecture.md` for context.
2. Check `AGENTS.md` "Naming Conventions" section before writing any new SQL — the codebase has rename traps.
3. The next plan should cover: `org_dimensions` + `org_diagnostic_items` + `org_diagnostic_responses` tables, the actual 16-dimension content, ~64 OPS items, reverse-keyed flagging, and the scoring pipeline (defining the `org_diagnostic_profiles.data` JSONB shape that this foundation left as opaque). Brainstorm before planning.
4. The Supabase MCP is the deploy path that worked from this dev IP; `npm run db:push` failed with Network Restrictions. Either get the IP allowlisted or continue using MCP.

---

## Pre-flight

Before starting any task, verify your local environment can run migrations and tests against a fresh DB:

- [ ] **Pre-flight: Verify local Supabase + tests work**

```bash
npm run db:test:start          # start local Supabase
npm run db:test:reset          # apply all existing migrations
npm run test:integration -- tests/integration/tenant-isolation.test.ts
```

Expected: Supabase comes up, migrations apply cleanly through `20260419000000_scrub_stale_talentfit_copy.sql`, RLS isolation tests pass. If any step fails, stop and resolve before continuing — every subsequent task assumes a working baseline.

---

## File Structure

**New files this plan creates:**

| Path | Purpose |
|------|---------|
| `supabase/migrations/<ts>_org_diagnostic_enums.sql` | All eight new enum types (no tables) |
| `supabase/migrations/<ts>_org_diagnostic_profiles.sql` | `org_diagnostic_profiles` table + indexes + RLS |
| `supabase/migrations/<ts>_client_roles.sql` | `client_roles` table + indexes + RLS |
| `supabase/migrations/<ts>_org_diagnostic_campaigns_and_tracks.sql` | `org_diagnostic_campaigns` + `org_diagnostic_campaign_tracks` + indexes + RLS |
| `supabase/migrations/<ts>_org_diagnostic_respondents.sql` | `org_diagnostic_respondents` table + indexes + RLS |
| `src/lib/org-diagnostic/validation.ts` | Pure functions for cross-table rules not expressible in DB constraints |
| `src/lib/org-diagnostic/index.ts` | Barrel export |
| `tests/unit/org-diagnostic/validation.test.ts` | Unit tests for the validation library |
| `tests/integration/org-diagnostic-rls.test.ts` | RLS verification (anonymity, multi-tenancy) |
| `tests/integration/org-diagnostic-lifecycle.test.ts` | Constraint and lifecycle integration tests |

**Files this plan modifies:**

| Path | Why |
|------|-----|
| `src/types/database.ts` | Add new enum unions + entity interfaces (hand-edited; no codegen in this project) |

**Note on timestamps in migration filenames:** use the timestamp at which you create each file, in `YYYYMMDDHHMMSS` UTC format. They MUST be in dependency order (enums → profiles → roles → campaigns_and_tracks → respondents), so create them in that order with at least 1-second gaps. Concrete example for a session starting at `2026-04-20 14:30:00 UTC`:

```
20260420143000_org_diagnostic_enums.sql
20260420143100_org_diagnostic_profiles.sql
20260420143200_client_roles.sql
20260420143300_org_diagnostic_campaigns_and_tracks.sql
20260420143400_org_diagnostic_respondents.sql
```

---

## Phase A — Database Migrations

These tasks ship the schema. The granularity is one migration per task because DDL doesn't TDD cleanly — instead each task writes the migration, applies it locally, runs a smoke check, and commits. The deeper testing comes in Phase C.

### Task A1: Enums migration

**Files:**
- Create: `supabase/migrations/<ts>_org_diagnostic_enums.sql`

- [ ] **Step 1: Write the migration**

Create the file with this exact content:

```sql
-- =========================================================================
-- <ts>_org_diagnostic_enums.sql
-- Enum types for the Organisational Diagnostics feature.
-- IDEMPOTENT: safe to re-run after partial application.
-- =========================================================================

DO $$ BEGIN
  CREATE TYPE org_diagnostic_campaign_kind AS ENUM ('baseline', 'role_rep');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_diagnostic_campaign_status AS ENUM ('draft', 'active', 'closed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_diagnostic_instrument AS ENUM ('OPS', 'LCQ', 'REP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_diagnostic_track_status AS ENUM ('pending', 'open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_diagnostic_respondent_type AS ENUM ('employee', 'senior_leader', 'hiring_manager', 'team_member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_diagnostic_respondent_status AS ENUM ('invited', 'in_progress', 'completed', 'withdrawn', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE org_diagnostic_profile_kind AS ENUM ('baseline', 'role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE client_role_status AS ENUM ('open', 'filled', 'closed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

- [ ] **Step 2: Apply locally and verify**

```bash
npm run db:test:reset
```

Expected: completes without error, all 102 (101 prior + 1 new) migrations applied.

- [ ] **Step 3: Smoke-check the enums exist**

```bash
npx supabase db diff --schema public --local
```

Expected: no diff. Then verify enums:

```bash
psql "$(npm run -s db:test:env | grep DB_URL | cut -d= -f2)" -c "\dT+ org_diagnostic_*; \dT+ client_role_status;"
```

Expected: lists all eight enums with their values.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/<ts>_org_diagnostic_enums.sql
git commit -m "feat(db): add org diagnostic enums"
```

---

### Task A2: `org_diagnostic_profiles` migration

**Files:**
- Create: `supabase/migrations/<ts>_org_diagnostic_profiles.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =========================================================================
-- <ts>_org_diagnostic_profiles.sql
-- Versioned, immutable snapshot of a client's diagnostic profile (org-level
-- or role-level). One row per closed campaign.
-- IDEMPOTENT.
-- =========================================================================

CREATE TABLE IF NOT EXISTS org_diagnostic_profiles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    campaign_id                 UUID NOT NULL,
    kind                        org_diagnostic_profile_kind NOT NULL,
    pinned_baseline_snapshot_id UUID REFERENCES org_diagnostic_profiles(id) ON DELETE RESTRICT,
    data                        JSONB NOT NULL,
    respondent_count            INT  NOT NULL CHECK (respondent_count >= 0),
    respondent_count_by_type    JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    generated_by                UUID REFERENCES profiles(id) ON DELETE SET NULL,

    CONSTRAINT org_diagnostic_profiles_campaign_unique UNIQUE (campaign_id),
    CONSTRAINT org_diagnostic_profiles_pin_consistency CHECK (
        (kind = 'role'     AND pinned_baseline_snapshot_id IS NOT NULL) OR
        (kind = 'baseline' AND pinned_baseline_snapshot_id IS NULL)
    )
);

COMMENT ON TABLE org_diagnostic_profiles IS
    'Immutable snapshot produced when an org diagnostic campaign closes. One row per campaign.';

-- The campaign_id FK is added in the campaigns migration (A4) because
-- org_diagnostic_campaigns does not exist yet at this point.

CREATE INDEX IF NOT EXISTS idx_org_diag_profiles_client_generated
    ON org_diagnostic_profiles (client_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_diag_profiles_client_kind_generated
    ON org_diagnostic_profiles (client_id, kind, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_diag_profiles_pinned
    ON org_diagnostic_profiles (pinned_baseline_snapshot_id)
    WHERE pinned_baseline_snapshot_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE org_diagnostic_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_diag_profiles_all_platform_admin ON org_diagnostic_profiles;
CREATE POLICY org_diag_profiles_all_platform_admin ON org_diagnostic_profiles
    FOR ALL TO authenticated USING (is_platform_admin());

DROP POLICY IF EXISTS org_diag_profiles_select_client ON org_diagnostic_profiles;
CREATE POLICY org_diag_profiles_select_client ON org_diagnostic_profiles
    FOR SELECT TO authenticated USING (
        is_platform_admin()
        OR client_id = auth_user_client_id()
        OR client_id IN (
            SELECT c.id FROM clients c
            WHERE c.partner_id = (SELECT partner_id FROM profiles WHERE id = auth.uid())
              AND c.deleted_at IS NULL
        )
    );
```

- [ ] **Step 2: Apply locally**

```bash
npm run db:test:reset
```

Expected: success.

- [ ] **Step 3: Smoke-check the table**

```bash
psql "$(npm run -s db:test:env | grep DB_URL | cut -d= -f2)" -c "\d+ org_diagnostic_profiles"
```

Expected: shows all columns, the unique constraint on `campaign_id`, the kind/pin consistency check, and three indexes.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/<ts>_org_diagnostic_profiles.sql
git commit -m "feat(db): add org_diagnostic_profiles table"
```

---

### Task A3: `client_roles` migration

**Files:**
- Create: `supabase/migrations/<ts>_client_roles.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =========================================================================
-- <ts>_client_roles.sql
-- A position the client is hiring for. Pinned at creation to a baseline
-- snapshot; pinning is read-only after creation except via the explicit
-- re-pin admin operation (see spec §3.4).
-- IDEMPOTENT.
-- =========================================================================

CREATE TABLE IF NOT EXISTS client_roles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    title                       TEXT NOT NULL,
    function                    TEXT,
    hiring_manager_name         TEXT,
    hiring_manager_email        CITEXT,
    pinned_baseline_snapshot_id UUID NOT NULL REFERENCES org_diagnostic_profiles(id) ON DELETE RESTRICT,
    status                      client_role_status NOT NULL DEFAULT 'open',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ,
    deleted_at                  TIMESTAMPTZ,
    created_by                  UUID REFERENCES profiles(id) ON DELETE SET NULL,

    CONSTRAINT client_roles_title_not_empty CHECK (char_length(trim(title)) > 0)
);

COMMENT ON TABLE client_roles IS
    'A hiring position for a client. Pinned to a baseline diagnostic snapshot at creation.';

CREATE INDEX IF NOT EXISTS idx_client_roles_client
    ON client_roles (client_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_roles_client_status
    ON client_roles (client_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_roles_pinned
    ON client_roles (pinned_baseline_snapshot_id);

CREATE TRIGGER set_client_roles_updated_at
    BEFORE UPDATE ON client_roles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE client_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_roles_all_platform_admin ON client_roles;
CREATE POLICY client_roles_all_platform_admin ON client_roles
    FOR ALL TO authenticated USING (is_platform_admin());

DROP POLICY IF EXISTS client_roles_select_client ON client_roles;
CREATE POLICY client_roles_select_client ON client_roles
    FOR SELECT TO authenticated USING (
        is_platform_admin()
        OR client_id = auth_user_client_id()
        OR client_id IN (
            SELECT c.id FROM clients c
            WHERE c.partner_id = (SELECT partner_id FROM profiles WHERE id = auth.uid())
              AND c.deleted_at IS NULL
        )
    );
```

- [ ] **Step 2: Apply locally**

```bash
npm run db:test:reset
```

Expected: success.

- [ ] **Step 3: Smoke-check**

```bash
psql "$(npm run -s db:test:env | grep DB_URL | cut -d= -f2)" -c "\d+ client_roles"
```

Expected: table exists with FK to `org_diagnostic_profiles`, RESTRICT on delete, indexes, trigger, RLS enabled.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/<ts>_client_roles.sql
git commit -m "feat(db): add client_roles table"
```

---

### Task A4: `org_diagnostic_campaigns` + tracks migration

**Files:**
- Create: `supabase/migrations/<ts>_org_diagnostic_campaigns_and_tracks.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =========================================================================
-- <ts>_org_diagnostic_campaigns_and_tracks.sql
-- Diagnostic campaigns (baseline or role_rep) and the per-instrument tracks
-- inside them. Also adds the deferred FK from org_diagnostic_profiles.
-- IDEMPOTENT.
-- =========================================================================

CREATE TABLE IF NOT EXISTS org_diagnostic_campaigns (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    kind                        org_diagnostic_campaign_kind NOT NULL,
    client_role_id              UUID REFERENCES client_roles(id) ON DELETE RESTRICT,
    pinned_baseline_snapshot_id UUID REFERENCES org_diagnostic_profiles(id) ON DELETE RESTRICT,
    title                       TEXT NOT NULL,
    description                 TEXT,
    status                      org_diagnostic_campaign_status NOT NULL DEFAULT 'draft',
    default_opens_at            TIMESTAMPTZ,
    default_closes_at           TIMESTAMPTZ,
    closed_at                   TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ,
    deleted_at                  TIMESTAMPTZ,
    created_by                  UUID REFERENCES profiles(id) ON DELETE SET NULL,

    CONSTRAINT org_diag_campaigns_title_not_empty CHECK (char_length(trim(title)) > 0),
    CONSTRAINT org_diag_campaigns_dates_valid CHECK (
        default_closes_at IS NULL OR default_opens_at IS NULL OR default_closes_at > default_opens_at
    ),
    CONSTRAINT org_diag_campaigns_kind_consistency CHECK (
        (kind = 'role_rep' AND client_role_id IS NOT NULL AND pinned_baseline_snapshot_id IS NOT NULL)
        OR
        (kind = 'baseline' AND client_role_id IS NULL AND pinned_baseline_snapshot_id IS NULL)
    )
);

COMMENT ON TABLE org_diagnostic_campaigns IS
    'Container for an org diagnostic data-collection round. Either baseline (OPS+/-LCQ) or role_rep.';

CREATE INDEX IF NOT EXISTS idx_org_diag_campaigns_client
    ON org_diagnostic_campaigns (client_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_org_diag_campaigns_status
    ON org_diagnostic_campaigns (status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_org_diag_campaigns_role
    ON org_diagnostic_campaigns (client_role_id) WHERE client_role_id IS NOT NULL;

CREATE TRIGGER set_org_diag_campaigns_updated_at
    BEFORE UPDATE ON org_diagnostic_campaigns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Tracks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_diagnostic_campaign_tracks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES org_diagnostic_campaigns(id) ON DELETE CASCADE,
    instrument          org_diagnostic_instrument NOT NULL,
    opens_at            TIMESTAMPTZ,
    closes_at           TIMESTAMPTZ,
    status              org_diagnostic_track_status NOT NULL DEFAULT 'pending',
    closed_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ,

    CONSTRAINT org_diag_tracks_unique UNIQUE (campaign_id, instrument),
    CONSTRAINT org_diag_tracks_dates_valid CHECK (
        closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at
    )
);

COMMENT ON TABLE org_diagnostic_campaign_tracks IS
    'Per-instrument lifecycle inside a diagnostic campaign. Inherits campaign-level dates if its own are NULL.';

CREATE INDEX IF NOT EXISTS idx_org_diag_tracks_campaign
    ON org_diagnostic_campaign_tracks (campaign_id);

CREATE INDEX IF NOT EXISTS idx_org_diag_tracks_status_close
    ON org_diagnostic_campaign_tracks (status, closes_at);

CREATE TRIGGER set_org_diag_tracks_updated_at
    BEFORE UPDATE ON org_diagnostic_campaign_tracks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Deferred FK on org_diagnostic_profiles.campaign_id (added now that the
-- referenced table exists). RESTRICT so a campaign with a snapshot cannot
-- be hard-deleted accidentally.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE org_diagnostic_profiles
    ADD CONSTRAINT org_diag_profiles_campaign_fk
    FOREIGN KEY (campaign_id) REFERENCES org_diagnostic_campaigns(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- RLS — campaigns
-- ---------------------------------------------------------------------------
ALTER TABLE org_diagnostic_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_diag_campaigns_all_platform_admin ON org_diagnostic_campaigns;
CREATE POLICY org_diag_campaigns_all_platform_admin ON org_diagnostic_campaigns
    FOR ALL TO authenticated USING (is_platform_admin());

DROP POLICY IF EXISTS org_diag_campaigns_select_client ON org_diagnostic_campaigns;
CREATE POLICY org_diag_campaigns_select_client ON org_diagnostic_campaigns
    FOR SELECT TO authenticated USING (
        is_platform_admin()
        OR client_id = auth_user_client_id()
        OR client_id IN (
            SELECT c.id FROM clients c
            WHERE c.partner_id = (SELECT partner_id FROM profiles WHERE id = auth.uid())
              AND c.deleted_at IS NULL
        )
    );

-- ---------------------------------------------------------------------------
-- RLS — tracks (follow campaign access)
-- ---------------------------------------------------------------------------
ALTER TABLE org_diagnostic_campaign_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_diag_tracks_all_platform_admin ON org_diagnostic_campaign_tracks;
CREATE POLICY org_diag_tracks_all_platform_admin ON org_diagnostic_campaign_tracks
    FOR ALL TO authenticated USING (is_platform_admin());

DROP POLICY IF EXISTS org_diag_tracks_select_via_campaign ON org_diagnostic_campaign_tracks;
CREATE POLICY org_diag_tracks_select_via_campaign ON org_diagnostic_campaign_tracks
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM org_diagnostic_campaigns c
            WHERE c.id = campaign_id
              AND (
                  is_platform_admin()
                  OR c.client_id = auth_user_client_id()
                  OR c.client_id IN (
                      SELECT cl.id FROM clients cl
                      WHERE cl.partner_id = (SELECT partner_id FROM profiles WHERE id = auth.uid())
                        AND cl.deleted_at IS NULL
                  )
              )
        )
    );
```

- [ ] **Step 2: Apply locally**

```bash
npm run db:test:reset
```

Expected: success.

- [ ] **Step 3: Smoke-check both tables and the deferred FK**

```bash
psql "$(npm run -s db:test:env | grep DB_URL | cut -d= -f2)" \
  -c "\d+ org_diagnostic_campaigns" \
  -c "\d+ org_diagnostic_campaign_tracks" \
  -c "SELECT conname FROM pg_constraint WHERE conname = 'org_diag_profiles_campaign_fk';"
```

Expected: both tables present, all indexes/triggers present, the deferred FK on profiles is now in place.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/<ts>_org_diagnostic_campaigns_and_tracks.sql
git commit -m "feat(db): add org_diagnostic_campaigns and tracks"
```

---

### Task A5: `org_diagnostic_respondents` migration

**Files:**
- Create: `supabase/migrations/<ts>_org_diagnostic_respondents.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =========================================================================
-- <ts>_org_diagnostic_respondents.sql
-- People invited to complete one instrument within one campaign. Token-based
-- access (no Supabase Auth required). RLS deliberately denies SELECT to
-- client members — see spec §1.6 anonymity contract.
-- IDEMPOTENT.
-- =========================================================================

CREATE TABLE IF NOT EXISTS org_diagnostic_respondents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL REFERENCES org_diagnostic_campaigns(id) ON DELETE CASCADE,
    track_id            UUID NOT NULL REFERENCES org_diagnostic_campaign_tracks(id) ON DELETE CASCADE,
    respondent_type     org_diagnostic_respondent_type NOT NULL,
    name                TEXT,
    email               CITEXT NOT NULL,
    access_token        TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    status              org_diagnostic_respondent_status NOT NULL DEFAULT 'invited',
    invited_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ,

    CONSTRAINT org_diag_respondents_email_per_campaign UNIQUE (campaign_id, email),
    CONSTRAINT org_diag_respondents_token_unique UNIQUE (access_token),
    CONSTRAINT org_diag_respondents_dates_valid CHECK (
        completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
    )
);

COMMENT ON TABLE org_diagnostic_respondents IS
    'Invitee for one instrument in one diagnostic campaign. Identity hidden from client admins per anonymity contract.';

CREATE INDEX IF NOT EXISTS idx_org_diag_respondents_campaign
    ON org_diagnostic_respondents (campaign_id);

CREATE INDEX IF NOT EXISTS idx_org_diag_respondents_track
    ON org_diagnostic_respondents (track_id);

CREATE INDEX IF NOT EXISTS idx_org_diag_respondents_email
    ON org_diagnostic_respondents (email);

CREATE INDEX IF NOT EXISTS idx_org_diag_respondents_status
    ON org_diagnostic_respondents (status);

CREATE TRIGGER set_org_diag_respondents_updated_at
    BEFORE UPDATE ON org_diagnostic_respondents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- IMPORTANT: client members get NO SELECT policy. RLS denies by default when
-- no matching policy exists. This enforces the anonymity contract.
-- ---------------------------------------------------------------------------
ALTER TABLE org_diagnostic_respondents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_diag_respondents_all_platform_admin ON org_diagnostic_respondents;
CREATE POLICY org_diag_respondents_all_platform_admin ON org_diagnostic_respondents
    FOR ALL TO authenticated USING (is_platform_admin());
```

- [ ] **Step 2: Apply locally**

```bash
npm run db:test:reset
```

Expected: success. All five org-diagnostic migrations should now apply cleanly from a fresh DB.

- [ ] **Step 3: Smoke-check**

```bash
psql "$(npm run -s db:test:env | grep DB_URL | cut -d= -f2)" -c "\d+ org_diagnostic_respondents"
psql "$(npm run -s db:test:env | grep DB_URL | cut -d= -f2)" -c "SELECT polname FROM pg_policy WHERE polrelid = 'org_diagnostic_respondents'::regclass;"
```

Expected: table exists with all columns/indexes/trigger; **only one policy listed**: `org_diag_respondents_all_platform_admin`. If a SELECT policy for clients shows up, that's a bug — remove it before committing.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/<ts>_org_diagnostic_respondents.sql
git commit -m "feat(db): add org_diagnostic_respondents with anonymity-by-default RLS"
```

---

## Phase B — TypeScript Types

`src/types/database.ts` is hand-maintained — there's no codegen. The new types follow the existing convention: `camelCase` property names, JSDoc per property, `created_at`/`updated_at` in snake_case, `deletedAt` in camelCase (the existing inconsistency, mirror it for consistency with siblings).

### Task B1: Add the new enum types and interfaces

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add the new enum unions**

Add these near the other enum unions (near lines 50-80, alongside `CampaignStatus` etc.). Group them under a header comment for findability:

```typescript
// ---------------------------------------------------------------------------
// Org Diagnostic Enums
// ---------------------------------------------------------------------------

/** Kind of diagnostic campaign. */
export type OrgDiagnosticCampaignKind = 'baseline' | 'role_rep'

/** Lifecycle status of a diagnostic campaign. */
export type OrgDiagnosticCampaignStatus = 'draft' | 'active' | 'closed' | 'archived'

/** The instrument administered within a track. */
export type OrgDiagnosticInstrument = 'OPS' | 'LCQ' | 'REP'

/** Lifecycle status of an instrument track. */
export type OrgDiagnosticTrackStatus = 'pending' | 'open' | 'closed'

/** The role/perspective of a respondent. Determines which instrument they see. */
export type OrgDiagnosticRespondentType =
  | 'employee'
  | 'senior_leader'
  | 'hiring_manager'
  | 'team_member'

/** Progress of a respondent through their assigned instrument. */
export type OrgDiagnosticRespondentStatus =
  | 'invited'
  | 'in_progress'
  | 'completed'
  | 'withdrawn'
  | 'expired'

/** Kind of profile snapshot — mirrors campaign kind. */
export type OrgDiagnosticProfileKind = 'baseline' | 'role'

/** Lifecycle status of a hiring role at a client. */
export type ClientRoleStatus = 'open' | 'filled' | 'closed' | 'archived'
```

- [ ] **Step 2: Add the entity interfaces**

Add these at the end of the existing entity-interface section (after `CampaignAccessLink` around line 1660; before the Brand Configuration header). Match the JSDoc style of `Campaign` and `CampaignParticipant`:

```typescript
// ---------------------------------------------------------------------------
// Org Diagnostic Entities
// ---------------------------------------------------------------------------

/**
 * Versioned, immutable snapshot of a client's diagnostic profile (org-level
 * or role-level). Produced when a campaign closes.
 */
export interface OrgDiagnosticProfile {
  /** UUID primary key. */
  id: string
  /** Owning client. */
  clientId: string
  /** Source campaign (1:1). */
  campaignId: string
  /** baseline (from a baseline campaign) or role (from a role_rep campaign). */
  kind: OrgDiagnosticProfileKind
  /** For role-kind snapshots: the baseline snapshot this role is anchored to. */
  pinnedBaselineSnapshotId?: string
  /** Composite snapshot data — per-respondent-type aggregates + gap analysis. Internal shape defined by the future scoring spec. */
  data: Record<string, unknown>
  /** Total respondents whose data is included. */
  respondentCount: number
  /** Per-type counts, e.g. { employee: 24, senior_leader: 6 }. */
  respondentCountByType: Record<OrgDiagnosticRespondentType, number> | Record<string, number>
  /** When the snapshot was generated. */
  generatedAt: string
  /** Profile ID of the user who triggered generation. */
  generatedBy?: string
}

/**
 * A position the client is hiring for. Pinned at creation to a baseline
 * diagnostic snapshot; the pin is read-only after creation except via the
 * explicit re-pin admin operation (see spec §3.4).
 */
export interface ClientRole {
  /** UUID primary key. */
  id: string
  /** Owning client. */
  clientId: string
  /** Role title, e.g. "Head of Product". */
  title: string
  /** Department/function, free text in MVP. */
  function?: string
  /** Hiring manager display name. */
  hiringManagerName?: string
  /** Hiring manager email (CITEXT). */
  hiringManagerEmail?: string
  /** Baseline snapshot this role is locked to. */
  pinnedBaselineSnapshotId: string
  /** Lifecycle status. */
  status: ClientRoleStatus
  created_at: string
  updated_at?: string
  /** Soft-delete timestamp. */
  deletedAt?: string
  /** Profile ID of creator. */
  createdBy?: string
}

/**
 * A diagnostic data-collection campaign (baseline or role_rep). Holds N
 * instrument tracks and N respondents. Produces one OrgDiagnosticProfile
 * snapshot when closed.
 */
export interface OrgDiagnosticCampaign {
  /** UUID primary key. */
  id: string
  /** Owning client. */
  clientId: string
  /** baseline = OPS+/-LCQ; role_rep = REP for one role. */
  kind: OrgDiagnosticCampaignKind
  /** For role_rep campaigns: the role being assessed. NULL for baseline. */
  clientRoleId?: string
  /** For role_rep campaigns: the baseline snapshot this campaign anchors to. NULL for baseline. */
  pinnedBaselineSnapshotId?: string
  /** Display title. */
  title: string
  /** Optional description. */
  description?: string
  /** Lifecycle status. */
  status: OrgDiagnosticCampaignStatus
  /** Default open date — tracks inherit if their own opens_at is NULL. */
  defaultOpensAt?: string
  /** Default close date — tracks inherit if their own closes_at is NULL. */
  defaultClosesAt?: string
  /** Set when status transitions to 'closed'. */
  closedAt?: string
  created_at: string
  updated_at?: string
  /** Soft-delete timestamp. */
  deletedAt?: string
  /** Profile ID of creator. */
  createdBy?: string
}

/**
 * Per-instrument track inside a campaign. One track per instrument the
 * campaign is administering. Inherits campaign-level dates if its own are
 * NULL.
 */
export interface OrgDiagnosticCampaignTrack {
  /** UUID primary key. */
  id: string
  /** Parent campaign. */
  campaignId: string
  /** The instrument administered in this track. */
  instrument: OrgDiagnosticInstrument
  /** Override open date — falls back to campaign default. */
  opensAt?: string
  /** Override close date — falls back to campaign default. */
  closesAt?: string
  /** Track lifecycle. */
  status: OrgDiagnosticTrackStatus
  /** Set when status transitions to 'closed'. */
  closedAt?: string
  created_at: string
  updated_at?: string
}

/**
 * A person invited to complete one instrument in one diagnostic campaign.
 * Token-based access — no Supabase Auth required. Identity is hidden from
 * client admins per the anonymity contract (spec §1.6).
 */
export interface OrgDiagnosticRespondent {
  /** UUID primary key. */
  id: string
  /** Parent campaign. */
  campaignId: string
  /** Track within that campaign — determines which instrument this respondent sees. */
  trackId: string
  /** Respondent's role/perspective. */
  respondentType: OrgDiagnosticRespondentType
  /** Display name (optional — may be missing from CSV upload). */
  name?: string
  /** Email (CITEXT in DB). */
  email: string
  /** Unique 64-char hex token used as URL identifier. */
  accessToken: string
  /** Progress status. */
  status: OrgDiagnosticRespondentStatus
  /** When the invitation was created. */
  invitedAt: string
  /** When the respondent first opened the survey. */
  startedAt?: string
  /** When the respondent finished. */
  completedAt?: string
  created_at: string
  updated_at?: string
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: passes with no errors. If any property type clashes with another use, fix it before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(types): add org diagnostic enums and entity interfaces"
```

---

## Phase C — Validation Helper Library

The spec specifies several cross-table rules that cannot be expressed cleanly in DB constraints (you'd need triggers with cross-table joins, which the existing codebase avoids). They live in a small pure-function library so future server actions have one canonical place to call them. Pure functions = trivially unit-testable.

**Important MVP framing:** because this plan does not include any admin UI or server actions (out of scope per the spec), the validation library will exist with zero callers when this plan completes. That is intentional and correct: the rules are tested in isolation, the API surface is locked, and the next plan (admin UI) imports them. Until that next plan lands, the rules are technically unenforced at runtime — but that's safe because the only writer to these tables in MVP is the test suite and the eventual admin code path that will import this module from day one.

### Task C1: Create the validation module skeleton

**Files:**
- Create: `src/lib/org-diagnostic/index.ts`
- Create: `src/lib/org-diagnostic/validation.ts`

- [ ] **Step 1: Create the barrel**

```typescript
// src/lib/org-diagnostic/index.ts
export * from './validation'
```

- [ ] **Step 2: Create the validation module with type-only stubs**

```typescript
// src/lib/org-diagnostic/validation.ts
/**
 * Cross-table validation rules for the Org Diagnostic feature.
 *
 * These rules cannot be enforced as DB constraints without cross-table
 * triggers (which the codebase avoids). They live here as pure functions
 * so that any server action mutating org-diagnostic rows has one canonical
 * place to call them.
 *
 * Each function returns a discriminated union:
 *   { ok: true } | { ok: false; error: string }
 *
 * Callers choose how to surface the error (form validation, server-action
 * thrown error, etc.).
 */

import type {
  OrgDiagnosticCampaignKind,
  OrgDiagnosticInstrument,
  OrgDiagnosticProfileKind,
  OrgDiagnosticRespondentType,
} from '@/types/database'

export type ValidationResult = { ok: true } | { ok: false; error: string }

const RESPONDENT_TYPE_TO_INSTRUMENT: Record<OrgDiagnosticRespondentType, OrgDiagnosticInstrument> = {
  employee: 'OPS',
  senior_leader: 'LCQ',
  hiring_manager: 'REP',
  team_member: 'REP',
}

// Function signatures only for now — implemented in subsequent tasks.
export function validateTrackInstrumentForCampaignKind(
  campaignKind: OrgDiagnosticCampaignKind,
  trackInstrument: OrgDiagnosticInstrument,
): ValidationResult {
  throw new Error('not implemented')
}

export function validateRespondentTypeMatchesTrack(
  respondentType: OrgDiagnosticRespondentType,
  trackInstrument: OrgDiagnosticInstrument,
): ValidationResult {
  throw new Error('not implemented')
}

export function validateRolePinTarget(
  snapshot: { clientId: string; kind: OrgDiagnosticProfileKind },
  role: { clientId: string },
): ValidationResult {
  throw new Error('not implemented')
}

export function validateRoleRepCampaignTrackCount(trackCount: number): ValidationResult {
  throw new Error('not implemented')
}

// Re-export the constant for callers that want to compute the mapping themselves.
export { RESPONDENT_TYPE_TO_INSTRUMENT }
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/org-diagnostic/
git commit -m "feat(org-diagnostic): scaffold validation library"
```

---

### Task C2: Implement `validateTrackInstrumentForCampaignKind` (TDD)

**Files:**
- Create: `tests/unit/org-diagnostic/validation.test.ts`
- Modify: `src/lib/org-diagnostic/validation.ts`

Rule: baseline campaigns may only have OPS or LCQ tracks. Role_rep campaigns may only have REP tracks.

- [ ] **Step 1: Write failing tests**

Create `tests/unit/org-diagnostic/validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateTrackInstrumentForCampaignKind } from '@/lib/org-diagnostic/validation'

describe('validateTrackInstrumentForCampaignKind', () => {
  it('allows OPS in a baseline campaign', () => {
    expect(validateTrackInstrumentForCampaignKind('baseline', 'OPS')).toEqual({ ok: true })
  })

  it('allows LCQ in a baseline campaign', () => {
    expect(validateTrackInstrumentForCampaignKind('baseline', 'LCQ')).toEqual({ ok: true })
  })

  it('rejects REP in a baseline campaign', () => {
    const result = validateTrackInstrumentForCampaignKind('baseline', 'REP')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/baseline.*REP/i)
  })

  it('allows REP in a role_rep campaign', () => {
    expect(validateTrackInstrumentForCampaignKind('role_rep', 'REP')).toEqual({ ok: true })
  })

  it('rejects OPS in a role_rep campaign', () => {
    const result = validateTrackInstrumentForCampaignKind('role_rep', 'OPS')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/role_rep.*OPS/i)
  })

  it('rejects LCQ in a role_rep campaign', () => {
    const result = validateTrackInstrumentForCampaignKind('role_rep', 'LCQ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/role_rep.*LCQ/i)
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm run test:unit -- tests/unit/org-diagnostic/validation.test.ts
```

Expected: all 6 tests fail with "not implemented" thrown errors.

- [ ] **Step 3: Implement**

In `src/lib/org-diagnostic/validation.ts`, replace the `validateTrackInstrumentForCampaignKind` body:

```typescript
export function validateTrackInstrumentForCampaignKind(
  campaignKind: OrgDiagnosticCampaignKind,
  trackInstrument: OrgDiagnosticInstrument,
): ValidationResult {
  const allowed: Record<OrgDiagnosticCampaignKind, OrgDiagnosticInstrument[]> = {
    baseline: ['OPS', 'LCQ'],
    role_rep: ['REP'],
  }

  if (!allowed[campaignKind].includes(trackInstrument)) {
    return {
      ok: false,
      error: `Instrument ${trackInstrument} is not permitted on a ${campaignKind} campaign (allowed: ${allowed[campaignKind].join(', ')}).`,
    }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npm run test:unit -- tests/unit/org-diagnostic/validation.test.ts
```

Expected: all 6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/org-diagnostic/validation.ts tests/unit/org-diagnostic/validation.test.ts
git commit -m "feat(org-diagnostic): validate track instrument matches campaign kind"
```

---

### Task C3: Implement `validateRespondentTypeMatchesTrack` (TDD)

Rule: a respondent's type implies an instrument. Their assigned track must serve that instrument.

- [ ] **Step 1: Add failing tests**

Append to `tests/unit/org-diagnostic/validation.test.ts`:

```typescript
import { validateRespondentTypeMatchesTrack } from '@/lib/org-diagnostic/validation'

describe('validateRespondentTypeMatchesTrack', () => {
  it('allows employee on OPS track', () => {
    expect(validateRespondentTypeMatchesTrack('employee', 'OPS')).toEqual({ ok: true })
  })

  it('allows senior_leader on LCQ track', () => {
    expect(validateRespondentTypeMatchesTrack('senior_leader', 'LCQ')).toEqual({ ok: true })
  })

  it('allows hiring_manager on REP track', () => {
    expect(validateRespondentTypeMatchesTrack('hiring_manager', 'REP')).toEqual({ ok: true })
  })

  it('allows team_member on REP track', () => {
    expect(validateRespondentTypeMatchesTrack('team_member', 'REP')).toEqual({ ok: true })
  })

  it('rejects employee on LCQ track', () => {
    const result = validateRespondentTypeMatchesTrack('employee', 'LCQ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/employee.*OPS/i)
  })

  it('rejects senior_leader on OPS track', () => {
    const result = validateRespondentTypeMatchesTrack('senior_leader', 'OPS')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/senior_leader.*LCQ/i)
  })

  it('rejects hiring_manager on OPS track', () => {
    const result = validateRespondentTypeMatchesTrack('hiring_manager', 'OPS')
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests, verify failures**

```bash
npm run test:unit -- tests/unit/org-diagnostic/validation.test.ts
```

Expected: 7 new tests fail, prior 6 still pass.

- [ ] **Step 3: Implement**

Replace the `validateRespondentTypeMatchesTrack` body:

```typescript
export function validateRespondentTypeMatchesTrack(
  respondentType: OrgDiagnosticRespondentType,
  trackInstrument: OrgDiagnosticInstrument,
): ValidationResult {
  const expected = RESPONDENT_TYPE_TO_INSTRUMENT[respondentType]

  if (expected !== trackInstrument) {
    return {
      ok: false,
      error: `Respondent type ${respondentType} requires a ${expected} track (got ${trackInstrument}).`,
    }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Expected: all 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/org-diagnostic/validation.ts tests/unit/org-diagnostic/validation.test.ts
git commit -m "feat(org-diagnostic): validate respondent type matches track instrument"
```

---

### Task C4: Implement `validateRolePinTarget` (TDD)

Rule: a role can only pin to a snapshot whose `clientId` matches the role's `clientId` AND whose `kind = 'baseline'`.

- [ ] **Step 1: Add failing tests**

Append:

```typescript
import { validateRolePinTarget } from '@/lib/org-diagnostic/validation'

describe('validateRolePinTarget', () => {
  it('allows pin when client matches and snapshot is baseline', () => {
    expect(
      validateRolePinTarget(
        { clientId: 'c1', kind: 'baseline' },
        { clientId: 'c1' },
      ),
    ).toEqual({ ok: true })
  })

  it('rejects pin when snapshot belongs to a different client', () => {
    const result = validateRolePinTarget(
      { clientId: 'c2', kind: 'baseline' },
      { clientId: 'c1' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/client/i)
  })

  it('rejects pin to a role-kind snapshot', () => {
    const result = validateRolePinTarget(
      { clientId: 'c1', kind: 'role' },
      { clientId: 'c1' },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/baseline/i)
  })
})
```

- [ ] **Step 2: Run, verify failures**

- [ ] **Step 3: Implement**

```typescript
export function validateRolePinTarget(
  snapshot: { clientId: string; kind: OrgDiagnosticProfileKind },
  role: { clientId: string },
): ValidationResult {
  if (snapshot.clientId !== role.clientId) {
    return {
      ok: false,
      error: `Cannot pin role to a snapshot from a different client (snapshot client ${snapshot.clientId} ≠ role client ${role.clientId}).`,
    }
  }

  if (snapshot.kind !== 'baseline') {
    return {
      ok: false,
      error: `Roles may only pin to baseline snapshots (got kind=${snapshot.kind}).`,
    }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(org-diagnostic): validate role pin target snapshot"
```

---

### Task C5: Implement `validateRoleRepCampaignTrackCount` (TDD)

Rule: a role_rep campaign must have exactly one track. (Spec §2.2.)

- [ ] **Step 1: Add failing tests**

Append:

```typescript
import { validateRoleRepCampaignTrackCount } from '@/lib/org-diagnostic/validation'

describe('validateRoleRepCampaignTrackCount', () => {
  it('allows exactly one track', () => {
    expect(validateRoleRepCampaignTrackCount(1)).toEqual({ ok: true })
  })

  it('rejects zero tracks', () => {
    const result = validateRoleRepCampaignTrackCount(0)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/exactly one/i)
  })

  it('rejects more than one track', () => {
    const result = validateRoleRepCampaignTrackCount(2)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/exactly one/i)
  })
})
```

- [ ] **Step 2: Run, verify failures**

- [ ] **Step 3: Implement**

```typescript
export function validateRoleRepCampaignTrackCount(trackCount: number): ValidationResult {
  if (trackCount !== 1) {
    return {
      ok: false,
      error: `A role_rep campaign must have exactly one track (got ${trackCount}).`,
    }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(org-diagnostic): validate role_rep campaign track count"
```

---

## Phase D — RLS Verification Tests

These tests are the security contract in code form. Mirror the structure of `tests/integration/tenant-isolation.test.ts` for fixture setup. The most important test in the entire plan is the anonymity test in Task D3 — if that breaks, ship is blocked.

Each test sets up the same fixture: two partners, three clients (two under partner A, one under partner B), test users at each role level. Each test then verifies a specific access boundary.

### Task D1: RLS test scaffold and setup

**Files:**
- Create: `tests/integration/org-diagnostic-rls.test.ts`

- [ ] **Step 1: Write the scaffold**

Create the file with imports, env loading, fixture types, and the `describe.skipIf(!canRun)` wrapper, mirroring `tests/integration/tenant-isolation.test.ts`. Use the `createTestUser()` helper pattern from that file.

```typescript
/**
 * RLS verification tests for the Org Diagnostic feature.
 *
 * The anonymity contract (spec §1.6) is the most important assertion: client
 * members must NEVER be able to SELECT from org_diagnostic_respondents,
 * even for their own client.
 *
 * Mirrors the fixture and helper patterns of tests/integration/tenant-isolation.test.ts.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// (Reuse the loadEnvFile, testEmail, testSlug, createTestUser helpers from
// tenant-isolation.test.ts. If their copy-paste burden is high, the cleanup
// is to extract them to tests/integration/_helpers/rls-fixture.ts in a
// follow-up — out of scope for this task.)

// ... [scaffold continues — see tenant-isolation.test.ts for the pattern]

const TEST_PASSWORD = 'test-rls-org-diag-pw-123!'
const ts = Date.now()
function testEmail(label: string) { return `rls-orgdiag-${label}-${ts}@test.local` }
function testSlug(label: string) { return `rls-orgdiag-${label}-${ts}` }

// Skip the entire suite if env not present.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const canRun = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY && SUPABASE_ANON_KEY)

describe.skipIf(!canRun)('Org Diagnostic RLS', () => {
  // Suite implementation in subsequent tasks
  it('placeholder — scaffold smoke', () => {
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 2: Run, verify it executes**

```bash
npm run test:integration -- tests/integration/org-diagnostic-rls.test.ts
```

Expected: 1 placeholder test passes (or skipped if env not set).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/org-diagnostic-rls.test.ts
git commit -m "test(org-diagnostic): scaffold RLS test file"
```

---

### Task D2: RLS test — fixture builder

**Files:**
- Modify: `tests/integration/org-diagnostic-rls.test.ts`

- [ ] **Step 1: Add `beforeAll`/`afterAll` fixture setup**

The fixture creates: one partner, two clients (`clientA`, `clientB`), one platform_admin user, one client_admin scoped to clientA, one client_admin scoped to clientB. Then for clientA: one baseline snapshot, one campaign in `closed` status, one track, two respondents.

Replace the `describe.skipIf(!canRun)` body with:

```typescript
describe.skipIf(!canRun)('Org Diagnostic RLS', () => {
  let admin: SupabaseClient
  const fixture: {
    partnerId?: string
    clientAId?: string
    clientBId?: string
    platformAdminClient?: SupabaseClient
    clientAAdminClient?: SupabaseClient
    clientBAdminClient?: SupabaseClient
    snapshotAId?: string
    campaignAId?: string
    trackAId?: string
    respondent1Id?: string
    respondent2Id?: string
    roleAId?: string
  } = {}

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)

    // Create partner
    const { data: partner } = await admin.from('partners').insert({
      name: `RLS Org-Diag Partner ${ts}`,
      slug: testSlug('partner'),
    }).select('id').single()
    fixture.partnerId = partner!.id

    // Create two clients under that partner
    const { data: cA } = await admin.from('clients').insert({
      name: `Client A ${ts}`, slug: testSlug('clientA'), partner_id: fixture.partnerId,
    }).select('id').single()
    const { data: cB } = await admin.from('clients').insert({
      name: `Client B ${ts}`, slug: testSlug('clientB'), partner_id: fixture.partnerId,
    }).select('id').single()
    fixture.clientAId = cA!.id
    fixture.clientBId = cB!.id

    // Create test users
    const platformAdmin = await createTestUser(admin, { email: testEmail('platform'), role: 'platform_admin' })
    fixture.platformAdminClient = platformAdmin.client
    const clientAAdmin = await createTestUser(admin, { email: testEmail('clientA-admin'), role: 'org_admin', clientId: fixture.clientAId })
    fixture.clientAAdminClient = clientAAdmin.client
    const clientBAdmin = await createTestUser(admin, { email: testEmail('clientB-admin'), role: 'org_admin', clientId: fixture.clientBId })
    fixture.clientBAdminClient = clientBAdmin.client

    // Seed: baseline snapshot for clientA
    const { data: snapA } = await admin.from('org_diagnostic_profiles').insert({
      client_id: fixture.clientAId,
      campaign_id: '00000000-0000-0000-0000-000000000001', // placeholder; will be updated below
      kind: 'baseline',
      data: { _placeholder: true },
      respondent_count: 0,
      respondent_count_by_type: {},
    }).select('id').single()
    fixture.snapshotAId = snapA!.id

    // Baseline campaign for clientA in 'closed' state. Campaign must exist
    // before we can FK the snapshot to it; reorder: create campaign first,
    // then snapshot. Adjust the seed:
    const { data: campA } = await admin.from('org_diagnostic_campaigns').insert({
      client_id: fixture.clientAId,
      kind: 'baseline',
      title: 'Test Baseline Campaign A',
      status: 'closed',
    }).select('id').single()
    fixture.campaignAId = campA!.id

    // Update snapshot to point at the campaign (resolves the placeholder)
    await admin.from('org_diagnostic_profiles').update({ campaign_id: fixture.campaignAId }).eq('id', fixture.snapshotAId)

    // Track for the campaign
    const { data: trackA } = await admin.from('org_diagnostic_campaign_tracks').insert({
      campaign_id: fixture.campaignAId,
      instrument: 'OPS',
      status: 'closed',
    }).select('id').single()
    fixture.trackAId = trackA!.id

    // Two respondents
    const { data: r1 } = await admin.from('org_diagnostic_respondents').insert({
      campaign_id: fixture.campaignAId,
      track_id: fixture.trackAId,
      respondent_type: 'employee',
      email: `r1-${ts}@test.local`,
    }).select('id').single()
    const { data: r2 } = await admin.from('org_diagnostic_respondents').insert({
      campaign_id: fixture.campaignAId,
      track_id: fixture.trackAId,
      respondent_type: 'employee',
      email: `r2-${ts}@test.local`,
    }).select('id').single()
    fixture.respondent1Id = r1!.id
    fixture.respondent2Id = r2!.id

    // Role for clientA pinned to the snapshot
    const { data: role } = await admin.from('client_roles').insert({
      client_id: fixture.clientAId,
      title: 'Test Role A',
      pinned_baseline_snapshot_id: fixture.snapshotAId,
    }).select('id').single()
    fixture.roleAId = role!.id
  })

  afterAll(async () => {
    // Cascade-delete via clients (RESTRICT FKs may prevent this — handle in order):
    if (fixture.roleAId) await admin.from('client_roles').delete().eq('id', fixture.roleAId)
    // Snapshot can only be deleted now that no role pins it
    if (fixture.snapshotAId) await admin.from('org_diagnostic_profiles').delete().eq('id', fixture.snapshotAId)
    // Campaigns cascade-delete tracks and respondents on DELETE
    if (fixture.campaignAId) await admin.from('org_diagnostic_campaigns').delete().eq('id', fixture.campaignAId)
    if (fixture.clientAId) await admin.from('clients').delete().eq('id', fixture.clientAId)
    if (fixture.clientBId) await admin.from('clients').delete().eq('id', fixture.clientBId)
    if (fixture.partnerId) await admin.from('partners').delete().eq('id', fixture.partnerId)
    // Note: auth users created by createTestUser must be cleaned up too — see tenant-isolation.test.ts for the pattern.
  })

  // (Tests come in subsequent tasks)
})
```

(Note: the `createTestUser` helper from `tenant-isolation.test.ts` needs to be either copied into this file or extracted. Copy-paste for now to keep this task self-contained; the extraction is a follow-up.)

- [ ] **Step 2: Run, verify the fixture sets up cleanly**

```bash
npm run test:integration -- tests/integration/org-diagnostic-rls.test.ts
```

Expected: placeholder test still passes; no errors during `beforeAll`.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/org-diagnostic-rls.test.ts
git commit -m "test(org-diagnostic): RLS fixture builder"
```

---

### Task D3: RLS test — anonymity contract (THE CRITICAL ONE)

**Files:**
- Modify: `tests/integration/org-diagnostic-rls.test.ts`

This is the most important test in the plan. If it ever fails after this task lands, the merge is blocked until it passes.

- [ ] **Step 1: Write the failing test**

Replace the placeholder `it('placeholder ...')` with:

```typescript
describe('Anonymity contract — org_diagnostic_respondents', () => {
  it('platform admin CAN select all respondents', async () => {
    const { data, error } = await fixture.platformAdminClient!
      .from('org_diagnostic_respondents')
      .select('id, email')
      .eq('campaign_id', fixture.campaignAId!)
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
  })

  it('client_admin of the OWNING client cannot SELECT any respondents', async () => {
    const { data, error } = await fixture.clientAAdminClient!
      .from('org_diagnostic_respondents')
      .select('id, email')
      .eq('campaign_id', fixture.campaignAId!)
    // RLS-denied SELECT returns empty data, not an error
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('client_admin of a DIFFERENT client also cannot SELECT', async () => {
    const { data, error } = await fixture.clientBAdminClient!
      .from('org_diagnostic_respondents')
      .select('id, email')
      .eq('campaign_id', fixture.campaignAId!)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('anonymous client also cannot SELECT', async () => {
    const anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
    const { data } = await anon
      .from('org_diagnostic_respondents')
      .select('id')
      .eq('campaign_id', fixture.campaignAId!)
    expect(data ?? []).toEqual([])
  })
})
```

- [ ] **Step 2: Run, verify**

```bash
npm run test:integration -- tests/integration/org-diagnostic-rls.test.ts
```

Expected: all 4 tests pass on the first run, because RLS was implemented correctly in Task A5. If any test fails, the migration's RLS is wrong — fix it (the migration, not the test) before continuing.

- [ ] **Step 3: Commit**

```bash
git commit -am "test(org-diagnostic): verify respondent anonymity contract"
```

---

### Task D4: RLS tests — campaigns, profiles, roles cross-client isolation

**Files:**
- Modify: `tests/integration/org-diagnostic-rls.test.ts`

- [ ] **Step 1: Add tests**

Append to the suite:

```typescript
describe('Cross-client isolation', () => {
  describe('org_diagnostic_campaigns', () => {
    it('client_admin of OWNING client can SELECT', async () => {
      const { data } = await fixture.clientAAdminClient!
        .from('org_diagnostic_campaigns')
        .select('id')
        .eq('id', fixture.campaignAId!)
      expect(data).toHaveLength(1)
    })

    it('client_admin of DIFFERENT client cannot SELECT', async () => {
      const { data } = await fixture.clientBAdminClient!
        .from('org_diagnostic_campaigns')
        .select('id')
        .eq('id', fixture.campaignAId!)
      expect(data ?? []).toEqual([])
    })
  })

  describe('org_diagnostic_profiles', () => {
    it('client_admin of OWNING client can SELECT snapshot', async () => {
      const { data } = await fixture.clientAAdminClient!
        .from('org_diagnostic_profiles')
        .select('id')
        .eq('id', fixture.snapshotAId!)
      expect(data).toHaveLength(1)
    })

    it('client_admin of DIFFERENT client cannot SELECT', async () => {
      const { data } = await fixture.clientBAdminClient!
        .from('org_diagnostic_profiles')
        .select('id')
        .eq('id', fixture.snapshotAId!)
      expect(data ?? []).toEqual([])
    })
  })

  describe('client_roles', () => {
    it('client_admin of OWNING client can SELECT role', async () => {
      const { data } = await fixture.clientAAdminClient!
        .from('client_roles')
        .select('id')
        .eq('id', fixture.roleAId!)
      expect(data).toHaveLength(1)
    })

    it('client_admin of DIFFERENT client cannot SELECT', async () => {
      const { data } = await fixture.clientBAdminClient!
        .from('client_roles')
        .select('id')
        .eq('id', fixture.roleAId!)
      expect(data ?? []).toEqual([])
    })
  })

  describe('org_diagnostic_campaign_tracks', () => {
    it('client_admin of OWNING client can SELECT track via campaign', async () => {
      const { data } = await fixture.clientAAdminClient!
        .from('org_diagnostic_campaign_tracks')
        .select('id')
        .eq('id', fixture.trackAId!)
      expect(data).toHaveLength(1)
    })

    it('client_admin of DIFFERENT client cannot SELECT', async () => {
      const { data } = await fixture.clientBAdminClient!
        .from('org_diagnostic_campaign_tracks')
        .select('id')
        .eq('id', fixture.trackAId!)
      expect(data ?? []).toEqual([])
    })
  })
})
```

- [ ] **Step 2: Run, verify all pass**

```bash
npm run test:integration -- tests/integration/org-diagnostic-rls.test.ts
```

Expected: all 12 isolation tests pass.

- [ ] **Step 3: Commit**

```bash
git commit -am "test(org-diagnostic): RLS cross-client isolation"
```

---

### Task D5: RLS test — partner-scoped read access

The migration policies grant partner admins read access to their clients' rows (mirroring the existing `campaigns_select` pattern from migration 00019). Verify it.

**Files:**
- Modify: `tests/integration/org-diagnostic-rls.test.ts`

- [ ] **Step 1: Extend the fixture to add a partner_admin user**

In the `beforeAll` of the suite, after the existing user creations, add:

```typescript
const partnerAdmin = await createTestUser(admin, {
  email: testEmail('partner-admin'),
  role: 'partner_admin',
  partnerId: fixture.partnerId!,
})
fixture.partnerAdminClient = partnerAdmin.client
```

And declare `partnerAdminClient?: SupabaseClient` in the fixture type.

- [ ] **Step 2: Add tests**

Append to the suite (after the existing isolation tests):

```typescript
describe('Partner-admin read access', () => {
  it('partner_admin can SELECT campaigns of their partner\'s clients', async () => {
    const { data } = await fixture.partnerAdminClient!
      .from('org_diagnostic_campaigns')
      .select('id')
      .eq('id', fixture.campaignAId!)
    expect(data).toHaveLength(1)
  })

  it('partner_admin can SELECT profiles of their partner\'s clients', async () => {
    const { data } = await fixture.partnerAdminClient!
      .from('org_diagnostic_profiles')
      .select('id')
      .eq('id', fixture.snapshotAId!)
    expect(data).toHaveLength(1)
  })

  it('partner_admin can SELECT roles of their partner\'s clients', async () => {
    const { data } = await fixture.partnerAdminClient!
      .from('client_roles')
      .select('id')
      .eq('id', fixture.roleAId!)
    expect(data).toHaveLength(1)
  })

  it('partner_admin can SELECT tracks of their partner\'s clients', async () => {
    const { data } = await fixture.partnerAdminClient!
      .from('org_diagnostic_campaign_tracks')
      .select('id')
      .eq('id', fixture.trackAId!)
    expect(data).toHaveLength(1)
  })

  it('partner_admin still CANNOT SELECT respondents (anonymity holds across roles)', async () => {
    const { data } = await fixture.partnerAdminClient!
      .from('org_diagnostic_respondents')
      .select('id')
      .eq('campaign_id', fixture.campaignAId!)
    expect(data ?? []).toEqual([])
  })
})
```

The last test is critical: the anonymity contract applies to partner admins too, not only client admins.

- [ ] **Step 3: Run, verify all pass**

```bash
npm run test:integration -- tests/integration/org-diagnostic-rls.test.ts
```

Expected: 5 new tests pass; all prior tests still pass.

- [ ] **Step 4: Commit**

```bash
git commit -am "test(org-diagnostic): RLS partner-admin read access (and anonymity)"
```

---

## Phase E — Constraint and Lifecycle Integration Tests

These tests verify that DB-level constraints and the application-layer lifecycle rules behave correctly together. They use the service-role admin client (RLS bypassed) to focus purely on data integrity.

### Task E1: Lifecycle test scaffold

**Files:**
- Create: `tests/integration/org-diagnostic-lifecycle.test.ts`

- [ ] **Step 1: Write scaffold**

```typescript
/**
 * Constraint and lifecycle integration tests for the Org Diagnostic feature.
 *
 * Uses service-role admin client (RLS bypassed) — these tests focus on data
 * integrity, not access control. RLS is covered in org-diagnostic-rls.test.ts.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// loadEnvFile + canRun — same pattern as the RLS test file

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const canRun = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY)
const ts = Date.now()
function testSlug(label: string) { return `lc-orgdiag-${label}-${ts}` }

describe.skipIf(!canRun)('Org Diagnostic Lifecycle', () => {
  let admin: SupabaseClient
  let clientId: string
  let partnerId: string

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)
    const { data: p } = await admin.from('partners').insert({
      name: `LC Partner ${ts}`, slug: testSlug('partner'),
    }).select('id').single()
    partnerId = p!.id
    const { data: c } = await admin.from('clients').insert({
      name: `LC Client ${ts}`, slug: testSlug('client'), partner_id: partnerId,
    }).select('id').single()
    clientId = c!.id
  })

  afterAll(async () => {
    // Best-effort cleanup; depends on test order
    if (clientId) await admin.from('clients').delete().eq('id', clientId)
    if (partnerId) await admin.from('partners').delete().eq('id', partnerId)
  })

  it('placeholder', () => expect(true).toBe(true))
})
```

- [ ] **Step 2: Run, verify**

```bash
npm run test:integration -- tests/integration/org-diagnostic-lifecycle.test.ts
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/org-diagnostic-lifecycle.test.ts
git commit -m "test(org-diagnostic): scaffold lifecycle test file"
```

---

### Task E2: Constraint tests — campaign kind consistency

- [ ] **Step 1: Add failing tests**

Replace the placeholder with:

```typescript
describe('Campaign kind consistency CHECK constraint', () => {
  it('rejects baseline campaign with client_role_id set', async () => {
    // First create a snapshot + role to reference
    const { data: snap } = await admin.from('org_diagnostic_profiles').insert({
      client_id: clientId,
      campaign_id: '00000000-0000-0000-0000-000000000002',
      kind: 'baseline',
      data: {},
      respondent_count: 0,
    }).select('id').single()
    // Need to bootstrap with a campaign first to satisfy the campaign FK on profiles.
    // Use the simplest path: insert a valid baseline campaign, then snapshot, then attempt the bad insert.
    const { data: validCampaign } = await admin.from('org_diagnostic_campaigns').insert({
      client_id: clientId, kind: 'baseline', title: 'Bootstrap', status: 'draft',
    }).select('id').single()
    await admin.from('org_diagnostic_profiles').update({ campaign_id: validCampaign!.id }).eq('id', snap!.id)

    const { data: role } = await admin.from('client_roles').insert({
      client_id: clientId, title: 'Bootstrap Role', pinned_baseline_snapshot_id: snap!.id,
    }).select('id').single()

    // Now the actual test: baseline + client_role_id should fail
    const { error } = await admin.from('org_diagnostic_campaigns').insert({
      client_id: clientId,
      kind: 'baseline',
      title: 'Bad baseline',
      client_role_id: role!.id, // illegal for baseline
      status: 'draft',
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/org_diag_campaigns_kind_consistency/)

    // Cleanup
    await admin.from('client_roles').delete().eq('id', role!.id)
    await admin.from('org_diagnostic_profiles').delete().eq('id', snap!.id)
    await admin.from('org_diagnostic_campaigns').delete().eq('id', validCampaign!.id)
  })

  it('rejects role_rep campaign with no client_role_id', async () => {
    const { error } = await admin.from('org_diagnostic_campaigns').insert({
      client_id: clientId,
      kind: 'role_rep',
      title: 'Bad role_rep',
      status: 'draft',
      // missing client_role_id and pinned_baseline_snapshot_id
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/org_diag_campaigns_kind_consistency/)
  })
})
```

- [ ] **Step 2: Run, verify pass**

```bash
npm run test:integration -- tests/integration/org-diagnostic-lifecycle.test.ts
```

Expected: 2 new tests pass (the constraints are already in the migration; this test verifies they fire).

- [ ] **Step 3: Commit**

```bash
git commit -am "test(org-diagnostic): campaign kind consistency constraint"
```

---

### Task E3: Constraint test — track unique per (campaign, instrument)

- [ ] **Step 1: Add failing test**

Append:

```typescript
describe('Track uniqueness', () => {
  it('rejects two OPS tracks on the same campaign', async () => {
    const { data: campaign } = await admin.from('org_diagnostic_campaigns').insert({
      client_id: clientId, kind: 'baseline', title: 'Unique track test', status: 'draft',
    }).select('id').single()

    const { error: e1 } = await admin.from('org_diagnostic_campaign_tracks').insert({
      campaign_id: campaign!.id, instrument: 'OPS',
    })
    expect(e1).toBeNull()

    const { error: e2 } = await admin.from('org_diagnostic_campaign_tracks').insert({
      campaign_id: campaign!.id, instrument: 'OPS',
    })
    expect(e2).not.toBeNull()
    expect(e2!.message).toMatch(/org_diag_tracks_unique/)

    await admin.from('org_diagnostic_campaigns').delete().eq('id', campaign!.id)
  })
})
```

- [ ] **Step 2: Run, verify**

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git commit -am "test(org-diagnostic): track uniqueness per (campaign, instrument)"
```

---

### Task E4: Lifecycle test — role pin RESTRICT prevents snapshot delete

- [ ] **Step 1: Add failing test**

Append:

```typescript
describe('Snapshot deletion guarded by role pinning', () => {
  it('cannot delete a snapshot while a role pins it; succeeds after role is unpinned', async () => {
    // Setup: campaign → snapshot → role pinned to snapshot
    const { data: campaign } = await admin.from('org_diagnostic_campaigns').insert({
      client_id: clientId, kind: 'baseline', title: 'Pin test', status: 'closed',
    }).select('id').single()

    const { data: snapshot } = await admin.from('org_diagnostic_profiles').insert({
      client_id: clientId, campaign_id: campaign!.id, kind: 'baseline', data: {}, respondent_count: 0,
    }).select('id').single()

    const { data: role } = await admin.from('client_roles').insert({
      client_id: clientId, title: 'Pinned Role', pinned_baseline_snapshot_id: snapshot!.id,
    }).select('id').single()

    // Try to delete the snapshot — should fail with RESTRICT
    const { error: deleteWhilePinned } = await admin.from('org_diagnostic_profiles').delete().eq('id', snapshot!.id)
    expect(deleteWhilePinned).not.toBeNull()
    expect(deleteWhilePinned!.message).toMatch(/foreign key|violates|restrict/i)

    // Re-pin the role to a DIFFERENT snapshot (create one for that purpose)
    const { data: campaign2 } = await admin.from('org_diagnostic_campaigns').insert({
      client_id: clientId, kind: 'baseline', title: 'Repin target', status: 'closed',
    }).select('id').single()
    const { data: snapshot2 } = await admin.from('org_diagnostic_profiles').insert({
      client_id: clientId, campaign_id: campaign2!.id, kind: 'baseline', data: {}, respondent_count: 0,
    }).select('id').single()

    const { error: repinError } = await admin.from('client_roles')
      .update({ pinned_baseline_snapshot_id: snapshot2!.id })
      .eq('id', role!.id)
    expect(repinError).toBeNull()

    // Now the original snapshot can be deleted
    const { error: deleteAfterRepin } = await admin.from('org_diagnostic_profiles').delete().eq('id', snapshot!.id)
    expect(deleteAfterRepin).toBeNull()

    // Cleanup
    await admin.from('client_roles').delete().eq('id', role!.id)
    await admin.from('org_diagnostic_profiles').delete().eq('id', snapshot2!.id)
    await admin.from('org_diagnostic_campaigns').delete().in('id', [campaign!.id, campaign2!.id])
  })
})
```

- [ ] **Step 2: Run, verify pass**

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git commit -am "test(org-diagnostic): role pin RESTRICT prevents snapshot delete"
```

---

### Task E5: Lifecycle test — snapshot uniqueness per campaign

- [ ] **Step 1: Add failing test**

Append:

```typescript
describe('Snapshot uniqueness per campaign', () => {
  it('rejects a second snapshot for the same campaign', async () => {
    const { data: campaign } = await admin.from('org_diagnostic_campaigns').insert({
      client_id: clientId, kind: 'baseline', title: 'Snap uniqueness test', status: 'closed',
    }).select('id').single()

    const { error: e1 } = await admin.from('org_diagnostic_profiles').insert({
      client_id: clientId, campaign_id: campaign!.id, kind: 'baseline', data: {}, respondent_count: 0,
    })
    expect(e1).toBeNull()

    const { error: e2 } = await admin.from('org_diagnostic_profiles').insert({
      client_id: clientId, campaign_id: campaign!.id, kind: 'baseline', data: {}, respondent_count: 0,
    })
    expect(e2).not.toBeNull()
    expect(e2!.message).toMatch(/org_diagnostic_profiles_campaign_unique/)

    // Cleanup
    await admin.from('org_diagnostic_profiles').delete().eq('campaign_id', campaign!.id)
    await admin.from('org_diagnostic_campaigns').delete().eq('id', campaign!.id)
  })
})
```

- [ ] **Step 2: Run, verify pass**

- [ ] **Step 3: Commit**

```bash
git commit -am "test(org-diagnostic): one snapshot per campaign"
```

---

### Task E6: Lifecycle test — role kind/pin consistency on profile

- [ ] **Step 1: Add failing test**

Append:

```typescript
describe('Profile pin consistency CHECK', () => {
  it('rejects role-kind snapshot without pinned_baseline_snapshot_id', async () => {
    const { data: campaign } = await admin.from('org_diagnostic_campaigns').insert({
      client_id: clientId, kind: 'baseline', title: 'Pin consistency test', status: 'closed',
    }).select('id').single()

    const { error } = await admin.from('org_diagnostic_profiles').insert({
      client_id: clientId, campaign_id: campaign!.id, kind: 'role', data: {}, respondent_count: 0,
      // missing pinned_baseline_snapshot_id
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/org_diagnostic_profiles_pin_consistency/)

    await admin.from('org_diagnostic_campaigns').delete().eq('id', campaign!.id)
  })

  it('rejects baseline-kind snapshot WITH pinned_baseline_snapshot_id', async () => {
    // Create a real baseline snapshot to reference
    const { data: campaign1 } = await admin.from('org_diagnostic_campaigns').insert({
      client_id: clientId, kind: 'baseline', title: 'Other baseline', status: 'closed',
    }).select('id').single()
    const { data: realSnap } = await admin.from('org_diagnostic_profiles').insert({
      client_id: clientId, campaign_id: campaign1!.id, kind: 'baseline', data: {}, respondent_count: 0,
    }).select('id').single()

    // Now attempt the bad insert
    const { data: campaign2 } = await admin.from('org_diagnostic_campaigns').insert({
      client_id: clientId, kind: 'baseline', title: 'Self-pin attempt', status: 'closed',
    }).select('id').single()
    const { error } = await admin.from('org_diagnostic_profiles').insert({
      client_id: clientId, campaign_id: campaign2!.id, kind: 'baseline',
      pinned_baseline_snapshot_id: realSnap!.id, // illegal for baseline
      data: {}, respondent_count: 0,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/org_diagnostic_profiles_pin_consistency/)

    // Cleanup
    await admin.from('org_diagnostic_profiles').delete().eq('id', realSnap!.id)
    await admin.from('org_diagnostic_campaigns').delete().in('id', [campaign1!.id, campaign2!.id])
  })
})
```

- [ ] **Step 2: Run, verify pass**

- [ ] **Step 3: Commit**

```bash
git commit -am "test(org-diagnostic): profile pin consistency constraint"
```

---

## Phase F — Final Verification

### Task F1: Full test sweep + lint + typecheck

- [ ] **Step 1: Run the full unit test suite**

```bash
npm run test:unit
```

Expected: all unit tests pass, including the org-diagnostic validation tests.

- [ ] **Step 2: Run the full integration test suite**

```bash
npm run test:integration
```

Expected: all integration tests pass, including org-diagnostic-rls and org-diagnostic-lifecycle. The RLS anonymity test in particular should pass — if it doesn't, STOP and fix the migration before doing anything else.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: zero warnings (the project uses `--max-warnings=0`).

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: passes.

- [ ] **Step 5: Reset DB once more from scratch to confirm migration idempotency and ordering**

```bash
npm run db:test:reset
```

Expected: all migrations including the five new ones apply cleanly from an empty DB.

- [ ] **Step 6: If all green, push migrations to the remote DB**

⚠️ **GUARD:** Only do this step after explicit user approval. Pushing migrations is irreversible and shared.

```bash
npm run db:push
```

Expected: the five new migrations are applied to the remote Supabase project.

- [ ] **Step 7: Final commit (if any uncommitted work remains)**

```bash
git status
# If anything's untracked, decide whether to commit or discard
```

---

## What This Plan Does NOT Cover

Reproduced from the spec for clarity:

- The 16 organisational dimensions and the org item bank (`org_dimensions`, `org_diagnostic_items`, `org_diagnostic_responses` tables)
- Scoring pipeline, ipsative aggregation, confidence indicators, reverse-keying
- Internal shape of the snapshot's `data` JSON column (left as `jsonb`)
- Survey-taking UI for organisational respondents
- Admin UI for creating/managing diagnostic campaigns and roles
- Profile visualisation
- The matching layer
- Email template content (new `EmailType` values)
- The auto-close worker for tracks reaching their `closes_at`
- The admin re-pin operational UI specified in spec §3.4 (the validation logic supports it; the UI doesn't exist yet)

Each of the above is its own future plan, layered on top of this foundation.

---

## Notes on Pacing and Branching

- Each task is a single commit. There are ~22 tasks. Roughly 4–8 hours of focused work for an experienced engineer.
- **Branch:** create `feat/org-diagnostics-foundation` off `main` before starting Task A1 (the current branch `chore/client-portal-uplift-closeout` is the wrong home).
- Migrations are individually reversible by writing a `down` migration if needed, but the project pattern is forward-only — don't create down migrations unless asked.
- The RLS test in Task D3 is the load-bearing security check. Treat its failure as a critical bug, not a flaky test.
