import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { notFound } from "next/navigation"
import { getAssessmentById } from "@/app/actions/assessments"
import { getContentSources } from "@/app/actions/content-sources"
import { OverviewForm } from "./overview-form"

export default async function AssessmentOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!await isWorkspaceFeatureEnabled('assessmentAuthoring')) return <WorkspaceFeatureUnavailable feature="assessmentAuthoring" />

  const { id } = await params
  const [assessment, contentSources] = await Promise.all([
    getAssessmentById(id),
    getContentSources(),
  ])

  if (!assessment) notFound()

  return <OverviewForm assessment={assessment} contentSources={contentSources} />
}
