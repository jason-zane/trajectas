"use client"

import { useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Brain, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import { IndicatorsTab } from "@/app/(dashboard)/_shared/indicators-tab"
import { SettingsTab } from "@/app/(dashboard)/_shared/settings-tab"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { useAutoSave } from "@/hooks/use-auto-save"
import { AutoSaveIndicator } from "@/components/auto-save-indicator"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  createDimension,
  updateDimension,
  deleteDimension,
  restoreDimension,
  updateDimensionField,
} from "@/app/actions/dimensions"
import type { DimensionWithChildren } from "@/app/actions/dimensions"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

interface DimensionFormProps {
  mode: "create" | "edit"
  dimension?: DimensionWithChildren
}

export function DimensionForm({ mode, dimension }: DimensionFormProps) {
  const router = useRouter()

  // --- Structural fields (participate in dirty check / form submit) ---
  const [name, setName] = useState(dimension?.name ?? "")
  const [slug, setSlug] = useState(dimension?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(mode === "edit")
  const [isActive, setIsActive] = useState(dimension?.isActive ?? true)

  // --- Create-mode-only local state for text fields ---
  const [createDescription, setCreateDescription] = useState(dimension?.description ?? "")
  const [createDefinition, setCreateDefinition] = useState(dimension?.definition ?? "")
  const [createIndicatorsLow, setCreateIndicatorsLow] = useState(dimension?.indicatorsLow ?? "")
  const [createIndicatorsMid, setCreateIndicatorsMid] = useState(dimension?.indicatorsMid ?? "")
  const [createIndicatorsHigh, setCreateIndicatorsHigh] = useState(dimension?.indicatorsHigh ?? "")

  // --- Auto-save hooks for text fields (edit mode only) ---
  const descriptionAutoSave = useAutoSave({
    initialValue: dimension?.description ?? "",
    onSave: (val) => updateDimensionField(dimension!.id, "description", val),
    enabled: mode === "edit" && !!dimension,
  })

  const definitionAutoSave = useAutoSave({
    initialValue: dimension?.definition ?? "",
    onSave: (val) => updateDimensionField(dimension!.id, "definition", val),
    enabled: mode === "edit" && !!dimension,
  })

  const indicatorsLowAutoSave = useAutoSave({
    initialValue: dimension?.indicatorsLow ?? "",
    onSave: (val) => updateDimensionField(dimension!.id, "indicatorsLow", val),
    enabled: mode === "edit" && !!dimension,
  })

  const indicatorsMidAutoSave = useAutoSave({
    initialValue: dimension?.indicatorsMid ?? "",
    onSave: (val) => updateDimensionField(dimension!.id, "indicatorsMid", val),
    enabled: mode === "edit" && !!dimension,
  })

  const indicatorsHighAutoSave = useAutoSave({
    initialValue: dimension?.indicatorsHigh ?? "",
    onSave: (val) => updateDimensionField(dimension!.id, "indicatorsHigh", val),
    enabled: mode === "edit" && !!dimension,
  })

  // --- Resolve text field values based on mode ---
  const description = mode === "edit" ? descriptionAutoSave.value : createDescription
  const definition = mode === "edit" ? definitionAutoSave.value : createDefinition
  const indicatorsLow = mode === "edit" ? indicatorsLowAutoSave.value : createIndicatorsLow
  const indicatorsMid = mode === "edit" ? indicatorsMidAutoSave.value : createIndicatorsMid
  const indicatorsHigh = mode === "edit" ? indicatorsHighAutoSave.value : createIndicatorsHigh

  // --- Form state ---
  const [pending, setPending] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const childFactors = dimension?.childFactors ?? []

  // --- Dirty tracking (structural fields only) ---
  const [savedStructural, setSavedStructural] = useState(() => ({
    name: dimension?.name ?? "",
    slug: dimension?.slug ?? "",
    isActive: dimension?.isActive ?? true,
  }))

  const isStructuralDirty =
    mode === "create"
      ? name.trim() !== ""
      : name !== savedStructural.name ||
        slug !== savedStructural.slug ||
        isActive !== savedStructural.isActive

  const { showDialog, confirmNavigation, cancelNavigation } =
    useUnsavedChanges(isStructuralDirty)

  // --- Handlers ---
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setName(value)
      if (!slugTouched) {
        setSlug(slugify(value))
      }
    },
    [slugTouched]
  )

  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSlugTouched(true)
      setSlug(slugify(e.target.value))
    },
    []
  )

  const deleteTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setSaveState("saving")
    setError(null)

    const result =
      mode === "edit" && dimension
        ? await updateDimension(dimension.id, formData)
        : await createDimension(formData)

    if (result?.error) {
      const errors = result.error
      const msg =
        typeof errors === "object" && "_form" in errors
          ? (errors as Record<string, string[]>)._form?.[0]
          : typeof errors === "string"
            ? errors
            : Object.values(errors).flat().join(", ")
      setError(msg ?? "Validation failed")
      toast.error(msg ?? "Validation failed")
      setPending(false)
      setSaveState("idle")
      return
    }

    if (result && "success" in result && result.success) {
      toast.success(mode === "create" ? "Dimension created" : "Changes saved")
      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 2000)
      setSavedStructural({ name, slug, isActive })
      if (mode === "create" && result.slug) {
        router.replace(`/dimensions/${result.slug}/edit`, { scroll: false })
      }
      setPending(false)
    }
  }

  async function handleDelete() {
    if (!dimension) return
    setDeleting(true)
    const result = await deleteDimension(dimension.id)

    if (result && "error" in result) {
      toast.error(
        typeof result.error === "string" ? result.error : "Failed to delete"
      )
      setDeleting(false)
      return
    }

    let undone = false
    const timer = setTimeout(() => {
      if (!undone) router.push("/dimensions")
    }, 5000)
    deleteTimer.current = timer

    toast.success("Dimension deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          undone = true
          clearTimeout(timer)
          await restoreDimension(dimension.id)
          toast.success("Dimension restored")
          setDeleting(false)
        },
      },
      duration: 5000,
    })
  }

  // --- Button label ---
  const buttonLabel =
    saveState === "saving" || pending
      ? mode === "create"
        ? "Creating..."
        : "Saving..."
      : saveState === "saved"
        ? "Saved"
        : mode === "create"
          ? "Create Dimension"
          : "Save Changes"

  const title = mode === "create" ? "Create Dimension" : "Edit Dimension"
  const subtitle =
    mode === "create"
      ? "Define a new top-level grouping for your factors."
      : `Update the details for \u201c${dimension?.name}\u201d.`

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader title={title} description={subtitle} />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form action={handleSubmit}>
        <Tabs defaultValue="details">
          <TabsList variant="line" className="mb-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="indicators">Indicators</TabsTrigger>
            {mode === "edit" && (
              <TabsTrigger value="relationships">
                Relationships
                {childFactors.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                    {childFactors.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="details" keepMounted>
            <Card className="border-l-[3px] border-l-dimension-accent">
              <CardHeader>
                <CardTitle>Dimension Details</CardTitle>
                <CardDescription>
                  Core information that defines this dimension.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="dim-name">Name</Label>
                  <Input
                    id="dim-name"
                    name="name"
                    placeholder="e.g. Cognitive Ability"
                    value={name}
                    onChange={handleNameChange}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    A clear, descriptive name for this dimension.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dim-slug">Slug</Label>
                  <Input
                    id="dim-slug"
                    name="slug"
                    placeholder="cognitive-ability"
                    value={slug}
                    onChange={handleSlugChange}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    URL-safe identifier. Auto-generated from the name.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dim-description">Description</Label>
                  <Textarea
                    id="dim-description"
                    name="description"
                    placeholder="Describe what this dimension measures and why it matters..."
                    value={description}
                    onChange={
                      mode === "edit"
                        ? descriptionAutoSave.handleChange
                        : (e) => setCreateDescription(e.target.value)
                    }
                    onBlur={mode === "edit" ? descriptionAutoSave.handleBlur : undefined}
                    className="min-h-24"
                  />
                  {mode === "edit" && (
                    <AutoSaveIndicator
                      status={descriptionAutoSave.status}
                      onRetry={descriptionAutoSave.retry}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dim-definition">Definition</Label>
                  <Textarea
                    id="dim-definition"
                    name="definition"
                    placeholder="A formal definition used in reports and documentation..."
                    value={definition}
                    onChange={
                      mode === "edit"
                        ? definitionAutoSave.handleChange
                        : (e) => setCreateDefinition(e.target.value)
                    }
                    onBlur={mode === "edit" ? definitionAutoSave.handleBlur : undefined}
                    className="min-h-24"
                  />
                  <p className="text-xs text-muted-foreground">
                    A more formal, detailed definition for use in assessment reports.
                  </p>
                  {mode === "edit" && (
                    <AutoSaveIndicator
                      status={definitionAutoSave.status}
                      onRetry={definitionAutoSave.retry}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="indicators" keepMounted>
            <Card>
              <CardHeader>
                <CardTitle>Behavioural Indicators</CardTitle>
                <CardDescription>
                  Observable behaviours that signal performance at each level.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IndicatorsTab
                  indicatorsLow={indicatorsLow}
                  indicatorsMid={indicatorsMid}
                  indicatorsHigh={indicatorsHigh}
                  onChangeLow={
                    mode === "edit"
                      ? (val) => indicatorsLowAutoSave.setValue(val)
                      : setCreateIndicatorsLow
                  }
                  onChangeMid={
                    mode === "edit"
                      ? (val) => indicatorsMidAutoSave.setValue(val)
                      : setCreateIndicatorsMid
                  }
                  onChangeHigh={
                    mode === "edit"
                      ? (val) => indicatorsHighAutoSave.setValue(val)
                      : setCreateIndicatorsHigh
                  }
                  onBlurLow={mode === "edit" ? indicatorsLowAutoSave.handleBlur : undefined}
                  onBlurMid={mode === "edit" ? indicatorsMidAutoSave.handleBlur : undefined}
                  onBlurHigh={mode === "edit" ? indicatorsHighAutoSave.handleBlur : undefined}
                  statusLow={
                    mode === "edit" ? (
                      <AutoSaveIndicator
                        status={indicatorsLowAutoSave.status}
                        onRetry={indicatorsLowAutoSave.retry}
                      />
                    ) : undefined
                  }
                  statusMid={
                    mode === "edit" ? (
                      <AutoSaveIndicator
                        status={indicatorsMidAutoSave.status}
                        onRetry={indicatorsMidAutoSave.retry}
                      />
                    ) : undefined
                  }
                  statusHigh={
                    mode === "edit" ? (
                      <AutoSaveIndicator
                        status={indicatorsHighAutoSave.status}
                        onRetry={indicatorsHighAutoSave.retry}
                      />
                    ) : undefined
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>

          {mode === "edit" && (
            <TabsContent value="relationships">
              <Card>
                <CardHeader>
                  <CardTitle>Child Factors</CardTitle>
                  <CardDescription>
                    Factors grouped under this dimension.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {childFactors.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <Brain className="size-8 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No factors are linked to this dimension yet.
                      </p>
                      <Link href="/factors/create" className="mt-3">
                        <Button variant="outline" size="sm">
                          Create Factor
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {childFactors.map((factor) => (
                        <Link
                          key={factor.id}
                          href={`/factors/${factor.slug}/edit`}
                          className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-competency-bg">
                            <Brain className="size-4 text-competency-accent" />
                          </div>
                          <span className="text-sm font-medium flex-1">
                            {factor.name}
                          </span>
                          <Badge variant="dot">
                            <span
                              className={`size-1.5 rounded-full ${factor.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                            />
                            {factor.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <ArrowRight className="size-4 text-muted-foreground" />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="settings" keepMounted>
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>
                  Status and lifecycle management.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SettingsTab
                  entityName="Dimension"
                  isActive={isActive}
                  onActiveChange={setIsActive}
                  onDelete={mode === "edit" ? handleDelete : undefined}
                  deleting={deleting}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <input type="hidden" name="displayOrder" value={dimension?.displayOrder ?? 0} />

        {/* Sticky action bar */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 py-4 mt-6 bg-background/80 backdrop-blur-sm -mx-4 px-4 border-t border-border/50">
          <Link href="/dimensions">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={!name.trim() || pending || saveState === "saved"}>
            {buttonLabel}
          </Button>
        </div>
      </form>

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
