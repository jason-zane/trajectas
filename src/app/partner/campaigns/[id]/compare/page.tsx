import { redirect } from "next/navigation";

import { getCampaignById } from "@/app/actions/campaigns";
import { canAccessClient, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { resolvePartnerOrg } from "@/lib/auth/resolve-partner-org";
import { CampaignComparePageComponent } from "@/components/campaigns/pages/campaign-compare-page";

export default async function PartnerCompareCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    entries?: string;
    assessments?: string;
    levels?: string;
    delta?: string;
    ids?: string;
    saved?: string;
  }>;
}) {
  const { id: campaignId } = await params;
  const sp = await searchParams;

  await resolvePartnerOrg(`/partner/campaigns/${campaignId}/compare`);
  const [campaign, scope] = await Promise.all([
    getCampaignById(campaignId),
    resolveAuthorizedScope(),
  ]);

  if (campaign && (!campaign.clientId || !canAccessClient(scope, campaign.clientId))) {
    redirect("/unauthorized?reason=membership");
  }

  return (
    <CampaignComparePageComponent
      campaignId={campaignId}
      surface="partner"
      searchParams={sp}
      basePath={`/partner/campaigns/${campaignId}/compare`}
      fallbackPath="/partner/campaigns"
    />
  );
}
