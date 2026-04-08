"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { PartnerWithCounts } from "@/app/actions/partners";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

type DirectoryPartnerRow = PartnerWithCounts & {
  status: "active" | "inactive" | "archived";
};

function getStatus(partner: PartnerWithCounts): DirectoryPartnerRow["status"] {
  if (partner.deletedAt) {
    return "archived";
  }

  return partner.isActive ? "active" : "inactive";
}

const columns: ColumnDef<DirectoryPartnerRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant="dot">
        <span
          className={
            row.original.status === "active"
              ? "size-1.5 rounded-full bg-emerald-500"
              : row.original.status === "archived"
                ? "size-1.5 rounded-full bg-destructive"
                : "size-1.5 rounded-full bg-muted-foreground/40"
          }
        />
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "clientCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Clients" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.clientCount}
      </span>
    ),
  },
];

export function PartnerDirectoryTable({
  partners,
}: {
  partners: PartnerWithCounts[];
}) {
  const rows = partners.map((partner) => ({
    ...partner,
    status: getStatus(partner),
  }));

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchableColumns={["name"]}
      searchPlaceholder="Search partners"
      filterableColumns={[
        {
          id: "status",
          title: "Status",
          options: [
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
            { label: "Archived", value: "archived" },
          ],
        },
      ]}
      defaultSort={{ id: "name", desc: false }}
      rowHref={(row) => `/partners/${row.slug}/edit`}
      pageSize={20}
    />
  );
}
