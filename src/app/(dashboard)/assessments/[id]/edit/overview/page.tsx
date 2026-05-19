import { notFound } from "next/navigation"
import { getAssessmentById } from "@/app/actions/assessments"
import { getContentSources } from "@/app/actions/content-sources"
import { OverviewForm } from "./overview-form"

export default async function AssessmentOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [assessment, contentSources] = await Promise.all([
    getAssessmentById(id),
    getContentSources(),
  ])

  if (!assessment) notFound()

  return <OverviewForm assessment={assessment} contentSources={contentSources} />
}
