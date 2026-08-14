import { notFound } from 'next/navigation'
import { getInstrumentBuild, listBuildBlueprints, listBlueprintCandidateItems } from '@/app/actions/instrument'
import { createAdminClient } from '@/lib/supabase/admin'
import type { InstrumentCandidateItemDto } from '@/lib/dal/instrument-mappers'
import { PublishView } from './publish-view'

interface PublishPageProps {
  params: Promise<{ buildId: string }>
}

async function getResponseFormats(db: ReturnType<typeof createAdminClient>) {
  try {
    const { data, error } = await db
      .from('response_formats')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{ id: string; name: string; type: string }>
  } catch (error) {
    console.error('Failed to load response formats:', error)
    return []
  }
}

async function getDimensions(db: ReturnType<typeof createAdminClient>) {
  try {
    const { data, error } = await db
      .from('dimensions')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{ id: string; name: string; slug: string }>
  } catch (error) {
    console.error('Failed to load dimensions:', error)
    return []
  }
}

export default async function PublishPage({ params }: PublishPageProps) {
  const { buildId } = await params

  const build = await getInstrumentBuild(buildId)
  if (!build) {
    notFound()
  }

  const blueprints = await listBuildBlueprints(buildId)

  // Load all candidate items for all blueprints
  const allItems: InstrumentCandidateItemDto[] = []
  for (const bp of blueprints) {
    const items = await listBlueprintCandidateItems(bp.id)
    allItems.push(...items)
  }

  const db = createAdminClient()
  const responseFormats = await getResponseFormats(db)
  const dimensions = await getDimensions(db)

  return (
    <PublishView
      buildId={buildId}
      build={build}
      blueprints={blueprints}
      candidateItems={allItems}
      responseFormats={responseFormats}
      dimensions={dimensions}
    />
  )
}
