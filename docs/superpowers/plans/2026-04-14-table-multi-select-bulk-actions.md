# Table Multi-Select & Bulk Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add consistent `max-w-6xl` width to all dashboard table pages, and wire multi-select + bulk actions (delete / archive / status change) into every table across the site.

**Architecture:** Extend the existing centralized `DataTable` component with `enableRowSelection`, `getRowId`, and `bulkActions` props — keeping the API consistent with how all 22 tables already customise `DataTable` via props. A new `DataTableBulkBar` component handles the selection toolbar UI. Bulk server actions follow the existing single-item action patterns (soft-delete via `deleted_at`, `revalidatePath`, `logAuditEvent`).

**Tech Stack:** React, TanStack Table v9, Next.js server actions, Supabase, Tailwind CSS, Sonner (toast), Lucide icons.

---

## File Map

### New files
- `src/components/data-table/data-table-bulk-bar.tsx` — Bulk action toolbar shown when ≥1 row selected

### Modified files
- `src/components/data-table/data-table.tsx` — Add `enableRowSelection`, `getRowId`, `bulkActions` props; wire selection state; render `DataTableBulkBar`
- `src/components/data-table/index.ts` — Export `BulkAction` type and `DataTableBulkBar`

#### Width fixes (Part 1)
- `src/app/(dashboard)/assessments/page.tsx`
- `src/app/(dashboard)/campaigns/page.tsx`
- `src/app/(dashboard)/directory/page.tsx`
- `src/app/(dashboard)/generate/page.tsx`
- `src/app/(dashboard)/report-templates/page.tsx`
- `src/app/(dashboard)/diagnostics/templates/page.tsx`
- `src/app/(dashboard)/psychometrics/reliability/page.tsx`
- `src/app/(dashboard)/psychometrics/norms/page.tsx`

#### Server actions (Part 3)
- `src/app/actions/assessments.ts` — Add `bulkDeleteAssessments`, `bulkUpdateAssessmentStatus`
- `src/app/actions/campaigns.ts` — Add `bulkDeleteCampaigns`, `bulkUpdateCampaignStatus`
- `src/app/actions/participants.ts` — Add `bulkDeleteParticipants`, `bulkUpdateParticipantStatus`
- `src/app/actions/report-templates.ts` — Add `bulkDeleteReportTemplates`, `bulkSetReportTemplateActive`
- `src/app/actions/users.ts` — Add `bulkDeleteUsers`, `bulkUpdateUserStatus`
- `src/app/actions/clients.ts` — Add `bulkDeleteClients`, `bulkUpdateClientStatus`
- `src/app/actions/partners.ts` — Add `bulkDeletePartners`, `bulkArchivePartners`
- `src/app/actions/sessions.ts` — Add `bulkDeleteParticipantSessions`
- `src/app/actions/diagnostics.ts` (or equivalent) — Add `bulkDeleteDiagnosticSessions`, `bulkUpdateDiagnosticSessionStatus`
- `src/app/actions/reports.ts` — Add `bulkDeleteReports`, `bulkUpdateReportStatus`
- `src/app/actions/matching.ts` — Add `bulkDeleteMatchingRuns`
- `src/app/actions/generate.ts` — Add `bulkDeleteGenerationRuns`

#### Per-table wiring (Part 4)
- `src/app/(dashboard)/assessments/assessments-data-table.tsx`
- `src/app/(dashboard)/campaigns/campaigns-table.tsx`
- `src/app/(dashboard)/participants/participants-table.tsx`
- `src/app/(dashboard)/report-templates/report-templates-table.tsx`
- `src/app/(dashboard)/users/users-table.tsx`
- `src/app/(dashboard)/directory/client-directory-table.tsx`
- `src/app/(dashboard)/directory/partner-directory-table.tsx`
- `src/app/(dashboard)/diagnostics/diagnostic-sessions-table.tsx`
- `src/app/(dashboard)/reports/reports-table.tsx`
- `src/app/(dashboard)/matching/matching-runs-table.tsx`
- `src/app/(dashboard)/generate/generation-runs-table.tsx`
- `src/components/results/participant-sessions-panel.tsx` — Convert to DataTable + add session delete

---

## Task 1: Width standardisation

**Files:** 8 page files

- [ ] **Step 1: Update all max-w-5xl pages**

