"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";

import { bulkDeleteDiagnosticSessions, bulkUpdateDiagnosticSessionStatus } from "@/app/actions/diagnostics";
import type { DiagnosticSessionWithMeta } from "@/app/actions/diagnostics";
import { DataTable, DataTableColumnHeader, type BulkAction } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

const STATUS_META: Record<
  string,
  { label: string; dotClass: string }
> = {
  draft: { label: "Draft", dotClass: "bg-muted-foreground/40" },
  active: { label: "Active", dotClass: "bg-primary" },
  completed: { label: "Completed", dotClass: "bg-emerald-500" },
  archived: { label: "Archived", dotClass: "bg-muted-foreground/40" },
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

const bulkActions: BulkAction<DiagnosticSessionWithMeta>[] = [
  {
    label: "Delete",
    variant: "destructive",
    icon: <Trash2 className="mr-1.5 h-3.5 w-3.5" />,
    action: async (ids) => {
      await bulkDeleteDiagnosticSessions(ids);
    },
  },
  {
    label: "Archive",
    action: async (ids) => {
      await bulkUpdateDiagnosticSessionStatus(ids, "archived");
    },
  },
];

const columns: ColumnDef<DiagnosticSessionWithMeta>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => <span className="font-semibold">{row.original.title}</span>,
  },
  {
    accessorKey: "clientName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Client" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.clientName}</span>
    ),
  },
  {
    accessorKey: "templateName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Template" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.templateName}</span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = STATUS_META[row.original.status] ?? STATUS_META.draft;

      return (
        <Badge variant="dot">
          <span className={`size-1.5 rounded-full ${status.dotClass}`} />
          {status.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "respondentCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Respondents" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.respondentCount}
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

export function DiagnosticSessionsTable({
  sessions,
}: {
  sessions: DiagnosticSessionWithMeta[];
}) {
  return (
    <DataTable
      columns={columns}
      data={sessions}
      searchableColumns={["title", "clientName"]}
      searchPlaceholder="Search diagnostic sessions"
      filterableColumns={[
        {
          id: "status",
          title: "Status",
          options: Object.entries(STATUS_META).map(([value, meta]) => ({
            label: meta.label,
            value,
          })),
        },
      ]}
      defaultSort={{ id: "created_at", desc: true }}
      rowHref={(row) => `/diagnostics/${row.id}`}
      pageSize={20}
      enableRowSelection
      getRowId={(row) => row.id}
      bulkActions={bulkActions}
    />
  );
}
