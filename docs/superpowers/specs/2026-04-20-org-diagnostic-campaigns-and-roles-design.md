# Organisational Diagnostic Campaigns and Roles — Schema and Lifecycle

## Overview

Trajectas is adding a new product capability: **Organisational Diagnostics**. Clients are profiled across 16 cultural and operating dimensions via three instruments (OPS, LCQ, REP), and the resulting profile will eventually feed a matching algorithm that translates org context into candidate-side factor weights.

This spec is the **foundation layer** for that capability: the data model and lifecycle for the diagnostic *campaigns* that distribute these instruments, the *respondents* who complete them, the *snapshots* the campaigns produce, and the *roles* that pin to those snapshots.

The full feature reference is `docs/architecture/2026-04-20-org-assessment-architecture.md`. This spec implements the campaign/respondent/snapshot/role skeleton from that reference. It does not cover items, scoring, profile output, admin UI, or the matching layer — each of those will be its own design pass once this skeleton is in place.

### Scope

**In scope:**
- New tables: `org_diagnostic_campaigns`, `org_diagnostic_campaign_tracks`, `org_diagnostic_respondents`, `org_diagnostic_profiles`, `client_roles`
- Lifecycle rules: when campaigns can be created, when tracks open/close, when snapshots are generated, when roles can be created, what locks them to a snapshot
- RLS policies for each new table, mirroring existing patterns
- Migration plan and naming
- Anonymity guarantees: identity visibility scoped to platform admin; never to client admins; never in reporting

**Out of scope (future spec passes):**
- The 16 organisational dimensions and the org item bank (`org_dimensions`, `org_diagnostic_items`, `org_diagnostic_responses`)
- Scoring pipeline math, ipsative aggregation, confidence indicators, reverse-keying
- Internal shape of the snapshot's `data` JSON column (left as `jsonb` until scoring is designed)
- Survey-taking UI for organisational respondents (likely reuses `/assess/[token]/` patterns; routing decision deferred to implementation)
- Admin UI for creating/managing diagnostic campaigns and roles
- Profile visualisation (radar, bar, gap analysis views)
- The matching layer (org dimensions → candidate factor weights)
- Email template content (will reuse existing `sendEmail` with new `EmailType` values when the survey-taking flow is designed)

---

## 1. Conceptual Model

### 1.1 The two campaign kinds

Diagnostic campaigns come in two flavours, sharing one schema with a `kind` discriminator:

