"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { ReportSnapshotListItem } from "@/app/actions/reports";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ReportAudienceType, ReportSnapshotStatus } from "@/types/database";

type ReportTableRow = ReportSnapshotListItem & {
  participantLabel: string;
  audienceLabel: string;
  generatedAtValue: string;
};

const STATUS_META: Record<
  ReportSnapshotStatus,
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "text-muted-foreground" },
  generating: {
    label: "Generating",
    className: "text-yellow-600 bg-yellow-500/10 border-yellow-500/20",
  },
  ready: { label: "Ready", className: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
  released: {
    label: "Released",
    className: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
  },
  failed: {
    label: "Failed",
    className: "text-destructive bg-destructive/10 border-destructive/20",
  },
};

const AUDIENCE_LABELS: Record<ReportAudienceType, string> = {
  participant: "Participant",
  hr_manager: "HR Manager",
  consultant: "Consultant",
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
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const columns: ColumnDef<ReportTableRow>[] = [
  {
    accessorKey: "participantLabel",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Report" />
    ),
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{row.original.participantLabel}</p>
        <p className="truncate text-sm text-muted-foreground">
          {row.original.participantEmail || `${row.original.id.slice(0, 8)}…`}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "audienceLabel",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Audience" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.audienceLabel}</Badge>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = STATUS_META[row.original.status];
      return (
        <Badge variant="outline" className={status.className}>
          {status.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "narrativeMode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Mode" />
    ),
    cell: ({ row }) => (
      <span className="text-sm capitalize text-muted-foreground">
        {row.original.narrativeMode.replace(/_/g, " ")}
      </span>
    ),
  },
  {
    id: "generated",
    accessorFn: (row) => row.generatedAtValue,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Generated" />
    ),
    cell: ({ row }) => (
      <Tooltip>
        <TooltipTrigger
          render={<span className="inline-flex cursor-default text-sm text-muted-foreground" />}
        >
          {formatRelativeDate(row.original.generatedAtValue)}
        </TooltipTrigger>
        <TooltipContent>{formatDateTime(row.original.generatedAtValue)}</TooltipContent>
      </Tooltip>
    ),
  },
];

export function ReportsTable({
  snapshots,
}: {
  snapshots: ReportSnapshotListItem[];
}) {
  const rows = snapshots.map((snapshot) => ({
    ...snapshot,
    participantLabel: snapshot.participantName || `${snapshot.id.slice(0, 8)}…`,
    audienceLabel: AUDIENCE_LABELS[snapshot.audienceType] ?? snapshot.audienceType,
    generatedAtValue: snapshot.generatedAt ?? snapshot.created_at,
  }));

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchableColumns={["participantLabel", "participantEmail", "audienceLabel"]}
      searchPlaceholder="Search reports"
      filterableColumns={[
        {
          id: "status",
          title: "Status",
          options: Object.entries(STATUS_META).map(([value, meta]) => ({
            value,
            label: meta.label,
          })),
        },
      ]}
      defaultSort={{ id: "generated", desc: true }}
      rowHref={(row) => `/reports/${row.id}`}
      pageSize={20}
    />
  );
}
