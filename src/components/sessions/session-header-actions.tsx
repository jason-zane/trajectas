"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Building2,
  ChevronDown,
  MoreHorizontal,
  RotateCcw,
  Scale,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { bulkDeleteParticipantSessions } from "@/app/actions/sessions";
import { resetSessionProcessing } from "@/app/actions/admin-session-actions";

interface SessionHeaderActionsProps {
  sessionId: string;
  campaignHref: string;
  participantHref: string;
  /** Where to navigate after a successful delete. Usually the back-link target. */
  postDeleteHref: string;
  /** Whether to expose admin-only management actions (Reset processing, Delete session). */
  canManage?: boolean;
  /**
   * Compare-with entry: the campaign participant id of the current
   * session's subject, and the portal-appropriate path to the Compare
   * page. When both are supplied, a "Compare with…" item appears in
   * the menu that routes to Compare with this participant pre-added.
   */
  compareParticipantId?: string;
  comparePath?: string;
}

export function SessionHeaderActions({
  sessionId,
  campaignHref,
  participantHref,
  postDeleteHref,
  canManage = false,
  compareParticipantId,
  comparePath,
}: SessionHeaderActionsProps) {
  const router = useRouter();
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isResetting, startReset] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function handleReset() {
    startReset(async () => {
      const result = await resetSessionProcessing(sessionId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Processing state cleared");
      setResetConfirmOpen(false);
      router.refresh();
    });
  }

  function handleDelete() {
    startDelete(async () => {
      try {
        await bulkDeleteParticipantSessions([sessionId]);
        toast.success("Session deleted");
        setDeleteConfirmOpen(false);
        router.push(postDeleteHref);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete session",
        );
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              <MoreHorizontal className="size-4" />
              Actions
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onClick={() => router.push(campaignHref)}>
            <Building2 className="size-4" />
            Open campaign
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(participantHref)}>
            <User className="size-4" />
            Open participant
          </DropdownMenuItem>
          {compareParticipantId && comparePath ? (
            <DropdownMenuItem
              onClick={() => {
                const entries = encodeURIComponent(
                  JSON.stringify([{ campaignParticipantId: compareParticipantId }]),
                );
                router.push(`${comparePath}?entries=${entries}`);
              }}
            >
              <Scale className="size-4" />
              Compare with…
            </DropdownMenuItem>
          ) : null}
          {canManage ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setResetConfirmOpen(true)}>
                <RotateCcw className="size-4" />
                Reset processing state
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete session
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canManage ? (
        <>
          <ConfirmDialog
            open={resetConfirmOpen}
            onOpenChange={setResetConfirmOpen}
            title="Reset session processing state?"
            description="Clears processing_status, processing_error, and processed_at so a stuck scoring or report-generation run can be retried. Responses, position, and session status are not touched."
            confirmLabel="Reset processing"
            cancelLabel="Cancel"
            variant="default"
            onConfirm={handleReset}
            loading={isResetting}
            loadingLabel="Resetting…"
          />
          <ConfirmDialog
            open={deleteConfirmOpen}
            onOpenChange={setDeleteConfirmOpen}
            title="Delete this session?"
            description="The participant_session row, its responses, and any generated reports will be removed. This cannot be undone."
            confirmLabel="Delete session"
            cancelLabel="Cancel"
            variant="destructive"
            onConfirm={handleDelete}
            loading={isDeleting}
            loadingLabel="Deleting…"
          />
        </>
      ) : null}
    </>
  );
}
