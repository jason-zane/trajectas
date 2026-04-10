"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableColumnHeader,
  DataTableRowLink,
} from "@/components/data-table";
import { LocalTime } from "@/components/local-time";
import type { CampaignSessionRow } from "@/app/actions/sessions";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  not_started: "outline",
  in_progress: "secondary",
  completed: "default",
  expired: "destructive",
};

interface Props {
  sessions: CampaignSessionRow[];
  sessionHref: (s: CampaignSessionRow) => string;
  assessmentOptions: Array<{ label: string; value: string }>;
}

export function ResultsBySessionTable({ sessions, sessionHref, assessmentOptions }: Props) {
  const columns: ColumnDef<CampaignSessionRow>[] = [
    {
      accessorKey: "participantName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Participant" />
      ),
      cell: ({ row }) => (
        <div className="min-w-0">
          <DataTableRowLink
            href={sessionHref(row.original)}
            ariaLabel={`Open session for ${row.original.participantName}`}
            className="font-semibold hover:text-primary"
          >
            {row.original.participantName}
          </DataTableRowLink>
          <p className="text-caption text-muted-foreground truncate">
            {row.original.participantEmail}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "assessmentTitle",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Assessment" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{row.original.assessmentTitle}</span>
          <Badge variant="outline" className="text-xs tabular-nums">
            #{row.original.attemptNumber}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status] ?? "outline"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "startedAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Started" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          <LocalTime iso={row.original.startedAt} format="date-time" />
        </span>
      ),
    },
    {
      accessorKey: "completedAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Completed" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          <LocalTime iso={row.original.completedAt} format="date-time" />
        </span>
      ),
    },
    {
      accessorKey: "scoreCount",
      header: "Scores",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">{row.original.scoreCount}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={sessions}
      searchableColumns={["participantName", "participantEmail", "assessmentTitle"]}
      searchPlaceholder="Search sessions"
      filterableColumns={[
        {
          id: "assessmentTitle",
          title: "Assessment",
          options: assessmentOptions,
        },
        {
          id: "status",
          title: "Status",
          options: [
            { label: "Not Started", value: "not_started" },
            { label: "In Progress", value: "in_progress" },
            { label: "Completed", value: "completed" },
            { label: "Expired", value: "expired" },
          ],
        },
      ]}
      defaultSort={{ id: "startedAt", desc: true }}
      rowHref={(row) => sessionHref(row)}
      pageSize={20}
    />
  );
}
