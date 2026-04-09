# Admin Partner & Client Polish — Design Spec

## Context

The admin partner management area (`/partners/[slug]/...`) and client management area (`/clients/[slug]/...`) need a consistency and functionality pass. The partner area has a Clients tab that 404s, no assessment/report assignment UI, a thin overview page with the edit form crammed in, and no taxonomy library. The client area works but uses card-based layouts for assignments instead of DataTables, and the overall layout feels patched together rather than intentionally designed.

This spec brings both areas to production quality with consistent patterns, DataTable-based layouts, and a premium feel that matches the rest of the platform.

**Related plans (in-flight):**
- `docs/superpowers/plans/2026-04-09-partner-portal-production-polish.md` — partner-facing portal pages (separate from this work)
- `docs/superpowers/plans/2026-04-07-partner-entitlements.md` — Tasks 1-3 done (migration, types, server actions). Tasks 4-5 partially done. This spec completes and extends that work.

---

## Design Decisions

- **Siblings, not clones.** Partner and client admin share the same tab patterns, layout rhythms, and component library. The differences are additive (partner has Clients tab, Library tab) not structural.
- **DataTables everywhere.** All listing/assignment views use `DataTable` from `@/components/data-table/`. Card-based assignment UIs are replaced. This gives consistent search, sort, filter, and pagination.
- **Overview is read-only.** The edit form moves to a dedicated Details tab. Overview becomes a rich dashboard with stats, context, and quick actions.
- **`max-w-6xl` for content areas.** Both shells currently use `max-w-5xl` which feels cramped with DataTables. Widening to `max-w-6xl` gives tables room to breathe without feeling unbounded.
- **Library tab is partner-only.** Three sub-tabs (Dimensions, Factors, Constructs) with DataTables, individual toggle on/off, multi-select for bulk operations. No cascading — granular control.
- **Permissions shape UI, don't hide it.** Tabs always render. Content within shows read-only state or disabled controls when the user lacks permission. This prevents confusion about what exists.

---

## 1. Tab Structure

### Partner Detail Shell

| Order | Tab | Segment | Notes |
|-------|-----|---------|-------|
| 1 | Overview | `overview` | Rich read-only dashboard |
| 2 | Details | `details` | Edit form (moved from overview) |
| 3 | Clients | `clients` | DataTable + assign/unassign (tab exists, page NEW) |
| 4 | Assessments | `assessments` | DataTable with quotas (NEW) |
| 5 | Reports | `reports` | DataTable with toggles (NEW) |
| 6 | Library | `library` | Dimensions/Factors/Constructs (NEW) |
| 7 | Users | `users` | Already works, polish pass |
| 8 | Branding | `branding` | Already works, no change |
| 9 | Settings | `settings` | Branding toggle only (entitlement UI moves to own tabs) |

### Client Detail Shell

| Order | Tab | Segment | Notes |
|-------|-----|---------|-------|
| 1 | Overview | `overview` | Rich read-only dashboard |
| 2 | Details | `details` | Edit form (moved from overview) |
| 3 | Assessments | `assessments` | DataTable with quotas (converted from cards) |
| 4 | Reports | `reports` | DataTable with toggles (converted from cards) |
| 5 | Users | `users` | Already works, polish pass |
| 6 | Branding | `branding` | Already works, no change |
| 7 | Settings | `settings` | Branding toggle (no change) |

### Shell Layout Changes

Both shells widen from `max-w-5xl` to `max-w-6xl`. The `PageHeader` in the shell gets an active/archived status badge. Tab nav remains the same horizontal underline pattern.

---

## 2. Overview Page (Both Partner & Client)

