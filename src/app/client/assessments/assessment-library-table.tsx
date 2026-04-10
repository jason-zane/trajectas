"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNowStrict } from "date-fns";

import type { ClientAssessmentLibrarySummary } from "@/app/actions/client-entitlements";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { usePortal } from "@/components/portal-context";

function formatModeLabel(formatMode: ClientAssessmentLibrarySummary["formatMode"]) {
  return formatMode === "forced_choice" ? "Forced choice" : "Traditional";
}

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
    accessorKey: "formatMode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Format" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{formatModeLabel(row.original.formatMode)}</Badge>
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
  {
    accessorKey: "sectionCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sections" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.sectionCount}
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
    accessorKey: "updatedAt",
    accessorFn: (row) => row.updatedAt ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.updatedAt
          ? formatDistanceToNowStrict(new Date(row.original.updatedAt), {
              addSuffix: true,
            })
          : "—"}
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
      filterableColumns={[
        {
          id: "formatMode",
          title: "Format",
          options: [
            { label: "Traditional", value: "traditional" },
            { label: "Forced choice", value: "forced_choice" },
          ],
        },
      ]}
      defaultSort={{ id: "updatedAt", desc: true }}
      rowHref={(row) => href(`/assessments/${row.id}`)}
      pageSize={20}
    />
  );
}
