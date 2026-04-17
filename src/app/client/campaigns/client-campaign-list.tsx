"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Users } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import type { OperationalClientCampaign } from "@/app/actions/campaigns";
import { CopyCampaignLinkButton } from "@/components/campaigns/copy-campaign-link-button";
import { FavoriteCampaignButton } from "@/components/campaigns/favorite-campaign-button";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { usePortal } from "@/components/portal-context";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

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

function getCompletionPercent(campaign: OperationalClientCampaign) {
  if (campaign.participantCount === 0) {
    return 0;
  }

  return Math.round((campaign.completedCount / campaign.participantCount) * 100);
}

interface ClientCampaignListProps {
  campaigns: OperationalClientCampaign[];
  favoriteCampaignIds?: string[];
}

export function ClientCampaignList({ campaigns, favoriteCampaignIds = [] }: ClientCampaignListProps) {
  const { href } = usePortal();
  const favoriteSet = new Set(favoriteCampaignIds);

  const columns: ColumnDef<OperationalClientCampaign>[] = [
    {
      id: "favorite",
      header: () => null,
      cell: ({ row }) => (
        <FavoriteCampaignButton
          campaignId={row.original.id}
          isFavorite={favoriteSet.has(row.original.id)}
        />
      ),
      size: 40,
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Campaign" />
      ),
      cell: ({ row }) => (
        <Link
          href={href(`/campaigns/${row.original.id}`)}
          className="inline-flex items-center gap-1 font-semibold hover:text-primary"
        >
          {row.original.title}
          <ArrowRight className="size-4" />
        </Link>
      ),
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
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <CopyCampaignLinkButton
            token={row.original.primaryAccessLink?.token}
            createHref={href(
              `/campaigns/${row.original.id}/participants?action=link`,
            )}
            className="justify-start"
          />
          <Link
            href={href(`/campaigns/${row.original.id}/participants?action=invite`)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Users className="size-4" />
            Invite
          </Link>
          <Link
            href={href(`/campaigns/${row.original.id}/participants`)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <CheckCircle2 className="size-4" />
            Results
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-6xl">
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
        pageSize={20}
      />
    </div>
  );
}
