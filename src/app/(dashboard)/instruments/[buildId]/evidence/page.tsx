import { notFound } from 'next/navigation'
import { getInstrumentBuild, listBuildBlueprints, listBuildCongruence, listBlueprintCandidateItems } from '@/app/actions/instrument'
import type { PanelResult } from '@/lib/instrument/congruence'
import type { InstrumentCandidateItemDto } from '@/lib/dal/instrument-mappers'
import { EvidenceView } from './evidence-view'

interface EvidencePageProps {
  params: Promise<{ buildId: string }>
}

export const metadata = {
  title: 'Evidence — Instrument Build'
}

export default async function EvidencePage({ params }: EvidencePageProps) {
  const { buildId } = await params

  const build = await getInstrumentBuild(buildId)
  if (!build) {
    notFound()
  }

  const blueprints = await listBuildBlueprints(buildId)

  // A build with fewer than two constructs simply has no panel to show — that
  // is an empty state, not an error. Query failures are NOT caught: they must
  // reach the error boundary rather than render as "no evidence".
  const panelResult: PanelResult | null =
    blueprints.length >= 2 ? await listBuildCongruence(buildId) : null

  const allItems: InstrumentCandidateItemDto[] = []
  for (const blueprint of blueprints) {
    allItems.push(...(await listBlueprintCandidateItems(blueprint.id)))
  }
  const candidateItems = allItems.filter((i) => i.status !== 'rejected')

  return (
    <EvidenceView
      buildId={buildId}
      build={build}
      blueprints={blueprints}
      panelResult={panelResult}
      candidateItems={candidateItems}
    />
  )
}