In each file below, change the **one** `max-w-5xl` class to `max-w-6xl`:
- `src/app/(dashboard)/assessments/page.tsx`
- `src/app/(dashboard)/campaigns/page.tsx`
- `src/app/(dashboard)/directory/page.tsx`
- `src/app/(dashboard)/generate/page.tsx`
- `src/app/(dashboard)/diagnostics/templates/page.tsx`
- `src/app/(dashboard)/psychometrics/reliability/page.tsx`
- `src/app/(dashboard)/psychometrics/norms/page.tsx`

- [ ] **Step 2: Add max-w to report-templates**

In `src/app/(dashboard)/report-templates/page.tsx`, the outer div currently has `className="flex flex-col gap-8 p-6"`. Change it to:
```tsx
<div className="flex flex-col gap-8 p-6 max-w-6xl">
```

- [ ] **Step 3: Verify in dev server**

Load each page and confirm tables are the same width as the participants page.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/assessments/page.tsx \
        src/app/\(dashboard\)/campaigns/page.tsx \
        src/app/\(dashboard\)/directory/page.tsx \
        src/app/\(dashboard\)/generate/page.tsx \
        src/app/\(dashboard\)/report-templates/page.tsx \
        src/app/\(dashboard\)/diagnostics/templates/page.tsx \
        src/app/\(dashboard\)/psychometrics/reliability/page.tsx \
        src/app/\(dashboard\)/psychometrics/norms/page.tsx
git commit -m "fix(tables): standardise all table pages to max-w-6xl"
```

---

## Task 2: DataTableBulkBar component

**Files:**
- Create: `src/components/data-table/data-table-bulk-bar.tsx`

This component renders between the toolbar and the table when rows are selected. It shows a count, action buttons, and a clear link.

- [ ] **Step 1: Create the component**

```tsx
// src/components/data-table/data-table-bulk-bar.tsx
"use client";

import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BulkAction<TData> {
  label: string;
  icon?: ReactNode;
  variant?: "default" | "destructive";
  action: (ids: string[], rows: TData[]) => Promise<void> | void;
}

interface DataTableBulkBarProps<TData> {
  selectedCount: number;
  selectedIds: string[];
  selectedRows: TData[];
  actions: BulkAction<TData>[];
  onClear: () => void;
}

