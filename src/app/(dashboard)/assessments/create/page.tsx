import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { connection } from "next/server"
import { getContentSources } from "@/app/actions/content-sources"
import { AssessmentCreateForm } from "./create-form"

export default async function CreateAssessmentPage() {
  if (!await isWorkspaceFeatureEnabled('assessmentAuthoring')) return <WorkspaceFeatureUnavailable feature="assessmentAuthoring" />

  await connection()
  const contentSources = await getContentSources()
  return <AssessmentCreateForm contentSources={contentSources} />
}
