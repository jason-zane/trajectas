"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Plus, X, Dna, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
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
import { Breadcrumbs } from "@/components/breadcrumbs"
import { IndicatorsTab } from "@/app/(dashboard)/_shared/indicators-tab"
import { SettingsTab } from "@/app/(dashboard)/_shared/settings-tab"
import {
  createCompetency,
  updateCompetency,
  deleteCompetency,
} from "@/app/actions/competencies"
import type { SelectOption } from "@/app/actions/competencies"

interface LinkedTrait {
  traitId: string
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

interface CompetencyFormProps {
  dimensions: SelectOption[]
  availableTraits: SelectOption[]
  mode: "create" | "edit"
  competencyId?: string
  initialData?: {
    name: string
    slug: string
    description?: string
    definition?: string
    dimensionId?: string
    isActive: boolean
    indicatorsLow?: string
    indicatorsMid?: string
    indicatorsHigh?: string
    linkedTraits: { traitId: string; name: string; weight: number }[]
  }
}

export function CompetencyForm({
  dimensions,
  availableTraits,
  mode,
  competencyId,
  initialData,
}: CompetencyFormProps) {
  const [name, setName] = useState(initialData?.name ?? "")
  const [slug, setSlug] = useState(initialData?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(mode === "edit")
  const [description, setDescription] = useState(initialData?.description ?? "")
  const [definition, setDefinition] = useState(initialData?.definition ?? "")
  const [dimensionId, setDimensionId] = useState(initialData?.dimensionId ?? "")
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true)
  const [indicatorsLow, setIndicatorsLow] = useState(initialData?.indicatorsLow ?? "")
  const [indicatorsMid, setIndicatorsMid] = useState(initialData?.indicatorsMid ?? "")
  const [indicatorsHigh, setIndicatorsHigh] = useState(initialData?.indicatorsHigh ?? "")
  const [linkedTraits, setLinkedTraits] = useState<LinkedTrait[]>(
    initialData?.linkedTraits ?? []
  )
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const addExistingTrait = useCallback(
    (traitId: string) => {
      const trait = availableTraits.find((t) => t.id === traitId)
      if (!trait) return
      if (linkedTraits.some((lt) => lt.traitId === traitId)) return
      setLinkedTraits((prev) => [
        ...prev,
        { traitId: trait.id, name: trait.name, weight: 1.0 },
      ])
    },
    [availableTraits, linkedTraits]
  )

  const removeTrait = useCallback((traitId: string) => {
    setLinkedTraits((prev) => prev.filter((t) => t.traitId !== traitId))
  }, [])

  const updateTraitWeight = useCallback((traitId: string, weight: number) => {
    setLinkedTraits((prev) =>
      prev.map((t) => (t.traitId === traitId ? { ...t, weight } : t))
    )
  }, [])

  const unlinkedTraits = availableTraits.filter(
    (t) => !linkedTraits.some((lt) => lt.traitId === t.id)
  )

  async function handleSubmit(formData: FormData) {
    formData.set(
      "traits",
      JSON.stringify(
        linkedTraits.map((t) => ({ traitId: t.traitId, weight: t.weight }))
      )
    )

    setPending(true)
    setError(null)

    const result =
      mode === "edit" && competencyId
        ? await updateCompetency(competencyId, formData)
        : await createCompetency(formData)

    if (result?.error) {
      const errors = result.error
      const msg =
        typeof errors === "object" && "_form" in errors
          ? (errors as Record<string, string[]>)._form?.[0]
          : Object.values(errors).flat().join(", ")
      setError(msg ?? "Validation failed")
      setPending(false)
    }
  }

  async function handleDelete() {
    if (!competencyId) return
    setDeleting(true)
    await deleteCompetency(competencyId)
  }

  const title = mode === "create" ? "Create Factor" : "Edit Factor"
  const subtitle =
    mode === "create"
      ? "Define a new behavioural factor and link it to constructs for fine-grained measurement."
      : `Update the details for \u201c${initialData?.name}\u201d.`

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <Breadcrumbs className="mb-4" />
        <PageHeader title={title} description={subtitle} />
      </div>

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
              {linkedTraits.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                  {linkedTraits.length}
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
                    placeholder="A brief description of what this competency measures..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="factor-definition">Definition</Label>
                  <Textarea
                    id="factor-definition"
                    name="definition"
                    placeholder="A formal definition used in reports and documentation..."
                    value={definition}
                    onChange={(e) => setDefinition(e.target.value)}
                    className="min-h-20"
                  />
                  <p className="text-xs text-muted-foreground">
                    A more formal, detailed definition for use in assessment reports.
                  </p>
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
                  onChangeLow={setIndicatorsLow}
                  onChangeMid={setIndicatorsMid}
                  onChangeHigh={setIndicatorsHigh}
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
                  {unlinkedTraits.length > 0 && (
                    <div className="space-y-2">
                      <Label>Add existing construct</Label>
                      <Select
                        onValueChange={(v) => {
                          if (v) addExistingTrait(v)
                        }}
                        value=""
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a construct to add...">
                            {(value: string) =>
                              availableTraits.find((t) => t.id === value)?.name ?? value
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {unlinkedTraits.map((trait) => (
                            <SelectItem key={trait.id} value={trait.id}>
                              {trait.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {linkedTraits.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <Dna className="size-8 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No constructs linked yet. Add constructs above.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {linkedTraits.map((trait) => (
                        <div
                          key={trait.traitId}
                          className="flex items-start gap-3 rounded-lg border p-3"
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-trait-bg">
                            <Dna className="size-4 text-trait-accent" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {trait.name}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">
                                  Weight
                                </Label>
                                <span className="text-xs font-medium tabular-nums">
                                  {trait.weight.toFixed(1)}
                                </span>
                              </div>
                              <Slider
                                value={[Math.round(trait.weight * 100)]}
                                onValueChange={(val) => {
                                  const v = Array.isArray(val) ? val[0] : val
                                  updateTraitWeight(trait.traitId, v / 100)
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
                            onClick={() => removeTrait(trait.traitId)}
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
                  onDelete={mode === "edit" && competencyId ? handleDelete : undefined}
                  deleting={deleting}
                />
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
          <Button type="submit" disabled={!name.trim() || pending}>
            {pending
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create Factor"
                : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}
