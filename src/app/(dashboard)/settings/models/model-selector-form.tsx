"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Cpu, Layers, Sparkles, MessageSquare, BarChart3, Check, Loader2, ScanSearch } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollReveal } from "@/components/scroll-reveal"
import { updateModelForPurpose } from "@/app/actions/model-config"
import { ModelPickerCombobox } from "./model-picker-combobox"
import type { ModelConfigRow } from "@/app/actions/model-config"
import type { AIPromptPurpose } from "@/types/database"
import type { OpenRouterModel } from "@/types/generation"

// ---------------------------------------------------------------------------
// Purpose metadata
// ---------------------------------------------------------------------------

interface PurposeMeta {
  label: string
  description: string
  icon: React.ElementType
  glowColor: string
}

const PURPOSE_META: Record<AIPromptPurpose, PurposeMeta> = {
  item_generation: {
    label: "Item Generation",
    description: "Writes psychometric items for each construct in the AI-GENIE pipeline.",
    icon: Cpu,
    glowColor: "var(--primary)",
  },
  embedding: {
    label: "Embeddings",
    description: "Computes vector embeddings for network analysis and redundancy detection.",
    icon: Layers,
    glowColor: "var(--primary)",
  },
  competency_matching: {
    label: "Competency Matching",
    description: "Ranks competencies based on diagnostic evidence from the organisation.",
    icon: Sparkles,
    glowColor: "var(--primary)",
  },
  ranking_explanation: {
    label: "Ranking Explanation",
    description: "Generates plain-language explanations for competency rankings.",
    icon: MessageSquare,
    glowColor: "var(--primary)",
  },
  diagnostic_analysis: {
    label: "Diagnostic Analysis",
    description: "Analyses assessment results and surfaces key insights for the organisation.",
    icon: BarChart3,
    glowColor: "var(--primary)",
  },
  preflight_analysis: {
    label: "Preflight Analysis",
    description: "Checks construct similarity before item generation to detect overlap.",
    icon: ScanSearch,
    glowColor: "var(--primary)",
  },
}

const PURPOSE_ORDER: AIPromptPurpose[] = [
  "item_generation",
  "preflight_analysis",
  "embedding",
  "competency_matching",
  "ranking_explanation",
  "diagnostic_analysis",
]

// ---------------------------------------------------------------------------
// Single purpose card
// ---------------------------------------------------------------------------

function PurposeCard({
  config,
  models,
  index,
}: {
  config: ModelConfigRow
  models: OpenRouterModel[]
  index: number
}) {
  const meta = PURPOSE_META[config.purpose]
  const Icon = meta.icon

  const [selectedModel, setSelectedModel] = useState(config.modelId)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const [isPending, startTransition] = useTransition()

  const isDirty = selectedModel !== config.modelId

  function handleSave() {
    startTransition(async () => {
      setSaveState("saving")
      const result = await updateModelForPurpose(config.purpose, selectedModel)
      if ("error" in result) {
        toast.error(result.error)
        setSaveState("idle")
      } else {
        toast.success(`${meta.label} model updated`)
        setSaveState("saved")
        setTimeout(() => setSaveState("idle"), 2000)
      }
    })
  }

  return (
    <ScrollReveal delay={index * 60}>
      <Card variant="interactive" className="group/card">
        <CardHeader className="pb-4">
          <div className="flex items-start gap-3">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover/card:shadow-[0_0_20px_var(--glow-color)] transition-shadow duration-300"
              style={{ "--glow-color": meta.glowColor } as React.CSSProperties}
            >
              <Icon className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">{meta.label}</p>
              <p className="text-caption text-muted-foreground mt-0.5 leading-snug">
                {meta.description}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <ModelPickerCombobox
            value={selectedModel}
            onChange={setSelectedModel}
            models={models}
            disabled={isPending}
          />

          <div className="flex items-center justify-between gap-2">
            <p className="text-caption text-muted-foreground">
              via {config.providerName}
            </p>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || isPending || saveState === "saved"}
            >
              {isPending || saveState === "saving" ? (
                <>
                  <Loader2 className="size-3 animate-spin mr-1.5" />
                  Saving…
                </>
              ) : saveState === "saved" ? (
                <>
                  <Check className="size-3 mr-1.5" />
                  Saved
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </ScrollReveal>
  )
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

interface ModelSelectorFormProps {
  configs: ModelConfigRow[]
  models: OpenRouterModel[]
}

export function ModelSelectorForm({ configs, models }: ModelSelectorFormProps) {
  const configMap = Object.fromEntries(configs.map((c) => [c.purpose, c]))

  const orderedConfigs: ModelConfigRow[] = PURPOSE_ORDER.map((purpose) => {
    if (configMap[purpose]) return configMap[purpose]
    return {
      id: "",
      purpose,
      modelId: "anthropic/claude-sonnet-4-5",
      displayName: "Claude Sonnet 4.5",
      providerName: "OpenRouter",
      config: {},
      updatedAt: "",
    }
  })

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {orderedConfigs.map((config, i) => (
        <PurposeCard key={config.purpose} config={config} models={models} index={i} />
      ))}
    </div>
  )
}
