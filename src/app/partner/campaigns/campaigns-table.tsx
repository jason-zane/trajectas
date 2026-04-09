"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { CampaignWithMeta } from "@/app/actions/campaigns";
import {
  DataTable,
  DataTableColumnHeader,
  DataTableRowLink,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

function formatDate(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

const columns: ColumnDef<CampaignWithMeta>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Campaign" />
    ),
    cell: ({ row }) => (
      <div>
        <DataTableRowLink
          href={`/partner/campaigns/${row.original.id}`}
          ariaLabel={`Open ${row.original.title}`}
          className="font-semibold text-foreground hover:text-primary"
        >
          {row.original.title}
        </DataTableRowLink>
        <div className="text-xs text-muted-foreground">
          Opens {formatDate(row.original.opensAt)} · Closes {formatDate(row.original.closesAt)}
        </div>
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
    cell: ({ row }) => {
      const status = row.original.status;
      const variant =
        status === "active"
          ? "default"
          : status === "draft"
            ? "secondary"
            : "outline";
      return <Badge variant={variant}>{status}</Badge>;
    },
  },
  {
    accessorKey: "assessmentCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assessments" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground text-right block">
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

export function CampaignsTable({ campaigns }: { campaigns: CampaignWithMeta[] }) {
  return (
    <DataTable
      columns={columns}
      data={campaigns}
      searchableColumns={["title"]}
      searchPlaceholder="Search campaigns"
      filterableColumns={[
        {
          id: "status",
          title: "Status",
          options: [
            { label: "Active", value: "active" },
            { label: "Draft", value: "draft" },
            { label: "Paused", value: "paused" },
            { label: "Closed", value: "closed" },
            { label: "Archived", value: "archived" },
          ],
        },
      ]}
      defaultSort={{ id: "title", desc: false }}
      rowHref={(row) => `/partner/campaigns/${row.id}`}
      pageSize={20}
    />
  );
}
