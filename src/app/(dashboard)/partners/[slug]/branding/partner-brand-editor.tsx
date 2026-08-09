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
import { SurfaceRoleEditor } from "@/components/brand-editor/surface-role-editor"
import { RunnerAnchorEditor } from "@/components/brand-editor/runner-anchor-editor"
import { OverrideField } from "@/components/brand-editor/override-field"
import { PreviewGallery } from "@/components/brand-editor/preview-gallery"
import { TypeScaleSelector } from "@/components/brand-editor/type-scale-selector"
import { DensitySelector } from "@/components/brand-editor/density-selector"
import { ButtonStyleEditor } from "@/components/brand-editor/button-style-editor"
import { GradientEditor } from "@/components/brand-editor/gradient-editor"
import { ContrastWarnings } from "@/components/brand-editor/contrast-warnings"
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

interface PartnerBrandEditorProps {
  partnerId: string
  partnerName: string
  initialRecord: BrandConfigRecord | null
  inheritedBrand: BrandConfig
}

type SaveState = "idle" | "saving" | "saved"

export function PartnerBrandEditor({
  partnerId,
  partnerName,
  initialRecord,
  inheritedBrand,
}: PartnerBrandEditorProps) {
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
      const result = await upsertBrandConfig("partner", partnerId, overrides)
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
  }, [overrides, partnerId, startTransition])

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
              <OverrideField
                label="Display Name"
                overridden={isOverridden("name")}
                onReset={() => clearField("name")}
                inheritedHint={inheritedBrand.name}
              >
                <Input
                  value={effective.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder={partnerName}
                />
              </OverrideField>

              <OverrideField
                label="Logo"
                overridden={isOverridden("logoUrl")}
                onReset={() => clearField("logoUrl")}
                inheritedHint={
                  inheritedBrand.logoUrl
                    ? "Using inherited logo"
                    : "No logo set in inherited brand"
                }
              >
                <LogoUploader
                  label=""
                  description="Displayed in preview headers and report surfaces."
                  value={effective.logoUrl}
                  ownerType="partner"
                  ownerId={partnerId}
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
                inheritedHint={inheritedBrand.primaryColor}
              >
                <ColorPicker
                  label=""
                  description="Buttons, progress bars, and selection states."
                  value={effective.primaryColor}
                  onChange={(hex) => setField("primaryColor", hex)}
                />
              </OverrideField>

              <OverrideField
                label="Accent Color"
                overridden={isOverridden("accentColor")}
                onReset={() => clearField("accentColor")}
                inheritedHint={inheritedBrand.accentColor}
              >
                <ColorPicker
                  label=""
                  description="Secondary highlights and decorative elements."
                  value={effective.accentColor}
                  onChange={(hex) => setField("accentColor", hex)}
                />
              </OverrideField>

              <OverrideField
                label="Secondary Color"
                overridden={isOverridden("secondaryColor")}
                onReset={() => clearField("secondaryColor")}
                inheritedHint={
                  inheritedBrand.secondaryColor
                    ? inheritedBrand.secondaryColor
                    : "Not set in inherited brand"
                }
              >
                <ColorPicker
                  label=""
                  description="Optional additional accent palette. Leave empty to use primary/accent only."
                  value={effective.secondaryColor || ""}
                  onChange={(hex) => setField("secondaryColor", hex || undefined)}
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
                inheritedHint={inheritedBrand.neutralTemperature}
              >
                <div className="space-y-2">
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
                </div>
              </OverrideField>

              <OverrideField
                label="Page Background"
                overridden={isOverridden("backgroundColor")}
                onReset={() => clearField("backgroundColor")}
                inheritedHint={
                  inheritedBrand.backgroundColor
                    ? inheritedBrand.backgroundColor
                    : "Derives from neutral temperature"
                }
              >
                <div>
                  <ColorPicker
                    label=""
                    description="Main page surface color. Leave empty to derive from neutral temperature."
                    value={effective.backgroundColor || "#f5f5f4"}
                    onChange={(hex) => setField("backgroundColor", hex)}
                  />
                  {effective.backgroundColor && (
                    <button
                      type="button"
                      onClick={() => clearField("backgroundColor")}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Use neutral temperature instead
                    </button>
                  )}
                </div>
              </OverrideField>

              <OverrideField
                label="Card Background"
                overridden={isOverridden("cardColor")}
                onReset={() => clearField("cardColor")}
                inheritedHint={inheritedBrand.cardColor || "White"}
              >
                <div>
                  <ColorPicker
                    label=""
                    description="Card and popover surfaces. Leave empty for white."
                    value={effective.cardColor || "#ffffff"}
                    onChange={(hex) => setField("cardColor", hex)}
                  />
                  {effective.cardColor && (
                    <button
                      type="button"
                      onClick={() => clearField("cardColor")}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Reset to white
                    </button>
                  )}
                </div>
              </OverrideField>

              <OverrideField
                label="Surface Roles"
                overridden={isOverridden("surfaceColors")}
                onReset={() => clearField("surfaceColors")}
              >
                <p className="text-caption text-muted-foreground">
                  Surfaces, body text and borders across the runner, reports and
                  emails. Derived from neutral temperature unless pinned.
                </p>
                <SurfaceRoleEditor
                  config={effective}
                  value={effective.surfaceColors}
                  onChange={(next) =>
                    next
                      ? setField("surfaceColors", next)
                      : clearField("surfaceColors")
                  }
                />
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
                inheritedHint={inheritedBrand.headingFont}
              >
                <FontSelector
                  label=""
                  value={effective.headingFont}
                  onChange={(fontName) => setField("headingFont", fontName)}
                  fonts={HEADING_BODY_FONTS}
                />
              </OverrideField>

              <OverrideField
                label="Body Font"
                overridden={isOverridden("bodyFont")}
                onReset={() => clearField("bodyFont")}
                inheritedHint={inheritedBrand.bodyFont}
              >
                <FontSelector
                  label=""
                  value={effective.bodyFont}
                  onChange={(fontName) => setField("bodyFont", fontName)}
                  fonts={HEADING_BODY_FONTS}
                />
              </OverrideField>

              <OverrideField
                label="Type Scale"
                overridden={isOverridden("typography")}
                onReset={() => clearField("typography")}
                inheritedHint={
                  inheritedBrand.typography?.scale
                    ? inheritedBrand.typography.scale
                    : "default"
                }
              >
                <TypeScaleSelector
                  value={effective.typography}
                  onChange={(settings) => setField("typography", settings)}
                  seedConfig={effective}
                />
              </OverrideField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shape & Layout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <OverrideField
                label="Border Radius"
                overridden={isOverridden("borderRadius")}
                onReset={() => clearField("borderRadius")}
                inheritedHint={inheritedBrand.borderRadius}
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
                label="Spacing Density"
                overridden={isOverridden("spacingDensity")}
                onReset={() => clearField("spacingDensity")}
                inheritedHint={inheritedBrand.spacingDensity ?? "comfortable"}
              >
                <DensitySelector
                  value={effective.spacingDensity ?? "comfortable"}
                  onChange={(density) => setField("spacingDensity", density)}
                />
              </OverrideField>

              <OverrideField
                label="Assessment Runner Theme"
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

              <OverrideField
                label="Assessment Runner Anchors"
                overridden={isOverridden("runnerAnchors")}
                onReset={() => clearField("runnerAnchors")}
              >
                <p className="text-caption text-muted-foreground">
                  The four colours the whole assessment flow is built from.
                  Derived from primary and accent unless pinned.
                </p>
                <RunnerAnchorEditor
                  config={effective}
                  value={effective.runnerAnchors}
                  onChange={(next) =>
                    next
                      ? setField("runnerAnchors", next)
                      : clearField("runnerAnchors")
                  }
                />
              </OverrideField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Buttons & Accents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <OverrideField
                label="Button Style"
                overridden={isOverridden("buttonStyle")}
                onReset={() => clearField("buttonStyle")}
                inheritedHint={
                  inheritedBrand.buttonStyle?.shape
                    ? inheritedBrand.buttonStyle.shape
                    : "inherit"
                }
              >
                <ButtonStyleEditor
                  value={effective.buttonStyle}
                  onChange={(buttonStyle) => setField("buttonStyle", buttonStyle)}
                  borderRadiusPreset={effective.borderRadius}
                  primaryColor={effective.primaryColor}
                />
              </OverrideField>

              <OverrideField
                label="Gradient Accent"
                overridden={isOverridden("gradientAccent")}
                onReset={() => clearField("gradientAccent")}
                inheritedHint={
                  inheritedBrand.gradientAccent?.enabled
                    ? "Enabled"
                    : "Disabled"
                }
              >
                <GradientEditor
                  value={effective.gradientAccent}
                  onChange={(gradientAccent) =>
                    setField("gradientAccent", gradientAccent)
                  }
                  primaryColor={effective.primaryColor}
                  accentColor={effective.accentColor}
                />
              </OverrideField>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 pb-8">
            <Button
              onClick={handleSave}
              disabled={!isDirty || saveState === "saving" || saveState === "saved"}
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
          <ContrastWarnings config={effective} />
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
