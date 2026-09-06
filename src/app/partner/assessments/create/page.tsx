import { connection } from "next/server"
import { getContentSources } from "@/app/actions/content-sources"
import { AssessmentCreateForm } from "@/app/(dashboard)/assessments/create/create-form"

export default async function PartnerCreateAssessmentPage() {
  await connection()
  const contentSources = await getContentSources()
  return (
    <AssessmentCreateForm
      contentSources={contentSources}
      basePath="/partner/assessments"
    />
  )
}
