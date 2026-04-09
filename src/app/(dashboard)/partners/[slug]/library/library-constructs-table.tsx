"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Puzzle } from "lucide-react";
import { toast } from "sonner";

import {
  togglePartnerTaxonomyAssignment,
  bulkTogglePartnerTaxonomyAssignments,
  type TaxonomyAssignmentRow,
} from "@/app/actions/partner-taxonomy";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import type { DataTableFilterConfig } from "@/components/data-table/data-table-faceted-filter";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface LibraryConstructsTableProps {
  rows: TaxonomyAssignmentRow[];
  partnerId: string;
  isPlatformAdmin: boolean;
}

export function LibraryConstructsTable({
  rows: initialRows,
  partnerId,
  isPlatformAdmin,
}: LibraryConstructsTableProps) {
  const [rows, setOptimisticRows] = useOptimistic(
    initialRows,
    (
      state: TaxonomyAssignmentRow[],
      action: { ids: string[]; assigned: boolean },
    ) =>
      state.map((r) =>
        action.ids.includes(r.id) ? { ...r, assigned: action.assigned } : r,
      ),
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // ----- Toggle handler -----
  function handleToggle(entityId: string, currentlyAssigned: boolean) {
    const newState = !currentlyAssigned;
    startTransition(async () => {
      setOptimisticRows({ ids: [entityId], assigned: newState });
      const result = await togglePartnerTaxonomyAssignment(
        partnerId,
        "construct",
        entityId,
        newState,
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(newState ? "Construct enabled" : "Construct disabled");
    });
  }

  // ----- Bulk toggle handler -----
  function handleBulkToggle(assigned: boolean) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      setOptimisticRows({ ids, assigned });
      const result = await bulkTogglePartnerTaxonomyAssignments(
        partnerId,
        "construct",
        ids,
        assigned,
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${ids.length} construct${ids.length !== 1 ? "s" : ""} ${assigned ? "enabled" : "disabled"}`,
      );
      setSelected(new Set());
    });
  }

  // ----- Selection helpers -----
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  // ----- Columns -----
  const columns = useMemo<ColumnDef<TaxonomyAssignmentRow>[]>(() => {
    const cols: ColumnDef<TaxonomyAssignmentRow>[] = [];

    if (isPlatformAdmin) {
      cols.push({
        id: "select",
        header: () => (
          <Checkbox
            checked={rows.length > 0 && selected.size === rows.length}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selected.has(row.original.id)}
            onCheckedChange={() => toggleSelect(row.original.id)}
            aria-label={`Select ${row.original.name}`}
          />
        ),
        enableSorting: false,
        enableColumnFilter: false,
      });
    }

    cols.push(
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Construct" />
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: "factorName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Factor" />
        ),
        filterFn: "multiValue" as never,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.factorName ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "dimensionName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Dimension" />
        ),
        filterFn: "multiValue" as never,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.dimensionName ?? "—"}
          </span>
        ),
      },
    );

    if (isPlatformAdmin) {
      cols.push({
        id: "assigned",
        accessorFn: (row) => (row.assigned ? "yes" : "no"),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Assigned" />
        ),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <Switch
              checked={r.assigned}
              onCheckedChange={() => handleToggle(r.id, r.assigned)}
              aria-label={`Toggle assignment for ${r.name}`}
            />
          );
        },
      });
    } else {
      cols.push({
        id: "assigned",
        accessorFn: (row) => (row.assigned ? "yes" : "no"),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <span
            className={
              row.original.assigned
                ? "text-sm text-emerald-600 dark:text-emerald-400"
                : "text-sm text-muted-foreground"
            }
          >
            {row.original.assigned ? "Enabled" : "Disabled"}
          </span>
        ),
      });
    }

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selected, isPlatformAdmin]);

  // ----- Filterable columns config -----
  const factorOptions = useMemo(() => {
    const names = new Set(
      initialRows.map((r) => r.factorName).filter(Boolean) as string[],
    );
    return Array.from(names)
      .sort()
      .map((name) => ({ label: name, value: name }));
  }, [initialRows]);

  const dimensionOptions = useMemo(() => {
    const names = new Set(
      initialRows.map((r) => r.dimensionName).filter(Boolean) as string[],
    );
    return Array.from(names)
      .sort()
      .map((name) => ({ label: name, value: name }));
  }, [initialRows]);

  const filterableColumns = useMemo<DataTableFilterConfig[]>(
    () => [
      {
        id: "factorName",
        title: "Factor",
        options: factorOptions,
      },
      {
        id: "dimensionName",
        title: "Dimension",
        options: dimensionOptions,
      },
    ],
    [factorOptions, dimensionOptions],
  );

  // ----- Empty state -----
  const emptyState = (
    <div className="py-12 text-center">
      <Puzzle className="mx-auto size-10 text-muted-foreground/40" />
      <p className="mt-3 text-sm text-muted-foreground">
        No constructs available.
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Bulk action toolbar */}
      {isPlatformAdmin && selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkToggle(true)}
          >
            Enable Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkToggle(false)}
          >
            Disable Selected
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        searchableColumns={["name" as keyof TaxonomyAssignmentRow]}
        searchPlaceholder="Search constructs..."
        filterableColumns={filterableColumns}
        defaultSort={{ id: "name", desc: false }}
        pageSize={20}
        emptyState={emptyState}
      />
    </div>
  );
}
