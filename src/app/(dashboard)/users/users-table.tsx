"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { resendInvite, bulkDeleteUsers, bulkUpdateUserStatus, type UserListItem } from "@/app/actions/user-management";
import { revokeInviteById, toggleUserActiveState } from "@/app/actions/staff-users";
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
  DataTableRowLink,
  type BulkAction,
} from "@/components/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TabKey = "all" | "platform" | "partner" | "client";
type StatusKey = "active" | "inactive" | "pending";

type UserTableRow = UserListItem & {
  displayName: string;
  status: StatusKey;
  roleLabel: string;
  tenantNames: string[];
};

const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Platform Admin",
  partner_admin: "Partner Admin",
  partner_member: "Partner Member",
  org_admin: "Client Admin",
  client_admin: "Client Admin",
  client_member: "Client Member",
  consultant: "Member",
};

const TAB_LABELS: Record<TabKey, string> = {
  all: "All",
  platform: "Platform Admins",
  partner: "Partner Users",
  client: "Client Users",
};

const STATUS_LABELS: Record<StatusKey, string> = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending",
};

const STATUS_DOT_CLASSES: Record<StatusKey, string> = {
  active: "bg-emerald-500",
  inactive: "bg-muted-foreground/50",
  pending: "bg-amber-500",
};

const bulkActions: BulkAction<UserTableRow>[] = [
  {
    label: "Delete",
    variant: "destructive",
    icon: <Trash2 className="mr-1.5 h-3.5 w-3.5" />,
    action: async (ids) => {
      await bulkDeleteUsers(ids);
    },
  },
  {
    label: "Deactivate",
    action: async (ids) => {
      await bulkUpdateUserStatus(ids, "inactive");
    },
  },
];

