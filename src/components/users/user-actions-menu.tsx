"use client"

import { useState, useTransition } from "react"
import { ChevronDown, KeyRound, LogOut, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  cancelUserDeletion,
  revokeAllSessions,
  scheduleUserDeletion,
  sendSignInCode,
} from "@/app/actions/admin-user-actions"

type ActionId =
  | "send-sign-in-code"
  | "revoke-all-sessions"
  | "schedule-deletion"
  | "cancel-deletion"

interface UserActionsMenuProps {
  targetProfileId: string
  targetEmail: string
  hasPendingDeletion: boolean
}

interface ActionConfig {
  id: ActionId
  label: string
  description: string
  confirmLabel: string
  loadingLabel: string
  variant: "default" | "destructive"
  toastSuccess: string
  run: (id: string) => Promise<{ success?: boolean; error?: string }>
}

export function UserActionsMenu({
  targetProfileId,
  targetEmail,
  hasPendingDeletion,
}: UserActionsMenuProps) {
  const [activeAction, setActiveAction] = useState<ActionConfig | null>(null)
  const [isPending, startTransition] = useTransition()

  const actions: Record<ActionId, ActionConfig> = {
    "send-sign-in-code": {
      id: "send-sign-in-code",
      label: "Send sign-in code",
      description: `Email a fresh OTP to ${targetEmail} so they can sign in immediately.`,
      confirmLabel: "Send code",
      loadingLabel: "Sending…",
      variant: "default",
      toastSuccess: "Sign-in code emailed",
      run: sendSignInCode,
    },
    "revoke-all-sessions": {
      id: "revoke-all-sessions",
      label: "Revoke all sessions",
      description: `Force ${targetEmail} to re-authenticate. Active access tokens stay valid until they expire (~1hr); after that, they must request a new sign-in code.`,
      confirmLabel: "Revoke sessions",
      loadingLabel: "Revoking…",
      variant: "destructive",
      toastSuccess: "Refresh tokens revoked",
      run: revokeAllSessions,
    },
    "schedule-deletion": {
      id: "schedule-deletion",
      label: "Schedule deletion",
      description: `Mark ${targetEmail} for permanent deletion in 30 days. They keep full access during the grace period. A nightly cron sweeps the row after the deadline.`,
      confirmLabel: "Schedule deletion",
      loadingLabel: "Scheduling…",
      variant: "destructive",
      toastSuccess: "Account deletion scheduled",
      run: scheduleUserDeletion,
    },
    "cancel-deletion": {
      id: "cancel-deletion",
      label: "Cancel pending deletion",
      description: `Undo the pending deletion for ${targetEmail}. Their account remains active and the cron will not touch it.`,
      confirmLabel: "Cancel deletion",
      loadingLabel: "Cancelling…",
      variant: "default",
      toastSuccess: "Deletion cancelled",
      run: cancelUserDeletion,
    },
  }

  function handleConfirm() {
    if (!activeAction) return
    const cfg = activeAction
    startTransition(async () => {
      const result = await cfg.run(targetProfileId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(cfg.toastSuccess)
      setActiveAction(null)
    })
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
          <DropdownMenuGroup>
            <DropdownMenuLabel>Account access</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setActiveAction(actions["send-sign-in-code"])}>
              <KeyRound className="size-4" />
              {actions["send-sign-in-code"].label}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveAction(actions["revoke-all-sessions"])}>
              <LogOut className="size-4" />
              {actions["revoke-all-sessions"].label}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Account lifecycle</DropdownMenuLabel>
            {hasPendingDeletion ? (
              <DropdownMenuItem onClick={() => setActiveAction(actions["cancel-deletion"])}>
                <RotateCcw className="size-4" />
                {actions["cancel-deletion"].label}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => setActiveAction(actions["schedule-deletion"])}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                {actions["schedule-deletion"].label}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={Boolean(activeAction)}
        onOpenChange={(open) => {
          if (!open) setActiveAction(null)
        }}
        title={activeAction?.label ?? ""}
        description={activeAction?.description ?? ""}
        confirmLabel={activeAction?.confirmLabel ?? "Confirm"}
        cancelLabel="Cancel"
        variant={activeAction?.variant ?? "default"}
        onConfirm={handleConfirm}
        loading={isPending}
        loadingLabel={activeAction?.loadingLabel ?? "Working…"}
      />
    </>
  )
}
