"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Brain, FileQuestion, ArrowRight, Plus } from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import { IndicatorsTab } from "@/app/(dashboard)/_shared/indicators-tab"
import { SettingsTab } from "@/app/(dashboard)/_shared/settings-tab"
import {
  createConstruct,
  updateConstruct,
  deleteConstruct,
} from "@/app/actions/constructs"
import type { ConstructWithRelationships } from "@/app/actions/constructs"

const formatLabels: Record<string, string> = {
  likert: "Likert",
  forced_choice: "Forced Choice",
  binary: "Binary",
  free_text: "Free Text",
  sjt: "SJT",
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

interface ConstructFormProps {
  mode: "create" | "edit"
  construct?: ConstructWithRelationships
}

export function ConstructForm({ mode, construct }: ConstructFormProps) {
  const [name, setName] = useState(construct?.name ?? "")
  const [slug, setSlug] = useState(construct?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(mode === "edit")
  const [description, setDescription] = useState(construct?.description ?? "")
  const [definition, setDefinition] = useState(construct?.definition ?? "")
  const [isActive, setIsActive] = useState(construct?.isActive ?? true)
  const [indicatorsLow, setIndicatorsLow] = useState(construct?.indicatorsLow ?? "")
  const [indicatorsMid, setIndicatorsMid] = useState(construct?.indicatorsMid ?? "")
  const [indicatorsHigh, setIndicatorsHigh] = useState(construct?.indicatorsHigh ?? "")
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parentFactors = construct?.parentFactors ?? []
  const linkedItems = construct?.linkedItems ?? []

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
      mode === "edit" && construct
        ? await updateConstruct(construct.id, formData)
        : await createConstruct(formData)
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
    if (!construct) return
    setDeleting(true)
    await deleteConstruct(construct.id)
  }

  const title = mode === "create" ? "Create Construct" : "Edit Construct"
  const subtitle =
    mode === "create"
      ? "Define a new measurable attribute for fine-grained measurement within factors."
      : `Update the details for \u201c${construct?.name}\u201d.`

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
              <TabsTrigger value="items">
                Items
                {linkedItems.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                    {linkedItems.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {mode === "edit" && (
              <TabsTrigger value="relationships">
                Relationships
                {parentFactors.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                    {parentFactors.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="details" keepMounted>
            <Card className="border-l-[3px] border-l-trait-accent">
              <CardHeader>
                <CardTitle>Construct Details</CardTitle>
                <CardDescription>
                  Core information that defines this construct.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="construct-name">Name</Label>
                  <Input
                    id="construct-name"
                    name="name"
                    placeholder="e.g. Analytical Reasoning"
                    value={name}
                    onChange={handleNameChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="construct-slug">Slug</Label>
                  <Input
                    id="construct-slug"
                    name="slug"
                    placeholder="analytical-reasoning"
                    value={slug}
                    onChange={handleSlugChange}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    URL-safe identifier. Auto-generated from the name.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="construct-description">Description</Label>
                  <Textarea
                    id="construct-description"
                    name="description"
                    placeholder="Describe what this construct measures..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-24"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="construct-definition">Definition</Label>
                  <Textarea
                    id="construct-definition"
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
            <TabsContent value="items">
              <Card className="border-l-[3px] border-l-item-accent">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileQuestion className="size-4 text-item-accent" />
                      <div>
                        <CardTitle>Items</CardTitle>
                        <CardDescription>
                          Assessment items that target this construct.
                        </CardDescription>
                      </div>
                    </div>
                    {construct?.slug && (
                      <Link href={`/items/create?constructSlug=${construct.slug}`}>
                        <Button type="button" variant="outline" size="sm">
                          <Plus className="size-4" />
                          Add Item
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {linkedItems.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <FileQuestion className="size-8 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground mb-4">
                        No items target this construct yet.
                      </p>
                      {construct?.slug && (
                        <Link href={`/items/create?constructSlug=${construct.slug}`}>
                          <Button type="button" variant="outline" size="sm">
                            <Plus className="size-4" />
                            Create First Item
                          </Button>
                        </Link>
                      )}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Stem</TableHead>
                          <TableHead className="w-24">Format</TableHead>
                          <TableHead className="w-24">Status</TableHead>
                          <TableHead className="w-16" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linkedItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="max-w-md">
                              <p className="text-sm line-clamp-2">{item.stem}</p>
                            </TableCell>
                            <TableCell>
                              {item.responseFormatType && (
                                <Badge variant="item">
                                  {formatLabels[item.responseFormatType] ?? item.responseFormatType}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.status === "active"
                                    ? "default"
                                    : item.status === "draft"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Link href={`/items/${item.id}/edit?returnTo=/constructs/${construct?.slug}/edit`}>
                                <Button type="button" variant="ghost" size="icon-xs">
                                  <ArrowRight className="size-3.5" />
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {mode === "edit" && (
            <TabsContent value="relationships">
              <Card className="border-l-[3px] border-l-competency-accent">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Brain className="size-4 text-competency-accent" />
                    <div>
                      <CardTitle>Parent Factors</CardTitle>
                      <CardDescription>
                        Factors that include this construct in their measurement model.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {parentFactors.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-center">
                      <Brain className="size-8 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        This construct is not linked to any factors yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {parentFactors.map((factor) => (
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
                  entityName="Construct"
                  isActive={isActive}
                  onActiveChange={setIsActive}
                  onDelete={mode === "edit" ? handleDelete : undefined}
                  deleting={deleting}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 py-4 mt-6 bg-background/80 backdrop-blur-sm -mx-4 px-4 border-t border-border/50">
          <Link href="/constructs">
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
                ? "Create Construct"
                : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}
