"use client"

import { useState, useTransition, useRef } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { updateDisplayName } from "@/app/actions/profile"

interface ProfileFormProps {
  email: string
  displayName?: string | null
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

export function ProfileForm({ email, displayName }: ProfileFormProps) {
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
    </div>
  )
}
