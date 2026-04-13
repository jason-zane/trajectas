# Table Multi-Select, Bulk Actions & Width Standardisation

**Date:** 2026-04-14
**Status:** Approved

---

## Overview

Two focused improvements to tables across the site:

1. **Width standardisation** — all dashboard table pages use `max-w-6xl` (the wider standard already used by participants, users, diagnostics, matching).
2. **Multi-select & bulk actions** — every table gets row selection with a bulk action bar supporting delete, archive, and/or status change where applicable.

---

## Part 1: Width Standardisation

### Problem

Table pages are inconsistently constrained:
- `max-w-6xl` (correct): participants, users, diagnostics, matching, dashboard, generate/[runId]
- `max-w-5xl` (too narrow): assessments, campaigns, directory (client+partner), generate, diagnostics/templates, psychometrics/reliability, psychometrics/norms
- No max-w (unconstrained): report-templates

### Fix

Change `max-w-5xl` → `max-w-6xl` on all affected pages and add `max-w-6xl` to report-templates. No component changes required — page-level wrapper class only.

**Files to update:**
- `src/app/(dashboard)/assessments/page.tsx`
- `src/app/(dashboard)/campaigns/page.tsx`
- `src/app/(dashboard)/directory/page.tsx`
- `src/app/(dashboard)/generate/page.tsx`
- `src/app/(dashboard)/report-templates/page.tsx` (add max-w-6xl)
- `src/app/(dashboard)/diagnostics/templates/page.tsx`
- `src/app/(dashboard)/psychometrics/reliability/page.tsx`
- `src/app/(dashboard)/psychometrics/norms/page.tsx`

---

## Part 2: Multi-Select & Bulk Actions

### Architecture

**Option chosen: Extend DataTable directly.**

Add three new optional props to `DataTableProps<TData, TValue>`:

```ts
enableRowSelection?: boolean
getRowId?: (row: TData) => string   // defaults to (row as any).id
bulkActions?: BulkAction<TData>[]
```

New type in `src/components/data-table/types.ts` (or inline in data-table.tsx):

```ts
export interface BulkAction<TData> {
  label: string
  icon?: ReactNode
  variant?: 'default' | 'destructive'
  action: (ids: string[], rows: TData[]) => Promise<void> | void
}
```

### DataTable Behaviour Changes

- When `enableRowSelection` is true, TanStack's `rowSelection` state is enabled and a checkbox column is prepended.
- Header checkbox = select/deselect all rows on the current page.
- Checkbox cell uses `data-stop-row-click` so row navigation is not triggered.
- When ≥1 row is selected, a **bulk action bar** appears between the toolbar and table:
  - Shows `X row(s) selected`
  - Renders one button per `BulkAction` entry
  - A "Clear selection" link on the right
- Clicking a bulk action: calls `action(ids, rows)`, awaits it, clears selection, calls `router.refresh()`.
- Selection is cleared automatically on page/sort/filter change.
- When `enableRowSelection` is true but `bulkActions` is empty/undefined, checkboxes still render (for future use) but the bulk bar is not shown.

### Bulk Action Bar Component

Extract as `DataTableBulkBar` in `src/components/data-table/data-table-bulk-bar.tsx`:

```tsx
interface DataTableBulkBarProps<TData> {
  selectedCount: number
  selectedIds: string[]
  selectedRows: TData[]
  actions: BulkAction<TData>[]
  onClear: () => void
}
```

Rendered inside DataTable just above the `<Table>` element when `selectedCount > 0`.

### Exports

Add `BulkAction` type export to `src/components/data-table/index.ts`.

---

## Part 3: Per-Table Bulk Actions

### Participant Sessions Panel

The `ParticipantSessionsPanel` uses a raw `<Table>` and is not connected to DataTable. Convert it to use DataTable, then add session delete.

**New server action:** `deleteParticipantSessions(sessionIds: string[]): Promise<void>`
**Cascades:** Hard-delete on `participant_sessions` rows. Also deletes all associated response rows and report rows.

**Bulk action:** Delete (destructive). No archive or status change for sessions.

**Files:**
- `src/components/results/participant-sessions-panel.tsx` — convert to DataTable
- `src/app/actions/sessions.ts` — add `deleteParticipantSessions`

### Participants Table

**New server action:** `deleteParticipants(ids: string[]): Promise<void>`
Hard-delete cascading through sessions, responses, and reports.

**Bulk actions:**
- Delete (destructive)
- Status change (options: invited, registered, in_progress, completed, withdrawn, expired)

**Files:**
- `src/app/(dashboard)/participants/participants-table.tsx`
- `src/app/actions/participants.ts`

