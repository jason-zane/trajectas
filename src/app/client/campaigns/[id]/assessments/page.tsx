import { getCampaignById } from "@/app/actions/campaigns";
import { getAvailableAssessmentsForClient } from "@/app/actions/client-entitlements";
import {
  getFactorsForAssessment,
  getFactorSelectionForCampaignAssessment,
} from "@/app/actions/factor-selection";
import { getItemSelectionRulesForEstimate } from "@/app/actions/item-selection-rules";
import { notFound } from "next/navigation";
import { CampaignAssessmentsList } from "@/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list";
import type { FactorPickerData } from "@/app/(dashboard)/campaigns/[id]/assessments/campaign-assessments-list";

export default async function ClientCampaignAssessmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  // Fetch only the assessments assigned to this client
  let availableAssessments: { id: string; title: string; status: string }[] = [];
  if (campaign.clientId) {
    const clientAssessments = await getAvailableAssessmentsForClient(
      campaign.clientId,
    );
    availableAssessments = clientAssessments.map((a) => ({
      id: a.assessmentId,
      title: a.assessmentName,
      status: "active",
    }));
  }

  // Load factor picker data for assessments that support customisation
  const customisableAssessments = campaign.assessments.filter(
    (a) => a.minCustomFactors != null,
  );

  const [itemSelectionRules, ...factorResults] = await Promise.all([
    customisableAssessments.length > 0
      ? getItemSelectionRulesForEstimate()
      : Promise.resolve([]),
    ...customisableAssessments.map(async (ca) => {
      const [factorsByDimension, currentSelection] = await Promise.all([
        getFactorsForAssessment(ca.assessmentId),
        getFactorSelectionForCampaignAssessment(ca.id),
      ]);
      return {
        campaignAssessmentId: ca.id,
        factorsByDimension,
        currentSelection,
        minCustomFactors: ca.minCustomFactors!,
      };
    }),
  ]);

  const factorPickerDataMap: Record<string, FactorPickerData> = {};
  for (const result of factorResults) {
    factorPickerDataMap[result.campaignAssessmentId] = result;
  }

  const hasCompletedParticipants = campaign.participants.some(
    (p) => p.status === "completed",
  );

  return (
    <CampaignAssessmentsList
      campaignId={campaign.id}
      linkedAssessments={campaign.assessments}
      allAssessments={availableAssessments}
      factorPickerDataMap={factorPickerDataMap}
      itemSelectionRules={itemSelectionRules}
      hasCompletedParticipants={hasCompletedParticipants}
    />
  );
}
