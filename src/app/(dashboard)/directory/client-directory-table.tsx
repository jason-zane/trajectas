"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteClient, restoreClient, bulkDeleteClients, bulkUpdateClientStatus } from "@/app/actions/clients";
import type { ClientWithCounts } from "@/app/actions/clients";
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
  DataTableRowLink,
  type BulkAction,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

type DirectoryClientRow = ClientWithCounts & {
  status: "active" | "inactive" | "archived";
};

function getStatus(client: ClientWithCounts): DirectoryClientRow["status"] {
  if (client.deletedAt) {
    return "archived";
  }

  return client.isActive ? "active" : "inactive";
}

const bulkActions: BulkAction<DirectoryClientRow>[] = [
  {
    label: "Delete",
    variant: "destructive",
    icon: <Trash2 className="mr-1.5 h-3.5 w-3.5" />,
    action: async (ids) => {
      await bulkDeleteClients(ids);
    },
  },
  {
    label: "Deactivate",
    action: async (ids) => {
      await bulkUpdateClientStatus(ids, "inactive");
    },
  },
];

const columns: ColumnDef<DirectoryClientRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <DataTableRowLink
        href={`/clients/${row.original.slug}/overview`}
        ariaLabel={`Open ${row.original.name}`}
        className="font-semibold text-foreground hover:text-primary"
      >
        {row.original.name}
      </DataTableRowLink>
    ),
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
  {
    accessorKey: "updated_at",
    enableSorting: true,
  },
  {
    id: "actions",
    enableSorting: false,
    cell: ({ row }) => <ClientDirectoryRowActions client={row.original} />,
  },
];

function ClientDirectoryRowActions({ client }: { client: DirectoryClientRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isArchived = Boolean(client.deletedAt);

  function handleConfirm() {
    startTransition(async () => {
      const result = isArchived
        ? await restoreClient(client.id)
        : await deleteClient(client.id);

      if (result && "error" in result && result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : isArchived
              ? "Failed to restore client"
              : "Failed to archive client"
        );
        return;
      }

      toast.success(isArchived ? "Client restored" : "Client archived");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DataTableActionsMenu label={`Open actions for ${client.name}`}>
        <DropdownMenuItem onClick={() => router.push(`/clients/${client.slug}/overview`)}>
          <ExternalLink className="size-4" />
          Open client
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setOpen(true)}
          disabled={isPending}
          variant={isArchived ? "default" : "destructive"}
        >
          {isArchived ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}
          {isArchived ? "Restore client" : "Archive client"}
        </DropdownMenuItem>
      </DataTableActionsMenu>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={isArchived ? "Restore client?" : "Archive client?"}
        description={
          isArchived
            ? `Restore "${client.name}" to the active directory.`
            : `Archive "${client.name}". You can restore it later from the directory.`
        }
        confirmLabel={isArchived ? "Restore" : "Archive"}
        variant={isArchived ? "default" : "destructive"}
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  );
}

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
      defaultSort={{ id: "updated_at", desc: true }}
      hiddenColumns={["updated_at"]}
      rowHref={(row) => `/clients/${row.slug}/overview`}
      pageSize={20}
      enableRowSelection
      getRowId={(row) => row.id}
      bulkActions={bulkActions}
    />
  );
}
