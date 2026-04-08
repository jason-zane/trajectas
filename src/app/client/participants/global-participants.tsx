"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { CampaignWithMeta, ClientParticipant } from "@/app/actions/campaigns";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

type ParticipantRow = ClientParticipant & {
  displayName: string;
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

function getDisplayName(participant: ClientParticipant) {
  const name = `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim();
  return name || participant.email;
}

const columns: ColumnDef<ParticipantRow>[] = [
  {
    accessorKey: "displayName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Participant" />
    ),
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-semibold">{row.original.displayName}</p>
        <p className="truncate text-sm text-muted-foreground">{row.original.email}</p>
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
];

interface GlobalParticipantsProps {
  participants: ClientParticipant[];
  campaigns: CampaignWithMeta[];
}

export function GlobalParticipants({
  participants,
  campaigns,
}: GlobalParticipantsProps) {
  const rows = participants.map((participant) => ({
    ...participant,
    displayName: getDisplayName(participant),
  }));

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Participants"
        title="All Participants"
        description="Showing participants across all campaigns. The same person may appear multiple times if enrolled in more than one campaign."
      />

      <DataTable
        columns={columns}
        data={rows}
        searchableColumns={["displayName", "email"]}
        searchPlaceholder="Search participants"
        filterableColumns={[
          {
            id: "campaignTitle",
            title: "Campaign",
            options: campaigns.map((campaign) => ({
              label: campaign.title,
              value: campaign.title,
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
        defaultSort={{ id: "displayName", desc: false }}
        pageSize={25}
      />
    </div>
  );
}
