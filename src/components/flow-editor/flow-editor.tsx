"use client"

import { useState, useTransition, useRef, useCallback } from "react"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { upsertExperienceTemplate, resetExperienceToDefault } from "@/app/actions/experience"
import {
  DEFAULT_PAGE_CONTENT,
  DEFAULT_FLOW_CONFIG,
  DEFAULT_DEMOGRAPHICS_CONFIG,
} from "@/lib/experience/defaults"
import { resolveTemplate } from "@/lib/experience/resolve"
import { FlowSidebar } from "./flow-sidebar"
import { PageContentEditor } from "./page-content-editor"
import { PagePreviewFrame } from "./page-preview-frame"
// FlowPreviewDialog kept as file but replaced by full-page preview in new tab
import { AddPageDialog } from "./add-page-dialog"
import type { BrandConfig } from "@/lib/brand/types"
import type {
  ExperienceTemplateRecord,
  PageContentMap,
  FlowConfig,
  DemographicsConfig,
  ExperiencePageType,
  CustomPageContent,
  CustomPageConfig,
} from "@/lib/experience/types"

interface FlowEditorProps {
  initialRecord: ExperienceTemplateRecord | null
  ownerType?: "platform" | "campaign"
  ownerId?: string | null
  platformTemplate?: ExperienceTemplateRecord | null
  brandConfig?: BrandConfig | null
}

type SaveState = "idle" | "saving" | "saved"

