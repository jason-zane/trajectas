import { CampaignBrandingPageComponent } from "@/components/campaigns/pages/campaign-branding-page";

export default async function ClientCampaignBrandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CampaignBrandingPageComponent campaignId={id} />;
}
