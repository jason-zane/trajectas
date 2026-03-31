"use client"

import { useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { X, Dna, LayoutGrid, ClipboardList } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import { IndicatorsTab } from "@/app/(dashboard)/_shared/indicators-tab"
import { SettingsTab } from "@/app/(dashboard)/_shared/settings-tab"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { useAutoSave } from "@/hooks/use-auto-save"
import { AutoSaveIndicator } from "@/components/auto-save-indicator"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  createFactor,
  updateFactor,
  deleteFactor,
  restoreFactor,
  updateFactorField,
} from "@/app/actions/factors"
import type { SelectOption, LinkedAssessment } from "@/app/actions/factors"

interface LinkedConstruct {
  constructId: string
  name: string
  weight: number
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

interface FactorFormProps {
  dimensions: SelectOption[]
  availableConstructs: SelectOption[]
  organizations: SelectOption[]
  mode: "create" | "edit"
  factorId?: string
  initialData?: {
    name: string
    slug: string
    description?: string
    definition?: string
    dimensionId?: string
    isActive: boolean
    isMatchEligible: boolean
    organizationId?: string
    indicatorsLow?: string
    indicatorsMid?: string
    indicatorsHigh?: string
    linkedConstructs: { constructId: string; name: string; weight: number }[]
    linkedAssessments?: LinkedAssessment[]
  }
}

export function FactorForm({
  dimensions,
  availableConstructs,
  organizations,
  mode,
  factorId,
  initialData,
}: FactorFormProps) {
  const router = useRouter()

  // --- Structural fields (participate in dirty check / form submit) ---
  const [name, setName] = useState(initialData?.name ?? "")
  const [slug, setSlug] = useState(initialData?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(mode === "edit")
  const [dimensionId, setDimensionId] = useState(initialData?.dimensionId ?? "")
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true)
  const [isMatchEligible, setIsMatchEligible] = useState(initialData?.isMatchEligible ?? true)
  const [organizationId, setOrganizationId] = useState(initialData?.organizationId ?? "")
  const [linkedConstructs, setLinkedConstructs] = useState<LinkedConstruct[]>(
    initialData?.linkedConstructs ?? []
  )

  // --- Create-mode-only local state for text fields ---
  const [createDescription, setCreateDescription] = useState(initialData?.description ?? "")
  const [createDefinition, setCreateDefinition] = useState(initialData?.definition ?? "")
  const [createIndicatorsLow, setCreateIndicatorsLow] = useState(initialData?.indicatorsLow ?? "")
  const [createIndicatorsMid, setCreateIndicatorsMid] = useState(initialData?.indicatorsMid ?? "")
  const [createIndicatorsHigh, setCreateIndicatorsHigh] = useState(initialData?.indicatorsHigh ?? "")

  // --- Auto-save hooks for text fields (edit mode only) ---
  const descriptionAutoSave = useAutoSave({
    initialValue: initialData?.description ?? "",
    onSave: (val) => updateFactorField(factorId!, "description", val),
    enabled: mode === "edit" && !!factorId,
  })

  const definitionAutoSave = useAutoSave({
    initialValue: initialData?.definition ?? "",
    onSave: (val) => updateFactorField(factorId!, "definition", val),
    enabled: mode === "edit" && !!factorId,
  })

  const indicatorsLowAutoSave = useAutoSave({
    initialValue: initialData?.indicatorsLow ?? "",
    onSave: (val) => updateFactorField(factorId!, "indicatorsLow", val),
    enabled: mode === "edit" && !!factorId,
  })

  const indicatorsMidAutoSave = useAutoSave({
    initialValue: initialData?.indicatorsMid ?? "",
    onSave: (val) => updateFactorField(factorId!, "indicatorsMid", val),
    enabled: mode === "edit" && !!factorId,
  })

  const indicatorsHighAutoSave = useAutoSave({
    initialValue: initialData?.indicatorsHigh ?? "",
    onSave: (val) => updateFactorField(factorId!, "indicatorsHigh", val),
    enabled: mode === "edit" && !!factorId,
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

  // --- Dirty tracking (structural fields only) ---
  const [savedStructural, setSavedStructural] = useState(() => ({
    name: initialData?.name ?? "",
    slug: initialData?.slug ?? "",
    dimensionId: initialData?.dimensionId ?? "",
    isActive: initialData?.isActive ?? true,
    isMatchEligible: initialData?.isMatchEligible ?? true,
    organizationId: initialData?.organizationId ?? "",
    linkedConstructs: JSON.stringify(
      (initialData?.linkedConstructs ?? []).map((c) => ({
        constructId: c.constructId,
        weight: c.weight,
      }))
    ),
  }))

  const isStructuralDirty =
    mode === "create"
      ? name.trim() !== ""
      : name !== savedStructural.name ||
        slug !== savedStructural.slug ||
        dimensionId !== savedStructural.dimensionId ||
        isActive !== savedStructural.isActive ||
        isMatchEligible !== savedStructural.isMatchEligible ||
        organizationId !== savedStructural.organizationId ||
        JSON.stringify(
          linkedConstructs.map((c) => ({
            constructId: c.constructId,
            weight: c.weight,
          }))
        ) !== savedStructural.linkedConstructs

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

  const addExistingConstruct = useCallback(
    (constructId: string) => {
      const construct = availableConstructs.find((c) => c.id === constructId)
      if (!construct) return
      if (linkedConstructs.some((lc) => lc.constructId === constructId)) return
      setLinkedConstructs((prev) => [
        ...prev,
        { constructId: construct.id, name: construct.name, weight: 1.0 },
      ])
    },
    [availableConstructs, linkedConstructs]
  )

  const removeConstruct = useCallback((constructId: string) => {
    setLinkedConstructs((prev) => prev.filter((c) => c.constructId !== constructId))
  }, [])

  const updateConstructWeight = useCallback((constructId: string, weight: number) => {
    setLinkedConstructs((prev) =>
      prev.map((c) => (c.constructId === constructId ? { ...c, weight } : c))
    )
  }, [])

  const unlinkedConstructs = availableConstructs.filter(
    (c) => !linkedConstructs.some((lc) => lc.constructId === c.id)
  )

  const deleteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  async function handleSubmit(formData: FormData) {
    formData.set(
      "constructs",
      JSON.stringify(
        linkedConstructs.map((c) => ({ constructId: c.constructId, weight: c.weight }))
      )
    )

    setPending(true)
    setSaveState("saving")
    setError(null)

    const result =
      mode === "edit" && factorId
        ? await updateFactor(factorId, formData)
        : await createFactor(formData)

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
      toast.success(mode === "create" ? "Factor created" : "Changes saved")
      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 2000)
      setSavedStructural({
        name,
        slug,
        dimensionId,
        isActive,
        isMatchEligible,
        organizationId,
        linkedConstructs: JSON.stringify(
          linkedConstructs.map((c) => ({
            constructId: c.constructId,
            weight: c.weight,
          }))
        ),
      })
      if (mode === "create" && result.slug) {
        router.replace(`/factors/${result.slug}/edit`, { scroll: false })
      }
      setPending(false)
    }
  }

  async function handleDelete() {
    if (!factorId) return
    setDeleting(true)
    const result = await deleteFactor(factorId)

    if (result && "error" in result) {
      toast.error(
        typeof result.error === "string" ? result.error : "Failed to delete"
      )
      setDeleting(false)
      return
    }

    let undone = false
    const timer = setTimeout(() => {
      if (!undone) router.push("/factors")
    }, 5000)
    deleteTimer.current = timer

    toast.success("Factor deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          undone = true
          clearTimeout(timer)
          await restoreFactor(factorId)
          toast.success("Factor restored")
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
          ? "Create Factor"
          : "Save Changes"

  const title = mode === "create" ? "Create Factor" : "Edit Factor"
  const subtitle =
    mode === "create"
      ? "Define a new behavioural factor and link it to constructs for fine-grained measurement."
      : `Update the details for \u201c${initialData?.name}\u201d.`

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
            <TabsTrigger value="relationships">
              Relationships
              {linkedConstructs.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                  {linkedConstructs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="details" keepMounted>
            <Card>
              <CardHeader>
                <CardTitle>Factor Details</CardTitle>
                <CardDescription>
                  Core information that describes this factor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="factor-name">Name</Label>
                  <Input
                    id="factor-name"
                    name="name"
                    placeholder="e.g. Strategic Thinking"
                    value={name}
                    onChange={handleNameChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="factor-slug">Slug</Label>
                  <Input
                    id="factor-slug"
                    name="slug"
                    placeholder="strategic-thinking"
                    value={slug}
                    onChange={handleSlugChange}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    URL-safe identifier. Auto-generated from the name.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="factor-description">Description</Label>
                  <Textarea
                    id="factor-description"
                    name="description"
                    placeholder="A brief description of what this factor measures..."
                    value={description}
                    onChange={
                      mode === "edit"
                        ? descriptionAutoSave.handleChange
                        : (e) => setCreateDescription(e.target.value)
                    }
                    onBlur={mode === "edit" ? descriptionAutoSave.handleBlur : undefined}
                    className="min-h-20"
                  />
                  {mode === "edit" && (
                    <AutoSaveIndicator
                      status={descriptionAutoSave.status}
                      onRetry={descriptionAutoSave.retry}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="factor-definition">Definition</Label>
                  <Textarea
                    id="factor-definition"
                    name="definition"
                    placeholder="A formal definition used in reports and documentation..."
                    value={definition}
                    onChange={
                      mode === "edit"
                        ? definitionAutoSave.handleChange
                        : (e) => setCreateDefinition(e.target.value)
                    }
                    onBlur={mode === "edit" ? definitionAutoSave.handleBlur : undefined}
                    className="min-h-20"
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

          <TabsContent value="relationships" keepMounted>
            <div className="space-y-6">
              {/* Dimension selection */}
              <Card className="border-l-[3px] border-l-dimension-accent">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="size-4 text-dimension-accent" />
                    <CardTitle>Dimension</CardTitle>
                  </div>
                  <CardDescription>
                    Optionally assign this factor to a dimension for grouping.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Dimension (optional)</Label>
                    <Select
                      name="dimensionId"
                      value={dimensionId}
                      onValueChange={(v) => setDimensionId(v ?? "")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a dimension...">
                          {(value: string) =>
                            dimensions.find((d) => d.id === value)?.name ?? value
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {dimensions.map((dim) => (
                          <SelectItem key={dim.id} value={dim.id}>
                            {dim.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {dimensionId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setDimensionId("")}
                      >
                        Clear selection
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Construct linking */}
              <Card className="border-l-[3px] border-l-trait-accent">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Dna className="size-4 text-trait-accent" />
                    <CardTitle>Linked Constructs</CardTitle>
                  </div>
                  <CardDescription>
                    Connect constructs to this factor and set their relative weights.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {unlinkedConstructs.length > 0 && (
                    <div className="space-y-2">
                      <Label>Add existing construct</Label>
                      <Select
                        onValueChange={(v) => {
                          if (v) addExistingConstruct(v)
                        }}
                        value=""
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a construct to add...">
                            {(value: string) =>
                              availableConstructs.find((c) => c.id === value)?.name ?? value
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {unlinkedConstructs.map((construct) => (
                            <SelectItem key={construct.id} value={construct.id}>
                              {construct.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {linkedConstructs.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <Dna className="size-8 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No constructs linked yet. Add constructs above.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {linkedConstructs.map((construct) => (
                        <div
                          key={construct.constructId}
                          className="flex items-start gap-3 rounded-lg border p-3"
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-trait-bg">
                            <Dna className="size-4 text-trait-accent" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {construct.name}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">
                                  Weight
                                </Label>
                                <span className="text-xs font-medium tabular-nums">
                                  {construct.weight.toFixed(1)}
                                </span>
                              </div>
                              <Slider
                                value={[Math.round(construct.weight * 100)]}
                                onValueChange={(val) => {
                                  const v = Array.isArray(val) ? val[0] : val
                                  updateConstructWeight(construct.constructId, v / 100)
                                }}
                                min={1}
                                max={200}
                                step={1}
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeConstruct(construct.constructId)}
                            className="shrink-0"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Assessment membership (edit only) */}
              {mode === "edit" && (
                <Card className="border-l-[3px] border-l-primary/30">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <ClipboardList className="size-4 text-primary/70" />
                      <CardTitle>Assessment Membership</CardTitle>
                    </div>
                    <CardDescription>
                      Assessments that include this factor.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!initialData?.linkedAssessments?.length ? (
                      <div className="flex flex-col items-center py-8 text-center">
                        <ClipboardList className="size-8 text-muted-foreground/40 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Not included in any assessments yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {initialData.linkedAssessments.map((assessment) => (
                          <div
                            key={assessment.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <span className="text-sm font-medium">
                              {assessment.name}
                            </span>
                            <Badge variant="dot">
                              <span
                                className={`size-1.5 rounded-full ${
                                  assessment.status === "active"
                                    ? "bg-emerald-500"
                                    : assessment.status === "draft"
                                      ? "bg-amber-500"
                                      : "bg-muted-foreground/40"
                                }`}
                              />
                              {assessment.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

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
                  entityName="Factor"
                  isActive={isActive}
                  onActiveChange={setIsActive}
                  onDelete={mode === "edit" && factorId ? handleDelete : undefined}
                  deleting={deleting}
                >
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="space-y-0.5">
                      <Label>Client Organisation</Label>
                      <p className="text-xs text-muted-foreground">
                        Assign to a client to mark this as their custom factor. Leave empty for platform-global.
                      </p>
                    </div>
                    <Select
                      name="organizationId"
                      value={organizationId}
                      onValueChange={(v) => setOrganizationId(v ?? "")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an organisation...">
                          {(value: string) =>
                            organizations.find((o) => o.id === value)?.name ?? value
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {organizationId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setOrganizationId("")}
                      >
                        Clear selection
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Matching Engine Eligible</Label>
                      <p className="text-xs text-muted-foreground">
                        Allow the AI matching engine to evaluate and recommend this factor.
                      </p>
                    </div>
                    <Switch
                      checked={isMatchEligible}
                      onCheckedChange={setIsMatchEligible}
                    />
                  </div>
                  <input
                    type="hidden"
                    name="isMatchEligible"
                    value={isMatchEligible ? "true" : "false"}
                  />
                </SettingsTab>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 py-4 mt-6 bg-background/80 backdrop-blur-sm -mx-4 px-4 border-t border-border/50">
          <Link href="/factors">
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
