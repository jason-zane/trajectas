"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";

import { bulkDeleteGenerationRuns } from "@/app/actions/generation";
import type { GenerationRunWithConstructNames } from "@/app/actions/generation";
import { DataTable, DataTableColumnHeader, DataTableRowActions, type BulkAction } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { DeleteRunButton } from "./delete-run-button";
import type { GenerationRunStatus } from "@/types/database";

type GenerationRunRow = GenerationRunWithConstructNames & {
  runTitle: string;
};

type StatusMeta = {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
};

const STATUS_META: Record<GenerationRunStatus, StatusMeta> = {
  configuring: { label: "In Progress", variant: "default" },
  generating: { label: "In Progress", variant: "default" },
  embedding: { label: "In Progress", variant: "default" },
  analysing: { label: "In Progress", variant: "default" },
  reviewing: { label: "Review Needed", variant: "secondary" },
  completed: { label: "Completed", variant: "outline" },
  failed: { label: "Failed", variant: "destructive" },
};

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRunTitle(names: string[]) {
  if (names.length === 0) return "Untitled generation";
  if (names.length <= 3) return names.join(", ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

const bulkActions: BulkAction<GenerationRunRow>[] = [
  {
    label: "Delete",
    variant: "destructive",
    icon: <Trash2 className="mr-1.5 h-3.5 w-3.5" />,
    action: async (ids) => {
      await bulkDeleteGenerationRuns(ids);
    },
  },
];

const columns: ColumnDef<GenerationRunRow>[] = [
  {
    accessorKey: "runTitle",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Run Name" />
    ),
    cell: ({ row }) => <span className="font-semibold">{row.original.runTitle}</span>,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = STATUS_META[row.original.status] ?? {
        label: row.original.status,
        variant: "secondary" as const,
      };

      return <Badge variant={status.variant}>{status.label}</Badge>;
    },
  },
  {
    accessorKey: "itemsGenerated",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Items" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.itemsGenerated}
      </span>
    ),
  },
  {
    accessorKey: "nmiFinal",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="NMI Score" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.nmiFinal !== undefined && row.original.nmiFinal !== null
          ? row.original.nmiFinal.toFixed(2)
          : "—"}
      </span>
    ),
  },
  {
    accessorKey: "modelUsed",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Model" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.modelUsed || "—"}
      </span>
    ),
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatRelativeTime(row.original.created_at)}
      </span>
    ),
  },
  {
    id: "actions",
    enableSorting: false,
    cell: ({ row }) => (
      <DataTableRowActions>
        <DeleteRunButton runId={row.original.id} />
      </DataTableRowActions>
    ),
  },
];

export function GenerationRunsTable({
  runs,
}: {
  runs: GenerationRunWithConstructNames[];
}) {
  const rows = runs.map((run) => ({
    ...run,
    runTitle: formatRunTitle(run.constructNames),
  }));

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchableColumns={["runTitle", "modelUsed"]}
      searchPlaceholder="Search generation runs"
      defaultSort={{ id: "created_at", desc: true }}
      rowHref={(row) => `/generate/${row.id}`}
      pageSize={20}
      enableRowSelection
      getRowId={(row) => row.id}
      bulkActions={bulkActions}
    />
  );
}
