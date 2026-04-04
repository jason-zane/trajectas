# Client Portal & Entitlements System Design

## Overview

Enable client organizations to independently run assessment campaigns through a focused client portal, with admin-controlled entitlements governing which assessments, quotas, and report templates each client can access.

### Scope

- **In scope**: Client portal (operational), admin setup screens for client entitlements, campaign UX improvements (both portals), quota enforcement, authorization
- **Out of scope**: Partner portal functionality, billing/payment integration, diagnostics in client portal

### Terminology

- **Client** = an organization record in the database (`organizations` table)
- **Entitlement** = an admin-assigned permission (assessment access, report template access, branding toggle)
- **Quota** = per-assessment credit limit controlling how many participants a client can invite

---

## 1. Data Model

### 1.1 New table: `client_assessment_assignments`

Links an organization to the assessments it can use, with per-row quota.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `organization_id` | UUID | FK → `organizations(id)` ON DELETE CASCADE, NOT NULL |
| `assessment_id` | UUID | FK → `assessments(id)` ON DELETE CASCADE, NOT NULL |
| `quota_limit` | INT | Nullable — `NULL` means unlimited |
| `is_active` | BOOLEAN | Default `true` |
| `assigned_by` | UUID | FK → `profiles(id)`, NOT NULL |
| `created_at` | TIMESTAMPTZ | Default `now()` |
| `updated_at` | TIMESTAMPTZ | Default `now()` |

- Unique constraint on `(organization_id, assessment_id)`
- Index on `organization_id`

### 1.2 New table: `client_report_template_assignments`

Links an organization to the report templates it can generate.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `organization_id` | UUID | FK → `organizations(id)` ON DELETE CASCADE, NOT NULL |
| `report_template_id` | UUID | FK → `report_templates(id)` ON DELETE CASCADE, NOT NULL |
| `is_active` | BOOLEAN | Default `true` |
| `assigned_by` | UUID | FK → `profiles(id)`, NOT NULL |
| `created_at` | TIMESTAMPTZ | Default `now()` |
| `updated_at` | TIMESTAMPTZ | Default `now()` |

- Unique constraint on `(organization_id, report_template_id)`
- Index on `organization_id`

### 1.3 New column on `organizations`

- `can_customize_branding` BOOLEAN DEFAULT `false`

### 1.4 Quota computation

No stored counter. Usage is computed from live data via a Postgres function:

```sql
CREATE FUNCTION get_assessment_quota_usage(p_org_id UUID, p_assessment_id UUID)
RETURNS INT AS $$
  SELECT COUNT(*)::INT
  FROM campaign_participants cp
  JOIN campaign_assessments ca ON ca.campaign_id = cp.campaign_id
  JOIN campaigns c ON c.id = cp.campaign_id
  WHERE ca.assessment_id = p_assessment_id
    AND c.organization_id = p_org_id
    AND c.deleted_at IS NULL
    AND (
      cp.status IN ('invited', 'registered', 'in_progress', 'completed')
      OR (cp.status = 'withdrawn' AND cp.started_at IS NOT NULL)
    )
$$ LANGUAGE sql STABLE;
```

**Quota model**:
- Credit consumed when participant is invited/created
- Credit returned if participant withdrawn or expired before starting (`started_at IS NULL`)
- Credit locked once participant has started (`started_at IS NOT NULL`)

### 1.5 RLS policies

Both assignment tables:
- Platform admins: full CRUD
- Client members: SELECT on own org's rows only (read what's assigned to them)
- No client-side INSERT/UPDATE/DELETE (admin-only mutations via server actions)

---

## 2. Admin Client Setup UI

New tabs on the existing client detail page (`/organizations/[slug]/...`), alongside the existing Overview and Branding tabs.

### 2.1 Tab bar

Overview | **Assessments** | **Reports** | Branding | **Settings**

(Bold = new tabs)

**Note:** The org detail page currently has no shared layout or tab shell — routes like `/[slug]/edit/page.tsx` and `/[slug]/branding/page.tsx` are standalone. This work requires creating a new `layout.tsx` at the `[slug]` level with a tabbed shell component (similar to `CampaignDetailShell`) to house these tabs.

### 2.2 Assessments tab

- Lists all assessments assigned to this client
- Each row shows: assessment name, metadata (sections, items, type), quota usage bar
- Quota display: `{used} / {limit}` with progress bar, or `{used} · unlimited`
- Warning states: amber when ≤10% remaining, red when exhausted
- "Assign Assessment" button opens a modal to pick from platform assessments and set quota (number input or "unlimited" toggle)
- Can edit quota or deactivate existing assignments inline

### 2.3 Reports tab

- Checklist of all report templates, grouped by type (self-report vs 360)
- Check/uncheck to control which templates this client can use
- Shows platform-global templates (`partner_id IS NULL`) and templates belonging to the client's partner (if the org has a `partner_id`)
- Shows template metadata: display level, audience type, description
- Immediate toggle (Zone 1) — each check/uncheck saves immediately with toast

