"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, GitCompare, Trash2 } from "lucide-react";

import { bulkDeleteParticipants, bulkUpdateParticipantStatus } from "@/app/actions/participants";
import type { ParticipantWithMeta, UniqueParticipant } from "@/app/actions/participants";
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
  DataTableRowLink,
  type BulkAction,
} from "@/components/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type SessionTableRow = ParticipantWithMeta & {
  displayName: string;
  progressValue: number;
  lastActivityValue: string;
};

type ParticipantTableRow = UniqueParticipant & {
  displayName: string;
  lastActivityValue: string;
};

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

function getDisplayName(participant: ParticipantWithMeta | UniqueParticipant) {
  const name = `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim();
  return name || participant.email;
}

function getInitials(participant: ParticipantWithMeta | UniqueParticipant) {
  return (participant.firstName?.[0] ?? participant.email[0] ?? "?").toUpperCase();
}

const sessionsColumns: ColumnDef<SessionTableRow>[] = [
  {
    accessorKey: "displayName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Participant" />
    ),
    cell: ({ row }) => (
      <DataTableRowLink
        href={`/participants/${row.original.id}`}
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
      row.original.lastActivity ? (
        <Tooltip>
          <TooltipTrigger
            render={<span className="inline-flex cursor-default text-sm text-muted-foreground" />}
          >
            {formatRelativeDate(row.original.lastActivity)}
          </TooltipTrigger>
          <TooltipContent>{formatDateTime(row.original.lastActivity)}</TooltipContent>
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

const participantsColumns: ColumnDef<ParticipantTableRow>[] = [
  {
    accessorKey: "displayName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Participant" />
    ),
    cell: ({ row }) => (
      <DataTableRowLink
        href={`/participants/${row.original.id}`}
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
    accessorKey: "sessionCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sessions" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.sessionCount}</span>
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
      row.original.lastActivity ? (
        <Tooltip>
          <TooltipTrigger
            render={<span className="inline-flex cursor-default text-sm text-muted-foreground" />}
          >
            {formatRelativeDate(row.original.lastActivity)}
          </TooltipTrigger>
          <TooltipContent>{formatDateTime(row.original.lastActivity)}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
  },
];

function SessionRowActions({ participant }: { participant: SessionTableRow }) {
  const router = useRouter();

  return (
    <DataTableActionsMenu label={`Open actions for ${participant.displayName}`}>
      <DropdownMenuItem onClick={() => router.push(`/participants/${participant.id}`)}>
        <ExternalLink className="size-4" />
        Open participant
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => router.push(`/campaigns/${participant.campaignId}/overview`)}
      >
        <ExternalLink className="size-4" />
        Open campaign
      </DropdownMenuItem>
    </DataTableActionsMenu>
  );
}

const sessionsBulkActions: BulkAction<SessionTableRow>[] = [
  {
    label: "Delete",
    variant: "destructive",
    icon: <Trash2 className="mr-1.5 h-3.5 w-3.5" />,
    action: async (ids) => {
      await bulkDeleteParticipants(ids);
    },
  },
  {
    label: "Mark Completed",
    action: async (ids) => {
      await bulkUpdateParticipantStatus(ids, "completed");
    },
  },
  {
    label: "Withdraw",
    action: async (ids) => {
      await bulkUpdateParticipantStatus(ids, "withdrawn");
    },
  },
];

export function ParticipantsTable({
  view,
  sessions,
  participants,
}: {
  view: "participants" | "sessions";
  sessions: ParticipantWithMeta[];
  participants: UniqueParticipant[];
}) {
  const router = useRouter();

  function handleViewChange(newView: string | null) {
    if (!newView) return;
    if (newView === "participants") {
      router.push("/participants");
    } else {
      router.push("/participants?view=sessions");
    }
  }

  const sessionsBulkActionsWithCompare: BulkAction<SessionTableRow>[] = [
    {
      label: "Compare selected",
      icon: <GitCompare className="mr-1.5 h-3.5 w-3.5" />,
      action: (ids) => {
        const qs = new URLSearchParams({ ids: ids.join(",") });
        router.push(`/participants/compare?${qs.toString()}`);
      },
    },
    ...sessionsBulkActions,
  ];

  if (view === "sessions") {
    const rows: SessionTableRow[] = sessions.map((s) => ({
      ...s,
      displayName: getDisplayName(s),
      progressValue:
        s.sessionCount === 0
          ? 0
          : Math.round((s.completedSessionCount / s.sessionCount) * 100),
      lastActivityValue: s.lastActivity ?? "",
    }));

    return (
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
          searchPlaceholder="Search participants"
          filterableColumns={[
            {
              id: "status",
              title: "Status",
              options: Object.entries(STATUS_LABEL).map(([value, label]) => ({
                value,
                label,
              })),
            },
            {
              id: "campaignTitle",
              title: "Campaign",
              options: Array.from(new Set(rows.map((row) => row.campaignTitle))).map(
                (campaign) => ({
                  label: campaign,
                  value: campaign,
                })
              ),
            },
          ]}
          defaultSort={{ id: "lastActivity", desc: true }}
          rowHref={(row) => `/participants/${row.id}`}
          pageSize={20}
          enableRowSelection
          getRowId={(row) => row.id}
          bulkActions={sessionsBulkActionsWithCompare}
        />
      </div>
    );
  }

  const rows: ParticipantTableRow[] = participants.map((p) => ({
    ...p,
    displayName: getDisplayName(p),
    lastActivityValue: p.lastActivity ?? "",
  }));

  return (
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
            title: "Latest Status",
            options: Object.entries(STATUS_LABEL).map(([value, label]) => ({
              value,
              label,
            })),
          },
        ]}
        defaultSort={{ id: "lastActivity", desc: true }}
        rowHref={(row) => `/participants/${row.id}`}
        pageSize={20}
      />
    </div>
  );
}
