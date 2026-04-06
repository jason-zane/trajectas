"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import type { UserListItem } from "@/app/actions/user-management";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TabKey = "all" | "platform" | "partner" | "client";
type StatusKey = "active" | "inactive" | "pending";

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

interface UsersTableProps {
  users: UserListItem[];
}

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

function getSearchLabel(item: UserListItem) {
  return item.type === "profile"
    ? `${item.displayName ?? ""} ${item.email}`.trim().toLowerCase()
    : item.email.toLowerCase();
}

export function UsersTable({ users }: UsersTableProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [statusFilters, setStatusFilters] = useState<Set<StatusKey>>(
    () => new Set(["active", "pending"])
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 300);

    return () => window.clearTimeout(handle);
  }, [search]);

  const tabCounts = useMemo(
    () => ({
      all: users.length,
      platform: users.filter((item) => matchesTab(item, "platform")).length,
      partner: users.filter((item) => matchesTab(item, "partner")).length,
      client: users.filter((item) => matchesTab(item, "client")).length,
    }),
    [users]
  );

  const filteredUsers = useMemo(
    () =>
      users.filter((item) => {
        if (!matchesTab(item, activeTab)) {
          return false;
        }

        if (!statusFilters.has(getItemStatus(item))) {
          return false;
        }

        if (!debouncedSearch) {
          return true;
        }

        return getSearchLabel(item).includes(debouncedSearch);
      }),
    [activeTab, debouncedSearch, statusFilters, users]
  );

  function toggleStatus(status: StatusKey) {
    setStatusFilters((current) => {
      const next = new Set(current);

      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }

      return next;
    });
  }

  function navigateToItem(item: UserListItem) {
    router.push(item.type === "profile" ? `/users/${item.id}` : `/users/invite/${item.id}`);
  }

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

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(STATUS_LABELS) as StatusKey[]).map((status) => {
            const isActive = statusFilters.has(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "border-foreground/10 bg-muted text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn("size-2 rounded-full", STATUS_DOT_CLASSES[status])}
                />
                {STATUS_LABELS[status]}
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or email"
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Tenants</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  No users match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((item) => {
                const tenantNames = getItemTenantNames(item);
                const visibleTenants = tenantNames.slice(0, 3);
                const hiddenTenantCount = Math.max(tenantNames.length - visibleTenants.length, 0);
                const status = getItemStatus(item);
                const label = item.type === "profile" ? item.displayName ?? item.email : item.email;
                const route = item.type === "profile" ? `/users/${item.id}` : `/users/invite/${item.id}`;

                return (
                  <TableRow
                    key={`${item.type}:${item.id}`}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open ${label}`}
                    onClick={() => navigateToItem(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigateToItem(item);
                      }
                    }}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar size="lg" className="size-10">
                          <AvatarFallback>
                            {item.type === "invite"
                              ? "?"
                              : getInitials(item.displayName, item.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{label}</p>
                          <p className="truncate text-sm text-muted-foreground">{item.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-primary/20 bg-primary/5 text-primary"
                      >
                        {getRoleLabel(item.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tenantNames.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {visibleTenants.map((tenantName) => (
                            <Badge key={tenantName} variant="outline">
                              {tenantName}
                            </Badge>
                          ))}
                          {hiddenTenantCount > 0 ? (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <span className="inline-flex cursor-default items-center" />
                                }
                              >
                                <Badge variant="outline">+{hiddenTenantCount}</Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                {tenantNames.join(", ")}
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 text-sm">
                        <span
                          className={cn("size-2 rounded-full", STATUS_DOT_CLASSES[status])}
                        />
                        {STATUS_LABELS[status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger
                          render={<span className="inline-flex cursor-default text-sm text-muted-foreground" />}
                        >
                          {formatRelativeDate(item.createdAt)}
                        </TooltipTrigger>
                        <TooltipContent>{formatAbsoluteDate(item.createdAt)}</TooltipContent>
                      </Tooltip>
                      <span className="sr-only">{route}</span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
