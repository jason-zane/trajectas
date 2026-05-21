"use client"

import { useState, useTransition, useRef } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { updateDisplayName } from "@/app/actions/profile"
import {
  cancelAccountDeletion,
  requestAccountDeletion,
} from "@/app/actions/account-deletion"

interface ProfileFormProps {
  email: string
  displayName?: string | null
  scheduledDeletionAt: string | null
}

type SaveState = "idle" | "saving" | "saved"

function getInitials(displayName: string | null | undefined, email: string) {
  const source = displayName || email
  return (
    source
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "TF"
  )
}

function formatDeletionDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function ProfileForm({ email, displayName, scheduledDeletionAt }: ProfileFormProps) {
  const [name, setName] = useState(displayName ?? "")
  const [savedName, setSavedName] = useState(displayName ?? "")
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [isPending, startTransition] = useTransition()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDirty = name !== savedName
  const initials = getInitials(name || null, email)

  const saveLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "saved"
        ? "Saved"
        : "Save Changes"

  function handleSave() {
    setSaveState("saving")
    startTransition(async () => {
      const result = await updateDisplayName(name.trim())

      if (result.error) {
        toast.error(result.error)
        setSaveState("idle")
        return
      }

      setSavedName(name.trim())
      setName(name.trim())
      toast.success("Profile updated")
      setSaveState("saved")

      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000)
    })
  }

  return (
    <div className="mt-6 max-w-lg space-y-6">
      {/* Avatar preview */}
      <div className="flex items-center gap-4">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-semibold select-none"
          aria-hidden="true"
        >
          {initials}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {name || "No display name"}
          </p>
          <p className="text-caption text-muted-foreground">{email}</p>
        </div>
      </div>

      {/* Form card */}
      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="cursor-not-allowed"
            />
            <p className="text-caption text-muted-foreground">
              Email address cannot be changed here.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={!isDirty || isPending || saveState === "saved"}
              size="sm"
            >
              {saveLabel}
            </Button>
          </div>
        </CardContent>
      </Card>

      <DangerZone scheduledDeletionAt={scheduledDeletionAt} />
    </div>
  )
}

function DangerZone({ scheduledDeletionAt }: { scheduledDeletionAt: string | null }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const pendingDeletion = Boolean(scheduledDeletionAt)

  function handleRequest() {
    startTransition(async () => {
      const result = await requestAccountDeletion()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setConfirmOpen(false)
      toast.success("Account deletion scheduled. Check your email for confirmation.")
    })
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelAccountDeletion()
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Account deletion cancelled.")
    })
  }

  return (
    <>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingDeletion ? (
            <>
              <p className="text-sm text-foreground">
                Your account is scheduled for permanent deletion on{" "}
                <strong>{formatDeletionDate(scheduledDeletionAt!)}</strong>. All your
                profile data and associated records will be removed.
              </p>
              <p className="text-caption text-muted-foreground">
                You can cancel any time before that date.
              </p>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  {isPending ? "Cancelling…" : "Cancel deletion"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Deleting your account will permanently remove your profile and
                associated data after a 30-day grace period. You can cancel during
                that period by signing back in.
              </p>
              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={isPending}
                >
                  Delete my account
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete your account?"
        description="This will schedule your Trajectas account for permanent deletion in 30 days. You can cancel any time during the grace period by signing back in."
        confirmLabel="Schedule deletion"
        cancelLabel="Keep my account"
        variant="destructive"
        onConfirm={handleRequest}
        loading={isPending}
        loadingLabel="Scheduling…"
      />
    </>
  )
}
