import { notFound } from 'next/navigation'
import { getInstrumentBuild } from '@/app/actions/instrument'
import { StructureEditor } from './structure-editor'

export const metadata = {
  title: 'Propose Constructs'
}

interface StructurePageProps {
  params: Promise<{ buildId: string }>
}

export default async function StructurePage({ params }: StructurePageProps) {
  const { buildId } = await params

  const build = await getInstrumentBuild(buildId)
  if (!build) {
    notFound()
  }

  return <StructureEditor build={build} />
}
