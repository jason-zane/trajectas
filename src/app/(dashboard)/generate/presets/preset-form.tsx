"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import {
  createGenerationPreset,
  updateGenerationPreset,
  deleteGenerationPreset,
} from "@/app/actions/generation-presets"
import type { GenerationPreset, ResponseFormat } from "@/types/database"
import type { PresetWriteInput } from "@/lib/validations/generation"

interface PresetFormProps {
  preset?: GenerationPreset
  responseFormats: Array<{ id: string; name: string; type: string }>
}

type FormState = PresetWriteInput

function blankFormState(): FormState {
  return {
    name: "",
    description: undefined,
    measurementMode: "behavioural",
    measurementModeDescription: undefined,
    audience: {},
    useContext: "development",
    useContextDescription: undefined,
    responseFormatId: undefined,
    responseFormatRationale: undefined,
    rubric: undefined,
    exemplars: [],
    critiqueEmphasis: undefined,
    sdTolerance: undefined,
    difficultyMix: undefined,
    critiqueStrictness: "standard",
    pipelineDefaults: {
      enableItemCritique: true,
      enableLeakageGuard: true,
      enableDifficultyTargeting: false,
      enableSyntheticValidation: false,
    },
    recommendedTargetPerConstruct: 60,
  }
}

function presetToFormState(preset: GenerationPreset): FormState {
  return {
    name: preset.name,
    description: preset.description,
    measurementMode: preset.measurementMode,
    measurementModeDescription: preset.measurementModeDescription,
    audience: preset.audience,
    useContext: preset.useContext,
    useContextDescription: preset.useContextDescription,
    responseFormatId: preset.responseFormatId,
    responseFormatRationale: preset.responseFormatRationale,
    rubric: preset.rubric,
    exemplars: preset.exemplars,
    critiqueEmphasis: preset.critiqueEmphasis,
    sdTolerance: preset.sdTolerance,
    difficultyMix: preset.difficultyMix,
    critiqueStrictness: preset.critiqueStrictness,
    pipelineDefaults: preset.pipelineDefaults,
    recommendedTargetPerConstruct: preset.recommendedTargetPerConstruct,
  }
}

