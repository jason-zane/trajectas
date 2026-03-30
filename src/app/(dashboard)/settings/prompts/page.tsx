import { PageHeader } from "@/components/page-header"
import { getPromptSummaries, getPromptVersions } from "@/app/actions/prompts"
import { PromptEditorForm } from "./prompt-editor-form"
import type { AIPromptPurpose } from "@/types/database"

const PROMPT_PURPOSES: AIPromptPurpose[] = [
  "chat",
  "item_generation",
  "preflight_analysis",
  "competency_matching",
]

export default async function PromptSettingsPage() {
  const summaries = await getPromptSummaries()
  const summaryMap = new Map(summaries.map((summary) => [summary.purpose, summary]))
  const versions = await Promise.all(
    PROMPT_PURPOSES.map(async (purpose) => ({
      purpose,
      summary: summaryMap.get(purpose) ?? null,
      versions: await getPromptVersions(purpose),
    })),
  )

  return (
    <div className="flex flex-col gap-8 p-6">
      <PageHeader
        eyebrow="Settings"
        title="AI Prompts"
        description="Edit the active system prompts that drive the live AI workflows. Saving creates a new version and activates it immediately."
      />
      <PromptEditorForm prompts={versions} />
    </div>
  )
}
