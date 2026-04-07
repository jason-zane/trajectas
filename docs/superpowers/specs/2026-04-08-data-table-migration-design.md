# Data Table Migration — Design Spec

## Context

List pages across the platform use a mix of card grids and raw shadcn `Table` components. Card grids lack scannability for operational pages. Raw tables lack sorting, search, filtering, and pagination. The goal is to standardise on a single reusable `<DataTable>` component built on TanStack Table, then migrate all applicable pages.

**Taxonomy pages (dimensions, factors, constructs, items, response formats) remain as card grids** — they benefit from the visual layout. Campaign assessments (drag-reorder + factor picker) are also excluded due to specialised interaction patterns.

## Dependency

- `@tanstack/react-table` (MIT license, open source)

## Architecture: Server/Client Boundary

All migrated pages follow this pattern:

1. **Server component** (`page.tsx`) fetches data via server actions (`await getCampaigns()`, etc.)
2. Server component passes data as props to a **client component** containing the `<DataTable>`
3. `<DataTable>` is `"use client"` (TanStack Table requires hooks)
4. Page-level `page.tsx` files remain server components — do NOT add `"use client"` to them

This matches the existing pattern used by `UsersTable` and keeps data fetching on the server.

## Shared Components

### `<DataTable<TData, TValue>>`

**Location:** `src/components/data-table/data-table.tsx`

A generic, reusable table component wrapping TanStack Table with shadcn `Table` primitives.

**Props:**
- `columns: ColumnDef<TData, TValue>[]` — TanStack column definitions
- `data: TData[]` — row data
- `searchPlaceholder?: string` — placeholder for the global search input
- `searchableColumns?: (keyof TData)[]` — which columns participate in global search
- `filterableColumns?: { id: string; title: string; options: { label: string; value: string; icon?: React.ComponentType }[] }[]` — faceted filter config
- `onRowClick?: (row: TData) => void` — optional row click handler
- `rowHref?: (row: TData) => string` — optional row link (renders row as navigable)
- `emptyState?: React.ReactNode` — custom empty state (defaults to `<EmptyState>` component from `@/components/empty-state`)
- `defaultSort?: { id: string; desc: boolean }` — initial sort
- `pageSize?: number` — default page size (default: 20)

**Features:**
- Column sorting (ascending/descending/none cycle)
- Global search with 300ms debounce
- Faceted column filters (multi-select dropdowns)
- Pagination with page size selector (10/20/50)
- Row count display
- Horizontal scroll on mobile
- Row hover state with optional click navigation

**Keyboard accessibility:**
- When `rowHref` is set, rows get `tabIndex={0}`, `role="link"`, and `onKeyDown` handling for Enter/Space to navigate (matching the existing `UsersTable` pattern)

### Supporting sub-components

All in `src/components/data-table/`:

- `data-table-column-header.tsx` — sortable header cell with sort indicator arrows
- `data-table-search.tsx` — global search input with debounce
- `data-table-pagination.tsx` — page controls + row count + page size selector
- `data-table-faceted-filter.tsx` — multi-select dropdown filter per column
- `data-table-toolbar.tsx` — layout wrapper for search + filters + reset button
- `data-table-row-actions.tsx` — standard right-aligned action cell (dropdown menu or icon buttons)
- `index.ts` — barrel export

### Styling

- Wraps existing shadcn `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` for visual consistency
- Interactive rows: `cursor-pointer hover:bg-muted/50` when `onRowClick` or `rowHref` is set
- Container: `rounded-xl border border-border bg-card shadow-sm` in light mode; border-emphasis in dark (shadow suppressed)
- Wrapped in `<ScrollReveal>` for entrance animation — single animation on the whole table container, not per-row (deliberate change from the per-card staggering used on card grids, as per-row animation would be jarring in a table)
- `TiltCard` is not used on table pages (removed from migrated pages)

### Per-page deliverables

Each migrated page must also update or create its `loading.tsx` to show a table-row shimmer layout (using `animate-shimmer`, not `animate-pulse`) matching the new table structure, per CLAUDE.md requirements.

## Pages to Migrate

### Tier 1 — Card Grids to DataTable

#### 1. Campaigns (dashboard)

**File:** `src/app/(dashboard)/campaigns/page.tsx`

**Columns:**

| Column | Field | Sortable | Notes |
|--------|-------|----------|-------|
| Title | `title` | Yes | Primary column, font-semibold. Description intentionally omitted for density — table rows should be scannable, not verbose. |
| Client | `clientName` | Yes | Falls back to "—" |
| Status | `status` | Yes | Badge with variant mapping |
| Assessments | `assessmentCount` | Yes | Numeric |
| Participants | `participantCount` | Yes | Numeric |
| Completion | computed | Yes | Percentage bar (completed/total) |
| Date Range | `opensAt`/`closesAt` | Yes (by opensAt) | Formatted date range |

