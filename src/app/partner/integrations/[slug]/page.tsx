import { resolvePartnerIntegrationOrg, getPartnerIntegrationClient } from '@/lib/dal/partner-integration-clients'
import { getClientInternalIntegrationSettings } from '@/app/actions/integrations'
import { getWebhookBacklogReview } from '@/lib/dal/webhook-backlog'
import { ClientIntegrationsPanel } from '@/app/(dashboard)/clients/[slug]/settings/client-integrations-panel'
import { WebhookBacklogReviewPanel } from '@/components/webhook-backlog-review'
import { PageHeader } from '@/components/page-header'
import { AuthorizationError } from '@/lib/auth/authorization'

export default async function PartnerIntegrationClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { partnerId } = await resolvePartnerIntegrationOrg(`/partner/integrations/${slug}`)
  if (!partnerId) throw new AuthorizationError('Partner workspace unavailable.')
  const client = await getPartnerIntegrationClient(partnerId, slug)
  const settings = await getClientInternalIntegrationSettings(client.id)
  if (!settings.canManage) throw new AuthorizationError('Client not found or inaccessible.')
  const backlog = await getWebhookBacklogReview(client.id)
  return <div className="space-y-6 max-w-6xl">
    <PageHeader eyebrow="Integrations" title={client.name} description="Connections and saved webhook events" />
    <ClientIntegrationsPanel clientId={client.id} clientSlug={client.slug} settings={settings} disabled={false} />
    <WebhookBacklogReviewPanel clientId={client.id} initial={backlog} />
  </div>
}
