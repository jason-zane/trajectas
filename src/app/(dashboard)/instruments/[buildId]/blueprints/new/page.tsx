import { CreateBlueprintForm } from './create-blueprint-form'

export const metadata = {
  title: 'Add construct'
}

interface NewBlueprintPageProps {
  params: Promise<{ buildId: string }>
}

export default async function NewBlueprintPage({ params }: NewBlueprintPageProps) {
  const { buildId } = await params
  return <CreateBlueprintForm buildId={buildId} />
}
