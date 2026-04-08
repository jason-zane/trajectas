"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { ParticipantWithMeta } from "@/app/actions/participants";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ParticipantTableRow = ParticipantWithMeta & {
  displayName: string;
  progressValue: number;
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

function getDisplayName(participant: ParticipantWithMeta) {
  const name = `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim();
  return name || participant.email;
}

function getInitials(participant: ParticipantWithMeta) {
  return (participant.firstName?.[0] ?? participant.email[0] ?? "?").toUpperCase();
}

const columns: ColumnDef<ParticipantTableRow>[] = [
  {
    accessorKey: "displayName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Participant" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
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
];

export function ParticipantsTable({
  participants,
}: {
  participants: ParticipantWithMeta[];
}) {
  const rows = participants.map((participant) => ({
    ...participant,
    displayName: getDisplayName(participant),
    progressValue:
      participant.sessionCount === 0
        ? 0
        : Math.round((participant.completedSessionCount / participant.sessionCount) * 100),
    lastActivityValue: participant.lastActivity ?? "",
  }));

  return (
    <DataTable
      columns={columns}
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
          options: Array.from(new Set(rows.map((row) => row.campaignTitle))).map((campaign) => ({
            label: campaign,
            value: campaign,
          })),
        },
      ]}
      defaultSort={{ id: "lastActivity", desc: true }}
      rowHref={(row) => `/participants/${row.id}`}
      pageSize={20}
    />
  );
}
