import { notFound } from "next/navigation";

import { getPartnerBrandingEnabled } from "@/app/actions/partner-entitlements";
import { CampaignBrandingPageComponent } from "@/components/campaigns/pages/campaign-branding-page";
import { resolvePartnerOrg } from "@/lib/auth/resolve-partner-org";

export default async function PartnerCampaignBrandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The layout only hides the Branding tab when the partner's flag is off; this
  // route is reachable directly, so it enforces the flag itself. The matching
  // write-side gate lives in upsertBrandConfig (D5).
  const { partnerId } = await resolvePartnerOrg(`/partner/campaigns/${id}/branding`);
  if (!partnerId || !(await getPartnerBrandingEnabled(partnerId))) notFound();

  return <CampaignBrandingPageComponent campaignId={id} />;
}
