import { getCampaignById, getCampaignSessions } from "@/app/actions/campaigns";
import { notFound } from "next/navigation";
import { CampaignParticipantManager } from "./campaign-participant-manager";
import { CampaignAccessLinks } from "../settings/campaign-access-links";

export default async function CampaignParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Resolve the campaign first so we can render notFound() cleanly for
  // missing or inaccessible IDs. getCampaignSessions throws on
  // unauthorized access, so calling it in parallel would regress the
  // 404 path to an exception.
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();
  const sessions = await getCampaignSessions(id);

  return (
    <div className="space-y-6">
      <CampaignAccessLinks
        campaignId={campaign.id}
        links={campaign.accessLinks}
      />
      <CampaignParticipantManager
        campaignId={campaign.id}
        participants={campaign.participants}
        sessions={sessions}
        canDeleteSessions
      />
    </div>
  );
}
