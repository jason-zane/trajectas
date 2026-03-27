"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useState } from "react"

interface SettingsTabProps {
  entityName: string
  isActive: boolean
  onActiveChange: (active: boolean) => void
  onDelete?: () => void
  deleting?: boolean
  children?: React.ReactNode
}

export function SettingsTab({
  entityName,
  isActive,
  onActiveChange,
  onDelete,
  deleting,
  children,
}: SettingsTabProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

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

      {/* Entity-specific settings (children) */}
      {children}

      {/* Danger zone */}
      {onDelete && (
        <>
          <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              <span className="text-sm font-medium">Danger Zone</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Delete this {entityName.toLowerCase()}. This action may affect
              linked records.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleting}
            >
              Delete {entityName}
            </Button>
          </div>

          <ConfirmDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            title={`Delete ${entityName}?`}
            description={`This will archive the ${entityName.toLowerCase()}. You can undo this action for a few seconds after confirming.`}
            confirmLabel={deleting ? "Deleting..." : "Delete"}
            cancelLabel="Cancel"
            variant="destructive"
            onConfirm={() => {
              setShowDeleteDialog(false)
              onDelete()
            }}
            loading={deleting}
          />
        </>
      )}
    </div>
  )
}
