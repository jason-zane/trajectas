import { getAnchorPresets } from "@/app/actions/response-formats"
import { ResponseFormatForm } from "../response-format-form"

export default async function CreateResponseFormatPage() {
  const anchorPresets = await getAnchorPresets()
  return <ResponseFormatForm mode="create" anchorPresets={anchorPresets} />
}
