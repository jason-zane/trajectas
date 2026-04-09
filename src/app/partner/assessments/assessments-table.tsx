"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { WorkspaceAssessmentSummary } from "@/app/actions/assessments";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

const columns: ColumnDef<WorkspaceAssessmentSummary>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assessment" />
    ),
    cell: ({ row }) => (
      <div>
        <span className="font-semibold text-foreground">{row.original.title}</span>
        {row.original.description && (
          <div className="text-xs text-muted-foreground line-clamp-1">
            {row.original.description}
          </div>
        )}
      </div>
    ),
  },
  {
    id: "clientScope",
    accessorFn: (row) => row.clientNames.join(", "),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Client scope" />
    ),
    cell: ({ row }) => {
      const names = row.original.clientNames;
      if (names.length === 0) {
        return <span className="text-sm text-muted-foreground">—</span>;
      }
      if (names.length === 1) {
        return <span className="text-sm text-muted-foreground">{names[0]}</span>;
      }
      return (
        <span className="text-sm text-muted-foreground">{names.length} clients</span>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      const variant =
        status === "active" ? "default" : status === "draft" ? "secondary" : "outline";
      return <Badge variant={variant}>{status}</Badge>;
    },
  },
  {
    accessorKey: "campaignCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Campaigns" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground text-right block">
        {row.original.campaignCount}
      </span>
    ),
  },
  {
    accessorKey: "participantCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Participants" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground text-right block">
        {row.original.participantCount}
      </span>
    ),
  },
  {
    accessorKey: "completedCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Completed" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground text-right block">
        {row.original.completedCount}
      </span>
    ),
  },
];

export function AssessmentsTable({
  assessments,
}: {
  assessments: WorkspaceAssessmentSummary[];
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
            { label: "Active", value: "active" },
            { label: "Draft", value: "draft" },
            { label: "Archived", value: "archived" },
          ],
        },
      ]}
      defaultSort={{ id: "title", desc: false }}
      pageSize={20}
    />
  );
}