- **`baseline`** — runs OPS and/or LCQ against a client's wider population. Produces an *org-level snapshot* on close. Run periodically (typically annually, with quarterly pulses in Phase 4).
- **`role_rep`** — runs REP for one specific role. Pinned at creation to a baseline snapshot. Produces a *role-level snapshot* on close that references its pinned baseline. (REP itself is Phase 2 — but the campaign kind exists in the model from day one so it isn't a retrofit.)

A client typically has one current baseline campaign and zero-to-many role_rep campaigns running against any given baseline snapshot.

### 1.2 Tracks within a campaign

A campaign holds N **instrument tracks** (one per instrument it's running). Examples:
- A baseline campaign that runs OPS only has one track.
- A baseline campaign that runs OPS + LCQ has two tracks.
- A role_rep campaign always has exactly one track (REP).

Tracks inherit campaign-level open/close dates by default; each track can override with its own dates if the consultant wants staggered collection windows. Tracks transition through their own lifecycle (`pending → open → closed`) independently of one another.

### 1.3 Respondents

Each respondent belongs to exactly one campaign and exactly one track. Their `respondent_type` (Employee | Senior Leader | Hiring Manager | Team Member) determines which track they sit on:

| Respondent type | Track instrument |
|---|---|
| Employee | OPS |
| Senior Leader | LCQ |
| Hiring Manager | REP (within a role_rep campaign) |
| Team Member | REP (within a role_rep campaign) |

A given person who is both a Senior Leader (in the baseline campaign) and a Hiring Manager (in a role_rep campaign for one of their roles) appears as two distinct respondent rows — one in each campaign — with two distinct access tokens. This is intentional: it keeps the per-(campaign, person) lifecycle clean and matches how the existing `campaign_candidates` model works on the candidate-assessment side.

### 1.4 Snapshots

Each campaign produces **exactly one** profile snapshot when it closes. Snapshots are immutable and versioned. The client always has a "latest" baseline snapshot (the one most recently generated from a baseline campaign), and every prior snapshot remains browsable for longitudinal comparison and audit.

Composite shape: a baseline snapshot's `data` column holds **all** dimensional aggregates from the campaign — separate per-respondent-type buckets (employee aggregates from OPS, leader aggregates from LCQ) plus precomputed gap analysis. This is one snapshot, not three. Internal shape is `jsonb` for now; the structured shape is the subject of the future scoring spec.

### 1.5 Roles and pinning

A `client_role` represents a position the client is hiring for. A role can only be created if its parent client has at least one baseline snapshot in existence. At creation, the role is pinned to a specific snapshot (`pinned_baseline_snapshot_id`) — defaults to the latest, can be overridden, and **never auto-updates**. When the org runs a fresh baseline six months later, existing roles continue to point at the snapshot they were created against. New roles created after the refresh pin to the new latest.

This is the fundamental temporal contract of the system: **org profiles evolve; role profiles are frozen at the moment of hire.**

### 1.6 Anonymity guarantees

| Audience | What they can see |
|---|---|
| Platform admin (Trajectas operator) | Respondent identities (name, email), per-respondent completion status, but never per-respondent responses in any UI |
| Client admin (the assessed organisation's user) | Aggregate completion percentages and the snapshot output. **Never** respondent identities or per-respondent completion status. |
| Anyone, ever, in reporting/profile views | Only aggregate, anonymised data. Per-respondent responses are never surfaced. |

These are enforced via RLS policies (Section 4) and through the absence of UI affordances at the client portal level. Per-respondent response data is technically queryable by platform admin via service-role access for ops/debugging only — never exposed via the standard authenticated app surfaces.

**Completion visibility for client admins is provided exclusively via `org_diagnostic_profiles.respondent_count_by_type`** (a denormalised JSONB map of completion counts per respondent type, written when the snapshot is generated). No separate aggregate views over `org_diagnostic_respondents`, no respondent-level queries, and no per-track completion drill-downs are exposed to client members. If a future requirement calls for live in-progress completion percentages in the client portal (e.g., "12 of 30 employees have completed"), that view must be designed to compute and return only aggregate counts at the API boundary — never to grant SELECT on the underlying respondent table.

---

## 2. Data Model

All tables use the existing project conventions: UUID primary keys via `gen_random_uuid()`, timestamp `created_at`/`updated_at` (with `set_updated_at()` trigger where applicable), soft-delete via `deleted_at` on entity tables, and CITEXT for email columns.

### 2.1 New table: `org_diagnostic_campaigns`

The administrative container. Holds tracks, owns respondents, produces a snapshot on close.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `client_id` | UUID | FK → `clients(id)` ON DELETE RESTRICT, NOT NULL |
| `kind` | enum `org_diagnostic_campaign_kind` | NOT NULL — `baseline` \| `role_rep` |
| `client_role_id` | UUID | FK → `client_roles(id)` ON DELETE RESTRICT, nullable. **NOT NULL when `kind = 'role_rep'`**, NULL when `kind = 'baseline'`. |
| `pinned_baseline_snapshot_id` | UUID | FK → `org_diagnostic_profiles(id)` ON DELETE RESTRICT, nullable. **NOT NULL when `kind = 'role_rep'`**. |
| `title` | TEXT | NOT NULL, non-empty |
| `description` | TEXT | nullable |
| `status` | enum `org_diagnostic_campaign_status` | NOT NULL, default `'draft'` — `draft` \| `active` \| `closed` \| `archived` |
| `default_opens_at` | TIMESTAMPTZ | nullable |
| `default_closes_at` | TIMESTAMPTZ | nullable, must be `> default_opens_at` if both present |
| `closed_at` | TIMESTAMPTZ | nullable, set when status transitions to `closed` |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` |
| `updated_at` | TIMESTAMPTZ | nullable, maintained by trigger |
| `deleted_at` | TIMESTAMPTZ | nullable (soft delete) |
| `created_by` | UUID | FK → `profiles(id)` ON DELETE SET NULL |

**Constraints:**
- `CHECK ((kind = 'role_rep' AND client_role_id IS NOT NULL AND pinned_baseline_snapshot_id IS NOT NULL) OR (kind = 'baseline' AND client_role_id IS NULL AND pinned_baseline_snapshot_id IS NULL))`
- `CHECK (default_closes_at IS NULL OR default_opens_at IS NULL OR default_closes_at > default_opens_at)`
- `CHECK (char_length(trim(title)) > 0)`

**Indexes:**
- `(client_id) WHERE deleted_at IS NULL`
- `(status) WHERE deleted_at IS NULL`
- `(client_role_id) WHERE client_role_id IS NOT NULL`

### 2.2 New table: `org_diagnostic_campaign_tracks`

Per-instrument lifecycle inside a campaign.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `campaign_id` | UUID | FK → `org_diagnostic_campaigns(id)` ON DELETE CASCADE, NOT NULL |
| `instrument` | enum `org_diagnostic_instrument` | NOT NULL — `OPS` \| `LCQ` \| `REP` |
| `opens_at` | TIMESTAMPTZ | nullable; falls back to campaign `default_opens_at` if NULL |
| `closes_at` | TIMESTAMPTZ | nullable; falls back to campaign `default_closes_at` if NULL |
| `status` | enum `org_diagnostic_track_status` | NOT NULL, default `'pending'` — `pending` \| `open` \| `closed` |
| `closed_at` | TIMESTAMPTZ | nullable, set when status transitions to `closed` |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` |
| `updated_at` | TIMESTAMPTZ | nullable, maintained by trigger |

**Constraints:**
- `UNIQUE (campaign_id, instrument)` — a campaign cannot have two tracks of the same instrument
- `CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at)`
- Cross-table validation (enforced in application layer, not DB):
  - Tracks on a `baseline` campaign must have `instrument IN ('OPS', 'LCQ')`
  - Tracks on a `role_rep` campaign must have `instrument = 'REP'` and there must be exactly one

**Indexes:**
- `(campaign_id)`
- `(status, closes_at)` for the auto-close worker (Section 3.3)

### 2.3 New table: `org_diagnostic_respondents`

People invited to complete one instrument within one campaign. Token-based access, no login required.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `campaign_id` | UUID | FK → `org_diagnostic_campaigns(id)` ON DELETE CASCADE, NOT NULL |
| `track_id` | UUID | FK → `org_diagnostic_campaign_tracks(id)` ON DELETE CASCADE, NOT NULL |
| `respondent_type` | enum `org_diagnostic_respondent_type` | NOT NULL — `employee` \| `senior_leader` \| `hiring_manager` \| `team_member` |
| `name` | TEXT | nullable (allows partial captures from CSV upload) |
| `email` | CITEXT | NOT NULL |
| `access_token` | TEXT | NOT NULL, default `encode(gen_random_bytes(32), 'hex')`, UNIQUE |
| `status` | enum `org_diagnostic_respondent_status` | NOT NULL, default `'invited'` — `invited` \| `in_progress` \| `completed` \| `withdrawn` \| `expired` |
| `invited_at` | TIMESTAMPTZ | NOT NULL, default `now()` |
| `started_at` | TIMESTAMPTZ | nullable |
| `completed_at` | TIMESTAMPTZ | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` |
| `updated_at` | TIMESTAMPTZ | nullable, maintained by trigger |

**Constraints:**
- `UNIQUE (campaign_id, email)` — one person, one row per campaign
- `CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)`
- Cross-table validation (application layer): the respondent's `track_id` must reference a track whose `instrument` matches the type-to-instrument mapping in §1.3

**Indexes:**
- `(campaign_id)`
- `(track_id)`
- `(access_token)` — already covered by the unique constraint
- `(email)`
- `(status)`

### 2.4 New table: `org_diagnostic_profiles`

The immutable snapshot. One row per campaign close.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `client_id` | UUID | FK → `clients(id)` ON DELETE RESTRICT, NOT NULL |
| `campaign_id` | UUID | FK → `org_diagnostic_campaigns(id)` ON DELETE RESTRICT, NOT NULL, UNIQUE |
| `kind` | enum `org_diagnostic_profile_kind` | NOT NULL — `baseline` \| `role` (mirrors campaign kind, denormalised for query convenience) |
| `pinned_baseline_snapshot_id` | UUID | FK → `org_diagnostic_profiles(id)` ON DELETE RESTRICT, nullable. NOT NULL when `kind = 'role'`. |
| `data` | JSONB | NOT NULL — the composite snapshot (per-respondent-type aggregates, gap analysis, confidence indicators). Internal shape defined by the future scoring spec; stored opaquely here. |
| `respondent_count` | INT | NOT NULL — total respondents whose data is included |
| `respondent_count_by_type` | JSONB | NOT NULL, default `'{}'::jsonb` — e.g. `{"employee": 24, "senior_leader": 6}` |
| `generated_at` | TIMESTAMPTZ | NOT NULL, default `now()` |
| `generated_by` | UUID | FK → `profiles(id)` ON DELETE SET NULL |

**Constraints:**
- `UNIQUE (campaign_id)` — exactly one snapshot per campaign
- `CHECK ((kind = 'role' AND pinned_baseline_snapshot_id IS NOT NULL) OR (kind = 'baseline' AND pinned_baseline_snapshot_id IS NULL))`

**Indexes:**
- `(client_id, generated_at DESC)` — for "fetch latest baseline snapshot for client"
- `(client_id, kind, generated_at DESC)` — for filtered latest queries
- `(pinned_baseline_snapshot_id) WHERE pinned_baseline_snapshot_id IS NOT NULL`

**Immutability:** snapshots are insert-only. No `updated_at`, no soft-delete. If a campaign is reopened (Section 3.4), the snapshot is **hard-deleted** so a fresh one can be generated on close. This is a deliberate tradeoff: immutability for the common path, brutal simplicity for the uncommon path.

### 2.5 New table: `client_roles`

A position the client is hiring for. Pinned to a baseline snapshot at creation.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `client_id` | UUID | FK → `clients(id)` ON DELETE RESTRICT, NOT NULL |
| `title` | TEXT | NOT NULL, non-empty |
| `function` | TEXT | nullable (free text for MVP) |
| `hiring_manager_name` | TEXT | nullable |
| `hiring_manager_email` | CITEXT | nullable |
| `pinned_baseline_snapshot_id` | UUID | FK → `org_diagnostic_profiles(id)` ON DELETE RESTRICT, NOT NULL |
| `status` | enum `client_role_status` | NOT NULL, default `'open'` — `open` \| `filled` \| `closed` \| `archived` |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` |
| `updated_at` | TIMESTAMPTZ | nullable, maintained by trigger |
| `deleted_at` | TIMESTAMPTZ | nullable (soft delete) |
| `created_by` | UUID | FK → `profiles(id)` ON DELETE SET NULL |

**Constraints:**
- `CHECK (char_length(trim(title)) > 0)`
- Application-layer check: the `pinned_baseline_snapshot_id` must reference a snapshot whose `client_id` matches this row's `client_id` and whose `kind = 'baseline'`. (Could be expressed as a DB trigger, but application-layer enforcement plus tests is cheaper.)

**Indexes:**
- `(client_id) WHERE deleted_at IS NULL`
- `(client_id, status) WHERE deleted_at IS NULL`
- `(pinned_baseline_snapshot_id)`

**Phase 2 additions** (not in this spec; documented here so the column adds are predictable):
- `current_rep_campaign_id` UUID nullable, FK → `org_diagnostic_campaigns(id)`
- `current_role_snapshot_id` UUID nullable, FK → `org_diagnostic_profiles(id)`

These are additive; no rework of MVP rows required.

---

## 3. Lifecycle Rules

### 3.1 Campaign creation

**Baseline campaign:**
- Created in `status = 'draft'` by a platform admin from the org diagnostic admin section.
- Tracks (OPS and/or LCQ) are added in draft state.
- Respondents are added (CSV bulk or individual) and their `track_id` is set based on their `respondent_type`.
- When the admin transitions the campaign to `active`, all of its tracks transition from `pending` to `open` (subject to their `opens_at` timing — see §3.2). Invitation emails fire.

**Role_rep campaign (Phase 2 — design now):**
- Created in `status = 'draft'`. Must have:
  - `kind = 'role_rep'`
  - `client_role_id` set
  - `pinned_baseline_snapshot_id` set (defaults to the role's `pinned_baseline_snapshot_id`, but can be re-pinned at campaign creation if the role is being re-assessed against a fresher baseline)
  - Exactly one track of `instrument = 'REP'`
- Hiring manager (respondent type) is required; team members are optional.

### 3.2 Track open/close

A track's effective dates are: `opens_at` and `closes_at` if set on the track row, else the campaign's `default_opens_at` / `default_closes_at`.

- A track is `open` when its effective `opens_at` ≤ now AND its effective `closes_at` > now AND the campaign status is `active`.
- A track transitions to `closed` either by an admin manually closing it, or automatically when its effective `closes_at` is reached.
- Auto-close runs as a scheduled worker (Section 3.3).
- Once closed, a track does not re-open without an admin action that explicitly reopens it (which moves it back to `open` and clears `closed_at`).

### 3.3 Snapshot generation

A campaign-level snapshot is generated when **all** of the campaign's tracks have status `closed`. Two triggers:

1. **Manual:** the admin marks the campaign as `closed` from the admin UI. The system verifies all tracks are closed (or closes them at this moment), runs the scoring pipeline (out of scope for this spec), and inserts a row into `org_diagnostic_profiles`. Campaign `status` becomes `closed`, `closed_at` is set.

2. **Automatic:** a scheduled worker watches for campaigns where all tracks have closed but the campaign itself is still `active`. When found, it transitions the campaign to `closed` and runs snapshot generation, same path as manual.

The scoring pipeline that produces the `data` JSONB is not specified here — that's the future scoring spec. For the schema, the snapshot row is simply created with whatever `data` the pipeline produces.

### 3.4 Reopening a closed campaign

Sometimes a snapshot will need to be regenerated — a late respondent comes in, an item was scored wrong, an instrument needs to be added. The lifecycle:

1. Admin reopens the campaign from `closed` → `active`.
2. The system **hard-deletes** the snapshot row (and any role-snapshots that pinned to it via `pinned_baseline_snapshot_id`, cascading by RESTRICT failure unless those are also explicitly handled — see below).
3. Tracks can be reopened, new respondents added, etc.
4. When the campaign is closed again, a new snapshot is generated.

**Role-pinning consequence:** if the snapshot being deleted has any `client_roles` pinned to it, the delete will fail (RESTRICT FK). The admin must either re-pin those roles to a different snapshot first, or accept that this snapshot is permanent and the campaign cannot be reopened. This is a deliberate friction — once roles depend on a snapshot, that snapshot is part of the historical record.

This trade-off was chosen over soft-delete on snapshots because: snapshot rows are large (the full `data` JSONB), reopening should be rare, and the integrity guarantee that "every role's pinned snapshot still exists" is valuable.

**Re-pinning workflow (admin-only operation).** Re-pinning is an explicit exception to the "`pinned_baseline_snapshot_id` is read-only on roles" rule stated in §3.5. The operational path:

1. Admin attempts to reopen a closed campaign whose snapshot has dependent roles. The system blocks the reopen and surfaces the list of pinned roles (id, title, function, status).
2. For each affected role the admin chooses one of:
   - **Re-pin to a different existing baseline snapshot for the same client.** Updates `client_roles.pinned_baseline_snapshot_id` in place. Allowed only when an alternate baseline snapshot exists for that client.
   - **Archive the role.** Sets `status = 'archived'`. The pinned FK still references the snapshot but the role is hidden from active views — sufficient to keep the historical record intact while removing the operational dependency. (The snapshot still cannot be deleted; archiving doesn't release the FK. So this path also forecloses reopening.)
   - **Cancel the reopen.** Snapshot stays, campaign stays closed.
3. Once all dependent roles have been re-pinned away (option (a) for each), the snapshot can be deleted and the reopen proceeds.

This re-pinning operation is admin-only and audit-logged. It is the **only** code path that mutates `client_roles.pinned_baseline_snapshot_id` after creation. The role-creation form path (§3.5) and the re-pinning path are the only two writes to that column; all other code paths must treat it as read-only.

### 3.5 Role creation

- A role can be created from the admin UI for a client only if at least one `org_diagnostic_profiles` row exists for that client with `kind = 'baseline'`.
- The form pre-populates `pinned_baseline_snapshot_id` to the latest baseline snapshot for the client; the admin can pick an older one if there's a reason to.
- Once created, `pinned_baseline_snapshot_id` is **read-only**. To re-pin a role to a fresher snapshot, the admin creates a new role (the old one can be archived).

### 3.6 Status transitions, summarised

```
Campaign:   draft → active → closed → archived
                       ↑       ↓
                       └───────┘  (reopen, hard-deletes snapshot)

Track:      pending → open → closed
                       ↑      ↓
                       └──────┘  (reopen, only if campaign is active)

Respondent: invited → in_progress → completed
                          ↓             ↓
                       withdrawn,    withdrawn (effectively no-op)
                       expired

Role:       open → filled
              ↓ ↘
           closed  archived
```

---

## 4. Row Level Security

All five new tables have RLS enabled. Policies mirror the existing `campaigns` / `campaign_candidates` pattern from migration `00019_campaign_infrastructure.sql`.

### 4.1 Helpers

The existing helper functions are sufficient: `is_platform_admin()`, `auth_user_organization_id()` (which is in fact "auth user's client id" post the rename in migration 00068), and the partner_id lookup pattern via `profiles`.

### 4.2 Policies

For each of the five new tables:

**Platform admin: full access.**
```sql
CREATE POLICY <table>_all_platform_admin ON <table>
    FOR ALL TO authenticated USING (is_platform_admin());
```

**Client members: scoped read of their own client's rows.**
- For tables with a direct `client_id`: `client_id = auth_user_organization_id()`
- For tables that reference a client transitively (e.g., `org_diagnostic_respondents` → `org_diagnostic_campaigns.client_id`): policy uses an EXISTS subquery against the parent.

**Important exception for anonymity (§1.6):** client members must NOT be able to read `org_diagnostic_respondents` rows. They can read aggregate counts via `org_diagnostic_profiles.respondent_count_by_type`, but the per-respondent table is platform-admin-only.

The respondent-table policy for client members is therefore: **no read access**. Implementation:

```sql
CREATE POLICY org_diagnostic_respondents_all_platform_admin ON org_diagnostic_respondents
    FOR ALL TO authenticated USING (is_platform_admin());

-- No SELECT policy for client members. RLS denies by default when no policy applies.
```

This is the strongest available enforcement and matches the user-stated anonymity contract.

**Token-based survey access (anonymous role):** the survey-taking flow uses the existing pattern — a route handler resolves the access token via service-role (`createAdminClient`), bypassing RLS. The respondent never authenticates against Supabase Auth. This mirrors how `/assess/[token]/` works today.

### 4.3 Per-table policy summary

| Table | Platform admin | Client member SELECT | Client member write |
|---|---|---|---|
| `org_diagnostic_campaigns` | full | yes (own client only) | none (admin-managed in MVP) |
| `org_diagnostic_campaign_tracks` | full | yes (via campaign join) | none |
| `org_diagnostic_respondents` | full | **none** (anonymity) | none |
| `org_diagnostic_profiles` | full | yes (own client only) | none |
| `client_roles` | full | yes (own client only) | none (admin-managed in MVP) |

Partner-scoped read access: clients have a `partner_id`; partner admins of the parent partner can read their clients' rows. Pattern mirrors the existing `campaigns_select` policy on line 167 of migration `00019`.

---

## 5. Migration Plan

### 5.1 Naming and ordering

Follow the current convention: timestamp prefix `YYYYMMDDHHMMSS_<descriptive_name>.sql`. All migrations idempotent (`IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN ... END $$`) per the established pattern.

### 5.2 Migration files (proposed)

The schema is large enough that splitting into focused migrations is worth doing. Dependency-ordered sequence:

1. `<ts>_org_diagnostic_enums.sql` — all eight new enums: `org_diagnostic_campaign_kind`, `org_diagnostic_campaign_status`, `org_diagnostic_instrument`, `org_diagnostic_track_status`, `org_diagnostic_respondent_type`, `org_diagnostic_respondent_status`, `org_diagnostic_profile_kind`, `client_role_status`. No table dependencies.
2. `<ts>_org_diagnostic_profiles.sql` — profiles table + indexes + RLS. No FKs to other new tables (the `pinned_baseline_snapshot_id` self-reference resolves at insert time, not table creation).
3. `<ts>_client_roles.sql` — `client_roles` table + indexes + RLS. FK to `org_diagnostic_profiles`.
4. `<ts>_org_diagnostic_campaigns_and_tracks.sql` — both `org_diagnostic_campaigns` and `org_diagnostic_campaign_tracks` (closely coupled, ship together) + indexes + RLS. FKs to `client_roles` and `org_diagnostic_profiles`.
5. `<ts>_org_diagnostic_respondents.sql` — respondents table + indexes + RLS. FKs to campaigns and tracks.

### 5.3 Type generation

After migrations land, regenerate `src/types/database.ts` per the existing project workflow (the project already has 99+ migrations and a regeneration step — confirm at implementation time which command).

### 5.4 No data backfill

This spec adds new tables only. No existing rows are touched, no renames, no backfills. Risk surface is low.

---

## 6. Testing Strategy

### 6.1 Schema-level tests

In line with the existing project patterns:

- **Migration tests:** Apply the migrations against a fresh Supabase test database (`npm run db:test:reset`). Verify all tables, indexes, constraints, and RLS policies exist.
- **Constraint tests:** Per-table unit tests asserting the CHECK constraints fire correctly (e.g., baseline campaign with `client_role_id` set should be rejected; track `closes_at <= opens_at` should be rejected).

### 6.2 RLS tests

The strongest tests in this spec. For each of the five tables:

- Platform admin can SELECT/INSERT/UPDATE/DELETE.
- Client member of the row's client can SELECT (where applicable per §4.3).
- Client member of a different client cannot SELECT.
- Anonymous (unauthenticated) role cannot SELECT any row.
- **Critical:** client member cannot SELECT from `org_diagnostic_respondents` even for their own client. This test is the anonymity contract in code form.

### 6.3 Lifecycle tests

Integration-level (against a real test DB):
- Create baseline campaign, add OPS track, add 5 employee respondents, transition to active, manually close, generate snapshot row → verify single row in `org_diagnostic_profiles` with `kind = 'baseline'`.
- Create role pinned to that snapshot → verify `pinned_baseline_snapshot_id` is set.
- Attempt to delete the snapshot while role pins it → verify FK RESTRICT fires.
- Reopen campaign → verify cannot delete snapshot if role pins it; verify can delete if no roles pin it.
- Create role_rep campaign for the role → verify both `client_role_id` and `pinned_baseline_snapshot_id` are required and present.

These tests are the executable spec for the lifecycle rules in Section 3.

---

## 7. Open Questions and Future Work

These are deliberately not decided in this spec. They each warrant their own design pass.

1. **Snapshot `data` JSONB internal shape.** Defined by the future scoring spec. This spec stores it opaquely.
2. **The 16 organisational dimensions and item bank.** Tables `org_dimensions`, `org_diagnostic_items`, `org_diagnostic_responses`. Item content. Reverse-keying. Ipsative response format.
3. **Survey-taking route and UI.** Whether to extend `/assess/[token]/` or create `/assess-org/[token]/`. The respondent-type-routed instrument selection.
4. **Admin UI for diagnostic campaigns and roles.** Mirrors the existing `/dashboard/campaigns/` patterns but with multi-track and respondent-type complexity.
5. **Email types and templates.** New `EmailType` enum values (`org_survey_invite`, `org_survey_reminder`); template content.
6. **Profile visualisation.** Radar, gap analysis views, longitudinal comparison.
7. **The matching layer.** Org dimensions → candidate factor weights.
8. **Pulse survey infrastructure** (Phase 4). Quarterly subset; time-decay weighting of snapshots.
9. **Client portal surface.** When/whether the client admin sees their own profile in `/client/`. Not in MVP.
10. **Auto-close worker.** Scheduled function (Edge Function or pg_cron) that closes tracks when their effective `closes_at` is reached. Scheduling and observability TBD.

---

## 8. Decisions Log

For traceability, the brainstorming-session decisions that produced this spec:

| Decision | Choice | Rationale |
|---|---|---|
| Org/client terminology | `client_*` for tables, "Organisational Diagnostics" in UI copy | Codebase convention (migration 00068) is `client`; product term remains "organisational" |
| Dimension taxonomy coupling | Parallel `org_dimensions`, separate from candidate `dimensions` | Matching layer is algorithmic, not shared-vocab; simpler boundaries |
| Reuse vs fork campaign machinery | Parallel new tables, reuse infrastructure (auth, email, brand, RLS, /assess shell) | Different scoring shape and lifecycle; same plumbing |
| Snapshot model | Versioned, immutable, latest-wins | Roles need stable pinning; longitudinal comparison falls out for free |
| Snapshot unit | One composite snapshot per campaign | Simpler downstream; one thing to point to |
| REP placement | Own campaign per role, pinned to baseline | Different cadence; clean per-campaign-one-snapshot model |
| Track lifecycle | Campaign defaults with per-track date override | YAGNI; flexibility unlocked without immediate UI cost |
| Role creation constraint | Requires baseline snapshot to pin against | Roles without org context are meaningless |
| Anonymity | Identity to platform admin only; never to client admin; never in reporting | User-stated requirement; enforced via RLS deny |
| Matching layer | Deferred entirely; no stub table | Real data needed before designing the bridge |
