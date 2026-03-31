import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { getPromptVersions } from "@/app/actions/prompts"
import { PromptDetailEditor } from "./prompt-detail-editor"
import type { AIPromptPurpose } from "@/types/database"

const VALID_PURPOSES: Record<string, { label: string }> = {
  chat: { label: "Chat" },
  item_generation: { label: "Item Generation (Construct)" },
  factor_item_generation: { label: "Item Generation (Factor)" },
  preflight_analysis: { label: "Preflight Analysis" },
  competency_matching: { label: "Competency Matching" },
  ranking_explanation: { label: "Ranking Explanation" },
  diagnostic_analysis: { label: "Diagnostic Analysis" },
}

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ purpose: string }>
}) {
  const { purpose } = await params
  const meta = VALID_PURPOSES[purpose]
  if (!meta) notFound()

  const versions = await getPromptVersions(purpose as AIPromptPurpose)

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <div>
        <Link
          href="/settings/prompts"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          All Prompts
        </Link>
        <PageHeader
          eyebrow="AI Prompts"
          title={meta.label}
        />
      </div>

      <PromptDetailEditor
        purpose={purpose as AIPromptPurpose}
        label={meta.label}
        versions={versions}
      />
    </div>
  )
}
