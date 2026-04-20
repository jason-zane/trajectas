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
