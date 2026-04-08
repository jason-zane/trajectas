"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { CampaignWithMeta } from "@/app/actions/campaigns";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const STATUS_VARIANT: Record<
  string,
  "secondary" | "default" | "outline" | "destructive"
> = {
  draft: "secondary",
  active: "default",
  paused: "outline",
  closed: "destructive",
  archived: "outline",
};

function formatDateRange(opensAt?: string, closesAt?: string) {
  if (!opensAt && !closesAt) {
    return "—";
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("en-AU", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  if (opensAt && closesAt) {
    return `${formatDate(opensAt)} – ${formatDate(closesAt)}`;
  }

  if (opensAt) {
    return `Opens ${formatDate(opensAt)}`;
  }

  return `Closes ${formatDate(closesAt!)}`;
}

function getCompletionPercent(campaign: CampaignWithMeta) {
  if (campaign.participantCount === 0) {
    return 0;
  }

  return Math.round((campaign.completedCount / campaign.participantCount) * 100);
}

const columns: ColumnDef<CampaignWithMeta>[] = [
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
    accessorKey: "clientName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Client" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.clientName || "—"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status] ?? "secondary"}>
        {row.original.status.replace(/_/g, " ")}
      </Badge>
    ),
  },
  {
    accessorKey: "assessmentCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assessments" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.assessmentCount}
      </span>
    ),
  },
  {
    accessorKey: "participantCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Participants" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.participantCount}
      </span>
    ),
  },
  {
    id: "completion",
    accessorFn: (row) => getCompletionPercent(row),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Completion" />
    ),
    cell: ({ row }) => {
      const completion = getCompletionPercent(row.original);

      return (
        <div className="min-w-36 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {row.original.completedCount}/{row.original.participantCount || 0}
            </span>
            <span>{completion}%</span>
          </div>
          <Progress value={completion} className="gap-0" />
        </div>
      );
    },
  },
  {
    id: "dateRange",
    accessorFn: (row) => row.opensAt ?? row.created_at,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date Range" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDateRange(row.original.opensAt, row.original.closesAt)}
      </span>
    ),
  },
];

const statusFilter = [
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Closed", value: "closed" },
  { label: "Archived", value: "archived" },
];

export function CampaignsTable({ campaigns }: { campaigns: CampaignWithMeta[] }) {
  return (
    <DataTable
      columns={columns}
      data={campaigns}
      searchableColumns={["title", "clientName"]}
      searchPlaceholder="Search campaigns"
      filterableColumns={[
        {
          id: "status",
          title: "Status",
          options: statusFilter,
        },
      ]}
      defaultSort={{ id: "dateRange", desc: true }}
      rowHref={(row) => `/campaigns/${row.id}/overview`}
      pageSize={20}
    />
  );
}
