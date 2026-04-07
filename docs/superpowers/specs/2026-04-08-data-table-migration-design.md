# Data Table Migration — Design Spec

## Context

List pages across the platform use a mix of card grids and raw shadcn `Table` components. Card grids lack scannability for operational pages. Raw tables lack sorting, search, filtering, and pagination. The goal is to standardise on a single reusable `<DataTable>` component built on TanStack Table, then migrate all applicable pages.

**Taxonomy pages (dimensions, factors, constructs, items, response formats) remain as card grids** — they benefit from the visual layout. Diagnostic sessions/templates and campaign assessments (drag-reorder + factor picker) are also excluded.

## Dependency

- `@tanstack/react-table` (MIT license, open source)

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
- `emptyState?: React.ReactNode` — custom empty state
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

### Supporting sub-components

All in `src/components/data-table/`:

- `data-table-column-header.tsx` — sortable header cell with sort indicator arrows
- `data-table-search.tsx` — global search input with debounce
- `data-table-pagination.tsx` — page controls + row count + page size selector
- `data-table-faceted-filter.tsx` — multi-select dropdown filter per column
- `data-table-toolbar.tsx` — layout wrapper for search + filters + reset button
- `index.ts` — barrel export

### Styling

- Wraps existing shadcn `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` for visual consistency
- Interactive rows: `cursor-pointer hover:bg-muted/50` when `onRowClick` or `rowHref` is set
- Wrapped in `<ScrollReveal>` for entrance animation (single animation on the table, not per-row)
- Dark mode: border-driven rows (consistent with existing table pages)

## Pages to Migrate

### Tier 1 — Card Grids to DataTable

#### 1. Campaigns (dashboard)

**File:** `src/app/(dashboard)/campaigns/page.tsx`

**Columns:**

| Column | Field | Sortable | Notes |
|--------|-------|----------|-------|
| Title | `title` | Yes | Primary column, font-semibold |
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

Same as dashboard campaigns minus the Client column (already scoped).

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
**Note:** Keep the "Item Selection Rules" tab as-is — it's a separate view, not a table. The assessments tab content becomes the DataTable.

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

### Tier 2 — Raw Tables to DataTable

#### 6. Users

**File:** `src/app/(dashboard)/users/page.tsx` + `users-table.tsx`

Migrate the existing `UsersTable` component to use `<DataTable>`. Replace the manual `useMemo` filtering and custom tab/status buttons with DataTable's built-in filtering.

**Columns:** Avatar+name+email, Role (badge), Tenants (badges with +N tooltip), Status (dot + label), Date (relative with tooltip)
**Filters:** Role (platform admin, partner user, client user), Status (active, inactive, pending)
**Search:** Name, email
**Row click:** Navigate to user detail page

#### 7. Report Templates

**File:** `src/app/(dashboard)/report-templates/page.tsx`

Wrap in DataTable. Add sorting and search.

**Columns:** Template (icon + name + description), Type (badge), Display level, Blocks count, Active toggle, Actions (clone, delete)
**Search:** Template name
**Default sort:** Name ascending

#### 8. Reports

**File:** `src/app/(dashboard)/reports/page.tsx`

Wrap in DataTable. Add sorting, search, status filter.

**Columns:** Same as current + sorting on all
**Filters:** Status
**Search:** Report name

#### 9. Item Generator Runs

**File:** `src/app/(dashboard)/generate/page.tsx`

Wrap in DataTable. Add sorting and search.

**Columns:** Same as current + sorting
**Search:** Run name, model

#### 10. Campaign Participants (dashboard + client)

**File:** `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx`

Wrap the participant list in DataTable. Keep invite dialog, bulk import dialog, and action buttons (copy link, send invite, delete) as row actions.

**Columns:** Name/email (avatar), Status (badge), Actions (icon buttons)
**Search:** Name, email
**Note:** The invite and bulk import dialogs remain as header actions, not part of the table.

#### 11. Client Global Participants

**File:** `src/app/client/participants/page.tsx`

Replace custom pagination and filtering with DataTable.

**Columns:** Name/email, Campaign, Status
**Filters:** Campaign (dropdown), Status
**Search:** Name, email

## Excluded Pages

| Page | Reason |
|------|--------|
| Dimensions, Factors, Constructs, Items | Taxonomy entities — card layout preferred |
| Response Formats | Taxonomy-adjacent |
| Campaign Assessments (detail) | Drag-reorder + inline factor picker — too specialised |
| Diagnostic Sessions/Templates | Card layout suits these |
| Item Health / Psychometrics | Specialised visualisation |

## Testing

- Each migrated page should render correctly with empty data (empty state)
- Sorting cycles through asc/desc/none
- Search filters rows in real-time with debounce
- Faceted filters show correct options and filter correctly
- Pagination controls work (next/prev, page size change)
- Row click navigates to correct detail page
- Dark mode renders correctly (border-driven rows)
- Mobile: horizontal scroll works, table remains usable
