import { getWebhookBacklogReview } from '@/lib/dal/webhook-backlog'
import { WebhookBacklogReviewPanel } from '@/components/webhook-backlog-review'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { getClientInternalIntegrationSettings } from "@/app/actions/integrations";
import { getPartnerBrandingEnabled } from "@/app/actions/partner-entitlements";
import { ClientSettingsPanel } from "@/app/(dashboard)/clients/[slug]/settings/client-settings-panel";
import { requirePartnerClient } from "@/lib/auth/resolve-partner-client";

export default async function PartnerClientSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!await isWorkspaceFeatureEnabled('clientManagement')) return <WorkspaceFeatureUnavailable feature="clientManagement" />
  const { slug } = await params;
  const { client, partnerId } = await requirePartnerClient(slug);

  const [partnerBrandingEnabled, integrationSettings] = await Promise.all([
    getPartnerBrandingEnabled(partnerId),
    (await isWorkspaceFeatureEnabled('integrationManagement')) ? getClientInternalIntegrationSettings(client.id) : Promise.resolve(null),
  ]);

  const backlog = integrationSettings?.canManage ? await getWebhookBacklogReview(client.id) : null;
  return (
    <div className="space-y-6"><ClientSettingsPanel
      clientId={client.id}
      clientSlug={slug}
      canCustomizeBranding={client.canCustomizeBranding ?? false}
      partnerBrandingDisabled={!partnerBrandingEnabled}
      partnerBrandingDisabledMessage="Brand customisation is not enabled for your partner organisation. Contact Trajectas to switch it on."
      integrationSettings={integrationSettings}
    />{backlog && <WebhookBacklogReviewPanel clientId={client.id} initial={backlog} />}</div>
  );
}
