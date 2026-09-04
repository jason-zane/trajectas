import { CampaignOverviewPageComponent } from "@/components/campaigns/pages/campaign-overview-page";

export default async function PartnerCampaignOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CampaignOverviewPageComponent campaignId={id} surface="partner" />;
}
