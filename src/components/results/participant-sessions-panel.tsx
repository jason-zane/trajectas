"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Trash2 } from "lucide-react";

import { bulkDeleteParticipantSessions } from "@/app/actions/sessions";
import type { ParticipantSession } from "@/app/actions/participants";
import { DataTable, DataTableColumnHeader, DataTableRowLink, type BulkAction } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { LocalTime } from "@/components/local-time";
import { getSessionProcessingStatusLabel } from "@/lib/assess/session-processing";

interface ParticipantSessionsPanelProps {
  sessions: ParticipantSession[];
  sessionBaseHref: string;
}

type SessionRow = ParticipantSession & {
  attemptNumber: number;
};

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "completed") return "default";
  if (status === "in_progress") return "secondary";
  if (status === "expired") return "destructive";
  return "outline";
}

function processingVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "ready") return "default";
  if (status === "scoring" || status === "reporting") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

function computeAttempts(sessions: ParticipantSession[]): Map<string, number> {
  const byAssessment = new Map<string, ParticipantSession[]>();
  for (const s of sessions) {
    const list = byAssessment.get(s.assessmentId) ?? [];
    list.push(s);
    byAssessment.set(s.assessmentId, list);
  }
  const attempts = new Map<string, number>();
  for (const list of byAssessment.values()) {
    list
      .slice()
      .sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""))
      .forEach((s, idx) => attempts.set(s.id, idx + 1));
  }
  return attempts;
}

function getColumns(sessionBaseHref: string): ColumnDef<SessionRow>[] {
  return [
    {
      accessorKey: "assessmentTitle",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Assessment" />
      ),
      cell: ({ row }) => (
        <DataTableRowLink
          href={`${sessionBaseHref}/${row.original.id}`}
          ariaLabel={`Open session for ${row.original.assessmentTitle}`}
        >
          <span className="font-medium hover:text-primary">
            {row.original.assessmentTitle}
          </span>
        </DataTableRowLink>
      ),
    },
    {
      accessorKey: "attemptNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Attempt" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          #{row.original.attemptNumber}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(row.original.status)}>
            {row.original.status}
          </Badge>
          {row.original.status === "completed" && (
            <Badge variant={processingVariant(row.original.processingStatus)}>
              {getSessionProcessingStatusLabel(row.original.processingStatus)}
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "startedAt",
      accessorFn: (row) => row.startedAt ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Started" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          <LocalTime iso={row.original.startedAt} format="date-time" />
        </span>
      ),
    },
    {
      id: "completedAt",
      accessorFn: (row) => row.completedAt ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Completed" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          <LocalTime iso={row.original.completedAt} format="date-time" />
        </span>
      ),
    },
    {
      id: "scores",
      accessorFn: (row) => row.scores?.length ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Scores" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.scores?.length ?? 0}
        </span>
      ),
    },
    {
      id: "open",
      enableSorting: false,
      cell: ({ row }) => (
        <a
          href={`${sessionBaseHref}/${row.original.id}`}
          className="text-muted-foreground hover:text-primary"
        >
          <ExternalLink className="size-4" />
        </a>
      ),
    },
  ];
}

const bulkActions: BulkAction<SessionRow>[] = [
  {
    label: "Delete",
    variant: "destructive",
    icon: <Trash2 className="mr-1.5 h-3.5 w-3.5" />,
    action: async (ids) => {
      await bulkDeleteParticipantSessions(ids);
    },
  },
];

export function ParticipantSessionsPanel({
  sessions,
  sessionBaseHref,
}: ParticipantSessionsPanelProps) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        variant="default"
        title="No sessions yet"
        description="Assessment sessions will appear here once the participant starts."
      />
    );
  }

  const attempts = computeAttempts(sessions);
  const rows: SessionRow[] = sessions.map((s) => ({
    ...s,
    attemptNumber: attempts.get(s.id) ?? 1,
  }));

  return (
    <DataTable
      columns={getColumns(sessionBaseHref)}
      data={rows}
      defaultSort={{ id: "startedAt", desc: true }}
      pageSize={20}
      enableRowSelection
      getRowId={(row) => row.id}
      bulkActions={bulkActions}
    />
  );
}
