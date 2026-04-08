"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

import type { MatchingRunWithMeta } from "@/app/actions/matching";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    icon: typeof CheckCircle2;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  pending: { label: "Pending", icon: Clock, variant: "secondary" },
  running: { label: "Running", icon: Loader2, variant: "default" },
  completed: { label: "Completed", icon: CheckCircle2, variant: "outline" },
  failed: { label: "Failed", icon: XCircle, variant: "destructive" },
};

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const columns: ColumnDef<MatchingRunWithMeta>[] = [
  {
    accessorKey: "sessionTitle",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title / Client" />
    ),
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">
          {row.original.sessionTitle || "Matching Run"}
        </p>
        <p className="truncate text-sm text-muted-foreground">{row.original.clientName}</p>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = STATUS_CONFIG[row.original.status] ?? STATUS_CONFIG.pending;
      const Icon = status.icon;

      return (
        <Badge variant={status.variant}>
          <Icon className="size-3.5" />
          {status.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "resultCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Results" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.resultCount}
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
        {formatRelativeDate(row.original.created_at)}
      </span>
    ),
  },
];

export function MatchingRunsTable({ runs }: { runs: MatchingRunWithMeta[] }) {
  return (
    <DataTable
      columns={columns}
      data={runs}
      searchableColumns={["sessionTitle", "clientName"]}
      searchPlaceholder="Search matching runs"
      filterableColumns={[
        {
          id: "status",
          title: "Status",
          options: Object.entries(STATUS_CONFIG).map(([value, meta]) => ({
            label: meta.label,
            value,
          })),
        },
      ]}
      defaultSort={{ id: "created_at", desc: true }}
      pageSize={20}
    />
  );
}
