import { notFound } from "next/navigation";
import { getCampaignById } from "@/app/actions/campaigns";
import { getParticipants } from "@/app/actions/participants";
import { getCampaignSessions } from "@/app/actions/sessions";
import { getCampaignFactorScores } from "@/app/actions/campaign-results";
import { CampaignResultsHub } from "@/components/results/campaign-results-hub";

export default async function ClientCampaignResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const [{ data: participants }, sessions, factorScoreRows] = await Promise.all([
    getParticipants({ campaignId: id, perPage: 500 }),
    getCampaignSessions(id),
    getCampaignFactorScores(id, "hr_manager"),
  ]);

  return (
    <CampaignResultsHub
      campaignTitle={campaign.title}
      participants={participants}
      sessions={sessions}
      factorScoreRows={factorScoreRows}
      participantHref={(participantId) => `/client/campaigns/${id}/participants/${participantId}`}
      viewResultsHref={(session) => `/client/campaigns/${id}/sessions/${session.id}`}
      factorSessionHref={(row) => `/client/campaigns/${id}/sessions/${row.sessionId}`}
      reportHref={(snapshotId) => `/client/reports/${snapshotId}`}
    />
  );
}
