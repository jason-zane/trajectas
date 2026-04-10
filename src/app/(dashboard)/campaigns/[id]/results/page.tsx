import { notFound } from "next/navigation";
import { getCampaignById } from "@/app/actions/campaigns";
import { getParticipants } from "@/app/actions/participants";
import { getCampaignSessions } from "@/app/actions/sessions";
import { CampaignResultsHub } from "@/components/results/campaign-results-hub";

export default async function AdminCampaignResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const [{ data: participants }, sessions] = await Promise.all([
    getParticipants({ campaignId: id, perPage: 500 }),
    getCampaignSessions(id),
  ]);

  return (
    <CampaignResultsHub
      campaignTitle={campaign.title}
      participants={participants}
      sessions={sessions}
      participantHref={(p) => `/participants/${p.id}`}
      sessionHref={(s) => `/participants/${s.participantId}/sessions/${s.id}`}
    />
  );
}
