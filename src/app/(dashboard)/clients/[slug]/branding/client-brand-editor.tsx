"use client"

import { useState, useCallback, useEffect, useTransition, useRef } from "react"
import { toast } from "sonner"
import { Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { cn } from "@/lib/utils"
import { ColorPicker } from "@/components/brand-editor/color-picker"
import { LogoUploader } from "@/components/brand-editor/logo-uploader"
import { FontSelector } from "@/components/brand-editor/font-selector"
import { RadiusSelector } from "@/components/brand-editor/radius-selector"
import { RunnerThemeSelector } from "@/components/brand-editor/runner-theme-selector"
import { OverrideField } from "@/components/brand-editor/override-field"
import { ContrastWarnings } from "@/components/brand-editor/contrast-warnings"
import { PreviewGallery } from "@/components/brand-editor/preview-gallery"
import { useBrandOverrides } from "@/components/brand-editor/use-brand-overrides"
import { upsertBrandConfig } from "@/app/actions/brand"
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults"
import { HEADING_BODY_FONTS, buildGoogleFontsUrl } from "@/lib/brand/fonts"
import type {
  BrandConfig,
  BrandConfigRecord,
  BorderRadiusPreset,
  NeutralTemperature,
} from "@/lib/brand/types"

interface ClientBrandEditorProps {
  clientId: string
  clientName: string
  initialRecord: BrandConfigRecord | null
  inheritedBrand: BrandConfig
}

type SaveState = "idle" | "saving" | "saved"

export function ClientBrandEditor({
  clientId,
  clientName,
  initialRecord,
  inheritedBrand,
}: ClientBrandEditorProps) {
  const { overrides, effective, isOverridden, setField, clearField } =
    useBrandOverrides({
      inherited: inheritedBrand,
      initialOverrides: initialRecord?.config ?? null,
    })

  const [savedOverrides, setSavedOverrides] = useState(
    JSON.stringify(initialRecord?.config ?? null)
  )
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [, startTransition] = useTransition()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDirty = JSON.stringify(overrides) !== savedOverrides
  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(isDirty)

  useEffect(() => {
    const fontNames = Array.from(
      new Set([effective.headingFont, effective.bodyFont, effective.monoFont])
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
  }, [effective.bodyFont, effective.headingFont, effective.monoFont])

  const handleSave = useCallback(() => {
    setSaveState("saving")
    startTransition(async () => {
      const result = await upsertBrandConfig("client", clientId, overrides)
      if (result.error) {
        const messages = Object.values(result.error).flat()
        toast.error(messages[0] || "Failed to save branding")
        setSaveState("idle")
        return
      }

      toast.success("Branding saved")
      setSavedOverrides(JSON.stringify(overrides))
      setSaveState("saved")

      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000)
    })
  }, [clientId, overrides, startTransition])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const inheritedFrom =
    inheritedBrand.name === TRAJECTAS_DEFAULTS.name
      ? "Trajectas (platform default)"
      : inheritedBrand.name

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
        <div className="w-[400px] shrink-0 space-y-6">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Building2 className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Editing client brand</p>
                  <p className="truncate text-sm font-medium">{clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    Inherits from {inheritedFrom}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

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
                  placeholder={clientName}
                />
              </OverrideField>
              <OverrideField
                label="Logo"
                overridden={isOverridden("logoUrl")}
                onReset={() => clearField("logoUrl")}
              >
                <LogoUploader
                  label="Logo"
                  description="Displayed in preview headers and report surfaces."
                  value={effective.logoUrl}
                  ownerType="client"
                  ownerId={clientId}
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
                {isOverridden("backgroundColor") && (
                  <button
                    type="button"
                    onClick={() => clearField("backgroundColor")}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Use neutral temperature instead
                  </button>
                )}
              </OverrideField>

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
                {isOverridden("cardColor") && (
                  <button
                    type="button"
                    onClick={() => clearField("cardColor")}
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
              <CardTitle>Typography</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <OverrideField
                label="Heading Font"
                overridden={isOverridden("headingFont")}
                onReset={() => clearField("headingFont")}
                inheritedHint={`Inherited: ${inheritedBrand.headingFont}`}
              >
                <FontSelector
                  label="Heading Font"
                  value={effective.headingFont}
                  onChange={(fontName) => setField("headingFont", fontName)}
                  fonts={HEADING_BODY_FONTS}
                />
              </OverrideField>
              <OverrideField
                label="Body Font"
                overridden={isOverridden("bodyFont")}
                onReset={() => clearField("bodyFont")}
                inheritedHint={`Inherited: ${inheritedBrand.bodyFont}`}
              >
                <FontSelector
                  label="Body Font"
                  value={effective.bodyFont}
                  onChange={(fontName) => setField("bodyFont", fontName)}
                  fonts={HEADING_BODY_FONTS}
                />
              </OverrideField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shape</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <OverrideField
                label="Border Radius"
                overridden={isOverridden("borderRadius")}
                onReset={() => clearField("borderRadius")}
                inheritedHint={`Inherited: ${inheritedBrand.borderRadius}`}
              >
                <RadiusSelector
                  value={effective.borderRadius}
                  onChange={(radius: BorderRadiusPreset) =>
                    setField("borderRadius", radius)
                  }
                  previewColor={effective.primaryColor}
                />
              </OverrideField>

              <OverrideField
                label="Assessment Runner Theme"
                overridden={isOverridden("runnerTheme")}
                onReset={() => clearField("runnerTheme")}
                inheritedHint={`Inherited: ${inheritedBrand.runnerTheme ?? "dark"}`}
              >
                <RunnerThemeSelector
                  value={effective.runnerTheme ?? "dark"}
                  onChange={(theme) => setField("runnerTheme", theme)}
                  config={effective}
                />
              </OverrideField>
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
            config={effective}
            surfaces={["dashboard", "questions", "report"]}
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
