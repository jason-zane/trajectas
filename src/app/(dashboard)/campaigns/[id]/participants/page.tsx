import { getCampaignById } from "@/app/actions/campaigns";
import { notFound } from "next/navigation";
import { CampaignParticipantManager } from "./campaign-participant-manager";

export default async function CampaignParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  return (
    <CampaignParticipantManager
      campaignId={campaign.id}
      participants={campaign.participants}
    />
  );
}
