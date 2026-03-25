"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Brain, ArrowRight } from "lucide-react"
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
import { Breadcrumbs } from "@/components/breadcrumbs"
import { IndicatorsTab } from "@/app/(dashboard)/_shared/indicators-tab"
import { SettingsTab } from "@/app/(dashboard)/_shared/settings-tab"
import {
  createDimension,
  updateDimension,
  deleteDimension,
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
  const [name, setName] = useState(dimension?.name ?? "")
  const [slug, setSlug] = useState(dimension?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(mode === "edit")
  const [description, setDescription] = useState(dimension?.description ?? "")
  const [definition, setDefinition] = useState(dimension?.definition ?? "")
  const [isActive, setIsActive] = useState(dimension?.isActive ?? true)
  const [indicatorsLow, setIndicatorsLow] = useState(dimension?.indicatorsLow ?? "")
  const [indicatorsMid, setIndicatorsMid] = useState(dimension?.indicatorsMid ?? "")
  const [indicatorsHigh, setIndicatorsHigh] = useState(dimension?.indicatorsHigh ?? "")
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const childFactors = dimension?.childFactors ?? []

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

  async function handleSubmit(formData: FormData) {
    setPending(true)
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
          : Object.values(errors).flat().join(", ")
      setError(msg ?? "Validation failed")
      setPending(false)
    }
  }

  async function handleDelete() {
    if (!dimension) return
    setDeleting(true)
    await deleteDimension(dimension.id)
  }

  const title = mode === "create" ? "Create Dimension" : "Edit Dimension"
  const subtitle =
    mode === "create"
      ? "Define a new top-level grouping for your factors."
      : `Update the details for \u201c${dimension?.name}\u201d.`

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
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-24"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dim-definition">Definition</Label>
                  <Textarea
                    id="dim-definition"
                    name="definition"
                    placeholder="A formal definition used in reports and documentation..."
                    value={definition}
                    onChange={(e) => setDefinition(e.target.value)}
                    className="min-h-24"
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
          <Button type="submit" disabled={!name.trim() || pending}>
            {pending
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create Dimension"
                : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}
