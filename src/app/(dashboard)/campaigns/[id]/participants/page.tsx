import { getCampaignById } from "@/app/actions/campaigns";
import { notFound } from "next/navigation";
import { CampaignParticipantManager } from "./campaign-participant-manager";
import { CampaignAccessLinks } from "../settings/campaign-access-links";

export default async function CampaignParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  return (
    <div className="space-y-6">
      <CampaignAccessLinks
        campaignId={campaign.id}
        links={campaign.accessLinks}
      />
      <CampaignParticipantManager
        campaignId={campaign.id}
        participants={campaign.participants}
      />
    </div>
  );
}