The overview becomes a **read-only dashboard** with no edit controls. Same layout structure for both, different content.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Stat cards (4 across, TiltCard + ScrollReveal)     │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐           │
│  │      │  │      │  │      │  │      │           │
│  └──────┘  └──────┘  └──────┘  └──────┘           │
├─────────────────────────────┬───────────────────────┤
│  Key Context Card           │  Quick Actions Card   │
│  (read-only profile info,   │  (links to other tabs │
│   description, metadata)    │   and portal entry)   │
│  "Edit details →" link      │                       │
├─────────────────────────────┴───────────────────────┤
│  Recent Activity Card                               │
│  (last 5 events: assignments, campaigns, invites)   │
└─────────────────────────────────────────────────────┘
```

### Partner Stat Cards

| Card | Value | Icon | Link |
|------|-------|------|------|
| Clients | `clientCount` | `Building2` | `./clients` |
| Active Campaigns | `activeCampaignCount` | `Megaphone` | — |
| Members | `partnerMemberCount` | `Users` | `./users` |
| Assessments | `totalAssessmentsAssigned` | `ClipboardList` | `./assessments` |

### Client Stat Cards

| Card | Value | Icon | Link |
|------|-------|------|------|
| Active Campaigns | `activeCampaignCount` | `Megaphone` | — |
| Participants | `totalParticipants` | `Users` | — |
| Assessments | `totalAssessmentsAssigned` | `ClipboardList` | `./assessments` |
| Reports Generated | `reportsGenerated` | `FileBarChart` | — |

### Key Context Card

Read-only display of the entity's profile information:
- **Partner:** Description, website, contact email, internal notes, created date
- **Client:** Description, industry, size range, partner (as link), created date

Includes an "Edit details" link that navigates to the Details tab. Uses standard Card with muted label/value pairs.

### Quick Actions Card

Contextual shortcuts rendered as a compact list with icons:
- **Partner:** View Clients, Manage Assessments, Manage Library, Enter Portal, Invite User
- **Client:** View Campaigns, Manage Assessments, Enter Portal, Invite User

Each action is a `Link` with icon + label + arrow.

### Recent Activity Card

Shows recent campaigns associated with this entity (last 5), similar to the partner portal dashboard's "Recent campaigns" card. Each row: campaign title, client name (for partner context), status badge, participant count, completed count.

Data source: existing `getCampaigns()` filtered by partner/client, sorted by `created_at` desc, limited to 5. No new server action needed — reuse the existing campaign query with a filter parameter.

**Future enhancement:** A full cross-entity activity timeline (assignments, invites, status changes) can be added later if an audit log table is introduced. For now, recent campaigns provides the most useful at-a-glance context.

### Premium Styling

All stat cards wrapped in `TiltCard` + `ScrollReveal` with 60ms stagger. Icon glow on hover per CLAUDE.md. `AnimatedNumber` for stat values. Dark mode: border-driven cards.

---

## 3. Details Page (Both Partner & Client)

The edit form, extracted from the current overview. Single column, `max-w-3xl` within the `max-w-6xl` shell.

### Layout

Three card sections stacked vertically:

1. **Profile Card** — Identity fields
2. **Notes Card** — Internal notes (auto-save)
3. **Danger Zone Card** — Status toggle + archive

### Partner Details Fields

| Field | Type | Zone | Notes |
|-------|------|------|-------|
| Name | Text input | Zone 2 | Auto-slugifies |
| Slug | Text input | Zone 2 | Manual override |
| Description | Textarea | Zone 3 | `useAutoSave`, blur + 3s debounce, `AutoSaveIndicator` |
| Website | URL input | Zone 2 | New field |
| Contact Email | Email input | Zone 2 | New field |
| Notes | Textarea | Zone 3 | Internal notes, auto-save, not visible to partner users |
| Active | Toggle | Zone 1 | Immediate with toast |
| Archive | Button | Confirm | Soft delete, 5s undo toast, redirect to directory |

### Client Details Fields

Same structure plus client-specific fields:
- Industry (select dropdown)
- Size Range (select dropdown)
- Partner (read-only link if assigned, or "Platform-owned")

### New DB Columns for Partners

The `partners` table currently has: `id`, `name`, `slug`, `settings`, `is_active`, `deleted_at`, `can_customize_branding`, `created_at`, `updated_at`.

New columns needed:

```sql
ALTER TABLE partners ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS notes TEXT;
```

The `Partner` TypeScript interface and `mapPartnerRow` mapper need corresponding updates.

### Save Behaviour

Zone 2 fields (name, slug, website, contact email) share a single "Save Changes" button with the standard label transition: "Save Changes" → "Saving..." → "Saved" (2s) → back. Uses `useUnsavedChanges` hook for navigate-away warning.

Zone 3 fields (description, notes) auto-save independently via `useAutoSave` with inline `AutoSaveIndicator`. These don't participate in the unsaved changes check.

Zone 1 toggle (active) fires immediately with toast. Archive uses `ConfirmDialog` → soft-delete → toast with undo → redirect.

---

## 4. Clients Tab (Partner-Only)

A scoped DataTable of the partner's clients with assign/unassign capability.

### Data Source

New server action `getPartnerClients(partnerId)` — queries `clients` where `partner_id = partnerId` and `deleted_at IS NULL`. Returns the same shape as the directory's `getClients()` but filtered.

### DataTable Columns

| Column | Content | Notes |
|--------|---------|-------|
| Client | `DataTableRowLink` → `/clients/[slug]/overview` | Name + slug below in muted |
| Industry | Plain text | Fallback "Not set" |
| Size | `sizeRange` | Fallback "Not set" |
| Campaigns | Count | Right-aligned, `tabular-nums` |
| Assessments | Count | Right-aligned, `tabular-nums` |
| Status | Badge | Active = `default`, Inactive = `outline` |
| Actions | `DataTableActionsMenu` | Open, Unassign (platform admin only) |

Searchable: `["name"]`. Filterable: status (active/inactive).

### Assign Client

"Assign Client" button (top right, `Plus` icon) opens a dialog:
- Search input filtering platform clients that currently have no partner (`partner_id IS NULL`)
- Results in a scrollable list with name + industry + size
- Clicking a client calls `assignClientToPartner(clientId, partnerId)` server action which sets `partner_id` on the client record
- Toast on success, dialog stays open for multi-assign, close manually

### Unassign Client

Via row actions dropdown → "Unassign from partner":
- `ConfirmDialog`: "This will remove {name} from this partner's portfolio. Their campaigns and data remain intact."
- Calls `unassignClientFromPartner(clientId)` which sets `partner_id = NULL`
- Toast with 5s undo

### Permissions

Platform admins see Assign button and Unassign action. Partner admins see the table read-only (no assign button, no actions column).

---

## 5. Assessments Tab (Both Partner & Client)

Replaces the current card-based assignment UI with a DataTable. Same pattern for both partner and client, differing only in the server actions called.

### DataTable Columns

| Column | Content | Notes |
|--------|---------|-------|
| Assessment | Name | Bold, primary text |
| Quota | "Unlimited" or `{used} / {limit}` | `tabular-nums`, inline edit on click |
| Usage | Progress indicator | Mini progress bar for limited quotas, "{used} used" for unlimited |
| Status | Low quota warning | Amber badge when <10% remaining, green when healthy |
| Assigned | Relative date | Tooltip with full datetime |
| Actions | `DataTableActionsMenu` | Edit Quota, Remove |

Searchable: `["assessmentName"]`. No faceted filters needed.

### Inline Quota Edit

Clicking "Edit Quota" in the row actions menu opens an inline edit:
- Input appears in the quota cell
- Enter to save, Escape to cancel
- Empty = unlimited
- Calls `updatePartnerAssessmentAssignment` or `updateAssessmentAssignment` depending on context

### Assign Assessment Dialog

"Assign Assessment" button opens a dialog with:
- Assessment picker (select dropdown filtering to unassigned, active assessments)
- **Client context:** When the client belongs to a partner, the picker only shows assessments from the partner's pool (from `partner_assessment_assignments`). This prevents the server-side guard from rejecting the assignment.
- Quota toggle (unlimited/limited) + quota input
- Assign button

### Remove Assessment

Row action → "Remove" → `ConfirmDialog`:
- **Partner context:** Checks if any clients still have this assessment. If so, blocks with error: "Remove this assessment from all clients first."
- **Client context:** Standard removal, existing campaigns unaffected.

### Data Sources

- **Partner:** `getPartnerAssessmentAssignments(partnerId)` — already implemented
- **Client:** `getAssessmentAssignments(clientId)` — already implemented
- Both return `*WithUsage` types that include `quotaUsed` and `assessmentName`

---

## 6. Reports Tab (Both Partner & Client)

Replaces the current checkbox/card-based UI with a DataTable.

### DataTable Columns

| Column | Content | Notes |
|--------|---------|-------|
| Template | Name + description (truncated) | Primary text + muted subtitle |
| Type | "Self-Report" or "360" | Badge |
| Level | "Dimension" / "Factor" / "Construct" | Plain text |
| Source | "Platform" or "Partner" | Muted text, indicates origin |
| Assigned | Toggle switch | Zone 1 immediate, calls toggle action |

Searchable: `["name"]`. Filterable: type (self_report/360), assigned (yes/no).

### Assign/Unassign

The toggle switch in the Assigned column fires immediately:
- **Partner:** `togglePartnerReportTemplateAssignment(partnerId, templateId, newState)` — already implemented
- **Client:** `toggleReportTemplateAssignment(clientId, templateId, newState)` — already implemented

Toast on success. Optimistic UI update with revert on error.

### Template Visibility

- **Partner:** All active platform templates shown
- **Client:** Platform-global templates + templates owned by the client's partner (same filter as current implementation)

---

## 7. Library Tab (Partner-Only)

Three sub-tabs for managing which taxonomy entities a partner can use to build their own assessments.

### Sub-Tab Navigation

Rendered as a secondary pill-style tab bar below the main shell tabs. Implemented as **client-side state** within a single `library/page.tsx` (not URL segments). Default tab: Dimensions. Tab state resets on navigation away and back (acceptable since there's no deep-linking need).

- **Dimensions** (default)
- **Factors**
- **Constructs**

Each sub-tab renders a DataTable.

### Dimensions DataTable

| Column | Content | Notes |
|--------|---------|-------|
| | Checkbox | Multi-select |
| Dimension | Name | Primary text |
| Factors | Count of child factors | `tabular-nums` |
| Constructs | Count of child constructs (via factors) | `tabular-nums` |
| Status | Toggle switch | Enabled/disabled for this partner |

Searchable: `["name"]`. Sortable on all columns.

### Factors DataTable

| Column | Content | Notes |
|--------|---------|-------|
| | Checkbox | Multi-select |
| Factor | Name | Primary text |
| Dimension | Parent dimension name | Sortable, filterable |
| Constructs | Count of child constructs | `tabular-nums` |
| Status | Toggle switch | Enabled/disabled for this partner |

Searchable: `["name"]`. Filterable: dimension (faceted). Sortable on all columns.

### Constructs DataTable

| Column | Content | Notes |
|--------|---------|-------|
| | Checkbox | Multi-select |
| Construct | Name | Primary text |
| Factor | Parent factor name | Sortable, filterable |
| Dimension | Grandparent dimension name | Sortable, filterable |
| Status | Toggle switch | Enabled/disabled for this partner |

Searchable: `["name"]`. Filterable: dimension (faceted), factor (faceted). Sortable on all columns.

### Bulk Operations

Multi-select checkboxes enable a toolbar that appears above the table:
- **Enable Selected** — toggles all selected rows on
- **Disable Selected** — toggles all selected rows off
- **{n} selected** count display

No cascading. Enabling a dimension does NOT auto-enable its factors/constructs. Each entity is toggled independently.

### Data Model

New table:

```sql
CREATE TABLE partner_taxonomy_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('dimension', 'factor', 'construct')),
  entity_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, entity_type, entity_id)
);