### Assessments Table

**New server action:** `bulkUpdateAssessmentStatus(ids: string[], status: string): Promise<void>`
Existing `deleteAssessment` handles individual archive; add `bulkDeleteAssessments(ids: string[])`.

**Bulk actions:**
- Delete (destructive) — hard delete
- Archive — sets status = 'archived'
- Status change (options: draft, active, archived)

**Files:**
- `src/app/(dashboard)/assessments/assessments-data-table.tsx`
- `src/app/actions/assessments.ts`

### Campaigns Table

**New server actions:** `bulkDeleteCampaigns`, `bulkUpdateCampaignStatus`

**Bulk actions:**
- Delete (destructive)
- Archive — sets status = 'archived'
- Status change (options: draft, active, closed, archived)

**Files:**
- `src/app/(dashboard)/campaigns/campaigns-table.tsx`
- `src/app/actions/campaigns.ts`

### Report Templates Table

**New server actions:** `bulkDeleteReportTemplates`, `bulkSetReportTemplateActive(ids, active: boolean)`

**Bulk actions:**
- Delete (destructive)
- Archive — sets isActive = false (labelled "Deactivate")

**Files:**
- `src/app/(dashboard)/report-templates/report-templates-table.tsx`
- `src/app/actions/report-templates.ts`

### Users Table

**New server actions:** `bulkDeleteUsers`, `bulkUpdateUserStatus`

**Bulk actions:**
- Delete (destructive)
- Status change (options: active, inactive)

Note: pending users cannot have status changed to active directly (requires email verification flow); the status change UI should exclude 'pending' as a target.

**Files:**
- `src/app/(dashboard)/users/users-table.tsx`
- `src/app/actions/users.ts`

### Client Directory Table

**New server actions:** `bulkDeleteClients`, `bulkUpdateClientStatus`

**Bulk actions:**
- Delete (destructive)
- Status change (options: active, inactive)

**Files:**
- `src/app/(dashboard)/directory/client-directory-table.tsx`
- `src/app/actions/clients.ts`

### Partner Directory Table

**New server actions:** `bulkDeletePartners`, `bulkArchivePartners`, `bulkRestorePartners`

**Bulk actions:**
- Delete (destructive)
- Archive
- Restore (labelled separately; only shown when archived rows are selected — or always shown, acting as restore if already archived)

**Files:**
- `src/app/(dashboard)/directory/partner-directory-table.tsx`
- `src/app/actions/partners.ts`

### Diagnostics Sessions Table

**New server actions:** `bulkDeleteDiagnosticSessions`, `bulkUpdateDiagnosticSessionStatus`

**Bulk actions:**
- Delete (destructive)
- Status change (contextual to diagnostic session statuses)

**Files:**
- `src/app/(dashboard)/diagnostics/diagnostic-sessions-table.tsx`
- `src/app/actions/diagnostics.ts` (or equivalent)

### Reports Table

**New server actions:** `bulkDeleteReports`, `bulkUpdateReportStatus`

**Bulk actions:**
- Delete (destructive)
- Status change

**Files:**
- `src/app/(dashboard)/reports/reports-table.tsx`
- `src/app/actions/reports.ts`

### Matching Runs Table

**New server action:** `bulkDeleteMatchingRuns`

**Bulk actions:**
- Delete (destructive) only

**Files:**
- `src/app/(dashboard)/matching/matching-runs-table.tsx`
- `src/app/actions/matching.ts`

### Generation Runs Table

**New server action:** `bulkDeleteGenerationRuns`

**Bulk actions:**
- Delete (destructive) only

**Files:**
- `src/app/(dashboard)/generate/generation-runs-table.tsx`
- `src/app/actions/generate.ts`

---

## Error Handling

- Each bulk action handler wraps in try/catch and shows a `toast.error` on failure.
- On success, show `toast.success` with a count: `"Deleted 3 participants"`.
- Partial failures (some rows fail): show count of successes and a warning about failures.
- The DataTable clears selection and refreshes regardless of outcome.

---

## Out of Scope

- Partner app tables (read-only, no mutation capability)
- Client app tables (read-only)
- Library tables (constructs/dimensions/factors already have custom checkbox pattern for assignment, not deletion)
- `sortable-item-table.tsx` (custom implementation, different purpose)
- Bulk actions that cross entity types

---

## Implementation Order

1. Width fixes (trivial, independent)
2. DataTable core changes (enableRowSelection, BulkAction type, DataTableBulkBar)
3. Server actions for all entities
4. Per-table wiring (participants → assessments → campaigns → rest)
5. Participant sessions panel conversion + session delete
