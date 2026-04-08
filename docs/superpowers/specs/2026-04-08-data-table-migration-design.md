# Data Table Migration — Design Spec

> **Status: Implemented.** This document describes the completed migration. All 16 pages listed below are live. The two outstanding items are noted explicitly.

## Context

List pages across the platform previously used a mix of card grids and raw shadcn `Table` components. This migration standardised all operational list pages on a shared `<DataTable>` component built on TanStack Table (`@tanstack/react-table`, MIT), providing consistent sorting, search, filtering, and pagination across the platform.

**Taxonomy pages (dimensions, factors, constructs, items, response formats) remain as card grids** — they benefit from the visual layout. Campaign assessments (drag-reorder + factor picker) are also excluded due to specialised interaction patterns.

## Dependency

- `@tanstack/react-table` (MIT license, open source)

## Architecture: Server/Client Boundary

All migrated pages follow this pattern:

1. **Server component** (`page.tsx`) fetches data via server actions (`await getCampaigns()`, etc.)
2. Server component passes data as props to a **client component** containing the `<DataTable>`
3. `<DataTable>` is `"use client"` (TanStack Table requires hooks)
4. Page-level `page.tsx` files remain server components — do NOT add `"use client"` to them

## Shared Components

All in `src/components/data-table/`:

### `<DataTable<TData, TValue>>`

**File:** `data-table.tsx`

A generic, reusable table component wrapping TanStack Table with shadcn `Table` primitives.

**Props:**
- `columns: ColumnDef<TData, TValue>[]` — TanStack column definitions
- `data: TData[]` — row data
- `searchPlaceholder?: string` — placeholder for the global search input
- `searchableColumns?: (keyof TData)[]` — which columns participate in global search
- `filterableColumns?: DataTableFilterConfig[]` — faceted filter config (see `data-table-faceted-filter.tsx` for type)
- `onRowClick?: (row: TData) => void` — optional row click handler
- `rowHref?: (row: TData) => string` — optional row link (renders row as navigable)
- `emptyState?: React.ReactNode` — custom empty state (defaults to `<EmptyState>` from `@/components/empty-state`)
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
- Keyboard accessibility: when `rowHref` is set, rows get `tabIndex={0}`, `role="link"`, and `onKeyDown` for Enter/Space

### Supporting sub-components

- `data-table-column-header.tsx` — sortable header cell with sort indicator arrows
- `data-table-search.tsx` — global search input with debounce
- `data-table-pagination.tsx` — page controls + row count + page size selector
- `data-table-faceted-filter.tsx` — multi-select dropdown filter per column; exports `DataTableFilterConfig` type
- `data-table-toolbar.tsx` — layout wrapper for search + filters + reset button
- `data-table-row-actions.tsx` — flex container for row action buttons (icon buttons, toggles, dropdown menus), right-aligned. Handles layout only — no behaviour.
- `data-table-loading.tsx` — shimmer loading skeleton. Props: `columnCount`, `rowCount`, `filterCount`. Uses `animate-shimmer` per CLAUDE.md. Used in each page's `loading.tsx`.
- `index.ts` — barrel export

### Styling

- Wraps existing shadcn `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`
- Interactive rows: `cursor-pointer hover:bg-muted/50` when `onRowClick` or `rowHref` is set
- Container: `rounded-xl border border-border bg-card shadow-sm` in light; border-emphasis, no shadow in dark
- Single `<ScrollReveal>` on the table container — not per-row (intentional departure from card grid staggering)
- `TiltCard` not used on table pages

### Role-tab filtering pattern (Users pages)

Pages with tab-based role filtering (Users, client-scoped users, partner-scoped users) use a **pre-filter pattern**, not a TanStack `filterFn`. A `matchesTab(row, activeTab)` function filters the data array before passing to `<DataTable>`. Tab counts are computed from the full unfiltered array via `useMemo`. This keeps the tab logic simple and separate from TanStack's internal filter pipeline.

## Completed Pages

### Previously card grids

#### 1. Campaigns (dashboard)

**Files:** `src/app/(dashboard)/campaigns/page.tsx` → `campaigns-table.tsx`

| Column | Sortable | Notes |
|--------|----------|-------|
| Title | Yes | font-semibold; description omitted for density |
| Client | Yes | "—" fallback |
| Status | Yes | Badge with variant mapping |
| Assessments | Yes | Numeric |
| Participants | Yes | Numeric |
| Completion | Yes | Progress bar (completed/total) |
| Date Range | Yes | `opensAt ?? createdAt`; **default sort: dateRange descending** |

