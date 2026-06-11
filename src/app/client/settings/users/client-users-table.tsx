"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { UserX } from "lucide-react";

import {
  changeClientMemberRole,
  removeClientMember,
  type ClientMember,
} from "@/app/actions/clients";
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
} from "@/components/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSelectLabel } from "@/lib/select-display";

type Row = ClientMember & { displayName: string };

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
] as const;

function memberName(m: ClientMember) {
  const parts = [m.firstName, m.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ClientPortalUsersTable({
  workspaceId,
  members,
}: {
  workspaceId: string;
  members: ClientMember[];
}) {
  const router = useRouter();
  const [removeTarget, setRemoveTarget] = useState<ClientMember | null>(null);
  const [isPending, startTransition] = useTransition();
  const [optimisticMembers, updateOptimisticMembers] = useOptimistic(
    members,
    (state: ClientMember[], action: { type: string; memberId?: string; role?: "admin" | "member" | undefined }) => {
      if (action.type === "updateRole" && action.memberId && action.role !== undefined) {
        const role = action.role as "admin" | "member";
        return state.map((m) =>
          m.membershipId === action.memberId ? { ...m, role } : m,
        );
      }
      if (action.type === "remove" && action.memberId) {
        return state.filter((m) => m.membershipId !== action.memberId);
      }
      return state;
    },
  );

  function handleRoleChange(member: ClientMember, newRole: string) {
    const role = newRole as "admin" | "member";
    if (role === member.role) return;

    updateOptimisticMembers({ type: "updateRole", memberId: member.membershipId, role });
    startTransition(async () => {
      const result = await changeClientMemberRole(
        workspaceId,
        member.membershipId,
        role,
      );
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
    updateOptimisticMembers({ type: "remove", memberId: removeTarget.membershipId });
    startTransition(async () => {
      const result = await removeClientMember(
        workspaceId,
        removeTarget.membershipId,
      );
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Member removed");
      setRemoveTarget(null);
      router.refresh();
    });
  }

  const rows: Row[] = optimisticMembers.map((m) => ({
    ...m,
    displayName: memberName(m) ?? m.email,
  }));

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "displayName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.displayName}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.email}
        </span>
      ),
    },
    {
      accessorKey: "role",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Role" />
      ),
      cell: ({ row }) => (
        <div data-stop-row-click onClick={(e) => e.stopPropagation()}>
          <Select
            value={row.original.role}
            onValueChange={(v) => {
              if (v) handleRoleChange(row.original, v);
            }}
            disabled={isPending}
          >
            <SelectTrigger size="sm" className="w-[110px]">
              <SelectValue>
                {(v: string | null) =>
                  getSelectLabel(v as "admin" | "member" | null, roleOptions)
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
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.addedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <DataTableActionsMenu
          label={`Open actions for ${row.original.displayName}`}
        >
          <DropdownMenuItem
            onClick={() => setRemoveTarget(row.original)}
            disabled={isPending}
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
        defaultSort={{ id: "addedAt", desc: true }}
        pageSize={20}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Remove team member"
        description={`This revokes ${
          (removeTarget ? memberName(removeTarget) : null) ??
          removeTarget?.email ??
          "this user"
        }'s access to this workspace. They can be re-invited later.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleRemove}
        loading={isPending}
      />
    </>
  );
}
