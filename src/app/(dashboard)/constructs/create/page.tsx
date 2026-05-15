import { ConstructForm } from "../construct-form"
import { getFactorsForSelect } from "@/app/actions/constructs"
import { getContentSources } from "@/app/actions/content-sources"

export default async function CreateConstructPage() {
  const [factors, contentSources] = await Promise.all([
    getFactorsForSelect(),
    getContentSources(),
  ])
  return <ConstructForm mode="create" availableFactors={factors} contentSources={contentSources} />
}
