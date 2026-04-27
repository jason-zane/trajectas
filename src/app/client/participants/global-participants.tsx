"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, GitCompare, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<
  string,
  "secondary" | "default" | "outline" | "destructive"
> = {
  invited: "secondary",
  registered: "outline",
  in_progress: "default",
  completed: "default",
  withdrawn: "destructive",
  expired: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  registered: "Registered",
  in_progress: "In Progress",
  completed: "Completed",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

function getDisplayName(p: { firstName?: string | null; lastName?: string | null; email: string }) {
  const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  return name || p.email;
}

function getInitials(p: { firstName?: string | null; email: string }) {
  return (p.firstName?.[0] ?? p.email[0] ?? "?").toUpperCase();
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    cell: ({ row }) => (
      <DataTableRowLink
        href={`/client/campaigns/${row.original.campaignId}/participants/${row.original.id}`}
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
    ),
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
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status] ?? "secondary"}>
        {STATUS_LABEL[row.original.status] ?? row.original.status}
      </Badge>
    ),
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

const participantsColumns: ColumnDef<ParticipantTableRow>[] = [
  {
    accessorKey: "displayName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Participant" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="size-9">
          <AvatarFallback>{getInitials(row.original)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.original.displayName}</p>
          <p className="truncate text-sm text-muted-foreground">{row.original.email}</p>
        </div>
      </div>
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
      <Badge variant={STATUS_VARIANT[row.original.latestStatus] ?? "secondary"}>
        {STATUS_LABEL[row.original.latestStatus] ?? row.original.latestStatus}
      </Badge>
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

export function GlobalParticipants({
  view,
  sessions,
  participants,
  campaigns,
}: {
  view: "participants" | "sessions";
  sessions: ClientParticipant[];
  participants: UniqueClientParticipant[];
  campaigns: CampaignWithMeta[];
}) {
  const router = useRouter();
  const total = view === "sessions" ? sessions.length : participants.length;

  function handleViewChange(newView: string | null) {
    if (!newView) return;
    if (newView === "participants") {
      router.push("/client/participants");
    } else {
      router.push("/client/participants?view=sessions");
    }
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
                options: Object.entries(STATUS_LABEL).map(([value, label]) => ({
                  value,
                  label,
                })),
              },
            ]}
            defaultSort={{ id: "lastActivity", desc: true }}
            pageSize={25}
            enableRowSelection
            getRowId={(row) => row.id}
            bulkActions={sessionsBulkActions}
          />
        </div>
      </div>
    );
  }

  // Participants view (deduplicated)
  const rows: ParticipantTableRow[] = participants.map((p) => ({
    ...p,
    displayName: getDisplayName(p),
    lastActivityValue: p.lastActivity ?? "",
  }));

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

        <DataTable
          columns={participantsColumns}
          data={rows}
          searchableColumns={["displayName", "email"]}
          searchPlaceholder="Search participants"
          filterableColumns={[
            {
              id: "latestStatus",
              title: "Status",
              options: Object.entries(STATUS_LABEL).map(([value, label]) => ({
                value,
                label,
              })),
            },
          ]}
          defaultSort={{ id: "lastActivity", desc: true }}
          pageSize={25}
        />
      </div>
    </div>
  );
}
