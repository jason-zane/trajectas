import { notFound } from 'next/navigation'
import { getBlueprintDetail } from '@/app/actions/instrument'
import { BlueprintGridEditor } from '../../blueprint-grid-editor'

export const metadata = {
  title: 'Blueprint'
}

interface BlueprintPageProps {
  params: Promise<{ buildId: string; blueprintId: string }>
}

export default async function BlueprintPage({ params }: BlueprintPageProps) {
  const { blueprintId } = await params

  // A missing blueprint is a 404; a genuine failure must reach the error
  // boundary rather than be disguised as "not found".
  const detail = await getBlueprintDetail(blueprintId)
  if (!detail) {
    notFound()
  }

  return (
    <BlueprintGridEditor
      blueprint={detail.blueprint}
      initialCells={detail.cells}
    />
  )
}
