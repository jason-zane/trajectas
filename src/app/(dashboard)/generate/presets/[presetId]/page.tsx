import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { PresetForm } from "../preset-form"
import {
  getGenerationPreset,
} from "@/app/actions/generation-presets"
import { getResponseFormatsForGeneration } from "@/app/actions/generation"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

export default async function EditGenerationPresetPage({
  params,
}: {
  params: Promise<{ presetId: string }>
}) {
  const { presetId } = await params
  const [preset, responseFormats] = await Promise.all([
    getGenerationPreset(presetId),
    getResponseFormatsForGeneration(),
  ])

  if (!preset) {
    notFound()
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          eyebrow="Library"
          title={preset.name}
          description={preset.description ?? "Edit playbook content."}
        />
        <div className="flex flex-wrap gap-1 mt-2">
          <Badge variant="secondary" className="capitalize">
            {preset.measurementMode}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {preset.useContext}
          </Badge>
        </div>
      </div>
      <PresetForm preset={preset} responseFormats={responseFormats} />
    </div>
  )
}