export function DataTableBulkBar<TData>({
  selectedCount,
  selectedIds,
  selectedRows,
  actions,
  onClear,
}: DataTableBulkBarProps<TData>) {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAction(bulkAction: BulkAction<TData>) {
    setActiveAction(bulkAction.label);
    startTransition(async () => {
      try {
        await bulkAction.action(selectedIds, selectedRows);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Action failed. Please try again."
        );
      } finally {
        setActiveAction(null);
        onClear();
      }
    });
  }

  return (
    <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
      <span className="text-sm font-medium text-foreground">
        {selectedCount} {selectedCount === 1 ? "row" : "rows"} selected
      </span>
      <div className="flex items-center gap-2 ml-2">
        {actions.map((bulkAction) => (
          <Button
            key={bulkAction.label}
            size="sm"
            variant={bulkAction.variant === "destructive" ? "destructive" : "outline"}
            disabled={isPending}
            onClick={() => handleAction(bulkAction)}
            className={cn(isPending && activeAction === bulkAction.label && "opacity-70")}
          >
            {bulkAction.icon}
            {bulkAction.label}
          </Button>
        ))}
      </div>
      <button
        onClick={onClear}
        disabled={isPending}
        className="ml-auto text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
      >
        Clear
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Export from index**

Add to `src/components/data-table/index.ts`:
```ts
export * from "./data-table-bulk-bar";
```

- [ ] **Step 3: Commit**

```bash
git add src/components/data-table/data-table-bulk-bar.tsx \
        src/components/data-table/index.ts
git commit -m "feat(data-table): add DataTableBulkBar component and BulkAction type"
```

---

## Task 3: Wire selection into DataTable

**Files:**
- Modify: `src/components/data-table/data-table.tsx`

Read the full file before editing. The changes are:
1. Import `Checkbox`, `DataTableBulkBar`, `BulkAction`
2. Add three props to `DataTableProps`
3. Add `rowSelection` state
4. Enable `getRowSelectionRowModel` in `useReactTable`
5. Prepend a select column when `enableRowSelection` is true
6. Render `DataTableBulkBar` above `<Table>` when rows are selected

- [ ] **Step 1: Update imports and props interface**

At the top of `data-table.tsx`, add:
```tsx
import { DataTableBulkBar, type BulkAction } from "@/components/data-table/data-table-bulk-bar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  // existing imports...
  getRowSelectionRowModel,
  type RowSelectionState,
} from "@tanstack/react-table";
```

Add to `DataTableProps<TData, TValue>`:
```tsx
enableRowSelection?: boolean;
getRowId?: (row: TData) => string;
bulkActions?: BulkAction<TData>[];
```

- [ ] **Step 2: Add selection state and row model**

Inside the component, after the `pagination` state:
```tsx
const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
```

Add `getRowSelectionRowModel: getRowSelectionRowModel()` to `useReactTable`.

Add to `state`:
```tsx
rowSelection,
```

Add handler:
```tsx
onRowSelectionChange: setRowSelection,
```

Add `getRowId` option to `useReactTable`:
```tsx
getRowId: getRowId ? (row) => getRowId(row) : (row) => (row as Record<string, unknown>).id as string,
```

- [ ] **Step 3: Build the select column**

Just before `resolvedColumns` is used to initialise `useReactTable`, prepend a checkbox column when `enableRowSelection` is true:

```tsx
const allColumns: ColumnDef<TData, TValue>[] = enableRowSelection
  ? [
      {
        id: "_select",
        enableSorting: false,
        header: ({ table }) => (
          <div data-stop-row-click className="flex items-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div data-stop-row-click className="flex items-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
      } as ColumnDef<TData, TValue>,
      ...resolvedColumns,
    ]
  : resolvedColumns;
```

Pass `allColumns` (not `resolvedColumns`) to `useReactTable`.

- [ ] **Step 4: Compute selected rows for bulk bar**

After the table is initialised:
```tsx
const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
const selectedIds = selectedRows.map(
  (row) => getRowId ? getRowId(row) : (row as Record<string, unknown>).id as string
);
const hasSelection = selectedRows.length > 0;
```

Clear selection on filter/search/sort change — add to the `useEffect` that resets pagination:
```tsx
useEffect(() => {
  setPagination((current) =>
    current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
  );
  setRowSelection({});
}, [debouncedSearch, columnFilters]);
```

- [ ] **Step 5: Render bulk bar**

Inside the JSX, between the toolbar div and `<Table>`, add:
```tsx
{hasSelection && bulkActions && bulkActions.length > 0 ? (
  <DataTableBulkBar
    selectedCount={selectedRows.length}
    selectedIds={selectedIds}
    selectedRows={selectedRows}
    actions={bulkActions}
    onClear={() => setRowSelection({})}
  />
) : null}
```

- [ ] **Step 6: Verify**

Start dev server. Navigate to a table page (you'll add `enableRowSelection` in later tasks — for now confirm the build compiles without errors).

```bash
pnpm dev
```

- [ ] **Step 7: Commit**

```bash
git add src/components/data-table/data-table.tsx
git commit -m "feat(data-table): add enableRowSelection and bulkActions support"
```

---

## Task 4: Bulk server actions — assessments

**Files:**
- Modify: `src/app/actions/assessments.ts`

Follow the existing `deleteAssessment` pattern. Bulk variants use `.in('id', ids)` instead of `.eq('id', id)`.

- [ ] **Step 1: Add bulkDeleteAssessments**

Append to `assessments.ts`:
```ts
export async function bulkDeleteAssessments(ids: string[]) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('assessments')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidateAssessmentPaths()
}
```

- [ ] **Step 2: Add bulkUpdateAssessmentStatus**

```ts
export async function bulkUpdateAssessmentStatus(ids: string[], status: string) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('assessments')
    .update({ status })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidateAssessmentPaths()
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/assessments.ts
git commit -m "feat(assessments): add bulk delete and status update actions"
```

---

## Task 5: Bulk server actions — campaigns

**Files:**
- Modify: `src/app/actions/campaigns.ts`

- [ ] **Step 1: Add bulkDeleteCampaigns**

```ts
export async function bulkDeleteCampaigns(ids: string[]) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin && !scope.isPartnerAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/campaigns')
  revalidatePath('/')
}
```

- [ ] **Step 2: Add bulkUpdateCampaignStatus**

```ts
export async function bulkUpdateCampaignStatus(ids: string[], status: string) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin && !scope.isPartnerAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('campaigns')
    .update({ status })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/campaigns')
  revalidatePath('/')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/campaigns.ts
git commit -m "feat(campaigns): add bulk delete and status update actions"
```

---

## Task 6: Bulk server actions — participants

**Files:**
- Modify: `src/app/actions/participants.ts`

- [ ] **Step 1: Add bulkDeleteParticipants**

```ts
export async function bulkDeleteParticipants(ids: string[]) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin && !scope.isPartnerAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_participants')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/participants')
  revalidatePath('/')
}
```

> Note: Check the actual table name used for participants in the existing actions file — it may be `campaign_participants`. Confirm before writing this action.

- [ ] **Step 2: Add bulkUpdateParticipantStatus**

```ts
export async function bulkUpdateParticipantStatus(ids: string[], status: string) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin && !scope.isPartnerAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('campaign_participants')
    .update({ status })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/participants')
  revalidatePath('/')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/participants.ts
git commit -m "feat(participants): add bulk delete and status update actions"
```

---

## Task 7: Bulk server actions — report templates

**Files:**
- Modify: `src/app/actions/report-templates.ts`

Read the file first to understand the table name (`report_templates`) and auth pattern.

- [ ] **Step 1: Add bulkDeleteReportTemplates**

```ts
export async function bulkDeleteReportTemplates(ids: string[]) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('report_templates')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/report-templates')
}
```

> Note: if `report_templates` uses a different deletion strategy (e.g. hard delete), match the existing `deleteReportTemplate` action.

- [ ] **Step 2: Add bulkSetReportTemplateActive**

```ts
export async function bulkSetReportTemplateActive(ids: string[], isActive: boolean) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('report_templates')
    .update({ is_active: isActive })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/report-templates')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/report-templates.ts
git commit -m "feat(report-templates): add bulk delete and activate actions"
```

---

## Task 8: Bulk server actions — users, clients, partners

**Files:**
- Modify: `src/app/actions/users.ts`
- Modify: `src/app/actions/clients.ts`
- Modify: `src/app/actions/partners.ts`

Read each file before writing actions — confirm table names and auth patterns.

- [ ] **Step 1: Add bulk user actions to users.ts**

```ts
export async function bulkDeleteUsers(ids: string[]) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/users')
}

export async function bulkUpdateUserStatus(ids: string[], status: string) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('profiles')
    .update({ status })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/users')
}
```

> Note: confirm the actual table name — it may be `profiles` or `users`. Match the existing `deleteUser` action.

- [ ] **Step 2: Add bulk client actions to clients.ts**

```ts
export async function bulkDeleteClients(ids: string[]) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/directory')
}

export async function bulkUpdateClientStatus(ids: string[], status: string) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('clients')
    .update({ status })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/directory')
}
```

- [ ] **Step 3: Add bulk partner actions to partners.ts**

```ts
export async function bulkDeletePartners(ids: string[]) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('partners')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/directory')
}

export async function bulkArchivePartners(ids: string[]) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('partners')
    .update({ status: 'archived' })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/directory')
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/users.ts src/app/actions/clients.ts src/app/actions/partners.ts
git commit -m "feat(directory): add bulk delete/status/archive actions for users, clients, partners"
```

---

## Task 9: Bulk server actions — diagnostics, reports, matching, generation, sessions

Read each relevant actions file before writing. Match the table names and auth patterns from existing single-item actions.

**Files:**
- Modify: actions file for diagnostics
- Modify: `src/app/actions/reports.ts`
- Modify: `src/app/actions/matching.ts` (or equivalent)
- Modify: `src/app/actions/generate.ts` (or equivalent)
- Modify: `src/app/actions/sessions.ts`

- [ ] **Step 1: Find diagnostics action file**

```bash
find src/app/actions -name "*.ts" | xargs grep -l "diagnostic" 2>/dev/null
```

- [ ] **Step 2: Add bulk diagnostics actions**

Add to the diagnostics action file:
```ts
export async function bulkDeleteDiagnosticSessions(ids: string[]) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('diagnostic_sessions')       // confirm table name
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/diagnostics')
}

export async function bulkUpdateDiagnosticSessionStatus(ids: string[], status: string) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('diagnostic_sessions')
    .update({ status })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/diagnostics')
}
```

- [ ] **Step 3: Add bulk reports actions**

```ts
export async function bulkDeleteReports(ids: string[]) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('reports')                    // confirm table name
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/reports')
}

export async function bulkUpdateReportStatus(ids: string[], status: string) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('reports')
    .update({ status })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/reports')
}
```

- [ ] **Step 4: Add bulk matching + generation run actions**

Add `bulkDeleteMatchingRuns` to matching actions file and `bulkDeleteGenerationRuns` to generate actions file, following the same soft-delete pattern. Confirm the correct table names from the existing single-item delete actions in each file.

- [ ] **Step 5: Add bulkDeleteParticipantSessions to sessions.ts**

```ts
export async function bulkDeleteParticipantSessions(ids: string[]) {
  if (ids.length === 0) return
  const scope = await resolveAuthorizedScope()
  if (!scope.isPlatformAdmin && !scope.isPartnerAdmin) return { error: 'Unauthorized' }

  const db = createAdminClient()
  const { error } = await db
    .from('participant_sessions')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/participants')
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/sessions.ts src/app/actions/reports.ts
git add $(find src/app/actions -name "*.ts" | xargs grep -l "diagnostic\|matching\|generation" | tr '\n' ' ')
git commit -m "feat(actions): add bulk delete/status actions for diagnostics, reports, matching, generation, sessions"
```

---

## Task 10: Wire bulk actions — assessments table

**Files:**
- Modify: `src/app/(dashboard)/assessments/assessments-data-table.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { Archive, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { bulkDeleteAssessments, bulkUpdateAssessmentStatus } from "@/app/actions/assessments";
import type { BulkAction } from "@/components/data-table";
```

- [ ] **Step 2: Define bulk actions**

Inside `AssessmentsDataTable` component, before the `return`:
```tsx
const bulkActions: BulkAction<AssessmentWithMeta>[] = [
  {
    label: "Archive",
    icon: <Archive className="size-4" />,
    variant: "default",
    action: async (ids) => {
      const result = await bulkUpdateAssessmentStatus(ids, "archived");
      if (result?.error) throw new Error(result.error);
      toast.success(`Archived ${ids.length} assessment${ids.length !== 1 ? "s" : ""}`);
    },
  },
  {
    label: "Delete",
    icon: <Trash2 className="size-4" />,
    variant: "destructive",
    action: async (ids) => {
      const result = await bulkDeleteAssessments(ids);
      if (result?.error) throw new Error(result.error);
      toast.success(`Deleted ${ids.length} assessment${ids.length !== 1 ? "s" : ""}`);
    },
  },
];
```

- [ ] **Step 3: Add props to DataTable**

```tsx
<DataTable
  ...
  enableRowSelection
  bulkActions={bulkActions}
/>
```

- [ ] **Step 4: Verify in browser**

Open `/assessments`. Confirm checkboxes appear, bulk bar shows when rows are selected, archive and delete work.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/assessments/assessments-data-table.tsx
git commit -m "feat(assessments): add multi-select and bulk archive/delete"
```

---

## Task 11: Wire bulk actions — campaigns table

**Files:**
- Modify: `src/app/(dashboard)/campaigns/campaigns-table.tsx`

- [ ] **Step 1: Add imports and bulk actions**

```tsx
import { Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { bulkDeleteCampaigns, bulkUpdateCampaignStatus } from "@/app/actions/campaigns";
import type { BulkAction } from "@/components/data-table";
```

Define `bulkActions` inside `CampaignsTable` (or however the export is named — read the file):
```tsx
const bulkActions: BulkAction<CampaignRow>[] = [
  {
    label: "Archive",
    icon: <Archive className="size-4" />,
    action: async (ids) => {
      const result = await bulkUpdateCampaignStatus(ids, "archived");
      if (result?.error) throw new Error(result.error);
      toast.success(`Archived ${ids.length} campaign${ids.length !== 1 ? "s" : ""}`);
    },
  },
  {
    label: "Delete",
    icon: <Trash2 className="size-4" />,
    variant: "destructive",
    action: async (ids) => {
      const result = await bulkDeleteCampaigns(ids);
      if (result?.error) throw new Error(result.error);
      toast.success(`Deleted ${ids.length} campaign${ids.length !== 1 ? "s" : ""}`);
    },
  },
];
```

- [ ] **Step 2: Add props to DataTable, verify, commit**

```tsx
<DataTable ... enableRowSelection bulkActions={bulkActions} />
```

```bash
git add src/app/\(dashboard\)/campaigns/campaigns-table.tsx
git commit -m "feat(campaigns): add multi-select and bulk archive/delete"
```

---

## Task 12: Wire bulk actions — participants table

**Files:**
- Modify: `src/app/(dashboard)/participants/participants-table.tsx`

- [ ] **Step 1: Add imports and bulk actions**

```tsx
import { Trash2, UserX } from "lucide-react";
import { toast } from "sonner";
import { bulkDeleteParticipants, bulkUpdateParticipantStatus } from "@/app/actions/participants";
import type { BulkAction } from "@/components/data-table";
```

```tsx
const bulkActions: BulkAction<ParticipantTableRow>[] = [
  {
    label: "Withdraw",
    icon: <UserX className="size-4" />,
    action: async (ids) => {
      const result = await bulkUpdateParticipantStatus(ids, "withdrawn");
      if (result?.error) throw new Error(result.error);
      toast.success(`Withdrawn ${ids.length} participant${ids.length !== 1 ? "s" : ""}`);
    },
  },
  {
    label: "Delete",
    icon: <Trash2 className="size-4" />,
    variant: "destructive",
    action: async (ids) => {
      const result = await bulkDeleteParticipants(ids);
      if (result?.error) throw new Error(result.error);
      toast.success(`Deleted ${ids.length} participant${ids.length !== 1 ? "s" : ""}`);
    },
  },
];
```

- [ ] **Step 2: Add props, verify, commit**

```tsx
<DataTable ... enableRowSelection bulkActions={bulkActions} />
```

```bash
git add src/app/\(dashboard\)/participants/participants-table.tsx
git commit -m "feat(participants): add multi-select and bulk withdraw/delete"
```

---

## Task 13: Wire bulk actions — report templates, users, directory tables

**Files:**
- Modify: `src/app/(dashboard)/report-templates/report-templates-table.tsx`
- Modify: `src/app/(dashboard)/users/users-table.tsx`
- Modify: `src/app/(dashboard)/directory/client-directory-table.tsx`
- Modify: `src/app/(dashboard)/directory/partner-directory-table.tsx`

Follow the same pattern as Tasks 10–12 for each table. Read each file before editing to confirm type names.

- [ ] **Step 1: Report templates**

Bulk actions: Deactivate (`bulkSetReportTemplateActive(ids, false)`) + Delete (`bulkDeleteReportTemplates`).

```tsx
const bulkActions: BulkAction<ReportTemplate>[] = [
  {
    label: "Deactivate",
    icon: <EyeOff className="size-4" />,
    action: async (ids) => {
      const result = await bulkSetReportTemplateActive(ids, false);
      if (result?.error) throw new Error(result.error);
      toast.success(`Deactivated ${ids.length} template${ids.length !== 1 ? "s" : ""}`);
    },
  },
  {
    label: "Delete",
    icon: <Trash2 className="size-4" />,
    variant: "destructive",
    action: async (ids) => {
      const result = await bulkDeleteReportTemplates(ids);
      if (result?.error) throw new Error(result.error);
      toast.success(`Deleted ${ids.length} template${ids.length !== 1 ? "s" : ""}`);
    },
  },
];
```

- [ ] **Step 2: Users**

Bulk actions: Deactivate (`bulkUpdateUserStatus(ids, "inactive")`) + Delete (`bulkDeleteUsers`).

- [ ] **Step 3: Client directory**

Bulk actions: Deactivate (`bulkUpdateClientStatus(ids, "inactive")`) + Delete (`bulkDeleteClients`).

- [ ] **Step 4: Partner directory**

Bulk actions: Archive (`bulkArchivePartners`) + Delete (`bulkDeletePartners`).

- [ ] **Step 5: Add `enableRowSelection` and `bulkActions` to each DataTable render, verify in browser, commit**

```bash
git add src/app/\(dashboard\)/report-templates/report-templates-table.tsx \
        src/app/\(dashboard\)/users/users-table.tsx \
        src/app/\(dashboard\)/directory/client-directory-table.tsx \
        src/app/\(dashboard\)/directory/partner-directory-table.tsx
git commit -m "feat(tables): add multi-select and bulk actions to report-templates, users, directory"
```

---

## Task 14: Wire bulk actions — diagnostics, reports, matching, generation tables

**Files:**
- `src/app/(dashboard)/diagnostics/diagnostic-sessions-table.tsx`
- `src/app/(dashboard)/reports/reports-table.tsx`
- `src/app/(dashboard)/matching/matching-runs-table.tsx`
- `src/app/(dashboard)/generate/generation-runs-table.tsx`

For each: read the file, identify the row type, add `enableRowSelection` and `bulkActions`. All four follow the same pattern — Delete only for matching/generation runs; Delete + Status change for diagnostics and reports.

- [ ] **Step 1: Diagnostics**

Bulk actions: Status change (to "closed" or "archived" — match existing status values) + Delete.

- [ ] **Step 2: Reports**

Bulk actions: Status change + Delete.

- [ ] **Step 3: Matching runs + generation runs**

Bulk action: Delete only.

- [ ] **Step 4: Verify all four in browser, commit**

```bash
git add src/app/\(dashboard\)/diagnostics/diagnostic-sessions-table.tsx \
        src/app/\(dashboard\)/reports/reports-table.tsx \
        src/app/\(dashboard\)/matching/matching-runs-table.tsx \
        src/app/\(dashboard\)/generate/generation-runs-table.tsx
git commit -m "feat(tables): add multi-select and bulk actions to diagnostics, reports, matching, generation"
```

---

## Task 15: Convert participant sessions panel to DataTable + session delete

**Files:**
- Modify: `src/components/results/participant-sessions-panel.tsx`

This panel currently uses raw `<Table>` markup. Convert it to use `DataTable` with session delete.

- [ ] **Step 1: Read the full file**

Read `src/components/results/participant-sessions-panel.tsx` to understand the full column structure and data types.

- [ ] **Step 2: Convert to DataTable**

Replace the raw `<Table>` implementation with `DataTable`. Define `columns: ColumnDef<ParticipantSession>[]` matching the existing rendered columns (attempt number, assessment title, status, processing status, started/completed dates, link).

The `rowHref` should use `sessionBaseHref` prop: `rowHref={(row) => \`${sessionBaseHref}/${row.id}\`}`.

- [ ] **Step 3: Add bulk delete**

```tsx
import { bulkDeleteParticipantSessions } from "@/app/actions/sessions";
import type { BulkAction } from "@/components/data-table";

const bulkActions: BulkAction<ParticipantSession>[] = [
  {
    label: "Delete",
    icon: <Trash2 className="size-4" />,
    variant: "destructive",
    action: async (ids) => {
      const result = await bulkDeleteParticipantSessions(ids);
      if (result?.error) throw new Error(result.error);
      toast.success(`Deleted ${ids.length} session${ids.length !== 1 ? "s" : ""}`);
    },
  },
];
```

Pass `enableRowSelection` and `bulkActions` to the DataTable.

- [ ] **Step 4: Verify in browser**

Open a participant detail page → Sessions tab. Confirm the table renders correctly, sessions are navigable, and bulk delete works.

- [ ] **Step 5: Commit**

```bash
git add src/components/results/participant-sessions-panel.tsx
git commit -m "feat(sessions): convert sessions panel to DataTable and add bulk delete"
```

---

## Task 16: Final verification

- [ ] **Step 1: Audit all tables**

Visit each table page and confirm:
- Checkboxes appear on all rows
- Selecting rows shows the bulk bar
- Each bulk action performs the expected operation
- Deselecting / changing filters / changing pages clears selection
- Row navigation still works when clicking non-checkbox areas

Pages to check:
- `/assessments`
- `/campaigns`
- `/participants` (and a participant detail → Sessions tab)
- `/report-templates`
- `/users`
- `/directory` (both client and partner tabs)
- `/diagnostics`
- `/reports`
- `/matching`
- `/generate`

- [ ] **Step 2: Check widths**

Confirm all table pages are the same width as each other.

- [ ] **Step 3: Build check**

```bash
pnpm build
```

Expected: no TypeScript errors, clean build.