function getInitials(value: string | null, fallbackEmail: string) {
  const source = value?.trim() || fallbackEmail;
  const tokens = source.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return "?";
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`.toUpperCase();
}

function getItemStatus(item: UserListItem): StatusKey {
  if (item.type === "invite") {
    return "pending";
  }

  return item.isActive ? "active" : "inactive";
}

function getRoleLabel(role: string) {
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

function getItemTenantNames(item: UserListItem) {
  if (item.type === "invite") {
    if (item.tenantType === "platform") {
      return ["Platform"];
    }

    return item.tenantName ? [item.tenantName] : [];
  }

  const names = [
    ...item.partnerMemberships.map((membership) => membership.partnerName).filter(Boolean),
    ...item.clientMemberships.map((membership) => membership.clientName).filter(Boolean),
  ] as string[];

  if (names.length === 0 && item.role === "platform_admin") {
    return ["Platform"];
  }

  return Array.from(new Set(names));
}

function matchesTab(item: UserListItem, tab: TabKey) {
  if (tab === "all") {
    return true;
  }

  if (item.type === "invite") {
    if (tab === "platform") {
      return item.role === "platform_admin";
    }

    if (tab === "partner") {
      return item.role === "partner_admin" || item.role === "partner_member";
    }

    if (tab === "client") {
      return item.role === "client_admin" || item.role === "client_member";
    }

    return false;
  }

  if (tab === "platform") {
    return item.role === "platform_admin";
  }

  if (tab === "partner") {
    return (
      item.role === "partner_admin" ||
      (item.role === "consultant" && item.partnerMemberships.length > 0)
    );
  }

  return (
    item.role === "org_admin" ||
    (item.role === "consultant" && item.clientMemberships.length > 0)
  );
}

function formatRelativeDate(dateString: string) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAbsoluteDate(dateString: string) {
  return new Date(dateString).toLocaleString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const columns: ColumnDef<UserTableRow>[] = [
  {
    accessorKey: "displayName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="User" />
    ),
    cell: ({ row }) => (
      <DataTableRowLink
        href={
          row.original.type === "profile"
            ? `/users/${row.original.id}`
            : `/users/invite/${row.original.id}`
        }
        ariaLabel={`Open ${row.original.displayName}`}
        className="min-w-0"
      >
        <div className="flex items-center gap-3">
          <Avatar size="lg" className="size-10">
            <AvatarFallback>
              {row.original.type === "invite"
                ? "?"
                : getInitials(
                    row.original.type === "profile" ? row.original.displayName : null,
                    row.original.email
                  )}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground hover:text-primary">
              {row.original.displayName}
            </p>
            <p className="truncate text-sm text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      </DataTableRowLink>
    ),
  },
  {
    accessorKey: "roleLabel",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
        {row.original.roleLabel}
      </Badge>
    ),
  },
  {
    accessorKey: "tenantNames",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tenants" />
    ),
    cell: ({ row }) => {
      const visibleTenants = row.original.tenantNames.slice(0, 3);
      const hiddenCount = Math.max(row.original.tenantNames.length - visibleTenants.length, 0);

      if (row.original.tenantNames.length === 0) {
        return <span className="text-sm text-muted-foreground">—</span>;
      }

      return (
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleTenants.map((tenantName) => (
            <Badge key={tenantName} variant="outline">
              {tenantName}
            </Badge>
          ))}
          {hiddenCount > 0 ? (
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex cursor-default" />}>
                <Badge variant="outline">+{hiddenCount}</Badge>
              </TooltipTrigger>
              <TooltipContent>{row.original.tenantNames.join(", ")}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-2 text-sm">
        <span className={cn("size-2 rounded-full", STATUS_DOT_CLASSES[row.original.status])} />
        {STATUS_LABELS[row.original.status]}
      </span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => (
      <Tooltip>
        <TooltipTrigger
          render={<span className="inline-flex cursor-default text-sm text-muted-foreground" />}
        >
          {formatRelativeDate(row.original.createdAt)}
        </TooltipTrigger>
        <TooltipContent>{formatAbsoluteDate(row.original.createdAt)}</TooltipContent>
      </Tooltip>
    ),
  },
  {
    id: "actions",
    enableSorting: false,
    cell: ({ row }) => <UserRowActions user={row.original} />,
  },
];

function UserRowActions({ user }: { user: UserTableRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const detailHref = user.type === "profile" ? `/users/${user.id}` : `/users/invite/${user.id}`;
  const actionLabel =
    user.type === "invite"
      ? "Revoke invite"
      : user.isActive
        ? "Deactivate user"
        : "Reactivate user";
  const confirmTitle =
    user.type === "invite"
      ? "Revoke invite?"
      : user.isActive
        ? "Deactivate user?"
        : "Reactivate user?";
  const confirmDescription =
    user.type === "invite"
      ? `This will cancel the pending invite for ${user.email}. They will no longer be able to accept it.`
      : user.isActive
        ? `Deactivate "${user.displayName}". They will lose access until reactivated.`
        : `Reactivate "${user.displayName}" and restore their access.`;
  const confirmVariant =
    user.type === "profile" && !user.isActive ? "default" : "destructive";

  function handleResend() {
    if (user.type !== "invite") {
      return;
    }

    startTransition(async () => {
      const result = await resendInvite(user.id);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`Invite email resent to ${user.email}`);
      router.refresh();
    });
  }

  function handleConfirm() {
    startTransition(async () => {
      if (user.type === "invite") {
        const result = await revokeInviteById(user.id);

        if ("error" in result) {
          toast.error(result.error);
          return;
        }

        toast.success("Invite revoked");
      } else {
        const result = await toggleUserActiveState(user.id, !user.isActive);

        if ("error" in result) {
          toast.error(result.error);
          return;
        }

        toast.success(user.isActive ? "User deactivated" : "User reactivated");
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DataTableActionsMenu label={`Open actions for ${user.displayName}`}>
        <DropdownMenuItem onClick={() => router.push(detailHref)}>
          <ExternalLink className="size-4" />
          {user.type === "profile" ? "Open user" : "Open invite"}
        </DropdownMenuItem>
        {user.type === "invite" ? (
          <DropdownMenuItem onClick={handleResend} disabled={isPending}>
            <RefreshCw className="size-4" />
            Resend invite
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setOpen(true)}
          disabled={isPending}
          variant={confirmVariant}
        >
          {user.type === "profile" && !user.isActive ? (
            <RotateCcw className="size-4" />
          ) : (
            <X className="size-4" />
          )}
          {actionLabel}
        </DropdownMenuItem>
      </DataTableActionsMenu>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={actionLabel}
        variant={confirmVariant}
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  );
}

export function UsersTable({ users }: { users: UserListItem[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const rows = useMemo<UserTableRow[]>(
    () =>
      users.map((item) => ({
        ...item,
        displayName:
          item.type === "profile" ? item.displayName ?? item.email : item.email,
        status: getItemStatus(item),
        roleLabel: getRoleLabel(item.role),
        tenantNames: getItemTenantNames(item),
      })),
    [users]
  );

  const tabCounts = useMemo(
    () => ({
      all: users.length,
      platform: users.filter((item) => matchesTab(item, "platform")).length,
      partner: users.filter((item) => matchesTab(item, "partner")).length,
      client: users.filter((item) => matchesTab(item, "client")).length,
    }),
    [users]
  );

  const filteredRows = rows.filter((row) => matchesTab(row, activeTab));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => {
          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <span>{TAB_LABELS[tab]}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
                  isActive
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {tabCounts[tab]}
              </span>
            </button>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        searchableColumns={["displayName", "email"]}
        searchPlaceholder="Search by name or email"
        filterableColumns={[
          {
            id: "status",
            title: "Status",
            options: Object.entries(STATUS_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          },
        ]}
        defaultSort={{ id: "createdAt", desc: true }}
        rowHref={(row) =>
          row.type === "profile" ? `/users/${row.id}` : `/users/invite/${row.id}`
        }
        pageSize={20}
        enableRowSelection
        getRowId={(row) => row.id}
        bulkActions={bulkActions}
      />
    </div>
  );
}
