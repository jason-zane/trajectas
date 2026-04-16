"use client"

import { useState, useCallback, useTransition, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Trash2, Info, Settings } from "lucide-react"
import { toast } from "sonner"
import { DragDropProvider } from "@dnd-kit/react"
import { move } from "@dnd-kit/helpers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/page-header"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { AutoSaveIndicator } from "@/components/auto-save-indicator"
import { getSelectLabel } from "@/lib/select-display"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { useAutoSave } from "@/hooks/use-auto-save"
import { FactorSource } from "./factor-source"
import { ConstructSource } from "./construct-source"
import { AssessmentCanvas } from "./assessment-canvas"
import { SectionConfigurator } from "./section-configurator"
import {
  createAssessment,
  updateAssessment,
  deleteAssessment,
  restoreAssessment,
  updateAssessmentField,
  updateAssessmentCustomisation,
} from "@/app/actions/assessments"
import {
  getItemsPerConstructLimit,
  type ConstructShortfall,
} from "@/app/actions/item-selection-rules"
import type { Assessment, FormatMode } from "@/types/database"
import type {
  BuilderFactor,
  BuilderConstruct,
  AssessmentFactorLink,
  AssessmentConstructLink,
  SectionDraft,
  ExistingSection,
  ExistingFCBlock,
} from "@/app/actions/assessments"
import type { ForcedChoiceBlockDraft } from "@/lib/forced-choice-generator"

const scoringMethodInfo = {
  ctt: {
    label: "CTT (Classical Test Theory)",
    description:
      "Uses sum/mean scores with reliability estimates (Cronbach's alpha). Simple, well-understood, and suitable for the launch assessment workflow.",
  },
} as const

const itemSelectionInfo: Record<string, { label: string; description: string }> = {
  fixed: {
    label: "Fixed",
    description: "Every participant receives the same set of items in the same order. Best for standardised assessments where comparability is critical.",
  },
  rule_based: {
    label: "Rule-based",
    description: "Items are selected dynamically using configurable rules (e.g. difficulty range, content balance). Adds variety while maintaining constraints.",
  },
  cat: {
    label: "CAT (Adaptive)",
    description: "Computerised Adaptive Testing — selects items in real time based on the participant's estimated ability. Requires IRT-calibrated items. Shorter tests, higher precision.",
  },
}

const assessmentStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
] as const

const creationModeOptions = [
  { value: "manual", label: "Manual" },
  { value: "ai_generated", label: "AI Generated" },
  { value: "org_choice", label: "Org Choice" },
] as const

type SaveButtonState = "idle" | "saving" | "saved"

interface AssessmentBuilderProps {
  assessment?: Assessment
  existingFactors?: AssessmentFactorLink[]
  existingConstructs?: AssessmentConstructLink[]
  existingSections?: ExistingSection[]
  existingBlocks?: ExistingFCBlock[]
  allFactors: BuilderFactor[]
  allConstructs?: BuilderConstruct[]
  basePath?: string
}

