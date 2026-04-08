"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { UserX } from "lucide-react";

import {
  changePartnerMemberRole,
  removePartnerMember,
  type PartnerMember,
} from "@/app/actions/partners";
import {
  DataTable,
  DataTableColumnHeader,
  DataTableRowActions,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PartnerMemberRow = PartnerMember & {
  displayName: string;
};

function formatMemberName(member: PartnerMember) {
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

export function PartnerUsersTable({
  partnerId,
  members,
}: {
  partnerId: string;
  members: PartnerMember[];
}) {
  const router = useRouter();
  const [removeTarget, setRemoveTarget] = useState<PartnerMember | null>(null);
  const [isRemoving, startRemove] = useTransition();
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  function handleRoleChange(member: PartnerMember, newRole: string) {
    const role = newRole as "admin" | "member";
    if (role === member.role) return;

    setChangingRoleId(member.membershipId);

    startRemove(async () => {
      const result = await changePartnerMemberRole(partnerId, member.membershipId, role);

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
      const result = await removePartnerMember(partnerId, removeTarget.membershipId);

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

  const columns: ColumnDef<PartnerMemberRow>[] = [
    {
      accessorKey: "displayName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.displayName}</span>
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
              <SelectValue />
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
        <DataTableRowActions>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setRemoveTarget(row.original)}
            aria-label="Remove member"
            className="text-destructive hover:text-destructive"
          >
            <UserX className="size-4" />
          </Button>
        </DataTableRowActions>
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
        description={`This will revoke ${formatMemberName(removeTarget!) ?? removeTarget?.email ?? "this user"}'s access to this partner workspace. They can be re-invited later.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleRemove}
        loading={isRemoving}
      />
    </>
  );
}
