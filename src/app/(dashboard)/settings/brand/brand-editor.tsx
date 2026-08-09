"use client"

import { useState, useCallback, useEffect, useTransition, useRef } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { ColorPicker } from "@/components/brand-editor/color-picker"
import { FontSelector } from "@/components/brand-editor/font-selector"
import { RadiusSelector } from "@/components/brand-editor/radius-selector"
import { RunnerThemeSelector } from "@/components/brand-editor/runner-theme-selector"
import { SurfaceRoleEditor } from "@/components/brand-editor/surface-role-editor"
import { RunnerAnchorEditor } from "@/components/brand-editor/runner-anchor-editor"
import { PortalAccentEditor } from "@/components/brand-editor/portal-accent-editor"
import { TaxonomyColorEditor } from "@/components/brand-editor/taxonomy-color-editor"
import { EmailStyleEditor } from "@/components/brand-editor/email-style-editor"
import { LogoUploader } from "@/components/brand-editor/logo-uploader"
import { ReportThemeEditor } from "@/components/brand-editor/report-theme-editor"
import { PreviewGallery } from "@/components/brand-editor/preview-gallery"
import { TypeScaleSelector } from "@/components/brand-editor/type-scale-selector"
import { DensitySelector } from "@/components/brand-editor/density-selector"
import { ButtonStyleEditor } from "@/components/brand-editor/button-style-editor"
import { GradientEditor } from "@/components/brand-editor/gradient-editor"
import { ContrastWarnings } from "@/components/brand-editor/contrast-warnings"
import { upsertBrandConfig } from "@/app/actions/brand"
import { HEADING_BODY_FONTS, buildGoogleFontsUrl } from "@/lib/brand/fonts"
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults"
import { mergeBrandLayers } from "@/lib/brand/merge"
import type {
  BrandConfig,
  BrandConfigRecord,
  NeutralTemperature,
  BorderRadiusPreset,
  PortalAccents,
  TaxonomyColors,
  EmailStyleColors,
} from "@/lib/brand/types"
import { DEFAULT_REPORT_THEME } from "@/lib/reports/presentation"
import { cn } from "@/lib/utils"

interface BrandEditorProps {
  initialRecord: BrandConfigRecord | null
}

type SaveState = "idle" | "saving" | "saved"

/** Deep clone to avoid readonly reference leaks from defaults. */
function cloneConfig(config: BrandConfig): BrandConfig {
  return JSON.parse(JSON.stringify(config))
}

