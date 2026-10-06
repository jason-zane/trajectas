import { notFound } from 'next/navigation'
import { getPartnerBySlug } from '@/app/actions/partners'
import { requireAdminScope } from '@/lib/auth/authorization'
import { getTenantWorkspaceFeatures } from '@/lib/dal/workspace-features'
import { WorkspaceFeatureSettings } from '@/components/workspace-feature-settings'
export default async function FeaturesPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdminScope()
  const { slug } = await params
  const tenant = await getPartnerBySlug(slug)
  if (!tenant) notFound()
  const features = await getTenantWorkspaceFeatures('partner', tenant.id)
  return <WorkspaceFeatureSettings tenant={{ type: 'partner', id: tenant.id }} initial={features} />
}
