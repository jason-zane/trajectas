import { getContentSources } from "@/app/actions/content-sources"
import { DimensionForm } from "../dimension-form"

export default async function CreateDimensionPage() {
  const contentSources = await getContentSources()
  return <DimensionForm mode="create" contentSources={contentSources} />
}
