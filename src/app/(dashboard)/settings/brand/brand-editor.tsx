"use client"

import { useState, useCallback, useEffect, useTransition, useRef } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { ColorPicker } from "@/components/brand-editor/color-picker"
import { FontSelector } from "@/components/brand-editor/font-selector"
import { RadiusSelector } from "@/components/brand-editor/radius-selector"
import { PortalAccentEditor } from "@/components/brand-editor/portal-accent-editor"
import { TaxonomyColorEditor } from "@/components/brand-editor/taxonomy-color-editor"
import { EmailStyleEditor } from "@/components/brand-editor/email-style-editor"
import { PreviewGallery } from "@/components/brand-editor/preview-gallery"
import { upsertBrandConfig } from "@/app/actions/brand"
import { HEADING_BODY_FONTS, buildGoogleFontsUrl } from "@/lib/brand/fonts"
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults"
import type {
  BrandConfig,
  BrandConfigRecord,
  NeutralTemperature,
  BorderRadiusPreset,
  PortalAccents,
  TaxonomyColors,
  EmailStyleColors,
  SemanticColors,
} from "@/lib/brand/types"
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
        description="Configure the visual identity for the dashboard, assessments, reports, and emails."
      />

      <div className="flex gap-8 items-start">
        {/* Controls panel — left */}
        <div className="w-[380px] shrink-0 space-y-6">
          <Tabs defaultValue="identity">
            <TabsList variant="line" className="w-full flex-wrap gap-0.5">
              <TabsTrigger value="identity">Identity</TabsTrigger>
              <TabsTrigger value="colors">Colors</TabsTrigger>
              <TabsTrigger value="portals">Portals</TabsTrigger>
              <TabsTrigger value="taxonomy">Taxonomy</TabsTrigger>
              <TabsTrigger value="typography">Type</TabsTrigger>
              <TabsTrigger value="shape">Shape</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
            </TabsList>

            {/* --- Identity --- */}
            <TabsContent value="identity">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Brand Identity</CardTitle>
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
            </TabsContent>

            {/* --- Colors --- */}
            <TabsContent value="colors">
              <Card className="mt-4">
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
                  <ColorPicker
                    label="Sidebar Color"
                    description="Background color for the sidebar. Defaults to primary."
                    value={config.sidebarColor || config.primaryColor}
                    onChange={(hex) => update({ sidebarColor: hex })}
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

                  {/* Semantic colors */}
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <Label>Semantic Colors</Label>
                    <ColorPicker
                      label="Destructive"
                      description="Error states and delete actions."
                      value={config.semanticColors?.destructive || "#c53030"}
                      onChange={(hex) =>
                        update({
                          semanticColors: {
                            destructive: hex,
                            success: config.semanticColors?.success || "#2f855a",
                            warning: config.semanticColors?.warning || "#c27803",
                          },
                        })
                      }
                    />
                    <ColorPicker
                      label="Success"
                      description="Confirmation and positive states."
                      value={config.semanticColors?.success || "#2f855a"}
                      onChange={(hex) =>
                        update({
                          semanticColors: {
                            destructive: config.semanticColors?.destructive || "#c53030",
                            success: hex,
                            warning: config.semanticColors?.warning || "#c27803",
                          },
                        })
                      }
                    />
                    <ColorPicker
                      label="Warning"
                      description="Caution and attention states."
                      value={config.semanticColors?.warning || "#c27803"}
                      onChange={(hex) =>
                        update({
                          semanticColors: {
                            destructive: config.semanticColors?.destructive || "#c53030",
                            success: config.semanticColors?.success || "#2f855a",
                            warning: hex,
                          },
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- Portal Accents --- */}
            <TabsContent value="portals">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Portal Accents</CardTitle>
                  <p className="text-caption text-muted-foreground">
                    Each portal context uses its own accent color for the primary button, ring, and sidebar highlight. These override the base primary color per portal.
                  </p>
                </CardHeader>
                <CardContent>
                  <PortalAccentEditor
                    value={config.portalAccents}
                    onChange={(accents: PortalAccents) => update({ portalAccents: accents })}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- Taxonomy --- */}
            <TabsContent value="taxonomy">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Taxonomy Colors</CardTitle>
                  <p className="text-caption text-muted-foreground">
                    Each level of the assessment taxonomy gets a unique color for cards, badges, and accents. A bg/fg/accent scale is auto-generated from each base color.
                  </p>
                </CardHeader>
                <CardContent>
                  <TaxonomyColorEditor
                    value={config.taxonomyColors}
                    onChange={(colors: TaxonomyColors) => update({ taxonomyColors: colors })}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- Typography --- */}
            <TabsContent value="typography">
              <Card className="mt-4">
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
            </TabsContent>

            {/* --- Shape & Surface --- */}
            <TabsContent value="shape">
              <div className="mt-4 space-y-6">
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
              </div>
            </TabsContent>

            {/* --- Email Styling --- */}
            <TabsContent value="email">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Email Styling</CardTitle>
                  <p className="text-caption text-muted-foreground">
                    Customize text colors for branded email templates. The header background always uses the primary brand color.
                  </p>
                </CardHeader>
                <CardContent>
                  <EmailStyleEditor
                    value={config.emailStyles}
                    onChange={(styles: EmailStyleColors) => update({ emailStyles: styles })}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

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
