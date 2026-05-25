"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { GitCompare, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { CampaignSessionRow } from "@/app/actions/campaigns";
import { bulkDeleteParticipantSessions } from "@/app/actions/sessions";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/data-table";
import type { BulkAction } from "@/components/data-table/data-table-bulk-bar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ParticipantStatusBadge } from "@/components/results/status-badges";
import { usePortal } from "@/components/portal-context";

function getInitials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CampaignSessionsTable({
  campaignId,
  sessions,
  canDelete = false,
}: {
  campaignId: string;
  sessions: CampaignSessionRow[];
  /**
   * Whether to expose the destructive Delete-sessions bulk action.
   * `bulkDeleteParticipantSessions` is platform-admin-only, so we hide
   * the action on portals where it would always 401.
   */
  canDelete?: boolean;
}) {
  const router = useRouter();
  const { href } = usePortal();
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const columns: ColumnDef<CampaignSessionRow>[] = [
    {
      accessorKey: "participantName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Participant" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-[10px] font-semibold">
              {getInitials(row.original.participantName, row.original.participantEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {row.original.participantName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.participantEmail}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "assessmentTitle",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Assessment" />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm">{row.original.assessmentTitle}</span>
          {row.original.attemptNumber > 1 && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Attempt {row.original.attemptNumber}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <ParticipantStatusBadge status={row.original.status} />,
    },
    {
      id: "lastActivity",
      accessorFn: (row) => row.completedAt ?? row.startedAt ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last activity" />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDate(row.original.completedAt ?? row.original.startedAt)}
        </span>
      ),
    },
  ];

  const bulkActions: BulkAction<CampaignSessionRow>[] = [
    {
      label: "Compare selected",
      icon: <GitCompare className="mr-1.5 h-3.5 w-3.5" />,
      action: (_ids, rows) => {
        // Compare operates on campaign_participant ids, not session ids.
        // Use the cp ids from the selected sessions, deduplicated.
        const cpIds = Array.from(new Set(rows.map((r) => r.campaignParticipantId)));
        const qs = new URLSearchParams({ ids: cpIds.join(",") });
        router.push(href(`/campaigns/${campaignId}/compare?${qs.toString()}`));
      },
    },
    ...(canDelete
      ? [
          {
            label: "Delete sessions",
            variant: "destructive" as const,
            icon: <Trash2 className="mr-1.5 h-3.5 w-3.5" />,
            action: (ids: string[]) => {
              setConfirmDelete(ids);
            },
          },
        ]
      : []),
  ];

  async function handleDelete() {
    if (!confirmDelete) return;
    setIsDeleting(true);
    try {
      await bulkDeleteParticipantSessions(confirmDelete);
      toast.success(
        `Deleted ${confirmDelete.length} session${confirmDelete.length === 1 ? "" : "s"}`,
      );
      setConfirmDelete(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete sessions.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={sessions}
        searchableColumns={["participantName", "participantEmail", "assessmentTitle"]}
        searchPlaceholder="Search by participant or assessment"
        defaultSort={{ id: "lastActivity", desc: true }}
        pageSize={25}
        enableRowSelection
        getRowId={(row) => row.id}
        bulkActions={bulkActions}
        rowHref={(row) => href(`/campaigns/${campaignId}/sessions/${row.id}`)}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && !isDeleting && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.length ?? 0} session${
          (confirmDelete?.length ?? 0) === 1 ? "" : "s"
        }?`}
        description="The participant_session rows, their responses, and any generated reports will be removed. The campaign participants themselves stay in the campaign. This cannot be undone."
        confirmLabel="Delete sessions"
        variant="destructive"
        onConfirm={handleDelete}
        loading={isDeleting}
        loadingLabel="Deleting…"
      />
    </>
  );
}
