"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { ClientWithCounts } from "@/app/actions/clients";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

type DirectoryClientRow = ClientWithCounts & {
  status: "active" | "inactive" | "archived";
};

function getStatus(client: ClientWithCounts): DirectoryClientRow["status"] {
  if (client.deletedAt) {
    return "archived";
  }

  return client.isActive ? "active" : "inactive";
}

const columns: ColumnDef<DirectoryClientRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
  },
  {
    accessorKey: "partnerName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Partner" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.partnerName || "Platform-owned"}
      </span>
    ),
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
    accessorKey: "industry",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Industry" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.industry || "—"}
      </span>
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
    accessorKey: "sessionCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sessions" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.sessionCount}
      </span>
    ),
  },
];

export function ClientDirectoryTable({ clients }: { clients: ClientWithCounts[] }) {
  const rows = clients.map((client) => ({
    ...client,
    status: getStatus(client),
  }));

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchableColumns={["name", "partnerName"]}
      searchPlaceholder="Search clients"
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
      rowHref={(row) => `/clients/${row.slug}/overview`}
      pageSize={20}
    />
  );
}