**Filters:** Status (draft, active, paused, closed, archived)
**Search:** Title, client name
**Default sort:** Created date descending
**Row click:** Navigate to `/campaigns/{id}/overview`
**Action button:** "New Campaign" in page header (unchanged)

#### 2. Campaigns (client)

**File:** `src/app/client/campaigns/page.tsx`

Same as dashboard campaigns minus the Client column (already scoped to one client).

#### 3. Assessments

**File:** `src/app/(dashboard)/assessments/page.tsx`

**Columns:**

| Column | Field | Sortable | Notes |
|--------|-------|----------|-------|
| Title | `title` | Yes | Primary column |
| Status | `status` | Yes | Badge (draft/active/archived) |
| Creation Mode | `creationMode` | Yes | Badge (manual/ai/org-choice) |
| Factors | `factorCount` | Yes | Numeric |

**Filters:** Status (draft, active, archived)
**Search:** Title
**Default sort:** Title ascending
**Row click:** Navigate to `/assessments/{id}/edit`
**Note:** The page has two tabs: "Assessments" and "Item Selection Rules". The DataTable replaces the content inside `<TabsContent value="assessments">` only. The tab component and Item Selection Rules tab remain unchanged. The existing `searchParams`-based tab resolution continues to work.

#### 4. Directory — Clients

**File:** `src/app/(dashboard)/directory/page.tsx`

**Columns:**

| Column | Field | Sortable | Notes |
|--------|-------|----------|-------|
| Name | `name` | Yes | Primary column |
| Partner | `partnerName` | Yes | "Platform-owned" fallback |
| Status | `status` | Yes | Dot badge (active/inactive/archived) |
| Industry | `industry` | Yes | Plain text, "—" fallback |
| Assessments | `assessmentCount` | Yes | Numeric |
| Sessions | `sessionCount` | Yes | Numeric |

**Filters:** Status (active, inactive, archived)
**Search:** Name, partner name
**Default sort:** Name ascending
**Row click:** Navigate to `/clients/{slug}/overview`

#### 5. Directory — Partners

Same page file as clients, rendered in the "Partners" tab.

**Columns:**

| Column | Field | Sortable | Notes |
|--------|-------|----------|-------|
| Name | `name` | Yes | Primary column |
| Status | `status` | Yes | Dot badge |
| Clients | `clientCount` | Yes | Numeric |

**Filters:** Status (active, inactive, archived)
**Search:** Name
**Default sort:** Name ascending
**Row click:** Navigate to `/partners/{slug}/edit`

**Note:** Keep the clients/partners tab toggle. Each tab renders its own DataTable instance.

#### 6. Dashboard Participants

**File:** `src/app/(dashboard)/participants/page.tsx`

**Columns:**

| Column | Field | Sortable | Notes |
|--------|-------|----------|-------|
| Name/Email | `name`, `email` | Yes | Avatar + name + email |
| Campaign | `campaignTitle` | Yes | Campaign name |
| Status | `status` | Yes | Badge (invited/registered/in_progress/completed/withdrawn/expired) |
| Progress | `progress` | Yes | Progress indicator |
| Last Activity | `lastActivityAt` | Yes | Relative date with tooltip |

**Filters:** Status, Campaign
**Search:** Name, email
**Default sort:** Last activity descending

#### 7. Matching Runs

**File:** `src/app/(dashboard)/matching/page.tsx`

**Columns:**

| Column | Field | Sortable | Notes |
|--------|-------|----------|-------|
| Title/Client | `title`, `clientName` | Yes | Primary column |
| Status | `status` | Yes | Badge (pending/running/completed/failed) |
| Results | `resultCount` | Yes | Numeric |
| Created | `createdAt` | Yes | Relative date |

**Filters:** Status
**Search:** Title, client name
**Default sort:** Created descending
**Row click:** Navigate to matching run detail

#### 8. Diagnostic Sessions

**File:** `src/app/(dashboard)/diagnostics/page.tsx`

**Columns:**

| Column | Field | Sortable | Notes |
|--------|-------|----------|-------|
| Title | `title` | Yes | Primary column |
| Client | `clientName` | Yes | |
| Template | `templateName` | Yes | |
| Status | `status` | Yes | Badge |
| Respondents | `respondentCount` | Yes | Numeric |
| Created | `createdAt` | Yes | Relative date |

**Filters:** Status
**Search:** Title, client name
**Default sort:** Created descending

### Tier 2 — Raw Tables to DataTable

#### 9. Users

