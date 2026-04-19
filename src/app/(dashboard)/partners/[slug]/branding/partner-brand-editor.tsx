"use client"

import { useState, useCallback, useEffect, useTransition, useRef } from "react"
import { toast } from "sonner"
import { Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { cn } from "@/lib/utils"
import { ColorPicker } from "@/components/brand-editor/color-picker"
import { LogoUploader } from "@/components/brand-editor/logo-uploader"
import { FontSelector } from "@/components/brand-editor/font-selector"
import { RadiusSelector } from "@/components/brand-editor/radius-selector"
import { PreviewGallery } from "@/components/brand-editor/preview-gallery"
import { upsertBrandConfig } from "@/app/actions/brand"
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults"
import { HEADING_BODY_FONTS, buildGoogleFontsUrl } from "@/lib/brand/fonts"
import type {
  BrandConfig,
  BrandConfigRecord,
  BorderRadiusPreset,
  NeutralTemperature,
} from "@/lib/brand/types"

interface PartnerBrandEditorProps {
  partnerId: string
  partnerName: string
  initialRecord: BrandConfigRecord | null
  inheritedBrand: BrandConfig
}

type SaveState = "idle" | "saving" | "saved"

function cloneConfig(config: BrandConfig): BrandConfig {
  return JSON.parse(JSON.stringify(config))
}

export function PartnerBrandEditor({
  partnerId,
  partnerName,
  initialRecord,
  inheritedBrand,
}: PartnerBrandEditorProps) {
  const initialConfig = initialRecord?.config
    ? cloneConfig(initialRecord.config)
    : cloneConfig(inheritedBrand)

  const [config, setConfig] = useState<BrandConfig>(initialConfig)
  const [savedConfig, setSavedConfig] = useState<BrandConfig>(initialConfig)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [, startTransition] = useTransition()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig)
  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(isDirty)

  useEffect(() => {
    const fontNames = Array.from(
      new Set([config.headingFont, config.bodyFont, config.monoFont])
    )
    const url = buildGoogleFontsUrl(fontNames)
    if (!url) return

    const existingLink = document.querySelector<HTMLLinkElement>(
      'link[data-brand-fonts]'
    )
    if (existingLink) {
      existingLink.setAttribute("href", url)
      return
    }

    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = url
    link.setAttribute("data-brand-fonts", "true")
    document.head.appendChild(link)
  }, [config.bodyFont, config.headingFont, config.monoFont])

  const update = useCallback((partial: Partial<BrandConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
  }, [])

  const handleSave = useCallback(() => {
    setSaveState("saving")
    startTransition(async () => {
      const result = await upsertBrandConfig("partner", partnerId, config)
      if (result.error) {
        const messages = Object.values(result.error).flat()
        toast.error(messages[0] || "Failed to save branding")
        setSaveState("idle")
        return
      }

      toast.success("Branding saved")
      setSavedConfig(cloneConfig(config))
      setSaveState("saved")

      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000)
    })
  }, [config, partnerId, startTransition])

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

  const neutralOptions: { value: NeutralTemperature; label: string }[] = [
    { value: "warm", label: "Warm" },
    { value: "neutral", label: "Neutral" },
    { value: "cool", label: "Cool" },
  ]

  const inheritedFrom =
    inheritedBrand.name === TRAJECTAS_DEFAULTS.name
      ? "Trajectas (platform default)"
      : inheritedBrand.name

  return (
    <div className="space-y-6">
      <div className="flex gap-8 items-start">
        <div className="w-[400px] shrink-0 space-y-6">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Building2 className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Editing partner brand</p>
                  <p className="truncate text-sm font-medium">{partnerName}</p>
                  <p className="text-xs text-muted-foreground">
                    Inherits from {inheritedFrom}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brand-name">Display Name</Label>
                <Input
                  id="brand-name"
                  value={config.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder={partnerName}
                />
                <p className="text-xs text-muted-foreground">
                  Shown in the dashboard, reports, and portal surfaces.
                </p>
              </div>
              <LogoUploader
                label="Logo"
                description="Displayed in preview headers and report surfaces."
                value={config.logoUrl}
                ownerType="partner"
                ownerId={partnerId}
                onChange={(url) => update({ logoUrl: url })}
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
                onChange={(hex) => update({ primaryColor: hex })}
              />
              <ColorPicker
                label="Accent Color"
                description="Secondary highlights and decorative elements."
                value={config.accentColor}
                onChange={(hex) => update({ accentColor: hex })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Surfaces</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
                        update({ neutralTemperature: opt.value })
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

              <div>
                <ColorPicker
                  label="Page Background"
                  description="Main page surface color. Leave empty to derive from neutral temperature."
                  value={config.backgroundColor || "#f5f5f4"}
                  onChange={(hex) => update({ backgroundColor: hex })}
                />
                {config.backgroundColor && (
                  <button
                    type="button"
                    onClick={() => update({ backgroundColor: undefined })}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Use neutral temperature instead
                  </button>
                )}
              </div>

              <div>
                <ColorPicker
                  label="Card Background"
                  description="Card and popover surfaces. Leave empty for white."
                  value={config.cardColor || "#ffffff"}
                  onChange={(hex) => update({ cardColor: hex })}
                />
                {config.cardColor && (
                  <button
                    type="button"
                    onClick={() => update({ cardColor: undefined })}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Reset to white
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FontSelector
                label="Heading Font"
                value={config.headingFont}
                onChange={(fontName) => update({ headingFont: fontName })}
                fonts={HEADING_BODY_FONTS}
              />
              <FontSelector
                label="Body Font"
                value={config.bodyFont}
                onChange={(fontName) => update({ bodyFont: fontName })}
                fonts={HEADING_BODY_FONTS}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shape</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadiusSelector
                value={config.borderRadius}
                onChange={(radius: BorderRadiusPreset) =>
                  update({ borderRadius: radius })
                }
                previewColor={config.primaryColor}
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

        <div className="flex-1 min-w-0 sticky top-6">
          <PreviewGallery
            config={config}
            surfaces={["dashboard", "questions", "report"]}
            brandName={config.name}
            logoUrl={config.logoUrl}
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
