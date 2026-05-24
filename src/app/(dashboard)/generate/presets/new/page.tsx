import { PageHeader } from "@/components/page-header"
import { PresetForm } from "../preset-form"
import { getResponseFormatsForGeneration } from "@/app/actions/generation"

export const dynamic = "force-dynamic"

export default async function NewGenerationPresetPage() {
  const responseFormats = await getResponseFormatsForGeneration()

  return (
    <div className="container mx-auto py-8 max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Library"
        title="New playbook"
        description="Create a reusable playbook for the AI item generator."
      />
      <PresetForm responseFormats={responseFormats} />
    </div>
  )
}
