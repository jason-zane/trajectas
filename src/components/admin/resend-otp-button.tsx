"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { adminResendOtp } from "@/app/(dashboard)/admin/actions"

export function ResendOtpButton({ targetProfileId }: { targetProfileId: string }) {
  const [isPending, startTransition] = useTransition()
  const [sentAt, setSentAt] = useState<Date | null>(null)

  function handleClick() {
    startTransition(async () => {
      const result = await adminResendOtp(targetProfileId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setSentAt(new Date())
      toast.success("OTP email sent")
    })
  }

  return (
    <div className="flex items-center gap-3">
      <Button size="sm" variant="outline" onClick={handleClick} disabled={isPending}>
        {isPending ? "Sending…" : "Resend OTP"}
      </Button>
      {sentAt ? (
        <span className="text-caption text-muted-foreground">
          Last sent {sentAt.toLocaleTimeString()}
        </span>
      ) : null}
    </div>
  )
}
