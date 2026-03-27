"use client"

import { useState, useCallback, useEffect, useTransition, useRef } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { ColorPicker } from "@/components/brand-editor/color-picker"
import { PreviewGallery } from "@/components/brand-editor/preview-gallery"
import { upsertBrandConfig } from "@/app/actions/brand"
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults"
import type { BrandConfig, BrandConfigRecord } from "@/lib/brand/types"
import type { Organization } from "@/types/database"

interface ClientBrandEditorProps {
  organization: Organization
  initialRecord: BrandConfigRecord | null
}

type SaveState = "idle" | "saving" | "saved"

export function ClientBrandEditor({
  organization,
  initialRecord,
}: ClientBrandEditorProps) {
  const initialConfig = initialRecord?.config ?? { ...TALENT_FIT_DEFAULTS }

  // For the client editor, we maintain the full config internally but only
  // expose the primary color control. Other fields stay as inherited defaults.
  const [config, setConfig] = useState<BrandConfig>({
    ...initialConfig,
    name: organization.name,
  })
  const [savedConfig, setSavedConfig] = useState<BrandConfig>({
    ...initialConfig,
    name: organization.name,
  })
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [isPending, startTransition] = useTransition()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig)
  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(isDirty)

  const handleSave = useCallback(() => {
    setSaveState("saving")
    startTransition(async () => {
      const result = await upsertBrandConfig(
        "organization",
        organization.id,
        config
      )
      if (result.error) {
        const messages = Object.values(result.error).flat()
        toast.error(messages[0] || "Failed to save branding")
        setSaveState("idle")
        return
      }

      toast.success("Branding saved")
      setSavedConfig(config)
      setSaveState("saved")

      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000)
    })
  }, [config, organization.id, startTransition])

  // Clean up timer
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const saveLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "saved"
        ? "Saved"
        : "Save Changes"

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={organization.name}
        title="Branding"
        description="Customize the primary color used in assessments and reports for this organisation."
      />

      <div className="flex gap-8 items-start">
        {/* Controls panel — simplified */}
        <div className="w-[360px] shrink-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Primary Color</CardTitle>
            </CardHeader>
            <CardContent>
              <ColorPicker
                label="Brand Color"
                description="Applied to buttons, progress bars, and selection states in assessments."
                value={config.primaryColor}
                onChange={(hex) =>
                  setConfig((prev) => ({ ...prev, primaryColor: hex }))
                }
              />
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 pb-8">
            <Button
              onClick={handleSave}
              disabled={
                !isDirty ||
                saveState === "saving" ||
                saveState === "saved"
              }
            >
              {saveLabel}
            </Button>
          </div>
        </div>

        {/* Preview — runner only */}
        <div className="flex-1 min-w-0 sticky top-6">
          <PreviewGallery config={config} compact />
        </div>
      </div>

      {/* Unsaved changes dialog */}
      <ConfirmDialog
        open={showDialog}
        onOpenChange={cancelNavigation}
        title="Unsaved Changes"
        description="You have unsaved branding changes. Are you sure you want to leave? Your changes will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={confirmNavigation}
      />
    </div>
  )
}
