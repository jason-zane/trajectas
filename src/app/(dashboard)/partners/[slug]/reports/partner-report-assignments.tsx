"use client";

import { useMemo, useOptimistic, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { togglePartnerReportTemplateAssignment } from "@/app/actions/partner-entitlements";
import type {
  ReportTemplate,
  PartnerReportTemplateAssignment,
} from "@/types/database";

import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/data-table";
import type { DataTableFilterConfig } from "@/components/data-table/data-table-faceted-filter";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DISPLAY_LEVEL_LABELS: Record<string, string> = {
  dimension: "Dimension",
  factor: "Factor",
  construct: "Construct",
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  self_report: "Self-Report",
  "360": "360",
};

// ---------------------------------------------------------------------------
// Row shape — template + assignment state
// ---------------------------------------------------------------------------

interface TemplateRow {
  id: string;
  name: string;
  description?: string;
  reportType: string;
  displayLevel: string;
  partnerId?: string;
  assigned: boolean;
}

function buildRows(
  templates: ReportTemplate[],
  assignments: PartnerReportTemplateAssignment[],
): TemplateRow[] {
  const assignedIds = new Set(assignments.map((a) => a.reportTemplateId));
  return templates
    .filter((t) => t.isActive)
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      reportType: t.reportType,
      displayLevel: t.displayLevel,
      partnerId: t.partnerId,
      assigned: assignedIds.has(t.id),
    }));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PartnerReportAssignmentsProps {
  templates: ReportTemplate[];
  assignments: PartnerReportTemplateAssignment[];
  partnerId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PartnerReportAssignments({
  templates,
  assignments,
  partnerId,
}: PartnerReportAssignmentsProps) {
  const initialRows = useMemo(
    () => buildRows(templates, assignments),
    [templates, assignments],
  );

  // Optimistic state for toggle
  const [rows, setOptimisticRows] = useOptimistic(
    initialRows,
    (state: TemplateRow[], toggledId: string) =>
      state.map((r) =>
        r.id === toggledId ? { ...r, assigned: !r.assigned } : r,
      ),
  );

  const [, startTransition] = useTransition();

  // ----- Toggle handler -----

  function handleToggle(templateId: string, currentlyAssigned: boolean) {
    const newState = !currentlyAssigned;

    startTransition(async () => {
      // Optimistic update
      setOptimisticRows(templateId);

      const result = await togglePartnerReportTemplateAssignment(
        partnerId,
        templateId,
        newState,
      );

      if ("error" in result) {
        toast.error(result.error);
        // The page will revalidate and revert optimistic state
        return;
      }

      toast.success(
        newState
          ? "Report template assigned"
          : "Report template removed",
      );
    });
  }

  // ----- Columns -----

  const columns = useMemo<ColumnDef<TemplateRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Template" />
        ),
        cell: ({ row }) => (
          <div className="min-w-0 max-w-xs">
            <span className="font-semibold text-foreground">
              {row.original.name}
            </span>
            {row.original.description && (
              <p className="text-caption mt-0.5 line-clamp-1">
                {row.original.description}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "reportType",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
        filterFn: "multiValue" as never,
        cell: ({ row }) => {
          const type = row.original.reportType;
          return (
            <Badge variant="outline">
              {REPORT_TYPE_LABELS[type] ?? type}
            </Badge>
          );
        },
      },
      {
        accessorKey: "displayLevel",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Level" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {DISPLAY_LEVEL_LABELS[row.original.displayLevel] ??
              row.original.displayLevel}
          </span>
        ),
      },
      {
        id: "source",
        accessorFn: (row) => (row.partnerId ? "partner" : "platform"),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Source" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.partnerId ? "Partner" : "Platform"}
          </span>
        ),
      },
      {
        id: "assigned",
        accessorFn: (row) => (row.assigned ? "yes" : "no"),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Assigned" />
        ),
        filterFn: "multiValue" as never,
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
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows],
  );

  // ----- Filterable columns config -----

  const filterableColumns = useMemo<DataTableFilterConfig[]>(
    () => [
      {
        id: "reportType",
        title: "Type",
        options: [
          { label: "Self-Report", value: "self_report" },
          { label: "360", value: "360" },
        ],
      },
      {
        id: "assigned",
        title: "Assigned",
        options: [
          { label: "Yes", value: "yes" },
          { label: "No", value: "no" },
        ],
      },
    ],
    [],
  );

  // ----- Empty state -----

  const emptyState = (
    <div className="py-12 text-center">
      <FileText className="mx-auto size-10 text-muted-foreground/40" />
      <p className="mt-3 text-sm text-muted-foreground">
        No report templates available. Create templates in the Report
        Templates section first.
      </p>
    </div>
  );

  // ----- Render -----

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchableColumns={["name" as keyof TemplateRow]}
      searchPlaceholder="Search templates..."
      filterableColumns={filterableColumns}
      defaultSort={{ id: "name", desc: false }}
      pageSize={20}
      emptyState={emptyState}
    />
  );
}
