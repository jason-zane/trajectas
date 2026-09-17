"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Mail, PlayCircle, Send, Wand2, XCircle } from "lucide-react";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import type { PublicBuildDTO } from "@/lib/dal/public-builds";

const STATUS_CONFIG: Record<
  PublicBuildDTO["status"],
  { label: string; icon: typeof Wand2; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  ranked: { label: "Ranked", icon: Wand2, variant: "secondary" },
  created: { label: "Created", icon: Mail, variant: "default" },
  started: { label: "Started", icon: PlayCircle, variant: "default" },
  completed: { label: "Completed", icon: CheckCircle2, variant: "outline" },
  report_sent: { label: "Report sent", icon: Send, variant: "outline" },
  failed: { label: "Failed", icon: XCircle, variant: "destructive" },
};

const TIER_LABEL: Record<string, string> = {
  essentials: "Essentials",
  core: "Core",
  full: "Full picture",
};

function formatRelativeDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" });
}

function sumTokens(usage: PublicBuildDTO["usage"]): number {
  if (!usage) return 0;
  return Object.values(usage).reduce(
    (sum, stage) => sum + (stage?.inputTokens ?? 0) + (stage?.outputTokens ?? 0),
    0,
  );
}

const columns: ColumnDef<PublicBuildDTO>[] = [
  {
    accessorKey: "email",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email / Role" />,
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{row.original.email}</p>
        <p className="truncate text-sm text-muted-foreground">{row.original.roleTitle || "—"}</p>
      </div>
    ),
  },
  {
    accessorKey: "tier",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tier" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.tier ? TIER_LABEL[row.original.tier] ?? row.original.tier : "—"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status = STATUS_CONFIG[row.original.status] ?? STATUS_CONFIG.ranked;
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
    id: "tokens",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tokens" />,
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {sumTokens(row.original.usage).toLocaleString("en-AU")}
      </span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Started" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{formatRelativeDate(row.original.createdAt)}</span>
    ),
  },
  {
    accessorKey: "completedAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Completed" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{formatRelativeDate(row.original.completedAt)}</span>
    ),
  },
];

export function PublicBuildsTable({ runs }: { runs: PublicBuildDTO[] }) {
  return (
    <DataTable
      columns={columns}
      data={runs}
      searchableColumns={["email", "roleTitle"]}
      searchPlaceholder="Search by email or role"
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
      defaultSort={{ id: "createdAt", desc: true }}
      pageSize={25}
      getRowId={(row) => row.id}
      rowHref={(row) => `/public-builds/${row.id}`}
      emptyState={
        <EmptyState
          title="No builds yet"
          description="Runs will appear here once someone completes the Role Builder's verify step."
          className="border-0 py-16"
        />
      }
    />
  );
}
