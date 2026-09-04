import { notFound } from "next/navigation";

import { getCampaignHeader, getFavoriteCampaignIds } from "@/app/actions/campaigns";
import { getPartnerBrandingEnabled } from "@/app/actions/partner-entitlements";
import { CampaignDetailShell } from "@/app/(dashboard)/campaigns/[id]/campaign-detail-shell";
import { canAccessClient, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { resolvePartnerOrg } from "@/lib/auth/resolve-partner-org";
import { ForceLightTheme } from "@/components/force-light-theme";

export default async function PartnerCampaignDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ partnerId }, campaign, favoriteIds, scope] = await Promise.all([
    resolvePartnerOrg(`/partner/campaigns/${id}`),
    getCampaignHeader(id),
    getFavoriteCampaignIds(),
    resolveAuthorizedScope(),
  ]);

  if (!campaign || !partnerId) notFound();
  // The campaign must belong to a client this partner reaches. `canAccessClient`
  // rather than `canManageClient`: partner members may view the campaign, and
  // each write inside it carries its own `canManageCampaign` check.
  if (!campaign.clientId || !canAccessClient(scope, campaign.clientId)) notFound();

  // D11: the Branding tab appears only while the partner's own flag is on.
  const canCustomizeBranding = await getPartnerBrandingEnabled(partnerId);

  return (
    <>
      <ForceLightTheme />
      <CampaignDetailShell
        campaign={campaign}
        canCustomizeBranding={canCustomizeBranding}
        isFavorite={favoriteIds.includes(id)}
      >
        {children}
      </CampaignDetailShell>
    </>
  );
}
