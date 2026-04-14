import { notFound } from "next/navigation";
import { getCampaignById } from "@/app/actions/campaigns";
import { getParticipants } from "@/app/actions/participants";
import { getCampaignSessions } from "@/app/actions/sessions";
import { getCampaignFactorScores } from "@/app/actions/campaign-results";
import { CampaignResultsHub } from "@/components/results/campaign-results-hub";

export default async function PartnerCampaignResultsPage({
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
    getCampaignFactorScores(id, "consultant"),
  ]);

  return (
    <CampaignResultsHub
      campaignTitle={campaign.title}
      participants={participants}
      sessions={sessions}
      factorScoreRows={factorScoreRows}
      participantHref={(participantId) => `/partner/campaigns/${id}/participants/${participantId}`}
      viewResultsHref={(session) => `/partner/campaigns/${id}/sessions/${session.id}`}
      factorSessionHref={(row) => `/partner/campaigns/${id}/sessions/${row.sessionId}`}
      reportHref={(snapshotId) => `/partner/reports/${snapshotId}`}
    />
  );
}
