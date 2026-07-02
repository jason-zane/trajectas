"use client"

import { useState, useCallback, useEffect, useTransition, useRef } from "react"
import { toast } from "sonner"
import { Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { cn } from "@/lib/utils"
import { ColorPicker } from "@/components/brand-editor/color-picker"
import { RunnerThemeSelector } from "@/components/brand-editor/runner-theme-selector"
import { OverrideField } from "@/components/brand-editor/override-field"
import { PreviewGallery } from "@/components/brand-editor/preview-gallery"
import { LogoUploader } from "@/components/brand-editor/logo-uploader"
import { ContrastWarnings } from "@/components/brand-editor/contrast-warnings"
import { useBrandOverrides } from "@/components/brand-editor/use-brand-overrides"
import { upsertBrandConfig, resetBrandToDefault } from "@/app/actions/brand"
import type { BrandConfig, BrandConfigRecord, NeutralTemperature } from "@/lib/brand/types"

interface CampaignBrandEditorProps {
  campaignId: string
  campaignTitle: string
  inheritedFrom?: string
  initialRecord: BrandConfigRecord | null
  inheritedBrand: BrandConfig
}

type SaveState = "idle" | "saving" | "saved"

export function CampaignBrandEditor({
  campaignId,
  campaignTitle,
  inheritedFrom,
  initialRecord,
  inheritedBrand,
}: CampaignBrandEditorProps) {
  const [customEnabled, setCustomEnabled] = useState(initialRecord !== null)
  const { overrides, effective, isOverridden, setField, clearField, clearAll } =
    useBrandOverrides({
      inherited: inheritedBrand,
      initialOverrides: initialRecord?.config ?? null,
    })

  const [savedOverrides, setSavedOverrides] = useState(
    JSON.stringify(initialRecord?.config ?? null)
  )
  const [savedCustomEnabled, setSavedCustomEnabled] = useState(initialRecord !== null)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [, startTransition] = useTransition()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDirty =
    customEnabled !== savedCustomEnabled ||
    (customEnabled && JSON.stringify(overrides) !== savedOverrides)

  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(isDirty)

  const handleSave = useCallback(() => {
    setSaveState("saving")
    startTransition(async () => {
      if (!customEnabled) {
        await resetBrandToDefault("campaign", campaignId)
        toast.success("Campaign branding reset to inherited")
        setSavedCustomEnabled(false)
        setSavedOverrides(JSON.stringify(null))
        clearAll()
      } else {
        const result = await upsertBrandConfig("campaign", campaignId, overrides)
        if (result.error) {
          const messages = Object.values(result.error).flat()
          toast.error(messages[0] || "Failed to save branding")
          setSaveState("idle")
          return
        }
        toast.success("Campaign branding saved")
        setSavedOverrides(JSON.stringify(overrides))
        setSavedCustomEnabled(true)
      }

      setSaveState("saved")
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000)
    })
  }, [overrides, customEnabled, campaignId, clearAll, startTransition])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  // Inherited brand source label
  const inheritedSource = inheritedFrom ?? "Trajectas (platform default)"

  const saveLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "saved"
        ? "Saved"
        : "Save Changes"

  const neutralOptions: { value: NeutralTemperature; label: string }[] = [
    { value: "warm", label: "Warm" },
    { value: "neutral", label: "Neutral" },
    { value: "cool", label: "Cool" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex gap-8 items-start">
        {/* Controls panel */}
        <div className="w-[360px] shrink-0 space-y-6">
          {/* Inherited brand context */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Building2 className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Inherits branding from</p>
                  <p className="text-sm font-medium truncate">{inheritedSource}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Custom Branding</CardTitle>
                <Switch
                  checked={customEnabled}
                  onCheckedChange={(checked) => {
                    setCustomEnabled(checked)
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {customEnabled
                  ? "This campaign uses its own branding across the runner and reports."
                  : `Using branding from ${inheritedSource}.`}
              </p>
            </CardHeader>
          </Card>

          {customEnabled && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Contrast</CardTitle>
                </CardHeader>
                <CardContent>
                  <ContrastWarnings config={effective} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Identity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <OverrideField
                    label="Display Name"
                    overridden={isOverridden("name")}
                    onReset={() => clearField("name")}
                    inheritedHint={`Inherited: "${inheritedBrand.name}"`}
                  >
                    <Input
                      value={effective.name ?? ""}
                      onChange={(e) => setField("name", e.target.value)}
                      placeholder={campaignTitle}
                    />
                  </OverrideField>

                  <OverrideField
                    label="Logo"
                    overridden={isOverridden("logoUrl")}
                    onReset={() => clearField("logoUrl")}
                  >
                    <LogoUploader
                      label="Logo"
                      description="Displayed in the runner header and on report cover pages."
                      value={effective.logoUrl}
                      ownerType="campaign"
                      ownerId={campaignId}
                      onChange={(url) => setField("logoUrl", url)}
                    />
                  </OverrideField>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Colors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <OverrideField
                    label="Primary Color"
                    overridden={isOverridden("primaryColor")}
                    onReset={() => clearField("primaryColor")}
                    inheritedHint={`Inherited: ${inheritedBrand.primaryColor}`}
                  >
                    <ColorPicker
                      label="Primary Color"
                      description="Buttons, progress bars, and selection states."
                      value={effective.primaryColor}
                      onChange={(hex) => setField("primaryColor", hex)}
                    />
                  </OverrideField>

                  <OverrideField
                    label="Accent Color"
                    overridden={isOverridden("accentColor")}
                    onReset={() => clearField("accentColor")}
                    inheritedHint={`Inherited: ${inheritedBrand.accentColor}`}
                  >
                    <ColorPicker
                      label="Accent Color"
                      description="Secondary highlights and decorative elements."
                      value={effective.accentColor}
                      onChange={(hex) => setField("accentColor", hex)}
                    />
                  </OverrideField>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Surfaces</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Neutral temperature */}
                  <OverrideField
                    label="Neutral Temperature"
                    overridden={isOverridden("neutralTemperature")}
                    onReset={() => clearField("neutralTemperature")}
                    inheritedHint={`Inherited: ${inheritedBrand.neutralTemperature}`}
                  >
                    <p className="text-caption text-muted-foreground">
                      Controls the hue tint of backgrounds, borders, and muted text.
                    </p>
                    <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
                      {neutralOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setField("neutralTemperature", opt.value)}
                          className={cn(
                            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200",
                            effective.neutralTemperature === opt.value
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </OverrideField>

                  {/* Page background */}
                  <OverrideField
                    label="Page Background"
                    overridden={isOverridden("backgroundColor")}
                    onReset={() => clearField("backgroundColor")}
                  >
                    <ColorPicker
                      label="Page Background"
                      description="Main page surface color. Leave empty to derive from neutral temperature."
                      value={effective.backgroundColor || "#f5f5f4"}
                      onChange={(hex) => setField("backgroundColor", hex)}
                    />
                    {effective.backgroundColor && (
                      <button
                        type="button"
                        onClick={() => setField("backgroundColor", undefined)}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Use neutral temperature instead
                      </button>
                    )}
                  </OverrideField>

                  {/* Card background */}
                  <OverrideField
                    label="Card Background"
                    overridden={isOverridden("cardColor")}
                    onReset={() => clearField("cardColor")}
                  >
                    <ColorPicker
                      label="Card Background"
                      description="Card and popover surfaces. Leave empty for white."
                      value={effective.cardColor || "#ffffff"}
                      onChange={(hex) => setField("cardColor", hex)}
                    />
                    {effective.cardColor && (
                      <button
                        type="button"
                        onClick={() => setField("cardColor", undefined)}
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Reset to white
                      </button>
                    )}
                  </OverrideField>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Assessment Runner</CardTitle>
                </CardHeader>
                <CardContent>
                  <OverrideField
                    label="Theme"
                    overridden={isOverridden("runnerTheme")}
                    onReset={() => clearField("runnerTheme")}
                    inheritedHint={inheritedBrand.runnerTheme ?? "dark"}
                  >
                    <RunnerThemeSelector
                      value={effective.runnerTheme ?? "dark"}
                      onChange={(theme) => setField("runnerTheme", theme)}
                      config={effective}
                    />
                  </OverrideField>
                </CardContent>
              </Card>
            </>
          )}

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

        {/* Preview — show runner and email (contextually relevant for campaigns) */}
        <div className="flex-1 min-w-0 sticky top-6">
          <PreviewGallery
            config={effective}
            surfaces={["welcome", "questions", "complete"]}
            brandName={effective.name}
            logoUrl={effective.logoUrl}
          />
        </div>
      </div>

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
