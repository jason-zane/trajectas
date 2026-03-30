import { PageHeader } from "@/components/page-header"
import { getModelConfigs } from "@/app/actions/model-config"
import { openRouterProvider } from "@/lib/ai/providers/openrouter"
import { ModelSelectorForm } from "./model-selector-form"

export default async function ModelsSettingsPage() {
  const [configs, models] = await Promise.all([
    getModelConfigs(),
    openRouterProvider.listModels(),
  ])

  return (
    <div className="flex flex-col gap-8 p-6">
      <PageHeader
        eyebrow="Settings"
        title="AI Models"
        description="Choose which model handles each AI task. Changes take effect immediately."
      />
      <ModelSelectorForm configs={configs} models={models} />
    </div>
  )
}