### 2.4 Settings tab

- **Custom branding toggle**: Controls whether the client can edit their own brand settings in their portal. Explanatory text: "Even when disabled, you can still configure branding for this client on the Branding tab."
- Future-proofed for additional client feature flags

### 2.5 Branding tab (existing, unchanged)

Admin can always configure branding for the client here, regardless of the `can_customize_branding` toggle. The toggle only controls client-side visibility.

---

## 3. Client Portal Structure

### 3.1 Sidebar navigation

```
Overview
  └ Dashboard

Assessments
  ├ Campaigns
  └ Participants
```

Three nav items total. The existing client nav items (Assessments, Assessment Results, Campaigns, Complete Diagnostic, Diagnostic Results) are all replaced. Clients access assessments through campaigns and results within campaign detail — no standalone assessment or results pages.

### 3.2 Dashboard

Activity-first layout, quotas secondary:

1. **Summary stats row** (4 cards): Active campaigns, Total participants, Completed, Reports ready
2. **Active campaigns list**: Campaign name, assessment, participant count, completion progress, status badge
3. **Assessment usage table** (compact): Assessment name, used count, remaining/unlimited, mini progress bars. Amber warning for low quotas.

### 3.3 Global Participants view

Cross-campaign table of all participants for this organization:

- Columns: Name, Email, Campaign, Status, Report (link when available)
- Filters: search by name/email, filter by campaign, filter by status
- Same person appears in multiple rows if enrolled in multiple campaigns
- Sortable, paginated

### 3.4 Campaign list

Same structure as admin campaign list, scoped to the client's organization. Client can create new campaigns (org_id set automatically from auth context).

---

## 4. Client Campaign Detail Pages

### 4.1 Architecture: Shared shell, portal-specific pages

- `CampaignDetailShell` becomes portal-aware via a `portal` prop (or `usePortal()` context)
- Shell controls which tabs render based on portal and entitlements
- Client portal gets its own route files under `/client/campaigns/[id]/...`
- Individual tab pages can share data-fetching components while composing them differently per portal
- Route structure mirrors admin: `/client/campaigns/[id]/overview`, `/client/campaigns/[id]/participants`, etc.

### 4.2 Tab-by-tab specification

#### Overview (modified — both portals)

- **Added**: Access links section (shareable self-enrollment link, moved from Settings)
- **Removed**: Timeline (moved to Settings)
- Same in both admin and client portals

#### Assessments (client differs)

- **Admin**: Can attach any platform assessment
- **Client**: Picker filtered to assigned assessments only (from `client_assessment_assignments` where `is_active = true`). Quota indicator shown per assessment in the picker. Blocked from adding if quota exhausted.
- Server action rejects unassigned assessments regardless of UI

#### Participants (modified — both portals)

- **Added**: Access links section (self-enrollment link, moved from Settings)
- **Added** (client only): Quota warning banner when approaching or at limit for any campaign assessment
- Same invite/manage functionality in both portals
- Invite blocked server-side if all assessment quotas exhausted

#### Results (client differs)

- **Admin**: Full report config panel — pick any template per audience type
- **Client**: No report config panel. When generating reports, template selection filtered to assigned templates (from `client_report_template_assignments`) intersected with templates compatible with the campaign's assessment data. Client can view and download generated reports.

#### Experience (same)

Identical in both portals. Client can customise welcome message, consent text, completion message.

#### Branding (client conditional)

- **Admin**: Always visible. Full brand editor.
- **Client**: Tab only rendered if `organizations.can_customize_branding = true`. Same brand editor component when visible.

#### Settings (client differs)

- **Both portals**: Campaign feature toggles (allow resume, show progress, randomize order) + timeline (moved here from Overview)
- **Admin only**: Report config panel remains here
- **Client**: No report config panel (admin controls template assignments at the entitlement level)

---

## 5. Authorization & Enforcement

All enforcement happens in server actions. The client UI reflects what the server allows but is not the security boundary.

### 5.1 Quota enforcement at invite time

When a participant is added (direct invite or access link self-enrollment):

1. Look up assessments attached to this campaign via `campaign_assessments`
2. For each assessment, call `get_assessment_quota_usage(org_id, assessment_id)`
3. Compare against `quota_limit` from `client_assessment_assignments`
4. If `quota_limit` is NULL → unlimited, always allow
5. If usage ≥ quota → reject with error: "Assessment quota reached for {assessment_name}"
6. Runs inside existing `inviteParticipant` (in `src/app/actions/campaigns.ts`) and `registerViaLink` (in `src/app/actions/assess.ts`) actions

### 5.2 Assessment attachment restriction

When a client adds an assessment to a campaign:

1. Query `client_assessment_assignments` for the org where `is_active = true`
2. Server action rejects any `assessment_id` not in the assignment list
3. UI picker is filtered client-side too (defense in depth)

### 5.3 Report template restriction

When a client generates reports:

