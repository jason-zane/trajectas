"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Building2,
  ChevronDown,
  MoreHorizontal,
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

interface SessionHeaderActionsProps {
  sessionId: string;
  campaignHref: string;
  participantHref: string;
  /** Where to navigate after a successful delete. Usually the back-link target. */
  postDeleteHref: string;
  /** Whether to expose admin-only management actions (currently: Delete session). */
  canManage?: boolean;
}

export function SessionHeaderActions({
  sessionId,
  campaignHref,
  participantHref,
  postDeleteHref,
  canManage = false,
}: SessionHeaderActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await bulkDeleteParticipantSessions([sessionId]);
        toast.success("Session deleted");
        setConfirmOpen(false);
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
          {canManage ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete session
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canManage ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete this session?"
          description="The participant_session row, its responses, and any generated reports will be removed. This cannot be undone."
          confirmLabel="Delete session"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={handleDelete}
          loading={isPending}
          loadingLabel="Deleting…"
        />
      ) : null}
    </>
  );
}
