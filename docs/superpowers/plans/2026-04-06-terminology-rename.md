# Terminology Rename: Organizations → Clients

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardise on "client" everywhere — database tables, columns, TypeScript code, routes, and UI text — to eliminate the organizations/clients dual terminology.

**Architecture:** Single database migration renames the `organizations` table and all `organization_id` columns (including those in already-correctly-named tables like `client_memberships`). Then a coordinated code-wide find-and-replace updates types, mappers, server actions, components, and UI text. Postgres rename operations are metadata-only and safe.

**Tech Stack:** Postgres (Supabase), TypeScript, Next.js App Router

**Spec:** `docs/superpowers/specs/2026-04-06-terminology-rename.md`

---

## Scope Context

Scan results indicate:
- **21 files** in `src/app/(dashboard)/organizations/` route directory (need to move to `clients/`)
- **52 files** contain `organization_id` or `organizations` references in code
- **65 files** contain `organizationId` or `Organization` references in code
- **12 migration files** reference the old names (historical — do not edit)

Because this is a coordinated mechanical rename, partial states would break compilation. Execute as large atomic commits: migration first, then code, then routes, then verification.

---

## File Structure

### Database (new migration)
- `supabase/migrations/000XX_rename_organizations_to_clients.sql` — all renames in one migration

### TypeScript (rename in place)
- `src/types/database.ts` — rename `Organization` → `Client`, `OrganizationWithCounts` → `ClientWithCounts`
- `src/lib/supabase/mappers.ts` — rename `mapOrganizationRow` → `mapClientRow`, etc.
- `src/app/actions/organizations.ts` → rename file to `src/app/actions/clients.ts`, rename all exports
- `src/lib/auth/authorization.ts` — rename `requireOrganizationAccess` → `requireClientAccess`
- `src/lib/validations/organizations.ts` → rename to `clients.ts`, rename schema

### Routes (rename directory)
- `src/app/(dashboard)/organizations/` → `src/app/(dashboard)/clients/`

### UI text
- Update display strings: "Organisation"/"Organization" → "Client"
- Keep "Directory" navigation name unchanged

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/000XX_rename_organizations_to_clients.sql` (XX = next sequential number)

- [ ] **Step 1: Determine next migration number**

Run: `ls supabase/migrations/ | tail -5`
Check the highest existing number, add 1. At time of spec writing, latest was `00067`, so this would likely be `00068`.

- [ ] **Step 2: Identify RLS policies and columns to update**

Run these queries in Supabase SQL editor (or via psql) to discover what the migration needs to touch:

```sql
-- Find all tables with organization_id columns
SELECT table_name
FROM information_schema.columns
WHERE column_name = 'organization_id'
  AND table_schema = 'public';

-- Find all RLS policies referencing the auth helper function
SELECT policyname, tablename, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual LIKE '%auth_user_organization_id%' OR with_check LIKE '%auth_user_organization_id%');
```

Record the results — you'll include DROP/CREATE POLICY statements for each referenced policy in the migration.

- [ ] **Step 3: Write the migration file**

```sql
-- 000XX_rename_organizations_to_clients.sql
-- Standardise on 'client' terminology. Renames organizations table and all
-- organization_id columns to clients/client_id.

BEGIN;

-- 1. Rename the main table
ALTER TABLE organizations RENAME TO clients;

-- 2. Rename organization_id columns in all referencing tables
ALTER TABLE campaigns RENAME COLUMN organization_id TO client_id;
ALTER TABLE profiles RENAME COLUMN organization_id TO client_id;
ALTER TABLE assessments RENAME COLUMN organization_id TO client_id;
ALTER TABLE client_memberships RENAME COLUMN organization_id TO client_id;
ALTER TABLE client_assessment_assignments RENAME COLUMN organization_id TO client_id;
ALTER TABLE client_report_template_assignments RENAME COLUMN organization_id TO client_id;
ALTER TABLE diagnostic_sessions RENAME COLUMN organization_id TO client_id;
ALTER TABLE audit_events RENAME COLUMN organization_id TO client_id;
-- Verify this list matches actual columns during implementation

-- 3. Update the brand_owner_type enum: 'organization' → 'client'
ALTER TYPE brand_owner_type RENAME VALUE 'organization' TO 'client';

-- 4. Rename the auth helper function
DROP FUNCTION IF EXISTS auth_user_organization_id();
CREATE FUNCTION auth_user_client_id() RETURNS UUID AS $$
  SELECT client_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5. Update the quota function parameter names and references
CREATE OR REPLACE FUNCTION get_assessment_quota_usage(p_client_id UUID, p_assessment_id UUID)
RETURNS INT AS $$
  SELECT COALESCE(COUNT(*)::INT, 0)
  FROM campaign_participants cp
  JOIN campaign_assessments ca ON ca.campaign_id = cp.campaign_id
  JOIN campaigns c ON c.id = cp.campaign_id
  WHERE ca.assessment_id = p_assessment_id
    AND c.client_id = p_client_id
    AND c.deleted_at IS NULL
    AND (
      cp.status IN ('invited', 'registered', 'in_progress', 'completed')
      OR (cp.status = 'withdrawn' AND cp.started_at IS NOT NULL)
    )
