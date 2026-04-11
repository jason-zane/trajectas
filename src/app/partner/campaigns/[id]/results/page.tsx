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
      participantHref={(p) => `/partner/campaigns/${id}/participants/${p.id}`}
      sessionHref={(s) => `/partner/campaigns/${id}/participants/${s.participantId}/sessions/${s.id}`}
      factorSessionHref={(row) => `/partner/campaigns/${id}/participants/${row.participantId}/sessions/${row.sessionId}`}
      reportHref={(snapshotId) => `/partner/reports/${snapshotId}`}
    />
  );
}
