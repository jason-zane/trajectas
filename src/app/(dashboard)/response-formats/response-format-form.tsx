"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Settings2, Hash, Type, ListChecks, MessageSquare, BrainCircuit } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
import { SettingsTab } from "@/app/(dashboard)/_shared/settings-tab"
import {
  createResponseFormat,
  updateResponseFormat,
  deleteResponseFormat,
} from "@/app/actions/response-formats"
import type { AnchorPresets } from "@/app/actions/response-formats"
import type { ResponseFormatType } from "@/types/database"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResponseFormatFormProps {
  mode: "create" | "edit"
  formatId?: string
  anchorPresets: AnchorPresets
  initialData?: {
    name: string
    type: ResponseFormatType
    isActive: boolean
    config: Record<string, unknown>
  }
}

// ---------------------------------------------------------------------------
// Type-specific config panels
// ---------------------------------------------------------------------------

function LikertConfigPanel({
  config,
  onChange,
  anchorPresets,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  anchorPresets: AnchorPresets
}) {
  const points = (config.points as number) || 5
  const anchorType = (config.anchorType as string) || "agreement"
  // Normalize anchors: DB stores Record<string, string>, form uses string[]
  const rawAnchors = config.anchors
  const anchors: string[] = Array.isArray(rawAnchors)
    ? rawAnchors
    : typeof rawAnchors === "object" && rawAnchors != null
      ? Object.entries(rawAnchors as Record<string, string>)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, label]) => label)
      : anchorPresets.agreement?.[5] ?? []

  function setPoints(n: number) {
    const preset = anchorType === "custom"
      ? Array.from({ length: n }, (_, i) => anchors[i] ?? `Point ${i + 1}`)
      : (anchorPresets[anchorType]?.[n] ?? Array.from({ length: n }, (_, i) => `Point ${i + 1}`))
    onChange({ ...config, points: n, anchors: preset })
  }

  function setAnchorType(type: string) {
    const preset = type === "custom"
      ? anchors
      : (anchorPresets[type]?.[points] ?? anchors)
    onChange({ ...config, anchorType: type, anchors: preset })
  }

  function setAnchor(index: number, value: string) {
    const next = [...anchors]
    next[index] = value
    onChange({ ...config, anchors: next, anchorType: "custom" })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Number of Points</Label>
          <Select
            value={String(points)}
            onValueChange={(v) => setPoints(Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 8 }, (_, i) => i + 3).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}-point scale
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Common scales use 5 or 7 points for optimal discrimination.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Anchor Type</Label>
          <Select
            value={anchorType}
            onValueChange={(v) => setAnchorType(v ?? "agreement")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(anchorPresets).map((key) => (
                <SelectItem key={key} value={key}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose a preset or define custom labels for each point.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Anchor Labels</Label>
        <div className="space-y-2">
          {anchors.map((label, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium tabular-nums">
                {i + 1}
              </span>
              <Input
                value={label}
                onChange={(e) => setAnchor(i, e.target.value)}
                placeholder={`Label for point ${i + 1}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BinaryConfigPanel({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const trueLabel = (config.trueLabel as string) || "True"
  const falseLabel = (config.falseLabel as string) || "False"
  const trueValue = config.trueValue != null ? String(config.trueValue) : "1"
  const falseValue = config.falseValue != null ? String(config.falseValue) : "0"

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-xs font-medium text-emerald-600">
                A
              </span>
              <span className="text-sm font-medium">Option A</span>
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={trueLabel}
                onChange={(e) => onChange({ ...config, trueLabel: e.target.value })}
                placeholder="e.g. True, Yes, Agree"
              />
            </div>
            <div className="space-y-2">
              <Label>Score Value</Label>
              <Input
                type="number"
                value={trueValue}
                onChange={(e) => onChange({ ...config, trueValue: Number(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-rose-500/10 text-xs font-medium text-rose-600">
                B
              </span>
              <span className="text-sm font-medium">Option B</span>
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={falseLabel}
                onChange={(e) => onChange({ ...config, falseLabel: e.target.value })}
                placeholder="e.g. False, No, Disagree"
              />
            </div>
            <div className="space-y-2">
              <Label>Score Value</Label>
              <Input
                type="number"
                value={falseValue}
                onChange={(e) => onChange({ ...config, falseValue: Number(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SJTConfigPanel({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const scenarioCount = config.scenarioCount != null ? String(config.scenarioCount) : "4"
  const scoringMethod = (config.scoringMethod as string) || "distance"

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Options per Scenario</Label>
          <Input
            type="number"
            min={2}
            max={8}
            value={scenarioCount}
            onChange={(e) =>
              onChange({ ...config, scenarioCount: Number(e.target.value) })
            }
          />
          <p className="text-xs text-muted-foreground">
            Number of response options presented per scenario (typically 4).
          </p>
        </div>
        <div className="space-y-2">
          <Label>Scoring Method</Label>
          <Select
            value={scoringMethod}
            onValueChange={(v) => onChange({ ...config, scoringMethod: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="distance">Distance-based</SelectItem>
              <SelectItem value="consensus">Consensus-based</SelectItem>
              <SelectItem value="expert">Expert-keyed</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How candidate rankings are scored against the key.
          </p>
        </div>
      </div>
    </div>
  )
}

function ForcedChoiceConfigPanel({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const instructions = (config.instructions as string) || ""

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Instructions</Label>
        <Textarea
          value={instructions}
          onChange={(e) =>
            onChange({ ...config, instructions: e.target.value })
          }
          placeholder="e.g. Choose the statement that best describes you..."
          className="min-h-24 resize-y"
        />
        <p className="text-xs text-muted-foreground">
          Instructions shown to candidates before forced-choice items. Leave blank to use the default.
        </p>
      </div>
    </div>
  )
}

function FreeTextConfigPanel({
  config,
  onChange,
}: {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  const maxLength = config.maxLength != null ? String(config.maxLength) : "500"
  const placeholder = (config.placeholder as string) || ""

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Max Character Length</Label>
          <Input
            type="number"
            min={1}
            value={maxLength}
            onChange={(e) =>
              onChange({ ...config, maxLength: Number(e.target.value) })
            }
          />
          <p className="text-xs text-muted-foreground">
            Maximum number of characters allowed in the response.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Placeholder Text</Label>
          <Input
            value={placeholder}
            onChange={(e) =>
              onChange({ ...config, placeholder: e.target.value })
            }
            placeholder="e.g. Describe a time when..."
          />
          <p className="text-xs text-muted-foreground">
            Hint text shown inside the response field.
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Type icon mapping
// ---------------------------------------------------------------------------

const typeIcons: Record<string, typeof Settings2> = {
  likert: Hash,
  binary: Type,
  forced_choice: ListChecks,
  free_text: MessageSquare,
  sjt: BrainCircuit,
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export function ResponseFormatForm({
  mode,
  formatId,
  anchorPresets,
  initialData,
}: ResponseFormatFormProps) {
  const router = useRouter()

  const [name, setName] = useState(initialData?.name ?? "")
  const [type, setType] = useState<ResponseFormatType>(initialData?.type ?? "likert")
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true)
  const [config, setConfig] = useState<Record<string, unknown>>(
    initialData?.config && Object.keys(initialData.config).length > 0
      ? initialData.config
      : { points: 5, anchorType: "agreement", anchors: anchorPresets.agreement?.[5] ?? [] }
  )
  const [pending, setPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset config when type changes (unless editing with existing data)
  const handleTypeChange = useCallback((newType: string | null) => {
    if (!newType) return
    const t = newType as ResponseFormatType
    setType(t)

    // Provide sensible defaults for each type
    switch (t) {
      case "likert":
        setConfig({ points: 5, anchorType: "agreement", anchors: anchorPresets.agreement?.[5] ?? [] })
        break
      case "binary":
        setConfig({ trueLabel: "True", falseLabel: "False", trueValue: 1, falseValue: 0 })
        break
      case "sjt":
        setConfig({ scenarioCount: 4, scoringMethod: "distance" })
        break
      case "forced_choice":
        setConfig({ instructions: "" })
        break
      case "free_text":
        setConfig({ maxLength: 500, placeholder: "" })
        break
      default:
        setConfig({})
    }
  }, [anchorPresets])

  const TypeIcon = useMemo(() => typeIcons[type] ?? Settings2, [type])

  async function handleSubmit(formData: FormData) {
    formData.set("config", JSON.stringify(config))

    setPending(true)
    setError(null)

    const result =
      mode === "edit" && formatId
        ? await updateResponseFormat(formatId, formData)
        : await createResponseFormat(formData)

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
      return
    }

    if (mode === "create" && result && "id" in result) {
      toast.success("Response format created")
      router.replace(`/response-formats/${result.id}/edit`)
    } else {
      toast.success("Response format saved")
      setPending(false)
    }
  }

  async function handleDelete() {
    if (!formatId) return
    setDeleting(true)

    const result = await deleteResponseFormat(formatId)
    if (result?.error) {
      toast.error(typeof result.error === "string" ? result.error : "Failed to delete")
      setDeleting(false)
      return
    }

    toast.success("Response format deleted")
    router.push("/response-formats")
  }

  const title = mode === "create" ? "Create Response Format" : "Edit Response Format"
  const subtitle =
    mode === "create"
      ? "Define a new response format for assessment items."
      : "Update this response format's configuration."

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
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* ── Details tab ── */}
          <TabsContent value="details" keepMounted>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Format Identity</CardTitle>
                  <CardDescription>
                    Name and classify this response format.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="e.g. 5-Point Likert (Agreement)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      A descriptive name that identifies this format in item configuration.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      name="type"
                      value={type}
                      onValueChange={handleTypeChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="likert">Likert Scale</SelectItem>
                        <SelectItem value="forced_choice">Forced Choice</SelectItem>
                        <SelectItem value="binary">Binary</SelectItem>
                        <SelectItem value="free_text">Free Text</SelectItem>
                        <SelectItem value="sjt">Situational Judgement (SJT)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {type === "likert" && "Ordinal scale with labelled anchor points — the most common psychometric format."}
                      {type === "forced_choice" && "Candidates choose between statements matched on social desirability — reduces faking."}
                      {type === "binary" && "Two-option response — fast to complete but lower information per item."}
                      {type === "free_text" && "Open-ended text response — scored qualitatively or by AI."}
                      {type === "sjt" && "Scenario-based with ranked or rated response options — measures applied judgement."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="active-toggle">Active</Label>
                      <p className="text-xs text-muted-foreground">
                        Inactive formats are hidden when configuring items.
                      </p>
                    </div>
                    <Switch
                      id="active-toggle"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Type preview card */}
              <Card className="border-l-[3px] border-l-item-accent">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TypeIcon className="size-4 text-item-accent" />
                    <div>
                      <CardTitle>Format Preview</CardTitle>
                      <CardDescription>
                        How this format type captures responses.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {type === "likert" && (() => {
                    const anchors = config.anchors
                    // anchors can be string[] or Record<string, string> from DB
                    const entries: [string, string][] = Array.isArray(anchors)
                      ? anchors.map((a, i) => [String(i + 1), a as string])
                      : typeof anchors === "object" && anchors != null
                        ? Object.entries(anchors as Record<string, string>).sort(([a], [b]) => Number(a) - Number(b))
                        : []
                    return (
                      <div className="flex items-center gap-1">
                        {entries.map(([val, label]) => (
                          <div
                            key={val}
                            className="flex-1 rounded-lg border p-2 text-center text-xs text-muted-foreground hover:border-item-accent hover:text-foreground transition-colors"
                          >
                            <div className="font-medium tabular-nums mb-0.5">{val}</div>
                            <div className="line-clamp-1">{label}</div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                  {type === "binary" && (
                    <div className="flex gap-3">
                      <div className="flex-1 rounded-lg border p-4 text-center hover:border-item-accent transition-colors">
                        <span className="text-sm font-medium">
                          {(config.trueLabel as string) || "True"}
                        </span>
                      </div>
                      <div className="flex-1 rounded-lg border p-4 text-center hover:border-item-accent transition-colors">
                        <span className="text-sm font-medium">
                          {(config.falseLabel as string) || "False"}
                        </span>
                      </div>
                    </div>
                  )}
                  {type === "forced_choice" && (
                    <div className="space-y-2">
                      {["Statement A — measures Trait X", "Statement B — measures Trait Y", "Statement C — measures Trait Z"].map((s, i) => (
                        <div key={i} className="rounded-lg border p-3 text-sm text-muted-foreground hover:border-item-accent transition-colors">
                          {s}
                        </div>
                      ))}
                    </div>
                  )}
                  {type === "free_text" && (
                    <div className="rounded-lg border p-4 min-h-24 text-sm text-muted-foreground/60 italic">
                      {(config.placeholder as string) || "Candidate response will appear here..."}
                    </div>
                  )}
                  {type === "sjt" && (
                    <div className="space-y-2">
                      <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground italic">
                        Scenario description...
                      </div>
                      {Array.from({ length: Number(config.scenarioCount) || 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border p-2 text-sm text-muted-foreground hover:border-item-accent transition-colors">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium">
                            {String.fromCharCode(65 + i)}
                          </span>
                          Response option {i + 1}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Hidden fields */}
            <input type="hidden" name="isActive" value={isActive ? "true" : "false"} />
          </TabsContent>

          {/* ── Config tab ── */}
          <TabsContent value="config" keepMounted>
            <Card className="border-l-[3px] border-l-item-accent">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings2 className="size-4 text-item-accent" />
                  <div>
                    <CardTitle>Format Configuration</CardTitle>
                    <CardDescription>
                      {type === "likert" && "Configure the scale points and anchor labels."}
                      {type === "binary" && "Define the two response options and their scoring values."}
                      {type === "sjt" && "Set up scenario and scoring parameters."}
                      {type === "forced_choice" && "Configure forced-choice presentation settings."}
                      {type === "free_text" && "Set response constraints and placeholder text."}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {type === "likert" && (
                  <LikertConfigPanel config={config} onChange={setConfig} anchorPresets={anchorPresets} />
                )}
                {type === "binary" && (
                  <BinaryConfigPanel config={config} onChange={setConfig} />
                )}
                {type === "sjt" && (
                  <SJTConfigPanel config={config} onChange={setConfig} />
                )}
                {type === "forced_choice" && (
                  <ForcedChoiceConfigPanel config={config} onChange={setConfig} />
                )}
                {type === "free_text" && (
                  <FreeTextConfigPanel config={config} onChange={setConfig} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Settings tab ── */}
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
                  entityName="Response Format"
                  isActive={isActive}
                  onActiveChange={setIsActive}
                  onDelete={formatId ? handleDelete : undefined}
                  deleting={deleting}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 py-4 mt-6 bg-background/80 backdrop-blur-sm -mx-4 px-4 border-t border-border/50">
          <Link href="/response-formats">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={!name.trim() || pending}
          >
            {pending
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create Format"
                : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}
