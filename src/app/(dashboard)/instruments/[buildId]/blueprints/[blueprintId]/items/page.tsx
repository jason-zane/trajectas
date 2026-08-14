import { notFound } from 'next/navigation'
import { getBlueprintWithCells, listCandidateItemsByBlueprint } from '@/lib/dal/instrument'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminScope } from '@/lib/auth/authorization'
import { CandidateItemsView } from './candidate-items-view'

export const metadata = {
  title: 'Candidate Items'
}

interface ItemsPageProps {
  params: Promise<{ buildId: string; blueprintId: string }>
}

export default async function ItemsPage({ params }: ItemsPageProps) {
  await requireAdminScope()
  const { blueprintId } = await params

  const db = createAdminClient()
  const blueprintData = await getBlueprintWithCells(db, blueprintId)
  if (!blueprintData) {
    notFound()
  }

  // The authoring surface shows items from retired cells too, so work done
  // against a facet that was later dropped stays visible rather than vanishing.
  const items = await listCandidateItemsByBlueprint(db, blueprintId, {
    includeRetiredCells: true
  })

  return (
    <CandidateItemsView
      blueprint={blueprintData.blueprint}
      cells={blueprintData.cells}
      items={items}
    />
  )
}
