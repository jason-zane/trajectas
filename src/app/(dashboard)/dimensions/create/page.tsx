import { connection } from "next/server"
import { getContentSources } from "@/app/actions/content-sources"
import { DimensionForm } from "../dimension-form"

export default async function CreateDimensionPage() {
  await connection()
  const contentSources = await getContentSources()
  return <DimensionForm mode="create" contentSources={contentSources} />
}
