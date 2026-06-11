import { CampaignParticipantsPageComponent } from "@/components/campaigns/pages/campaign-participants-page";

export default async function ClientCampaignParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CampaignParticipantsPageComponent campaignId={id} surface="client" />;
}