$$ LANGUAGE sql STABLE;

COMMIT;
```

Include in the migration — BEFORE the function rename — DROP POLICY and CREATE POLICY statements for each policy identified in Step 2. Replace `auth_user_organization_id()` references with `auth_user_client_id()` in the recreated policies.

Add any additional tables with `organization_id` columns discovered in Step 2 to the rename list.

- [ ] **Step 4: Apply migration to local database**

Run: `npm run db:push`
Expected: Migration applies successfully, no errors.

If migration fails, read the error carefully — it likely indicates a missing table column or policy reference. Fix the migration and retry.

- [ ] **Step 5: Verify via db:status**

Run: `npm run db:status`
Expected: Shows the new migration as applied.

Quick spot-check — run this query to verify rename succeeded:
```sql
SELECT COUNT(*) FROM clients;  -- should return row count, not error
SELECT COUNT(*) FROM campaigns WHERE client_id IS NOT NULL;  -- should work
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): rename organizations to clients, organization_id to client_id"
```

---

## Task 2: Core Types and Mappers

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/supabase/mappers.ts`
- Modify: `src/types/api.ts` (if it has organization references)

- [ ] **Step 1: Rename types in database.ts**

Replace in `src/types/database.ts`:
- `Organization` → `Client`
- `OrganizationWithCounts` → `ClientWithCounts`
- Any other exported types with "Organization" in the name

Update property names on types:
- `organizationId` → `clientId`
- `organization_id` (if present as a snake_case type field) → `client_id`

- [ ] **Step 2: Rename mappers in mappers.ts**

In `src/lib/supabase/mappers.ts`:
- `mapOrganizationRow` → `mapClientRow`
- `mapOrganizationWithCounts` → `mapClientWithCounts` (if exists)
- `toOrganizationInsert` → `toClientInsert` (if exists)
- Update all `row.organization_id` → `row.client_id` inside mapper bodies
- Update `organizationId` properties to `clientId` on returned objects

- [ ] **Step 3: Update api.ts if needed**

If `src/types/api.ts` references organization types, update those references.

- [ ] **Step 4: Attempt to compile (expect failures)**

Run: `npx tsc --noEmit 2>&1 | head -50`
Expected: Many errors — this is intentional. We'll fix them in subsequent tasks. Note the pattern of errors for the next task.

- [ ] **Step 5: Do NOT commit yet**

The code won't compile until Task 3 completes. Continue to Task 3.

---

## Task 3: Server Actions, Auth, and Code-Wide Rename

**Files:**
- Rename: `src/app/actions/organizations.ts` → `src/app/actions/clients.ts`
- Rename: `src/lib/validations/organizations.ts` → `src/lib/validations/clients.ts`
- Modify: All files containing `organizationId`, `organization_id`, `organizations`, `Organization` references

- [ ] **Step 1: Rename action file**

```bash
git mv src/app/actions/organizations.ts src/app/actions/clients.ts
```

In the new `clients.ts` file, rename:
- `getOrganizations` → `getClients`
- `getOrganizationBySlug` → `getClientBySlug`
- `getOrganizationDirectoryEntries` → `getClientDirectoryEntries`
- `createOrganization` → `createClient`
- `updateOrganization` → `updateClient`
- `deleteOrganization` → `deleteClient`
- `restoreOrganization` → `restoreClient`
- Any other function with "Organization" in name

Also update internal queries:
- `.from("organizations")` → `.from("clients")`
- `organization_id` column references → `client_id`

- [ ] **Step 2: Rename validation file**

```bash
git mv src/lib/validations/organizations.ts src/lib/validations/clients.ts
```

In the new file, rename `organizationSchema` → `clientSchema` and any other schema exports.

- [ ] **Step 3: Rename auth function**

In `src/lib/auth/authorization.ts`:
- `requireOrganizationAccess` → `requireClientAccess`
- Update function body to use new column name (`c.client_id` in queries)

- [ ] **Step 4: Bulk replace across all TypeScript files**

Use your editor's global find-and-replace or sed. Perform these replacements across `src/` and `tests/`:

```
organizationId → clientId
orgId → clientId
organization_id → client_id
.from("organizations") → .from("clients")
.from('organizations') → .from('clients')
getOrganizations → getClients
getOrganizationBySlug → getClientBySlug
getOrganizationDirectoryEntries → getClientDirectoryEntries
createOrganization → createClient
updateOrganization → updateClient
deleteOrganization → deleteClient
restoreOrganization → restoreClient
requireOrganizationAccess → requireClientAccess
organizationSchema → clientSchema
mapOrganizationRow → mapClientRow
mapOrganizationWithCounts → mapClientWithCounts
OrganizationWithCounts → ClientWithCounts
type Organization → type Client (careful — this is case-sensitive)
: Organization → : Client
<Organization> → <Client>
Organization[] → Client[]
```

