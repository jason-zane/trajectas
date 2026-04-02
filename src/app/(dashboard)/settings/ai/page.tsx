import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollReveal } from "@/components/scroll-reveal"
import { TiltCard } from "@/components/tilt-card"
import { CreditsWidget } from "@/app/(dashboard)/settings/models/credits-widget"
import { ApplyToAllBar } from "./apply-to-all-bar"
import { getModelConfigs } from "@/app/actions/model-config"
import { getPromptSummaries } from "@/app/actions/prompts"
import { openRouterProvider } from "@/lib/ai/providers/openrouter"
import { PURPOSE_META, PURPOSE_ORDER } from "@/lib/ai/purpose-meta"

export default async function AiConfigurationPage() {
  const [configs, promptSummaries, textModels, embeddingModels, credits] =
    await Promise.all([
      getModelConfigs(),
      getPromptSummaries(),
      openRouterProvider.listModels("text"),
      openRouterProvider.listModels("embeddings"),
      openRouterProvider.getCredits(),
    ])

  const configMap = new Map(configs.map((c) => [c.purpose, c]))
  const promptMap = new Map(promptSummaries.map((s) => [s.purpose, s]))

  // Build a model name lookup from both text and embedding models
  const modelNameMap = new Map<string, string>()
  for (const m of [...textModels, ...embeddingModels]) {
    modelNameMap.set(m.id, m.name)
  }

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Platform Settings"
          title="AI Configuration"
          description="Manage model selection and system prompts for each AI task. Changes take effect immediately."
        />
        <CreditsWidget credits={credits} />
      </div>

      <ApplyToAllBar models={textModels} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PURPOSE_ORDER.map((purpose, index) => {
          const meta = PURPOSE_META[purpose]
          const Icon = meta.icon
          const config = configMap.get(purpose)
          const prompt = promptMap.get(purpose)
          const modelName = config
            ? modelNameMap.get(config.modelId) ?? config.modelId
            : null
          const activeVersion = prompt?.activePrompt?.version ?? null
          const isEmbedding = purpose === "embedding"

          return (
            <ScrollReveal key={purpose} delay={index * 60}>
              <TiltCard>
                <Link href={`/settings/ai/${purpose}`}>
                  <Card variant="interactive" className="group/card h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover/card:shadow-[0_0_20px_var(--glow-color)] transition-shadow duration-300"
                          style={
                            {
                              "--glow-color": meta.glowColor,
                            } as React.CSSProperties
                          }
                        >
                          <Icon className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm leading-tight">
                            {meta.label}
                          </p>
                          <p className="text-caption text-muted-foreground mt-0.5 leading-snug">
                            {meta.description}
                          </p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-1 min-w-0">
                          <p className="text-xs text-muted-foreground truncate">
                            {modelName ?? "Not configured"}
                          </p>
                          <div>
                            {isEmbedding ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-muted-foreground"
                              >
                                No prompt
                              </Badge>
                            ) : activeVersion !== null ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-primary/30 text-primary"
                              >
                                v{activeVersion}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-muted-foreground"
                              >
                                No prompt
                              </Badge>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 group-hover/card:text-foreground transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </TiltCard>
            </ScrollReveal>
          )
        })}
      </div>
    </div>
  )
}
