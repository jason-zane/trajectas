"use client"

import { useState, useCallback, useTransition, useMemo, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Trash2, Info } from "lucide-react"
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
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/page-header"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { AutoSaveIndicator } from "@/components/auto-save-indicator"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { useAutoSave } from "@/hooks/use-auto-save"
import { FactorSource } from "./factor-source"
import { AssessmentCanvas } from "./assessment-canvas"
import { SectionConfigurator } from "./section-configurator"
import {
  createAssessment,
  updateAssessment,
  deleteAssessment,
  restoreAssessment,
  updateAssessmentField,
} from "@/app/actions/assessments"
import type { Assessment, FormatMode } from "@/types/database"
import type {
  BuilderFactor,
  AssessmentFactorLink,
  SectionDraft,
  ExistingSection,
  ExistingFCBlock,
} from "@/app/actions/assessments"
import type { ForcedChoiceBlockDraft } from "@/lib/forced-choice-generator"

const scoringMethodInfo: Record<string, { label: string; description: string }> = {
  ctt: {
    label: "CTT (Classical Test Theory)",
    description: "Uses sum/mean scores with reliability estimates (Cronbach's alpha). Simple, well-understood, and suitable for most fixed-form assessments.",
  },
  irt: {
    label: "IRT (Item Response Theory)",
    description: "Models each item's difficulty and discrimination to place participants on a latent trait scale. Required for adaptive testing (CAT).",
  },
  hybrid: {
    label: "Hybrid",
    description: "Uses CTT for initial scoring with IRT-calibrated item parameters for quality analysis and optional adaptive item selection.",
  },
}

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

type SaveButtonState = "idle" | "saving" | "saved"

interface AssessmentBuilderProps {
  assessment?: Assessment
  existingFactors?: AssessmentFactorLink[]
  existingSections?: ExistingSection[]
  existingBlocks?: ExistingFCBlock[]
  allFactors: BuilderFactor[]
}

export function AssessmentBuilder({
  assessment,
  existingFactors,
  existingSections,
  existingBlocks,
  allFactors,
}: AssessmentBuilderProps) {
  const router = useRouter()
  const isEditing = !!assessment

  // Metadata state
  const [title, setTitle] = useState(assessment?.title ?? "")
  const [description, setDescription] = useState(assessment?.description ?? "")
  const [scoringMethod, setScoringMethod] = useState(
    assessment?.scoringMethod ?? "ctt"
  )
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

  // Factor selection state
  const [selectedFactors, setSelectedFactors] = useState<BuilderFactor[]>(() => {
    if (!existingFactors?.length) return []
    const ids = new Set(existingFactors.map((c) => c.factorId))
    return allFactors.filter((f) => ids.has(f.id))
  })

  const selectedIds = useMemo(
    () => new Set(selectedFactors.map((f) => f.id)),
    [selectedFactors]
  )

  // Section state
  const [sections, setSections] = useState<SectionDraft[]>([])

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
  const initialStructural = useRef({
    title: assessment?.title ?? "",
    status: assessment?.status ?? "draft",
    scoringMethod: assessment?.scoringMethod ?? "ctt",
    itemSelectionStrategy: assessment?.itemSelectionStrategy ?? "fixed",
    creationMode: assessment?.creationMode ?? "manual",
    formatMode: assessment?.formatMode ?? "traditional",
    fcBlockSize: assessment?.fcBlockSize ?? 3,
    factorIds: existingFactors?.map((c) => c.factorId).sort().join(",") ?? "",
  })

  const isStructuralDirty = isEditing
    ? title !== initialStructural.current.title ||
      status !== initialStructural.current.status ||
      scoringMethod !== initialStructural.current.scoringMethod ||
      itemSelectionStrategy !== initialStructural.current.itemSelectionStrategy ||
      creationMode !== initialStructural.current.creationMode ||
      formatMode !== initialStructural.current.formatMode ||
      fcBlockSize !== initialStructural.current.fcBlockSize ||
      selectedFactors.map((f) => f.id).sort().join(",") !== initialStructural.current.factorIds
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

  const factorIds = useMemo(
    () => selectedFactors.map((f) => f.id),
    [selectedFactors]
  )

  function handleSave() {
    setError(null)
    const payload = {
      title,
      description: (isEditing ? descAutoSave.value : description) || undefined,
      status,
      itemSelectionStrategy,
      scoringMethod,
      creationMode,
      formatMode,
      fcBlockSize: formatMode === "forced_choice" ? fcBlockSize : undefined,
      factors: selectedFactors.map((f) => ({
        factorId: f.id,
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
        initialStructural.current = {
          title,
          status,
          scoringMethod,
          itemSelectionStrategy,
          creationMode,
          formatMode,
          fcBlockSize,
          factorIds: selectedFactors.map((f) => f.id).sort().join(","),
        }
        if (!isEditing && result.id) {
          router.replace(`/assessments/${result.id}/edit`, { scroll: false })
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
      if (!undone) router.push("/assessments")
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
                    <SelectValue placeholder="Select status" />
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
                  <Select
                    value={scoringMethod}
                    onValueChange={(v) => v !== null && setScoringMethod(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select scoring method" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(scoringMethodInfo).map(([value, info]) => (
                        <SelectItem key={value} value={value}>
                          {info.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <Info className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {scoringMethodInfo[scoringMethod]?.description}
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
                      <SelectValue placeholder="Select strategy" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(itemSelectionInfo).map(([value, info]) => (
                        <SelectItem key={value} value={value}>
                          {info.label}
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
                      <SelectValue placeholder="Select mode" />
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

      {/* Drag-and-Drop Factor Selection */}
      <DragDropProvider
        onDragEnd={(event) => {
          const { source, target } = event.operation

          if (!source || !target) return

          // Handle drag from source panel to canvas
          const sourceId = String(source.id)
          if (sourceId.startsWith("source-")) {
            const factorId = sourceId.replace("source-", "")
            const factor = allFactors.find((f) => f.id === factorId)
            if (factor && !selectedIds.has(factorId)) {
              addFactor(factor)
            }
            return
          }

          // Handle reorder within canvas
          setSelectedFactors((prev) => move(prev, event))
        }}
      >
        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          {/* Left panel — Factor source */}
          <div className="rounded-xl border bg-card p-4">
            <FactorSource
              factors={allFactors}
              selectedIds={selectedIds}
              onToggle={toggleFactor}
            />
          </div>

          {/* Right panel — Assessment canvas */}
          <div className="rounded-xl border bg-card p-4">
            <AssessmentCanvas
              selectedFactors={selectedFactors}
              onRemove={removeFactor}
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
      />

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
            <Link href="/assessments">
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