**BE CAREFUL with some replacements:**
- Don't replace instances where "Organization" appears in user-facing comments about the renaming itself
- Don't replace the word "Organisation" with British spelling in UI text (do that in Task 5)
- The import statement `from "@/app/actions/organizations"` needs to become `from "@/app/actions/clients"`
- The import `from "@/lib/validations/organizations"` needs to become `from "@/lib/validations/clients"`

- [ ] **Step 5: Update audit event type strings**

Search for `client.created`, `client.updated`, `client.deleted` audit event strings — these should already be correct. If any `organization.*` event strings exist, update them to `client.*`.

- [ ] **Step 6: Attempt compilation**

Run: `npx tsc --noEmit 2>&1 | head -80`

Fix any remaining type errors iteratively. Common issues:
- Missed a file in the bulk replace
- Function reference where the function itself wasn't renamed
- Import path not updated

- [ ] **Step 7: Do NOT commit yet — continue to Task 4**

---

## Task 4: Route Directory Rename

**Files:**
- Rename: `src/app/(dashboard)/organizations/` → `src/app/(dashboard)/clients/`
- Modify: All files containing hardcoded `/organizations/` paths

- [ ] **Step 1: Rename the route directory**

```bash
git mv "src/app/(dashboard)/organizations" "src/app/(dashboard)/clients"
```

- [ ] **Step 2: Find and update hardcoded path references**

Search for hardcoded `/organizations/` paths in the codebase:

```bash
# This is a search — do not commit, just review
grep -rn "/organizations" src/ --include="*.ts" --include="*.tsx"
```

Update every hardcoded path from `/organizations/...` to `/clients/...`. Common locations:
- `router.push("/organizations/...")` calls
- `href="/organizations/..."` attributes
- `redirect("/organizations/...")` calls
- `revalidatePath("/organizations")` calls
- Breadcrumbs, sidebar links, navigation
- Server action redirect targets

- [ ] **Step 3: Update the sidebar nav (if it has organizations link)**

Check `src/components/app-sidebar.tsx` for any `/organizations` href and update to `/clients`.

- [ ] **Step 4: Compile check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Should compile clean now, or very few remaining errors.

Fix any remaining errors.

---

## Task 5: UI Text Updates

**Files:**
- All files with user-facing text containing "Organisation", "Organization", "organisation", "organization"

- [ ] **Step 1: Search for user-facing text references**

```bash
grep -rn "Organisation\|Organization" src/ --include="*.tsx" | grep -v "// " | grep -v "^.*:.*\(import \|from \|type \|interface \)"
```

This finds likely user-facing text (excludes comments, imports, type declarations).

- [ ] **Step 2: Replace UI text**

Update in UI components (page titles, labels, button text, tooltips, error messages, empty states):
- "Organisation" → "Client"
- "Organisations" → "Clients"
- "Organization" → "Client"
- "Organizations" → "Clients"
- "organisation" → "client"
- "organization" → "client"

Also:
- "New organisation" → "New client"
- "Edit organisation" → "Edit client"
- "Archive organisation" → "Archive client"
- Any error messages mentioning organisation

- [ ] **Step 3: Verify dashboard/directory labels**

Check `src/app/(dashboard)/directory/page.tsx` — make sure it says "Clients" (it may already be correct).

- [ ] **Step 4: Final compile check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Run tests**

Run: `npx vitest run 2>&1 | tail -30`
Expected: All tests pass. Fix any test failures (likely mock setup using old names).

---

## Task 6: Verification and Commit

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript compile**

Run: `npx tsc --noEmit`
Expected: No errors, no warnings.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Start dev server and smoke test**

Run: `npm run dev`

Manually verify in the browser:
- Navigate to `/directory` — clients list loads
- Navigate to `/clients` — client list page works (was /organizations)
- Click into a client — detail page loads with all tabs
- Check each tab: Overview, Assessments, Reports, Branding, Settings — all load without errors
- Create a new client (if possible)
- Edit a client
- Check audit events still work (no console errors about unknown event types)

- [ ] **Step 4: Review the diff**

Run: `git diff --stat`
Review the diff to spot any anomalies or missed replacements.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: rename organizations to clients across codebase

Standardises terminology to 'client' everywhere:
- Database: organizations table -> clients, organization_id -> client_id
- TypeScript: Organization type -> Client, organizationId -> clientId
- Server actions: /actions/organizations.ts -> /actions/clients.ts
- Routes: /(dashboard)/organizations/ -> /(dashboard)/clients/
- UI text: Organisation/Organization -> Client throughout
- Enum: brand_owner_type 'organization' -> 'client'"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `npx vitest run` passes with no failures
- [ ] Dev server starts without errors
- [ ] `/clients` route renders the client list
- [ ] `/clients/[slug]/overview` loads a client detail page
- [ ] All client detail tabs render (Overview, Assessments, Reports, Branding, Settings)
- [ ] Creating and editing a client works
- [ ] No references to `organizations` table remain in code (excluding migration files)
- [ ] No references to `organizationId` remain in code
- [ ] UI consistently says "Client" everywhere
