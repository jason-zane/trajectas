"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { deleteCampaign } from "@/app/actions/campaigns";
import type { CampaignWithMeta } from "@/app/actions/campaigns";
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
  DataTableRowLink,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

const STATUS_VARIANT: Record<
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
  if (!opensAt && !closesAt) {
    return "—";
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("en-AU", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  if (opensAt && closesAt) {
    return `${formatDate(opensAt)} – ${formatDate(closesAt)}`;
  }

  if (opensAt) {
    return `Opens ${formatDate(opensAt)}`;
  }

  return `Closes ${formatDate(closesAt!)}`;
}

function getCompletionPercent(campaign: CampaignWithMeta) {
  if (campaign.participantCount === 0) {
    return 0;
  }

  return Math.round((campaign.completedCount / campaign.participantCount) * 100);
}

const columns: ColumnDef<CampaignWithMeta>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => (
      <DataTableRowLink
        href={`/campaigns/${row.original.id}/overview`}
        ariaLabel={`Open ${row.original.title}`}
        className="min-w-0"
      >
        <p className="truncate font-semibold text-foreground hover:text-primary">
          {row.original.title}
        </p>
      </DataTableRowLink>
    ),
  },
  {
    accessorKey: "clientName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Client" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.clientName || "—"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status] ?? "secondary"}>
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
    cell: ({ row }) => <CampaignRowActions campaign={row.original} />,
  },
];

function CampaignRowActions({ campaign }: { campaign: CampaignWithMeta }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCampaign(campaign.id);
      if (result && "error" in result && result.error) {
        toast.error(
          typeof result.error === "string" ? result.error : "Failed to delete campaign"
        );
        return;
      }

      toast.success("Campaign deleted");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DataTableActionsMenu label={`Open actions for ${campaign.title}`}>
        <DropdownMenuItem onClick={() => router.push(`/campaigns/${campaign.id}/overview`)}>
          <ExternalLink className="size-4" />
          Open campaign
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/campaigns/${campaign.id}/participants`)}>
          <Users className="size-4" />
          View participants
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setOpen(true)}
          disabled={isPending}
          variant="destructive"
        >
          <Trash2 className="size-4" />
          Delete campaign
        </DropdownMenuItem>
      </DataTableActionsMenu>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
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

const statusFilter = [
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Closed", value: "closed" },
  { label: "Archived", value: "archived" },
];

export function CampaignsTable({ campaigns }: { campaigns: CampaignWithMeta[] }) {
  return (
    <DataTable
      columns={columns}
      data={campaigns}
      searchableColumns={["title", "clientName"]}
      searchPlaceholder="Search campaigns"
      filterableColumns={[
        {
          id: "status",
          title: "Status",
          options: statusFilter,
        },
      ]}
      defaultSort={{ id: "dateRange", desc: true }}
      rowHref={(row) => `/campaigns/${row.id}/overview`}
      pageSize={20}
    />
  );
}
