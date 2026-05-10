"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { ClientAssessmentLibrarySummary } from "@/app/actions/client-entitlements";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/data-table";
import { usePortal } from "@/components/portal-context";

function formatQuota(value: number | null) {
  return value === null ? "Unlimited" : value.toLocaleString("en-AU");
}

const columns: ColumnDef<ClientAssessmentLibrarySummary>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assessment" />
    ),
    cell: ({ row }) => (
      <div>
        <span className="font-semibold text-foreground">{row.original.title}</span>
        {row.original.description ? (
          <div className="line-clamp-1 text-xs text-muted-foreground">
            {row.original.description}
          </div>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "constructCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Constructs" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.constructCount}
      </span>
    ),
  },
  {
    accessorKey: "totalItemCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Items" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.totalItemCount}
      </span>
    ),
  },
  {
    accessorKey: "quotaRemaining",
    accessorFn: (row) => row.quotaRemaining ?? Number.POSITIVE_INFINITY,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Remaining quota" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatQuota(row.original.quotaRemaining)}
      </span>
    ),
  },
  {
    accessorKey: "quotaUsed",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Used" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.quotaUsed.toLocaleString("en-AU")}
      </span>
    ),
  },
  {
    accessorKey: "campaignCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Campaigns" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.campaignCount}
      </span>
    ),
  },
];

export function AssessmentLibraryTable({
  assessments,
}: {
  assessments: ClientAssessmentLibrarySummary[];
}) {
  const { href } = usePortal();

  return (
    <DataTable
      columns={columns}
      data={assessments}
      searchableColumns={["title"]}
      searchPlaceholder="Search assessments"
      defaultSort={{ id: "title", desc: false }}
      rowHref={(row) => href(`/assessments/${row.id}`)}
      pageSize={20}
    />
  );
}
