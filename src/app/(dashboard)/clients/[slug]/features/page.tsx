import { notFound } from 'next/navigation'
import { getClientBySlug } from '@/app/actions/clients'
import { requireAdminScope } from '@/lib/auth/authorization'
import { getTenantWorkspaceFeatures } from '@/lib/dal/workspace-features'
import { WorkspaceFeatureSettings } from '@/components/workspace-feature-settings'
export default async function FeaturesPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdminScope()
  const { slug } = await params
  const tenant = await getClientBySlug(slug)
  if (!tenant) notFound()
  const features = await getTenantWorkspaceFeatures('client', tenant.id)
  return <WorkspaceFeatureSettings tenant={{ type: 'client', id: tenant.id }} initial={features} />
}
