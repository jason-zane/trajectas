import { getCampaignById, getActiveAssessments } from "@/app/actions/campaigns";
import { notFound } from "next/navigation";
import { CampaignAssessmentsList } from "./campaign-assessments-list";

export default async function CampaignAssessmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const allAssessments = await getActiveAssessments();

  return (
    <CampaignAssessmentsList
      campaignId={campaign.id}
      linkedAssessments={campaign.assessments}
      allAssessments={allAssessments}
    />
  );
}
