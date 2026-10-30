import { AssessmentReferences } from '@/components/norms/reference-pages'
export default async function ReferencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AssessmentReferences assessmentId={id} />
}
