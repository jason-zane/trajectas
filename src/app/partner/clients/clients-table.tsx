"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { ClientWithCounts } from "@/app/actions/clients";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

type PartnerClientRow = ClientWithCounts & {
  status: "active" | "inactive";
};

function getStatus(client: ClientWithCounts): PartnerClientRow["status"] {
  return client.isActive ? "active" : "inactive";
}

const columns: ColumnDef<PartnerClientRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Client" />
    ),
    cell: ({ row }) => (
      <div>
        <span className="font-semibold text-foreground">{row.original.name}</span>
        <div className="text-xs text-muted-foreground">{row.original.slug}</div>
      </div>
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
    accessorKey: "sizeRange",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Size" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.sizeRange || "—"}
      </span>
    ),
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
    accessorKey: "sessionCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sessions" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground text-right block">
        {row.original.sessionCount}
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
              : "size-1.5 rounded-full bg-muted-foreground/40"
          }
        />
        {row.original.status}
      </Badge>
    ),
  },
];

export function ClientsTable({ clients }: { clients: ClientWithCounts[] }) {
  const rows: PartnerClientRow[] = clients.map((client) => ({
    ...client,
    status: getStatus(client),
  }));

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchableColumns={["name"]}
      searchPlaceholder="Search clients"
      filterableColumns={[
        {
          id: "status",
          title: "Status",
          options: [
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ],
        },
      ]}
      defaultSort={{ id: "name", desc: false }}
      pageSize={20}
    />
  );
}
