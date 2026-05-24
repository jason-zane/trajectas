"use client"

import { useState, useTransition } from "react"
import { ChevronDown, MoreHorizontal, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { resetSessionProcessing } from "@/app/actions/admin-session-actions"

interface SessionActionsMenuProps {
  sessionId: string
}

export function SessionActionsMenu({ sessionId }: SessionActionsMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleReset() {
    startTransition(async () => {
      const result = await resetSessionProcessing(sessionId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Processing state cleared")
      setConfirmOpen(false)
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
          <DropdownMenuLabel>Session processing</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setConfirmOpen(true)}>
            <RotateCcw className="size-4" />
            Reset processing state
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Reset session processing state?"
        description="Clears processing_status, processing_error, and processed_at on this session so a stuck scoring run can be retried. Responses, position, and status are not touched."
        confirmLabel="Reset processing"
        cancelLabel="Cancel"
        variant="default"
        onConfirm={handleReset}
        loading={isPending}
        loadingLabel="Resetting…"
      />
    </>
  )
}
