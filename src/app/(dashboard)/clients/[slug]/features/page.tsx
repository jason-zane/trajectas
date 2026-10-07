import { notFound } from 'next/navigation'
import { getClientBySlug } from '@/app/actions/clients'
import { requireAdminScope } from '@/lib/auth/authorization'
import { getTenantWorkspaceFeatures, getWorkspaceFeatureHistory } from '@/lib/dal/workspace-features'
import { WorkspaceFeatureHistory } from '@/components/workspace-feature-history'
import { WorkspaceFeatureSettings } from '@/components/workspace-feature-settings'
export default async function FeaturesPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdminScope()
  const { slug } = await params
  const tenant = await getClientBySlug(slug)
  if (!tenant) notFound()
  const [features, history] = await Promise.all([getTenantWorkspaceFeatures('client', tenant.id), getWorkspaceFeatureHistory({ type: 'client', id: tenant.id })])
  return <div className="space-y-6"><WorkspaceFeatureSettings tenant={{ type: 'client', id: tenant.id }} initial={features} /><WorkspaceFeatureHistory history={history} /></div>
}
