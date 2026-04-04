import { getCampaignById } from "@/app/actions/campaigns";
import { getAvailableAssessmentsForClient } from "@/app/actions/client-entitlements";
import { notFound } from "next/navigation";
import { CampaignAssessmentsList } from "@/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list";

export default async function ClientCampaignAssessmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  // Fetch only the assessments assigned to this client organization
  let availableAssessments: { id: string; name: string; status: string }[] = [];
  if (campaign.organizationId) {
    const clientAssessments = await getAvailableAssessmentsForClient(
      campaign.organizationId,
    );
    availableAssessments = clientAssessments.map((a) => ({
      id: a.assessmentId,
      name: a.assessmentName,
      status: "active",
    }));
  }

  return (
    <CampaignAssessmentsList
      campaignId={campaign.id}
      linkedAssessments={campaign.assessments}
      allAssessments={availableAssessments}
    />
  );
}