export function AssessmentBuilder({
  assessment,
  existingFactors,
  existingConstructs,
  existingSections,
  existingBlocks,
  allFactors,
  allConstructs = [],
  basePath = "/assessments",
}: AssessmentBuilderProps) {
  const router = useRouter()
  const isEditing = !!assessment

  // Metadata state
  const [title, setTitle] = useState(assessment?.title ?? "")
  const [description, setDescription] = useState(assessment?.description ?? "")
  const [itemSelectionStrategy, setItemSelectionStrategy] = useState(
    assessment?.itemSelectionStrategy ?? "fixed"
  )
  const [creationMode, setCreationMode] = useState(
    assessment?.creationMode ?? "manual"
  )
  const [status, setStatus] = useState(assessment?.status ?? "draft")
  const [formatMode, setFormatMode] = useState<FormatMode>(
    assessment?.formatMode ?? "traditional"
  )
  const [fcBlockSize, setFcBlockSize] = useState<3 | 4>(
    (assessment?.fcBlockSize as 3 | 4) ?? 3
  )
  const [fcBlocks, setFcBlocks] = useState<ForcedChoiceBlockDraft[]>(
    existingBlocks?.map((b) => ({
      items: b.items.map((item) => ({
        itemId: item.itemId,
        constructId: item.constructId,
        position: item.position,
      })),
    })) ?? []
  )

  // Scoring level — locked after creation
  const [scoringLevel, setScoringLevel] = useState<'factor' | 'construct'>(
    assessment?.scoringLevel ?? 'factor'
  )
  const [minCustomConstructs, setMinCustomConstructs] = useState<number | null>(
    assessment?.minCustomConstructs ?? null
  )

  // Factor selection state
  const [selectedFactors, setSelectedFactors] = useState<BuilderFactor[]>(() => {
    if (!existingFactors?.length) return []
    const ids = new Set(existingFactors.map((c) => c.factorId))
    return allFactors.filter((f) => ids.has(f.id))
  })

  // Construct selection state (used when scoringLevel = 'construct')
  const [selectedConstructs, setSelectedConstructs] = useState<BuilderConstruct[]>(() => {
    if (!existingConstructs?.length) return []
    const ids = new Set(existingConstructs.map((c) => c.constructId))
    return allConstructs.filter((c) => ids.has(c.id))
  })

  const selectedIds = useMemo(
    () =>
      new Set(
        (scoringLevel === "construct" ? selectedConstructs : selectedFactors).map(
          (e) => e.id,
        ),
      ),
    [selectedFactors, selectedConstructs, scoringLevel],
  )

  // Section state
  const [sections, setSections] = useState<SectionDraft[]>([])

  // Factor customisation state (Zone 1 — immediate save, edit mode only)
  const [customisationEnabled, setCustomisationEnabled] = useState(
    assessment?.minCustomFactors != null
  )
  const [minCustomFactors, setMinCustomFactors] = useState<number>(
    assessment?.minCustomFactors ?? 1
  )
  const [customisationSaving, setCustomisationSaving] = useState(false)

  // UI state
  const [isPending, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<SaveButtonState>("idle")
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Auto-save for description (edit mode only)
  const descAutoSave = useAutoSave({
    initialValue: assessment?.description ?? "",
    onSave: (val) => updateAssessmentField(assessment!.id, "description", val),
    enabled: isEditing && !!assessment,
  })

  const descValue = isEditing ? descAutoSave.value : description

  // Dirty tracking
  const [savedStructural, setSavedStructural] = useState(() => ({
    title: assessment?.title ?? "",
    status: assessment?.status ?? "draft",
    itemSelectionStrategy: assessment?.itemSelectionStrategy ?? "fixed",
    creationMode: assessment?.creationMode ?? "manual",
    formatMode: assessment?.formatMode ?? "traditional",
    fcBlockSize: assessment?.fcBlockSize ?? 3,
    factorIds: existingFactors?.map((c) => c.factorId).sort().join(",") ?? "",
    constructIds: existingConstructs?.map((c) => c.constructId).sort().join(",") ?? "",
  }))

  const isStructuralDirty = isEditing
    ? title !== savedStructural.title ||
      status !== savedStructural.status ||
      itemSelectionStrategy !== savedStructural.itemSelectionStrategy ||
      creationMode !== savedStructural.creationMode ||
      formatMode !== savedStructural.formatMode ||
      fcBlockSize !== savedStructural.fcBlockSize ||
      selectedFactors.map((f) => f.id).sort().join(",") !== savedStructural.factorIds ||
      selectedConstructs.map((c) => c.id).sort().join(",") !== savedStructural.constructIds
    : title.trim() !== ""

  const { showDialog, confirmNavigation, cancelNavigation } =
    useUnsavedChanges(isStructuralDirty)

  const addFactor = useCallback((factor: BuilderFactor) => {
    setSelectedFactors((prev) => {
      if (prev.some((f) => f.id === factor.id)) return prev
      return [...prev, factor]
    })
  }, [])

  const removeFactor = useCallback((id: string) => {
    setSelectedFactors((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const toggleFactor = useCallback(
    (factor: BuilderFactor) => {
      if (selectedIds.has(factor.id)) {
        removeFactor(factor.id)
      } else {
        addFactor(factor)
      }
    },
    [selectedIds, addFactor, removeFactor]
  )

  const addConstruct = useCallback((construct: BuilderConstruct) => {
    setSelectedConstructs((prev) => {
      if (prev.some((c) => c.id === construct.id)) return prev
      return [...prev, construct]
    })
  }, [])

  const removeConstruct = useCallback((id: string) => {
    setSelectedConstructs((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const toggleConstruct = useCallback(
    (construct: BuilderConstruct) => {
      if (selectedIds.has(construct.id)) {
        removeConstruct(construct.id)
      } else {
        addConstruct(construct)
      }
    },
    [selectedIds, addConstruct, removeConstruct],
  )

  // Unified remove handler passed to the canvas (branches on scoringLevel)
  const handleCanvasRemove = useCallback(
    (id: string) => {
      if (scoringLevel === "construct") removeConstruct(id)
      else removeFactor(id)
    },
    [scoringLevel, removeConstruct, removeFactor],
  )

  const factorIds = useMemo(
    () => selectedFactors.map((f) => f.id),
    [selectedFactors]
  )

  // Item selection rule lookup
  const [ruleInfo, setRuleInfo] = useState<{
    constructCount: number
    itemsPerConstruct: number | null
    shortfalls: ConstructShortfall[]
  } | null>(null)

  useEffect(() => {
    if (factorIds.length === 0) {
      setRuleInfo(null)
      return
    }
    let cancelled = false
    getItemsPerConstructLimit(factorIds).then((info) => {
      if (!cancelled) setRuleInfo(info)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factorIds.join(",")])

  function handleSave() {
    setError(null)
    const payload = {
      title,
      description: (isEditing ? descAutoSave.value : description) || undefined,
      status,
      itemSelectionStrategy,
      scoringMethod: "ctt",
      creationMode,
      formatMode,
      fcBlockSize: formatMode === "forced_choice" ? fcBlockSize : undefined,
      scoringLevel,
      minCustomConstructs:
        scoringLevel === "construct" ? minCustomConstructs : null,
      factors: selectedFactors.map((f) => ({
        factorId: f.id,
        weight: 1,
        itemCount: 0,
      })),
      constructs: selectedConstructs.map((c) => ({
        constructId: c.id,
        dimensionId: c.dimensionId ?? null,
        weight: 1,
        itemCount: 0,
      })),
      sections,
      forcedChoiceBlocks: formatMode === "forced_choice" ? fcBlocks : undefined,
    }

    setSaveState("saving")
    startTransition(async () => {
      const result = isEditing
        ? await updateAssessment(assessment.id, payload)
        : await createAssessment(payload)

      if (result?.error) {
        const errors = result.error
        const msg =
          typeof errors === "object" && "_form" in errors
            ? (errors as Record<string, string[]>)._form?.[0]
            : Object.values(errors).flat().join(", ")
        setError(msg ?? "Validation failed")
        toast.error(msg ?? "Validation failed")
        setSaveState("idle")
      } else if (result && "success" in result) {
        toast.success(isEditing ? "Changes saved" : "Assessment created")
        setSaveState("saved")
        setTimeout(() => setSaveState("idle"), 2000)
        setSavedStructural({
          title,
          status,
          itemSelectionStrategy,
          creationMode,
          formatMode,
          fcBlockSize,
          factorIds: selectedFactors.map((f) => f.id).sort().join(","),
          constructIds: selectedConstructs.map((c) => c.id).sort().join(","),
        })
        if (!isEditing && result.id) {
          router.replace(`${basePath}/${result.id}/edit`, { scroll: false })
        }
      }
    })
  }

  async function handleDelete() {
    if (!assessment) return
    setDeleting(true)
    setShowDeleteDialog(false)
    const result = await deleteAssessment(assessment.id)
    if (result && "error" in result) {
      toast.error(
        typeof result.error === "string" ? result.error : "Failed to delete"
      )
      setDeleting(false)
      return
    }

    let undone = false
    const timer = setTimeout(() => {
      if (!undone) router.push(basePath)
    }, 5000)

    toast.success("Assessment deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          undone = true
          clearTimeout(timer)
          await restoreAssessment(assessment.id)
          toast.success("Assessment restored")
          setDeleting(false)
        },
      },
      duration: 5000,
    })
  }

  async function handleCustomisationToggle(enabled: boolean) {
    if (!assessment) return
    setCustomisationSaving(true)
    setCustomisationEnabled(enabled)

    const value = enabled ? Math.max(1, Math.floor(selectedFactors.length / 2) || 1) : null
    if (enabled) setMinCustomFactors(value as number)

    const result = await updateAssessmentCustomisation(assessment.id, value)
    setCustomisationSaving(false)

    if ("error" in result) {
      toast.error(result.error)
      setCustomisationEnabled(!enabled)
    } else {
      toast.success(enabled ? "Factor customisation enabled" : "Factor customisation disabled")
    }
  }

  async function handleMinFactorsChange(value: number) {
    if (!assessment) return
    setMinCustomFactors(value)
    setCustomisationSaving(true)

    const result = await updateAssessmentCustomisation(assessment.id, value)
    setCustomisationSaving(false)

    if ("error" in result) {
      toast.error(result.error)
    } else {
      toast.success(`Minimum factors updated to ${value}`)
    }
  }

  const saveLabel =
    saveState === "saving" || isPending
      ? isEditing
        ? "Saving..."
        : "Creating..."
      : saveState === "saved"
        ? "Saved"
        : isEditing
          ? "Save Changes"
          : "Create Assessment"

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Assessments"
        title={isEditing ? "Edit Assessment" : "Build Assessment"}
        description={
          isEditing
            ? `Update \u201c${assessment.title}\u201d and manage its factor composition.`
            : "Configure your assessment and select factors from the library."
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Metadata Section */}
      <Card>
        <CardHeader>
          <CardTitle>Assessment Details</CardTitle>
          <CardDescription>
            Set the title and basic configuration for this assessment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Title */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Leadership Potential Assessment"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the purpose and scope of this assessment..."
                value={descValue}
                onChange={
                  isEditing
                    ? descAutoSave.handleChange
                    : (e) => setDescription(e.target.value)
                }
                onBlur={isEditing ? descAutoSave.handleBlur : undefined}
                className="min-h-20"
              />
              {isEditing && (
                <AutoSaveIndicator
                  status={descAutoSave.status}
                  onRetry={descAutoSave.retry}
                />
              )}
            </div>

            {/* Status (edit only) */}
            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => v !== null && setStatus(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status">
                      {(value: string | null) =>
                        getSelectLabel(
                          value as typeof assessmentStatusOptions[number]["value"] | null,
                          assessmentStatusOptions,
                          "Select status"
                        )
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Advanced settings toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-primary hover:underline"
            >
              {showAdvanced ? "Hide" : "Show"} advanced settings
            </button>
          </div>

          {showAdvanced && (
            <>
              <Separator />
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Scoring Method */}
                <div className="space-y-2">
                  <Label>Scoring Method</Label>
                  <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-3">
                    <p className="text-sm font-medium text-foreground">
                      {scoringMethodInfo.ctt.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {scoringMethodInfo.ctt.description}
                    </p>
                  </div>
                </div>

                {/* Scoring Level */}
                <div className="space-y-2">
                  <Label htmlFor="scoring-level">Scoring Level</Label>
                  <Select
                    value={scoringLevel}
                    onValueChange={(v) =>
                      v !== null && setScoringLevel(v as 'factor' | 'construct')
                    }
                    disabled={isEditing}
                  >
                    <SelectTrigger id="scoring-level" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="factor">Factor level</SelectItem>
                      <SelectItem value="construct">Construct level</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <Info className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {isEditing
                        ? 'Scoring level is locked after creation.'
                        : scoringLevel === 'construct'
                          ? 'Scores are computed at the construct level, skipping factors. Dimensions aggregate directly from constructs.'
                          : 'Standard hierarchy: items → constructs → factors → dimensions.'}
                    </p>
                  </div>
                </div>

                {/* Item Selection Strategy */}
                <div className="space-y-2">
                  <Label>Item Selection</Label>
                  <Select
                    value={itemSelectionStrategy}
                    onValueChange={(v) =>
                      v !== null && setItemSelectionStrategy(v)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select strategy">
                        {(value: string | null) =>
                          getSelectLabel(
                            value,
                            Object.entries(itemSelectionInfo).map(([optionValue, info]) => ({
                              value: optionValue,
                              label: info.label,
                            })),
                            "Select strategy"
                          )
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(itemSelectionInfo).map(([value, info]) => (
                        <SelectItem key={value} value={value} disabled={value === "cat"}>
                          {info.label}{value === "cat" ? " (coming soon)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <Info className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {itemSelectionInfo[itemSelectionStrategy]?.description}
                    </p>
                  </div>
                </div>

                {/* Creation Mode */}
                <div className="space-y-2">
                  <Label>Creation Mode</Label>
                  <Select
                    value={creationMode}
                    onValueChange={(v) => v !== null && setCreationMode(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select mode">
                        {(value: string | null) =>
                          getSelectLabel(
                            value as typeof creationModeOptions[number]["value"] | null,
                            creationModeOptions,
                            "Select mode"
                          )
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="ai_generated">AI Generated</SelectItem>
                      <SelectItem value="org_choice">Org Choice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Drag-and-Drop Factor/Construct Selection */}
      <DragDropProvider
        onDragEnd={(event) => {
          const { source, target } = event.operation

          if (!source || !target) return

          // Handle drag from source panel to canvas
          const sourceId = String(source.id)
          if (sourceId.startsWith("source-")) {
            const entityId = sourceId.replace("source-", "")
            if (scoringLevel === "construct") {
              const construct = allConstructs.find((c) => c.id === entityId)
              if (construct && !selectedIds.has(entityId)) {
                addConstruct(construct)
              }
            } else {
              const factor = allFactors.find((f) => f.id === entityId)
              if (factor && !selectedIds.has(entityId)) {
                addFactor(factor)
              }
            }
            return
          }

          // Handle reorder within canvas
          if (scoringLevel === "construct") {
            setSelectedConstructs((prev) => move(prev, event))
          } else {
            setSelectedFactors((prev) => move(prev, event))
          }
        }}
      >
        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          {/* Left panel — Factor or Construct source */}
          <div className="rounded-xl border bg-card p-4">
            {scoringLevel === "construct" ? (
              <ConstructSource
                constructs={allConstructs}
                selectedIds={selectedIds}
                onToggle={toggleConstruct}
              />
            ) : (
              <FactorSource
                factors={allFactors}
                selectedIds={selectedIds}
                onToggle={toggleFactor}
              />
            )}
          </div>

          {/* Right panel — Assessment canvas */}
          <div className="rounded-xl border bg-card p-4">
            <AssessmentCanvas
              mode={scoringLevel}
              selectedFactors={selectedFactors}
              selectedConstructs={selectedConstructs}
              onRemove={handleCanvasRemove}
              ruleInfo={ruleInfo}
            />
          </div>
        </div>
      </DragDropProvider>

      {/* Section Configuration — auto-grouped from selected factors' items */}
      <SectionConfigurator
        factorIds={factorIds}
        sections={sections}
        onSectionsChange={setSections}
        existingSections={existingSections}
        formatMode={formatMode}
        onFormatModeChange={setFormatMode}
        fcBlockSize={fcBlockSize}
        onFcBlockSizeChange={setFcBlockSize}
        fcBlocks={fcBlocks}
        onFcBlocksChange={setFcBlocks}
        existingBlocks={existingBlocks}
        ruleInfo={ruleInfo}
      />

      {/* Factor Customisation Settings — edit mode only */}
      {isEditing && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="size-5 text-muted-foreground" />
              <CardTitle>Factor Customisation</CardTitle>
            </div>
            <CardDescription>
              Control whether campaign administrators can customise which factors
              are included when deploying this assessment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="customisation-toggle" className="text-sm font-medium">
                  Allow partners to customise factors
                </Label>
                <p className="text-xs text-muted-foreground">
                  {customisationEnabled
                    ? "Partners can select a subset of factors for each campaign"
                    : "Partners must use all factors in this assessment"}
                </p>
              </div>
              <Switch
                id="customisation-toggle"
                checked={customisationEnabled}
                onCheckedChange={handleCustomisationToggle}
                disabled={customisationSaving}
              />
            </div>

            {customisationEnabled && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="min-factors">Minimum factors</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="min-factors"
                      type="number"
                      min={1}
                      max={selectedFactors.length || 1}
                      value={minCustomFactors}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10)
                        if (!isNaN(val)) setMinCustomFactors(val)
                      }}
                      onBlur={() => handleMinFactorsChange(minCustomFactors)}
                      className="w-24"
                      disabled={customisationSaving}
                    />
                    <span className="text-sm text-muted-foreground">
                      of {selectedFactors.length} factor{selectedFactors.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <Info className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Partners must select at least this many factors when customising
                      the assessment for a campaign. Set to the total factor count to
                      prevent any removal.
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sticky Action Bar */}
      <div className="sticky bottom-0 z-10 -mx-4 px-4 py-4 bg-background/80 backdrop-blur-sm border-t">
        <div
          className={`flex items-center max-w-6xl ${isEditing ? "justify-between" : "justify-end"}`}
        >
          {isEditing && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleting}
            >
              <Trash2 className="size-4" />
              Delete Assessment
            </Button>
          )}
          <div className="flex items-center gap-3">
            <Link href={basePath}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || isPending || saveState === "saved"}
            >
              {saveLabel}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Assessment?"
        description="This will archive the assessment. You can undo this for a few seconds after confirming."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />

      {/* Unsaved changes dialog */}
      <ConfirmDialog
        open={showDialog}
        onOpenChange={() => cancelNavigation()}
        title="Unsaved changes"
        description="You have unsaved changes that will be lost if you leave this page."
        confirmLabel="Discard"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={confirmNavigation}
      />
    </div>
  )
}
