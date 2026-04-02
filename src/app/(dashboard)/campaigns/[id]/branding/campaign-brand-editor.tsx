"use client"

import { useState, useCallback, useEffect, useTransition, useRef } from "react"
import { toast } from "sonner"
import { Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { cn } from "@/lib/utils"
import { ColorPicker } from "@/components/brand-editor/color-picker"
import { PreviewGallery } from "@/components/brand-editor/preview-gallery"
import { LogoUploader } from "@/components/brand-editor/logo-uploader"
import { upsertBrandConfig, resetBrandToDefault } from "@/app/actions/brand"
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults"
import type { BrandConfig, BrandConfigRecord, NeutralTemperature } from "@/lib/brand/types"

interface CampaignBrandEditorProps {
  campaignId: string
  campaignTitle: string
  organizationName?: string
  initialRecord: BrandConfigRecord | null
  inheritedBrand: BrandConfig
}

type SaveState = "idle" | "saving" | "saved"

export function CampaignBrandEditor({
  campaignId,
  campaignTitle,
  organizationName,
  initialRecord,
  inheritedBrand,
}: CampaignBrandEditorProps) {
  const hasCustomBrand = initialRecord !== null
  const initialConfig = initialRecord?.config ?? { ...inheritedBrand }

  const [customEnabled, setCustomEnabled] = useState(hasCustomBrand)
  const [config, setConfig] = useState<BrandConfig>(initialConfig)
  const [savedConfig, setSavedConfig] = useState<BrandConfig>(initialConfig)
  const [savedCustomEnabled, setSavedCustomEnabled] = useState(hasCustomBrand)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [, startTransition] = useTransition()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDirty =
    customEnabled !== savedCustomEnabled ||
    (customEnabled && JSON.stringify(config) !== JSON.stringify(savedConfig))

  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(isDirty)

  const handleSave = useCallback(() => {
    setSaveState("saving")
    startTransition(async () => {
      if (!customEnabled) {
        await resetBrandToDefault("campaign", campaignId)
        toast.success("Campaign branding reset to inherited")
        setSavedCustomEnabled(false)
        setSavedConfig({ ...inheritedBrand })
        setConfig({ ...inheritedBrand })
      } else {
        const result = await upsertBrandConfig("campaign", campaignId, config)
        if (result.error) {
          const messages = Object.values(result.error).flat()
          toast.error(messages[0] || "Failed to save branding")
          setSaveState("idle")
          return
        }
        toast.success("Campaign branding saved")
        setSavedConfig(config)
        setSavedCustomEnabled(true)
      }

      setSaveState("saved")
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000)
    })
  }, [config, customEnabled, campaignId, inheritedBrand, startTransition])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  // Inherited brand source label
  const inheritedFrom = inheritedBrand.name !== TALENT_FIT_DEFAULTS.name
    ? organizationName ?? "Organisation"
    : "TalentFit (platform default)"

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
                  <p className="text-sm font-medium truncate">{inheritedFrom}</p>
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
                    if (checked && !hasCustomBrand) {
                      setConfig({ ...inheritedBrand })
                    }
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {customEnabled
                  ? "This campaign uses its own branding across the runner and reports."
                  : `Using branding from ${inheritedFrom}.`}
              </p>
            </CardHeader>
          </Card>

          {customEnabled && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Identity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="brand-name">Display Name</Label>
                    <Input
                      id="brand-name"
                      value={config.name ?? ""}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder={campaignTitle}
                    />
                    <p className="text-xs text-muted-foreground">
                      Shown in the runner header and reports.
                    </p>
                  </div>
                  <LogoUploader
                    label="Logo"
                    description="Displayed in the runner header and on report cover pages."
                    value={config.logoUrl}
                    ownerType="campaign"
                    ownerId={campaignId}
                    onChange={(url) =>
                      setConfig((prev) => ({ ...prev, logoUrl: url }))
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Colors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ColorPicker
                    label="Primary Color"
                    description="Buttons, progress bars, and selection states."
                    value={config.primaryColor}
                    onChange={(hex) =>
                      setConfig((prev) => ({ ...prev, primaryColor: hex }))
                    }
                  />
                  <ColorPicker
                    label="Accent Color"
                    description="Secondary highlights and decorative elements."
                    value={config.accentColor}
                    onChange={(hex) =>
                      setConfig((prev) => ({ ...prev, accentColor: hex }))
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Surfaces</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Neutral temperature */}
                  <div className="space-y-2">
                    <Label>Neutral Temperature</Label>
                    <p className="text-caption text-muted-foreground">
                      Controls the hue tint of backgrounds, borders, and muted text.
                    </p>
                    <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
                      {neutralOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              neutralTemperature: opt.value,
                            }))
                          }
                          className={cn(
                            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200",
                            config.neutralTemperature === opt.value
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Page background */}
                  <div>
                    <ColorPicker
                      label="Page Background"
                      description="Main page surface color. Leave empty to derive from neutral temperature."
                      value={config.backgroundColor || "#f5f5f4"}
                      onChange={(hex) =>
                        setConfig((prev) => ({ ...prev, backgroundColor: hex }))
                      }
                    />
                    {config.backgroundColor && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({ ...prev, backgroundColor: undefined }))
                        }
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Use neutral temperature instead
                      </button>
                    )}
                  </div>

                  {/* Card background */}
                  <div>
                    <ColorPicker
                      label="Card Background"
                      description="Card and popover surfaces. Leave empty for white."
                      value={config.cardColor || "#ffffff"}
                      onChange={(hex) =>
                        setConfig((prev) => ({ ...prev, cardColor: hex }))
                      }
                    />
                    {config.cardColor && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({ ...prev, cardColor: undefined }))
                        }
                        className="mt-2 text-xs text-primary hover:underline"
                      >
                        Reset to white
                      </button>
                    )}
                  </div>
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
            config={customEnabled ? config : inheritedBrand}
            surfaces={["welcome", "questions", "complete"]}
            brandName={(customEnabled ? config : inheritedBrand).name}
            logoUrl={(customEnabled ? config : inheritedBrand).logoUrl}
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
