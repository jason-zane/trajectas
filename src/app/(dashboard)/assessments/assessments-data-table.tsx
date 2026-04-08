"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { AssessmentWithMeta } from "@/app/actions/assessments";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<string, "secondary" | "default" | "outline"> = {
  draft: "secondary",
  active: "default",
  archived: "outline",
};

const CREATION_MODE_LABEL: Record<string, string> = {
  manual: "Manual",
  ai_generated: "AI Generated",
  org_choice: "Org Choice",
};

const columns: ColumnDef<AssessmentWithMeta>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{row.original.title}</p>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status] ?? "secondary"}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "creationMode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Creation Mode" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">
        {CREATION_MODE_LABEL[row.original.creationMode] ?? row.original.creationMode}
      </Badge>
    ),
  },
  {
    accessorKey: "factorCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Factors" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.factorCount}
      </span>
    ),
  },
];

export function AssessmentsDataTable({
  assessments,
}: {
  assessments: AssessmentWithMeta[];
}) {
  return (
    <DataTable
      columns={columns}
      data={assessments}
      searchableColumns={["title"]}
      searchPlaceholder="Search assessments"
      filterableColumns={[
        {
          id: "status",
          title: "Status",
          options: [
            { label: "Draft", value: "draft" },
            { label: "Active", value: "active" },
            { label: "Archived", value: "archived" },
          ],
        },
      ]}
      defaultSort={{ id: "title", desc: false }}
      rowHref={(row) => `/assessments/${row.id}/edit`}
      pageSize={20}
    />
  );
}
