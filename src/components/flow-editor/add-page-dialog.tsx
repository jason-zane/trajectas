"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from "@/components/action-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AddPageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (label: string) => void
}

export function AddPageDialog({ open, onOpenChange, onAdd }: AddPageDialogProps) {
  const [label, setLabel] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setLabel("")
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Flow editor"
      title="Add custom page"
      description="Add a custom page to the participant experience flow."
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ActionDialogBody>
          <div className="space-y-2">
            <Label htmlFor="page-name">Page name</Label>
            <Input
              id="page-name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Privacy notice, Instructions"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              This name appears in the sidebar. You can customise the heading and content after adding.
            </p>
          </div>
        </ActionDialogBody>
        <ActionDialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!label.trim()}>
            <Plus className="size-4" />
            Add page
          </Button>
        </ActionDialogFooter>
      </form>
    </ActionDialog>
  )
}
