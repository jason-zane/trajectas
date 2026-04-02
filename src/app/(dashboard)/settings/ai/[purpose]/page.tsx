import { redirect } from "next/navigation"
import { getModelConfigs } from "@/app/actions/model-config"
import { getPromptVersions } from "@/app/actions/prompts"
import { openRouterProvider } from "@/lib/ai/providers/openrouter"
import { PURPOSE_ORDER } from "@/lib/ai/purpose-meta"
import { AiPurposeDetail } from "./ai-purpose-detail"
import type { AIPromptPurpose } from "@/types/database"

export default async function AiPurposeDetailPage({
  params,
}: {
  params: Promise<{ purpose: string }>
}) {
  const { purpose } = await params

  // Validate the purpose param
  if (!PURPOSE_ORDER.includes(purpose as AIPromptPurpose)) {
    redirect("/settings/ai")
  }

  const typedPurpose = purpose as AIPromptPurpose
  const isEmbedding = typedPurpose === "embedding"

  const [configs, versions, models] = await Promise.all([
    getModelConfigs(),
    isEmbedding ? Promise.resolve([]) : getPromptVersions(typedPurpose),
    isEmbedding
      ? openRouterProvider.listModels("embeddings")
      : openRouterProvider.listModels("text"),
  ])

  const currentConfig = configs.find((c) => c.purpose === typedPurpose) ?? null

  return (
    <AiPurposeDetail
      purpose={typedPurpose}
      currentModelConfig={currentConfig}
      promptVersions={versions}
      availableModels={models}
    />
  )
}
