import { getContentSources } from "@/app/actions/content-sources"
import { AssessmentCreateForm } from "@/app/(dashboard)/assessments/create/create-form"

export default async function PartnerCreateAssessmentPage() {
  const contentSources = await getContentSources()
  return (
    <AssessmentCreateForm
      contentSources={contentSources}
      basePath="/partner/assessments"
    />
  )
}