CREATE INDEX idx_partner_taxonomy_partner
  ON partner_taxonomy_assignments(partner_id, entity_type);
```

RLS: Platform admins full access, partner members read their own.

### Server Actions

New file `src/app/actions/partner-taxonomy.ts`:

- `getPartnerTaxonomyAssignments(partnerId, entityType: 'dimension' | 'factor' | 'construct')` — Returns an array of `{ entity: Dimension | Factor | Construct, assigned: boolean }`. Performs a LEFT JOIN between the taxonomy table (e.g., `dimensions`) and `partner_taxonomy_assignments` filtered by `partner_id` and `entity_type`. Includes parent entity names for sorting/filtering (e.g., factor rows include `dimensionName`, construct rows include `factorName` and `dimensionName`). Auth: `requirePartnerAccess(partnerId)`.

- `togglePartnerTaxonomyAssignment(partnerId, entityType, entityId, assigned: boolean)` — Upsert when `assigned=true`, set `is_active=false` when `assigned=false`. Auth: platform admin only.

- `bulkTogglePartnerTaxonomyAssignments(partnerId, entityType, entityIds: string[], assigned: boolean)` — Batch version of the above. Uses a single transaction. Auth: platform admin only.

### Permissions

Platform admins: full CRUD. Partner admins: read-only view (can see what's assigned, can't change it).

---

## 8. Layout Consistency Pass

### Width Standardisation

| Container | Current | New |
|-----------|---------|-----|
| Partner detail shell | `max-w-5xl` | `max-w-6xl` |
| Client detail shell | `max-w-5xl` | `max-w-6xl` |
| Content within Details tab | — | `max-w-3xl` (narrower for forms) |
| Content within DataTable tabs | — | Full width within shell |

### Card Consistency

All cards within the admin area follow the same pattern:
- `Card` component with consistent padding
- `CardHeader` with `CardTitle` + optional `CardDescription`
- Shadow-driven in light mode, border-driven in dark mode
- No orphaned narrow cards next to full-width content

### Empty States

Every tab has a consistent empty state:
- Centred icon (muted, 40px)
- Description text (muted, sm)
- Primary action button where applicable

### Loading States

Every route has a `loading.tsx` with `animate-shimmer` skeletons matching the page layout:
- Overview: 4 shimmer stat cards + 2 shimmer content cards + 1 shimmer activity card
- Details: 3 shimmer form cards
- DataTable tabs: `DataTableLoading` component with appropriate column/filter counts

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20260410100000_partner_profile_fields.sql` | Add description, website, contact_email, notes to partners |
| `supabase/migrations/20260410100001_partner_taxonomy_assignments.sql` | Taxonomy assignment table, indexes, RLS |
| `src/app/actions/partner-taxonomy.ts` | Server actions for library tab |
| `src/app/(dashboard)/partners/[slug]/details/page.tsx` | Partner details edit form |
| `src/app/(dashboard)/partners/[slug]/details/partner-details-form.tsx` | Partner details form component |
| `src/app/(dashboard)/partners/[slug]/details/loading.tsx` | Shimmer skeleton |
| `src/app/(dashboard)/partners/[slug]/clients/page.tsx` | Partner clients DataTable page |
| `src/app/(dashboard)/partners/[slug]/clients/partner-clients-table.tsx` | Clients DataTable component |
| `src/app/(dashboard)/partners/[slug]/clients/loading.tsx` | Shimmer skeleton |
| `src/app/(dashboard)/partners/[slug]/assessments/page.tsx` | Partner assessments assignment page |
| `src/app/(dashboard)/partners/[slug]/assessments/partner-assessment-assignments.tsx` | DataTable-based assignment component |
| `src/app/(dashboard)/partners/[slug]/assessments/loading.tsx` | Shimmer skeleton |
| `src/app/(dashboard)/partners/[slug]/reports/page.tsx` | Partner reports assignment page |
| `src/app/(dashboard)/partners/[slug]/reports/partner-report-assignments.tsx` | DataTable-based assignment component |
| `src/app/(dashboard)/partners/[slug]/reports/loading.tsx` | Shimmer skeleton |
| `src/app/(dashboard)/partners/[slug]/library/page.tsx` | Library tab with sub-tab routing |
| `src/app/(dashboard)/partners/[slug]/library/library-dimensions-table.tsx` | Dimensions DataTable |
| `src/app/(dashboard)/partners/[slug]/library/library-factors-table.tsx` | Factors DataTable |
| `src/app/(dashboard)/partners/[slug]/library/library-constructs-table.tsx` | Constructs DataTable |
| `src/app/(dashboard)/partners/[slug]/library/loading.tsx` | Shimmer skeleton |
| `src/app/(dashboard)/clients/[slug]/details/page.tsx` | Client details edit form |
| `src/app/(dashboard)/clients/[slug]/details/client-details-form.tsx` | Client details form component |
| `src/app/(dashboard)/clients/[slug]/details/loading.tsx` | Shimmer skeleton |

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/(dashboard)/partners/[slug]/partner-detail-shell.tsx` | Update tabs array, widen to `max-w-6xl` |
| `src/app/(dashboard)/clients/[slug]/client-detail-shell.tsx` | Update tabs array, widen to `max-w-6xl` |
| `src/app/(dashboard)/partners/[slug]/overview/page.tsx` | Replace with rich dashboard (remove edit form) |
| `src/app/(dashboard)/partners/[slug]/overview/partner-stats.tsx` | Upgrade to TiltCard + ScrollReveal + AnimatedNumber |
| `src/app/(dashboard)/partners/[slug]/overview/partner-overview.tsx` | Replace with Key Context + Quick Actions + Recent Activity |
| `src/app/(dashboard)/clients/[slug]/overview/page.tsx` | Replace with rich dashboard (same pattern as partner) |
| `src/app/(dashboard)/clients/[slug]/assessments/assessment-assignments.tsx` | Convert from card layout to DataTable |
| `src/app/(dashboard)/clients/[slug]/assessments/page.tsx` | Update to pass partner pool data for filtered picker |
| `src/app/(dashboard)/clients/[slug]/reports/report-assignments.tsx` | Convert from checkbox/card layout to DataTable |
| `src/app/(dashboard)/partners/[slug]/settings/partner-settings-panel.tsx` | Already contains only branding toggle — no changes needed, verify only |
| `src/types/database.ts` | Add description, website, contactEmail, notes to Partner interface |
| `src/lib/supabase/mappers.ts` | Update `mapPartnerRow` with new fields |
| `src/app/actions/partners.ts` | Add `getPartnerClients`, `assignClientToPartner`, `unassignClientFromPartner`, update `updatePartner` for new fields |
| `src/app/actions/client-entitlements.ts` | Add partner pool guard on `assignAssessment`, add `isClientBrandingEnabled` helper, extend `checkQuotaAvailability` (from entitlements plan Task 5) |
| `src/app/(dashboard)/clients/[slug]/settings/client-settings-panel.tsx` | Show branding toggle as disabled with "Controlled by partner" when partner branding off; limit assessment picker to partner pool |
| `src/app/(dashboard)/clients/[slug]/overview/client-overview.tsx` | Replace with rich dashboard (remove edit form embed) |
| `src/app/(dashboard)/clients/[slug]/overview/client-stats.tsx` | Upgrade to TiltCard + ScrollReveal + AnimatedNumber |

## Files to Delete

| File | Reason |
|------|--------|
| `src/app/(dashboard)/partners/[slug]/edit/page.tsx` | Edit form moves to `/details` tab; this route becomes dead |
| `src/app/(dashboard)/partners/[slug]/edit/partner-edit-form.tsx` | Replaced by `partner-details-form.tsx` in the new `/details` route |
| `src/app/(dashboard)/clients/[slug]/overview/client-edit-form.tsx` | Edit form moves to `/details` tab; overview becomes read-only |

**Note:** If any external links point to `/partners/[slug]/edit`, add a redirect in the old `edit/page.tsx` to `/partners/[slug]/details` before deleting. The directory table currently links to `/partners/{slug}/edit` — update that `rowHref` to `/partners/{slug}/overview`.

## Files NOT Changed

- `src/app/(dashboard)/partners/[slug]/users/` — already works, might get a minor polish but no structural changes
- `src/app/(dashboard)/partners/[slug]/branding/` — already works, no changes
- `src/app/partner/` — covered by the separate partner portal production polish plan
- `src/app/client/` — covered by the separate client portal plan
- `src/components/data-table/` — existing DataTable components are reused as-is
- `src/components/tilt-card.tsx`, `scroll-reveal.tsx`, `animated-number.tsx` — reused, not modified

## Verification

1. **Migration:** New columns apply cleanly, types regenerate
2. **Type check:** `npx tsc --noEmit` passes
3. **Unit tests:** `npm run test:unit` passes
4. **Partner overview:** Stats render with AnimatedNumber, Key Context shows profile data, Quick Actions link correctly
5. **Partner details:** Edit form saves, auto-save fields work, slug changes trigger `router.replace()`
6. **Partner clients:** DataTable renders, assign/unassign works, permission gating correct
7. **Partner assessments:** DataTable renders, assign with quota works, inline edit works, remove guard checks client usage
8. **Partner reports:** DataTable renders, toggle switch persists immediately
9. **Partner library:** All three sub-tabs render, toggle/multi-select/bulk operations work
10. **Client overview:** Same dashboard pattern as partner, different stat cards
11. **Client details:** Edit form with industry/size selects, partner shown as read-only
12. **Client assessments:** DataTable replaces cards, partner pool filter works
13. **Client reports:** DataTable replaces checkbox cards
14. **Client branding cascade:** Partner branding off → client toggle disabled with message
15. **Dark mode:** All new components render correctly in both modes
16. **Loading states:** Every new route has a shimmer skeleton matching its layout