**Filters:** Status (draft, active, paused, closed, archived)
**Search:** Title, client name
**Row click:** `/campaigns/{id}/overview`

#### 2. Campaigns (client)

**Files:** `src/app/client/campaigns/page.tsx` → client campaigns table component

Same as dashboard campaigns minus the Client column.

#### 3. Assessments

**Files:** `src/app/(dashboard)/assessments/page.tsx` → `assessments-data-table.tsx`

| Column | Sortable | Notes |
|--------|----------|-------|
| Title | Yes | |
| Status | Yes | Badge (draft/active/archived) |
| Creation Mode | Yes | Badge; values: `manual`, `ai_generated`, `org_choice` |
| Factors | Yes | Numeric |

**Filters:** Status (draft, active, archived)
**Search:** Title
**Default sort:** Title ascending
**Row click:** `/assessments/{id}/edit`
**Note:** Page has two tabs: "Assessments" and "Item Selection Rules". DataTable is inside `<TabsContent value="assessments">` only. Tab state is `searchParams`-based and independent of DataTable state.

#### 4. Directory — Clients

**File:** `src/app/(dashboard)/directory/page.tsx` → `ClientDirectoryTable`

| Column | Sortable | Notes |
|--------|----------|-------|
| Name | Yes | |
| Partner | Yes | "Platform-owned" fallback |
| Status | Yes | Dot badge |
| Industry | Yes | "—" fallback |
| Assessments | Yes | Numeric |
| Sessions | Yes | Numeric |

**Filters:** Status (active, inactive, archived)
**Search:** Name, partner name
**Default sort:** Name ascending
**Row click:** `/clients/{slug}/overview`

#### 5. Directory — Partners

Same page file, "Partners" tab → `PartnerDirectoryTable`

| Column | Sortable | Notes |
|--------|----------|-------|
| Name | Yes | |
| Status | Yes | Dot badge |
| Clients | Yes | Numeric |

**Filters:** Status (active, inactive, archived)
**Search:** Name
**Default sort:** Name ascending
**Row click:** `/partners/{slug}/edit`

**Note:** Directory uses `searchParams`-based tab toggle. Each tab renders a single DataTable instance conditionally; both datasets are fetched server-side and passed down.

#### 6. Dashboard Participants

**Files:** `src/app/(dashboard)/participants/page.tsx` → `ParticipantsTable`

| Column | Sortable | Notes |
|--------|----------|-------|
| Name/Email | Yes | Avatar + name + email |
| Campaign | Yes | |
| Status | Yes | Badge (invited/registered/in_progress/completed/withdrawn/expired) |
| Progress | Yes | Progress indicator |
| Last Activity | Yes | Relative date with tooltip |

**Filters:** Status, Campaign
**Search:** Name, email
**Default sort:** Last activity descending

#### 7. Matching Runs

**Files:** `src/app/(dashboard)/matching/page.tsx` → `MatchingRunsTable`

| Column | Sortable | Notes |
|--------|----------|-------|
| Title/Client | Yes | |
| Status | Yes | Badge (pending/running/completed/failed) |
| Results | Yes | Numeric |
| Created | Yes | Relative date |

**Filters:** Status
**Search:** Title, client name
**Default sort:** Created descending
**Row click:** None — no detail page exists yet. `rowHref` will be added when a matching run detail page is built.

#### 8. Diagnostic Sessions

**Files:** `src/app/(dashboard)/diagnostics/page.tsx` → `DiagnosticSessionsTable`

| Column | Sortable | Notes |
|--------|----------|-------|
| Title | Yes | |
| Client | Yes | |
| Template | Yes | |
| Status | Yes | Badge |
| Respondents | Yes | Numeric |
| Created | Yes | Relative date |

**Filters:** Status
**Search:** Title, client name
**Default sort:** Created descending
**Row click:** `/diagnostics/{id}`

### Previously raw shadcn tables

#### 9. Users

**Files:** `src/app/(dashboard)/users/page.tsx` + `users-table.tsx`

Uses the **pre-filter pattern** (see above). Tab buttons filter `rows` before passing to `<DataTable>` — no TanStack `filterFn`.

**Columns:** Avatar+name+email, Role (badge), Tenants (badges with +N tooltip), Status (dot + label), Date (relative with tooltip)
**Filters:** Role tabs (all/platform/partner/client with counts), Status (active, inactive, pending)
**Search:** Name, email
**Row click:** User detail page

