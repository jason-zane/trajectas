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
import { FlowPreviewDialog } from "./flow-preview-dialog"
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

  // State
  const [pageContent, setPageContent] = useState<Partial<PageContentMap>>(initContent)
  const [flowConfig, setFlowConfig] = useState<Partial<FlowConfig>>(initFlow)
  const [demographicsConfig, setDemographicsConfig] = useState<DemographicsConfig>(initDemo)
  const [customPageContent, setCustomPageContent] = useState<Record<string, CustomPageContent>>(initCustom)

  // Saved snapshots for dirty detection
  const [savedContent, setSavedContent] = useState(initContent)
  const [savedFlow, setSavedFlow] = useState(initFlow)
  const [savedDemo, setSavedDemo] = useState(initDemo)
  const [savedCustom, setSavedCustom] = useState(initCustom)

  const [, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedPageId, setSelectedPageId] = useState("welcome")
  const [showPreview, setShowPreview] = useState(true)
  const [showFlowPreview, setShowFlowPreview] = useState(false)
  const [showAddPage, setShowAddPage] = useState(false)
  const [isCustomised, setIsCustomised] = useState(!!initialRecord && isCampaign)

  const isDirty =
    JSON.stringify(pageContent) !== JSON.stringify(savedContent) ||
    JSON.stringify(flowConfig) !== JSON.stringify(savedFlow) ||
    JSON.stringify(demographicsConfig) !== JSON.stringify(savedDemo) ||
    JSON.stringify(customPageContent) !== JSON.stringify(savedCustom)

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
  const handleReorder = useCallback((orderedMiddleIds: string[]) => {
    setFlowConfig((prev) => {
      const next = { ...prev }
      const builtInMiddle = ["consent", "demographics", "review", "report"] as const

      // Assign new order values: starting from 3 (after join=1, welcome=2)
      orderedMiddleIds.forEach((id, idx) => {
        const order = idx + 3
        if (builtInMiddle.includes(id as typeof builtInMiddle[number])) {
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
      })

      return next
    })
  }, [])

  // --- Add custom page ---
  const handleAddCustomPage = useCallback((label: string) => {
    const existingCustom = flowConfig.customPages ?? []
    const nextNum = existingCustom.length + 1
    const id = `custom_${nextNum}`

    const middlePageCount = 4 + existingCustom.length // consent, demo, review, report + existing custom
    const order = middlePageCount + 3 // after join, welcome, and existing middle pages

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
  }, [flowConfig.customPages])

  // --- Save ---
  async function handleSave() {
    setSaveState("saving")
    startTransition(async () => {
      const result = await upsertExperienceTemplate(ownerType, ownerId, {
        pageContent,
        flowConfig,
        demographicsConfig,
        customPageContent,
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
      setSavedContent(cloneDeep(defaults.pageContent))
      setSavedFlow(cloneDeep(defaults.flowConfig))
      setSavedDemo(cloneDeep(defaults.demographicsConfig))
      setSavedCustom(cloneDeep(defaults.customPageContent ?? {}))
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
              onPreviewFlow={() => setShowFlowPreview(true)}
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

      <FlowPreviewDialog
        open={showFlowPreview}
        onOpenChange={setShowFlowPreview}
        pageContent={pageContent}
        flowConfig={flowConfig}
        customPageContent={customPageContent}
        brandConfig={brandConfig}
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
