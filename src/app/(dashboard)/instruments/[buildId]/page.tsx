import { notFound } from 'next/navigation'
import { getInstrumentBuild, listBuildBlueprints, listBuildCongruence, listBlueprintCandidateItems, listBlueprintCells } from '@/app/actions/instrument'
import type { PanelResult } from '@/lib/instrument/congruence'
import type { InstrumentCandidateItemDto } from '@/lib/dal/instrument-mappers'
import type { BlueprintCell } from '@/lib/instrument/types'
import { BuildDetail } from './build-detail'

export const metadata = {
  title: 'Instrument Build'
}

interface InstrumentPageProps {
  params: Promise<{ buildId: string }>
}

export default async function InstrumentPage({ params }: InstrumentPageProps) {
  const { buildId } = await params

  // No try/catch: a missing build is a 404, but a genuine failure must surface
  // to the error boundary rather than being disguised as "not found".
  const build = await getInstrumentBuild(buildId)
  if (!build) {
    notFound()
  }

  const blueprints = await listBuildBlueprints(buildId)

  // Fetch cells for all blueprints
  const cellsByBlueprintId: Record<string, BlueprintCell[]> = {}
  for (const blueprint of blueprints) {
    cellsByBlueprintId[blueprint.id] = await listBlueprintCells(blueprint.id)
  }

  // Fetch items for all blueprints
  const allItems: InstrumentCandidateItemDto[] = []
  for (const blueprint of blueprints) {
    allItems.push(...(await listBlueprintCandidateItems(blueprint.id)))
  }
  const itemsByBlueprintId: Record<string, InstrumentCandidateItemDto[]> = {}
  for (const blueprint of blueprints) {
    itemsByBlueprintId[blueprint.id] = allItems.filter((i) => {
      // Find items belonging to this blueprint by checking if they belong to cells of this blueprint
      const blueprintCellIds = cellsByBlueprintId[blueprint.id]?.map((c) => c.id) ?? []
      return blueprintCellIds.includes(i.blueprintCellId ?? '')
    })
  }

  // Fetch congruence panel (requires at least 2 blueprints)
  const panelResult: PanelResult | null =
    blueprints.length >= 2 ? await listBuildCongruence(buildId) : null

  return (
    <BuildDetail
      build={build}
      blueprints={blueprints}
      cellsByBlueprintId={cellsByBlueprintId}
      itemsByBlueprintId={itemsByBlueprintId}
      panelResult={panelResult}
    />
  )
}
