"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, GitCompare, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import type { CampaignWithMeta, ClientParticipant, UniqueClientParticipant } from "@/app/actions/campaigns";
import { bulkDeleteParticipants } from "@/app/actions/participants";
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
  DataTableRowLink,
} from "@/components/data-table";
import type { BulkAction } from "@/components/data-table/data-table-bulk-bar";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ParticipantStatusBadge,
  PARTICIPANT_STATUS_LABEL,
} from "@/components/results/status-badges";
import { formatRelativeDate, formatDateTime } from "@/lib/formatting";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function getDisplayName(p: { firstName?: string | null; lastName?: string | null; email: string }) {
  const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  return name || p.email;
}

function getInitials(p: { firstName?: string | null; email: string }) {
  return (p.firstName?.[0] ?? p.email[0] ?? "?").toUpperCase();
}

// ---------------------------------------------------------------------------
// Sessions view columns
// ---------------------------------------------------------------------------

type SessionTableRow = ClientParticipant & {
  displayName: string;
  progressValue: number;
  lastActivityValue: string;
};

function SessionRowActions({ participant }: { participant: SessionTableRow }) {
  const router = useRouter();

  return (
    <DataTableActionsMenu label={`Open actions for ${participant.displayName}`}>
      <DropdownMenuItem
        onClick={() => router.push(`/client/campaigns/${participant.campaignId}/overview`)}
      >
        <ExternalLink className="size-4" />
        Open campaign
      </DropdownMenuItem>
    </DataTableActionsMenu>
  );
}

const sessionsColumns: ColumnDef<SessionTableRow>[] = [
  {
    accessorKey: "displayName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Participant" />
    ),
    cell: ({ row }) => {
      const href = row.original.latestSessionId
        ? `/client/campaigns/${row.original.campaignId}/sessions/${row.original.latestSessionId}`
        : `/client/campaigns/${row.original.campaignId}/participants/${row.original.id}`;
      return (
        <DataTableRowLink
          href={href}
          ariaLabel={`Open ${row.original.displayName}`}
          className="min-w-0"
        >
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarFallback>{getInitials(row.original)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold hover:text-primary">
                {row.original.displayName}
              </p>
              <p className="truncate text-sm text-muted-foreground">{row.original.email}</p>
            </div>
          </div>
        </DataTableRowLink>
      );
    },
  },
  {
    accessorKey: "campaignTitle",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Campaign" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.campaignTitle}</span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => <ParticipantStatusBadge status={row.original.status} />,
  },
  {
    id: "progress",
    accessorFn: (row) => row.progressValue,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Progress" />
    ),
    cell: ({ row }) => (
      <div className="min-w-32 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {row.original.completedSessionCount}/{row.original.sessionCount}
          </span>
          <span>{row.original.progressValue}%</span>
        </div>
        <Progress value={row.original.progressValue} className="gap-0" />
      </div>
    ),
  },
  {
    id: "lastActivity",
    accessorFn: (row) => row.lastActivityValue,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Activity" />
    ),
    cell: ({ row }) =>
      row.original.lastActivityValue ? (
        <Tooltip>
          <TooltipTrigger
            render={<span className="inline-flex cursor-default text-sm text-muted-foreground" />}
          >
            {formatRelativeDate(row.original.lastActivityValue)}
          </TooltipTrigger>
          <TooltipContent>{formatDateTime(row.original.lastActivityValue)}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
  },
  {
    id: "actions",
    enableSorting: false,
    cell: ({ row }) => <SessionRowActions participant={row.original} />,
  },
];

// ---------------------------------------------------------------------------
// Participants view columns (deduplicated)
// ---------------------------------------------------------------------------

type ParticipantTableRow = UniqueClientParticipant & {
  displayName: string;
  lastActivityValue: string;
};

function uniqueParticipantHref(row: ParticipantTableRow) {
  return row.latestSessionId
    ? `/client/campaigns/${row.latestCampaignId}/sessions/${row.latestSessionId}`
    : `/client/campaigns/${row.latestCampaignId}/participants/${row.id}`;
}

// ---------------------------------------------------------------------------
// Search and pagination components for server-side pagination
// ---------------------------------------------------------------------------

