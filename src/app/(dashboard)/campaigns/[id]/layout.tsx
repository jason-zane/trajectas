import { getCampaignHeader } from "@/app/actions/campaigns";
import { notFound } from "next/navigation";
import { CampaignDetailShell } from "./campaign-detail-shell";

export default async function CampaignDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignHeader(id);
  if (!campaign) notFound();

  // Platform-owned campaigns (no client) default to customisable in the admin
  // portal; otherwise honour the client's flag.
  const canCustomizeBranding = campaign.clientCanCustomizeBranding ?? true;

  return (
    <CampaignDetailShell
      campaign={campaign}
      canCustomizeBranding={canCustomizeBranding}
    >
      {children}
    </CampaignDetailShell>
  );
}
