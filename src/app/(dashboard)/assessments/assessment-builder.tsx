"use client"

import { useState, useCallback, useTransition, useMemo } from "react"
import Link from "next/link"
import { Trash2, Info } from "lucide-react"
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
import { FactorSource } from "./factor-source"
import { AssessmentCanvas } from "./assessment-canvas"
import { SectionConfigurator } from "./section-configurator"
import {
  createAssessment,
  updateAssessment,
  deleteAssessment,
} from "@/app/actions/assessments"
import type { Assessment } from "@/types/database"
import type {
  BuilderFactor,
  AssessmentCompetencyLink,
  SectionDraft,
  ExistingSection,
} from "@/app/actions/assessments"

const scoringMethodInfo: Record<string, { label: string; description: string }> = {
  ctt: {
    label: "CTT (Classical Test Theory)",
    description: "Uses sum/mean scores with reliability estimates (Cronbach's alpha). Simple, well-understood, and suitable for most fixed-form assessments.",
  },
  irt: {
    label: "IRT (Item Response Theory)",
    description: "Models each item's difficulty and discrimination to place candidates on a latent trait scale. Required for adaptive testing (CAT).",
  },
  hybrid: {
    label: "Hybrid",
    description: "Uses CTT for initial scoring with IRT-calibrated item parameters for quality analysis and optional adaptive item selection.",
  },
}

const itemSelectionInfo: Record<string, { label: string; description: string }> = {
  fixed: {
    label: "Fixed",
    description: "Every candidate receives the same set of items in the same order. Best for standardised assessments where comparability is critical.",
  },
  rule_based: {
    label: "Rule-based",
    description: "Items are selected dynamically using configurable rules (e.g. difficulty range, content balance). Adds variety while maintaining constraints.",
  },
  cat: {
    label: "CAT (Adaptive)",
    description: "Computerised Adaptive Testing — selects items in real time based on the candidate's estimated ability. Requires IRT-calibrated items. Shorter tests, higher precision.",
  },
}

interface AssessmentBuilderProps {
  assessment?: Assessment
  existingCompetencies?: AssessmentCompetencyLink[]
  existingSections?: ExistingSection[]
  allFactors: BuilderFactor[]
}

export function AssessmentBuilder({
  assessment,
  existingCompetencies,
  existingSections,
  allFactors,
}: AssessmentBuilderProps) {
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

  // Factor selection state
  const [selectedFactors, setSelectedFactors] = useState<BuilderFactor[]>(() => {
    if (!existingCompetencies?.length) return []
    const ids = new Set(existingCompetencies.map((c) => c.competencyId))
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
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

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
      description: description || undefined,
      status,
      itemSelectionStrategy,
      scoringMethod,
      creationMode,
      competencies: selectedFactors.map((f) => ({
        competencyId: f.id,
        weight: 1,
        itemCount: 0,
      })),
      sections,
    }

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
      }
    })
  }

  async function handleDelete() {
    if (!assessment) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    await deleteAssessment(assessment.id)
  }

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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-20"
              />
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
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="size-4" />
              {confirmDelete
                ? deleting
                  ? "Deleting..."
                  : "Confirm Delete"
                : "Delete Assessment"}
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
              disabled={!title.trim() || isPending}
            >
              {isPending
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Assessment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
