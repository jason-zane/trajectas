"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableColumnHeader,
  DataTableRowLink,
} from "@/components/data-table";
import { LocalTime } from "@/components/local-time";
import type { ParticipantWithMeta } from "@/app/actions/participants";

type Row = ParticipantWithMeta & {
  displayName: string;
  lastActivityValue: string;
};

function getInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  invited: "secondary",
  registered: "outline",
  in_progress: "default",
  completed: "default",
  withdrawn: "destructive",
  expired: "outline",
};

interface Props {
  participants: ParticipantWithMeta[];
  participantHref: (p: ParticipantWithMeta) => string;
}

export function ResultsByParticipantTable({ participants, participantHref }: Props) {
  const rows: Row[] = participants.map((p) => ({
    ...p,
    displayName:
      `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email,
    lastActivityValue: p.lastActivity ?? p.created_at ?? "",
  }));

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "displayName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Participant" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">
              {getInitials(row.original.displayName, row.original.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <DataTableRowLink
              href={participantHref(row.original)}
              ariaLabel={`Open ${row.original.displayName}`}
              className="font-semibold text-foreground hover:text-primary"
            >
              {row.original.displayName}
            </DataTableRowLink>
            <p className="text-caption text-muted-foreground truncate">
              {row.original.email}
            </p>
          </div>
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
      id: "sessions",
      header: "Sessions",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">
          {row.original.completedSessionCount}/{row.original.sessionCount}
        </span>
      ),
    },
    {
      accessorKey: "lastActivityValue",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last activity" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          <LocalTime iso={row.original.lastActivityValue} format="relative" />
        </span>
      ),
    },
  ];

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
          options: [
            { label: "Invited", value: "invited" },
            { label: "Registered", value: "registered" },
            { label: "In Progress", value: "in_progress" },
            { label: "Completed", value: "completed" },
            { label: "Withdrawn", value: "withdrawn" },
            { label: "Expired", value: "expired" },
          ],
        },
      ]}
      defaultSort={{ id: "displayName", desc: false }}
      rowHref={(row) => participantHref(row)}
      pageSize={20}
    />
  );
}
