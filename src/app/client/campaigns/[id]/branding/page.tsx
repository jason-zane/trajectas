import { notFound } from "next/navigation";

import { getCampaignHeader } from "@/app/actions/campaigns";
import { isClientBrandingEnabled } from "@/app/actions/client-entitlements";
import { CampaignBrandingPageComponent } from "@/components/campaigns/pages/campaign-branding-page";

export default async function ClientCampaignBrandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The layout only hides the tab; this route is reachable directly, so it
  // enforces the entitlement itself. The matching write-side gate lives in
  // upsertBrandConfig (D5).
  const campaign = await getCampaignHeader(id);
  if (!campaign?.clientId || !(await isClientBrandingEnabled(campaign.clientId))) {
    notFound();
  }

  return <CampaignBrandingPageComponent campaignId={id} />;
}