#### 10. Client-Scoped Users

**Files:** `src/app/(dashboard)/clients/[slug]/users/page.tsx` + `client-users-table.tsx`

Same pre-filter tab pattern as Users. Scoped to one client — no Tenants column. `InviteUserDialog` and `PendingInvitesSection` remain as-is above the table.
**Default sort:** Name ascending

#### 11. Partner-Scoped Users

**Files:** `src/app/(dashboard)/partners/[slug]/users/page.tsx` + `partner-users-table.tsx`

Same pattern as client-scoped users. `InvitePartnerUserDialog` and `PartnerPendingInvitesSection` remain above the table.
**Default sort:** Name ascending

#### 12. Report Templates

**Files:** `src/app/(dashboard)/report-templates/page.tsx` + `ReportTemplatesTable`

**Columns:** Template (icon + name + description), Type (badge), Display level, Blocks count, Active toggle (Zone 1 — fires server action immediately), Actions (clone, delete)
**Search:** Template name
**Default sort:** Name ascending
**Note:** The page renders its own empty state (`LayoutTemplate` icon block) when `templates.length === 0`, bypassing DataTable's built-in empty state prop. The DataTable empty state is never reached for this page.

#### 13. Reports

**Files:** `src/app/(dashboard)/reports/page.tsx` + `reports-table.tsx`

| Column | Sortable | Notes |
|--------|----------|-------|
| Report | Yes | `participantName` with email fallback, then truncated ID |
| Audience | Yes | Badge |
| Status | Yes | Coloured badge |
| Mode | Yes | |
| Generated | Yes | Relative date with tooltip |

**Filters:** Status
**Search:** Participant name/email
**Default sort:** Generated descending
**Note:** `participantName` and `participantEmail` are already joined in `getAllReadySnapshots`.

#### 14. Item Generator Runs

**Files:** `src/app/(dashboard)/generate/page.tsx` + generator table component

**Columns:** Run name, Status, Items count, NMI score, Model, Actions (delete)
**Search:** Run name, model
**Default sort:** Created descending

#### 15. Campaign Participants (dashboard + client)

**File:** `src/app/(dashboard)/campaigns/[id]/participants/campaign-participant-manager.tsx`

The client portal (`src/app/client/campaigns/[id]/participants/page.tsx`) reuses this component.

**Columns:** Name/email (avatar), Status (badge), Actions (copy link, send invite, delete)
**Search:** Name, email
**Default sort:** Name ascending
**Note:** Invite and bulk import dialogs remain as header actions. Row selection/checkboxes are out of scope.

#### 16. Client Global Participants

**Files:** `src/app/client/participants/page.tsx` → `GlobalParticipants` component (`global-participants.tsx`)

**Columns:** Name/email, Campaign, Status
**Filters:** Campaign, Status
**Search:** Name, email
**Default sort:** Name ascending

## Excluded Pages

| Page | Reason |
|------|--------|
| Dimensions, Factors, Constructs, Items | Taxonomy entities — card layout preferred |
| Response Formats | Taxonomy-adjacent, card layout fits |
| Campaign Assessments (detail) | Drag-reorder + inline factor picker — specialised interaction |
| Diagnostic Templates | Low volume, template-preview nature suits cards |
| Item Health / Psychometrics | Specialised visualisation, not a standard list |

## Outstanding Work

Two items remain incomplete:

1. **Matching Runs row navigation** — `MatchingRunsTable` has no `rowHref`. Add it once a detail page at `/matching/{id}` is built.

2. **Report Templates empty state inconsistency** — `report-templates/page.tsx` renders its own empty state outside the DataTable, so the DataTable `emptyState` prop is never used for that page. Either remove the page-level empty state and pass it via the `emptyState` prop, or leave it as-is (functionally equivalent, just inconsistent).

## URL State

Filter, sort, and search state is client-side React state only. `searchParams`-based tab selection (assessments, directory) works independently and is unaffected.

## Testing

- Empty state renders correctly (empty data)
- Sorting cycles through asc/desc/none
- Search filters rows with debounce
- Faceted filters show correct options and filter correctly
- Pagination controls work (next/prev, page size change)
- Row click navigates correctly; keyboard nav (Enter/Space) works
- Dark mode: border-emphasis, no shadow
- Light mode: shadow-sm, standard borders
- Mobile: horizontal scroll works
- Loading states: `<DataTableLoading>` used in each page's `loading.tsx`
