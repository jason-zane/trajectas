import { getCampaignById } from "@/app/actions/campaigns";
import { notFound } from "next/navigation";
import { CampaignCandidateManager } from "./campaign-candidate-manager";

export default async function CampaignCandidatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  return (
    <CampaignCandidateManager
      campaignId={campaign.id}
      candidates={campaign.candidates}
    />
  );
}
