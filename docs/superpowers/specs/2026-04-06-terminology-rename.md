# Terminology Standardisation: Organizations → Clients

## Overview

Standardise on "client" as the single term for client organisations across the database, code, and UI. Eliminates the `organizations` (DB) vs "client" (product) mental translation tax.

## Motivation

- Current state: database uses `organizations`, product UI uses "client", code mixes both (`organizationId`, `orgId`, sometimes `clientId`)
- Cost of rename is front-loaded; cost of continuing the inconsistency compounds with every new feature
- Platform is early enough (no external API consumers, no published documentation) that a rename is safe

## Scope

### In scope

- Database: rename `organizations` table → `clients`, rename all `organization_id` columns → `client_id`
- All TypeScript code references (types, server actions, components, queries)
- All UI text ("Organisations" → "Clients", "org" → "client")
- Audit event types, log messages, error messages
- Test files

### Out of scope

- Table names that already use "client" naming — these table names don't change, but their `organization_id` columns DO need renaming (see below)
- `client_admin` / `partner_admin` enum values in `user_role` (already correct)
- `partner_id` columns (partners remain "partners")

### Columns needing rename in already-correctly-named tables

The following tables already have correct names but contain `organization_id` columns that must be renamed to `client_id`:
- `client_memberships.organization_id` → `client_memberships.client_id`
- `client_assessment_assignments.organization_id` → `client_assessment_assignments.client_id`
- `client_report_template_assignments.organization_id` → `client_report_template_assignments.client_id`

These column renames must be included in the migration.

## Database Rename

### Migration strategy

Single migration file with a sequential number (verify at execution time — currently `00068_rename_organizations_to_clients.sql` based on latest migration being `00067`).

```sql
-- Rename the main table
ALTER TABLE organizations RENAME TO clients;

-- Rename all foreign key columns across dependent tables
ALTER TABLE campaigns RENAME COLUMN organization_id TO client_id;
ALTER TABLE profiles RENAME COLUMN organization_id TO client_id;
ALTER TABLE assessments RENAME COLUMN organization_id TO client_id;
ALTER TABLE client_memberships RENAME COLUMN organization_id TO client_id;
ALTER TABLE client_assessment_assignments RENAME COLUMN organization_id TO client_id;
ALTER TABLE client_report_template_assignments RENAME COLUMN organization_id TO client_id;
-- Verify all other tables with organization_id columns during implementation

-- Update the brand_owner_type enum: 'organization' → 'client'
ALTER TYPE brand_owner_type RENAME VALUE 'organization' TO 'client';

-- Update RLS helper function
DROP FUNCTION IF EXISTS auth_user_organization_id();
CREATE FUNCTION auth_user_client_id() RETURNS UUID AS $$
  SELECT client_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Drop and recreate RLS policies that reference old names
-- (Postgres preserves FK constraints through renames, but policies with literal column names need updating)
```

Postgres handles:
- Foreign key constraints (automatically updated to reference new table/column names)
- Indexes (automatically renamed when columns rename)
- Triggers (preserved)

Manual handling required for:
- RLS policies with hard-coded column names
- Stored functions (`auth_user_organization_id()` → `auth_user_client_id()`)
- Enum values (`brand_owner_type 'organization'` → `'client'`)

### Data preservation

No data migration required. Rename operations are metadata-only at the Postgres level.

## TypeScript & Code Changes

### Find-and-replace patterns (mechanical)

| Old | New |
|-----|-----|
| `organizations` (table name in queries) | `clients` |
| `organization_id` (column) | `client_id` |
| `organizationId` (TS variable/prop) | `clientId` |
| `orgId` (TS variable) | `clientId` |
| `Organization` (type name) | `Client` |
| `OrganizationWithCounts` | `ClientWithCounts` |
| `getOrganizations` (action) | `getClients` |
| `getOrganizationBySlug` | `getClientBySlug` |
| `requireOrganizationAccess` | `requireClientAccess` |
| `canAccessOrganization` | `canAccessClient` (if exists; already-existing `canAccessClient` stays) |

### Files that need review (not exhaustive)

- `src/types/database.ts` — type definitions
- `src/lib/supabase/mappers.ts` — row mappers
- `src/app/actions/organizations.ts` → rename to `src/app/actions/clients.ts`
- `src/app/actions/*.ts` — any cross-references
- `src/lib/auth/authorization.ts` — auth helpers with `requireOrganizationAccess`
- All directory/organizations route files: `src/app/(dashboard)/organizations/` → `src/app/(dashboard)/clients/`
- `src/components/*` — any component with organization props
- `tests/*` — test fixtures and mocks
- Audit event type strings (`"client.created"`, `"client.updated"` — likely already correct)

### Route rename

`src/app/(dashboard)/organizations/` → `src/app/(dashboard)/clients/`

All subdirectories and files move with it. Any hardcoded `/organizations/` paths in the codebase need updating.

## UI Text Changes

- Page titles: "Organisations" → "Clients"
- Sidebar nav: "Directory" shows "Clients" tab (already does in some places)
- Button text: "New organisation" → "New client"
- Empty states: "No organisations yet" → "No clients yet"
- Form labels, tooltips, error messages

## RLS Policies

All RLS policies that reference `organizations` table or `organization_id` column need updating. Some were created via `CREATE POLICY` statements referencing literal names.

Policy name changes (optional cleanup): `"Org admins can read own org"` → `"Client admins can read own client"` (not functionally required, but improves readability).

## Testing Strategy

- Run full test suite after each phase (migration, code, UI)
- Manual smoke test: create client, edit client, delete client, list clients
- Verify auth boundaries still enforced (platform admins can manage, client members can only read own)
- Verify RLS policies still work (attempt cross-client data access should be denied)

## Rollback Plan

If issues arise:
- Postgres rename is reversible via `ALTER TABLE clients RENAME TO organizations` etc.
- Code changes reverted via `git revert` on the migration commit
- No data loss risk (names only)

## Execution Order

1. Database migration (single file)
2. TypeScript type and mapper renames (immediate, breaks compilation if missed)
3. Server action file rename + function renames
4. Route directory rename
5. Component prop/variable renames
6. UI text updates
7. Test updates
8. Full test suite run
9. Manual smoke test