function cloneDeep<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export function FlowEditor({
  initialRecord,
  ownerType = "platform",
  ownerId = null,
  platformTemplate = null,
  brandConfig = null,
}: FlowEditorProps) {
  const isCampaign = ownerType === "campaign"

  // For campaign mode, resolve against platform; for platform, use record or defaults
  const resolved = isCampaign
    ? resolveTemplate(platformTemplate, initialRecord)
    : null

  const initContent = resolved
    ? cloneDeep(resolved.pageContent)
    : initialRecord?.pageContent
      ? cloneDeep(initialRecord.pageContent)
      : cloneDeep(DEFAULT_PAGE_CONTENT as Partial<PageContentMap>)

  const initFlow = resolved
    ? cloneDeep(resolved.flowConfig)
    : initialRecord?.flowConfig
      ? cloneDeep(initialRecord.flowConfig)
      : cloneDeep(DEFAULT_FLOW_CONFIG as Partial<FlowConfig>)

  const initDemo = resolved
    ? cloneDeep(resolved.demographicsConfig)
    : initialRecord?.demographicsConfig
      ? cloneDeep(initialRecord.demographicsConfig)
      : cloneDeep(DEFAULT_DEMOGRAPHICS_CONFIG as DemographicsConfig)

  const initCustom = resolved
    ? cloneDeep(resolved.customPageContent ?? {})
    : cloneDeep(initialRecord?.customPageContent ?? {})

  const initPrivacy = resolved?.privacyUrl ?? initialRecord?.privacyUrl ?? ""
  const initTerms = resolved?.termsUrl ?? initialRecord?.termsUrl ?? ""

  // State
  const [pageContent, setPageContent] = useState<Partial<PageContentMap>>(initContent)
  const [flowConfig, setFlowConfig] = useState<Partial<FlowConfig>>(initFlow)
  const [demographicsConfig, setDemographicsConfig] = useState<DemographicsConfig>(initDemo)
  const [customPageContent, setCustomPageContent] = useState<Record<string, CustomPageContent>>(initCustom)
  const [privacyUrl, setPrivacyUrl] = useState(initPrivacy)
  const [termsUrl, setTermsUrl] = useState(initTerms)

  // Saved snapshots for dirty detection
  const [savedContent, setSavedContent] = useState(initContent)
  const [savedFlow, setSavedFlow] = useState(initFlow)
  const [savedDemo, setSavedDemo] = useState(initDemo)
  const [savedCustom, setSavedCustom] = useState(initCustom)
  const [savedPrivacy, setSavedPrivacy] = useState(initPrivacy)
  const [savedTerms, setSavedTerms] = useState(initTerms)

  const [, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedPageId, setSelectedPageId] = useState("welcome")
  const [showPreview, setShowPreview] = useState(true)
  const [showAddPage, setShowAddPage] = useState(false)
  const [isCustomised, setIsCustomised] = useState(!!initialRecord && isCampaign)

  const isDirty =
    JSON.stringify(pageContent) !== JSON.stringify(savedContent) ||
    JSON.stringify(flowConfig) !== JSON.stringify(savedFlow) ||
    JSON.stringify(demographicsConfig) !== JSON.stringify(savedDemo) ||
    JSON.stringify(customPageContent) !== JSON.stringify(savedCustom) ||
    privacyUrl !== savedPrivacy ||
    termsUrl !== savedTerms

  const { showDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(isDirty)

  // --- Page content updates ---
  const updatePageField = useCallback(
    (page: ExperiencePageType, field: string, value: unknown) => {
      setPageContent((prev) => ({
        ...prev,
        [page]: {
          ...(prev[page] as unknown as Record<string, unknown>),
          [field]: value,
        },
      }))
    },
    []
  )

  const updateFlowEnabled = useCallback((page: keyof FlowConfig, enabled: boolean) => {
    setFlowConfig((prev) => ({
      ...prev,
      [page]: { ...prev[page], enabled },
    }))
  }, [])

  const updateFlowConfig = useCallback((update: Partial<FlowConfig>) => {
    setFlowConfig(update)
  }, [])

  const updateDemographics = useCallback((config: DemographicsConfig) => {
    setDemographicsConfig(config)
  }, [])

  const updateCustomPage = useCallback((id: string, content: CustomPageContent) => {
    setCustomPageContent((prev) => ({ ...prev, [id]: content }))
  }, [])

  const deleteCustomPage = useCallback((id: string) => {
    setCustomPageContent((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setFlowConfig((prev) => ({
      ...prev,
      customPages: (prev.customPages ?? []).filter((cp) => cp.id !== id),
    }))
    setSelectedPageId("welcome")
    toast.success("Custom page deleted")
  }, [])

  // --- Reorder ---
  const handleReorder = useCallback((preIds: string[], postIds: string[]) => {
    setFlowConfig((prev) => {
      const next = { ...prev }
      const builtInSortable = ["join", "welcome", "consent", "demographics", "review", "complete", "report"] as const

      function assignOrder(id: string, order: number) {
        if (builtInSortable.includes(id as typeof builtInSortable[number])) {
          const key = id as keyof FlowConfig
          const existing = next[key]
          if (existing && typeof existing === "object" && "order" in existing) {
            ;(next as Record<string, unknown>)[key] = { ...existing, order }
          }
        } else {
          // Custom page
          const customPages = [...(next.customPages ?? [])]
          const cpIdx = customPages.findIndex((cp) => cp.id === id)
          if (cpIdx >= 0) {
            customPages[cpIdx] = { ...customPages[cpIdx], order }
          }
          next.customPages = customPages
        }
      }

      // Pre-assessment: 10, 20, 30, ...
      preIds.forEach((id, idx) => assignOrder(id, (idx + 1) * 10))
      // Post-assessment: 110, 120, 130, ...
      postIds.forEach((id, idx) => assignOrder(id, 110 + idx * 10))

      return next
    })
  }, [])

  // --- Add custom page ---
  const handleAddCustomPage = useCallback((label: string) => {
    const existingCustom = flowConfig.customPages ?? []
    const nextNum = existingCustom.length + 1
    const id = `custom_${nextNum}`

    // Place new custom pages at the end of the pre-assessment zone (order < 100)
    // Find the highest pre-assessment order value and add 10
    const allOrders: number[] = []
    for (const key of ["join", "welcome", "consent", "demographics"] as const) {
      const cfg = flowConfig[key]
      if (cfg && typeof cfg === "object" && "order" in cfg) {
        const order = (cfg as { order: number }).order
        if (order < 100) allOrders.push(order)
      }
    }
    for (const cp of existingCustom) {
      if (cp.order < 100) allOrders.push(cp.order)
    }
    const order = allOrders.length > 0 ? Math.max(...allOrders) + 10 : 50

    const newPage: CustomPageConfig = {
      id,
      label,
      enabled: true,
      order,
    }

    setFlowConfig((prev) => ({
      ...prev,
      customPages: [...(prev.customPages ?? []), newPage],
    }))
    setCustomPageContent((prev) => ({
      ...prev,
      [id]: { heading: label, body: "", buttonLabel: "Continue" },
    }))
    setSelectedPageId(id)
    setShowAddPage(false)
    toast.success(`"${label}" page added`)
  }, [flowConfig])

  // --- Preview Flow in new tab ---
  const openFlowPreview = useCallback(() => {
    const previewData = {
      pageContent,
      flowConfig,
      customPageContent,
      brandConfig,
    }
    localStorage.setItem("tf-experience-preview", JSON.stringify(previewData))
    window.open("/preview/experience", "_blank")
  }, [pageContent, flowConfig, customPageContent, brandConfig])

  // --- Save ---
  async function handleSave() {
    setSaveState("saving")
    startTransition(async () => {
      const result = await upsertExperienceTemplate(ownerType, ownerId, {
        pageContent,
        flowConfig,
        demographicsConfig,
        customPageContent,
        privacyUrl: privacyUrl || undefined,
        termsUrl: termsUrl || undefined,
      })

      if (result.error) {
        toast.error(result.error)
        setSaveState("idle")
        return
      }

      toast.success("Experience template saved")
      setSavedContent(cloneDeep(pageContent))
      setSavedFlow(cloneDeep(flowConfig))
      setSavedDemo(cloneDeep(demographicsConfig))
      setSavedCustom(cloneDeep(customPageContent))
      setSavedPrivacy(privacyUrl)
      setSavedTerms(termsUrl)
      if (isCampaign) setIsCustomised(true)
      setSaveState("saved")

      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000)
    })
  }

  // --- Reset (campaign only) ---
  async function handleReset() {
    startTransition(async () => {
      const result = await resetExperienceToDefault("campaign", ownerId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      const defaults = resolveTemplate(platformTemplate, null)
      setPageContent(cloneDeep(defaults.pageContent))
      setFlowConfig(cloneDeep(defaults.flowConfig))
      setDemographicsConfig(cloneDeep(defaults.demographicsConfig))
      setCustomPageContent(cloneDeep(defaults.customPageContent ?? {}))
      setPrivacyUrl(defaults.privacyUrl ?? "")
      setTermsUrl(defaults.termsUrl ?? "")
      setSavedContent(cloneDeep(defaults.pageContent))
      setSavedFlow(cloneDeep(defaults.flowConfig))
      setSavedDemo(cloneDeep(defaults.demographicsConfig))
      setSavedCustom(cloneDeep(defaults.customPageContent ?? {}))
      setSavedPrivacy(defaults.privacyUrl ?? "")
      setSavedTerms(defaults.termsUrl ?? "")
      setIsCustomised(false)
      toast.success("Reset to platform defaults")
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          {isCampaign && (
            <p className="text-sm text-muted-foreground">
              {isCustomised
                ? "Custom experience template"
                : "Using platform defaults"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-1.5"
          >
            {showPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
          {isCampaign && isCustomised && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset to Defaults
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!isDirty || saveState === "saving"}
            size="sm"
          >
            {saveState === "saving"
              ? "Saving..."
              : saveState === "saved"
                ? "Saved"
                : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Flow sidebar */}
        <div className="w-[260px] shrink-0 overflow-hidden rounded-lg border border-border bg-card p-3">
          <FlowSidebar
            flowConfig={flowConfig}
            selectedPageId={selectedPageId}
            onSelectPage={setSelectedPageId}
            onReorder={handleReorder}
            onAddPage={() => setShowAddPage(true)}
          />
        </div>

        {/* Centre: Content editor */}
        <div className="flex-1 min-w-0 overflow-y-auto rounded-lg border border-border bg-card p-5">
          <PageContentEditor
            pageId={selectedPageId}
            pageContent={pageContent}
            flowConfig={flowConfig}
            demographicsConfig={demographicsConfig}
            customPageContent={customPageContent}
            onUpdatePageField={updatePageField}
            onUpdateFlowEnabled={updateFlowEnabled}
            onUpdateFlowConfig={updateFlowConfig}
            onUpdateDemographics={updateDemographics}
            onUpdateCustomPage={updateCustomPage}
            onDeleteCustomPage={deleteCustomPage}
            privacyUrl={privacyUrl}
            termsUrl={termsUrl}
            onUpdatePrivacyUrl={setPrivacyUrl}
            onUpdateTermsUrl={setTermsUrl}
          />
        </div>

        {/* Right: Preview panel */}
        {showPreview && (
          <div className="w-[380px] shrink-0 overflow-hidden">
            <PagePreviewFrame
              pageId={selectedPageId}
              pageContent={pageContent}
              flowConfig={flowConfig}
              customPageContent={customPageContent}
              brandConfig={brandConfig}
              onPreviewFlow={openFlowPreview}
            />
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddPageDialog
        open={showAddPage}
        onOpenChange={setShowAddPage}
        onAdd={handleAddCustomPage}
      />

      <ConfirmDialog
        open={showDialog}
        onOpenChange={(open) => { if (!open) cancelNavigation() }}
        onConfirm={confirmNavigation}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to leave?"
        confirmLabel="Leave"
        variant="destructive"
      />
    </div>
  )
}
