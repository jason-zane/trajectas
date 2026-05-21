"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { adminResetParticipantSession } from "@/app/(dashboard)/admin/actions"

export function ResetSessionButton({ sessionId }: { sessionId: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [resetAt, setResetAt] = useState<Date | null>(null)

  function handleConfirm() {
    startTransition(async () => {
      const result = await adminResetParticipantSession(sessionId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setConfirmOpen(false)
      setResetAt(new Date())
      toast.success("Processing state cleared")
    })
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
        >
          Reset processing state
        </Button>
        {resetAt ? (
          <span className="text-caption text-muted-foreground">
            Reset {resetAt.toLocaleTimeString()}
          </span>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Reset session processing state?"
        description="This clears processing_status, processing_error, and processed_at on the session so a stuck scoring run can be retried. Responses, position, and status are not touched. Use when a session is completed but processing_status='failed'."
        confirmLabel="Reset processing"
        cancelLabel="Cancel"
        variant="default"
        onConfirm={handleConfirm}
        loading={isPending}
        loadingLabel="Resetting…"
      />
    </>
  )
}
