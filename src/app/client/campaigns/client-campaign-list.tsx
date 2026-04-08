"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Progress } from "@/components/ui/progress";
import { usePortal } from "@/components/portal-context";
import type { CampaignWithMeta } from "@/app/actions/campaigns";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusVariant: Record<
  string,
  "secondary" | "default" | "outline" | "destructive"
> = {
  draft: "secondary",
  active: "default",
  paused: "outline",
  closed: "destructive",
  archived: "outline",
};

function formatDateRange(opensAt?: string, closesAt?: string) {
  if (!opensAt && !closesAt) return "—";
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-AU", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (opensAt && closesAt) return `${fmt(opensAt)} – ${fmt(closesAt)}`;
  if (opensAt) return `Opens ${fmt(opensAt)}`;
  return `Closes ${fmt(closesAt!)}`;
}

function getCompletionPercent(campaign: CampaignWithMeta) {
  if (campaign.participantCount === 0) {
    return 0;
  }

  return Math.round((campaign.completedCount / campaign.participantCount) * 100);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ClientCampaignListProps {
  campaigns: CampaignWithMeta[];
}

export function ClientCampaignList({ campaigns }: ClientCampaignListProps) {
  const { href } = usePortal();

  const columns: ColumnDef<CampaignWithMeta>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => <span className="font-semibold">{row.original.title}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <Badge variant={statusVariant[row.original.status] ?? "secondary"}>
          {row.original.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "assessmentCount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Assessments" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.assessmentCount}
        </span>
      ),
    },
    {
      accessorKey: "participantCount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Participants" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.participantCount}
        </span>
      ),
    },
    {
      id: "completion",
      accessorFn: (row) => getCompletionPercent(row),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Completion" />
      ),
      cell: ({ row }) => {
        const completion = getCompletionPercent(row.original);

        return (
          <div className="min-w-36 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {row.original.completedCount}/{row.original.participantCount || 0}
              </span>
              <span>{completion}%</span>
            </div>
            <Progress value={completion} className="gap-0" />
          </div>
        );
      },
    },
    {
      id: "dateRange",
      accessorFn: (row) => row.opensAt ?? row.created_at,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date Range" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateRange(row.original.opensAt, row.original.closesAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaigns"
        description="View your assessment campaigns and track completion progress."
      >
        <Link href={href("/campaigns/create")}>
          <Button>
            <Plus className="size-4" />
            New Campaign
          </Button>
        </Link>
      </PageHeader>

      <DataTable
        columns={columns}
        data={campaigns}
        searchableColumns={["title"]}
        searchPlaceholder="Search campaigns"
        filterableColumns={[
          {
            id: "status",
            title: "Status",
            options: [
              { label: "Draft", value: "draft" },
              { label: "Active", value: "active" },
              { label: "Paused", value: "paused" },
              { label: "Closed", value: "closed" },
              { label: "Archived", value: "archived" },
            ],
          },
        ]}
        defaultSort={{ id: "dateRange", desc: true }}
        rowHref={(row) => href(`/campaigns/${row.id}/overview`)}
        pageSize={20}
      />
    </div>
  );
}
