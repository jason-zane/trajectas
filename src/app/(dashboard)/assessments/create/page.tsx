import { connection } from "next/server"
import { getContentSources } from "@/app/actions/content-sources"
import { AssessmentCreateForm } from "./create-form"

export default async function CreateAssessmentPage() {
  await connection()
  const contentSources = await getContentSources()
  return <AssessmentCreateForm contentSources={contentSources} />
}