function ParticipantsSearchBar({
  onSearch,
  initialQuery,
}: {
  onSearch: (query: string) => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => window.clearTimeout(handle);
  }, [query, onSearch]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          className="pl-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
    </div>
  );
}

function ParticipationsPaginationControls({
  currentPage,
  pageCount,
  pageStart,
  pageEnd,
  totalCount,
  onPageChange,
}: {
  currentPage: number;
  pageCount: number;
  pageStart: number;
  pageEnd: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        {totalCount === 0 ? (
          "No participants"
        ) : (
          <>Showing {pageStart}–{pageEnd} of {totalCount} participant{totalCount !== 1 ? "s" : ""}</>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Page {pageCount === 0 ? 0 : currentPage + 1} of {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= pageCount - 1}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

const participantsColumns: ColumnDef<ParticipantTableRow>[] = [
  {
    accessorKey: "displayName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Participant" />
    ),
    cell: ({ row }) => (
      <DataTableRowLink
        href={uniqueParticipantHref(row.original)}
        ariaLabel={`Open ${row.original.displayName}`}
        className="min-w-0"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-9">
            <AvatarFallback>{getInitials(row.original)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold hover:text-primary">
              {row.original.displayName}
            </p>
            <p className="truncate text-sm text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      </DataTableRowLink>
    ),
  },
  {
    accessorKey: "sessionCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sessions" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.sessionCount}
      </span>
    ),
  },
  {
    accessorKey: "latestStatus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latest Status" />
    ),
    cell: ({ row }) => (
      <ParticipantStatusBadge status={row.original.latestStatus} />
    ),
  },
  {
    id: "lastActivity",
    accessorFn: (row) => row.lastActivityValue,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Activity" />
    ),
    cell: ({ row }) =>
      row.original.lastActivityValue ? (
        <Tooltip>
          <TooltipTrigger
            render={<span className="inline-flex cursor-default text-sm text-muted-foreground" />}
          >
            {formatRelativeDate(row.original.lastActivityValue)}
          </TooltipTrigger>
          <TooltipContent>{formatDateTime(row.original.lastActivityValue)}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalCount: number;
  query: string;
};

export function GlobalParticipants({
  view,
  sessions,
  participants,
  campaigns,
  paginationMeta,
}: {
  view: "participants" | "sessions";
  sessions: ClientParticipant[];
  participants: UniqueClientParticipant[];
  campaigns: CampaignWithMeta[];
  paginationMeta?: PaginationMeta;
}) {
  const router = useRouter();
  const total = view === "sessions" ? sessions.length : paginationMeta?.totalCount ?? participants.length;

  function handleViewChange(newView: string | null) {
    if (!newView) return;
    if (newView === "participants") {
      router.push("/client/participants");
    } else {
      router.push("/client/participants?view=sessions");
    }
  }

  function handleParticipantsPageChange(newPage: number) {
    const qs = new URLSearchParams();
    qs.set("page", String(newPage));
    if (paginationMeta?.query) {
      qs.set("q", paginationMeta.query);
    }
    router.push(`/client/participants?${qs.toString()}`);
  }

  function handleParticipantsSearch(query: string) {
    const qs = new URLSearchParams();
    if (query.trim()) {
      qs.set("q", query.trim());
    }
    // Reset to page 0 on search
    qs.set("page", "0");
    router.replace(`/client/participants?${qs.toString()}`);
  }

  const sessionsBulkActions: BulkAction<SessionTableRow>[] = [
    {
      label: "Compare selected",
      icon: <GitCompare className="mr-1.5 h-3.5 w-3.5" />,
      action: (ids) => {
        const qs = new URLSearchParams({ ids: ids.join(",") });
        router.push(`/client/participants/compare?${qs.toString()}`);
      },
    },
    {
      label: "Remove",
      variant: "destructive",
      icon: <Trash2 className="mr-1.5 h-3.5 w-3.5" />,
      action: async (ids) => {
        try {
          await bulkDeleteParticipants(ids);
          toast.success(
            `Removed ${ids.length} participant${ids.length === 1 ? "" : "s"}`,
          );
          router.refresh();
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Failed to remove participants.",
          );
        }
      },
    },
  ];

  if (view === "sessions") {
    const rows: SessionTableRow[] = sessions.map((s) => {
      const timestamps = [s.startedAt, s.completedAt].filter(Boolean) as string[];
      return {
        ...s,
        displayName: getDisplayName(s),
        progressValue:
          s.sessionCount === 0
            ? 0
            : Math.round((s.completedSessionCount / s.sessionCount) * 100),
        lastActivityValue: timestamps.length > 0
          ? timestamps.sort().reverse()[0]
          : s.created_at,
      };
    });

    return (
      <div className="space-y-8 max-w-6xl">
        <PageHeader
          eyebrow="Participants"
          title="All Participants"
          description={`${total} session${total !== 1 ? "s" : ""} across all campaigns.`}
        />

        <div className="space-y-4">
          <Tabs value={view} onValueChange={handleViewChange}>
            <TabsList>
              <TabsTrigger value="participants">Participants</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
            </TabsList>
          </Tabs>

          <DataTable
            columns={sessionsColumns}
            data={rows}
            searchableColumns={["displayName", "email"]}
            searchPlaceholder="Search sessions"
            filterableColumns={[
              {
                id: "campaignTitle",
                title: "Campaign",
                options: campaigns.map((c) => ({
                  label: c.title,
                  value: c.title,
                })),
              },
              {
                id: "status",
                title: "Status",
                options: Object.entries(PARTICIPANT_STATUS_LABEL).map(
                  ([value, label]) => ({ value, label }),
                ),
              },
            ]}
            defaultSort={{ id: "lastActivity", desc: true }}
            pageSize={25}
            enableRowSelection
            getRowId={(row) => row.id}
            bulkActions={sessionsBulkActions}
            rowHref={(row) =>
              row.latestSessionId
                ? `/client/campaigns/${row.campaignId}/sessions/${row.latestSessionId}`
                : `/client/campaigns/${row.campaignId}/participants/${row.id}`
            }
          />
        </div>
      </div>
    );
  }

  // Participants view (deduplicated with server-side pagination)
  const rows: ParticipantTableRow[] = participants.map((p) => ({
    ...p,
    displayName: getDisplayName(p),
    lastActivityValue: p.lastActivity ?? "",
  }));

  const pageCount = paginationMeta
    ? Math.ceil(paginationMeta.totalCount / paginationMeta.pageSize)
    : 1;
  const currentPage = paginationMeta?.page ?? 0;
  const pageStart = currentPage * (paginationMeta?.pageSize ?? 50) + 1;
  const pageEnd = Math.min(
    (currentPage + 1) * (paginationMeta?.pageSize ?? 50),
    paginationMeta?.totalCount ?? 0,
  );

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Participants"
        title="All Participants"
        description={`${total} participant${total !== 1 ? "s" : ""} across all campaigns.`}
      />

      <div className="space-y-4">
        <Tabs value={view} onValueChange={handleViewChange}>
          <TabsList>
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>
        </Tabs>

        <ParticipantsSearchBar
          onSearch={handleParticipantsSearch}
          initialQuery={paginationMeta?.query}
        />

        <DataTable
          columns={participantsColumns}
          data={rows}
          searchableColumns={[]}
          searchPlaceholder=""
          filterableColumns={[
            {
              id: "latestStatus",
              title: "Status",
              options: Object.entries(PARTICIPANT_STATUS_LABEL).map(
                ([value, label]) => ({ value, label }),
              ),
            },
          ]}
          defaultSort={{ id: "lastActivity", desc: true }}
          pageSize={paginationMeta?.pageSize ?? 50}
          rowHref={uniqueParticipantHref}
          hideClientPagination
          serverPaginationControls={
            <ParticipationsPaginationControls
              currentPage={currentPage}
              pageCount={pageCount}
              pageStart={pageStart}
              pageEnd={pageEnd}
              totalCount={paginationMeta?.totalCount ?? 0}
              onPageChange={handleParticipantsPageChange}
            />
          }
        />
      </div>
    </div>
  );
}
