"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { adminForceSignOut } from "@/app/(dashboard)/admin/actions"

export function ForceSignOutButton({
  targetProfileId,
  targetEmail,
}: {
  targetProfileId: string
  targetEmail: string
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [signedOutAt, setSignedOutAt] = useState<Date | null>(null)

  function handleConfirm() {
    startTransition(async () => {
      const result = await adminForceSignOut(targetProfileId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setConfirmOpen(false)
      setSignedOutAt(new Date())
      toast.success("Refresh tokens revoked")
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
          Force sign out
        </Button>
        {signedOutAt ? (
          <span className="text-caption text-muted-foreground">
            Signed out {signedOutAt.toLocaleTimeString()}
          </span>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Force sign out everywhere?"
        description={
          <>
            All refresh tokens for <strong>{targetEmail}</strong> will be
            revoked. Their current access tokens stay valid until they
            expire (about an hour), after which they&apos;ll need to sign
            in again via OTP. Use this if you suspect a session has been
            compromised.
          </>
        }
        confirmLabel="Force sign out"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirm}
        loading={isPending}
        loadingLabel="Revoking…"
      />
    </>
  )
}
