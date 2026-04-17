"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Plus, Search, Unlink } from "lucide-react";
import { toast } from "sonner";

import {
  assignClientToPartner,
  unassignClientFromPartner,
  type PartnerClientRow,
} from "@/app/actions/partners";
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
  DataTableRowLink,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ActionDialog,
  ActionDialogBody,
} from "@/components/action-dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type ClientRow = PartnerClientRow & {
  status: "active" | "inactive";
};

type UnassignedClient = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
};

function getStatus(client: PartnerClientRow): ClientRow["status"] {
  return client.isActive ? "active" : "inactive";
}

function makeColumns(isPlatformAdmin: boolean): ColumnDef<ClientRow>[] {
  const cols: ColumnDef<ClientRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Client" />
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
      accessorKey: "industry",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Industry" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.industry || "\u2014"}
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
          {row.original.sizeRange || "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "campaignCount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Campaigns" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.campaignCount}
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

  cols.push({
    accessorKey: "updated_at",
    enableSorting: true,
  });

  if (isPlatformAdmin) {
    cols.push({
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => <ClientRowActions client={row.original} />,
    });
  }

  return cols;
}

function ClientRowActions({ client }: { client: ClientRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleUnassign() {
    startTransition(async () => {
      const result = await unassignClientFromPartner(client.id);

      if (result && "error" in result && result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Failed to unassign client"
        );
        return;
      }

      toast.success(`"${client.name}" unassigned from partner`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DataTableActionsMenu label={`Open actions for ${client.name}`}>
        <DropdownMenuItem
          onClick={() => router.push(`/clients/${client.slug}/overview`)}
        >
          <ExternalLink className="size-4" />
          Open client
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setOpen(true)}
          disabled={isPending}
          variant="destructive"
        >
          <Unlink className="size-4" />
          Unassign from partner
        </DropdownMenuItem>
      </DataTableActionsMenu>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Unassign client?"
        description={`Remove "${client.name}" from this partner. The client will become platform-owned.`}
        confirmLabel="Unassign"
        variant="destructive"
        onConfirm={handleUnassign}
        loading={isPending}
      />
    </>
  );
}

function AssignClientDialog({
  partnerId,
  unassignedClients,
}: {
  partnerId: string;
  unassignedClients: UnassignedClient[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!search.trim()) return unassignedClients;
    const lower = search.trim().toLowerCase();
    return unassignedClients.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        (c.industry && c.industry.toLowerCase().includes(lower))
    );
  }, [unassignedClients, search]);

  function handleAssign(clientId: string, clientName: string) {
    startTransition(async () => {
      const result = await assignClientToPartner(clientId, partnerId);

      if (result && "error" in result && result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Failed to assign client"
        );
        return;
      }

      toast.success(`"${clientName}" assigned to partner`);
      setOpen(false);
      setSearch("");
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Assign client
      </Button>
      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        eyebrow="Partner"
        title="Assign client"
        description="Select an unassigned platform client to add to this partner."
      >
        <ActionDialogBody className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {unassignedClients.length === 0
                  ? "All platform clients are already assigned."
                  : "No clients match your search."}
              </p>
            ) : (
              filtered.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleAssign(client.id, client.name)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-primary/5 disabled:opacity-50"
                >
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {client.name}
                    </span>
                    {client.industry ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {client.industry}
                      </span>
                    ) : null}
                  </div>
                  <Plus className="size-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </ActionDialogBody>
      </ActionDialog>
    </>
  );
}

export function PartnerClientsTable({
  clients,
  partnerId,
  isPlatformAdmin,
  unassignedClients,
}: {
  clients: PartnerClientRow[];
  partnerId: string;
  isPlatformAdmin: boolean;
  unassignedClients: UnassignedClient[];
}) {
  const columns = useMemo(() => makeColumns(isPlatformAdmin), [isPlatformAdmin]);

  const rows: ClientRow[] = clients.map((client) => ({
    ...client,
    status: getStatus(client),
  }));

  return (
    <div className="space-y-4">
      {isPlatformAdmin && (
        <div className="flex justify-end">
          <AssignClientDialog
            partnerId={partnerId}
            unassignedClients={unassignedClients}
          />
        </div>
      )}
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
        defaultSort={{ id: "updated_at", desc: true }}
        hiddenColumns={["updated_at"]}
        rowHref={(row) => `/clients/${row.slug}/overview`}
        pageSize={20}
      />
    </div>
  );
}