export function BrandEditor({ initialRecord }: BrandEditorProps) {
  // Initialize with mergeBrandLayers to fill defaults for new fields
  const initialConfig = mergeBrandLayers([initialRecord?.config])

  const [config, setConfig] = useState<BrandConfig>(cloneConfig(initialConfig))
  const [savedConfig, setSavedConfig] = useState<BrandConfig>(cloneConfig(initialConfig))
  const [isPending, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [showResetDialog, setShowResetDialog] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig)
  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(isDirty)

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

  const update = useCallback((partial: Partial<BrandConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
  }, [setConfig])

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
      setSavedConfig(cloneConfig(config))
      setSaveState("saved")

      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000)
    })
  }, [config, startTransition])

  const handleReset = useCallback(() => {
    setConfig(cloneConfig(TRAJECTAS_DEFAULTS as BrandConfig))
    setShowResetDialog(false)
    toast.success("Reset to defaults — save to persist")
  }, [setConfig, setShowResetDialog])

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
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <PageHeader
          eyebrow="Settings"
          title="Brand"
          description="Configure the visual identity for the dashboard, assessments, reports, and emails."
        />
        <div className="flex items-center gap-3 shrink-0 pb-1">
          <Button
            variant="outline"
            onClick={() => setShowResetDialog(true)}
            disabled={isPending}
            size="sm"
          >
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isDirty || saveState === "saving" || saveState === "saved"}
            size="sm"
          >
            {saveLabel}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="colors">
        <TabsList variant="line">
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="surfaces">Surfaces</TabsTrigger>
          <TabsTrigger value="portals">Portals</TabsTrigger>
          <TabsTrigger value="taxonomy">Taxonomy</TabsTrigger>
          <TabsTrigger value="typography">Typography</TabsTrigger>
          <TabsTrigger value="shape">Shape</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="identity">
          <div className="mt-6 grid gap-6 md:grid-cols-2 max-w-3xl">
            <Card>
              <CardHeader>
                <CardTitle>Brand Name</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  id="brand-name"
                  value={config.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Trajectas"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Logo</CardTitle>
              </CardHeader>
              <CardContent>
                <LogoUploader
                  label="Logo"
                  description="Displayed in the dashboard, reports, and portal previews."
                  value={config.logoUrl}
                  ownerType="platform"
                  ownerId={null}
                  onChange={(url) => update({ logoUrl: url })}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="colors">
          <div className="mt-6 space-y-6 max-w-5xl">
            {/* Contrast warnings at top of colors tab */}
            <ContrastWarnings config={config} />

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Primary</CardTitle>
                </CardHeader>
                <CardContent>
                  <ColorPicker
                    label="Primary Color"
                    description="Main brand color — buttons, accents, highlights."
                    value={config.primaryColor}
                    onChange={(hex) => update({ primaryColor: hex })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Accent</CardTitle>
                </CardHeader>
                <CardContent>
                  <ColorPicker
                    label="Accent Color"
                    description="Premium moments, charts, gold highlights."
                    value={config.accentColor}
                    onChange={(hex) => update({ accentColor: hex })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Secondary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <ColorPicker
                      label="Secondary Color (Optional)"
                      description="Optional palette expansion — leave empty to disable."
                      value={config.secondaryColor || ""}
                      onChange={(hex) =>
                        update({ secondaryColor: hex || undefined })
                      }
                    />
                    {config.secondaryColor && (
                      <button
                        type="button"
                        onClick={() => update({ secondaryColor: undefined })}
                        className="text-xs text-primary hover:underline"
                      >
                        Clear secondary color
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sidebar</CardTitle>
                </CardHeader>
                <CardContent>
                  <ColorPicker
                    label="Sidebar Color"
                    description="Navigation sidebar background."
                    value={config.sidebarColor || config.primaryColor}
                    onChange={(hex) => update({ sidebarColor: hex })}
                  />
                </CardContent>
              </Card>

              <Card className="md:col-span-2 lg:col-span-3">
                <CardHeader>
                  <CardTitle>Semantic Colors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-5 md:grid-cols-3">
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
                      description="Confirmation, positive states."
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

              {/* Gradient editor in colors tab */}
              <Card className="md:col-span-2 lg:col-span-3">
                <CardHeader>
                  <CardTitle>Gradient Accent</CardTitle>
                </CardHeader>
                <CardContent>
                  <GradientEditor
                    value={config.gradientAccent}
                    onChange={(gradient) => update({ gradientAccent: gradient })}
                    primaryColor={config.primaryColor}
                    accentColor={config.accentColor}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="surfaces">
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl">
            <Card>
              <CardHeader>
                <CardTitle>Neutral Temperature</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-caption text-muted-foreground">
                  Controls the overall hue tint of backgrounds, borders, cards, and muted text across the entire dashboard.
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Background</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cards</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Surface Roles</CardTitle>
                <p className="text-caption text-muted-foreground">
                  Surfaces, body text and borders across the runner, reports and
                  emails. Derived from neutral temperature unless pinned.
                </p>
              </CardHeader>
              <CardContent>
                <SurfaceRoleEditor
                  config={config}
                  value={config.surfaceColors}
                  onChange={(surfaceColors) => update({ surfaceColors })}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="portals">
          <div className="mt-6 max-w-xl">
            <Card>
              <CardHeader>
                <CardTitle>Portal Accents</CardTitle>
                <p className="text-caption text-muted-foreground">
                  Each portal context uses its own accent color for buttons, rings, and sidebar highlights. These override the base primary per portal.
                </p>
              </CardHeader>
              <CardContent>
                <PortalAccentEditor
                  value={config.portalAccents}
                  onChange={(accents: PortalAccents) => update({ portalAccents: accents })}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="taxonomy">
          <div className="mt-6 max-w-xl">
            <Card>
              <CardHeader>
                <CardTitle>Taxonomy Colors</CardTitle>
                <p className="text-caption text-muted-foreground">
                  Each hierarchy level gets a unique color for cards, badges, and accents. A bg/fg/accent scale is auto-generated from each base color.
                </p>
              </CardHeader>
              <CardContent>
                <TaxonomyColorEditor
                  value={config.taxonomyColors}
                  onChange={(colors: TaxonomyColors) => update({ taxonomyColors: colors })}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="typography">
          <div className="mt-6 grid gap-6 md:grid-cols-2 max-w-5xl">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Type Scale & Weights</CardTitle>
              </CardHeader>
              <CardContent>
                <TypeScaleSelector
                  value={config.typography}
                  onChange={(settings) => update({ typography: settings })}
                  seedConfig={config}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Heading Font</CardTitle>
              </CardHeader>
              <CardContent>
                <FontSelector
                  label="Heading Font"
                  value={config.headingFont}
                  onChange={(name) => update({ headingFont: name })}
                  fonts={HEADING_BODY_FONTS}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Body Font</CardTitle>
              </CardHeader>
              <CardContent>
                <FontSelector
                  label="Body Font"
                  value={config.bodyFont}
                  onChange={(name) => update({ bodyFont: name })}
                  fonts={HEADING_BODY_FONTS}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="shape">
          <div className="mt-6 space-y-6 max-w-3xl">
            <Card>
              <CardHeader>
                <CardTitle>Border Radius</CardTitle>
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
                <CardTitle>Spacing Density</CardTitle>
              </CardHeader>
              <CardContent>
                <DensitySelector
                  value={config.spacingDensity}
                  onChange={(density) => update({ spacingDensity: density })}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Button Style</CardTitle>
              </CardHeader>
              <CardContent>
                <ButtonStyleEditor
                  value={config.buttonStyle}
                  onChange={(style) => update({ buttonStyle: style })}
                  borderRadiusPreset={config.borderRadius}
                  primaryColor={config.primaryColor}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assessment Runner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <RunnerThemeSelector
                  value={config.runnerTheme ?? "dark"}
                  onChange={(theme) => update({ runnerTheme: theme })}
                  config={config}
                />
                <div className="space-y-2 border-t pt-6">
                  <p className="text-caption text-muted-foreground">
                    The four anchors the whole assessment flow is built from.
                    Derived from primary and accent unless pinned.
                  </p>
                  <RunnerAnchorEditor
                    config={config}
                    value={config.runnerAnchors}
                    onChange={(runnerAnchors) => update({ runnerAnchors })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="email">
          <div className="mt-6 max-w-xl">
            <Card>
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
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <ReportThemeEditor
            value={config.reportTheme ?? { ...DEFAULT_REPORT_THEME }}
            onChange={(reportTheme) => setConfig((prev) => ({ ...prev, reportTheme }))}
          />
        </TabsContent>

        <TabsContent value="preview">
          <div className="mt-6">
            <PreviewGallery config={config} />
          </div>
        </TabsContent>
      </Tabs>

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

      <ConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="Reset to Defaults"
        description="This will replace all brand settings with the Trajectas defaults. You'll still need to save to persist the change."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={handleReset}
      />
    </div>
  )
}
