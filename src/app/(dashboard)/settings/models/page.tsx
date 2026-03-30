import { PageHeader } from "@/components/page-header"
import { getModelConfigs } from "@/app/actions/model-config"
import { openRouterProvider } from "@/lib/ai/providers/openrouter"
import { ModelSelectorForm } from "./model-selector-form"
import { CreditsWidget } from "./credits-widget"

export default async function ModelsSettingsPage() {
  const [configs, chatModels, embeddingModels, credits] = await Promise.all([
    getModelConfigs(),
    openRouterProvider.listModels('text'),
    openRouterProvider.listModels('embeddings'),
    openRouterProvider.getCredits(),
  ])

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Settings"
          title="AI Models"
          description="Choose which model handles each AI task. Changes take effect immediately."
        />
        <CreditsWidget credits={credits} />
      </div>
      <ModelSelectorForm
        configs={configs}
        models={chatModels}
        embeddingModels={embeddingModels}
      />
    </div>
  )
}
