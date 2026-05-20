import { redirect } from "next/navigation"

export default async function PartnerAssessmentEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/partner/assessments/${id}/edit/overview`)
}
