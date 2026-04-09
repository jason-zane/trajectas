"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, ExternalLink, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { deletePartner, restorePartner } from "@/app/actions/partners";
import type { PartnerWithCounts } from "@/app/actions/partners";
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
  DataTableRowLink,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

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
    cell: ({ row }) => (
      <DataTableRowLink
        href={`/partners/${row.original.slug}/overview`}
        ariaLabel={`Open ${row.original.name}`}
        className="font-semibold text-foreground hover:text-primary"
      >
        {row.original.name}
      </DataTableRowLink>
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
  {
    id: "actions",
    enableSorting: false,
    cell: ({ row }) => <PartnerDirectoryRowActions partner={row.original} />,
  },
];

function PartnerDirectoryRowActions({ partner }: { partner: DirectoryPartnerRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isArchived = Boolean(partner.deletedAt);

  function handleConfirm() {
    startTransition(async () => {
      const result = isArchived
        ? await restorePartner(partner.id)
        : await deletePartner(partner.id);

      if (result && "error" in result && result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : isArchived
              ? "Failed to restore partner"
              : "Failed to archive partner"
        );
        return;
      }

      toast.success(isArchived ? "Partner restored" : "Partner archived");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DataTableActionsMenu label={`Open actions for ${partner.name}`}>
        <DropdownMenuItem onClick={() => router.push(`/partners/${partner.slug}/overview`)}>
          <ExternalLink className="size-4" />
          Open partner
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setOpen(true)}
          disabled={isPending}
          variant={isArchived ? "default" : "destructive"}
        >
          {isArchived ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}
          {isArchived ? "Restore partner" : "Archive partner"}
        </DropdownMenuItem>
      </DataTableActionsMenu>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={isArchived ? "Restore partner?" : "Archive partner?"}
        description={
          isArchived
            ? `Restore "${partner.name}" to the active directory.`
            : `Archive "${partner.name}". You can restore it later from the directory.`
        }
        confirmLabel={isArchived ? "Restore" : "Archive"}
        variant={isArchived ? "default" : "destructive"}
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  );
}

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
      rowHref={(row) => `/partners/${row.slug}/overview`}
      pageSize={20}
    />
  );
}
