"use client"

import { useState, useCallback, useEffect, useTransition, useRef } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { ColorPicker } from "@/components/brand-editor/color-picker"
import { FontSelector } from "@/components/brand-editor/font-selector"
import { RadiusSelector } from "@/components/brand-editor/radius-selector"
import { PreviewGallery } from "@/components/brand-editor/preview-gallery"
import { upsertBrandConfig, resetBrandToDefault } from "@/app/actions/brand"
import { HEADING_BODY_FONTS, MONO_FONTS, buildGoogleFontsUrl } from "@/lib/brand/fonts"
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults"
import type { BrandConfig, BrandConfigRecord, NeutralTemperature, BorderRadiusPreset } from "@/lib/brand/types"
import { cn } from "@/lib/utils"

interface BrandEditorProps {
  initialRecord: BrandConfigRecord | null
}

type SaveState = "idle" | "saving" | "saved"

export function BrandEditor({ initialRecord }: BrandEditorProps) {
  const initialConfig = initialRecord?.config ?? { ...TALENT_FIT_DEFAULTS }

  const [config, setConfig] = useState<BrandConfig>(initialConfig)
  const [savedConfig, setSavedConfig] = useState<BrandConfig>(initialConfig)
  const [isPending, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [showResetDialog, setShowResetDialog] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Dirty detection
  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig)
  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(isDirty)

  // Inject Google Fonts for selected fonts
  useEffect(() => {
    const fontNames = [config.headingFont, config.bodyFont]
    const url = buildGoogleFontsUrl(fontNames)
    if (!url) return

    // Check if we already have this link
    const existingLink = document.querySelector(`link[data-brand-fonts]`)
    if (existingLink) {
      existingLink.setAttribute("href", url)
      return
    }

    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = url
    link.setAttribute("data-brand-fonts", "true")
    document.head.appendChild(link)

    return () => {
      // Don't remove on cleanup — we want fonts to persist while editing
    }
  }, [config.headingFont, config.bodyFont])

  // Update helpers
  const update = useCallback((partial: Partial<BrandConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
  }, [])

  // Save
  const handleSave = useCallback(() => {
    setSaveState("saving")
    startTransition(async () => {
      const result = await upsertBrandConfig("platform", null, config)
      if (result.error) {
        const messages = Object.values(result.error).flat()
        toast.error(messages[0] || "Failed to save brand settings")
        setSaveState("idle")
        return
      }

      toast.success("Brand settings saved")
      setSavedConfig(config)
      setSaveState("saved")

      // Reset to idle after 2s
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000)
    })
  }, [config, startTransition])

  // Reset
  const handleReset = useCallback(() => {
    setConfig({ ...TALENT_FIT_DEFAULTS })
    setShowResetDialog(false)
    toast.success("Reset to defaults — save to persist")
  }, [])

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

  const neutralOptions: { value: NeutralTemperature; label: string }[] = [
    { value: "warm", label: "Warm" },
    { value: "neutral", label: "Neutral" },
    { value: "cool", label: "Cool" },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Brand"
        description="Configure the visual identity for assessments, reports, and emails."
      />

      <div className="flex gap-8 items-start">
        {/* Controls panel — left */}
        <div className="w-[360px] shrink-0 space-y-6">
          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brand-name">Brand Name</Label>
                <Input
                  id="brand-name"
                  value={config.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Talent Fit"
                />
              </div>
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-xs text-muted-foreground">
                  Logo upload coming soon
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader>
              <CardTitle>Colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <ColorPicker
                label="Primary Color"
                description="Main brand color for buttons, accents, and highlights."
                value={config.primaryColor}
                onChange={(hex) => update({ primaryColor: hex })}
              />
              <ColorPicker
                label="Accent Color"
                description="Secondary color for premium moments and charts."
                value={config.accentColor}
                onChange={(hex) => update({ accentColor: hex })}
              />

              {/* Neutral temperature */}
              <div className="space-y-2">
                <Label>Neutral Temperature</Label>
                <p className="text-caption text-muted-foreground">
                  Controls the subtle hue tint in backgrounds, borders, and muted text.
                </p>
                <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
                  {neutralOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update({ neutralTemperature: opt.value })}
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
            </CardContent>
          </Card>

          {/* Typography */}
          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FontSelector
                label="Heading Font"
                value={config.headingFont}
                onChange={(name) => update({ headingFont: name })}
                fonts={HEADING_BODY_FONTS}
              />
              <FontSelector
                label="Body Font"
                value={config.bodyFont}
                onChange={(name) => update({ bodyFont: name })}
                fonts={HEADING_BODY_FONTS}
              />
            </CardContent>
          </Card>

          {/* Shape */}
          <Card>
            <CardHeader>
              <CardTitle>Shape</CardTitle>
            </CardHeader>
            <CardContent>
              <RadiusSelector
                value={config.borderRadius}
                onChange={(v: BorderRadiusPreset) => update({ borderRadius: v })}
                previewColor={config.primaryColor}
              />
            </CardContent>
          </Card>

          {/* Dark Mode */}
          <Card>
            <CardHeader>
              <CardTitle>Dark Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable Dark Mode</p>
                  <p className="text-caption text-muted-foreground">
                    Allow candidates to use dark mode based on system preference.
                  </p>
                </div>
                <Switch
                  checked={config.darkModeEnabled}
                  onCheckedChange={(checked: boolean) =>
                    update({ darkModeEnabled: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-3 pb-8">
            <Button
              onClick={handleSave}
              disabled={!isDirty || saveState === "saving" || saveState === "saved"}
            >
              {saveLabel}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(true)}
              disabled={isPending}
            >
              Reset to Defaults
            </Button>
          </div>
        </div>

        {/* Preview gallery — right */}
        <div className="flex-1 min-w-0 sticky top-6">
          <PreviewGallery config={config} />
        </div>
      </div>

      {/* Unsaved changes dialog */}
      <ConfirmDialog
        open={showDialog}
        onOpenChange={cancelNavigation}
        title="Unsaved Changes"
        description="You have unsaved brand changes. Are you sure you want to leave? Your changes will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={confirmNavigation}
      />

      {/* Reset confirmation dialog */}
      <ConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="Reset to Defaults"
        description="This will replace all brand settings with the TalentFit defaults. You'll still need to save to persist the change."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={handleReset}
      />
    </div>
  )
}
