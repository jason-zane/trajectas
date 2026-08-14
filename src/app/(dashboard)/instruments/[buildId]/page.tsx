import { notFound } from 'next/navigation'
import { getInstrumentBuild, listBuildBlueprints } from '@/app/actions/instrument'
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

  return <BuildDetail build={build} blueprints={blueprints} />
}
