import { CampaignOverviewPageComponent } from "@/components/campaigns/pages/campaign-overview-page";

export default async function ClientCampaignOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CampaignOverviewPageComponent campaignId={id} surface="client" />;
}
