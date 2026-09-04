import { getClientStats, getRecentClientCampaigns } from "@/app/actions/clients";
import { ClientOverview } from "@/app/(dashboard)/clients/[slug]/overview/client-overview";
import { getPartnerName } from "@/lib/dal/partners";
import { requirePartnerClient } from "@/lib/auth/resolve-partner-client";

export default async function PartnerClientOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { client, partnerId } = await requirePartnerClient(slug);

  const [stats, recentCampaigns, partnerName] = await Promise.all([
    getClientStats(client.id),
    getRecentClientCampaigns(client.id),
    getPartnerName(partnerId),
  ]);

  return (
    <ClientOverview
      client={client}
      partnerName={partnerName ?? undefined}
      stats={stats}
      recentCampaigns={recentCampaigns}
      basePath={`/partner/clients/${client.slug}`}
      // The partner portal has one campaigns list across the whole portfolio.
      campaignsHref="/partner/campaigns"
      // The partner is the viewer: naming it is context, not a destination.
      partnerHref={null}
      // "Enter portal" opens an audited support session — platform admins only.
      showEnterPortal={false}
    />
  );
}
