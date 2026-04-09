"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ExternalLink, UserX } from "lucide-react";

import {
  changeClientMemberRole,
  removeClientMember,
  type ClientMember,
} from "@/app/actions/clients";
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
  DataTableRowLink,
} from "@/components/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSelectLabel } from "@/lib/select-display";

type ClientMemberRow = ClientMember & {
  displayName: string;
};

const membershipRoleOptions = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
] as const;

function formatMemberName(member: ClientMember) {
  const parts = [member.firstName, member.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ClientUsersTable({
  clientId,
  members,
}: {
  clientId: string;
  members: ClientMember[];
}) {
  const router = useRouter();
  const [removeTarget, setRemoveTarget] = useState<ClientMember | null>(null);
  const [isRemoving, startRemove] = useTransition();
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  function handleRoleChange(member: ClientMember, newRole: string) {
    const role = newRole as "admin" | "member";
    if (role === member.role) return;

    setChangingRoleId(member.membershipId);

    startRemove(async () => {
      const result = await changeClientMemberRole(clientId, member.membershipId, role);

      setChangingRoleId(null);

      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`Role updated to ${role}`);
      router.refresh();
    });
  }

  function handleRemove() {
    if (!removeTarget) return;

    startRemove(async () => {
      const result = await removeClientMember(clientId, removeTarget.membershipId);

      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Member removed");
      setRemoveTarget(null);
      router.refresh();
    });
  }

  const rows = members.map((member) => ({
    ...member,
    displayName: formatMemberName(member) ?? member.email,
  }));

  const columns: ColumnDef<ClientMemberRow>[] = [
    {
      accessorKey: "displayName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <DataTableRowLink
          href={`/users/${row.original.userId}`}
          ariaLabel={`Open ${row.original.displayName}`}
          className="font-medium text-foreground hover:text-primary"
        >
          {row.original.displayName}
        </DataTableRowLink>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: "role",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Role" />
      ),
      cell: ({ row }) => (
        <div data-stop-row-click onClick={(event) => event.stopPropagation()}>
          <Select
            value={row.original.role}
            onValueChange={(value) => {
              if (value) {
                handleRoleChange(row.original, value);
              }
            }}
            disabled={changingRoleId === row.original.membershipId}
          >
            <SelectTrigger size="sm" className="w-[110px]">
              <SelectValue>
                {(value: string | null) =>
                  getSelectLabel(value as "admin" | "member" | null, membershipRoleOptions)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      accessorKey: "addedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Added" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.addedAt)}</span>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <DataTableActionsMenu label={`Open actions for ${row.original.displayName}`}>
          <DropdownMenuItem onClick={() => router.push(`/users/${row.original.userId}`)}>
            <ExternalLink className="size-4" />
            Open user
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setRemoveTarget(row.original)}
            disabled={isRemoving}
            variant="destructive"
          >
            <UserX className="size-4" />
            Remove member
          </DropdownMenuItem>
        </DataTableActionsMenu>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchableColumns={["displayName", "email"]}
        searchPlaceholder="Search team members"
        defaultSort={{ id: "displayName", desc: false }}
        rowHref={(row) => `/users/${row.userId}`}
        pageSize={20}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Remove Team Member"
        description={`This will revoke ${(removeTarget ? formatMemberName(removeTarget) : null) ?? removeTarget?.email ?? "this user"}'s access to this client workspace. They can be re-invited later.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleRemove}
        loading={isRemoving}
      />
    </>
  );
}
