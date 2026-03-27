import { notFound } from "next/navigation"
import { getResponseFormatById, getAnchorPresets } from "@/app/actions/response-formats"
import { ResponseFormatForm } from "../../response-format-form"

export default async function EditResponseFormatPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [format, anchorPresets] = await Promise.all([
    getResponseFormatById(id),
    getAnchorPresets(),
  ])

  if (!format) notFound()

  return (
    <ResponseFormatForm
      mode="edit"
      formatId={id}
      anchorPresets={anchorPresets}
      initialData={{
        name: format.name,
        type: format.type,
        isActive: format.isActive,
        config: format.config,
      }}
    />
  )
}