export function PresetForm({ preset, responseFormats }: PresetFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<FormState>(
    preset ? presetToFormState(preset) : blankFormState(),
  )
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  function patch(p: Partial<FormState>) {
    setState((s) => ({ ...s, ...p }))
  }

  function patchAudience(p: Partial<NonNullable<FormState["audience"]>>) {
    setState((s) => ({ ...s, audience: { ...s.audience, ...p } }))
  }

  function patchPipelineDefaults(
    p: Partial<FormState["pipelineDefaults"]>,
  ) {
    setState((s) => ({
      ...s,
      pipelineDefaults: { ...s.pipelineDefaults, ...p },
    }))
  }

  function addExemplar() {
    setState((s) => ({
      ...s,
      exemplars: [...(s.exemplars ?? []), { stem: "", verdict: "good", reason: "" }],
    }))
  }

  function updateExemplar(
    index: number,
    patch: Partial<NonNullable<FormState["exemplars"]>[number]>,
  ) {
    setState((s) => ({
      ...s,
      exemplars: (s.exemplars ?? []).map((ex, i) =>
        i === index ? { ...ex, ...patch } : ex,
      ),
    }))
  }

  function removeExemplar(index: number) {
    setState((s) => ({
      ...s,
      exemplars: (s.exemplars ?? []).filter((_, i) => i !== index),
    }))
  }

  function handleSave() {
    startTransition(async () => {
      const result = preset
        ? await updateGenerationPreset(preset.id, state)
        : await createGenerationPreset(state)
      if (result.ok && result.preset) {
        toast.success(preset ? "Playbook updated" : "Playbook created")
        if (!preset) {
          router.push(`/generate/presets/${result.preset.id}`)
        } else {
          router.refresh()
        }
      } else {
        setErrors(result.errors ?? {})
        toast.error(result.message ?? "Could not save playbook")
      }
    })
  }

  function handleDelete() {
    if (!preset) return
    if (!confirm("Soft-delete this playbook? It can be undone via the database.")) return
    startTransition(async () => {
      const result = await deleteGenerationPreset(preset.id)
      if (result.ok) {
        toast.success("Playbook deleted")
        router.push("/generate/presets")
      } else {
        toast.error(result.message ?? "Could not delete")
      }
    })
  }

  const fieldError = (key: string) => errors[key]?.[0]

  return (
    <div className="space-y-8">
      {/* Identity */}
      <Section title="Identity">
        <Field label="Name" error={fieldError("name")}>
          <Input
            value={state.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="e.g. Behavioural — Selection (Likert)"
          />
        </Field>
        <Field
          label="Description"
          hint="A short, admin-facing label shown in the playbook picker."
        >
          <Textarea
            rows={2}
            value={state.description ?? ""}
            onChange={(e) => patch({ description: e.target.value || undefined })}
          />
        </Field>
      </Section>

      {/* Steering defaults */}
      <Section title="Steering defaults">
        <Field label="Measurement mode">
          <Select
            value={state.measurementMode}
            onValueChange={(v) =>
              patch({ measurementMode: v as FormState["measurementMode"] })
            }
          >
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="behavioural">Behavioural</SelectItem>
              <SelectItem value="trait">Trait</SelectItem>
              <SelectItem value="capability">Capability</SelectItem>
              <SelectItem value="situational">Situational</SelectItem>
              <SelectItem value="open">Open (custom description)</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {state.measurementMode === "open" && (
          <Field
            label="Custom measurement mode description"
            error={fieldError("measurementModeDescription")}
          >
            <Textarea
              rows={3}
              value={state.measurementModeDescription ?? ""}
              onChange={(e) =>
                patch({ measurementModeDescription: e.target.value || undefined })
              }
            />
          </Field>
        )}

        <Field label="Audience">
          <div className="space-y-2">
            <Select
              value={state.audience?.level ?? "__unset__"}
              onValueChange={(v) =>
                patchAudience({
                  level: v === "__unset__" ? undefined : (v as NonNullable<FormState["audience"]>["level"]),
                })
              }
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Audience level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset__">No level set</SelectItem>
                <SelectItem value="entry">Entry / early career</SelectItem>
                <SelectItem value="mid">Mid-career</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
                <SelectItem value="executive">Executive</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
                <SelectItem value="open">Custom (free-text)</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Optional: free-text audience description"
              value={state.audience?.description ?? ""}
              onChange={(e) => patchAudience({ description: e.target.value })}
            />
          </div>
        </Field>

        <Field label="Use-context">
          <Select
            value={state.useContext}
            onValueChange={(v) =>
              patch({ useContext: v as FormState["useContext"] })
            }
          >
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="development">Development</SelectItem>
              <SelectItem value="selection">Selection</SelectItem>
              <SelectItem value="research">Research</SelectItem>
              <SelectItem value="open">Open (custom)</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {state.useContext === "open" && (
          <Field
            label="Custom use-context description"
            error={fieldError("useContextDescription")}
          >
            <Textarea
              rows={3}
              value={state.useContextDescription ?? ""}
              onChange={(e) =>
                patch({ useContextDescription: e.target.value || undefined })
              }
            />
          </Field>
        )}
      </Section>

      {/* Scale */}
      <Section title="Rating scale">
        <Field label="Recommended response format">
          <Select
            value={state.responseFormatId ?? "__unset__"}
            onValueChange={(v) =>
              patch({ responseFormatId: v && v !== "__unset__" ? v : undefined })
            }
          >
            <SelectTrigger className="w-full sm:w-96">
              <SelectValue placeholder="No format recommended" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unset__">No recommendation</SelectItem>
              {responseFormats.map((rf) => (
                <SelectItem key={rf.id} value={rf.id}>
                  {rf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Rationale"
          hint="Why this scale fits the playbook — surfaced in the configurator."
        >
          <Textarea
            rows={2}
            value={state.responseFormatRationale ?? ""}
            onChange={(e) =>
              patch({ responseFormatRationale: e.target.value || undefined })
            }
          />
        </Field>
      </Section>

      {/* Writing rubric */}
      <Section
        title="Writing rubric"
        subtitle="Markdown injected into the generation prompt. Up to ~8000 characters."
      >
        <Textarea
          rows={14}
          className="font-mono text-xs"
          value={state.rubric ?? ""}
          onChange={(e) => patch({ rubric: e.target.value || undefined })}
          placeholder="**Style rules**&#10;- Present-tense, first-person declaratives.&#10;..."
        />
      </Section>

      {/* Exemplars */}
      <Section
        title="Exemplar items"
        subtitle="Up to 12. Good examples are imitated; bad examples teach failure modes."
      >
        <div className="space-y-3">
          {(state.exemplars ?? []).map((ex, i) => (
            <Card key={i} className={cn(ex.verdict === "good" ? "border-primary/30" : "border-destructive/30")}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Select
                    value={ex.verdict}
                    onValueChange={(v) =>
                      updateExemplar(i, {
                        verdict: v as "good" | "bad",
                      })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="bad">Avoid</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeExemplar(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  placeholder="Stem"
                  value={ex.stem}
                  onChange={(e) => updateExemplar(i, { stem: e.target.value })}
                />
                <Input
                  placeholder="One-sentence reason"
                  value={ex.reason}
                  onChange={(e) => updateExemplar(i, { reason: e.target.value })}
                />
              </CardContent>
            </Card>
          ))}
          <Button type="button" variant="outline" onClick={addExemplar}>
            <Plus className="size-4" /> Add exemplar
          </Button>
        </div>
      </Section>

      {/* Critique posture */}
      <Section title="Critique posture">
        <Field
          label="Critique emphasis"
          hint="Injected into the critique prompt — direct the LLM judge."
        >
          <Textarea
            rows={3}
            value={state.critiqueEmphasis ?? ""}
            onChange={(e) =>
              patch({ critiqueEmphasis: e.target.value || undefined })
            }
          />
        </Field>
        <Field label="Critique strictness">
          <Select
            value={state.critiqueStrictness}
            onValueChange={(v) =>
              patch({
                critiqueStrictness: v as FormState["critiqueStrictness"],
              })
            }
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lenient">Lenient</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="strict">Strict</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Social-desirability tolerance">
          <Select
            value={state.sdTolerance ?? "__unset__"}
            onValueChange={(v) =>
              patch({
                sdTolerance:
                  v === "__unset__"
                    ? undefined
                    : (v as "low" | "moderate" | "high"),
              })
            }
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unset__">Not set</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      {/* Pipeline defaults */}
      <Section title="Pipeline defaults">
        <PipelineToggle
          label="Item critique"
          value={state.pipelineDefaults.enableItemCritique ?? true}
          onChange={(v) => patchPipelineDefaults({ enableItemCritique: v })}
        />
        <PipelineToggle
          label="Leakage guard"
          value={state.pipelineDefaults.enableLeakageGuard ?? true}
          onChange={(v) => patchPipelineDefaults({ enableLeakageGuard: v })}
        />
        <PipelineToggle
          label="Difficulty targeting"
          value={state.pipelineDefaults.enableDifficultyTargeting ?? false}
          onChange={(v) => patchPipelineDefaults({ enableDifficultyTargeting: v })}
        />
        <PipelineToggle
          label="Synthetic validation"
          value={state.pipelineDefaults.enableSyntheticValidation ?? false}
          onChange={(v) => patchPipelineDefaults({ enableSyntheticValidation: v })}
        />
      </Section>

      {/* Quantitative defaults */}
      <Section title="Quantitative defaults">
        <Field label={`Recommended items per construct — ${state.recommendedTargetPerConstruct}`}>
          <Slider
            min={20}
            max={120}
            value={[state.recommendedTargetPerConstruct]}
            onValueChange={(v) =>
              patch({
                recommendedTargetPerConstruct: Array.isArray(v) ? v[0] : v,
              })
            }
          />
        </Field>
      </Section>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div>
          {preset && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/generate/presets")}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : preset ? "Save changes" : "Create playbook"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Building blocks
// =============================================================================

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {hint && <p className="text-xs text-muted-foreground -mt-1">{hint}</p>}
      {children}
      {error && (
        <Badge variant="destructive" className="mt-1">
          {error}
        </Badge>
      )}
    </div>
  )
}

function PipelineToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  )
}

// Make TS happy about unused import path
export type { ResponseFormat }
