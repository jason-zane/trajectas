import { getCampaignHeader, getFavoriteCampaignIds } from "@/app/actions/campaigns";
import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { notFound } from "next/navigation";
import { CampaignDetailShell } from "@/app/(dashboard)/campaigns/[id]/campaign-detail-shell";

export default async function ClientCampaignDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { clientId } = await resolveClientOrg("/client/campaigns");
  const { id } = await params;

  const [campaign, favoriteIds] = await Promise.all([
    getCampaignHeader(id),
    getFavoriteCampaignIds(),
  ]);

  if (!campaign) notFound();

  // Security: verify campaign belongs to the active client
  if (!clientId || campaign.clientId !== clientId) {
    notFound();
  }

  // No client → no branding customisation on the client portal.
  const canCustomizeBranding = campaign.clientCanCustomizeBranding ?? false;

  return (
    <CampaignDetailShell
      campaign={campaign}
      canCustomizeBranding={canCustomizeBranding}
      isFavorite={favoriteIds.includes(id)}
    >
      {children}
    </CampaignDetailShell>
  );
}
