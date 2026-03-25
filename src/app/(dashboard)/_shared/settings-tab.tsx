"use client"

import { useState } from "react"
import { Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface SettingsTabProps {
  entityName: string
  isActive: boolean
  onActiveChange: (active: boolean) => void
  onDelete?: () => void
  deleting?: boolean
}

export function SettingsTab({
  entityName,
  isActive,
  onActiveChange,
  onDelete,
  deleting,
}: SettingsTabProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    onDelete?.()
  }

  return (
    <div className="space-y-8">
      {/* Active toggle */}
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="settings-active">Active</Label>
          <p className="text-xs text-muted-foreground">
            Inactive {entityName.toLowerCase()}s are hidden from assessments and
            reports.
          </p>
        </div>
        <Switch
          id="settings-active"
          checked={isActive}
          onCheckedChange={onActiveChange}
        />
      </div>
      <input
        type="hidden"
        name="isActive"
        value={isActive ? "true" : "false"}
      />

      {/* Danger zone */}
      {onDelete && (
        <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            <span className="text-sm font-medium">Danger Zone</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Permanently delete this {entityName.toLowerCase()}. This action
            cannot be undone and may affect linked records.
          </p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="size-4" />
            {confirmDelete
              ? deleting
                ? "Deleting..."
                : "Confirm Delete"
              : `Delete ${entityName}`}
          </Button>
        </div>
      )}
    </div>
  )
}
