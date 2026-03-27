import { getResponseFormats } from "@/app/actions/response-formats"
import { ResponseFormatList } from "./response-format-list"

export default async function ResponseFormatsPage() {
  const formats = await getResponseFormats()

  return <ResponseFormatList formats={formats} />
}
