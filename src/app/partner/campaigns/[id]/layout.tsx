import { notFound } from "next/navigation";

import { getCampaignHeader, getFavoriteCampaignIds } from "@/app/actions/campaigns";
import { getPartnerBrandingEnabled } from "@/app/actions/partner-entitlements";
import { CampaignDetailShell } from "@/app/(dashboard)/campaigns/[id]/campaign-detail-shell";
import { AuthorizationError, requireCampaignManage } from "@/lib/auth/authorization";
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
  const [{ partnerId }, campaign, favoriteIds] = await Promise.all([
    resolvePartnerOrg(`/partner/campaigns/${id}`),
    getCampaignHeader(id),
    getFavoriteCampaignIds(),
  ]);

  if (!campaign || !partnerId) notFound();

  // This console is a management surface: every tab under it renders mutation
  // controls, so entry requires the same right the mutations themselves demand.
  // Ordinary (non-admin) partner members keep the read-only campaign list.
  try {
    await requireCampaignManage(id);
  } catch (error) {
    if (error instanceof AuthorizationError) notFound();
    throw error;
  }

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
