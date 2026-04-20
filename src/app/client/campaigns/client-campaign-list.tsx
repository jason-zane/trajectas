"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArrowRight, ExternalLink, Trash2, Users } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

import {
  bulkDeleteCampaigns,
  bulkUpdateCampaignStatus,
  deleteCampaign,
  type OperationalClientCampaign,
} from "@/app/actions/campaigns";
import { CampaignActionsDialog } from "@/components/campaigns/campaign-actions-dialog";
import { FavoriteCampaignButton } from "@/components/campaigns/favorite-campaign-button";
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
} from "@/components/data-table";
import type { BulkAction } from "@/components/data-table/data-table-bulk-bar";
import { usePortal } from "@/components/portal-context";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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

function ClientCampaignRowActions({
  campaign,
}: {
  campaign: OperationalClientCampaign;
}) {
  const router = useRouter();
  const { href } = usePortal();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCampaign(campaign.id);
      if (result && "error" in result && result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Failed to delete campaign",
        );
        return;
      }

      toast.success("Campaign deleted");
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DataTableActionsMenu label={`Open actions for ${campaign.title}`}>
        <DropdownMenuItem
          onClick={() => router.push(href(`/campaigns/${campaign.id}`))}
        >
          <ExternalLink className="size-4" />
          Open campaign
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            router.push(href(`/campaigns/${campaign.id}/participants`))
          }
        >
          <Users className="size-4" />
          View participants
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
          variant="destructive"
        >
          <Trash2 className="size-4" />
          Delete campaign
        </DropdownMenuItem>
      </DataTableActionsMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete campaign?"
        description={`Delete "${campaign.title}". This removes it from the list, but the action can still be undone later.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={isPending}
      />
    </>
  );
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
          className="group inline-flex max-w-xs items-center gap-1 font-semibold text-foreground hover:text-primary"
          title={row.original.title}
        >
          <span className="truncate">{row.original.title}</span>
          <ArrowRight className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      ),
      size: 260,
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
        <div className="flex items-center justify-end gap-1">
          <CampaignActionsDialog
            campaignTitle={row.original.title}
            accessToken={row.original.primaryAccessLink?.token}
            inviteHref={href(
              `/campaigns/${row.original.id}/participants?action=invite`,
            )}
            createLinkHref={href(
              `/campaigns/${row.original.id}/participants?action=link`,
            )}
          />
          <ClientCampaignRowActions campaign={row.original} />
        </div>
      ),
    },
  ];

  const bulkActions: BulkAction<OperationalClientCampaign>[] = [
    {
      label: "Archive",
      icon: <Archive className="mr-1.5 h-3.5 w-3.5" />,
      action: async (ids) => {
        await bulkUpdateCampaignStatus(ids, "archived");
      },
    },
    {
      label: "Delete",
      variant: "destructive",
      icon: <Trash2 className="mr-1.5 h-3.5 w-3.5" />,
      action: async (ids) => {
        await bulkDeleteCampaigns(ids);
      },
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
        enableRowSelection
        bulkActions={bulkActions}
      />
    </div>
  );
}