**File:** `src/app/(dashboard)/users/page.tsx` + `users-table.tsx`

Migrate the existing `UsersTable` component to use `<DataTable>`. The current role-tab system (All / Platform Admins / Partner Users / Client Users) groups by role category, not raw role value. This requires a custom `filterFn` on a computed `roleCategory` column that maps individual roles to their category. The tab-with-counts UX is preserved by rendering tab buttons above the DataTable that set the column filter value, with counts computed from the unfiltered data.

**Columns:** Avatar+name+email, Role (badge), Tenants (badges with +N tooltip), Status (dot + label), Date (relative with tooltip)
**Filters:** Role category (tabs: all/platform/partner/client with counts), Status (active, inactive, pending)
**Search:** Name, email
**Row click:** Navigate to user detail page

#### 10. Client-Scoped Users

**File:** `src/app/(dashboard)/clients/[slug]/users/page.tsx`

Migrate `ClientUsersTable` to DataTable. Same column pattern as main Users table but scoped to one client (no tenants column needed). Keep `InviteUserDialog` and `PendingInvitesSection` as-is.

#### 11. Partner-Scoped Users

**File:** `src/app/(dashboard)/partners/[slug]/users/page.tsx`

Migrate `PartnerUsersTable` to DataTable. Same pattern as client-scoped users. Keep `InvitePartnerUserDialog` and `PartnerPendingInvitesSection` as-is.

#### 12. Report Templates

**File:** `src/app/(dashboard)/report-templates/page.tsx`

Wrap in DataTable. Add sorting and search.

**Columns:** Template (icon + name + description), Type (badge), Display level, Blocks count, Active toggle, Actions (clone, delete)
**Search:** Template name
**Default sort:** Name ascending

#### 13. Reports

**File:** `src/app/(dashboard)/reports/page.tsx`

Wrap in DataTable. Add sorting, search, status filter.

**Columns:**

| Column | Field | Sortable | Notes |
|--------|-------|----------|-------|
| Report | `participantName` or ID | Yes | Participant name preferred over truncated UUID |
| Audience | `audienceType` | Yes | Badge |
| Status | `status` | Yes | Coloured badge |
| Mode | `narrativeMode` | Yes | |
| Generated | `createdAt` | Yes | Relative date with tooltip |

**Filters:** Status
**Search:** Participant name, audience type
**Default sort:** Generated descending

#### 14. Item Generator Runs

**File:** `src/app/(dashboard)/generate/page.tsx`

Wrap in DataTable. Add sorting and search.

**Columns:** Run name, Status, Items count, NMI score, Model, Actions (delete)
**Search:** Run name, model
**Default sort:** Created descending

#### 15. Campaign Participants (dashboard + client)

**File:** `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx`

Wrap the participant list in DataTable. Keep invite dialog, bulk import dialog, and action buttons (copy link, send invite, delete) as row actions.

**Columns:** Name/email (avatar), Status (badge), Actions (icon buttons)
**Search:** Name, email
**Note:** The invite and bulk import dialogs remain as header actions, not part of the table.

#### 16. Client Global Participants

**File:** `src/app/client/participants/page.tsx`

Replace custom pagination and filtering with DataTable.

**Columns:** Name/email, Campaign, Status
**Filters:** Campaign (dropdown), Status
**Search:** Name, email

## Excluded Pages

| Page | Reason |
|------|--------|
| Dimensions, Factors, Constructs, Items | Taxonomy entities — card layout preferred per user preference |
| Response Formats | Taxonomy-adjacent, card layout fits |
| Campaign Assessments (detail) | Drag-reorder + inline factor picker — too specialised for a generic table |
| Diagnostic Templates | Low volume, template-preview nature suits cards |
| Item Health / Psychometrics | Specialised visualisation with quality indicators, not a standard list |

## URL State

Filter, sort, and search state is client-side only (React state within `<DataTable>`). URL-based state (searchParams) is not used for DataTable state. Rationale: these are admin/management pages where shareability of filtered views is low-value, and adding URL state adds complexity to every page. The existing `searchParams`-based tab selection (assessments, directory) continues to work independently of the DataTable.

## Testing

- Each migrated page should render correctly with empty data (empty state using `<EmptyState>` component)
- Sorting cycles through asc/desc/none
- Search filters rows in real-time with debounce
- Faceted filters show correct options and filter correctly
- Pagination controls work (next/prev, page size change)
- Row click navigates to correct detail page
- Keyboard navigation works on interactive rows (Enter/Space)
- Dark mode renders correctly (border-emphasis, no shadow)
- Light mode renders correctly (shadow-sm, standard borders)
- Mobile: horizontal scroll works, table remains usable
- Loading states: each page's `loading.tsx` shows table-row shimmer
