"use client"

import React, { useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Wand2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { ModelPickerCombobox } from "@/app/(dashboard)/settings/models/model-picker-combobox"
import { getSelectLabel } from "@/lib/select-display"

import type {
  GenerationPreset,
  MeasurementMode,
  UseContext,
  Audience,
} from "@/types/database"

export interface ScaleOption {
  id: string
  name: string
  type: string
}
import type { OpenRouterModel } from "@/types/generation"

// =============================================================================
// Public interface — minimum surface so the parent page can replace
// Step3Configure with this component.
// =============================================================================

export interface CanvasConfig {
  // Items
  targetItemsPerConstruct: number
  promptPurpose: "item_generation" | "factor_item_generation"

  // Item character
  presetId?: string
  measurementMode?: MeasurementMode
  measurementModeDescription?: string
  audience?: Audience
  useContext?: UseContext
  useContextDescription?: string

  // Rating scale
  responseFormatId?: string

  // Pipeline
  enableItemCritique: boolean
  enableLeakageGuard: boolean
  enableDifficultyTargeting: boolean
  enableSyntheticValidation: boolean

  // Models & advanced
  generationModel: string
  embeddingModel: string
  temperature: number
}

export interface ConfiguratorCanvasProps {
  config: CanvasConfig
  selectedConstructCount: number
  presets: GenerationPreset[] | null
  textModels: OpenRouterModel[]
  embeddingModels: OpenRouterModel[]
  responseFormats: ScaleOption[] | null
  onChange: (patch: Partial<CanvasConfig>) => void
  onBack: () => void
  onLaunch: () => void
  launching?: boolean
}

// =============================================================================
// Section definitions
// =============================================================================

type SectionId =
  | "items"
  | "character"
  | "scale"
  | "pipeline"
  | "models"
  | "review"

interface SectionDef {
  id: SectionId
  label: string
  description: string
}

const SECTIONS: readonly SectionDef[] = [
  {
    id: "items",
    label: "Items",
    description: "How many items, what shape of generation.",
  },
  {
    id: "character",
    label: "Item character",
    description: "Measurement mode, audience, and use-context.",
  },
  {
    id: "scale",
    label: "Rating scale",
    description: "The response format respondents will see.",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    description: "Critique, leakage guard, and other quality stages.",
  },
  {
    id: "models",
    label: "Models",
    description: "Generation model, embedding model, temperature.",
  },
  {
    id: "review",
    label: "Review & launch",
    description: "Read-only summary of what will be generated.",
  },
] as const

// =============================================================================
// Top-level component
// =============================================================================

export function ConfiguratorCanvas(props: ConfiguratorCanvasProps) {
  const {
    config,
    selectedConstructCount,
    presets,
    textModels,
    embeddingModels,
    responseFormats,
    onChange,
    onBack,
    onLaunch,
    launching,
  } = props

  const [activeSection, setActiveSection] = useState<SectionId>("items")

  const selectedPreset = useMemo(
    () => presets?.find((p) => p.id === config.presetId) ?? null,
    [presets, config.presetId],
  )

  function applyPreset(preset: GenerationPreset | null) {
    if (!preset) {
      onChange({
        presetId: undefined,
        measurementMode: undefined,
        measurementModeDescription: undefined,
        audience: undefined,
        useContext: undefined,
        useContextDescription: undefined,
      })
      return
    }
    onChange({
      presetId: preset.id,
      measurementMode: preset.measurementMode,
      measurementModeDescription: preset.measurementModeDescription,
      audience: preset.audience,
      useContext: preset.useContext,
      useContextDescription: preset.useContextDescription,
      responseFormatId: preset.responseFormatId ?? config.responseFormatId,
      targetItemsPerConstruct: preset.recommendedTargetPerConstruct,
      enableItemCritique:
        preset.pipelineDefaults.enableItemCritique ?? config.enableItemCritique,
      enableLeakageGuard:
        preset.pipelineDefaults.enableLeakageGuard ?? config.enableLeakageGuard,
      enableDifficultyTargeting:
        preset.pipelineDefaults.enableDifficultyTargeting ??
        config.enableDifficultyTargeting,
      enableSyntheticValidation:
        preset.pipelineDefaults.enableSyntheticValidation ??
        config.enableSyntheticValidation,
    })
  }

  const totalItems = selectedConstructCount * config.targetItemsPerConstruct
  const canLaunch =
    !!config.generationModel &&
    !!config.embeddingModel &&
    selectedConstructCount > 0 &&
    !launching

  const coherenceWarning = useCoherenceWarning(config, responseFormats)

  return (
    <div className="space-y-6">
      {/* Header with preset selector */}
      <div className="space-y-3">
        <p className="text-overline text-gold">Configure</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Tune the run
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a playbook to start, or configure from scratch. Every field
              remains editable.
            </p>
          </div>
          <PresetPicker
            presets={presets}
            selected={selectedPreset}
            onApply={applyPreset}
          />
        </div>
        {selectedPreset && (
          <Alert variant="info">
            <AlertTitle className="flex items-center gap-2">
              <Wand2 className="size-4" /> {selectedPreset.name}
            </AlertTitle>
            <AlertDescription>
              {selectedPreset.description ??
                "Playbook content will be injected into the generation and critique prompts at run time."}
            </AlertDescription>
          </Alert>
        )}
        {coherenceWarning && (
          <Alert variant="warning">
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>{coherenceWarning}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Section rail */}
        <nav aria-label="Configurator sections">
          <ul className="space-y-1">
            {SECTIONS.map((s) => {
              const active = s.id === activeSection
              const complete = isSectionComplete(s.id, config)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setActiveSection(s.id)}
                    className={cn(
                      "group w-full rounded-md px-3 py-2 text-left transition-all",
                      "border border-transparent",
                      active
                        ? "bg-cream/60 border-border shadow-sm"
                        : "hover:bg-cream/40",
                    )}
                    style={{
                      transitionTimingFunction: "var(--ease-spring)",
                      transitionDuration: "200ms",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <SectionStatusDot complete={complete} active={active} />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          active ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                    <p className="ml-5 mt-0.5 text-xs text-muted-foreground/80">
                      {s.description}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Section content */}
        <Card>
          <CardContent className="p-6">
            <SectionContent
              section={activeSection}
              config={config}
              presets={presets}
              selectedPreset={selectedPreset}
              textModels={textModels}
              embeddingModels={embeddingModels}
              responseFormats={responseFormats}
              selectedConstructCount={selectedConstructCount}
              totalItems={totalItems}
              onChange={onChange}
            />
          </CardContent>
        </Card>
      </div>

      {/* Footer: navigation + launch */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onBack} disabled={launching}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            <span className="font-semibold text-foreground">{totalItems}</span> items
            will be generated across {selectedConstructCount} construct
            {selectedConstructCount === 1 ? "" : "s"}
          </p>
          <Button type="button" onClick={onLaunch} disabled={!canLaunch}>
            {launching ? (
              <>Launching…</>
            ) : (
              <>
                Launch generation <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Preset picker
// =============================================================================

function PresetPicker({
  presets,
  selected,
  onApply,
}: {
  presets: GenerationPreset[] | null
  selected: GenerationPreset | null
  onApply: (preset: GenerationPreset | null) => void
}) {
  const value = selected?.id ?? "__none__"
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === "__none__") {
          onApply(null)
        } else {
          const preset = presets?.find((p) => p.id === v) ?? null
          onApply(preset)
        }
      }}
    >
      <SelectTrigger className="w-full sm:w-72">
        <SelectValue placeholder="Choose a playbook">
          {selected ? selected.name : "No playbook"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground">No playbook</span>
        </SelectItem>
        {(presets ?? []).map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <div className="flex flex-col">
              <span className="font-medium">{p.name}</span>
              {p.description && (
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {p.description}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// =============================================================================
// Status dot
// =============================================================================

function SectionStatusDot({
  complete,
  active,
}: {
  complete: boolean
  active: boolean
}) {
  if (complete) {
    return <CheckCircle2 className="size-4 text-primary" />
  }
  return (
    <div
      className={cn(
        "size-2.5 rounded-full",
        active ? "bg-foreground/80" : "bg-muted-foreground/40",
      )}
    />
  )
}

// =============================================================================
// Section content router
// =============================================================================

function SectionContent({
  section,
  config,
  presets,
  selectedPreset,
  textModels,
  embeddingModels,
  responseFormats,
  selectedConstructCount,
  totalItems,
  onChange,
}: {
  section: SectionId
  config: CanvasConfig
  presets: GenerationPreset[] | null
  selectedPreset: GenerationPreset | null
  textModels: OpenRouterModel[]
  embeddingModels: OpenRouterModel[]
  responseFormats: ScaleOption[] | null
  selectedConstructCount: number
  totalItems: number
  onChange: (patch: Partial<CanvasConfig>) => void
}) {
  switch (section) {
    case "items":
      return <ItemsSection config={config} onChange={onChange} />
    case "character":
      return <CharacterSection config={config} onChange={onChange} />
    case "scale":
      return (
        <ScaleSection
          config={config}
          responseFormats={responseFormats}
          onChange={onChange}
        />
      )
    case "pipeline":
      return <PipelineSection config={config} onChange={onChange} />
    case "models":
      return (
        <ModelsSection
          config={config}
          textModels={textModels}
          embeddingModels={embeddingModels}
          onChange={onChange}
        />
      )
    case "review":
      return (
        <ReviewSection
          config={config}
          presets={presets}
          selectedPreset={selectedPreset}
          responseFormats={responseFormats}
          textModels={textModels}
          embeddingModels={embeddingModels}
          selectedConstructCount={selectedConstructCount}
          totalItems={totalItems}
        />
      )
  }
}

// =============================================================================
// Items
// =============================================================================

function ItemsSection({
  config,
  onChange,
}: {
  config: CanvasConfig
  onChange: (patch: Partial<CanvasConfig>) => void
}) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Items" />

      <div className="space-y-2">
        <label className="text-sm font-medium">Item granularity</label>
        <Select
          value={config.promptPurpose}
          onValueChange={(v) =>
            onChange({ promptPurpose: v as CanvasConfig["promptPurpose"] })
          }
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue>
              {(value: string | null) =>
                getSelectLabel(
                  value as "item_generation" | "factor_item_generation" | null,
                  [
                    { value: "item_generation", label: "Construct" },
                    { value: "factor_item_generation", label: "Factor" },
                  ],
                )
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="item_generation">Construct</SelectItem>
            <SelectItem value="factor_item_generation">Factor</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {config.promptPurpose === "item_generation"
            ? "Narrow construct items — personality-style, measuring dispositions and tendencies."
            : "Broad factor items — behaviour-focused, measuring observable workplace capabilities."}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Items per construct</label>
          <span className="text-sm font-semibold text-primary tabular-nums">
            {config.targetItemsPerConstruct}
          </span>
        </div>
        <Slider
          min={20}
          max={80}
          value={[config.targetItemsPerConstruct]}
          onValueChange={(v) =>
            onChange({
              targetItemsPerConstruct: Array.isArray(v) ? v[0] : v,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Each construct is generated to this many candidates. Items are
          filtered down by critique, redundancy analysis, and bootstrap
          stability — typically ~60% survive.
        </p>
      </div>
    </div>
  )
}

// =============================================================================
// Item character
// =============================================================================

const MEASUREMENT_MODES: ReadonlyArray<{
  id: MeasurementMode
  label: string
  hint: string
}> = [
  {
    id: "behavioural",
    label: "Behavioural",
    hint: "Observable behaviour, present-tense first-person.",
  },
  {
    id: "trait",
    label: "Trait",
    hint: "Enduring tendencies and dispositions.",
  },
  {
    id: "capability",
    label: "Capability",
    hint: "Can-do / knowledge claims.",
  },
  {
    id: "situational",
    label: "Situational",
    hint: "Scenario stems with response options.",
  },
  { id: "open", label: "Open", hint: "Custom — describe the shape yourself." },
]

const USE_CONTEXTS: ReadonlyArray<{
  id: UseContext
  label: string
  hint: string
}> = [
  {
    id: "development",
    label: "Development",
    hint: "Formative feedback — moderate SD tolerance.",
  },
  {
    id: "selection",
    label: "Selection",
    hint: "High-stakes — low SD tolerance, observable specificity.",
  },
  {
    id: "research",
    label: "Research",
    hint: "Exploratory — full latitude.",
  },
  { id: "open", label: "Open", hint: "Custom — describe the context." },
]

const AUDIENCE_LEVELS: ReadonlyArray<{
  id: NonNullable<Audience["level"]>
  label: string
}> = [
  { id: "entry", label: "Entry / early career" },
  { id: "mid", label: "Mid-career" },
  { id: "senior", label: "Senior" },
  { id: "executive", label: "Executive" },
  { id: "mixed", label: "Mixed" },
  { id: "open", label: "Custom" },
]

function CharacterSection({
  config,
  onChange,
}: {
  config: CanvasConfig
  onChange: (patch: Partial<CanvasConfig>) => void
}) {
  return (
    <div className="space-y-8">
      <SectionHeader
        title="Item character"
        subtitle="These three dimensions are the highest-leverage steering inputs to the model."
      />

      {/* Measurement mode */}
      <Field
        label="Measurement mode"
        hint="The shape the LLM should write — declarative behaviour vs. scenario judgement vs. capability claim, etc."
      >
        <SegmentedRow
          options={MEASUREMENT_MODES.map((m) => ({ id: m.id, label: m.label }))}
          value={config.measurementMode}
          onChange={(v) =>
            onChange({ measurementMode: v as MeasurementMode | undefined })
          }
        />
        {config.measurementMode && (
          <p className="text-xs text-muted-foreground mt-2">
            {MEASUREMENT_MODES.find((m) => m.id === config.measurementMode)?.hint}
          </p>
        )}
        {config.measurementMode === "open" && (
          <Textarea
            className="mt-2"
            rows={3}
            placeholder="Describe the kind of stem you want the model to write…"
            value={config.measurementModeDescription ?? ""}
            onChange={(e) =>
              onChange({ measurementModeDescription: e.target.value })
            }
          />
        )}
      </Field>

      {/* Audience */}
      <Field
        label="Audience"
        hint="Reading level and example contextualisation."
      >
        <Select
          value={config.audience?.level ?? "__unset__"}
          onValueChange={(v) =>
            onChange({
              audience: {
                ...config.audience,
                level: v === "__unset__" ? undefined : (v as Audience["level"]),
              },
            })
          }
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Pick an audience level">
              {config.audience?.level
                ? AUDIENCE_LEVELS.find((a) => a.id === config.audience?.level)
                    ?.label
                : "Pick an audience level"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unset__">
              <span className="text-muted-foreground">Not set</span>
            </SelectItem>
            {AUDIENCE_LEVELS.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="mt-2"
          placeholder="Optional: free-text description of the audience"
          value={config.audience?.description ?? ""}
          onChange={(e) =>
            onChange({
              audience: { ...config.audience, description: e.target.value },
            })
          }
        />
      </Field>

      {/* Use-context */}
      <Field
        label="Use-context"
        hint="What the items are for — affects SD posture and framing."
      >
        <SegmentedRow
          options={USE_CONTEXTS.map((c) => ({ id: c.id, label: c.label }))}
          value={config.useContext}
          onChange={(v) =>
            onChange({ useContext: v as UseContext | undefined })
          }
        />
        {config.useContext && (
          <p className="text-xs text-muted-foreground mt-2">
            {USE_CONTEXTS.find((c) => c.id === config.useContext)?.hint}
          </p>
        )}
        {config.useContext === "open" && (
          <Textarea
            className="mt-2"
            rows={3}
            placeholder="Describe how items will be used…"
            value={config.useContextDescription ?? ""}
            onChange={(e) =>
              onChange({ useContextDescription: e.target.value })
            }
          />
        )}
      </Field>
    </div>
  )
}

// =============================================================================
// Rating scale
// =============================================================================

function ScaleSection({
  config,
  responseFormats,
  onChange,
}: {
  config: CanvasConfig
  responseFormats: ScaleOption[] | null
  onChange: (patch: Partial<CanvasConfig>) => void
}) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Rating scale"
        subtitle="The response format respondents will see — and the rules the LLM applies when writing stems."
      />
      <Field label="Response format">
        <Select
          value={config.responseFormatId ?? "__unset__"}
          onValueChange={(v) =>
            onChange({
              responseFormatId: v && v !== "__unset__" ? v : undefined,
            })
          }
        >
          <SelectTrigger className="w-full sm:w-96">
            <SelectValue placeholder="Pick a rating scale">
              {responseFormats?.find((rf) => rf.id === config.responseFormatId)
                ?.name ?? "Pick a rating scale"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unset__">
              <span className="text-muted-foreground">No specific scale</span>
            </SelectItem>
            {(responseFormats ?? []).map((rf) => (
              <SelectItem key={rf.id} value={rf.id}>
                {rf.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {config.responseFormatId && (
          <ScalePreview
            format={
              responseFormats?.find((rf) => rf.id === config.responseFormatId) ??
              null
            }
            measurementMode={config.measurementMode}
          />
        )}
      </Field>
    </div>
  )
}

function ScalePreview({
  format,
  measurementMode,
}: {
  format: ScaleOption | null
  measurementMode?: MeasurementMode
}) {
  if (!format) return null
  const example = scaleExample(format.type, measurementMode)
  return (
    <Card className="mt-3 bg-cream/40 border-dashed">
      <CardContent className="p-4">
        <p className="text-overline text-gold mb-2">Example item</p>
        <p className="text-sm italic">"{example}"</p>
      </CardContent>
    </Card>
  )
}

function scaleExample(
  type: string,
  mode?: MeasurementMode,
): string {
  if (type === "sjt")
    return "You are leading a project that is one week from launch. A key teammate calls in sick. Rank the following responses…"
  if (type === "binary")
    return "I have led a cross-functional project from start to finish. (Yes / No)"
  if (type === "forced_choice")
    return "Which is more like you? A) I plan in detail before starting. B) I learn by doing."
  if (mode === "capability")
    return "I can build a financial forecast from a P&L and 3-year history without help."
  if (mode === "situational")
    return "When a deadline slips on someone else's task, I usually..."
  // default: likert / agreement
  return "I write up notes within an hour of a meeting ending."
}

// =============================================================================
// Pipeline
// =============================================================================

function PipelineSection({
  config,
  onChange,
}: {
  config: CanvasConfig
  onChange: (patch: Partial<CanvasConfig>) => void
}) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Pipeline"
        subtitle="Quality stages applied after generation. Defaults respect the active playbook."
      />
      <Toggle
        label="Item critique"
        description="A second LLM judges each batch and keeps / revises / drops items."
        checked={config.enableItemCritique}
        onChange={(v) => onChange({ enableItemCritique: v })}
      />
      <Toggle
        label="Leakage guard"
        description="Items whose embeddings drift toward a sibling construct are flagged and dropped before downstream analysis."
        checked={config.enableLeakageGuard}
        onChange={(v) => onChange({ enableLeakageGuard: v })}
      />
      <Toggle
        label="Difficulty targeting"
        description="Compute per-item difficulty estimates and steer batches toward the target mix."
        checked={config.enableDifficultyTargeting}
        onChange={(v) => onChange({ enableDifficultyTargeting: v })}
      />
      <Toggle
        label="Synthetic validation"
        description="Simulate respondent data and estimate Cronbach's α across constructs."
        checked={config.enableSyntheticValidation}
        onChange={(v) => onChange({ enableSyntheticValidation: v })}
      />
    </div>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// =============================================================================
// Models & advanced
// =============================================================================

function ModelsSection({
  config,
  textModels,
  embeddingModels,
  onChange,
}: {
  config: CanvasConfig
  textModels: OpenRouterModel[]
  embeddingModels: OpenRouterModel[]
  onChange: (patch: Partial<CanvasConfig>) => void
}) {
  const selectedGen = textModels.find((m) => m.id === config.generationModel)
  const supportsTemperature =
    selectedGen?.supported_parameters?.includes("temperature") ?? true

  return (
    <div className="space-y-6">
      <SectionHeader title="Models & advanced" />

      <Field label="Generation model">
        <ModelPickerCombobox
          models={textModels}
          value={config.generationModel}
          onChange={(v) => onChange({ generationModel: v })}
        />
      </Field>

      <Field label="Embedding model">
        <ModelPickerCombobox
          models={embeddingModels}
          value={config.embeddingModel}
          onChange={(v) => onChange({ embeddingModel: v })}
        />
      </Field>

      {supportsTemperature && (
        <Field
          label="Temperature"
          hint="Higher = more variety, lower = more consistent. Sensible range: 0.6-1.1."
        >
          <div className="flex items-center gap-4">
            <Slider
              min={0.5}
              max={1.5}
              step={0.05}
              value={[config.temperature]}
              onValueChange={(v) =>
                onChange({ temperature: Array.isArray(v) ? v[0] : v })
              }
              className="flex-1"
            />
            <span className="text-sm font-semibold tabular-nums w-12 text-right">
              {config.temperature.toFixed(2)}
            </span>
          </div>
        </Field>
      )}
    </div>
  )
}

// =============================================================================
// Review
// =============================================================================

function ReviewSection({
  config,
  presets,
  selectedPreset,
  responseFormats,
  textModels,
  embeddingModels,
  selectedConstructCount,
  totalItems,
}: {
  config: CanvasConfig
  presets: GenerationPreset[] | null
  selectedPreset: GenerationPreset | null
  responseFormats: ScaleOption[] | null
  textModels: OpenRouterModel[]
  embeddingModels: OpenRouterModel[]
  selectedConstructCount: number
  totalItems: number
}) {
  void presets
  const scaleName =
    responseFormats?.find((rf) => rf.id === config.responseFormatId)?.name ??
    "Not set"
  const genModelName =
    textModels.find((m) => m.id === config.generationModel)?.name ??
    config.generationModel
  const embModelName =
    embeddingModels.find((m) => m.id === config.embeddingModel)?.name ??
    config.embeddingModel

  return (
    <div className="space-y-5">
      <SectionHeader title="Review & launch" />

      <ReviewRow label="Playbook">
        {selectedPreset ? (
          <Badge variant="outline">{selectedPreset.name}</Badge>
        ) : (
          <span className="text-muted-foreground">No playbook</span>
        )}
      </ReviewRow>

      <ReviewRow label="Constructs">
        <span className="tabular-nums font-medium">{selectedConstructCount}</span>
      </ReviewRow>

      <ReviewRow label="Items per construct">
        <span className="tabular-nums font-medium">
          {config.targetItemsPerConstruct}
        </span>
      </ReviewRow>

      <ReviewRow label="Total candidates">
        <span className="tabular-nums font-semibold text-primary">
          {totalItems}
        </span>
      </ReviewRow>

      <ReviewRow label="Measurement mode">
        {config.measurementMode ? (
          <Badge variant="secondary">{config.measurementMode}</Badge>
        ) : (
          <span className="text-muted-foreground">Default (behavioural)</span>
        )}
      </ReviewRow>

      <ReviewRow label="Audience">
        {config.audience?.level ? (
          <span>
            <Badge variant="secondary">{config.audience.level}</Badge>
            {config.audience.description && (
              <span className="text-muted-foreground ml-2 text-sm">
                — {config.audience.description}
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Not set</span>
        )}
      </ReviewRow>

      <ReviewRow label="Use-context">
        {config.useContext ? (
          <Badge variant="secondary">{config.useContext}</Badge>
        ) : (
          <span className="text-muted-foreground">Not set</span>
        )}
      </ReviewRow>

      <ReviewRow label="Rating scale">{scaleName}</ReviewRow>

      <ReviewRow label="Pipeline stages">
        <div className="flex flex-wrap gap-1">
          {config.enableItemCritique && <Badge variant="outline">Critique</Badge>}
          {config.enableLeakageGuard && (
            <Badge variant="outline">Leakage guard</Badge>
          )}
          {config.enableDifficultyTargeting && (
            <Badge variant="outline">Difficulty targeting</Badge>
          )}
          {config.enableSyntheticValidation && (
            <Badge variant="outline">Synthetic validation</Badge>
          )}
          {!config.enableItemCritique &&
            !config.enableLeakageGuard &&
            !config.enableDifficultyTargeting &&
            !config.enableSyntheticValidation && (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
                <CircleSlash className="size-3" /> None enabled
              </span>
            )}
        </div>
      </ReviewRow>

      <ReviewRow label="Generation model">
        <span className="font-mono text-xs">{genModelName}</span>
      </ReviewRow>

      <ReviewRow label="Embedding model">
        <span className="font-mono text-xs">{embModelName}</span>
      </ReviewRow>

      <ReviewRow label="Temperature">
        <span className="tabular-nums">{config.temperature.toFixed(2)}</span>
      </ReviewRow>
    </div>
  )
}

function ReviewRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-b-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

// =============================================================================
// Small building blocks
// =============================================================================

function SectionHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {hint && <p className="text-xs text-muted-foreground -mt-1">{hint}</p>}
      {children}
    </div>
  )
}

function SegmentedRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ id: T; label: string }>
  value: T | undefined
  onChange: (v: T | undefined) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(active ? undefined : o.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-border bg-card text-foreground hover:bg-cream/60",
            )}
            style={{
              transitionTimingFunction: "var(--ease-spring)",
              transitionDuration: "200ms",
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// =============================================================================
// Section completion + coherence warning
// =============================================================================

function isSectionComplete(section: SectionId, config: CanvasConfig): boolean {
  switch (section) {
    case "items":
      return config.targetItemsPerConstruct >= 20
    case "character":
      return (
        !!config.measurementMode &&
        (config.measurementMode !== "open" ||
          !!config.measurementModeDescription?.trim())
      )
    case "scale":
      return !!config.responseFormatId
    case "pipeline":
      return true // pipeline always has defaults
    case "models":
      return !!config.generationModel && !!config.embeddingModel
    case "review":
      return false
  }
}

function useCoherenceWarning(
  config: CanvasConfig,
  responseFormats: ScaleOption[] | null,
): string | null {
  // Capability + agreement (likert) is usually wrong
  const scale = responseFormats?.find((rf) => rf.id === config.responseFormatId)
  if (
    config.measurementMode === "capability" &&
    scale?.type === "likert"
  ) {
    return "Capability items typically work better with accuracy or frequency scales than agreement Likert."
  }
  if (
    config.measurementMode === "situational" &&
    scale &&
    scale.type !== "sjt" &&
    scale.type !== "forced_choice"
  ) {
    return "Situational stems usually pair with an SJT or forced-choice response format."
  }
  return null
}
