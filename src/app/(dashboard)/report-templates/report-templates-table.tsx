"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { LayoutTemplate } from "lucide-react";

import type { ReportTemplate } from "@/types/database";
import { DataTable, DataTableColumnHeader, DataTableRowActions } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { ActiveToggle } from "./active-toggle";
import { CloneTemplateButton } from "./clone-template-button";
import { DeleteTemplateButton } from "./delete-template-button";

const REPORT_TYPE_LABELS: Record<string, string> = {
  self_report: "Self-report",
  "360": "360",
};

const DISPLAY_LEVEL_LABELS: Record<string, string> = {
  dimension: "Dimension",
  factor: "Factor",
  construct: "Construct",
};

type ReportTemplateRow = ReportTemplate & {
  blocksCount: number;
};

const columns: ColumnDef<ReportTemplateRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Template" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <LayoutTemplate className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.original.name}</p>
          {row.original.description ? (
            <p className="truncate text-sm text-muted-foreground">
              {row.original.description}
            </p>
          ) : null}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "reportType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">
        {REPORT_TYPE_LABELS[row.original.reportType] ?? row.original.reportType}
      </Badge>
    ),
  },
  {
    accessorKey: "displayLevel",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Display Level" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {DISPLAY_LEVEL_LABELS[row.original.displayLevel] ?? row.original.displayLevel}
      </span>
    ),
  },
  {
    accessorKey: "blocksCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Blocks" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.blocksCount}
      </span>
    ),
  },
  {
    accessorKey: "isActive",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Active" />
    ),
    cell: ({ row }) => (
      <div data-stop-row-click onClick={(event) => event.stopPropagation()}>
        <ActiveToggle templateId={row.original.id} isActive={row.original.isActive} />
      </div>
    ),
  },
  {
    id: "actions",
    enableSorting: false,
    cell: ({ row }) => (
      <DataTableRowActions>
        <CloneTemplateButton templateId={row.original.id} />
        <DeleteTemplateButton templateId={row.original.id} />
      </DataTableRowActions>
    ),
  },
];

export function ReportTemplatesTable({
  templates,
}: {
  templates: ReportTemplate[];
}) {
  const rows = templates.map((template) => ({
    ...template,
    blocksCount: template.blocks.length,
  }));

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchableColumns={["name"]}
      searchPlaceholder="Search templates"
      defaultSort={{ id: "name", desc: false }}
      rowHref={(row) => `/report-templates/${row.id}/builder`}
      pageSize={20}
    />
  );
}