1. Query `client_report_template_assignments` for the org where `is_active = true`
2. Intersect with templates compatible with the campaign's assessments
3. Server action rejects unassigned template IDs

### 5.4 Campaign scoping

- Client portal campaigns are scoped to the org via `organization_id` on the `campaigns` table
- Campaign creation in client portal automatically sets `organization_id` from the authenticated user's active context
- `requireCampaignAccess()` already validates org membership — no new auth code needed for basic access

### 5.5 Branding tab visibility

- `CampaignDetailShell` reads `organizations.can_customize_branding` for the campaign's org
- On client portal, Branding tab is excluded from the tab list when `false`
- On admin portal, Branding tab always rendered regardless of flag

### 5.6 Edge cases

| Scenario | Behavior |
|----------|----------|
| Admin reduces quota below current usage | Allowed with warning. Existing participants not affected. New invites blocked. |
| Assessment deactivated mid-campaign | Existing campaign-assessment links remain. New campaigns can't attach it. |
| Access link self-enrollment at quota | Registration fails with "This campaign is currently full" — no quota details exposed to external participants. |
| Client with no assessments assigned | Campaign creation allowed but assessment tab shows empty state: "No assessments available. Contact your administrator." |
| Client with no report templates assigned | Results tab shows scores/status but report generation is disabled with explanation. |

---

## 6. Campaign UX Changes (Both Portals)

These changes apply to the admin portal as well, not just the client portal.

### 6.1 Access links → Overview + Participants

The shareable self-enrollment link (currently in Settings → `campaign-access-links.tsx`) moves to:
- **Overview page**: Displayed in a section below the campaign summary
- **Participants page**: Displayed above the participant table

Removed from Settings page.

### 6.2 Timeline → Settings

The campaign timeline/schedule display (opens_at, closes_at) moves from Overview to Settings, alongside the campaign feature toggles.

### 6.3 Report config panel (admin only)

The report config panel (`report-config-panel.tsx`) stays in Settings but is only rendered on the admin portal. Client portal Settings tab shows toggles + timeline only.

---

## 7. File Structure

### New client portal routes

The existing `src/app/client/[[...slug]]/page.tsx` catch-all (which renders placeholder portal pages) is replaced by discrete route files. Routes that match a real page no longer fall through to the catch-all.

```
src/app/client/
├── campaigns/
│   ├── page.tsx                    — Campaign list (org-scoped)
│   ├── create/
│   │   └── page.tsx                — Create campaign
│   └── [id]/
│       ├── layout.tsx              — Loads campaign, wraps in shared shell
│       ├── page.tsx                — Redirect to overview
│       ├── overview/
│       │   └── page.tsx
│       ├── assessments/
│       │   └── page.tsx
│       ├── participants/
│       │   └── page.tsx
│       ├── results/
│       │   └── page.tsx
│       ├── experience/
│       │   └── page.tsx
│       ├── branding/
│       │   └── page.tsx
│       └── settings/
│           └── page.tsx
├── participants/
│   └── page.tsx                    — Global participants view
└── dashboard/
    └── page.tsx                    — Client dashboard
```

### New/modified admin routes

```
src/app/(dashboard)/organizations/[slug]/
├── layout.tsx                      — NEW: tabbed shell (like CampaignDetailShell)
├── page.tsx                        — Redirect to overview
├── overview/
│   └── page.tsx                    — Existing edit/page.tsx content moves here
├── assessments/
│   └── page.tsx                    — Assessment assignment management
├── reports/
│   └── page.tsx                    — Report template assignment
├── branding/
│   └── page.tsx                    — Existing, now lives under tab shell
└── settings/
    └── page.tsx                    — Client feature flags (branding toggle)
```

The existing `edit/page.tsx` content migrates into the new Overview tab. The existing `branding/page.tsx` stays but is now housed within the new tab shell layout.

### New/modified server actions

```
src/app/actions/
├── client-entitlements.ts          — NEW: CRUD for assessment/report assignments
└── campaigns.ts                    — MODIFIED: quota checks on participant invite
```

### New migration

```
supabase/migrations/
└── 000XX_client_entitlements.sql   — Tables, function, RLS policies, org column
```

### Shared components (used by both portals)

- `CampaignDetailShell` — modified to accept portal-aware tab configuration. Link generation must use `usePortal().href()` or accept a base path prop so the same shell works under both `/campaigns/[id]/...` and `/client/campaigns/[id]/...`
- `campaign-access-links.tsx` — reused on Overview and Participants pages
- Participant table component — shared between campaign participants and global participants view
- Brand editor component — shared, conditionally rendered

---

## 8. Migration Strategy

Single migration file containing:

1. `client_assessment_assignments` table + indexes + unique constraint
2. `client_report_template_assignments` table + indexes + unique constraint
3. `ALTER TABLE organizations ADD COLUMN can_customize_branding BOOLEAN DEFAULT false`
4. `get_assessment_quota_usage()` function
5. RLS policies for both new tables
6. `updated_at` trigger for both new tables
